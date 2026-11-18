import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ORDERED_LOCALES,
  SUPPORTED_LANGUAGES,
  GEMINI_NANO_SUPPORTED_LOCALES,
  detectLanguageLocale,
  scrubPii,
  routeDiagnosticPayload,
} from './adaptive-router';
import {
  runMultilingualEvalSuite,
  evaluateSingleLocaleBenchmark,
  scoreCandidateRubric,
} from './multilingual-eval';
import {
  GENESIS_PREV_HASH,
  createSignedBlackBoxBlock,
  verifyBlackBoxChain,
  simulateChainTampering,
} from './hash-chain';
import { computeEdgeCloudConsensus } from './firebase-ai-hybrid';
import { percentile, summarizeLatencies } from './latency-stats';
import {
  computeNormalizedDeviceCoords,
  stepPointerKinematics,
  classifyGpuHardwareFromRenderer,
} from './gpu-render-engine';

test('Adaptive Router detects English + all Top-10+ non-English automotive scripts accurately', () => {
  for (const locale of ORDERED_LOCALES) {
    const sample = SUPPORTED_LANGUAGES[locale].defaultSamplePrompt;
    const detected = detectLanguageLocale(sample);
    assert.equal(
      detected,
      locale,
      `Expected locale ${locale} for sample "${sample.slice(0, 30)}...", got ${detected}`
    );
  }
});

test('Adaptive Router routes English structured logs to PREFER_ON_DEVICE, non-English to PREFER_IN_CLOUD, and offline to ONLY_ON_DEVICE', () => {
  const enDecision = routeDiagnosticPayload(
    SUPPORTED_LANGUAGES.en.defaultSamplePrompt,
    'BALANCED_HYBRID',
    undefined,
    { isOffline: false }
  );
  assert.equal(enDecision.routeTarget, 'PREFER_ON_DEVICE');
  assert.equal(enDecision.nanoLanguageSupported, true);
  assert.equal(enDecision.safetyCheck.severity, 'SAFE_STATE_LOCK');
  assert.ok(enDecision.piiResult.redactionCount >= 2);

  // Offline mode forces ONLY_ON_DEVICE
  const offlineDecision = routeDiagnosticPayload(
    SUPPORTED_LANGUAGES.en.defaultSamplePrompt,
    'BALANCED_HYBRID',
    undefined,
    { isOffline: true }
  );
  assert.equal(offlineDecision.routeTarget, 'ONLY_ON_DEVICE');
  assert.equal(offlineDecision.isOffline, true);

  // Verify Gemini Nano supported locales list
  assert.deepEqual(GEMINI_NANO_SUPPORTED_LOCALES, ['en', 'es', 'ja']);

  const nonEnglishLocales = ORDERED_LOCALES.filter((l) => l !== 'en');
  for (const loc of nonEnglishLocales) {
    const decision = routeDiagnosticPayload(
      SUPPORTED_LANGUAGES[loc].defaultSamplePrompt,
      'BALANCED_HYBRID',
      undefined,
      { isOffline: false }
    );
    assert.equal(
      decision.routeTarget,
      'PREFER_IN_CLOUD',
      `Non-English locale ${loc} should route to PREFER_IN_CLOUD`
    );
    assert.match(decision.targetModelLabel, /gemini-2\.5-flash-lite/);
    assert.equal(decision.safetyCheck.faultCode, 'P0A78');
  }
});

test('PII Scrubber removes VINs, Emails, GPS coordinates, and Phone numbers with zero leak', () => {
  const raw =
    'Alert on VIN=1FA6P8CF0H1234567 at 42.3314,-83.0458 reported by john.doe@qnx.io phone 138-0013-8000 Badge T-9482';
  const res = scrubPii(raw);
  assert.ok(!res.sanitizedText.includes('1FA6P8CF0H1234567'));
  assert.ok(!res.sanitizedText.includes('john.doe@qnx.io'));
  assert.ok(!res.sanitizedText.includes('42.3314,-83.0458'));
  assert.ok(!res.sanitizedText.includes('138-0013-8000'));
  assert.ok(res.redactionCount >= 4);
});

test('Multilingual Eval Harness measures real pre-check latencies and keeps model TTFT null until live model runs', () => {
  const suite = runMultilingualEvalSuite('BALANCED_HYBRID');
  assert.equal(suite.totalLanguagesEvaluated, 12);
  assert.equal(suite.zeroPiiLeakComplianceRate, 100);
  assert.equal(suite.liveModelsExecutedCount, 0);
  assert.equal(suite.measuredLiveModelMeanTtftMs, null);
  assert.ok(suite.measuredPreCheckP50Ms > 0);

  const knRow = evaluateSingleLocaleBenchmark('kn', 'BALANCED_HYBRID');
  assert.equal(knRow.evaluationSource, 'DETERMINISTIC_PRECHECK_BASELINE');
  assert.equal(knRow.measuredModelTtftMs, null);
  assert.equal(knRow.hybridRubric.totalScore, 100);

  // Verify rubric penalizes incomplete or inaccurate model output
  const degradedRubric = scoreCandidateRubric(
    scrubPii(SUPPORTED_LANGUAGES.kn.defaultSamplePrompt),
    {
      faultCode: 'U0001',
      severity: 'NOMINAL',
      extractedTempC: 45.0,
      extractedIsolationKOhm: 500,
      remediationText: 'Too short',
    }
  );
  assert.equal(degradedRubric.faultClassification, 0);
  assert.equal(degradedRubric.numericExtraction, 0);
  assert.equal(degradedRubric.zeroPiiLeak, 25);
  assert.equal(degradedRubric.actionableRemediation, 0);
  assert.equal(degradedRubric.totalScore, 25);
});

test('Latency stats utility computes nearest-rank p50, p95, p99 and mean accurately', () => {
  const summary = summarizeLatencies([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
  assert.equal(summary.n, 10);
  assert.equal(summary.min, 10);
  assert.equal(summary.p50, 50);
  assert.equal(summary.p95, 100);
  assert.equal(summary.max, 100);
  assert.equal(summary.mean, 55);
  assert.equal(percentile([1, 2, 3, 4], 50), 2);
});

test('SHA-256 Hash-Chained Black-Box Flight Recorder verifies intact chain and catches simulated tampering', async () => {
  const b0 = await createSignedBlackBoxBlock({
    sequenceIndex: 0,
    eventType: 'TELEMETRY_SNAPSHOT',
    locale: 'en',
    routeTarget: 'PREFER_ON_DEVICE',
    consensusScore: 100,
    summary:
      'Initial QNX PPS ring-buffer snapshot: SiC_Temp=184.6C, Isolation=82kOhm',
    prevHash: GENESIS_PREV_HASH,
  });

  const b1 = await createSignedBlackBoxBlock({
    sequenceIndex: 1,
    eventType: 'ROUTING_DECISION',
    locale: 'kn',
    routeTarget: 'PREFER_IN_CLOUD',
    consensusScore: 99,
    summary:
      'Kannada diagnostic routed to Cloud Gemini after local STO check',
    prevHash: b0.entryHash,
  });

  const intactReport = await verifyBlackBoxChain([b0, b1]);
  assert.equal(intactReport.isValid, true);
  assert.equal(intactReport.tamperedBlockIndex, null);

  const tamperedChain = simulateChainTampering([b0, b1], 0);
  const tamperedReport = await verifyBlackBoxChain(tamperedChain);
  assert.equal(tamperedReport.isValid, false);
  assert.equal(tamperedReport.tamperedBlockIndex, 0);
});

test('Speculative Edge-vs-Cloud Consensus Gate scores unanimous, discrepancy, and AUDIT_UNAVAILABLE states accurately', () => {
  const unanimous = computeEdgeCloudConsensus(
    {
      faultCode: 'P0A78',
      severity: 'SAFE_STATE_LOCK',
      extractedTempC: 184.6,
      extractedIsolationKOhm: 82,
    },
    {
      faultCode: 'P0A78',
      severity: 'SAFE_STATE_LOCK',
      extractedTempC: 184.6,
      extractedIsolationKOhm: 82,
    }
  );
  assert.equal(unanimous.consensusScore, 100);
  assert.equal(unanimous.status, 'UNANIMOUS_CONSENSUS');
  assert.equal(unanimous.discrepancies.length, 0);

  const diverged = computeEdgeCloudConsensus(
    {
      faultCode: 'U0100',
      severity: 'WARNING',
      extractedTempC: 150.0,
      extractedIsolationKOhm: 82,
    },
    {
      faultCode: 'P0A78',
      severity: 'SAFE_STATE_LOCK',
      extractedTempC: 184.6,
      extractedIsolationKOhm: 82,
    }
  );
  assert.ok(diverged.consensusScore !== null && diverged.consensusScore < 50);
  assert.equal(diverged.status, 'DISCREPANCY_ALERT');
  assert.ok(diverged.discrepancies.length >= 2);

  // Cloud failure must return AUDIT_UNAVAILABLE and consensusScore: null
  const cloudFailed = computeEdgeCloudConsensus(
    {
      faultCode: 'P0A78',
      severity: 'SAFE_STATE_LOCK',
      extractedTempC: 184.6,
      extractedIsolationKOhm: 82,
    },
    {
      faultCode: null,
      severity: null,
      extractedTempC: null,
      extractedIsolationKOhm: null,
    }
  );
  assert.equal(cloudFailed.consensusScore, null);
  assert.equal(cloudFailed.status, 'AUDIT_UNAVAILABLE');
});

test('3-Layer Frontend Rendering Engine computes Normalized Device Coordinates (NDC), damped kinematics, and GPU hardware tiers', () => {
  // Center of a 1440x900 viewport -> NDC (0, 0)
  const center = computeNormalizedDeviceCoords(720, 450, 1440, 900);
  assert.equal(center.ndcX, 0);
  assert.equal(center.ndcY, 0);

  // Top-left (0, 0) -> NDC (-1, +1); Bottom-right (1440, 900) -> NDC (+1, -1)
  const topLeft = computeNormalizedDeviceCoords(0, 0, 1440, 900);
  assert.equal(topLeft.ndcX, -1);
  assert.equal(topLeft.ndcY, 1);

  const bottomRight = computeNormalizedDeviceCoords(1440, 900, 1440, 900);
  assert.equal(bottomRight.ndcX, 1);
  assert.equal(bottomRight.ndcY, -1);

  // Spring-damped pointer kinematics step: current += (target - current) * 0.08
  const kinState = {
    clientX: 1440,
    clientY: 0,
    targetNdcX: 1.0,
    targetNdcY: 1.0,
    currentNdcX: 0.0,
    currentNdcY: 0.0,
    velocityX: 0,
    velocityY: 0,
    speedMagnitude: 0,
    pressure: 0.5,
    scrollOffsetPx: 100,
    scrollVelocity: 0.5,
  };
  stepPointerKinematics(kinState, 0.08);
  assert.ok(Math.abs(kinState.currentNdcX - 0.08) < 1e-6);
  assert.ok(Math.abs(kinState.currentNdcY - 0.08) < 1e-6);
  assert.ok(kinState.speedMagnitude > 0);
  assert.ok(Math.abs(kinState.scrollVelocity - 0.45) < 1e-6);

  // GPU Tier Fingerprinting & DPR capping
  const discrete = classifyGpuHardwareFromRenderer(
    'ANGLE (NVIDIA, NVIDIA GeForce RTX 4090 Direct3D11)',
    16,
    3.0
  );
  assert.equal(discrete.tier, 'TIER_1_DISCRETE_GPU');
  assert.equal(discrete.isSoftwareGl, false);
  assert.equal(discrete.effectivePixelRatio, 2.0); // Capped at 2.0 to prevent 4K overdraw

  const software = classifyGpuHardwareFromRenderer(
    'Google SwiftShader',
    4,
    2.5
  );
  assert.equal(software.tier, 'TIER_3_SOFTWARE_RASTERIZER');
  assert.equal(software.isSoftwareGl, true);
  assert.equal(software.effectivePixelRatio, 1.0); // Capped at 1.0 on software rasterizer
});


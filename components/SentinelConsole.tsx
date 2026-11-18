'use client';

import React, { useState, useCallback } from 'react';
import {
  Cpu,
  Cloud,
  ShieldCheck,
  AlertTriangle,
  Sliders,
  Play,
  LogIn,
  LogOut,
  CheckCircle2,
  Info,
  WifiOff,
  Wifi,
  Volume2,
  VolumeX,
  Download,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { useSentinelRuntime } from '@/hooks/useSentinelRuntime';
import {
  collection,
  doc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import {
  ORDERED_LOCALES,
  SUPPORTED_LANGUAGES,
  SupportedLocale,
  ExperimentArm,
  AdaptiveRoutingDecision,
  routeDiagnosticPayload,
  buildLocalizedRemediation,
} from '@/lib/adaptive-router';
import {
  ConsensusGateResult,
  NanoHardwareAvailability,
  executeSpeculativeConsensusGate,
  probeGeminiNanoAvailability,
} from '@/lib/firebase-ai-hybrid';
import {
  BlackBoxBlock,
  ChainVerificationReport,
  GENESIS_PREV_HASH,
  createSignedBlackBoxBlock,
  verifyBlackBoxChain,
  simulateChainTampering,
} from '@/lib/hash-chain';
import {
  getOfflineQueue,
  flushOfflineForensicsQueue,
  OfflineForensicQueueItem,
} from '@/lib/offline-queue';
import { triggerSpatialUiFeedback } from '@/lib/gpu-render-engine';
import {
  auth,
  db,
  isFirebaseConfigured,
  OperationType,
  handleFirestoreError,
  testFirestoreConnection,
  initSentinelAppCheck,
  initSentinelRemoteConfig,
  getSentinelFirebaseAI,
  signInWithGoogleOperator,
  signOutOperator,
} from '@/lib/firebase-client';
import VoiceDiagnosticsButton from './VoiceDiagnosticsButton';
import MultimodalVisionInspector, {
  VisionInspectionOutput,
} from './MultimodalVisionInspector';
import MultilingualEvalPanel from './MultilingualEvalPanel';
import BlackBoxRecorderPanel from './BlackBoxRecorderPanel';
import QnxTargetViewer from './QnxTargetViewer';
import TubesBackground from './TubesBackground';
import { SubsystemGrid, UsbBridge, TravellingDebugCable } from './SentinelVisualLayers';

export type WorkbenchView = 'triage' | 'vision' | 'ledger' | 'eval_qnx';

export default function SentinelConsole() {
  const [activeView, setActiveView] = useState<WorkbenchView>('triage');
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);

  const runtime = useSentinelRuntime();
  const { currentUser, experimentArm, setExperimentArm, simulateOfflineMode,
    setSimulateOfflineMode, offlineQueueItems, setOfflineQueueItems,
    nanoDownloadPct, setNanoDownloadPct, setRemoteConfigSource,
    selectedLocale, setSelectedLocale, rawTelemetryInput, setRawTelemetryInput,
    routingDecision, setRoutingDecision, consensusResult, setConsensusResult,
    isTriaging, setIsTriaging, preferOnDeviceCount, setPreferOnDeviceCount,
    preferInCloudCount, setPreferInCloudCount } = runtime;

  // Feature 4: SHA-256 Hash-Chained Black-Box Flight Recorder (Starts empty — no pre-seeded fake blocks)
  const [blackBoxChain, setBlackBoxChain] = useState<BlackBoxBlock[]>([]);
  const [uncorruptedBackupChain, setUncorruptedBackupChain] = useState<
    BlackBoxBlock[]
  >([]);
  const [isChainTampered, setIsChainTampered] = useState<boolean>(false);
  const [verificationReport, setVerificationReport] =
    useState<ChainVerificationReport | null>(null);
  const [firestoreSyncStatus, setFirestoreSyncStatus] = useState<string | null>(
    null
  );

  // View Transitions API + Spatial Audio/Haptics View Switcher
  const switchWorkbenchView = useCallback(
    (nextView: WorkbenchView) => {
      triggerSpatialUiFeedback({
        ndcX: 0,
        frequencyHz: 680,
        enableAudio: false,
        enableHaptics: true,
      });
      const docWithTransition = document as Document & {
        startViewTransition?: (cb: () => void) => void;
      };
      if (typeof docWithTransition.startViewTransition === 'function') {
        docWithTransition.startViewTransition(() => {
          setActiveView(nextView);
        });
      } else {
        setActiveView(nextView);
      }
    },
    []
  );

  const appendBlockToChain = useCallback(
    async (params: {
      eventType: BlackBoxBlock['eventType'];
      locale: string;
      routeTarget: BlackBoxBlock['routeTarget'];
      consensusScore: number;
      summary: string;
      isSampleData?: boolean;
    }) => {
      setBlackBoxChain((prev) => {
        const baseChain = isChainTampered ? uncorruptedBackupChain : prev;
        const lastBlock = baseChain[baseChain.length - 1];
        const prevHash = lastBlock ? lastBlock.entryHash : GENESIS_PREV_HASH;
        const nextIndex = baseChain.length;

        createSignedBlackBoxBlock({
          sequenceIndex: nextIndex,
          eventType: params.eventType,
          locale: params.locale,
          routeTarget: params.routeTarget,
          consensusScore: params.consensusScore,
          summary: params.summary,
          prevHash,
          isSampleData: params.isSampleData,
        }).then(async (newBlock) => {
          const updated = [...baseChain, newBlock];
          setBlackBoxChain(updated);
          setUncorruptedBackupChain(updated);
          setIsChainTampered(false);
          const verified = await verifyBlackBoxChain(updated);
          setVerificationReport(verified);
        });

        return prev;
      });
    },
    [isChainTampered, uncorruptedBackupChain]
  );

  const handleLoadSampleBlocks = async () => {
    const b0 = await createSignedBlackBoxBlock({
      id: 'blk_0_sample',
      sequenceIndex: 0,
      timestampIso: '2026-11-15T06:20:00.000Z',
      eventType: 'TELEMETRY_SNAPSHOT',
      locale: 'en',
      routeTarget: 'PREFER_ON_DEVICE',
      consensusScore: 100,
      summary:
        '[SAMPLE DATA] QNX PPS crash dump #0: CAN_ID=0x18FF50E5 DTC=P0A78 SiC_Temp=184.6C Isolation=82kOhm',
      prevHash: GENESIS_PREV_HASH,
      isSampleData: true,
    });

    const b1 = await createSignedBlackBoxBlock({
      id: 'blk_1_sample',
      sequenceIndex: 1,
      timestampIso: '2026-11-15T06:20:01.120Z',
      eventType: 'PII_REDACTION',
      locale: 'en',
      routeTarget: 'PREFER_ON_DEVICE',
      consensusScore: 100,
      summary:
        '[SAMPLE DATA] Client PII Airlock scrubbed 3 tokens (VIN, EMAIL, GPS_COORDS) prior to firebase/ai dispatch.',
      prevHash: b0.entryHash,
      isSampleData: true,
    });

    const sampleChain = [b0, b1];
    const report = await verifyBlackBoxChain(sampleChain);
    setBlackBoxChain(sampleChain);
    setUncorruptedBackupChain(sampleChain);
    setIsChainTampered(false);
    setVerificationReport(report);
  };

  const handleSelectLanguagePreset = (locale: SupportedLocale) => {
    triggerSpatialUiFeedback({
      ndcX: 0,
      frequencyHz: 540,
      enableAudio: false,
      enableHaptics: true,
    });
    const sample = SUPPORTED_LANGUAGES[locale].defaultSamplePrompt;
    setSelectedLocale(locale);
    setRawTelemetryInput(sample);
    const decision = routeDiagnosticPayload(sample, experimentArm, locale, {
      isOffline: simulateOfflineMode,
    });
    setRoutingDecision(decision);
    if (
      decision.routeTarget === 'PREFER_ON_DEVICE' ||
      decision.routeTarget === 'ONLY_ON_DEVICE'
    ) {
      setPreferOnDeviceCount((c) => c + 1);
    } else {
      setPreferInCloudCount((c) => c + 1);
    }
  };

  const handleToggleExperimentArm = (nextArm: ExperimentArm) => {
    triggerSpatialUiFeedback({
      ndcX: 0,
      frequencyHz: 720,
      enableAudio: false,
      enableHaptics: true,
    });
    setExperimentArm(nextArm);
    setRemoteConfigSource('remote-config-override');
    const updatedDecision = routeDiagnosticPayload(
      rawTelemetryInput,
      nextArm,
      undefined,
      { isOffline: simulateOfflineMode }
    );
    setRoutingDecision(updatedDecision);
  };

  const handleToggleOfflineMode = () => {
    triggerSpatialUiFeedback({
      ndcX: 0,
      frequencyHz: 480,
      enableAudio: false,
      enableHaptics: true,
    });
    const nextOffline = !simulateOfflineMode;
    setSimulateOfflineMode(nextOffline);
    const updatedDecision = routeDiagnosticPayload(
      rawTelemetryInput,
      experimentArm,
      undefined,
      { isOffline: nextOffline }
    );
    setRoutingDecision(updatedDecision);
  };

  const handleFlushOfflineQueue = async () => {
    const res = await flushOfflineForensicsQueue(async (item) => {
      const dec = routeDiagnosticPayload(
        item.sanitizedPayload,
        experimentArm,
        item.locale,
        { isOffline: false }
      );
      const gate = await executeSpeculativeConsensusGate(dec);
      return {
        summary:
          gate.cloudAudit.localizedRemediation ||
          gate.edgeTriage.summary ||
          'Flushed via firebase/ai',
      };
    });
    setOfflineQueueItems(res.updatedQueue);
  };

  const handleExecuteTriage = async () => {
    triggerSpatialUiFeedback({
      ndcX: 0,
      frequencyHz: 880,
      enableAudio: false,
      enableHaptics: true,
    });
    setIsTriaging(true);
    try {
      const decision = routeDiagnosticPayload(
        rawTelemetryInput,
        experimentArm,
        undefined,
        { isOffline: simulateOfflineMode }
      );
      setRoutingDecision(decision);
      setSelectedLocale(decision.detectedLocale);

      if (
        decision.routeTarget === 'PREFER_ON_DEVICE' ||
        decision.routeTarget === 'ONLY_ON_DEVICE'
      ) {
        setPreferOnDeviceCount((c) => c + 1);
      } else {
        setPreferInCloudCount((c) => c + 1);
      }

      const gateResult = await executeSpeculativeConsensusGate(
        decision,
        (pct) => setNanoDownloadPct(pct)
      );
      setConsensusResult(gateResult);
      setOfflineQueueItems(getOfflineQueue());

      await appendBlockToChain({
        eventType: 'CONSENSUS_AUDIT',
        locale: decision.detectedLocale,
        routeTarget: decision.routeTarget,
        consensusScore: gateResult.consensusScore ?? 0,
        summary: `[${decision.detectedLocale.toUpperCase()} · ${
          decision.routeTarget
        } · badge=${gateResult.edgeTriage.inferenceSourceBadge}] Status=${
          gateResult.status
        } | PII Scrubbed=${decision.piiResult.redactionCount} | Consensus=${
          gateResult.consensusScore !== null
            ? `${gateResult.consensusScore}%`
            : 'AUDIT_UNAVAILABLE'
        }`,
      });
    } finally {
      setIsTriaging(false);
    }
  };

  const handleVoiceTranscriptReady = async (
    sanitizedTranscript: string,
    rawTranscript: string,
    redactionCount: number,
    bcp47Locale: string
  ) => {
    setRawTelemetryInput(rawTranscript);
    const decision = routeDiagnosticPayload(
      rawTranscript,
      experimentArm,
      undefined,
      { isOffline: simulateOfflineMode }
    );
    setRoutingDecision(decision);
    setSelectedLocale(decision.detectedLocale);

    const gateResult = await executeSpeculativeConsensusGate(decision);
    setConsensusResult(gateResult);
    setOfflineQueueItems(getOfflineQueue());

    await appendBlockToChain({
      eventType: 'ROUTING_DECISION',
      locale: decision.detectedLocale,
      routeTarget: decision.routeTarget,
      consensusScore: gateResult.consensusScore ?? 0,
      summary: `Voice PTT (${bcp47Locale}) scrubbed ${redactionCount} PII item(s) -> Routed via ${decision.routeTarget}: "${sanitizedTranscript.slice(
        0,
        140
      )}"`,
    });
  };

  const handleVisionInspectionRecorded = async (
    result: VisionInspectionOutput
  ) => {
    await appendBlockToChain({
      eventType: 'VISION_INSPECTION',
      locale: selectedLocale,
      routeTarget:
        result.actualSource === 'CLOUD_GEMINI_DIRECT'
          ? 'PREFER_IN_CLOUD'
          : 'PREFER_ON_DEVICE',
      consensusScore: result.isReferenceBaselineOnly
        ? 0
        : Math.round(result.confidencePct),
      summary: `Multimodal Vision [${result.dtcCode}]: ${result.faultTitle} (inferenceSource=${result.inferenceSourceBadge}, TTFT=${
        result.ttftMs !== null ? `${result.ttftMs}ms` : 'N/A'
      })`,
    });
  };

  const handleVerifyChain = async () => {
    const report = await verifyBlackBoxChain(blackBoxChain);
    setVerificationReport(report);
  };

  const handleSimulateTampering = async () => {
    if (!isChainTampered) {
      setUncorruptedBackupChain(blackBoxChain);
    }
    const corrupted = simulateChainTampering(blackBoxChain, 0);
    setBlackBoxChain(corrupted);
    setIsChainTampered(true);
    const report = await verifyBlackBoxChain(corrupted);
    setVerificationReport(report);
  };

  const handleRestoreChain = async () => {
    setBlackBoxChain(uncorruptedBackupChain);
    setIsChainTampered(false);
    const report = await verifyBlackBoxChain(uncorruptedBackupChain);
    setVerificationReport(report);
  };

  const handleSyncChainToFirestore = async () => {
    if (!currentUser || !db) {
      setFirestoreSyncStatus(
        'Local Web Crypto Chain Verified (Sign in with Google to persist to Firestore)'
      );
      return;
    }
    const latestBlock = blackBoxChain[blackBoxChain.length - 1];
    if (!latestBlock) return;
    const path = `black_box_entries/${latestBlock.id}`;
    const validRouteTarget =
      latestBlock.routeTarget === 'PREFER_IN_CLOUD'
        ? 'PREFER_IN_CLOUD'
        : 'PREFER_ON_DEVICE';
    try {
      await setDoc(doc(collection(db, 'black_box_entries'), latestBlock.id), {
        ownerId: currentUser.uid,
        sequenceIndex: latestBlock.sequenceIndex,
        eventType: latestBlock.eventType,
        summary: latestBlock.summary.slice(0, 500),
        prevHash: latestBlock.prevHash,
        entryHash: latestBlock.entryHash,
        locale: latestBlock.locale,
        routeTarget: validRouteTarget,
        consensusScore: latestBlock.consensusScore,
        createdAt: serverTimestamp(),
      });
      setFirestoreSyncStatus(
        `Synced Block #${latestBlock.sequenceIndex} to Firestore (/black_box_entries)`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  const totalCalls = Math.max(1, preferOnDeviceCount + preferInCloudCount);
  const preferOnDevicePct = Math.round(
    (preferOnDeviceCount / totalCalls) * 100
  );
  const preferInCloudPct = 100 - preferOnDevicePct;

  return (
    <div className="sentinel-console min-h-screen bg-[#050507] text-slate-100 flex flex-col relative">
      <TubesBackground />
      <TravellingDebugCable />

      {/* Layer 3: Semantic DOM Workbench Layer (relative z-10) */}
      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Top Bar Contract: 3 Zones separated by gap-8 */}
        <header className="sentinel-production-nav flex items-center justify-between gap-5 px-6 py-3.5">
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              switchWorkbenchView('triage');
            }}
            className="text-lg font-bold tracking-tight text-slate-100 whitespace-nowrap shrink-0"
          >
            QNX Sentinel
          </a>

          <div className="sentinel-nav-status">
            <span className="sentinel-status-chip"><i className="sentinel-dot-green" /> HYBRID ONLINE</span>
            <span className="sentinel-status-chip"><i className="sentinel-dot-blue" /> {routingDecision.routeTarget}</span>
            <span className="sentinel-status-chip"><i className="sentinel-dot-muted" /> NANO PROMPT API: {routingDecision.nanoLanguageSupported ? 'READY' : 'NO'}</span>
            <button type="button" className="sentinel-diagnostics-toggle" onClick={() => setDiagnosticsOpen(v => !v)} aria-expanded={diagnosticsOpen}>SYSTEM DIAGNOSTICS</button>
          </div>
          <nav
            aria-label="Primary Workbench Views"
            className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300"
          >
            <button
              type="button"
              onClick={() => switchWorkbenchView('triage')}
              className={`transition-colors whitespace-nowrap shrink-0 ${
                activeView === 'triage'
                  ? 'text-cyan-400 underline underline-offset-8'
                  : 'hover:text-slate-100'
              }`}
            >
              1. Post-Mortem Log Triage
            </button>
            <button
              type="button"
              onClick={() => switchWorkbenchView('vision')}
              className={`transition-colors whitespace-nowrap shrink-0 ${
                activeView === 'vision'
                  ? 'text-cyan-400 underline underline-offset-8'
                  : 'hover:text-slate-100'
              }`}
            >
              2. Optical Failure Analysis
            </button>
            <button
              type="button"
              onClick={() => switchWorkbenchView('ledger')}
              className={`transition-colors whitespace-nowrap shrink-0 ${
                activeView === 'ledger'
                  ? 'text-cyan-400 underline underline-offset-8'
                  : 'hover:text-slate-100'
              }`}
            >
              3. SHA-256 Chain of Custody ({blackBoxChain.length})
            </button>
            <button
              type="button"
              onClick={() => switchWorkbenchView('eval_qnx')}
              className={`transition-colors whitespace-nowrap shrink-0 ${
                activeView === 'eval_qnx'
                  ? 'text-cyan-400 underline underline-offset-8'
                  : 'hover:text-slate-100'
              }`}
            >
              4. Multilingual Eval &amp; QNX C/C++
            </button>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            {currentUser ? (
              <button
                type="button"
                onClick={() => signOutOperator()}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-md border border-slate-700 transition-colors whitespace-nowrap shrink-0"
              >
                <LogOut className="w-3.5 h-3.5 text-cyan-400" />
                <span>Sign Out ({currentUser.displayName || 'Operator'})</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => signInWithGoogleOperator().catch(() => null)}
                disabled={!isFirebaseConfigured}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-950 bg-cyan-500 hover:bg-cyan-400 rounded-md transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Operator Google Sign-In</span>
              </button>
            )}
          </div>
        </header>

        {diagnosticsOpen && (
          <aside className="sentinel-diagnostics-drawer" aria-label="System diagnostics">
            <div className="sentinel-section-kicker">SYSTEM DIAGNOSTICS / LIVE RUNTIME</div>
            <div className="sentinel-diagnostics-grid">
              <div><small>FIRESTORE</small><strong>{runtime.firestoreOnline ? 'CONNECTED' : 'OFFLINE'}</strong></div>
              <div><small>APP CHECK</small><strong>{runtime.appCheckLabel}</strong></div>
              <div><small>REMOTE CONFIG</small><strong>{runtime.remoteConfigSource}</strong></div>
              <div><small>FIREBASE AI</small><strong>{runtime.firebaseAiReady ? 'READY' : 'UNAVAILABLE'}</strong></div>
              <div><small>GEMINI NANO</small><strong>{runtime.nanoAvailability?.status ?? 'PROBING'}</strong></div>
              <div><small>GPU / WEBGL</small><strong>BROWSER RENDERER</strong></div>
            </div>
          </aside>
        )}
        <section className="sentinel-production-hero">
          <div className="sentinel-hero-scrim" />
          <div className="sentinel-production-hero-inner">
            <div className="sentinel-section-kicker">QNX NEUTRINO / EMBEDDED INTELLIGENCE SYSTEM</div>
            <h1>Intelligence<br/><span>after impact.</span></h1>
            <p>Multilingual crash-dump forensics, privacy-first inference routing, and verifiable evidence for safety-critical systems.</p>
            <div className="sentinel-hero-actions">
              <button type="button" className="sentinel-square-button" onClick={() => document.getElementById('router-workbench')?.scrollIntoView({behavior:'smooth'})}>OPEN DIAGNOSTIC ROUTER <span>↓</span></button>
              <button type="button" className="sentinel-outline-button" onClick={() => switchWorkbenchView('ledger')}>VIEW EVIDENCE LEDGER <span>↗</span></button>
            </div>
          </div>
          <div className="sentinel-hero-index"><span>SYS / 01</span><span>EDGE × CLOUD / 2026</span></div>
        </section>
        <SubsystemGrid />

        {/* Main Focused Workbench Viewport */}
        <main
          id="router-workbench"
          className="flex-1 max-w-[1400px] w-full mx-auto px-6 py-6 space-y-6"
        >
        {/* View 1: Post-Mortem Log Triage & Consensus Audit */}
        {activeView === 'triage' && (
          <section
            aria-label="Adaptive Multilingual Router and Speculative Consensus Gate"
            className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch"
          >
            {/* Left 7 Columns: Multilingual Crash-Dump Input, PII Scrubber & Adaptive Router */}
            <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-lg p-5 flex flex-col justify-between space-y-4">
              <div className="space-y-4">
                <div className="border-b border-slate-800 pb-3">
                  <h1 className="text-lg font-bold text-slate-100">
                    Off-Board QNX PPS Crash-Dump Router &amp; PII Airlock
                  </h1>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Routes English structured logs via{' '}
                    <span className="font-mono text-emerald-400">
                      InferenceMode.PREFER_ON_DEVICE
                    </span>
                    , offline sessions via{' '}
                    <span className="font-mono text-cyan-400">
                      InferenceMode.ONLY_ON_DEVICE
                    </span>
                    , and non-English technician notes via{' '}
                    <span className="font-mono text-amber-400">
                      InferenceMode.PREFER_IN_CLOUD
                    </span>{' '}
                    (<span className="font-mono">gemini-2.5-flash-lite</span>)
                  </p>
                </div>

                {/* Language Preset Selector Bar */}
                <div className="space-y-1.5">
                  <div className="text-xs font-medium text-slate-300">
                    Load Service-Bay Diagnostic Dump by Plant Locale:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {ORDERED_LOCALES.map((loc) => {
                      const meta = SUPPORTED_LANGUAGES[loc];
                      const active = selectedLocale === loc;
                      return (
                        <button
                          key={loc}
                          type="button"
                          onClick={() => handleSelectLanguagePreset(loc)}
                          className={`px-2.5 py-1.5 text-xs font-mono rounded border transition-colors whitespace-nowrap shrink-0 ${
                            active
                              ? 'bg-cyan-500 text-slate-950 font-semibold border-cyan-400'
                              : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          {loc.toUpperCase()} · {meta.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Hands-Free Multilingual Voice Diagnostics */}
                <div className="bg-slate-950 border border-slate-800 rounded-md p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="text-xs text-slate-300">
                    <span className="font-semibold text-slate-100">
                      Technician Voice Dictation:{' '}
                    </span>
                    <span className="text-slate-400">
                      Web Speech API mapped to{' '}
                      <span className="font-mono text-cyan-400">
                        {SUPPORTED_LANGUAGES[selectedLocale].bcp47}
                      </span>
                    </span>
                  </div>
                  <VoiceDiagnosticsButton
                    selectedLocale={selectedLocale}
                    onVoiceTranscriptReady={handleVoiceTranscriptReady}
                  />
                </div>

                {/* Raw Telemetry / Technician Prompt Textarea */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <label
                      htmlFor="telemetry-input"
                      className="font-medium text-slate-300"
                    >
                      Exported QNX PPS Frame / Service-Bay Technician Note
                    </label>
                    <span className="font-mono text-cyan-400">
                      Detected: {routingDecision.languageMeta.name} (
                      {routingDecision.detectedLocale}) · Nano Prompt API:{' '}
                      {routingDecision.nanoLanguageSupported ? 'YES' : 'NO'}
                    </span>
                  </div>
                  <textarea
                    id="telemetry-input"
                    rows={3}
                    value={rawTelemetryInput}
                    onChange={(e) => {
                      setRawTelemetryInput(e.target.value);
                      setRoutingDecision(
                        routeDiagnosticPayload(
                          e.target.value,
                          experimentArm,
                          undefined,
                          { isOffline: simulateOfflineMode }
                        )
                      );
                    }}
                    className="w-full rounded-md bg-slate-950 border border-slate-800 px-3.5 py-2.5 text-xs font-mono text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {/* Local Deterministic PII Redaction & Labeled Deterministic Baseline Readout */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="bg-slate-950 border border-slate-800 rounded-md p-3 space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                      <span className="text-emerald-400 font-semibold whitespace-nowrap">
                        Client PII Redaction Filter
                      </span>
                      <span className="text-slate-400 text-[11px]">
                        {routingDecision.piiResult.redactionCount} scrubbed (
                        {routingDecision.piiResult.redactedTypes.join(', ') ||
                          'CLEAN'}
                        )
                      </span>
                    </div>
                    <p
                      data-testid="sanitized-payload-preview"
                      className="text-[11px] font-mono text-slate-300 line-clamp-2 break-all"
                    >
                      {routingDecision.piiResult.sanitizedText}
                    </p>
                  </div>

                  <div className="bg-slate-950 border border-slate-800 rounded-md p-3 space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                      <span className="text-amber-400 font-semibold whitespace-nowrap">
                        Deterministic Baseline (Regex Rule Parser)
                      </span>
                      <span className="text-rose-400 font-semibold whitespace-nowrap">
                        {routingDecision.safetyCheck.severity}
                      </span>
                    </div>
                    <p className="text-[11px] font-mono text-slate-300 truncate">
                      {routingDecision.safetyCheck.triggeredRule}
                    </p>
                    <div
                      suppressHydrationWarning
                      className="text-[11px] font-mono text-slate-400"
                    >
                      Temp: {routingDecision.safetyCheck.extractedTempC ?? 'N/A'}
                      °C · Isolation:{' '}
                      {routingDecision.safetyCheck.extractedIsolationKOhm ??
                        'N/A'}{' '}
                      kΩ · DTC: {routingDecision.safetyCheck.faultCode} (
                      {routingDecision.safetyCheck.executionTimeUs}µs)
                    </div>
                  </div>
                </div>
              </div>

              {/* Adaptive Router Decision Bar & Execute CTA */}
              <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-xs font-mono space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">firebase/ai Mode:</span>
                    <span
                      data-testid="active-route-target"
                      className={
                        routingDecision.routeTarget === 'PREFER_ON_DEVICE' ||
                        routingDecision.routeTarget === 'ONLY_ON_DEVICE'
                          ? 'text-emerald-400 font-bold'
                          : 'text-amber-400 font-bold'
                      }
                    >
                      {routingDecision.routeTarget}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {routingDecision.routingRationale}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleExecuteTriage}
                    disabled={isTriaging}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-md bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>
                      {isTriaging
                        ? 'Running firebase/ai Inference...'
                        : 'Execute firebase/ai Triage & Audit'}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* Right 5 Columns: Honest Model-to-Model Execution & Cloud Consensus Gate */}
            <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-lg p-5 flex flex-col justify-between space-y-4">
              <div className="space-y-4">
                <div className="border-b border-slate-800 pb-3 flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-base font-semibold text-slate-100">
                      Model-to-Model{' '}
                      <code className="font-mono text-cyan-400">
                        firebase/ai
                      </code>{' '}
                      Consensus Gate
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Stage 1 (Edge/Hybrid JSON) vs Stage 2 (Cloud{' '}
                      <span className="font-mono">gemini-2.5-flash</span> JSON).
                      Never substitutes regex values on model failure.
                    </p>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-950 border border-slate-700 text-cyan-300 shrink-0">
                    Status: {consensusResult.status}
                  </span>
                </div>

                {/* Honest InferenceSource Badges */}
                <div className="bg-slate-950 border border-slate-800 rounded-md p-3 text-xs font-mono space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-slate-400">
                      Stage 1 inferenceSource:
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-cyan-400 font-semibold">
                      {consensusResult.edgeTriage.inferenceSourceBadge === 'NONE' ? 'Pending' : consensusResult.edgeTriage.inferenceSourceBadge} (
                      {consensusResult.edgeTriage.actualSource === 'MODEL_UNAVAILABLE' ? 'Not started' : consensusResult.edgeTriage.actualSource})
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-slate-400">
                      Stage 2 inferenceSource:
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-amber-400 font-semibold">
                      {consensusResult.cloudAudit.inferenceSourceBadge === 'NONE' ? 'Pending' : consensusResult.cloudAudit.inferenceSourceBadge} (
                      {consensusResult.cloudAudit.actualSource === 'MODEL_UNAVAILABLE' ? 'Not started' : consensusResult.cloudAudit.actualSource})
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-sans pt-1">
                    {consensusResult.edgeTriage.transparencyNote}
                  </p>
                </div>

                {/* Surfaced Error Banner if Stage 1 or Stage 2 threw an error */}
                {(consensusResult.edgeTriage.errorMessage ||
                  consensusResult.cloudAudit.errorMessage) && (
                  <div
                    role="alert"
                    data-testid="model-error-surface"
                    className="bg-rose-950/40 border border-rose-600/80 rounded-md p-3 text-xs font-mono text-rose-200 space-y-1"
                  >
                    <div className="flex items-center gap-1.5 font-semibold text-rose-300">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>firebase/ai Error Surface (No Fake Consensus):</span>
                    </div>
                    {consensusResult.edgeTriage.errorMessage && (
                      <div>
                        Stage 1: {consensusResult.edgeTriage.errorMessage}
                      </div>
                    )}
                    {consensusResult.cloudAudit.errorMessage && (
                      <div>
                        Stage 2: {consensusResult.cloudAudit.errorMessage}
                      </div>
                    )}
                  </div>
                )}

                {/* Consensus Score & Measured Wall-Clock Streaming TTFT */}
                <div className="grid grid-cols-3 gap-3 bg-slate-950 border border-slate-800 rounded-md p-3.5">
                  <div>
                    <div className="text-[11px] text-slate-400">
                      Model-to-Model Consensus
                    </div>
                    <div
                      data-testid="consensus-score-value"
                      className={`text-xl font-mono font-bold tabular-nums mt-0.5 ${
                        consensusResult.consensusScore === null
                          ? 'text-slate-400'
                          : consensusResult.consensusScore >= 90
                          ? 'text-emerald-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {consensusResult.consensusScore !== null
                        ? `${consensusResult.consensusScore}%`
                        : consensusResult.status === 'NOT_RUN_YET'
                        ? 'Awaiting analysis'
                        : 'AUDIT_UNAVAILABLE'}
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] text-slate-400">
                      Stage 1 Stream TTFT
                    </div>
                    <div className="text-lg font-mono font-bold text-cyan-400 tabular-nums mt-1">
                      {consensusResult.edgeTriage.ttftMs !== null
                        ? `${consensusResult.edgeTriage.ttftMs.toFixed(1)} ms`
                        : '—'}
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] text-slate-400">
                      Stage 2 Audit TTFT
                    </div>
                    <div className="text-lg font-mono font-bold text-amber-400 tabular-nums mt-1">
                      {consensusResult.cloudAudit.ttftMs !== null
                        ? `${consensusResult.cloudAudit.ttftMs.toFixed(1)} ms`
                        : '—'}
                    </div>
                  </div>
                </div>

                {/* Side-by-Side Stage 1 Model vs Stage 2 Cloud Audit */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                  <div className="bg-slate-950 border border-slate-800 rounded-md p-3 space-y-1.5">
                    <div className="flex items-center justify-between gap-1 text-cyan-400 font-semibold">
                      <span className="inline-flex items-center gap-1">
                        <Cpu className="w-3.5 h-3.5" />
                        1. Stage 1 ({consensusResult.edgeTriage.requestedMode})
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700">
                        {consensusResult.edgeTriage.inferenceSourceBadge}
                      </span>
                    </div>
                    <div className="text-slate-300">
                      DTC:{' '}
                      <span className="text-slate-100">
                        {consensusResult.edgeTriage.faultCode ?? 'N/A'}
                      </span>{' '}
                      ·{' '}
                      <span className="text-emerald-400">
                        {consensusResult.edgeTriage.severity ?? 'N/A'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
                      {consensusResult.edgeTriage.summary}
                    </p>
                  </div>

                  <div className="bg-slate-950 border border-slate-800 rounded-md p-3 space-y-1.5">
                    <div className="flex items-center justify-between gap-1 text-amber-400 font-semibold">
                      <span className="inline-flex items-center gap-1">
                        <Cloud className="w-3.5 h-3.5" />
                        2. Stage 2 (gemini-2.5-flash)
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700">
                        {consensusResult.cloudAudit.inferenceSourceBadge}
                      </span>
                    </div>
                    <div className="text-slate-300">
                      DTC:{' '}
                      <span className="text-slate-100">
                        {consensusResult.cloudAudit.faultCode ?? 'N/A'}
                      </span>{' '}
                      ·{' '}
                      <span className="text-rose-400">
                        {consensusResult.cloudAudit.severity ?? 'N/A'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
                      {consensusResult.cloudAudit.auditNotes}
                    </p>
                  </div>
                </div>

                {/* Offline Escalation Queue Banner when items exist */}
                {offlineQueueItems.length > 0 && (
                  <div className="bg-amber-950/30 border border-amber-700/60 rounded-md p-3 text-xs font-mono flex items-center justify-between gap-3">
                    <div>
                      <span className="text-amber-300 font-semibold">
                        Offline Forensic Queue ({offlineQueueItems.length} item
                        {offlineQueueItems.length === 1 ? '' : 's'}):
                      </span>{' '}
                      <span className="text-slate-300">
                        {
                          offlineQueueItems.filter(
                            (i) => i.status === 'QUEUED_OFFLINE'
                          ).length
                        }{' '}
                        pending Cloud Audit in IndexedDB/localStorage
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleFlushOfflineQueue}
                      className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold whitespace-nowrap shrink-0"
                    >
                      Flush Queue to Cloud
                    </button>
                  </div>
                )}

                {consensusResult.status === 'UNANIMOUS_CONSENSUS' && (
                  <div className="bg-emerald-950/30 border border-emerald-700/60 rounded-md p-3 text-xs text-emerald-200 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      Model-to-Model Consensus Verified: Stage 1 and Stage 2
                      models align on fault code, thermal bounds, and severity.
                    </span>
                  </div>
                )}

                {/* Localized Actionable Remediation Output */}
                <div className="bg-slate-950 border border-slate-800 rounded-md p-3.5 space-y-1">
                  <div className="text-xs font-semibold text-cyan-400">
                    Localized Post-Mortem Service Action (
                    {routingDecision.languageMeta.name} ·{' '}
                    {routingDecision.languageMeta.nativeName}):
                  </div>
                  <p
                    data-testid="localized-remediation-output"
                    className="text-xs text-slate-100 leading-relaxed"
                  >
                    {consensusResult.finalRemediation}
                  </p>
                </div>
              </div>

              <div className="text-[11px] font-mono text-slate-400 pt-2 border-t border-slate-800 flex items-center justify-between">
                <span>100% firebase/ai SDK</span>
                <span>Appended to SHA-256 Chain of Custody</span>
              </div>
            </div>
          </section>
        )}

        {/* View 2: Multimodal On-Device Vision Fault Inspector */}
        {activeView === 'vision' && (
          <MultimodalVisionInspector
            onVisionInspectionRecorded={handleVisionInspectionRecorded}
          />
        )}

        {/* View 3: SHA-256 Hash-Chained Black-Box Flight Recorder */}
        {activeView === 'ledger' && (
          <BlackBoxRecorderPanel
            chain={blackBoxChain}
            verificationReport={verificationReport}
            isTampered={isChainTampered}
            onVerifyChain={handleVerifyChain}
            onSimulateTampering={handleSimulateTampering}
            onRestoreChain={handleRestoreChain}
            onLoadSampleBlocks={handleLoadSampleBlocks}
            onSyncChainToFirestore={handleSyncChainToFirestore}
            firestoreSyncStatus={firestoreSyncStatus}
          />
        )}

        {/* View 4: Multilingual Evaluation Harness + Embedded QNX C/C++ Target Artifacts */}
        {activeView === 'eval_qnx' && (
          <div className="space-y-6">
            <MultilingualEvalPanel
              experimentArm={experimentArm}
              onSelectLocaleSample={(locale) => {
                handleSelectLanguagePreset(locale);
                switchWorkbenchView('triage');
              }}
            />
            <QnxTargetViewer />
          </div>
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white px-6 py-5 mt-10">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-2 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span className="font-semibold tracking-tight text-slate-700">QNX Sentinel</span>
          <span>Engineering intelligence · Embedded diagnostics · Evidence integrity</span>
          <span>© 2026 QNX Sentinel</span>
        </div>
      </footer>
      </div>
    </div>
  );
}

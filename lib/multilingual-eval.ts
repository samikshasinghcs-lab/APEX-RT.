import {
  ORDERED_LOCALES,
  SUPPORTED_LANGUAGES,
  SupportedLocale,
  ExperimentArm,
  InferenceMode,
  SafetySeverity,
  PiiRedactionResult,
  routeDiagnosticPayload,
  buildLocalizedRemediation,
} from './adaptive-router';
import { summarizeLatencies, LatencySummary } from './latency-stats';
import {
  executeSpeculativeConsensusGate,
  ReportedInferenceSourceBadge,
} from './firebase-ai-hybrid';

export interface RubricBreakdown {
  faultClassification: number; // Max 25
  numericExtraction: number; // Max 25
  zeroPiiLeak: number; // Max 25
  actionableRemediation: number; // Max 25
  totalScore: number; // Max 100
}

export type EvalRowSource =
  | 'DETERMINISTIC_PRECHECK_BASELINE'
  | 'LIVE_FIREBASE_AI_MODEL'
  | 'MODEL_CALL_FAILED';

export interface ModelCandidateForRubric {
  faultCode: string | null;
  severity: SafetySeverity | null;
  extractedTempC: number | null;
  extractedIsolationKOhm: number | null;
  remediationText: string | null;
}

export interface LanguageEvalBenchmarkRow {
  locale: SupportedLocale;
  languageName: string;
  nativeName: string;
  automotiveHub: string;
  scriptFamily: string;
  nanoSupported: boolean;
  selectedRoute: InferenceMode;
  evaluationSource: EvalRowSource;
  inferenceSourceBadge: ReportedInferenceSourceBadge;
  measuredPreCheckLatencySummaryMs: LatencySummary;
  measuredModelTtftMs: number | null;
  measuredCloudAuditTtftMs: number | null;
  hybridRubric: RubricBreakdown;
  redactedPiiCount: number;
  extractedFaultCode: string | null;
  extractedTempC: number | null;
  extractedIsolationKOhm: number | null;
  sampleRemediationSnippet: string;
  errorMessage: string | null;
}

export interface MultilingualEvalSuiteSummary {
  experimentArm: ExperimentArm;
  totalLanguagesEvaluated: number;
  liveModelsExecutedCount: number;
  averageRubricScore: number;
  measuredPreCheckP50Ms: number;
  measuredPreCheckP95Ms: number;
  measuredLiveModelMeanTtftMs: number | null;
  zeroPiiLeakComplianceRate: number;
  rows: LanguageEvalBenchmarkRow[];
}

/**
 * Scores a candidate output (either live `firebase/ai` model output or deterministic pre-check baseline)
 * against the explicit 100-point rubric:
 * - Fault Classification (25 pt): P0A78 & CRITICAL / SAFE_STATE_LOCK
 * - Numeric Extraction (25 pt): Junction Temp >= 180°C & HV Isolation <= 90 kΩ
 * - Zero PII Leak (25 pt): VIN, Email, Phone, and GPS scrubbed prior to dispatch
 * - Actionable Remediation (25 pt): Non-empty localized remediation referencing STO / Contactor K1/K2 / inverter isolation
 */
export function scoreCandidateRubric(
  piiResult: PiiRedactionResult,
  candidate: ModelCandidateForRubric
): RubricBreakdown {
  // 1. Fault Classification (25 pts)
  const hasFaultCode =
    typeof candidate.faultCode === 'string' &&
    candidate.faultCode.toUpperCase().includes('P0A78');
  const hasCriticalSeverity =
    candidate.severity === 'SAFE_STATE_LOCK' ||
    candidate.severity === 'CRITICAL';
  const faultClassification =
    (hasFaultCode ? 15 : 0) + (hasCriticalSeverity ? 10 : 0);

  // 2. Numeric Extraction (25 pts)
  const hasTemp =
    candidate.extractedTempC !== null &&
    Number.isFinite(candidate.extractedTempC) &&
    candidate.extractedTempC >= 180 &&
    candidate.extractedTempC <= 195;
  const hasIso =
    candidate.extractedIsolationKOhm !== null &&
    Number.isFinite(candidate.extractedIsolationKOhm) &&
    candidate.extractedIsolationKOhm >= 70 &&
    candidate.extractedIsolationKOhm <= 90;
  const numericExtraction = (hasTemp ? 13 : 0) + (hasIso ? 12 : 0);

  // 3. Zero PII Leak (25 pts)
  const leakedVin = /VIN=(?!\[REDACTED_VIN\])[A-Z0-9]{11,17}/i.test(
    piiResult.sanitizedText
  );
  const leakedEmail = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(
    piiResult.sanitizedText
  );
  const zeroPiiLeak =
    !leakedVin && !leakedEmail && piiResult.redactionCount >= 2 ? 25 : 0;

  // 4. Actionable Remediation (25 pts)
  const rem = (candidate.remediationText || '').trim();
  const hasLength = rem.length >= 25;
  const hasSafetyKeyword =
    /STO|Safe Torque Off|K1|K2|175|100|kΩ|kOhm|インバータ|逆变器|인버터|Wechselrichter|इन्वर्टर|ಇನ್ವರ್ಟರ್|inversor|onduleur|inverter|عاكس/i.test(
      rem
    );
  const actionableRemediation =
    (hasLength ? 12 : 0) + (hasSafetyKeyword ? 13 : 0);

  return {
    faultClassification,
    numericExtraction,
    zeroPiiLeak,
    actionableRemediation,
    totalScore:
      faultClassification +
      numericExtraction +
      zeroPiiLeak +
      actionableRemediation,
  };
}

/**
 * Evaluates a single locale using real wall-clock timing (`performance.now()` across 5 runs via `summarizeLatencies`)
 * for the local deterministic pre-check & PII airlock.
 * Model TTFT values (`measuredModelTtftMs`, `measuredCloudAuditTtftMs`) remain `null` until a live `firebase/ai`
 * model call is executed via `evaluateSingleLocaleLiveModel`.
 */
export function evaluateSingleLocaleBenchmark(
  locale: SupportedLocale,
  experimentArm: ExperimentArm = 'BALANCED_HYBRID'
): LanguageEvalBenchmarkRow {
  const meta = SUPPORTED_LANGUAGES[locale];

  const samplesMs: number[] = [];
  let decision = routeDiagnosticPayload(
    meta.defaultSamplePrompt,
    experimentArm,
    locale
  );

  for (let i = 0; i < 5; i++) {
    const t0 = performance.now();
    decision = routeDiagnosticPayload(
      meta.defaultSamplePrompt,
      experimentArm,
      locale
    );
    samplesMs.push(Math.max(0.01, performance.now() - t0));
  }

  const latencySummary = summarizeLatencies(samplesMs);
  const baselineRemediation = buildLocalizedRemediation(
    locale,
    decision.safetyCheck
  );

  const rubric = scoreCandidateRubric(decision.piiResult, {
    faultCode: decision.safetyCheck.faultCode,
    severity: decision.safetyCheck.severity,
    extractedTempC: decision.safetyCheck.extractedTempC,
    extractedIsolationKOhm: decision.safetyCheck.extractedIsolationKOhm,
    remediationText: baselineRemediation,
  });

  return {
    locale,
    languageName: meta.name,
    nativeName: meta.nativeName,
    automotiveHub: meta.automotiveHub,
    scriptFamily: meta.scriptFamily,
    nanoSupported: meta.nanoSupported,
    selectedRoute: decision.routeTarget,
    evaluationSource: 'DETERMINISTIC_PRECHECK_BASELINE',
    inferenceSourceBadge: 'NONE',
    measuredPreCheckLatencySummaryMs: latencySummary,
    measuredModelTtftMs: null,
    measuredCloudAuditTtftMs: null,
    hybridRubric: rubric,
    redactedPiiCount: decision.piiResult.redactionCount,
    extractedFaultCode: decision.safetyCheck.faultCode,
    extractedTempC: decision.safetyCheck.extractedTempC,
    extractedIsolationKOhm: decision.safetyCheck.extractedIsolationKOhm,
    sampleRemediationSnippet: baselineRemediation,
    errorMessage: null,
  };
}

/**
 * Executes a live `firebase/ai` model evaluation for a specific locale and scores the actual
 * model-returned JSON output (`faultCode`, `severity`, `extractedTempC`, `extractedIsolationKOhm`, `localizedRemediation`)
 * rather than regex baseline values.
 */
export async function evaluateSingleLocaleLiveModel(
  locale: SupportedLocale,
  experimentArm: ExperimentArm = 'BALANCED_HYBRID'
): Promise<LanguageEvalBenchmarkRow> {
  const baselineRow = evaluateSingleLocaleBenchmark(locale, experimentArm);
  const meta = SUPPORTED_LANGUAGES[locale];
  const decision = routeDiagnosticPayload(
    meta.defaultSamplePrompt,
    experimentArm,
    locale
  );

  const gateResult = await executeSpeculativeConsensusGate(decision);

  const activeModelOutput: ModelCandidateForRubric =
    gateResult.cloudAudit.faultCode !== null
      ? {
          faultCode: gateResult.cloudAudit.faultCode,
          severity: gateResult.cloudAudit.severity,
          extractedTempC: gateResult.cloudAudit.extractedTempC,
          extractedIsolationKOhm: gateResult.cloudAudit.extractedIsolationKOhm,
          remediationText:
            gateResult.cloudAudit.localizedRemediation ||
            gateResult.edgeTriage.summary,
        }
      : {
          faultCode: gateResult.edgeTriage.faultCode,
          severity: gateResult.edgeTriage.severity,
          extractedTempC: gateResult.edgeTriage.extractedTempC,
          extractedIsolationKOhm: gateResult.edgeTriage.extractedIsolationKOhm,
          remediationText: gateResult.edgeTriage.summary,
        };

  const modelRan =
    gateResult.edgeTriage.inferenceSourceBadge !== 'NONE' ||
    gateResult.cloudAudit.inferenceSourceBadge !== 'NONE';

  const scoredRubric = modelRan
    ? scoreCandidateRubric(decision.piiResult, activeModelOutput)
    : {
        faultClassification: 0,
        numericExtraction: 0,
        zeroPiiLeak: baselineRow.hybridRubric.zeroPiiLeak,
        actionableRemediation: 0,
        totalScore: baselineRow.hybridRubric.zeroPiiLeak,
      };

  return {
    ...baselineRow,
    evaluationSource: modelRan
      ? 'LIVE_FIREBASE_AI_MODEL'
      : 'MODEL_CALL_FAILED',
    inferenceSourceBadge:
      gateResult.edgeTriage.inferenceSourceBadge !== 'NONE'
        ? gateResult.edgeTriage.inferenceSourceBadge
        : gateResult.cloudAudit.inferenceSourceBadge,
    measuredModelTtftMs: gateResult.edgeTriage.ttftMs,
    measuredCloudAuditTtftMs: gateResult.cloudAudit.ttftMs,
    hybridRubric: scoredRubric,
    extractedFaultCode: activeModelOutput.faultCode,
    extractedTempC: activeModelOutput.extractedTempC,
    extractedIsolationKOhm: activeModelOutput.extractedIsolationKOhm,
    sampleRemediationSnippet:
      activeModelOutput.remediationText ||
      gateResult.edgeTriage.errorMessage ||
      'Model call did not return remediation text.',
    errorMessage:
      gateResult.edgeTriage.errorMessage || gateResult.cloudAudit.errorMessage,
  };
}

/**
 * Summarizes a list of `LanguageEvalBenchmarkRow` entries into a `MultilingualEvalSuiteSummary`.
 */
export function summarizeEvalRows(
  rows: LanguageEvalBenchmarkRow[],
  experimentArm: ExperimentArm
): MultilingualEvalSuiteSummary {
  const totalLanguagesEvaluated = rows.length;
  const liveRows = rows.filter(
    (r) =>
      r.evaluationSource === 'LIVE_FIREBASE_AI_MODEL' &&
      r.measuredModelTtftMs !== null
  );

  const averageRubricScore = Number(
    (
      rows.reduce((acc, r) => acc + r.hybridRubric.totalScore, 0) /
      Math.max(1, totalLanguagesEvaluated)
    ).toFixed(1)
  );

  const preCheckP50s = rows.map((r) => r.measuredPreCheckLatencySummaryMs.p50);
  const preCheckSummary = summarizeLatencies(preCheckP50s);

  const measuredLiveModelMeanTtftMs =
    liveRows.length > 0
      ? Number(
          (
            liveRows.reduce(
              (acc, r) => acc + (r.measuredModelTtftMs ?? 0),
              0
            ) / liveRows.length
          ).toFixed(1)
        )
      : null;

  const zeroPiiPassCount = rows.filter(
    (r) => r.hybridRubric.zeroPiiLeak === 25
  ).length;

  return {
    experimentArm,
    totalLanguagesEvaluated,
    liveModelsExecutedCount: liveRows.length,
    averageRubricScore,
    measuredPreCheckP50Ms: preCheckSummary.p50,
    measuredPreCheckP95Ms: preCheckSummary.p95,
    measuredLiveModelMeanTtftMs,
    zeroPiiLeakComplianceRate: Math.round(
      (zeroPiiPassCount / Math.max(1, totalLanguagesEvaluated)) * 100
    ),
    rows,
  };
}

/**
 * Runs the synchronous local deterministic pre-check & PII benchmark across all 12 locales.
 */
export function runMultilingualEvalSuite(
  experimentArm: ExperimentArm = 'BALANCED_HYBRID'
): MultilingualEvalSuiteSummary {
  const rows = ORDERED_LOCALES.map((loc) =>
    evaluateSingleLocaleBenchmark(loc, experimentArm)
  );
  return summarizeEvalRows(rows, experimentArm);
}

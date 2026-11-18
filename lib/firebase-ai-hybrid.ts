import {
  InferenceMode as FirebaseInferenceMode,
  InferenceSource,
  getGenerativeModel,
  Schema,
} from 'firebase/ai';
import {
  AdaptiveRoutingDecision,
  DeterministicSafetyCheck,
  InferenceMode,
  SafetySeverity,
  GEMINI_NANO_SUPPORTED_LOCALES,
} from './adaptive-router';
import { getSentinelFirebaseAI } from './firebase-client';
import { enqueueOfflineForensicsRequest } from './offline-queue';

export type NanoHardwareAvailability =
  | 'AVAILABLE_ON_HOST'
  | 'DOWNLOADABLE_ON_HOST'
  | 'DOWNLOADING_ON_HOST'
  | 'UNAVAILABLE_ON_HOST';

export type ActualExecutionSource =
  | 'ON_DEVICE_GEMINI_NANO'
  | 'CLOUD_FALLBACK_VIA_PREFER_ON_DEVICE'
  | 'CLOUD_GEMINI_DIRECT'
  | 'MODEL_UNAVAILABLE';

export type ReportedInferenceSourceBadge = 'ON_DEVICE' | 'IN_CLOUD' | 'NONE';

export interface EdgeTriageOutput {
  engineName: string;
  requestedMode: InferenceMode;
  actualSource: ActualExecutionSource;
  inferenceSourceBadge: ReportedInferenceSourceBadge;
  nanoAvailability: NanoHardwareAvailability;
  nanoDownloadProgressPct: number | null;
  ttftMs: number | null;
  totalLatencyMs: number | null;
  faultCode: string | null;
  severity: SafetySeverity | null;
  extractedTempC: number | null;
  extractedIsolationKOhm: number | null;
  summary: string;
  transparencyNote: string;
  errorMessage: string | null;
}

export interface CloudAuditOutput {
  engineName: string;
  actualSource: ActualExecutionSource;
  inferenceSourceBadge: ReportedInferenceSourceBadge;
  ttftMs: number | null;
  totalLatencyMs: number | null;
  faultCode: string | null;
  severity: SafetySeverity | null;
  extractedTempC: number | null;
  extractedIsolationKOhm: number | null;
  localizedRemediation: string | null;
  auditNotes: string;
  errorMessage: string | null;
}

export type ConsensusGateStatus =
  | 'UNANIMOUS_CONSENSUS'
  | 'MINOR_VARIANCE'
  | 'DISCREPANCY_ALERT'
  | 'AUDIT_UNAVAILABLE'
  | 'NOT_RUN_YET';

export interface ConsensusGateResult {
  deterministicBaseline: DeterministicSafetyCheck;
  edgeTriage: EdgeTriageOutput;
  cloudAudit: CloudAuditOutput;
  consensusScore: number | null; // null when either model did not complete (never faked)
  status: ConsensusGateStatus;
  discrepancies: string[];
  finalSeverity: SafetySeverity;
  finalRemediation: string;
  queuedOfflineItemId?: string | null;
}

export interface VisionInspectionOutput {
  faultTitle: string;
  dtcCode: string;
  severity: SafetySeverity;
  componentZone: string;
  peakTempEstimateC: number;
  confidencePct: number;
  findings: string;
  remediation: string;
  executedPath: string;
  actualSource: ActualExecutionSource;
  inferenceSourceBadge: ReportedInferenceSourceBadge;
  ttftMs: number | null;
  zeroCloudUpload: boolean;
  isReferenceBaselineOnly: boolean;
  errorMessage: string | null;
}

/**
 * JSON Schema constraint used for Chrome Gemini Nano `onDeviceParams.promptOptions.responseConstraint`
 * so Stage 1 (Edge/Primary model) returns the exact same JSON structure as Stage 2 (Cloud Audit).
 */
const EDGE_TRIAGE_JSON_CONSTRAINT = {
  type: 'object',
  properties: {
    faultCode: { type: 'string' },
    severity: {
      type: 'string',
      enum: ['NOMINAL', 'WARNING', 'CRITICAL', 'SAFE_STATE_LOCK'],
    },
    extractedTempC: { type: 'number' },
    extractedIsolationKOhm: { type: 'number' },
    summary: { type: 'string' },
  },
  required: [
    'faultCode',
    'severity',
    'extractedTempC',
    'extractedIsolationKOhm',
    'summary',
  ],
};

/**
 * Probes the host browser for Chrome's built-in Gemini Nano Prompt API availability.
 */
export async function probeGeminiNanoAvailability(): Promise<NanoHardwareAvailability> {
  if (typeof window === 'undefined') return 'UNAVAILABLE_ON_HOST';
  try {
    const win = window as unknown as {
      ai?: {
        languageModel?: {
          capabilities?: () => Promise<{ available?: string }>;
        };
      };
      LanguageModel?: {
        availability?: () => Promise<string>;
      };
    };

    if (win.LanguageModel?.availability) {
      const avail = await win.LanguageModel.availability();
      if (avail === 'available' || avail === 'readily') {
        return 'AVAILABLE_ON_HOST';
      }
      if (avail === 'downloading') {
        return 'DOWNLOADING_ON_HOST';
      }
      if (avail === 'downloadable' || avail === 'after-download') {
        return 'DOWNLOADABLE_ON_HOST';
      }
    }

    if (win.ai?.languageModel?.capabilities) {
      const caps = await win.ai.languageModel.capabilities();
      if (caps?.available === 'readily' || caps?.available === 'available') {
        return 'AVAILABLE_ON_HOST';
      }
      if (caps?.available === 'after-download') {
        return 'DOWNLOADABLE_ON_HOST';
      }
    }
  } catch (err) {
    console.warn('[Gemini Nano Probe Warning]:', err);
  }
  return 'UNAVAILABLE_ON_HOST';
}

/**
 * Model-to-model consensus calculator between Stage 1 Primary Model Triage and Stage 2 Cloud Audit.
 * If either model failed to return structured output (`faultCode === null` or `severity === null`),
 * returns `consensusScore: null` and `status: 'AUDIT_UNAVAILABLE'`.
 */
export function computeEdgeCloudConsensus(
  edge: Pick<
    EdgeTriageOutput,
    'faultCode' | 'severity' | 'extractedTempC' | 'extractedIsolationKOhm'
  >,
  cloud: Pick<
    CloudAuditOutput,
    'faultCode' | 'severity' | 'extractedTempC' | 'extractedIsolationKOhm'
  >
): {
  consensusScore: number | null;
  status:
    | 'UNANIMOUS_CONSENSUS'
    | 'MINOR_VARIANCE'
    | 'DISCREPANCY_ALERT'
    | 'AUDIT_UNAVAILABLE';
  discrepancies: string[];
} {
  if (
    !edge.faultCode ||
    !edge.severity ||
    !cloud.faultCode ||
    !cloud.severity
  ) {
    return {
      consensusScore: null,
      status: 'AUDIT_UNAVAILABLE',
      discrepancies: [
        'Model-to-model consensus unavailable because at least one inference stage did not complete.',
      ],
    };
  }

  let score = 100;
  const discrepancies: string[] = [];

  // 1. Fault Code Agreement (30 pts)
  if (edge.faultCode.toUpperCase() !== cloud.faultCode.toUpperCase()) {
    score -= 30;
    discrepancies.push(
      `DTC mismatch: Stage 1 model reported ${edge.faultCode} vs Stage 2 Audit ${cloud.faultCode}`
    );
  }

  // 2. Severity Classification Agreement (35 pts)
  if (edge.severity !== cloud.severity) {
    const highStakesPair =
      (edge.severity === 'SAFE_STATE_LOCK' && cloud.severity === 'CRITICAL') ||
      (edge.severity === 'CRITICAL' && cloud.severity === 'SAFE_STATE_LOCK');
    if (highStakesPair) {
      score -= 12;
      discrepancies.push(
        `Severity nuance: Stage 1=${edge.severity} vs Stage 2=${cloud.severity} (both high-priority)`
      );
    } else {
      score -= 35;
      discrepancies.push(
        `Critical severity divergence: Stage 1=${edge.severity} vs Stage 2=${cloud.severity}`
      );
    }
  }

  // 3. Thermal Numeric Extraction Agreement (20 pts)
  if (edge.extractedTempC !== null && cloud.extractedTempC !== null) {
    const deltaTemp = Math.abs(edge.extractedTempC - cloud.extractedTempC);
    if (deltaTemp > 2.0) {
      score -= 20;
      discrepancies.push(
        `Junction temp extraction drift: Stage 1=${edge.extractedTempC}°C vs Stage 2=${cloud.extractedTempC}°C`
      );
    }
  } else if (edge.extractedTempC !== cloud.extractedTempC) {
    score -= 10;
    discrepancies.push(
      `Partial thermal extraction: Stage 1=${edge.extractedTempC ?? 'N/A'}°C vs Stage 2=${cloud.extractedTempC ?? 'N/A'}°C`
    );
  }

  // 4. Isolation Numeric Extraction Agreement (15 pts)
  if (
    edge.extractedIsolationKOhm !== null &&
    cloud.extractedIsolationKOhm !== null
  ) {
    const deltaIso = Math.abs(
      edge.extractedIsolationKOhm - cloud.extractedIsolationKOhm
    );
    if (deltaIso > 5.0) {
      score -= 15;
      discrepancies.push(
        `HV isolation extraction drift: Stage 1=${edge.extractedIsolationKOhm} kΩ vs Stage 2=${cloud.extractedIsolationKOhm} kΩ`
      );
    }
  }

  const clampedScore = Math.max(0, Math.min(100, score));
  const status =
    clampedScore >= 92
      ? 'UNANIMOUS_CONSENSUS'
      : clampedScore >= 75
      ? 'MINOR_VARIANCE'
      : 'DISCREPANCY_ALERT';

  return {
    consensusScore: clampedScore,
    status,
    discrepancies,
  };
}

/**
 * Executes Stage 1 Primary Triage + Stage 2 Cloud Audit via `firebase/ai`:
 * - Stage 1 passes both `onDeviceParams` (with `expectedInputs`, `expectedOutputs`, download `monitor`, and `responseConstraint`)
 *   and `inCloudParams` (`gemini-2.5-flash-lite` with identical JSON `responseSchema`).
 * - Stage 2 executes structured JSON audit on `gemini-2.5-flash` via `InferenceMode.PREFER_IN_CLOUD`.
 * - Keeps the deterministic regex safety pre-check (`deterministicBaseline`) strictly separate from model outputs.
 * - Never copies regex values into `edgeTriage` or `cloudAudit` when a model call fails; returns `status: 'AUDIT_UNAVAILABLE'`
 *   and `consensusScore: null` with the real error message surfaced.
 */
export async function executeSpeculativeConsensusGate(
  decision: AdaptiveRoutingDecision,
  onNanoDownloadProgress?: (pct: number) => void
): Promise<ConsensusGateResult> {
  const nanoAvailability = await probeGeminiNanoAvailability();
  const { ai, errorMessage: aiInitError } = getSentinelFirebaseAI();

  // Stage 1: Primary Model Triage (`ONLY_ON_DEVICE`, `PREFER_ON_DEVICE`, or `PREFER_IN_CLOUD`)
  let primaryTtftMs: number | null = null;
  let primaryTotalMs: number | null = null;
  let primarySource: ActualExecutionSource = 'MODEL_UNAVAILABLE';
  let primaryBadge: ReportedInferenceSourceBadge = 'NONE';
  let primaryFaultCode: string | null = null;
  let primarySeverity: SafetySeverity | null = null;
  let primaryTempC: number | null = null;
  let primaryIsoKOhm: number | null = null;
  let primarySummary = '';
  let primaryTransparency = '';
  let primaryError: string | null = aiInitError;
  let latestDownloadPct: number | null = null;

  const nanoLang = GEMINI_NANO_SUPPORTED_LOCALES.includes(
    decision.detectedLocale
  )
    ? decision.detectedLocale
    : 'en';

  if (ai) {
    try {
      const firebaseMode =
        decision.routeTarget === 'ONLY_ON_DEVICE'
          ? FirebaseInferenceMode.ONLY_ON_DEVICE
          : decision.routeTarget === 'PREFER_ON_DEVICE'
          ? FirebaseInferenceMode.PREFER_ON_DEVICE
          : FirebaseInferenceMode.PREFER_IN_CLOUD;

      const hybridModel = getGenerativeModel(ai, {
        mode: firebaseMode,
        onDeviceParams: {
          createOptions: {
            expectedInputs: [{ type: 'text', languages: [nanoLang] }],
            expectedOutputs: [{ type: 'text', languages: [nanoLang] }],
            monitor: (monitor) => {
              monitor.addEventListener('downloadprogress', (e) => {
                const pct = Math.round((e.loaded || 0) * 100);
                latestDownloadPct = pct;
                onNanoDownloadProgress?.(pct);
              });
            },
          },
          promptOptions: {
            responseConstraint: EDGE_TRIAGE_JSON_CONSTRAINT,
          },
        },
        inCloudParams: {
          model: 'gemini-2.5-flash-lite',
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: Schema.object({
              properties: {
                faultCode: Schema.string(),
                severity: Schema.enumString({
                  enum: ['NOMINAL', 'WARNING', 'CRITICAL', 'SAFE_STATE_LOCK'],
                }),
                extractedTempC: Schema.number(),
                extractedIsolationKOhm: Schema.number(),
                summary: Schema.string(),
              },
            }),
          },
        },
      });

      const t0 = performance.now();
      const streamResult = await hybridModel.generateContentStream(
        `Analyze this PII-scrubbed QNX post-mortem diagnostic log and return JSON with faultCode, severity (NOMINAL, WARNING, CRITICAL, SAFE_STATE_LOCK), extractedTempC (number), extractedIsolationKOhm (number), and summary (in ${decision.languageMeta.name}):\n"${decision.piiResult.sanitizedText}"`
      );

      for await (const _chunk of streamResult.stream) {
        if (primaryTtftMs === null) {
          primaryTtftMs = Number((performance.now() - t0).toFixed(1));
        }
      }
      const finalResp = await streamResult.response;
      primaryTotalMs = Number((performance.now() - t0).toFixed(1));

      const parsed = JSON.parse(finalResp.text());
      primaryFaultCode =
        typeof parsed.faultCode === 'string' ? parsed.faultCode : null;
      primarySeverity = parsed.severity || null;
      primaryTempC =
        typeof parsed.extractedTempC === 'number'
          ? parsed.extractedTempC
          : null;
      primaryIsoKOhm =
        typeof parsed.extractedIsolationKOhm === 'number'
          ? parsed.extractedIsolationKOhm
          : null;
      primarySummary =
        typeof parsed.summary === 'string' ? parsed.summary : finalResp.text();

      if (finalResp.inferenceSource === InferenceSource.ON_DEVICE) {
        primarySource = 'ON_DEVICE_GEMINI_NANO';
        primaryBadge = 'ON_DEVICE';
        primaryTransparency =
          'Stage 1 executed on-device via Chrome Built-in Gemini Nano (InferenceSource.ON_DEVICE) with structured JSON responseConstraint.';
      } else if (decision.routeTarget === 'PREFER_ON_DEVICE') {
        primarySource = 'CLOUD_FALLBACK_VIA_PREFER_ON_DEVICE';
        primaryBadge = 'IN_CLOUD';
        primaryTransparency =
          'Chrome Gemini Nano unavailable on host — firebase/ai InferenceMode.PREFER_ON_DEVICE fell back to Cloud Gemini (gemini-2.5-flash-lite, InferenceSource.IN_CLOUD).';
      } else {
        primarySource = 'CLOUD_GEMINI_DIRECT';
        primaryBadge = 'IN_CLOUD';
        primaryTransparency =
          'Stage 1 executed in-cloud via firebase/ai InferenceMode.PREFER_IN_CLOUD (gemini-2.5-flash-lite, InferenceSource.IN_CLOUD).';
      }
      primaryError = null;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[Stage 1 firebase/ai Triage Error]:', msg);
      primaryTtftMs = null;
      primaryTotalMs = null;
      primarySource = 'MODEL_UNAVAILABLE';
      primaryBadge = 'NONE';
      primaryError = msg;
      primarySummary = `Stage 1 model execution failed: ${msg}`;
      primaryTransparency = `Stage 1 firebase/ai call did not complete (${msg}). Deterministic regex baseline is shown separately and is NOT used to fabricate model consensus.`;
    }
  } else {
    primarySummary =
      primaryError || 'firebase/ai not initialized (missing configuration).';
    primaryTransparency =
      'Configure NEXT_PUBLIC_FIREBASE_* in .env.local to execute live firebase/ai inference.';
  }

  const edgeTriage: EdgeTriageOutput = {
    engineName:
      primarySource === 'ON_DEVICE_GEMINI_NANO'
        ? 'firebase/ai · Chrome Gemini Nano (ON_DEVICE)'
        : primarySource === 'CLOUD_FALLBACK_VIA_PREFER_ON_DEVICE'
        ? 'firebase/ai · Cloud Fallback via PREFER_ON_DEVICE (gemini-2.5-flash-lite)'
        : primarySource === 'CLOUD_GEMINI_DIRECT'
        ? 'firebase/ai · Cloud Gemini (gemini-2.5-flash-lite)'
        : 'Stage 1 Model Unavailable',
    requestedMode: decision.routeTarget,
    actualSource: primarySource,
    inferenceSourceBadge: primaryBadge,
    nanoAvailability,
    nanoDownloadProgressPct: latestDownloadPct,
    ttftMs: primaryTtftMs,
    totalLatencyMs: primaryTotalMs,
    faultCode: primaryFaultCode,
    severity: primarySeverity,
    extractedTempC: primaryTempC,
    extractedIsolationKOhm: primaryIsoKOhm,
    summary: primarySummary,
    transparencyNote: primaryTransparency,
    errorMessage: primaryError,
  };

  // If offline (`ONLY_ON_DEVICE`), enqueue the cloud audit request into IndexedDB/localStorage and return `AUDIT_UNAVAILABLE`
  if (decision.isOffline || decision.routeTarget === 'ONLY_ON_DEVICE') {
    const queued = enqueueOfflineForensicsRequest({
      rawInput: decision.piiResult.sanitizedText,
      locale: decision.detectedLocale,
      requestedModel: 'gemini-2.5-flash',
    });

    const offlineAudit: CloudAuditOutput = {
      engineName: 'Offline Queue (Queued for Cloud gemini-2.5-flash)',
      actualSource: 'MODEL_UNAVAILABLE',
      inferenceSourceBadge: 'NONE',
      ttftMs: null,
      totalLatencyMs: null,
      faultCode: null,
      severity: null,
      extractedTempC: null,
      extractedIsolationKOhm: null,
      localizedRemediation: null,
      auditNotes: `Operator is offline (ONLY_ON_DEVICE). Cloud audit queued to IndexedDB/localStorage (${queued.id}).`,
      errorMessage: 'Browser is offline — Cloud Audit deferred to Offline Queue.',
    };

    return {
      deterministicBaseline: decision.safetyCheck,
      edgeTriage,
      cloudAudit: offlineAudit,
      consensusScore: null,
      status: 'AUDIT_UNAVAILABLE',
      discrepancies: [
        `Cloud Audit deferred while offline (Queued ID: ${queued.id}).`,
      ],
      finalSeverity: edgeTriage.severity ?? decision.safetyCheck.severity,
      finalRemediation:
        edgeTriage.summary ||
        `Offline deterministic baseline: ${decision.safetyCheck.triggeredRule}`,
      queuedOfflineItemId: queued.id,
    };
  }

  // Stage 2: Cloud Verification Audit via `firebase/ai` (`InferenceMode.PREFER_IN_CLOUD` + `gemini-2.5-flash`)
  let cloudTtftMs: number | null = null;
  let cloudTotalMs: number | null = null;
  let cloudSource: ActualExecutionSource = 'MODEL_UNAVAILABLE';
  let cloudBadge: ReportedInferenceSourceBadge = 'NONE';
  let cloudFaultCode: string | null = null;
  let cloudSeverity: SafetySeverity | null = null;
  let cloudTempC: number | null = null;
  let cloudIsoKOhm: number | null = null;
  let cloudRemediation: string | null = null;
  let cloudAuditNotes = '';
  let cloudError: string | null = aiInitError;

  if (ai) {
    try {
      const cloudAuditModel = getGenerativeModel(ai, {
        mode: FirebaseInferenceMode.PREFER_IN_CLOUD,
        inCloudParams: {
          model: 'gemini-2.5-flash',
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: Schema.object({
              properties: {
                faultCode: Schema.string(),
                severity: Schema.enumString({
                  enum: ['NOMINAL', 'WARNING', 'CRITICAL', 'SAFE_STATE_LOCK'],
                }),
                extractedTempC: Schema.number(),
                extractedIsolationKOhm: Schema.number(),
                localizedRemediation: Schema.string(),
                auditNotes: Schema.string(),
              },
            }),
          },
        },
      });

      const tCloud0 = performance.now();
      const cloudStream = await cloudAuditModel.generateContentStream(
        `Audit this PII-scrubbed QNX post-mortem diagnostic log in ${decision.languageMeta.name} (${decision.detectedLocale}) and return JSON with faultCode, severity (NOMINAL, WARNING, CRITICAL, SAFE_STATE_LOCK), extractedTempC, extractedIsolationKOhm, localizedRemediation (in ${decision.languageMeta.nativeName}), and auditNotes:\n"${decision.piiResult.sanitizedText}"`
      );

      for await (const _chunk of cloudStream.stream) {
        if (cloudTtftMs === null) {
          cloudTtftMs = Number((performance.now() - tCloud0).toFixed(1));
        }
      }
      const finalCloud = await cloudStream.response;
      cloudTotalMs = Number((performance.now() - tCloud0).toFixed(1));
      cloudSource = 'CLOUD_GEMINI_DIRECT';
      cloudBadge =
        finalCloud.inferenceSource === InferenceSource.ON_DEVICE
          ? 'ON_DEVICE'
          : 'IN_CLOUD';

      const parsed = JSON.parse(finalCloud.text());
      cloudFaultCode =
        typeof parsed.faultCode === 'string' ? parsed.faultCode : null;
      cloudSeverity = parsed.severity || null;
      cloudTempC =
        typeof parsed.extractedTempC === 'number'
          ? parsed.extractedTempC
          : null;
      cloudIsoKOhm =
        typeof parsed.extractedIsolationKOhm === 'number'
          ? parsed.extractedIsolationKOhm
          : null;
      cloudRemediation =
        typeof parsed.localizedRemediation === 'string'
          ? parsed.localizedRemediation
          : null;
      cloudAuditNotes =
        typeof parsed.auditNotes === 'string'
          ? parsed.auditNotes
          : 'Cloud Gemini audit completed.';
      cloudError = null;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[Stage 2 Cloud Audit Error]:', msg);
      cloudTtftMs = null;
      cloudTotalMs = null;
      cloudSource = 'MODEL_UNAVAILABLE';
      cloudBadge = 'NONE';
      cloudFaultCode = null;
      cloudSeverity = null;
      cloudTempC = null;
      cloudIsoKOhm = null;
      cloudRemediation = null;
      cloudAuditNotes = `Cloud Audit failed: ${msg}`;
      cloudError = msg;
    }
  } else {
    cloudAuditNotes =
      cloudError || 'Cloud Audit unavailable (firebase/ai not initialized).';
  }

  const cloudAudit: CloudAuditOutput = {
    engineName:
      cloudSource === 'CLOUD_GEMINI_DIRECT'
        ? 'firebase/ai · Cloud Gemini Audit (gemini-2.5-flash)'
        : 'Cloud Audit Unavailable',
    actualSource: cloudSource,
    inferenceSourceBadge: cloudBadge,
    ttftMs: cloudTtftMs,
    totalLatencyMs: cloudTotalMs,
    faultCode: cloudFaultCode,
    severity: cloudSeverity,
    extractedTempC: cloudTempC,
    extractedIsolationKOhm: cloudIsoKOhm,
    localizedRemediation: cloudRemediation,
    auditNotes: cloudAuditNotes,
    errorMessage: cloudError,
  };

  // Compare Stage 1 model output to Stage 2 model output (never substituting regex values to fake 100% consensus)
  const consensus = computeEdgeCloudConsensus(edgeTriage, cloudAudit);

  return {
    deterministicBaseline: decision.safetyCheck,
    edgeTriage,
    cloudAudit,
    consensusScore: consensus.consensusScore,
    status: consensus.status,
    discrepancies: consensus.discrepancies,
    finalSeverity:
      cloudAudit.severity ??
      edgeTriage.severity ??
      decision.safetyCheck.severity,
    finalRemediation:
      cloudAudit.localizedRemediation ??
      (edgeTriage.summary ||
        `[Deterministic Baseline Only — Cloud Audit Unavailable] ${decision.safetyCheck.triggeredRule}`),
    queuedOfflineItemId: null,
  };
}

/**
 * Executes Multimodal Hardware Vision Inspection via `firebase/ai` (`getGenerativeModel`
 * with `InferenceMode.PREFER_ON_DEVICE` or `InferenceMode.PREFER_IN_CLOUD` and `gemini-2.5-flash-lite`).
 * - Never claims `zeroCloudUpload: true` when no model ran (`isReferenceBaselineOnly: true` -> `zeroCloudUpload: false`).
 * - Surfaces real errors in `errorMessage`.
 */
export async function executeFirebaseMultimodalVision(params: {
  presetId: 'sic_scorch' | 'hv_arcing' | 'can_abrasion';
  imageBase64: string;
  mimeType: string;
  prompt: string;
  preferredMode: 'PREFER_ON_DEVICE' | 'PREFER_IN_CLOUD';
  referenceBaseline: Omit<
    VisionInspectionOutput,
    | 'executedPath'
    | 'actualSource'
    | 'inferenceSourceBadge'
    | 'ttftMs'
    | 'zeroCloudUpload'
    | 'isReferenceBaselineOnly'
    | 'errorMessage'
  >;
}): Promise<VisionInspectionOutput> {
  const { ai, errorMessage: aiInitError } = getSentinelFirebaseAI();
  const nanoAvailability = await probeGeminiNanoAvailability();
  let capturedError: string | null = aiInitError;

  if (ai && params.imageBase64) {
    try {
      const model = getGenerativeModel(ai, {
        mode:
          params.preferredMode === 'PREFER_ON_DEVICE'
            ? FirebaseInferenceMode.PREFER_ON_DEVICE
            : FirebaseInferenceMode.PREFER_IN_CLOUD,
        onDeviceParams: {
          createOptions: {
            expectedInputs: [{ type: 'image' }, { type: 'text', languages: ['en'] }],
            expectedOutputs: [{ type: 'text', languages: ['en'] }],
          },
        },
        inCloudParams: {
          model: 'gemini-2.5-flash-lite',
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: Schema.object({
              properties: {
                faultTitle: Schema.string(),
                dtcCode: Schema.string(),
                severity: Schema.enumString({
                  enum: ['NOMINAL', 'WARNING', 'CRITICAL', 'SAFE_STATE_LOCK'],
                }),
                componentZone: Schema.string(),
                peakTempEstimateC: Schema.number(),
                confidencePct: Schema.number(),
                findings: Schema.string(),
                remediation: Schema.string(),
              },
            }),
          },
        },
      });

      const cleanBase64 = params.imageBase64.replace(
        /^data:image\/[a-zA-Z0-9+.-]+;base64,/,
        ''
      );
      const t0 = performance.now();
      const streamRes = await model.generateContentStream([
        {
          type: 'inlineData',
          inlineData: {
            mimeType: params.mimeType || 'image/png',
            data: cleanBase64,
          },
        },
        `${params.prompt}\nReturn JSON failure analysis for this fault image.`,
      ]);

      let ttftMs: number | null = null;
      for await (const _chunk of streamRes.stream) {
        if (ttftMs === null) {
          ttftMs = Number((performance.now() - t0).toFixed(1));
        }
      }
      const finalResp = await streamRes.response;
      const parsed = JSON.parse(finalResp.text());
      const ranOnDevice =
        finalResp.inferenceSource === InferenceSource.ON_DEVICE;

      return {
        faultTitle: parsed.faultTitle || params.referenceBaseline.faultTitle,
        dtcCode: parsed.dtcCode || params.referenceBaseline.dtcCode,
        severity: parsed.severity || params.referenceBaseline.severity,
        componentZone:
          parsed.componentZone || params.referenceBaseline.componentZone,
        peakTempEstimateC:
          parsed.peakTempEstimateC ??
          params.referenceBaseline.peakTempEstimateC,
        confidencePct:
          parsed.confidencePct ?? params.referenceBaseline.confidencePct,
        findings: parsed.findings || params.referenceBaseline.findings,
        remediation:
          parsed.remediation || params.referenceBaseline.remediation,
        executedPath: ranOnDevice
          ? 'firebase/ai · Chrome Gemini Nano Multimodal (ON_DEVICE)'
          : params.preferredMode === 'PREFER_ON_DEVICE'
          ? 'firebase/ai · Cloud Fallback via PREFER_ON_DEVICE (gemini-2.5-flash-lite)'
          : 'firebase/ai · Cloud Multimodal (gemini-2.5-flash-lite)',
        actualSource: ranOnDevice
          ? 'ON_DEVICE_GEMINI_NANO'
          : params.preferredMode === 'PREFER_ON_DEVICE'
          ? 'CLOUD_FALLBACK_VIA_PREFER_ON_DEVICE'
          : 'CLOUD_GEMINI_DIRECT',
        inferenceSourceBadge: ranOnDevice ? 'ON_DEVICE' : 'IN_CLOUD',
        ttftMs,
        zeroCloudUpload: ranOnDevice,
        isReferenceBaselineOnly: false,
        errorMessage: null,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[Multimodal firebase/ai Vision Error]:', msg);
      capturedError = msg;
    }
  }

  return {
    ...params.referenceBaseline,
    executedPath:
      nanoAvailability === 'UNAVAILABLE_ON_HOST'
        ? 'Static Reference Profile (No LLM executed; Chrome Nano unavailable & Cloud call failed)'
        : 'Static Reference Profile (No LLM executed)',
    actualSource: 'MODEL_UNAVAILABLE',
    inferenceSourceBadge: 'NONE',
    ttftMs: null,
    zeroCloudUpload: false,
    isReferenceBaselineOnly: true,
    errorMessage: capturedError,
  };
}

import type { InferenceMode } from './adaptive-router';

export type BlackBoxEventType =
  | 'TELEMETRY_SNAPSHOT'
  | 'PII_REDACTION'
  | 'ROUTING_DECISION'
  | 'CONSENSUS_AUDIT'
  | 'VISION_INSPECTION';

export interface BlackBoxBlock {
  id: string;
  sequenceIndex: number;
  timestampIso: string;
  eventType: BlackBoxEventType;
  locale: string;
  routeTarget: InferenceMode;
  consensusScore: number;
  summary: string;
  prevHash: string;
  entryHash: string;
  isSampleData?: boolean;
}

export interface ChainVerificationReport {
  isValid: boolean;
  totalBlocks: number;
  tamperedBlockIndex: number | null;
  expectedHash: string | null;
  actualHash: string | null;
  verifiedAtIso: string;
}

export const GENESIS_PREV_HASH =
  '0000000000000000000000000000000000000000000000000000000000000000';

/**
 * Canonical string serializer for deterministic SHA-256 hashing across browser & Node environments.
 */
export function serializeBlockCanonical(
  block: Omit<BlackBoxBlock, 'entryHash'>
): string {
  return [
    `seq:${block.sequenceIndex}`,
    `ts:${block.timestampIso}`,
    `type:${block.eventType}`,
    `loc:${block.locale}`,
    `route:${block.routeTarget}`,
    `consensus:${block.consensusScore.toFixed(1)}`,
    `prev:${block.prevHash}`,
    `summary:${block.summary}`,
  ].join('|');
}

/**
 * Computes a lowercase 64-char SHA-256 hex digest using Web Crypto (`crypto.subtle.digest`).
 */
export async function computeSha256Hex(payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(payload);
  const digestBuffer = await crypto.subtle.digest('SHA-256', bytes);
  const hashArray = Array.from(new Uint8Array(digestBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Creates and signs a new SHA-256 hash-chained block linked to the previous block's `entryHash`.
 */
export async function createSignedBlackBoxBlock(params: {
  id?: string;
  sequenceIndex: number;
  timestampIso?: string;
  eventType: BlackBoxEventType;
  locale: string;
  routeTarget: InferenceMode;
  consensusScore: number;
  summary: string;
  prevHash: string;
  isSampleData?: boolean;
}): Promise<BlackBoxBlock> {
  const timestampIso = params.timestampIso ?? new Date().toISOString();
  const id = params.id ?? `blk_${params.sequenceIndex}_${Date.now()}`;
  const unsignedBlock: Omit<BlackBoxBlock, 'entryHash'> = {
    id,
    sequenceIndex: params.sequenceIndex,
    timestampIso,
    eventType: params.eventType,
    locale: params.locale,
    routeTarget: params.routeTarget,
    consensusScore: params.consensusScore,
    summary: params.summary.slice(0, 500),
    prevHash: params.prevHash,
    isSampleData: params.isSampleData,
  };

  const canonical = serializeBlockCanonical(unsignedBlock);
  const entryHash = await computeSha256Hex(canonical);

  return {
    ...unsignedBlock,
    entryHash,
  };
}

/**
 * Verifies every link (`prevHash` -> `entryHash`) in the Black-Box Flight Recorder chain.
 */
export async function verifyBlackBoxChain(
  chain: BlackBoxBlock[]
): Promise<ChainVerificationReport> {
  for (let i = 0; i < chain.length; i++) {
    const block = chain[i];
    const expectedPrevHash =
      i === 0 ? GENESIS_PREV_HASH : chain[i - 1].entryHash;

    if (block.prevHash !== expectedPrevHash) {
      return {
        isValid: false,
        totalBlocks: chain.length,
        tamperedBlockIndex: i,
        expectedHash: expectedPrevHash,
        actualHash: block.prevHash,
        verifiedAtIso: new Date().toISOString(),
      };
    }

    const recomputedHash = await computeSha256Hex(
      serializeBlockCanonical({
        id: block.id,
        sequenceIndex: block.sequenceIndex,
        timestampIso: block.timestampIso,
        eventType: block.eventType,
        locale: block.locale,
        routeTarget: block.routeTarget,
        consensusScore: block.consensusScore,
        summary: block.summary,
        prevHash: block.prevHash,
        isSampleData: block.isSampleData,
      })
    );

    if (recomputedHash !== block.entryHash) {
      return {
        isValid: false,
        totalBlocks: chain.length,
        tamperedBlockIndex: i,
        expectedHash: recomputedHash,
        actualHash: block.entryHash,
        verifiedAtIso: new Date().toISOString(),
      };
    }
  }

  return {
    isValid: true,
    totalBlocks: chain.length,
    tamperedBlockIndex: null,
    expectedHash: null,
    actualHash: null,
    verifiedAtIso: new Date().toISOString(),
  };
}

/**
 * Simulates an adversarial log tampering attack by mutating a block's payload without re-signing the chain.
 */
export function simulateChainTampering(
  chain: BlackBoxBlock[],
  targetIndex?: number
): BlackBoxBlock[] {
  if (chain.length === 0) return chain;
  const idx =
    targetIndex !== undefined
      ? Math.min(Math.max(0, targetIndex), chain.length - 1)
      : Math.max(0, Math.floor(chain.length / 2));

  return chain.map((block, i) => {
    if (i !== idx) return block;
    return {
      ...block,
      summary: `[TAMPERED_PAYLOAD] SiC_Inverter_Temp overwritten to 62.0C (Nominal) — unauthorized bit mutation`,
    };
  });
}

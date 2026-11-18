'use client';

import React from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Lock,
  RotateCcw,
  Bug,
  CloudUpload,
  Database,
} from 'lucide-react';
import { BlackBoxBlock, ChainVerificationReport } from '@/lib/hash-chain';

interface BlackBoxRecorderPanelProps {
  chain: BlackBoxBlock[];
  verificationReport: ChainVerificationReport | null;
  isTampered: boolean;
  onVerifyChain: () => void;
  onSimulateTampering: () => void;
  onRestoreChain: () => void;
  onLoadSampleBlocks: () => void;
  onSyncChainToFirestore: () => void;
  firestoreSyncStatus: string | null;
}

export default function BlackBoxRecorderPanel({
  chain,
  verificationReport,
  isTampered,
  onVerifyChain,
  onSimulateTampering,
  onRestoreChain,
  onLoadSampleBlocks,
  onSyncChainToFirestore,
  firestoreSyncStatus,
}: BlackBoxRecorderPanelProps) {
  return (
    <section
      aria-label="SHA-256 Hash-Chained Black-Box Flight Recorder"
      className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-5"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-base font-semibold text-slate-100">
            SHA-256 Hash-Chained Black-Box Flight Recorder (Web Crypto)
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Chains every telemetry snapshot, PII redaction event, and routing
            decision into a tamper-evident cryptographic ledger (
            <span className="font-mono text-cyan-400">
              prevHash &rarr; entryHash
            </span>{' '}
            via <span className="font-mono">crypto.subtle.digest</span>). Starts
            empty so only live runs or explicitly labeled{' '}
            <code className="font-mono text-amber-300">[SAMPLE DATA]</code>{' '}
            blocks appear.
          </p>
        </div>

        {/* Cryptographic Verification & Tamper Simulation Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {chain.length === 0 && (
            <button
              type="button"
              onClick={onLoadSampleBlocks}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors whitespace-nowrap shrink-0"
            >
              <Database className="w-3.5 h-3.5" />
              <span>Load Sample Crash-Dump Chain ([SAMPLE DATA])</span>
            </button>
          )}

          <button
            type="button"
            onClick={onVerifyChain}
            disabled={chain.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-md bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Verify Black-Box Chain</span>
          </button>

          <button
            type="button"
            onClick={onSimulateTampering}
            disabled={chain.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-md bg-rose-600/90 hover:bg-rose-500 text-white transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <Bug className="w-3.5 h-3.5" />
            <span>Simulate Log Tampering</span>
          </button>

          {isTampered && (
            <button
              type="button"
              onClick={onRestoreChain}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-md bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 transition-colors whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restore Chain Integrity</span>
            </button>
          )}

          <button
            type="button"
            onClick={onSyncChainToFirestore}
            disabled={chain.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-800 transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <CloudUpload className="w-3.5 h-3.5 text-cyan-400" />
            <span>Commit to Firestore</span>
          </button>
        </div>
      </div>

      {/* Verification Banner */}
      {verificationReport && chain.length > 0 && (
        <div
          role="status"
          data-testid="chain-verification-banner"
          className={`p-3.5 rounded-md border flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs ${
            verificationReport.isValid
              ? 'bg-emerald-950/30 border-emerald-700/60 text-emerald-200'
              : 'bg-rose-950/40 border-rose-600/80 text-rose-200'
          }`}
        >
          <div className="flex items-start gap-2.5">
            {verificationReport.isValid ? (
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            )}
            <div>
              <div className="font-semibold">
                {verificationReport.isValid
                  ? `CRYPTOGRAPHIC INTEGRITY VERIFIED: All ${verificationReport.totalBlocks} SHA-256 hash links intact.`
                  : `TAMPER ALERT: Cryptographic hash mismatch detected at Block #${verificationReport.tamperedBlockIndex}!`}
              </div>
              {!verificationReport.isValid && (
                <div className="font-mono text-[11px] mt-1 space-y-0.5 text-rose-300">
                  <div>
                    Expected SHA-256: {verificationReport.expectedHash}
                  </div>
                  <div>
                    Stored Block Hash: {verificationReport.actualHash}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="font-mono text-[11px] text-slate-400 shrink-0">
            {firestoreSyncStatus ||
              `Audited ${verificationReport.verifiedAtIso}`}
          </div>
        </div>
      )}

      {/* Hash-Chained Ledger Blocks */}
      {chain.length === 0 ? (
        <div className="bg-slate-950 border border-slate-800 rounded-md p-6 text-center space-y-3">
          <div className="text-sm font-semibold text-slate-200">
            No SHA-256 Flight Recorder Blocks Recorded Yet
          </div>
          <p className="text-xs text-slate-400 max-w-xl mx-auto">
            Execute a live{' '}
            <code className="font-mono text-cyan-400">firebase/ai</code> triage
            in Tab 1, run a multimodal vision inspection in Tab 2, or click{' '}
            <strong>Load Sample Crash-Dump Chain ([SAMPLE DATA])</strong> to
            test SHA-256 chain verification and tamper detection.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {chain.map((block, index) => {
            const isCorruptedBlock =
              verificationReport &&
              !verificationReport.isValid &&
              verificationReport.tamperedBlockIndex === index;

            return (
              <div
                key={block.id}
                data-testid={`blackbox-block-${block.sequenceIndex}`}
                className={`p-3.5 rounded-md border transition-colors ${
                  isCorruptedBlock
                    ? 'bg-rose-950/30 border-rose-500'
                    : 'bg-slate-950 border-slate-800'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <Lock className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="font-bold text-slate-100">
                      BLOCK #{block.sequenceIndex}
                    </span>
                    {block.isSampleData && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-950/80 border border-amber-600/70 text-amber-300 text-[10px]">
                        [SAMPLE DATA]
                      </span>
                    )}
                    <span aria-hidden="true">·</span>
                    <span className="text-cyan-400">{block.eventType}</span>
                    <span aria-hidden="true">·</span>
                    <span className="text-slate-300">
                      Locale: {block.locale.toUpperCase()}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="text-amber-400">{block.routeTarget}</span>
                  </div>

                  <div className="flex items-center gap-2 text-slate-400">
                    <span>Consensus: {block.consensusScore.toFixed(0)}%</span>
                    <span aria-hidden="true">·</span>
                    <span>{block.timestampIso}</span>
                  </div>
                </div>

                <p className="text-xs text-slate-200 mt-2 font-mono">
                  {block.summary}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2.5 pt-2 border-t border-slate-900 text-[11px] font-mono">
                  <div className="truncate text-slate-400">
                    <span className="text-slate-500">prevHash: </span>
                    {block.prevHash}
                  </div>
                  <div
                    className={`truncate ${
                      isCorruptedBlock
                        ? 'text-rose-400 font-bold'
                        : 'text-emerald-400'
                    }`}
                  >
                    <span className="text-slate-500">entryHash: </span>
                    {block.entryHash}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

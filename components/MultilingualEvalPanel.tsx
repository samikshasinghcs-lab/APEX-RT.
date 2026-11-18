'use client';

import React, { useState } from 'react';
import {
  Play,
  CheckCircle2,
  Globe,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import { ExperimentArm, SupportedLocale } from '@/lib/adaptive-router';
import {
  MultilingualEvalSuiteSummary,
  runMultilingualEvalSuite,
  evaluateSingleLocaleLiveModel,
  summarizeEvalRows,
} from '@/lib/multilingual-eval';

interface MultilingualEvalPanelProps {
  experimentArm: ExperimentArm;
  onSelectLocaleSample: (locale: SupportedLocale) => void;
}

export default function MultilingualEvalPanel({
  experimentArm,
  onSelectLocaleSample,
}: MultilingualEvalPanelProps) {
  const [suiteSummary, setSuiteSummary] =
    useState<MultilingualEvalSuiteSummary>(() =>
      runMultilingualEvalSuite(experimentArm)
    );
  const [runningLocale, setRunningLocale] = useState<
    SupportedLocale | 'ALL' | null
  >(null);
  const [lastRunTimestamp, setLastRunTimestamp] = useState<string>(
    'Showing Deterministic Pre-Check Baseline (Click "Run Live firebase/ai Eval" to measure model TTFT & score live model output)'
  );

  const handleReMeasurePreCheck = () => {
    const updated = runMultilingualEvalSuite(experimentArm);
    setSuiteSummary(updated);
    setLastRunTimestamp(
      `Re-measured 12-Locale Deterministic Pre-Check (5x performance.now() runs/locale) at ${new Date().toLocaleTimeString()}`
    );
  };

  const handleRunLiveModelForLocale = async (locale: SupportedLocale) => {
    setRunningLocale(locale);
    try {
      const liveRow = await evaluateSingleLocaleLiveModel(
        locale,
        experimentArm
      );
      const nextRows = suiteSummary.rows.map((r) =>
        r.locale === locale ? liveRow : r
      );
      setSuiteSummary(summarizeEvalRows(nextRows, experimentArm));
      setLastRunTimestamp(
        `Scored live firebase/ai output for [${locale.toUpperCase()}] at ${new Date().toLocaleTimeString()}`
      );
    } finally {
      setRunningLocale(null);
    }
  };

  const handleRunAllLiveModels = async () => {
    setRunningLocale('ALL');
    try {
      const nextRows = [...suiteSummary.rows];
      for (let i = 0; i < nextRows.length; i++) {
        const loc = nextRows[i].locale;
        nextRows[i] = await evaluateSingleLocaleLiveModel(loc, experimentArm);
        setSuiteSummary(summarizeEvalRows([...nextRows], experimentArm));
      }
      setLastRunTimestamp(
        `Completed 12-Locale Live firebase/ai Model Evaluation at ${new Date().toLocaleTimeString()}`
      );
    } finally {
      setRunningLocale(null);
    }
  };

  return (
    <section
      aria-label="Multilingual Evaluation Harness"
      className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-5"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-base font-semibold text-slate-100">
            Top-10+ Non-English Automotive &amp; Industrial Language Evaluation
            Harness
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            100-Point Rubric: Fault Classification (25pt) · Numeric Extraction
            (25pt) · Zero PII Leak (25pt) · Actionable Remediation (25pt). No
            synthetic TTFT numbers — model TTFT displays{' '}
            <code className="font-mono text-cyan-300">Not Measured Yet</code>{' '}
            until live <code className="font-mono text-cyan-300">firebase/ai</code>{' '}
            inference runs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleReMeasurePreCheck}
            disabled={runningLocale !== null}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <Play className="w-3.5 h-3.5 text-cyan-400" />
            <span>Re-Benchmark Local Pre-Check</span>
          </button>

          <button
            type="button"
            onClick={handleRunAllLiveModels}
            disabled={runningLocale !== null}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-md bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>
              {runningLocale === 'ALL'
                ? 'Running Live firebase/ai Eval...'
                : 'Run Live firebase/ai Model Eval (All 12)'}
            </span>
          </button>
        </div>
      </div>

      <div className="text-xs font-mono text-slate-400 bg-slate-950 border border-slate-800 rounded px-3 py-2">
        Status: {lastRunTimestamp}
      </div>

      {/* Aggregate KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-slate-950 border border-slate-800 rounded-md p-3.5">
          <div className="text-xs text-slate-400">Mean Rubric Score</div>
          <div className="text-2xl font-mono font-bold text-cyan-400 tabular-nums mt-1">
            {suiteSummary.averageRubricScore.toFixed(1)}
            <span className="text-xs text-slate-400 ml-1">/ 100 pt</span>
          </div>
          <div className="text-[11px] font-mono text-slate-400 mt-1">
            {suiteSummary.liveModelsExecutedCount > 0
              ? `${suiteSummary.liveModelsExecutedCount}/12 Live Model Outputs Scored`
              : 'Illustrative Pre-Check Baseline (0/12 Live Models Run)'}
          </div>
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-md p-3.5">
          <div className="text-xs text-slate-400">
            Measured Local Pre-Check (p50)
          </div>
          <div
            suppressHydrationWarning
            className="text-2xl font-mono font-bold text-emerald-400 tabular-nums mt-1"
          >
            {suiteSummary.measuredPreCheckP50Ms.toFixed(2)}
            <span className="text-xs text-slate-400 ml-1">ms</span>
          </div>
          <div
            suppressHydrationWarning
            className="text-[11px] font-mono text-slate-400 mt-1"
          >
            p95: {suiteSummary.measuredPreCheckP95Ms.toFixed(2)} ms (performance.now)
          </div>
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-md p-3.5">
          <div className="text-xs text-slate-400">
            Measured Live Model Mean TTFT
          </div>
          <div className="text-xl font-mono font-bold text-amber-400 tabular-nums mt-1">
            {suiteSummary.measuredLiveModelMeanTtftMs !== null
              ? `${suiteSummary.measuredLiveModelMeanTtftMs.toFixed(1)} ms`
              : 'Not Measured Yet'}
          </div>
          <div className="text-[11px] font-mono text-slate-400 mt-1">
            gemini-2.5-flash-lite (firebase/ai)
          </div>
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-md p-3.5">
          <div className="text-xs text-slate-400">Chrome Nano Locales</div>
          <div className="text-xl font-mono font-bold text-slate-200 tabular-nums mt-1">
            en, es, ja
          </div>
          <div className="text-[11px] font-mono text-slate-400 mt-1">
            9 non-Nano locales -&gt; Cloud
          </div>
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-md p-3.5 col-span-2 lg:col-span-1">
          <div className="text-xs text-slate-400">Zero PII Leak Rate</div>
          <div className="text-2xl font-mono font-bold text-emerald-400 tabular-nums mt-1">
            {suiteSummary.zeroPiiLeakComplianceRate}
            <span className="text-xs text-slate-400 ml-1">%</span>
          </div>
          <div className="text-[11px] font-mono text-slate-400 mt-1">
            VIN / GPS / Email / Badge Scrubbed
          </div>
        </div>
      </div>

      {/* High-Density 12-Language Benchmark Data Grid */}
      <div className="overflow-x-auto border border-slate-800 rounded-md">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 font-mono">
              <th className="py-2.5 px-3">Locale &amp; Script</th>
              <th className="py-2.5 px-3">Nano Support</th>
              <th className="py-2.5 px-3">Adaptive Route</th>
              <th className="py-2.5 px-3">Scored Source &amp; Badge</th>
              <th className="py-2.5 px-3 text-right">Pre-Check p50</th>
              <th className="py-2.5 px-3 text-right">Measured Model TTFT</th>
              <th className="py-2.5 px-3 text-right">Rubric (25×4)</th>
              <th className="py-2.5 px-3 text-right">Total Score</th>
              <th className="py-2.5 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70 bg-slate-900/60">
            {suiteSummary.rows.map((row) => (
              <tr
                key={row.locale}
                className="hover:bg-slate-800/50 transition-colors"
              >
                <td className="py-2.5 px-3">
                  <div className="font-semibold text-slate-100">
                    {row.languageName}{' '}
                    <span className="font-mono text-cyan-400">
                      [{row.locale}]
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {row.nativeName} · {row.automotiveHub}
                  </div>
                </td>
                <td className="py-2.5 px-3 font-mono">
                  <span
                    className={
                      row.nanoSupported
                        ? 'text-emerald-400'
                        : 'text-slate-400'
                    }
                  >
                    {row.nanoSupported ? 'YES (Prompt API)' : 'NO (Cloud Only)'}
                  </span>
                </td>
                <td className="py-2.5 px-3 font-mono">
                  <span
                    className={
                      row.selectedRoute === 'PREFER_ON_DEVICE'
                        ? 'text-emerald-400 font-semibold'
                        : 'text-amber-400 font-semibold'
                    }
                  >
                    {row.selectedRoute}
                  </span>
                </td>
                <td className="py-2.5 px-3 font-mono">
                  <div className="flex flex-col gap-0.5">
                    <span
                      className={
                        row.evaluationSource === 'LIVE_FIREBASE_AI_MODEL'
                          ? 'text-cyan-400 font-semibold'
                          : row.evaluationSource === 'MODEL_CALL_FAILED'
                          ? 'text-rose-400 font-semibold'
                          : 'text-slate-400'
                      }
                    >
                      {row.evaluationSource === 'LIVE_FIREBASE_AI_MODEL'
                        ? 'LIVE_MODEL_OUTPUT'
                        : row.evaluationSource === 'MODEL_CALL_FAILED'
                        ? 'MODEL_CALL_FAILED'
                        : 'PRECHECK_ILLUSTRATIVE'}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      inferenceSource: {row.inferenceSourceBadge}
                    </span>
                  </div>
                </td>
                <td
                  suppressHydrationWarning
                  className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-300"
                >
                  {row.measuredPreCheckLatencySummaryMs.p50.toFixed(2)} ms
                </td>
                <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-200">
                  {row.measuredModelTtftMs !== null
                    ? `${row.measuredModelTtftMs.toFixed(1)} ms`
                    : 'Not Measured'}
                </td>
                <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-300">
                  {row.hybridRubric.faultClassification}/
                  {row.hybridRubric.numericExtraction}/
                  {row.hybridRubric.zeroPiiLeak}/
                  {row.hybridRubric.actionableRemediation}
                </td>
                <td className="py-2.5 px-3 text-right font-mono font-bold tabular-nums">
                  {row.evaluationSource === 'MODEL_CALL_FAILED' ? (
                    <span className="inline-flex items-center gap-1 justify-end text-rose-400">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {row.hybridRubric.totalScore}/100
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 justify-end text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {row.hybridRubric.totalScore}/100
                    </span>
                  )}
                </td>
                <td className="py-2.5 px-3 text-right">
                  <div className="inline-flex items-center gap-1.5 justify-end">
                    <button
                      type="button"
                      onClick={() => handleRunLiveModelForLocale(row.locale)}
                      disabled={runningLocale !== null}
                      className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-mono rounded bg-cyan-950/70 hover:bg-cyan-900/80 text-cyan-300 border border-cyan-700/60 transition-colors disabled:opacity-50 whitespace-nowrap"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>
                        {runningLocale === row.locale ? 'Running...' : 'Eval AI'}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectLocaleSample(row.locale)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors whitespace-nowrap"
                    >
                      <Globe className="w-3 h-3" />
                      <span>Load</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

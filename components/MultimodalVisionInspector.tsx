'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera,
  Upload,
  Cpu,
  Cloud,
  CheckCircle2,
  Info,
  AlertTriangle,
} from 'lucide-react';
import { InferenceMode } from '@/lib/adaptive-router';
import {
  VisionInspectionOutput,
  executeFirebaseMultimodalVision,
} from '@/lib/firebase-ai-hybrid';

export type { VisionInspectionOutput };
export type VisionPresetId = 'sic_scorch' | 'hv_arcing' | 'can_abrasion';

export interface VisionPresetCapture {
  id: VisionPresetId;
  label: string;
  subtitle: string;
  dtcCode: string;
  defaultPrompt: string;
}

export const VISION_PRESET_CAPTURES: VisionPresetCapture[] = [
  {
    id: 'sic_scorch',
    label: 'SiC Inverter Thermal Scorch (Synthetic Test Image)',
    subtitle: 'Synthetic Canvas Diagram: Phase-U 214.5°C Delamination',
    dtcCode: 'P0A78',
    defaultPrompt:
      'Inspect this synthetic 800V SiC MOSFET power module test image for die bond delamination, solder voiding, and thermal scorch.',
  },
  {
    id: 'hv_arcing',
    label: 'HV Contactor Arcing (Synthetic Test Image)',
    subtitle: 'Synthetic Canvas Diagram: 800V K1 Silver-Alloy Pitting',
    dtcCode: 'P0AA1',
    defaultPrompt:
      'Analyze this synthetic High-Voltage Battery Junction Box contactor test image for plasma arc pitting and contact welding.',
  },
  {
    id: 'can_abrasion',
    label: 'CAN-Bus Harness Abrasion (Synthetic Test Image)',
    subtitle: 'Synthetic Canvas Diagram: CAN-FD Shield Chafing',
    dtcCode: 'U0100',
    defaultPrompt:
      'Examine this synthetic CAN-FD wiring harness grommet test image for EMI braided shield abrasion and copper strand exposure.',
  },
];

const REFERENCE_BASELINES: Record<
  VisionPresetId,
  Omit<
    VisionInspectionOutput,
    | 'executedPath'
    | 'actualSource'
    | 'inferenceSourceBadge'
    | 'ttftMs'
    | 'zeroCloudUpload'
    | 'isReferenceBaselineOnly'
    | 'errorMessage'
  >
> = {
  sic_scorch: {
    faultTitle: 'SiC Inverter Phase-U Gate Driver Delamination & Thermal Scorch',
    dtcCode: 'P0A78',
    severity: 'SAFE_STATE_LOCK',
    componentZone: '800V SiC Half-Bridge Power Module (Phase-U Drain-Source)',
    peakTempEstimateC: 214.5,
    confidencePct: 98.4,
    findings:
      '[Reference Baseline] Solder voiding and substrate discoloration across Q1/Q2 SiC MOSFET die bond pads. Localized hotspot ~214.5°C.',
    remediation:
      'Verify QNX target executed autonomous Safe Torque Off (STO), lock out HV battery pack, replace Phase-U SiC power module assembly, and inspect cold-plate TIM compression.',
  },
  hv_arcing: {
    faultTitle: 'HV Main Positive Contactor Silver-Alloy Pitting & Plasma Arcing',
    dtcCode: 'P0AA1',
    severity: 'CRITICAL',
    componentZone: 'BJB Main Positive Contactor K1 (800V DC Bus)',
    peakTempEstimateC: 192.0,
    confidencePct: 97.1,
    findings:
      '[Reference Baseline] Arc erosion craters on fixed busbar terminal. Pre-charge resistor timing drift caused hot-switching under load.',
    remediation:
      'Replace HV Contactor K1 and pre-charge relay K3. Recalibrate QNX BMS contactor weld-detection resistance threshold (<0.8 mΩ).',
  },
  can_abrasion: {
    faultTitle: 'CAN-FD Twisted-Pair Shield Chafing & Copper Strand Exposure',
    dtcCode: 'U0100',
    severity: 'WARNING',
    componentZone: 'Front Subframe Bulkhead Grommet (CAN_H / CAN_L Bus 2)',
    peakTempEstimateC: 68.4,
    confidencePct: 95.8,
    findings:
      '[Reference Baseline] Braided EMI shield and PTFE jacket abraded through 65% cross-section against aluminum chassis edge.',
    remediation:
      'Install convoluted PEEK abrasion sleeve, splice shielded CAN-FD twisted pair per IPC/WHMA-A-620 Class 3, and verify eye-diagram signal integrity.',
  },
};

interface MultimodalVisionInspectorProps {
  onVisionInspectionRecorded: (result: VisionInspectionOutput) => void;
}

export default function MultimodalVisionInspector({
  onVisionInspectionRecorded,
}: MultimodalVisionInspectorProps) {
  const [selectedPreset, setSelectedPreset] =
    useState<VisionPresetId>('sic_scorch');
  const [customImageDataUrl, setCustomImageDataUrl] = useState<string | null>(
    null
  );
  const [customFileName, setCustomFileName] = useState<string | null>(null);
  const [preferredMode, setPreferredMode] =
    useState<'PREFER_ON_DEVICE' | 'PREFER_IN_CLOUD'>('PREFER_ON_DEVICE');
  const [promptText, setPromptText] = useState<string>(
    VISION_PRESET_CAPTURES[0].defaultPrompt
  );
  const [isInspecting, setIsInspecting] = useState(false);
  const [inspectionResult, setInspectionResult] =
    useState<VisionInspectionOutput>({
      ...REFERENCE_BASELINES.sic_scorch,
      executedPath:
        'Not Executed Yet (Showing Static Reference Baseline — Click "Run Multimodal Vision Fault Inspection")',
      actualSource: 'MODEL_UNAVAILABLE',
      inferenceSourceBadge: 'NONE',
      ttftMs: null,
      zeroCloudUpload: false,
      isReferenceBaselineOnly: true,
      errorMessage: null,
    });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const renderSyntheticFaultToCanvas = useCallback((preset: VisionPresetId) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 28) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 28) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    if (preset === 'sic_scorch') {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(50, 35, w - 100, h - 70);
      ctx.strokeStyle = '#475569';
      ctx.strokeRect(50, 35, w - 100, h - 70);

      ctx.fillStyle = '#334155';
      ctx.fillRect(85, 65, 110, 95);
      ctx.fillRect(235, 65, 110, 95);

      const grad = ctx.createRadialGradient(140, 112, 6, 140, 112, 62);
      grad.addColorStop(0, 'rgba(244, 63, 94, 0.95)');
      grad.addColorStop(0.45, 'rgba(245, 158, 11, 0.75)');
      grad.addColorStop(1, 'rgba(15, 23, 42, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(140, 112, 62, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(102, 78, 76, 68);
      ctx.fillStyle = '#22d3ee';
      ctx.font = '11px monospace';
      ctx.fillText('SYNTHETIC TEST DIAGRAM: 214.5°C [Q1_DRAIN]', 80, 60);
    } else if (preset === 'hv_arcing') {
      ctx.fillStyle = '#7c2d12';
      ctx.fillRect(60, 88, 125, 44);
      ctx.fillRect(255, 88, 125, 44);

      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(150, 58, 140, 24);

      const arcGrad = ctx.createRadialGradient(268, 92, 4, 268, 92, 48);
      arcGrad.addColorStop(0, 'rgba(56, 189, 248, 0.95)');
      arcGrad.addColorStop(0.5, 'rgba(245, 158, 11, 0.8)');
      arcGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
      ctx.fillStyle = arcGrad;
      ctx.beginPath();
      ctx.arc(268, 92, 48, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(236, 62, 66, 60);
      ctx.fillStyle = '#f59e0b';
      ctx.font = '11px monospace';
      ctx.fillText('SYNTHETIC TEST DIAGRAM: K1+ [192.0°C]', 175, 50);
    } else {
      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(40, 95);
      ctx.bezierCurveTo(150, 65, 270, 145, 400, 95);
      ctx.stroke();

      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(40, 120);
      ctx.bezierCurveTo(150, 145, 270, 65, 400, 120);
      ctx.stroke();

      ctx.fillStyle = 'rgba(244, 63, 94, 0.35)';
      ctx.fillRect(185, 72, 74, 70);
      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(185, 72, 74, 70);
      ctx.fillStyle = '#f43f5e';
      ctx.font = '11px monospace';
      ctx.fillText('SYNTHETIC TEST DIAGRAM: 65% SHIELD LOSS', 135, 62);
    }

    ctx.fillStyle = 'rgba(9, 13, 22, 0.88)';
    ctx.fillRect(0, h - 26, w, 26);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px monospace';
    ctx.fillText(
      `SYNTHETIC CANVAS TEST IMAGE · PRESET=${preset.toUpperCase()} · 440x210`,
      10,
      h - 9
    );
  }, []);

  useEffect(() => {
    if (!customImageDataUrl) {
      renderSyntheticFaultToCanvas(selectedPreset);
    }
  }, [selectedPreset, customImageDataUrl, renderSyntheticFaultToCanvas]);

  const handleSelectPreset = (preset: VisionPresetCapture) => {
    setCustomImageDataUrl(null);
    setCustomFileName(null);
    setSelectedPreset(preset.id);
    setPromptText(preset.defaultPrompt);
    setInspectionResult({
      ...REFERENCE_BASELINES[preset.id],
      executedPath:
        'Not Executed Yet (Showing Static Reference Baseline — Click "Run Multimodal Vision Fault Inspection")',
      actualSource: 'MODEL_UNAVAILABLE',
      inferenceSourceBadge: 'NONE',
      ttftMs: null,
      zeroCloudUpload: false,
      isReferenceBaselineOnly: true,
      errorMessage: null,
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCustomFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCustomImageDataUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const runMultimodalInspection = async () => {
    setIsInspecting(true);
    try {
      let base64Image = customImageDataUrl;
      if (!base64Image && canvasRef.current) {
        base64Image = canvasRef.current.toDataURL('image/png');
      }

      const result = await executeFirebaseMultimodalVision({
        presetId: selectedPreset,
        imageBase64: base64Image || '',
        mimeType: 'image/png',
        prompt: promptText,
        preferredMode:
          preferredMode === 'PREFER_IN_CLOUD'
            ? 'PREFER_IN_CLOUD'
            : 'PREFER_ON_DEVICE',
        referenceBaseline: REFERENCE_BASELINES[selectedPreset],
      });

      setInspectionResult(result);
      onVisionInspectionRecorded(result);
    } finally {
      setIsInspecting(false);
    }
  };

  return (
    <section
      aria-label="Multimodal Hardware Vision Inspection"
      className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-5"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-base font-semibold text-slate-100">
            Multimodal Hardware Vision Inspection (Upload JPEG/PNG or Use
            Synthetic Test Image)
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            100% routed via{' '}
            <span className="font-mono text-cyan-400">firebase/ai</span> (
            <span className="font-mono">InferenceMode.PREFER_ON_DEVICE</span>{' '}
            with{' '}
            <span className="font-mono">
              onDeviceParams.expectedInputs=[image,text]
            </span>{' '}
            and fallback to{' '}
            <span className="font-mono">gemini-2.5-flash-lite</span>). Built-in
            presets are synthetic HTML5 canvas test images.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-md self-start">
          <button
            type="button"
            onClick={() => setPreferredMode('PREFER_ON_DEVICE')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
              preferredMode === 'PREFER_ON_DEVICE'
                ? 'bg-cyan-500 text-slate-950 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>PREFER_ON_DEVICE</span>
          </button>
          <button
            type="button"
            onClick={() => setPreferredMode('PREFER_IN_CLOUD')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
              preferredMode === 'PREFER_IN_CLOUD'
                ? 'bg-amber-500 text-slate-950 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cloud className="w-3.5 h-3.5" />
            <span>PREFER_IN_CLOUD</span>
          </button>
        </div>
      </div>

      {/* 3 Built-In Synthetic Test Images + Custom Image Upload */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {VISION_PRESET_CAPTURES.map((preset) => {
          const isSelected =
            !customImageDataUrl && selectedPreset === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => handleSelectPreset(preset)}
              className={`text-left p-3 rounded-md border transition-colors ${
                isSelected
                  ? 'bg-slate-800/90 border-cyan-500/70 text-slate-100'
                  : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-mono text-amber-400">
                <span>{preset.dtcCode}</span>
                <span>SYNTHETIC TEST IMAGE</span>
              </div>
              <div className="text-sm font-medium text-slate-100 mt-1 truncate">
                {preset.label}
              </div>
              <div className="text-xs text-slate-400 mt-0.5 truncate">
                {preset.subtitle}
              </div>
            </button>
          );
        })}

        <label className="flex flex-col justify-center items-center p-3 rounded-md border border-dashed border-slate-700 bg-slate-950/50 hover:bg-slate-900 cursor-pointer transition-colors text-center">
          <Upload className="w-4 h-4 text-cyan-400 mb-1" />
          <span className="text-xs font-medium text-slate-200">
            Upload Real Hardware JPEG/PNG
          </span>
          <span className="text-[11px] text-slate-400 truncate max-w-full mt-0.5">
            {customFileName || 'Bench camera or microscope photo'}
          </span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileUpload}
            aria-label="Upload hardware fault JPEG or PNG"
            className="sr-only"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <div className="lg:col-span-5 flex flex-col justify-between bg-slate-950 border border-slate-800 rounded-md p-3.5 space-y-3">
          <div className="relative w-full overflow-hidden rounded border border-slate-800 bg-slate-950 flex items-center justify-center">
            {customImageDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={customImageDataUrl}
                alt={customFileName || 'Uploaded hardware fault capture'}
                referrerPolicy="no-referrer"
                className="w-full h-[210px] object-contain"
              />
            ) : (
              <canvas
                ref={canvasRef}
                width={440}
                height={210}
                data-testid="vision-fault-canvas"
                className="w-full h-[210px] block cursor-crosshair"
              />
            )}
          </div>

          <div className="space-y-2">
            <label
              htmlFor="vision-prompt-input"
              className="block text-xs font-medium text-slate-300"
            >
              Multimodal Inspection Prompt
            </label>
            <textarea
              id="vision-prompt-input"
              rows={2}
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              className="w-full rounded bg-slate-900 border border-slate-800 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
            />
            <button
              type="button"
              onClick={runMultimodalInspection}
              disabled={isInspecting}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>
                {isInspecting
                  ? 'Executing firebase/ai Multimodal Inspection...'
                  : 'Run Multimodal Vision Fault Inspection'}
              </span>
            </button>
          </div>
        </div>

        <div className="lg:col-span-7 bg-slate-950 border border-slate-800 rounded-md p-4 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="text-cyan-400 font-semibold">
                  DTC {inspectionResult.dtcCode}
                </span>
                <span aria-hidden="true">·</span>
                <span
                  className={
                    inspectionResult.severity === 'SAFE_STATE_LOCK' ||
                    inspectionResult.severity === 'CRITICAL'
                      ? 'text-rose-400 font-semibold'
                      : 'text-amber-400 font-semibold'
                  }
                >
                  {inspectionResult.severity}
                </span>
                <span aria-hidden="true">·</span>
                <span className="text-slate-400">
                  Measured TTFT:{' '}
                  {inspectionResult.ttftMs !== null
                    ? `${inspectionResult.ttftMs.toFixed(1)} ms`
                    : 'N/A (No Model Executed)'}
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-cyan-300">
                  inferenceSource: {inspectionResult.inferenceSourceBadge}
                </span>
                {inspectionResult.zeroCloudUpload ? (
                  <span className="inline-flex items-center gap-1 text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Zero Cloud Upload (ON_DEVICE)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-slate-400">
                    <Info className="w-3.5 h-3.5 text-amber-400" />
                    {inspectionResult.isReferenceBaselineOnly
                      ? 'Static Reference (No Model Ran)'
                      : 'Cloud Model Executed'}
                  </span>
                )}
              </div>
            </div>

            {inspectionResult.errorMessage && (
              <div className="bg-rose-950/40 border border-rose-700/70 rounded p-2.5 text-xs font-mono text-rose-200 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-rose-300">
                    firebase/ai Error Surface:{' '}
                  </span>
                  <span>{inspectionResult.errorMessage}</span>
                </div>
              </div>
            )}

            <div>
              <h3 className="text-sm font-semibold text-slate-100">
                {inspectionResult.faultTitle}
              </h3>
              <p className="text-xs font-mono text-slate-400 mt-0.5">
                Zone: {inspectionResult.componentZone}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 py-2 border-y border-slate-800/80">
              <div>
                <div className="text-[11px] text-slate-400">
                  Estimated Hotspot
                </div>
                <div className="text-lg font-mono font-bold text-rose-400 tabular-nums">
                  {inspectionResult.peakTempEstimateC.toFixed(1)}
                  <span className="text-xs text-slate-400 ml-1">°C</span>
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400">
                  {inspectionResult.isReferenceBaselineOnly
                    ? 'Reference Confidence (Static)'
                    : 'Model Confidence'}
                </div>
                <div className="text-lg font-mono font-bold text-cyan-400 tabular-nums">
                  {inspectionResult.confidencePct.toFixed(1)}
                  <span className="text-xs text-slate-400 ml-1">%</span>
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400">
                  firebase/ai Execution Path
                </div>
                <div className="text-xs font-mono text-slate-200 mt-1 truncate">
                  {inspectionResult.executedPath}
                </div>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div>
                <span className="font-semibold text-slate-300">
                  Optical &amp; Thermal Findings:{' '}
                </span>
                <span className="text-slate-400">
                  {inspectionResult.findings}
                </span>
              </div>
              <div>
                <span className="font-semibold text-emerald-400">
                  Post-Mortem Bench Remediation:{' '}
                </span>
                <span className="text-slate-300">
                  {inspectionResult.remediation}
                </span>
              </div>
            </div>
          </div>

          <div className="text-[11px] font-mono text-slate-400 pt-2 border-t border-slate-900">
            Every multimodal inspection is recorded into the SHA-256 Chain of
            Custody ledger with its true{' '}
            <code className="text-cyan-300">inferenceSource</code> badge.
          </div>
        </div>
      </div>
    </section>
  );
}

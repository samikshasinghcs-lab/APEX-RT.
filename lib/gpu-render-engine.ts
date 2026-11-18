export type GpuHardwareTier =
  | 'TIER_1_DISCRETE_GPU'
  | 'TIER_2_INTEGRATED_GPU'
  | 'TIER_3_SOFTWARE_RASTERIZER';

export interface GpuFingerprintProfile {
  tier: GpuHardwareTier;
  isSoftwareGl: boolean;
  unmaskedRenderer: string;
  cpuCores: number;
  rawDevicePixelRatio: number;
  effectivePixelRatio: number;
  targetFrameBudgetMs: number;
}

export interface PointerKinematicsState {
  clientX: number;
  clientY: number;
  targetNdcX: number; // -1.0 to +1.0
  targetNdcY: number; // -1.0 to +1.0
  currentNdcX: number; // damped via current += (target - current) * 0.08
  currentNdcY: number;
  velocityX: number;
  velocityY: number;
  speedMagnitude: number;
  pressure: number;
  scrollOffsetPx: number;
  scrollVelocity: number;
}

export interface AudioFftBands {
  bass: number; // 0.0 - 1.0
  mid: number; // 0.0 - 1.0
  treble: number; // 0.0 - 1.0
}

/**
 * Converts viewport pixel coordinates `(clientX, clientY)` into Normalized Device Coordinates (NDC)
 * in the range `[-1.0, +1.0]`.
 */
export function computeNormalizedDeviceCoords(
  clientX: number,
  clientY: number,
  viewportWidth: number,
  viewportHeight: number
): { ndcX: number; ndcY: number } {
  const safeW = Math.max(1, viewportWidth);
  const safeH = Math.max(1, viewportHeight);
  const ndcX = Math.max(-1, Math.min(1, (clientX / safeW) * 2 - 1));
  const ndcY = Math.max(-1, Math.min(1, -((clientY / safeH) * 2 - 1)));
  return {
    ndcX: Number(ndcX.toFixed(4)),
    ndcY: Number(ndcY.toFixed(4)),
  };
}

/**
 * Advances spring-damped pointer and scroll kinematics (`current += (target - current) * dampingFactor`)
 * with zero heap allocations inside the render loop when mutating in place.
 */
export function stepPointerKinematics(
  state: PointerKinematicsState,
  dampingFactor = 0.08
): PointerKinematicsState {
  const prevX = state.currentNdcX;
  const prevY = state.currentNdcY;

  state.currentNdcX += (state.targetNdcX - state.currentNdcX) * dampingFactor;
  state.currentNdcY += (state.targetNdcY - state.currentNdcY) * dampingFactor;

  state.velocityX = state.currentNdcX - prevX;
  state.velocityY = state.currentNdcY - prevY;
  state.speedMagnitude = Math.min(
    1.0,
    Math.hypot(state.velocityX, state.velocityY) * 14.0
  );
  state.scrollVelocity *= 0.9;

  return state;
}

/**
 * Classifies a WebGL renderer string, CPU core count, and devicePixelRatio into a hardware tier
 * and caps effective pixel ratio to prevent 4K/Retina overdraw or software-WebGL stalls.
 */
export function classifyGpuHardwareFromRenderer(
  rendererString: string,
  cpuCores: number,
  devicePixelRatio: number
): GpuFingerprintProfile {
  const isSoftwareGl =
    /SwiftShader|llvmpipe|softpipe|Software|Basic Render|Microsoft Basic/i.test(
      rendererString
    );

  const isDiscrete =
    !isSoftwareGl &&
    /NVIDIA|GeForce|RTX|GTX|Radeon RX|Radeon Pro|Apple M[1-9]\s*(Pro|Max|Ultra)/i.test(
      rendererString
    );

  const tier: GpuHardwareTier = isSoftwareGl
    ? 'TIER_3_SOFTWARE_RASTERIZER'
    : isDiscrete
    ? 'TIER_1_DISCRETE_GPU'
    : 'TIER_2_INTEGRATED_GPU';

  const effectivePixelRatio = isSoftwareGl
    ? 1.0
    : Math.min(Math.max(1.0, devicePixelRatio || 1.0), 2.0);

  const targetFrameBudgetMs = tier === 'TIER_1_DISCRETE_GPU' ? 8.3 : 16.6;

  return {
    tier,
    isSoftwareGl,
    unmaskedRenderer: rendererString || 'WebGL2 Renderer',
    cpuCores: Math.max(1, cpuCores || 4),
    rawDevicePixelRatio: Number((devicePixelRatio || 1).toFixed(2)),
    effectivePixelRatio: Number(effectivePixelRatio.toFixed(2)),
    targetFrameBudgetMs,
  };
}

/**
 * Probes the browser's WebGL2 context (`WEBGL_debug_renderer_info`), `navigator.hardwareConcurrency`,
 * and `window.devicePixelRatio`, immediately releasing the temporary probe context.
 */
export function probeClientGpuHardware(): GpuFingerprintProfile {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return classifyGpuHardwareFromRenderer('SSR_STANDBY', 4, 1.0);
  }
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) {
      return classifyGpuHardwareFromRenderer(
        'Software Fallback (No WebGL)',
        navigator.hardwareConcurrency || 4,
        window.devicePixelRatio || 1
      );
    }
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpuString = String(gl.getParameter(param) || 'WebGL2 GPU');
    gl.getExtension('WEBGL_lose_context')?.loseContext();

    return classifyGpuHardwareFromRenderer(
      gpuString,
      navigator.hardwareConcurrency || 4,
      window.devicePixelRatio || 1
    );
  } catch {
    return classifyGpuHardwareFromRenderer(
      'WebGL2 Standard Context',
      4,
      1.0
    );
  }
}

/**
 * Synthesizes a spatialized Web Audio micro-click using `AudioContext`, `OscillatorNode`,
 * `StereoPannerNode` (mapped to Normalized Device Coordinate `ndcX`), and `GainNode`,
 * plus optional mobile tactile haptics (`navigator.vibrate(10)`).
 */
export function triggerSpatialUiFeedback(params: {
  ndcX: number;
  frequencyHz?: number;
  enableAudio?: boolean;
  enableHaptics?: boolean;
}): void {
  if (typeof window === 'undefined') return;

  if (params.enableHaptics !== false && 'vibrate' in navigator) {
    try {
      navigator.vibrate?.(10);
    } catch {
      // Ignore if vibration is blocked prior to user gesture
    }
  }

  if (!params.enableAudio) return;

  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(params.frequencyHz ?? 640, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(
      220,
      ctx.currentTime + 0.045
    );

    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.045);

    if (panner) {
      panner.pan.setValueAtTime(
        Math.max(-1, Math.min(1, params.ndcX || 0)),
        ctx.currentTime
      );
      osc.connect(panner);
      panner.connect(gain);
    } else {
      osc.connect(gain);
    }

    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.05);
    osc.onended = () => {
      ctx.close().catch(() => null);
    };
  } catch {
    // Ignore audio context autoplay restrictions
  }
}

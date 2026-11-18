'use client';

import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import {
  GpuFingerprintProfile,
  PointerKinematicsState,
  computeNormalizedDeviceCoords,
  stepPointerKinematics,
  probeClientGpuHardware,
} from '@/lib/gpu-render-engine';
import type { SafetySeverity } from '@/lib/adaptive-router';

export interface GpuCanvasBridgeHandle {
  exportShaderFramePng: () => Promise<boolean>;
  getCurrentKinematics: () => PointerKinematicsState;
}

interface GpuTelemetryCanvasBridgeProps {
  severity: SafetySeverity;
  onHardwareProfileReady?: (profile: GpuFingerprintProfile) => void;
  onKinematicsSample?: (sample: {
    ndcX: number;
    ndcY: number;
    speed: number;
    fpsEstimate: number;
  }) => void;
}

const VERTEX_SHADER_SRC = `#version 300 es
in vec2 a_position;
out vec2 v_uv;

void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER_SRC = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;

uniform vec2 u_resolution;
uniform float u_time;
uniform vec2 u_pointerNdc;
uniform float u_velocity;
uniform float u_severity;

// Hash & 2D value noise for procedural QNX SiC thermal field
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

void main() {
  vec2 aspect = vec2(u_resolution.x / max(1.0, u_resolution.y), 1.0);
  vec2 ndc = (v_uv * 2.0 - 1.0) * aspect;
  vec2 ptr = u_pointerNdc * aspect;

  // Precision telemetry grid lines
  vec2 gridUv = v_uv * u_resolution / 44.0;
  vec2 gridDist = abs(fract(gridUv - 0.5) - 0.5) / fwidth(gridUv);
  float gridLine = 1.0 - min(min(gridDist.x, gridDist.y), 1.0);

  // Cursor proximity & damped spring ripple
  float distToPtr = length(ndc - ptr);
  float cursorGlow = exp(-distToPtr * (3.2 - min(1.5, u_velocity * 1.4)));
  float wave = sin(distToPtr * 18.0 - u_time * 3.0) * exp(-distToPtr * 4.5) * (0.25 + u_velocity * 0.5);

  // Subtle noise field
  float n = valueNoise(ndc * 2.8 + vec2(u_time * 0.08, -u_time * 0.05));

  // Base obsidian laboratory background (#07090E)
  vec3 baseObsidian = vec3(0.027, 0.035, 0.055);
  vec3 cyanTelemetry = vec3(0.024, 0.714, 0.831);
  vec3 roseFault = vec3(0.957, 0.247, 0.369);
  vec3 accentColor = mix(cyanTelemetry, roseFault, clamp(u_severity * 0.65, 0.0, 1.0));

  vec3 col = baseObsidian;
  col += cyanTelemetry * gridLine * 0.038;
  col += accentColor * cursorGlow * 0.11;
  col += cyanTelemetry * max(0.0, wave) * 0.08;
  col += accentColor * n * 0.022;

  outColor = vec4(col, 1.0);
}
`;

function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

const GpuTelemetryCanvasBridge = forwardRef<
  GpuCanvasBridgeHandle,
  GpuTelemetryCanvasBridgeProps
>(function GpuTelemetryCanvasBridge(
  { severity, onHardwareProfileReady, onKinematicsSample },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const severityRef = useRef<SafetySeverity>(severity);
  const hardwareProfileRef = useRef<GpuFingerprintProfile | null>(null);
  const renderOnceRef = useRef<(() => void) | null>(null);

  const kinematicsRef = useRef<PointerKinematicsState>({
    clientX: 0,
    clientY: 0,
    targetNdcX: 0,
    targetNdcY: 0,
    currentNdcX: 0,
    currentNdcY: 0,
    velocityX: 0,
    velocityY: 0,
    speedMagnitude: 0,
    pressure: 0.5,
    scrollOffsetPx: 0,
    scrollVelocity: 0,
  });

  useEffect(() => {
    severityRef.current = severity;
  }, [severity]);

  useImperativeHandle(ref, () => ({
    getCurrentKinematics: () => kinematicsRef.current,
    exportShaderFramePng: async () => {
      const canvas = canvasRef.current;
      if (!canvas) return false;
      // Ensure buffer has a freshly rendered frame right before toBlob()
      renderOnceRef.current?.();
      return new Promise<boolean>((resolve) => {
        canvas.toBlob((blob) => {
          if (!blob) {
            resolve(false);
            return;
          }
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `qnx-sentinel-gpu-frame-${Date.now()}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          resolve(true);
        }, 'image/png');
      });
    },
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const profile = probeClientGpuHardware();
    hardwareProfileRef.current = profile;
    onHardwareProfileReady?.(profile);

    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: !profile.isSoftwareGl,
      depth: false,
      stencil: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false,
    });

    if (!gl) return;

    const vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SRC);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SRC);
    if (!vs || !fs) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      return;
    }

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    const posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );

    const posLoc = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const uResolution = gl.getUniformLocation(program, 'u_resolution');
    const uTime = gl.getUniformLocation(program, 'u_time');
    const uPointerNdc = gl.getUniformLocation(program, 'u_pointerNdc');
    const uVelocity = gl.getUniformLocation(program, 'u_velocity');
    const uSeverity = gl.getUniformLocation(program, 'u_severity');

    const updateCanvasSize = () => {
      const dpr = profile.effectivePixelRatio;
      const w = Math.max(1, Math.floor(window.innerWidth * dpr));
      const h = Math.max(1, Math.floor(window.innerHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    };
    updateCanvasSize();

    const resizeObserver = new ResizeObserver(() => {
      updateCanvasSize();
    });
    resizeObserver.observe(document.documentElement);

    const handlePointerMove = (e: PointerEvent) => {
      const k = kinematicsRef.current;
      k.clientX = e.clientX;
      k.clientY = e.clientY;
      k.pressure = e.pressure || 0.5;
      const ndc = computeNormalizedDeviceCoords(
        e.clientX,
        e.clientY,
        window.innerWidth,
        window.innerHeight
      );
      k.targetNdcX = ndc.ndcX;
      k.targetNdcY = ndc.ndcY;
    };

    const handleScroll = () => {
      const k = kinematicsRef.current;
      const nextScroll = window.scrollY || 0;
      k.scrollVelocity = Math.min(
        1.0,
        Math.abs(nextScroll - k.scrollOffsetPx) / 60.0
      );
      k.scrollOffsetPx = nextScroll;
    };

    window.addEventListener('pointermove', handlePointerMove, {
      passive: true,
    });
    window.addEventListener('scroll', handleScroll, { passive: true });

    const startTime = performance.now();
    let lastFrameTime = startTime;
    let frameId = 0;
    let sampleCounter = 0;
    let contextLost = false;

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      contextLost = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
    };
    const handleContextRestored = () => {
      contextLost = false;
      updateCanvasSize();
    };

    canvas.addEventListener('webglcontextlost', handleContextLost);
    canvas.addEventListener('webglcontextrestored', handleContextRestored);

    const drawFrame = () => {
      if (contextLost) return;
      const now = performance.now();
      const dtMs = Math.max(1, now - lastFrameTime);
      lastFrameTime = now;

      const k = stepPointerKinematics(kinematicsRef.current, 0.08);
      const sevFloat =
        severityRef.current === 'SAFE_STATE_LOCK'
          ? 1.0
          : severityRef.current === 'CRITICAL'
          ? 0.75
          : severityRef.current === 'WARNING'
          ? 0.4
          : 0.0;

      gl.useProgram(program);
      gl.bindVertexArray(vao);
      gl.uniform2f(uResolution, canvas.width, canvas.height);
      gl.uniform1f(uTime, (now - startTime) * 0.001);
      gl.uniform2f(uPointerNdc, k.currentNdcX, k.currentNdcY);
      gl.uniform1f(
        uVelocity,
        Math.min(1.0, k.speedMagnitude + k.scrollVelocity)
      );
      gl.uniform1f(uSeverity, sevFloat);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      // Update CSS Custom Properties for DOM coupling every 4th frame
      sampleCounter++;
      if (sampleCounter % 4 === 0) {
        const rootStyle = document.documentElement.style;
        rootStyle.setProperty('--cursor-ndc-x', k.currentNdcX.toFixed(3));
        rootStyle.setProperty('--cursor-ndc-y', k.currentNdcY.toFixed(3));
        rootStyle.setProperty('--pointer-velocity', k.speedMagnitude.toFixed(3));
        onKinematicsSample?.({
          ndcX: Number(k.currentNdcX.toFixed(2)),
          ndcY: Number(k.currentNdcY.toFixed(2)),
          speed: Number(k.speedMagnitude.toFixed(2)),
          fpsEstimate: Math.min(120, Math.round(1000 / dtMs)),
        });
      }
    };

    renderOnceRef.current = drawFrame;

    // Software-WebGL fenceSync pacing (`afterDraw`) so headless/VDI browsers never stall
    function afterDraw(cb: () => void) {
      if (!gl || contextLost) return;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (!gl || contextLost) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      drawFrame();
      if (profile.isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    tick();

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('scroll', handleScroll);
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      canvas.removeEventListener('webglcontextrestored', handleContextRestored);
      gl.deleteBuffer(posBuffer);
      gl.deleteVertexArray(vao);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, [onHardwareProfileReady, onKinematicsSample]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-testid="gpu-telemetry-shader-canvas"
      className="fixed inset-0 w-full h-full pointer-events-none z-0"
    />
  );
});

export default GpuTelemetryCanvasBridge;

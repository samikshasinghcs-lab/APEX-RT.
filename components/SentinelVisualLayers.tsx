'use client';

import { useEffect, useRef, useState } from 'react';

const tracks = [
  { id: '01', title: 'PPS Stream', detail: 'Amplitude-modulated telemetry waveform', kind: 'wave' },
  { id: '02', title: 'PII Airlock', detail: 'Two-stage signal isolation', kind: 'blocks' },
  { id: '03', title: 'Hybrid Router', detail: 'Edge / cloud inference paths', kind: 'router' },
  { id: '04', title: 'Safe Torque Off', detail: '<50µs watchdog envelope', kind: 'radar' },
] as const;

function TrackCanvas({ kind }: { kind: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    let raf = 0;
    let time = 0;
    let alive = true;
    const draw = () => {
      if (!alive) return;
      const w = canvas.clientWidth || 280;
      const h = 74;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      time += 0.018;
      ctx.lineWidth = 1.5;
      if (kind === 'wave') {
        ctx.strokeStyle = '#52A8FF'; ctx.beginPath();
        for (let x = 0; x <= w; x += 2) {
          const amp = 12 + 11 * (0.5 + 0.5 * Math.sin(x * 0.009 - time));
          const y = h / 2 + Math.sin(x * 0.055 - time * 2.5) * amp;
          x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        } ctx.stroke();
      } else if (kind === 'blocks') {
        for (let row = 0; row < 2; row++) for (let i = 0; i < 24; i++) {
          ctx.globalAlpha = 0.18 + 0.7 * (0.5 + 0.5 * Math.sin(time * 2 + i * 0.38 + row * 1.7));
          ctx.fillStyle = row ? '#62C073' : '#6366F1';
          ctx.fillRect(4 + i * (w - 12) / 24, 12 + row * 28, Math.max(2, (w - 24) / 38), 14);
        } ctx.globalAlpha = 1;
      } else if (kind === 'router') {
        for (let row = 0; row < 2; row++) {
          ctx.strokeStyle = row ? '#6366F1' : '#52A8FF'; ctx.globalAlpha = 0.9;
          ctx.beginPath();
          for (let x = 0; x <= w; x += 3) {
            const y = 20 + row * 32 + Math.sin(x * 0.035 - time * (row ? 1.2 : 1.8)) * 8;
            x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
          } ctx.stroke();
        } ctx.globalAlpha = 1;
      } else {
        const x = w / 2, y = h / 2, r = 25;
        ctx.strokeStyle = 'rgba(255,255,255,.16)'; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.stroke();
        ctx.strokeStyle = '#62C073'; ctx.beginPath(); ctx.arc(x,y,r,-Math.PI/2,-Math.PI/2 + (time % (Math.PI*2))); ctx.stroke();
        ctx.fillStyle = '#52A8FF'; ctx.beginPath(); ctx.arc(x + Math.cos(time*1.7)*r, y + Math.sin(time*1.7)*r, 2.5, 0, Math.PI*2); ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { alive = false; cancelAnimationFrame(raf); };
  }, [kind]);
  return <canvas ref={ref} className="sentinel-track-canvas" aria-hidden="true" />;
}

export function SubsystemGrid() {
  return <section className="sentinel-subsystems" aria-label="Sentinel subsystems">
    {tracks.map((track) => <article className="sentinel-subsystem" key={track.id}>
      <div className="sentinel-subsystem-top"><span>{track.id} / TRACK</span><span className="sentinel-live-dot" /></div>
      <TrackCanvas kind={track.kind} />
      <h3>{track.title}</h3><p>{track.detail}</p>
    </article>)}
  </section>;
}

export function UsbBridge() {
  const [connected, setConnected] = useState(false);
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    if (!connected) { setProgress(0); return; }
    const timers = [setTimeout(() => setProgress(1), 350), setTimeout(() => setProgress(2), 850), setTimeout(() => setProgress(3), 1400)];
    return () => timers.forEach(clearTimeout);
  }, [connected]);
  return <section id="qnx-target-bridge" className="sentinel-usb-bridge">
    <div className="sentinel-section-kicker">HARDWARE INTERFACE / 05</div>
    <div className="sentinel-usb-layout">
      <div><h2>QNX Neutrino<br/><span>Hardware Bridge</span></h2><p>Connect the diagnostic session to the target interface and inspect the Safe Torque Off watchdog channel.</p>
        <button className="sentinel-square-button" type="button" onClick={() => setConnected(v => !v)}>{connected ? 'Disconnect Target' : 'Plug Into Target Port'} <span>↗</span></button>
      </div>
      <div className={`sentinel-port-panel ${connected ? 'is-connected' : ''}`}>
        <div className="sentinel-port-head"><span>TARGET PORT / USB-C</span><span>{connected ? 'LINK ESTABLISHED' : 'AWAITING CONNECTION'}</span></div>
        <button className="sentinel-usb-connector" type="button" onClick={() => setConnected(v => !v)} aria-label={connected ? 'Disconnect USB-C connector' : 'Connect USB-C connector'}>
          <span className="sentinel-usb-tip" /><span className="sentinel-usb-cable" />
        </button>
        <div className="sentinel-port-socket"><span /></div>
        <div className="sentinel-signal-trace"><i style={{ transform: `scaleX(${progress / 3})` }} /></div>
        <div className="sentinel-register-grid">
          <div><small>INTERFACE</small><strong>{connected ? 'USB-C / QNX' : 'STANDBY'}</strong></div>
          <div><small>HANDSHAKE</small><strong>{progress >= 1 ? 'VERIFIED' : '—'}</strong></div>
          <div><small>STO WATCHDOG</small><strong>{progress >= 2 ? '<50µs' : 'LOCKED'}</strong></div>
          <div><small>REGISTER READ</small><strong>{progress >= 3 ? '0x00A7 / SAFE' : 'AWAITING LINK'}</strong></div>
        </div>
        <p className="sentinel-bridge-note">Interactive target-link sequence · UI register demonstration</p>
      </div>
    </div>
  </section>;
}

export function TravellingDebugCable() {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        const p = Math.min(1, Math.max(0, window.scrollY / max));
        if (ref.current) {
          ref.current.style.transform = `translate3d(${12 + p * 68}vw,${p * 72}vh,0) rotate(${-18 + p * 205}deg)`;
          ref.current.style.opacity = String(p > .92 ? 0 : .72);
        }
      });
    };
    window.addEventListener('scroll', update, { passive: true }); update();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('scroll', update); };
  }, []);
  return <svg ref={ref} className="sentinel-travelling-cable" viewBox="0 0 180 42" aria-hidden="true">
    <path d="M8 21 C35 3 60 39 88 21 S140 3 160 21" fill="none" stroke="#6366F1" strokeWidth="7" strokeLinecap="round"/>
    <path d="M8 21 C35 3 60 39 88 21 S140 3 160 21" fill="none" stroke="#52A8FF" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 5"/>
    <rect x="151" y="10" width="24" height="22" rx="3" fill="#B8C4D8" stroke="#52A8FF"/>
    <rect x="172" y="15" width="7" height="12" rx="1" fill="#E5E7EB"/>
  </svg>;
}

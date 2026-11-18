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
    const connectFromCable = () => setConnected(true);
    window.addEventListener('sentinel-usb-connect', connectFromCable);
    return () => window.removeEventListener('sentinel-usb-connect', connectFromCable);
  }, []);
  useEffect(() => {
    if (!connected) return;
    const timers = [setTimeout(() => setProgress(1), 350), setTimeout(() => setProgress(2), 850), setTimeout(() => setProgress(3), 1400)];
    return () => timers.forEach(clearTimeout);
  }, [connected]);
  return <section id="qnx-target-bridge" className="sentinel-usb-bridge">
    <div className="sentinel-section-kicker">HARDWARE INTERFACE / 05</div>
    <div className="sentinel-usb-layout">
      <div><h2>QNX Neutrino<br/><span>Hardware Bridge</span></h2><p>Connect the diagnostic session to the target interface and inspect the Safe Torque Off watchdog channel.</p>
        <button className="sentinel-square-button" type="button" onClick={() => { setProgress(0); setConnected(v => !v); }}>{connected ? 'Disconnect Target' : 'Plug Into Target Port'} <span>↗</span></button>
      </div>
      <div className={`sentinel-port-panel ${connected ? 'is-connected' : ''}`}>
        <div className="sentinel-port-head"><span>TARGET PORT / USB-C</span><span>{connected ? 'LINK ESTABLISHED' : 'AWAITING CONNECTION'}</span></div>
        <button className="sentinel-usb-connector" type="button" onClick={() => { setProgress(0); setConnected(v => !v); }} aria-label={connected ? 'Disconnect USB-C connector' : 'Connect USB-C connector'}>
          <span className="sentinel-usb-tip" /><span className="sentinel-usb-cable" />
        </button>
        <div id="sentinel-usb-socket" className="sentinel-port-socket" aria-label="USB-C target socket"><span /></div>
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
  const [dragging, setDragging] = useState(false);
  const [plugged, setPlugged] = useState(false);
  const position = useRef({ x: 28, y: Math.round(typeof window === 'undefined' ? 240 : window.innerHeight * .36) });
  const pointer = useRef({ id: -1, x: 0, y: 0 });
  const raf = useRef(0);

  const paint = (x: number, y: number) => {
    position.current = { x, y };
    if (ref.current) {
      ref.current.style.left = `${x}px`;
      ref.current.style.top = `${y}px`;
      ref.current.style.transform = 'none';
    }
  };

  const onPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (plugged) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    setDragging(true);
    event.currentTarget.classList.add('is-dragging');
  };

  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!dragging || pointer.current.id !== event.pointerId) return;
    event.preventDefault();
    const dx = event.clientX - pointer.current.x;
    const dy = event.clientY - pointer.current.y;
    pointer.current = { ...pointer.current, x: event.clientX, y: event.clientY };
    const nextX = Math.max(-130, Math.min(window.innerWidth - 40, position.current.x + dx));
    const nextY = Math.max(8, Math.min(window.innerHeight - 50, position.current.y + dy));
    paint(nextX, nextY);
    // Pulling the lead physically scrolls the workbench along with it.
    if (Math.abs(dy) > 0) window.scrollBy({ top: dy * 1.15, behavior: 'instant' as ScrollBehavior });
  };

  const onPointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    if (pointer.current.id !== event.pointerId) return;
    pointer.current.id = -1;
    setDragging(false);
    event.currentTarget.classList.remove('is-dragging');
    const socket = document.getElementById('sentinel-usb-socket');
    const bounds = socket?.getBoundingClientRect();
    const plugX = position.current.x + 178;
    const plugY = position.current.y + 21;
    const hit = !!bounds && plugX >= bounds.left - 26 && plugX <= bounds.right + 26 && plugY >= bounds.top - 26 && plugY <= bounds.bottom + 26;
    if (hit && bounds) {
      const targetX = bounds.right - 180;
      const targetY = bounds.top + bounds.height / 2 - 21;
      paint(targetX, targetY);
      setPlugged(true);
      window.dispatchEvent(new Event('sentinel-usb-connect'));
    } else {
      // Keep the cable where it was released so the user can try again.
      paint(position.current.x, position.current.y);
    }
  };

  const resetCable = () => {
    setPlugged(false);
    paint(28, Math.max(80, window.innerHeight * .36));
    window.dispatchEvent(new Event('sentinel-usb-disconnect'));
  };

  useEffect(() => {
    paint(28, Math.max(80, window.innerHeight * .36));
  }, []);

  return <>
    <div className={`sentinel-cable-hint ${dragging ? 'is-active' : ''} ${plugged ? 'is-done' : ''}`} aria-live="polite">
      {plugged ? 'TARGET LINK CONNECTED' : dragging ? 'PULL THE LEAD · SCROLL TO TARGET' : 'GRAB THE USB-C PLUG · DRAG TO SCROLL'}
    </div>
    <svg
      ref={ref}
      className={`sentinel-travelling-cable ${dragging ? 'is-dragging' : ''} ${plugged ? 'is-plugged' : ''}`}
      viewBox="0 0 180 42"
      role="img"
      aria-label="Draggable USB-C cable. Drag it down the page and drop the connector into the target socket."
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{ left: 28, top: '36vh', pointerEvents: plugged ? 'none' : 'auto', touchAction: 'none', cursor: dragging ? 'grabbing' : 'grab' }}
    >
      <path d="M8 21 C35 3 60 39 88 21 S140 3 160 21" fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round"/>
      <path d="M8 21 C35 3 60 39 88 21 S140 3 160 21" fill="none" stroke="#777" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 5"/>
      <rect x="151" y="10" width="24" height="22" rx="3" fill="#b8b8b8" stroke="#fff"/>
      <rect x="172" y="15" width="7" height="12" rx="1" fill="#fff"/>
    </svg>
    {plugged && <button type="button" className="sentinel-cable-reset" onClick={resetCable}>UNPLUG ↺</button>}
  </>;
}

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
    if (!connected) return;
    const timers = [
      setTimeout(() => setProgress(1), 280),
      setTimeout(() => setProgress(2), 720),
      setTimeout(() => setProgress(3), 1150),
    ];
    return () => timers.forEach(clearTimeout);
  }, [connected]);
  const connect = () => { setProgress(0); setConnected((v) => !v); };
  return <section id="qnx-target-bridge" className="sentinel-usb-bridge">
    <div className="sentinel-section-kicker">HARDWARE INTERFACE / 05 · QNX NEUTRINO</div>
    <div className="sentinel-dock-heading">
      <h2>QNX Neutrino <span>Hardware Bridge</span></h2>
      <p>Establish a secure target link and inspect the Safe Torque Off watchdog register.</p>
    </div>
    <div className={`sentinel-hardware-dock ${connected ? 'is-connected' : ''}`}>
      <div className="sentinel-dock-status"><span>PORT / USB-C · /qnx-target/</span><strong>{connected ? 'LINK ESTABLISHED' : 'AWAITING CONNECTION'}</strong></div>
      <svg className="sentinel-dock-illustration" viewBox="0 0 900 300" role="img" aria-label="USB-C connector aligned with QNX Neutrino hardware port">
        <defs>
          <linearGradient id="dock-metal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f7fbff"/><stop offset=".25" stopColor="#747f91"/><stop offset=".55" stopColor="#d8e0ed"/><stop offset="1" stopColor="#424a59"/></linearGradient>
          <linearGradient id="dock-body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#34394a"/><stop offset=".48" stopColor="#11141d"/><stop offset="1" stopColor="#05070d"/></linearGradient>
          <filter id="dock-glow"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        <g className="dock-circuit-traces" fill="none" strokeWidth="2">
          <path d="M60 80H270L330 130H485M60 220H270L330 170H485" stroke="#6366F1" opacity=".75"/>
          <path d="M840 80H690L635 130H540M840 220H690L635 170H540" stroke="#52A8FF" opacity=".7"/>
          <path d="M100 150H280M620 150H800" stroke="#62C073" strokeDasharray="4 9"/>
          <circle cx="60" cy="80" r="5" fill="#6366F1"/><circle cx="60" cy="220" r="5" fill="#52A8FF"/><circle cx="840" cy="80" r="5" fill="#52A8FF"/><circle cx="840" cy="220" r="5" fill="#6366F1"/>
        </g>
        <g className="dock-port">
          <rect x="485" y="94" width="120" height="112" rx="18" fill="#080b13" stroke="#69758b" strokeWidth="3"/>
          <rect x="508" y="126" width="76" height="48" rx="15" fill="#02040a" stroke="#aab5c8" strokeWidth="3"/>
          <rect x="522" y="140" width="48" height="20" rx="8" fill="#1b2435"/>
          <path d="M530 150h32" stroke="#6366F1" strokeWidth="3"/>
          <text x="545" y="232" fill="#9da9bf" fontSize="11" textAnchor="middle" letterSpacing="2">TARGET PORT</text>
        </g>
        <g className="dock-plug" onClick={connect} role="button" aria-label={connected ? 'Disconnect hardware bridge' : 'Connect USB-C hardware bridge'} tabIndex={0}>
          <path d="M40 150H190" stroke="#080a10" strokeWidth="34" strokeLinecap="round"/>
          <path d="M40 143H190" stroke="#515b70" strokeWidth="25" strokeLinecap="round"/>
          <path d="M40 137H190" stroke="#9ca8bd" strokeWidth="3" strokeLinecap="round" opacity=".65"/>
          <rect x="168" y="105" width="210" height="90" rx="20" fill="url(#dock-body)" stroke="#818da2" strokeWidth="2"/>
          <path d="M188 116h160" stroke="#cbd5e1" strokeOpacity=".2" strokeWidth="2"/>
          <text x="270" y="155" fill="#dce5f3" fontSize="12" textAnchor="middle" letterSpacing="3">SENTINEL LINK</text>
          <rect x="365" y="126" width="150" height="48" rx="13" fill="url(#dock-metal)" stroke="#fff" strokeWidth="2"/>
          <rect x="480" y="135" width="44" height="30" rx="10" fill="#141a26" stroke="#d9e2f0" strokeWidth="2"/>
          <rect x="488" y="142" width="29" height="16" rx="7" fill="#05070d" stroke="#9ba8bb"/>
        </g>
        <text x="270" y="220" fill="#818da2" fontSize="10" textAnchor="middle" letterSpacing="2">USB-C · ANODIZED ALLOY</text>
      </svg>
      <div className="sentinel-dock-controls">
        <button type="button" className="sentinel-square-button" onClick={connect}>{connected ? 'DISCONNECT HARDWARE BRIDGE' : 'CONNECT HARDWARE BRIDGE'} <span>↗</span></button>
        <div className="sentinel-dock-readout">
          <div><small>HANDSHAKE</small><strong>{progress >= 1 ? 'VERIFIED' : connected ? 'NEGOTIATING' : 'STANDBY'}</strong></div>
          <div><small>SAFE TORQUE OFF</small><strong>{progress >= 2 ? '<50µs' : 'LOCKED'}</strong></div>
          <div><small>REGISTER READ</small><strong>{progress >= 3 ? '0x00A7 / SAFE' : 'AWAITING LINK'}</strong></div>
        </div>
      </div>
      <div className="sentinel-dock-foot"><span>QNX NEUTRINO · /qnx-target/</span><span>{connected ? 'SIMULATED TARGET SESSION' : 'CLICK PLUG OR CONNECT BUTTON'}</span></div>
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
      <><span className="sentinel-cable-hint-icon" aria-hidden="true">↓</span><span>{dragging ? 'KEEP PULLING · SCROLL TO HARDWARE BRIDGE' : 'DRAG PLUG DOWN · SCROLL · DROP INTO SOCKET'}</span><span className="sentinel-cable-hint-step">01 / CONNECT</span></>
    </div>
    <svg
      ref={ref}
      className={`sentinel-travelling-cable ${dragging ? 'is-dragging' : ''} ${plugged ? 'is-plugged' : ''}`}
      viewBox="0 0 190 54"
      role="img"
      aria-label="Draggable USB-C cable. Drag it down the page and drop the connector into the target socket."
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{ left: 28, top: '36vh', pointerEvents: plugged ? 'none' : 'auto', touchAction: 'none', cursor: dragging ? 'grabbing' : 'grab' }}
    >
      <defs>
        <linearGradient id="usb-metal-polish" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff"/><stop offset=".45" stopColor="#aeb4c2"/><stop offset=".72" stopColor="#f7f8fb"/><stop offset="1" stopColor="#686f7d"/></linearGradient>
        <linearGradient id="usb-cable-dark" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#777783"/><stop offset=".5" stopColor="#292932"/><stop offset="1" stopColor="#09090d"/></linearGradient>
      </defs>
      <path d="M5 27 C30 4 53 49 81 27 S130 5 159 27" fill="none" stroke="#050508" strokeWidth="13" strokeLinecap="round"/>
      <path d="M5 25 C30 2 53 47 81 25 S130 3 159 25" fill="none" stroke="url(#usb-cable-dark)" strokeWidth="9" strokeLinecap="round"/>
      <path d="M8 23 C31 5 54 44 81 23 S130 7 158 23" fill="none" stroke="#c5c5d0" strokeOpacity=".5" strokeWidth="1.3" strokeLinecap="round"/>
      <rect x="143" y="13" width="25" height="28" rx="6" fill="#17171e" stroke="#777987" strokeWidth="1.4"/>
      <rect x="151" y="16" width="30" height="22" rx="5" fill="url(#usb-metal-polish)" stroke="#fff" strokeWidth="1"/>
      <rect x="176" y="20" width="13" height="14" rx="5" fill="#343741" stroke="#e8ebf2" strokeWidth="1.4"/>
      <rect x="179" y="23" width="8" height="8" rx="3.5" fill="#090a0e" stroke="#aeb4c2" strokeWidth=".8"/>
    </svg>
    {plugged && <button type="button" className="sentinel-cable-reset" onClick={resetCable}>UNPLUG ↺</button>}
  </>;
}

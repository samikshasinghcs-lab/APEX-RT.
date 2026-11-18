'use client';

import { useEffect, useRef, useState } from 'react';

const engines = [
  { title: 'Adaptive telemetry routing', copy: 'Routes diagnostic payloads across edge and cloud paths while respecting latency, privacy and operating constraints.', kind: 'wave' },
  { title: 'PII airlock & signal cleanup', copy: 'Sanitizes sensitive identifiers before dispatch and keeps the diagnostic signal intact for downstream analysis.', kind: 'blocks' },
  { title: 'Multilingual fault intelligence', copy: 'Interprets automotive and industrial fault language across supported locales without losing diagnostic context.', kind: 'stems' },
  { title: 'Post-mortem context engine', copy: 'Connects telemetry, fault codes and evidence into a traceable investigation context for engineering teams.', kind: 'ring' },
] as const;

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);
  return reduced;
}

function RibbonCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl', { alpha: true, antialias: true });
    let frame = 0, raf = 0, alive = true;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.6);
      canvas.width = Math.floor(canvas.clientWidth * dpr);
      canvas.height = Math.floor(canvas.clientHeight * dpr);
      if (gl) gl.viewport(0, 0, canvas.width, canvas.height);
    };
    let program: WebGLProgram | null = null;
    if (gl) {
      const vertex = gl.createShader(gl.VERTEX_SHADER)!;
      gl.shaderSource(vertex, 'attribute vec2 p; void main(){ gl_Position=vec4(p,0.0,1.0); }');
      gl.compileShader(vertex);
      const fragment = gl.createShader(gl.FRAGMENT_SHADER)!;
      gl.shaderSource(fragment, `
        precision highp float; uniform vec2 r; uniform float t;
        float band(float y,float c,float w){return 1.0-smoothstep(w*0.25,w,abs(y-c));}
        void main(){
          vec2 uv=gl_FragCoord.xy/r; float x=uv.x; float tm=t*0.22;
          float a=0.48+0.12*sin(x*7.0+tm)+0.055*sin(x*17.0-tm*1.4);
          float b=0.57+0.10*sin(x*5.2-tm*0.8+1.9)+0.045*sin(x*14.0+tm);
          float c=0.40+0.09*sin(x*6.3+tm*0.7+4.0)+0.05*sin(x*19.0-tm);
          float wa=band(uv.y,a,0.055); float wb=band(uv.y,b,0.052); float wc=band(uv.y,c,0.047);
          vec3 col=vec3(0.388,0.4,0.945)*wa+vec3(0.52,0.28,0.95)*wb+vec3(0.12,0.72,0.88)*wc;
          float glow=exp(-abs(uv.y-0.5)*5.0)*0.07;
          col+=vec3(0.28,0.3,0.9)*glow;
          float alpha=clamp(max(max(wa,wb),wc)*0.7+glow,0.0,0.72);
          gl_FragColor=vec4(col,alpha);
        }`);
      gl.compileShader(fragment);
      program = gl.createProgram()!;
      gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
      const buffer=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
      gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
      gl.useProgram(program);
      const loc=gl.getAttribLocation(program,'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
    }
    const ctx = !gl ? canvas.getContext('2d') : null;
    const draw = (now:number) => {
      if (!alive) return;
      frame=now/1000;
      if(gl && program){
        gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT);
        gl.uniform2f(gl.getUniformLocation(program,'r'),canvas.width,canvas.height);
        gl.uniform1f(gl.getUniformLocation(program,'t'),frame);
        gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
      } else if(ctx){
        const w=canvas.width,h=canvas.height; ctx.clearRect(0,0,w,h);
        const colors=['rgba(99,102,241,.68)','rgba(139,92,246,.58)','rgba(34,211,238,.5)'];
        for(let k=0;k<3;k++){ctx.beginPath(); for(let x=0;x<=w;x+=4){const y=h*(.46+k*.055)+Math.sin(x/w*6+frame*.5+k*2)*h*.08+Math.sin(x/w*16-frame*.3+k)*h*.025; x===0?ctx.moveTo(x,y):ctx.lineTo(x,y);} ctx.strokeStyle=colors[k];ctx.lineWidth=Math.max(14,h*.035);ctx.lineCap='round';ctx.stroke();}
      }
      raf=requestAnimationFrame(draw);
    };
    resize(); window.addEventListener('resize',resize); raf=requestAnimationFrame(draw);
    return()=>{alive=false;cancelAnimationFrame(raf);window.removeEventListener('resize',resize);};
  },[]);
  return <canvas ref={ref} className="sentinel-ribbons" aria-hidden="true"/>;
}

function EngineCanvas({kind}:{kind:string}) {
  const ref=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{
    const c=ref.current; const ctx=c?.getContext('2d'); if(!c||!ctx)return;
    let raf=0,alive=true,t=0;
    const draw=()=>{
      if(!alive)return; const w=c.clientWidth,h=c.clientHeight,dpr=Math.min(devicePixelRatio||1,2);
      if(c.width!==Math.floor(w*dpr)||c.height!==Math.floor(h*dpr)){c.width=Math.floor(w*dpr);c.height=Math.floor(h*dpr);}
      ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);t+=.018;
      ctx.strokeStyle='rgba(255,255,255,.2)';ctx.fillStyle='rgba(99,102,241,.9)';ctx.lineWidth=1.5;
      if(kind==='wave'){ctx.beginPath();for(let x=0;x<w;x+=2){const y=h/2+Math.sin(x*.055-t*2)*Math.sin(x*.012+1)*h*.28;x?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.stroke();}
      if(kind==='blocks'){for(let row=0;row<2;row++)for(let i=0;i<22;i++){ctx.globalAlpha=.16+.65*(.5+.5*Math.sin(t*2+i*.42+row*1.7));ctx.fillRect(4+i*(w-10)/22,row*23+12,Math.max(2,(w-20)/30),12);}ctx.globalAlpha=1;}
      if(kind==='stems'){for(let i=0;i<4;i++){ctx.beginPath();for(let x=0;x<w;x+=3){const y=12+i*15+Math.sin(x*.025-t*(.7+i*.22)+i)*5;x?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.globalAlpha=.25+i*.18;ctx.stroke();}ctx.globalAlpha=1;}
      if(kind==='ring'){const x=w/2,y=h/2,r=23;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.strokeStyle='rgba(255,255,255,.18)';ctx.stroke();ctx.beginPath();ctx.arc(x,y,r,-Math.PI/2,-Math.PI/2+Math.PI*1.4);ctx.strokeStyle='#7778f5';ctx.lineWidth=2.5;ctx.stroke();ctx.beginPath();ctx.arc(x,y,3,0,Math.PI*2);ctx.fill();}
      raf=requestAnimationFrame(draw);
    };raf=requestAnimationFrame(draw);return()=>{alive=false;cancelAnimationFrame(raf);};
  },[kind]);
  return <canvas ref={ref} className="sentinel-engine-canvas" aria-hidden="true"/>;
}

function Spectrum() {
  const ref=useRef<HTMLCanvasElement>(null); const [hz,setHz]=useState(2400);
  useEffect(()=>{
    const c=ref.current,ctx=c?.getContext('2d');if(!c||!ctx)return;
    let raf=0,t=0,visible=true;const observer=new IntersectionObserver(([e])=>{visible=e.isIntersecting;if(visible)raf=requestAnimationFrame(draw);else cancelAnimationFrame(raf);},{threshold:.05});
    observer.observe(c);
    const draw=()=>{if(!visible)return;const w=c.clientWidth,h=c.clientHeight,dpr=Math.min(devicePixelRatio||1,2);if(c.width!==w*dpr||c.height!==h*dpr){c.width=w*dpr;c.height=h*dpr;}ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);t+=.025;const n=72,gap=3,bw=(w-gap*(n-1))/n,start=12,end=32;for(let i=0;i<n;i++){const env=Math.sin((i/(n-1))*Math.PI);const wave=.28+.42*(.5+.5*Math.sin(i*.38+t))+ .18*(.5+.5*Math.sin(i*.17-t*1.4));const bh=i>=start&&i<=end?Math.max(16,env*wave*h*.78):Math.max(3,env*wave*h*.68);const x=i*(bw+gap),y=(h-bh)/2;ctx.fillStyle=i>=start&&i<=end?'#6366F1':'rgba(255,255,255,.16)';ctx.fillRect(x,y,bw,bh);}ctx.strokeStyle='rgba(99,102,241,.9)';ctx.lineWidth=1;ctx.strokeRect(start*(bw+gap)-5,8,(end-start+1)*(bw+gap)-gap+10,h-16);setHz(2200+Math.round(450*Math.sin(t*.45)));raf=requestAnimationFrame(draw);};
    raf=requestAnimationFrame(draw);return()=>{visible=false;cancelAnimationFrame(raf);observer.disconnect();};
  },[]);
  return <div className="sentinel-spectrum"><canvas ref={ref}/><div className="sentinel-spectrum-caption"><span>SELECTED RE-VOICE BAND · LIVE SPECTRAL VIEW</span><strong>{hz.toLocaleString()} HZ</strong></div></div>;
}


function TravellingUsbCable({reduced}:{reduced:boolean}){
 const ref=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(reduced)return;const el=ref.current;if(!el)return;let raf=0;const update=()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{const max=Math.max(1,document.documentElement.scrollHeight-innerHeight),p=Math.min(1,Math.max(0,scrollY/max));const x=72-12*p,y=28+52*p,r=-18+268*p,s=1-.5*p,o=p>.88?Math.max(0,(1-p)/.12):1;el.style.transform='translate3d('+x+'vw,'+y+'vh,0) translate(-50%,-50%) rotate('+r+'deg) scale('+s+')';el.style.opacity=String(o);el.style.visibility=o<=.01?'hidden':'visible';});};addEventListener('scroll',update,{passive:true});addEventListener('resize',update);update();return()=>{cancelAnimationFrame(raf);removeEventListener('scroll',update);removeEventListener('resize',update);};},[reduced]);
 if(reduced)return null;
 return <div ref={ref} className="sentinel-travelling-usb" aria-hidden="true"><svg viewBox="0 0 360 170" width="360" height="170"><path d="M18 90 C80 12 125 155 205 84 S300 60 330 88" fill="none" stroke="#252a33" strokeWidth="14" strokeLinecap="round"/><path d="M18 90 C80 12 125 155 205 84 S300 60 330 88" fill="none" stroke="#8993a3" strokeWidth="2"/><g transform="translate(315 70) rotate(35)"><rect width="32" height="36" rx="2" fill="#aeb5bf" stroke="#e5e7eb"/><rect x="8" y="-11" width="16" height="13" fill="#d9dee5"/><path d="M12 -7v6M20 -7v6" stroke="#697386" strokeWidth="2"/></g></svg></div>;
}
function UsbPortDemo({reduced}:{reduced:boolean}){
 const [plugged,setPlugged]=useState(false),[stage,setStage]=useState(0);const path=useRef<SVGPathElement>(null),panel=useRef<HTMLElement>(null);
 const labels=['Awaiting physical connection','USB interface detected','Diagnostic bridge negotiated','Telemetry channel established','Forensic handshake complete'];
 useEffect(()=>{const p=path.current,n=panel.current;if(!p||!n)return;const len=p.getTotalLength();p.style.strokeDasharray=String(len);p.style.strokeDashoffset=String(len);const io=new IntersectionObserver(es=>{if(es.some(e=>e.isIntersecting)){p.style.transition='stroke-dashoffset 2s cubic-bezier(.16,1,.3,1)';p.style.strokeDashoffset='0';io.disconnect();}},{threshold:.3});io.observe(n);return()=>io.disconnect();},[]);
 useEffect(()=>{if(!plugged){setStage(0);return;}if(reduced){setStage(4);return;}setStage(1);const ts=[setTimeout(()=>setStage(2),700),setTimeout(()=>setStage(3),1450),setTimeout(()=>setStage(4),2300)];return()=>ts.forEach(clearTimeout);},[plugged,reduced]);
 return <section ref={panel} id="sentinel-usb-lab" className="sentinel-band sentinel-usb-lab" data-sentinel-reveal><div className="sentinel-band-head"><div className="sentinel-eyebrow">07 · HARDWARE BRIDGE</div><div className="sentinel-rule"/></div><div className="sentinel-band-intro"><h2>Give the signal<br/>a way in.</h2><p>Plug in the cable in this interactive concept demo to walk through a simulated device handshake, diagnostic channel setup and evidence preparation sequence.</p></div>
 <div className={plugged?'sentinel-usb-panel is-plugged':'sentinel-usb-panel'}><div className="sentinel-usb-visual"><div className="sentinel-port-frame"><div className="sentinel-port"><span/><span/></div><div className="sentinel-port-label">QNX DEVICE PORT · USB-C</div></div><svg className="sentinel-usb-drawing" viewBox="0 0 700 260" role="img" aria-label="USB-C cable connecting to a diagnostic device"><path ref={path} d="M30 205 C145 205 155 40 300 40 S470 220 560 130" fill="none" stroke="#52a8ff" strokeWidth="3" strokeLinecap="round"/><path d="M30 205 C145 205 155 40 300 40 S470 220 560 130" fill="none" stroke="#52a8ff" strokeWidth="14" opacity=".08"/><g transform={plugged?'translate(535 103) rotate(-22)':'translate(565 108)'}><rect width="76" height="44" fill="#1b2029" stroke="#aeb6c2" strokeWidth="2"/><rect x="61" y="11" width="22" height="22" fill="#aeb6c2"/><rect x="68" y="16" width="11" height="12" fill="#0a0a0a"/></g></svg><div className="sentinel-usb-controls"><div><span className="sentinel-data-label">CONNECTION STATE</span><strong className="sentinel-usb-state">{labels[stage]}</strong></div><button className="sentinel-usb-button" aria-pressed={plugged} onClick={()=>setPlugged(v=>!v)}>{plugged?'DISCONNECT CABLE':'PLUG IN USB CABLE'} ↗</button></div></div>
 <div className="sentinel-usb-readouts"><div><span>INTERFACE</span><b>{plugged?'USB-C · SIMULATED':'STANDBY'}</b></div><div><span>HANDSHAKE</span><b>{stage===4?'COMPLETE':'PENDING'}</b></div><div><span>DIAGNOSTIC CHANNEL</span><b>{stage>=3?'READY':'CLOSED'}</b></div><div><span>EVIDENCE PIPELINE</span><b>{stage===4?'ARMED':'IDLE'}</b></div></div><p className="sentinel-usb-note">INTERACTIVE SIMULATION ONLY · DOES NOT ACCESS OR COMMUNICATE WITH PHYSICAL USB HARDWARE</p></div></section>;
}
\nexport default function SentinelLandingExperience(){
  const reduced=useReducedMotion();const [intro,setIntro]=useState(true);const [entered,setEntered]=useState(false);const [menuOpen,setMenuOpen]=useState(false);
  useEffect(()=>{if(reduced){setIntro(false);setEntered(true);return;}const a=window.setTimeout(()=>setEntered(true),220);const b=window.setTimeout(()=>setIntro(false),2050);return()=>{clearTimeout(a);clearTimeout(b);};},[reduced]);
  useEffect(()=>{const nodes=[...document.querySelectorAll<HTMLElement>('[data-sentinel-reveal]')];if(reduced){nodes.forEach(n=>n.classList.add('is-visible'));return;}const io=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('is-visible');io.unobserve(e.target);}}),{threshold:.16,rootMargin:'0px 0px -8% 0px'});nodes.forEach(n=>io.observe(n));return()=>io.disconnect();},[reduced]);
  const headline='Intelligence after impact.';
  return <div className="sentinel-landing">\n    <TravellingUsbCable reduced={reduced}/>
    {!reduced&&<div className={`sentinel-intro ${entered?'sentinel-intro-out':''} ${!intro?'sentinel-intro-hidden':''}`} aria-hidden="true"><span>signals become understanding.</span></div>}
    <nav className="sentinel-nav"><a href="#sentinel-home" className="sentinel-wordmark"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3h8v8H3zM13 13h8v8h-8zM13 3h8v8h-8zM3 13h8v8H3z" fill="none" stroke="currentColor" strokeWidth="1.5"/></svg> QNX <i>Sentinel</i></a><div className={menuOpen?"sentinel-nav-links is-open":"sentinel-nav-links"}><a onClick={()=>setMenuOpen(false)} href="#sentinel-engines">SYSTEMS</a><a onClick={()=>setMenuOpen(false)} href="#sentinel-spectrum">SIGNAL</a><a onClick={()=>setMenuOpen(false)} href="#sentinel-event-stream">EVENT STREAM</a><a onClick={()=>setMenuOpen(false)} href="#sentinel-usb-lab">USB BRIDGE</a><a onClick={()=>setMenuOpen(false)} href="#sentinel-faq">FAQ</a></div><a className="sentinel-demo-cta" href="#sentinel-workbench">BOOK A DEMO ↗</a><button className="sentinel-menu-toggle" aria-label="Toggle navigation menu" aria-expanded={menuOpen} onClick={()=>setMenuOpen(!menuOpen)}><span/><span/></button></nav>
    <section id="sentinel-home" className="sentinel-hero">
      <RibbonCanvas/><div className="sentinel-hero-veil"/>
      <div className="sentinel-hero-inner">
        <div className="sentinel-meta"><span>QNX NEUTRINO · POST-MORTEM INTELLIGENCE</span><span>EDGE × CLOUD · 2026</span></div>
        <h1>{headline.split('').map((ch,i)=><span key={i} style={{transitionDelay:reduced?'0ms':`${i*42}ms`}}>{ch===' '?' ':ch}</span>)}</h1>
        <div className="sentinel-hero-bottom"><p>A hybrid AI workbench for embedded telemetry, multilingual fault analysis and traceable post-mortem forensics. Built to turn complex signals into actionable engineering context.</p><div className="sentinel-actions"><a className="sentinel-button primary" href="#sentinel-workbench">OPEN WORKBENCH ↘</a><a className="sentinel-button" href="#sentinel-engines">EXPLORE SYSTEMS</a></div></div>
      </div>
    </section>
    <section id="sentinel-engines" className="sentinel-band" data-sentinel-reveal>
      <div className="sentinel-band-head"><div className="sentinel-eyebrow">01 · ENGINE</div><div className="sentinel-rule"/></div>
      <div className="sentinel-band-intro"><h2>Four layers.<br/>One forensic picture.</h2><p>From the first sanitized packet to a verifiable chain of custody, each layer contributes a different kind of intelligence to the investigation.</p></div>
      <div className="sentinel-engine-grid">{engines.map((e,i)=><article className="sentinel-engine" key={e.kind}><EngineCanvas kind={e.kind}/><div className="sentinel-engine-index">0{i+1} / 04</div><h3>{e.title}</h3><p>{e.copy}</p></article>)}</div>
    </section>
    <section id="sentinel-spectrum" className="sentinel-band" data-sentinel-reveal>
      <div className="sentinel-band-head"><div className="sentinel-eyebrow">02 · SIGNAL</div><div className="sentinel-rule"/></div>
      <div className="sentinel-band-intro"><h2>Separate the fault.<br/>Keep the signal.</h2><p>A live spectral illustration of selective signal treatment: one contiguous frequency band is isolated while the surrounding signal remains visible.</p></div>
      <Spectrum/>
    </section>
    <section className="sentinel-band" data-sentinel-reveal>
      <div className="sentinel-band-head"><div className="sentinel-eyebrow">05 · CAPABILITY</div><div className="sentinel-rule"/></div>
      <div className="sentinel-band-intro"><h2>Designed for<br/>the whole signal path.</h2><p>Core capabilities spanning edge-first routing, multilingual diagnostics, evidence integrity and embedded-system context.</p></div>
      <div className="sentinel-stats"><div><strong><em>12</em>+</strong><span>LANGUAGE ROUTING</span></div><div><strong><em>2</em></strong><span>STAGE HYBRID AI PATH</span></div><div><strong><em>256</em></strong><span>BIT HASH-CHAIN INTEGRITY</span></div><div><strong><em>QNX</em></strong><span>NEUTRINO TARGET</span></div></div>
    </section>

    <section id="sentinel-event-stream" className="sentinel-band sentinel-event-section" data-sentinel-reveal>
      <div className="sentinel-band-head"><div className="sentinel-eyebrow">03 · EVENT STREAM</div><div className="sentinel-rule"/></div>
      <div className="sentinel-band-intro"><h2>Follow every<br/>event to its source.</h2><p>A trace-oriented view of the investigation timeline. Select spans, inspect timing and follow relationships between telemetry events.</p></div>
      <div className="sentinel-event-card"><div className="sentinel-event-top"><div><span className="sentinel-data-label">TRACE ID</span><strong className="sentinel-mono">trc_8f21a9c0d74e</strong></div><div className="sentinel-chip-row"><span className="sentinel-chip"><i className="pass"/>TRACE COMPLETE</span><span className="sentinel-chip">1.5H WINDOW</span></div></div>
      <div className="sentinel-event-body"><aside className="sentinel-event-sidebar"><span className="sentinel-data-label">EVENT IDS · 06</span><div className="sentinel-event-item"><i className="pass"/><span><b>evt_001</b><small>Telemetry ingest</small></span></div><div className="sentinel-event-item"><i className="pass"/><span><b>evt_002</b><small>PII sanitization</small></span></div><div className="sentinel-event-item"><i className="pass"/><span><b>evt_003</b><small>Edge inference</small></span></div><div className="sentinel-event-selected"><i className="focus"/><span><b>evt_004</b><small>Cloud consensus</small></span></div><div className="sentinel-event-item"><i className="pass"/><span><b>evt_005</b><small>Evidence seal</small></span></div><div className="sentinel-event-item"><i className="warn"/><span><b>evt_006</b><small>Case resolution</small></span></div></aside>
      <div className="sentinel-event-table"><div className="sentinel-event-row sentinel-event-heading"><span>SPAN</span><span>START · RELATIVE TIMELINE</span><span>DURATION</span></div>
      <div className="sentinel-event-row"><span className="sentinel-span-name">Telemetry ingest</span><div className="sentinel-timeline"><i style={{left:"4%",width:"9%"}}/></div><span className="sentinel-duration">8m</span></div>
      <div className="sentinel-event-row"><span className="sentinel-span-name">PII sanitization</span><div className="sentinel-timeline"><i style={{left:"13%",width:"5%"}}/></div><span className="sentinel-duration">4m</span></div>
      <div className="sentinel-event-row"><span className="sentinel-span-name">Edge inference</span><div className="sentinel-timeline"><i style={{left:"20%",width:"21%"}}/></div><span className="sentinel-duration">19m</span></div>
      <div className="sentinel-event-row is-focus"><span className="sentinel-span-name">Cloud consensus</span><div className="sentinel-timeline"><i style={{left:"38%",width:"13%"}}/></div><span className="sentinel-duration">11m</span></div>
      <div className="sentinel-event-row"><span className="sentinel-span-name">Evidence seal</span><div className="sentinel-timeline"><i style={{left:"54%",width:"4%"}}/></div><span className="sentinel-duration">2m</span></div>
      <div className="sentinel-event-row"><span className="sentinel-span-name">Case resolution</span><div className="sentinel-timeline"><i style={{left:"62%",width:"7%"}}/></div><span className="sentinel-duration">6m</span></div></div></div><div className="sentinel-event-foot"><span>SYNTHETIC TRACE PREVIEW · REPRESENTATIVE DATA</span><span>HASH-CHAIN VERIFIED <b>✓</b></span></div></div>
    </section>
    <section className="sentinel-band sentinel-bento-section" data-sentinel-reveal><div className="sentinel-band-head"><div className="sentinel-eyebrow">04 · FORENSIC TOOLKIT</div><div className="sentinel-rule"/></div><div className="sentinel-band-intro"><h2>From anomaly<br/>to explanation.</h2><p>Regression signals, failure patterns and version changes in one forensic workflow.</p></div>
      <div className="sentinel-bento-grid">
      <article className="sentinel-bento-card"><div className="sentinel-bento-head"><span>01 / REGRESSION</span><span className="sentinel-chip"><i className="pass"/>3 PASS · 1 FAIL</span></div><h3>Regression signals</h3><p>Compare the current run against a known baseline.</p><div className="sentinel-regression-rows"><div><span>Boot sequence</span><em>PASS</em><b>−12.4%</b></div><div><span>Memory pressure</span><em>PASS</em><b>−4.8%</b></div><div><span>Interrupt latency</span><em className="fail">FAIL</em><b>+18.2%</b></div><div><span>Packet loss</span><em>PASS</em><b>−2.1%</b></div></div></article>
      <article className="sentinel-bento-card"><div className="sentinel-bento-head"><span>02 / CLUSTERING</span><span className="sentinel-chip">4 CLUSTERS</span></div><h3>Failure clustering</h3><p>Group correlated error signatures by observed frequency.</p><div className="sentinel-clusters"><div><span>Timeout</span><i><b style={{width:"42%"}}/></i><strong>42%</strong></div><div><span>Memory</span><i><b style={{width:"28%"}}/></i><strong>28%</strong></div><div><span>I/O fault</span><i><b style={{width:"19%"}}/></i><strong>19%</strong></div><div><span>Other</span><i><b style={{width:"11%"}}/></i><strong>11%</strong></div></div></article>
      <article className="sentinel-bento-card"><div className="sentinel-bento-head"><span>03 / VERSION REPLAY</span><span className="sentinel-chip">DIFF VIEW</span></div><h3>Version replay</h3><p>Inspect changes associated with a fault transition.</p><div className="sentinel-code-diff"><div><i>−</i><code>watchdog_timeout = 80</code></div><div className="added"><i>+</i><code>watchdog_timeout = 120</code></div><div className="modified"><i>~</i><code>retry_policy = adaptive</code></div><div><i> </i><code>capture_trace(signal)</code></div></div></article>
      </div>
    </section>
    <UsbPortDemo reduced={reduced}/>\n    <section id="sentinel-faq" className="sentinel-band" data-sentinel-reveal>
      <div className="sentinel-band-head"><div className="sentinel-eyebrow">06 · QUESTIONS</div><div className="sentinel-rule"/></div>
      <div className="sentinel-band-intro"><h2>Clarity at every<br/>layer of the system.</h2><p>What the workbench does, where it runs and how its evidence is handled.</p></div>
      <div className="sentinel-faq">
        <details><summary>What is QNX Sentinel?<b/></summary><p>A hybrid AI post-mortem telemetry and forensics workbench for inspecting embedded-system diagnostic data and building traceable investigation records.</p></details>
        <details><summary>Does it replace embedded safety control?<b/></summary><p>No. Hard real-time safety actuation remains on the embedded QNX target. The browser workbench supports off-board analysis and forensics.</p></details>
        <details><summary>How does hybrid inference work?<b/></summary><p>The router selects an edge-first or cloud-assisted path according to the configured routing policy, with execution results surfaced transparently.</p></details>
        <details><summary>How is evidence integrity handled?<b/></summary><p>Forensic events can be recorded in a SHA-256 hash-chained ledger and verified to detect changes to the recorded sequence.</p></details>
      </div>
    </section>
    <section className="sentinel-close" data-sentinel-reveal><p className="sentinel-eyebrow">QNX SENTINEL · POST-MORTEM FORENSICS</p><h2>Make every signal<br/>part of the picture.</h2><div className="sentinel-actions"><a className="sentinel-button primary" href="#sentinel-workbench">ENTER THE WORKBENCH ↘</a><a className="sentinel-button" href="#sentinel-home">BACK TO TOP ↑</a></div></section>
    <footer className="sentinel-footer"><span>QNX SENTINEL · HYBRID AI TELEMETRY & FORENSICS</span><span>QNX SDP 8.0 · FIREBASE AI · SHA-256</span><span>© 2026</span></footer>
    <div id="sentinel-workbench" className="sentinel-workbench-label"><span>05 · INTERACTIVE WORKBENCH</span><span>LIVE SYSTEM</span></div>
  </div>;
}

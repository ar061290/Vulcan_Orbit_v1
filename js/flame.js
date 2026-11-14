// Flame lab: a small particle model of hot gas with buoyancy, drag toward the cabin airflow, and diffusion.
// It is an illustration of why "no up" changes detection. It is not a combustion solver.
import { h } from './lib.js';

export function flameLab() {
  const cv = h('canvas', { class: 'lab', 'aria-label': 'Animated comparison of a flame and its smoke with and without gravity' });
  const state = { g: 0, flow: 0.1, running: true };
  const meter = (label) => { const bar = h('i'); const el = h('div', { class: 'meter' }, h('small', {}, label), h('div', { class: 'track' }, bar), h('b', {}, '0%')); el.set = v => { bar.style.width = Math.round(v * 100) + '%'; el.lastChild.textContent = Math.round(v * 100) + '%'; }; return el; };
  const mCeil = meter('Ceiling detector'), mDuct = meter('Air-return detector');
  const gBtn = (val, label) => h('button', { class: 'chip', 'aria-pressed': state.g === val, onclick: e => { state.g = val; e.target.parentNode.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', c === e.target)); reset(); } }, label);
  const flowOut = h('b', {}, '0.10 m/s');
  const flowIn = h('input', { type: 'range', min: 0, max: 0.2, step: 0.01, value: state.flow, 'aria-label': 'Cabin airflow', oninput: e => { state.flow = +e.target.value; flowOut.textContent = state.flow.toFixed(2) + ' m/s'; } });
  const wrap = h('div', { class: 'labwrap' }, cv,
    h('div', { class: 'labui' },
      h('div', { class: 'row', style: 'margin:0' }, gBtn(0, 'In orbit (no gravity)'), gBtn(1, 'On Earth')),
      h('label', { class: 'row', style: 'margin:0' }, 'Cabin airflow ', flowIn, flowOut),
      h('div', { class: 'meters' }, mCeil, mDuct),
      h('small', {}, 'Share of smoke reaching each detector. Simplified model: hot gas parcels with buoyancy, drag toward the airflow, and diffusion.')));

  const ctx = cv.getContext('2d'); let W = 0, H = 0, dpr = 1, P = [], hitC = 0, hitD = 0, born = 0, acc = 0, last = 0, raf = 0;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const size = () => { dpr = Math.min(devicePixelRatio || 1, 1.5); const r = cv.getBoundingClientRect(); W = cv.width = Math.round(r.width * dpr); H = cv.height = Math.round(r.height * dpr); };
  const reset = () => { P = []; hitC = hitD = born = 0; };
  const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) * 1.15;

  function step(dt) {
    const s = dpr, wx = W * 0.3, wy = H * 0.74;
    const G = 900 * s * state.g, U = state.flow * 600 * s, drag = 1.6, rate = state.g ? 230 : 110;
    acc += rate * dt;
    while (acc >= 1 && P.length < 1400) { acc--; const a = Math.random() * Math.PI * 2, v = 26 * s * Math.random(); P.push({ x: wx + gauss() * 3 * s, y: wy + gauss() * 3 * s, vx: Math.cos(a) * v, vy: Math.sin(a) * v, T: 1, age: 0 }); born++; }
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i];
      p.vy -= G * p.T * dt;                              // buoyancy: hot gas is lighter, so it rises only when there is gravity
      p.vx += (U - p.vx) * drag * dt; p.vy += (0 - p.vy) * drag * dt;   // drag toward the cabin airflow
      const k = 34 * s * Math.sqrt(dt); p.vx += gauss() * k; p.vy += gauss() * k;  // diffusion
      p.x += p.vx * dt; p.y += p.vy * dt; p.age += dt; p.T *= Math.exp(-dt / (state.g ? 0.55 : 0.8));
      let dead = p.age > 9;
      if (p.y < H * 0.05) { if (p.x > W * 0.12 && p.x < W * 0.5) hitC++; dead = true; }
      else if (p.x > W * 0.97) { if (p.y > H * 0.25 && p.y < H * 0.9) hitD++; dead = true; }
      else if (p.x < 0 || p.y > H) dead = true;
      if (dead) P.splice(i, 1);
    }
  }
  // soft round sprites: light from hot gas and haze from smoke look like gas, not dots
  const sprite = (rgb, soft) => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, `rgba(${rgb},1)`); gr.addColorStop(soft, `rgba(${rgb},.35)`); gr.addColorStop(1, `rgba(${rgb},0)`); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return c; };
  const SP = { blue: sprite('110,150,255', .35), white: sprite('255,236,200', .3), yellow: sprite('255,190,90', .4), orange: sprite('255,110,30', .45), smoke: sprite('170,172,178', .6) };
  let bgc = null;
  const backdrop = () => { // cabin wall: panels, handrail, ceiling detector, air-return duct; drawn once per size
    bgc = document.createElement('canvas'); bgc.width = W; bgc.height = H; const b = bgc.getContext('2d'), s = dpr;
    const g = b.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#141a26'); g.addColorStop(1, '#0a0d14'); b.fillStyle = g; b.fillRect(0, 0, W, H);
    b.strokeStyle = 'rgba(255,255,255,.035)'; b.lineWidth = s; for (let x = W * 0.12; x < W; x += W * 0.22) { b.strokeRect(x, H * 0.12, W * 0.2, H * 0.76); }
    for (let x = W * 0.12; x < W * 0.9; x += W * 0.22) for (const y of [0.2, 0.8]) { b.fillStyle = 'rgba(255,255,255,.08)'; b.beginPath(); b.arc(x + W * 0.02, H * y, 1.6 * s, 0, 6.3); b.fill(); }
    const v = b.createRadialGradient(W * 0.3, H * 0.6, 10, W * 0.3, H * 0.6, W * 0.8); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.55)'); b.fillStyle = v; b.fillRect(0, 0, W, H);
    b.fillStyle = '#232a38'; b.fillRect(0, 0, W, H * 0.05); b.fillStyle = '#2a3242'; b.fillRect(W * 0.97, H * 0.25, W * 0.03, H * 0.65);
    b.fillStyle = 'rgba(255,255,255,.06)'; for (let y = H * 0.27; y < H * 0.88; y += 6 * s) b.fillRect(W * 0.972, y, W * 0.026, 2 * s);   // duct grille
    b.fillStyle = '#c9ced8'; b.font = `${11 * s}px system-ui`; b.fillText('ceiling detector', W * 0.14, H * 0.05 + 14 * s);
    b.save(); b.translate(W * 0.955, H * 0.86); b.rotate(-Math.PI / 2); b.fillText('air return + detector', 0, 0); b.restore();
  };
  function draw() {
    const s = dpr; if (!bgc || bgc.width !== W || bgc.height !== H) backdrop();
    ctx.globalCompositeOperation = 'source-over'; ctx.drawImage(bgc, 0, 0);
    ctx.strokeStyle = 'rgba(160,180,220,.25)'; ctx.lineWidth = s; const n = Math.round(state.flow / 0.2 * 5);
    for (let i = 0; i < n; i++) { const y = H * (0.2 + i * 0.14), x = W * 0.62; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 34 * s, y); ctx.lineTo(x + 27 * s, y - 4 * s); ctx.moveTo(x + 34 * s, y); ctx.lineTo(x + 27 * s, y + 4 * s); ctx.stroke(); }
    ctx.fillStyle = '#6b6f78'; ctx.fillRect(W * 0.3 - s, H * 0.74, 2 * s, 14 * s);
    // smoke first (normal blending, it dims), then light (additive)
    for (const p of P) if (p.T <= 0.22) { const r = 16 * s; ctx.globalAlpha = 0.07; ctx.drawImage(SP.smoke, p.x - r, p.y - r, 2 * r, 2 * r); }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'lighter';
    for (const p of P) if (p.T > 0.22) {
      const r = (11 + (1 - p.T) * 16) * s, img = state.g ? (p.T > 0.78 ? SP.blue : p.T > 0.55 ? SP.white : p.T > 0.4 ? SP.yellow : SP.orange) : SP.blue;
      ctx.globalAlpha = p.T * (state.g ? 0.16 : 0.2); ctx.drawImage(img, p.x - r, p.y - r, 2 * r, 2 * r);
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    const tot = Math.max(1, born); mCeil.set(Math.min(1, hitC / tot)); mDuct.set(Math.min(1, hitD / tot));
  }
  let seen = false;
  function loop(t) {
    if (cv.isConnected) seen = true; else if (seen) return;   // page changed: stop
    if (!W || !seen) { raf = requestAnimationFrame(loop); return; }
    const dt = Math.min(0.033, (t - last) / 1000 || 0.016); last = t;
    if (!document.hidden) { step(dt); draw(); }
    raf = requestAnimationFrame(loop);
  }
  // Size from the real layout box, whenever it appears or changes.
  new ResizeObserver(() => { const r = cv.getBoundingClientRect(); if (r.width < 10) return; size(); reset(); if (reduce) { for (let i = 0; i < 240; i++) step(0.03); draw(); } }).observe(cv);
  if (!reduce) raf = requestAnimationFrame(loop);
  return wrap;
}

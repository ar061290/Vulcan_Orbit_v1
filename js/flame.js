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
  function draw() {
    const s = dpr; ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#121211'; ctx.fillRect(0, 0, W, H);
    // cabin furniture: ceiling detector, air-return duct, airflow arrows, wick
    ctx.fillStyle = '#2c2c2a'; ctx.fillRect(0, 0, W, H * 0.05); ctx.fillRect(W * 0.97, H * 0.25, W * 0.03, H * 0.65);
    ctx.fillStyle = '#c3c2b7'; ctx.font = `${11 * s}px system-ui`; ctx.fillText('ceiling detector', W * 0.14, H * 0.05 + 14 * s);
    ctx.save(); ctx.translate(W * 0.955, H * 0.86); ctx.rotate(-Math.PI / 2); ctx.fillText('air return + detector', 0, 0); ctx.restore();
    ctx.strokeStyle = '#383835'; ctx.lineWidth = s; const n = Math.round(state.flow / 0.2 * 5);
    for (let i = 0; i < n; i++) { const y = H * (0.2 + i * 0.14), x = W * 0.62; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 34 * s, y); ctx.lineTo(x + 27 * s, y - 4 * s); ctx.moveTo(x + 34 * s, y); ctx.lineTo(x + 27 * s, y + 4 * s); ctx.stroke(); }
    ctx.fillStyle = '#898781'; ctx.fillRect(W * 0.3 - s, H * 0.74, 2 * s, 14 * s);
    ctx.globalCompositeOperation = 'lighter';
    for (const p of P) {
      if (p.T > 0.22) {
        const r = (9 + (1 - p.T) * 13) * s, a = p.T * (state.g ? 0.15 : 0.2);
        ctx.fillStyle = state.g ? (p.T > 0.72 ? `rgba(120,150,255,${a})` : p.T > 0.45 ? `rgba(255,214,140,${a})` : `rgba(255,128,40,${a})`) : `rgba(70,130,255,${a})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.283); ctx.fill();
      } else { ctx.fillStyle = 'rgba(190,190,182,0.07)'; ctx.beginPath(); ctx.arc(p.x, p.y, 8 * s, 0, 6.283); ctx.fill(); }
    }
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

// Interactive flame simulator: renders the reduced-order flame model in data/flame_static.json.
// Every pixel comes from the model's temperature grid and flame contour; nothing is drawn freehand. The Real look view
// re-colours the same grid as light (see imageReal).
// Hot-gas tracers move with the model's own effective flow (forced air + buoyant rise), slowed down for viewing.
import { h, card, badge, fmt } from './lib.js';

// Moon and Mars are not offered: NASA has no flame data at those gravities to check the model against.
const GRAV = [['0 g', 'Orbit', '0 g'], ['Earth 1 g', 'Earth', '1 g']];
const FUELS = ['methane', 'ethylene', 'propane', 'n-heptane', 'ethanol'];
const T_TOP = 2700;                                                            // colour scale top, K (same for every case)
// Incandescence-style ramp for gas temperature: ambient -> dark red -> orange -> yellow -> near white.
const STOPS = [[0, [13, 13, 13, 0]], [0.12, [58, 10, 5, 150]], [0.35, [168, 38, 14, 220]], [0.6, [246, 120, 28, 245]], [0.82, [255, 205, 80, 255]], [1, [255, 246, 222, 255]]];
function heat(T) {
  const v = Math.max(0, Math.min(1, (T - 298) / (T_TOP - 298)));
  for (let i = 1; i < STOPS.length; i++) if (v <= STOPS[i][0]) {
    const [a, ca] = STOPS[i - 1], [b, cb] = STOPS[i], f = (v - a) / (b - a);
    return ca.map((x, k) => Math.round(x + (cb[k] - x) * f));
  }
  return STOPS[STOPS.length - 1][1];
}
// "Real look": the same temperature grid turned into light. Colour follows temperature (an approximate blackbody tint);
// brightness of the hot-gas glow is scaled by the model's buoyant rise speed, because rising flames burn sootier and yellower.
// That scaling is our artistic choice, not a model output, and the panel says so.
const BB = [[800, [120, 20, 0]], [1200, [255, 70, 0]], [1600, [255, 115, 10]], [2000, [255, 145, 40]], [2400, [255, 175, 85]], [2800, [255, 205, 140]]];
function bb(T) { if (T <= BB[0][0]) return BB[0][1]; for (let i = 1; i < BB.length; i++) if (T <= BB[i][0]) { const [a, ca] = BB[i - 1], [b, cb] = BB[i], f = (T - a) / (b - a); return ca.map((x, k) => x + (cb[k] - x) * f); } return BB[BB.length - 1][1]; }
const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export function flameSim(fs) {
  const idx = new Map(fs.flames.map(f => [`${f.fuel}|${f.gravity}|${f.X_O2}|${f.P_kPa}|${f.flow_m_s}`, f]));
  const flows = [...new Set(fs.flames.map(f => f.flow_m_s))].sort((a, b) => a - b);
  const st = { fuel: 'n-heptane', g: '0 g', o2: 0.21, p: 101.3, flow: 0 };
  const W = 760, H = 470, dpr = Math.min(2, window.devicePixelRatio || 1);
  const cv = h('canvas', { width: W * dpr, height: H * dpr, style: 'width:100%;height:auto;aspect-ratio:760/470;display:block;border-radius:10px;border:1px solid var(--grid);background:#0b0b0b', 'aria-label': 'Flame temperature map from the model' });
  const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr);
  const readout = h('div', { class: 'grid g3', style: 'margin-top:12px' }), labelBox = h('div', { style: 'margin-top:10px' });

  // one offscreen image per case: the temperature grid coloured once
  const imgCache = new Map(), realCache = new Map();
  let look = 'real';
  function image(f) {
    if (imgCache.has(f)) return imgCache.get(f);
    const T = f.grid.T_K, ny = T.length, nx = T[0].length, off = document.createElement('canvas'); off.width = nx; off.height = ny;
    const o = off.getContext('2d'), im = o.createImageData(nx, ny);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const c = heat(T[j][i]), p = ((ny - 1 - j) * nx + i) * 4; im.data[p] = c[0]; im.data[p + 1] = c[1]; im.data[p + 2] = c[2]; im.data[p + 3] = c[3]; }
    o.putImageData(im, 0, 0);
    // upscale smoothly, then feather the edges: the model grid ends there, so the picture fades out instead of stopping at a hard square
    const big = document.createElement('canvas'); big.width = nx * 10; big.height = ny * 10; const b = big.getContext('2d');
    b.imageSmoothingEnabled = true; b.imageSmoothingQuality = 'high'; b.drawImage(off, 0, 0, big.width, big.height);
    b.globalCompositeOperation = 'destination-in';
    for (const [x1, y1] of [[big.width, 0], [0, big.height]]) {
      const gr = b.createLinearGradient(0, 0, x1, y1); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.16, 'rgba(0,0,0,1)'); gr.addColorStop(0.84, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      b.fillStyle = gr; b.fillRect(0, 0, big.width, big.height);
    }
    imgCache.set(f, big); return big;
  }
  function imageReal(f) {
    if (realCache.has(f)) return realCache.get(f);
    const T = f.grid.T_K, ny = T.length, nx = T[0].length, off = document.createElement('canvas'); off.width = nx; off.height = ny;
    const o = off.getContext('2d'), im = o.createImageData(nx, ny), Tf = f.T_flame_K || 2200;
    const soot = 0.12 + 0.88 * Math.min(1, (f.U_buoy_m_s || 0) / 0.6);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const t = T[j][i], v = Math.max(0, (t - 1100) / (Tf - 1100)), I = Math.min(1, Math.pow(v, 2.2) * soot * 1.25), c = bb(t), p = ((ny - 1 - j) * nx + i) * 4;
      im.data[p] = c[0]; im.data[p + 1] = c[1]; im.data[p + 2] = c[2]; im.data[p + 3] = Math.round(255 * I);
    }
    o.putImageData(im, 0, 0);
    const big = document.createElement('canvas'); big.width = nx * 12; big.height = ny * 12; const b = big.getContext('2d');
    b.imageSmoothingEnabled = true; b.imageSmoothingQuality = 'high'; b.filter = 'blur(6px)'; b.drawImage(off, 0, 0, big.width, big.height); b.filter = 'none';
    realCache.set(f, big); return big;
  }
  // view: centre and half-height in mm, equal aspect
  function viewOf(f) {
    const x = f.grid.x_mm, z = f.grid.z_mm, x0 = x[0], x1 = x[x.length - 1], z0 = z[0], z1 = z[z.length - 1];
    const half = Math.max((z1 - z0) / 2, (x1 - x0) / 2 * H / W) * 1.08;
    return { cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, half };
  }
  const lerp = (a, b, t) => a + (b - a) * t;
  let cur = null, prev = null, view = null, from = null, t0 = 0, parts = [], last = performance.now(), seen = false;

  function resample(c, n) { if (c.length === n) return c; return Array.from({ length: n }, (_, k) => c[Math.floor(k * c.length / n)]); }
  function draw(now) {
    if (!cv.isConnected && seen) return; if (cv.isConnected) seen = true;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const tt = prev ? Math.min(1, (now - t0) / 650) : 1, e = ease(tt);
    const tv = viewOf(cur), v = prev && from ? { cx: lerp(from.cx, tv.cx, e), cz: lerp(from.cz, tv.cz, e), half: lerp(from.half, tv.half, e) } : tv; view = v;
    const S = H / 2 / v.half, X = x => W / 2 + (x - v.cx) * S, Y = z => H / 2 - (z - v.cz) * S;
    ctx.clearRect(0, 0, W, H); ctx.fillStyle = '#05070d'; ctx.fillRect(0, 0, W, H);
    if (look === 'real') { const vg = ctx.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, W * 0.7); vg.addColorStop(0, 'rgba(40,50,80,.25)'); vg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H); }
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    const put = (f, a) => { if (a <= 0) return; const x = f.grid.x_mm, z = f.grid.z_mm, dx = (x[x.length - 1] - x[0]) / (x.length - 1), dz = (z[z.length - 1] - z[0]) / (z.length - 1);
      ctx.globalAlpha = a; ctx.drawImage(look === 'real' ? imageReal(f) : image(f), X(x[0] - dx / 2), Y(z[z.length - 1] + dz / 2), (x[x.length - 1] - x[0] + dx) * S, (z[z.length - 1] - z[0] + dz) * S); ctx.globalAlpha = 1; };
    ctx.save(); if (look === 'real') ctx.globalCompositeOperation = 'lighter';
    if (prev && tt < 1) put(prev, 1 - e); put(cur, prev && tt < 1 ? e : 1); ctx.restore();
    // glow: a blurred copy gives the bright core a soft halo
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.filter = look === 'real' ? 'blur(18px)' : 'blur(10px)'; put(cur, look === 'real' ? 0.7 : 0.35); ctx.restore(); ctx.filter = 'none';
    // hot-gas tracers carried by the model's effective flow
    const g = cur.U_buoy_m_s || 0, u = cur.flow_m_s || 0, sp = Math.hypot(u, g);
    const slow = sp > 0 ? Math.max(1, sp * 1000 * S / 90) : 1;               // so the fastest tracer moves ~90 px/s
    const cont = resample(cur.contour_mm, 72);
    if (parts.length < 140 && Math.random() < 0.9) { const p = cont[Math.floor(Math.random() * cont.length)]; parts.push({ x: p[0] * (0.6 + 0.4 * Math.random()), z: p[1] * (0.6 + 0.4 * Math.random()), life: 1 }); }
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    parts = parts.filter(p => p.life > 0);
    for (const p of parts) {
      let vx = u * 1000 / slow, vz = g * 1000 / slow;
      if (sp === 0) { const r = Math.hypot(p.x, p.z) || 1; vx = p.x / r * 6; vz = p.z / r * 6; }   // no flow, no rise: gas only spreads outward
      p.x += (vx + (Math.random() - 0.5) * 8) * dt; p.z += (vz + (Math.random() - 0.5) * 8) * dt; p.life -= dt * 0.45;
      ctx.fillStyle = `rgba(255,170,90,${(look === 'real' ? 0.12 : 0.22) * p.life})`; ctx.beginPath(); ctx.arc(X(p.x), Y(p.z), 1.6, 0, 6.283); ctx.fill();
    }
    ctx.restore();
    // flame sheet (stoichiometric surface): morphs between cases
    const pc = prev && tt < 1 ? resample(prev.contour_mm, 72) : null;
    ctx.beginPath(); cont.forEach((p, k) => { const x = pc ? lerp(pc[k][0], p[0], e) : p[0], z = pc ? lerp(pc[k][1], p[1], e) : p[1]; k ? ctx.lineTo(X(x), Y(z)) : ctx.moveTo(X(x), Y(z)); }); ctx.closePath();
    if (look === 'real') {
      // blue light from the reaction zone, strongest where fresh oxygen meets fuel: all round in orbit, near the base when buoyancy lifts the flame
      const zs = cont.map(p => p[1]), zmin = Math.min(...zs), zmax = Math.max(...zs), lift = Math.min(1, (cur.U_buoy_m_s || 0) / 0.3);
      const gr = ctx.createLinearGradient(0, Y(zmin), 0, Y(zmax));
      gr.addColorStop(0, 'rgba(90,140,255,1)'); gr.addColorStop(0.35, `rgba(90,140,255,${1 - 0.8 * lift})`); gr.addColorStop(1, `rgba(90,140,255,${1 - 0.95 * lift})`);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = gr; ctx.lineJoin = 'round';
      for (const [w, a, bl] of [[14, 0.18, 12], [6, 0.35, 4], [2.2, 0.9, 0]]) { ctx.globalAlpha = a; ctx.lineWidth = w; ctx.filter = bl ? `blur(${bl}px)` : 'none'; ctx.stroke(); }
      ctx.restore(); ctx.filter = 'none';
    } else { ctx.strokeStyle = 'rgba(160,200,255,.9)'; ctx.lineWidth = 1.5; ctx.stroke(); }
    // fuel source to scale
    const src = cur.source; ctx.fillStyle = '#d9d7cf';
    if (src.type === 'droplet') { const r = Math.max(2.5, src.d0_mm / 2 * S);
      if (look === 'real') { const dg = ctx.createRadialGradient(X(0) - r * 0.35, Y(0) - r * 0.35, r * 0.1, X(0), Y(0), r); dg.addColorStop(0, 'rgba(255,240,220,.95)'); dg.addColorStop(0.35, 'rgba(120,90,70,.9)'); dg.addColorStop(1, 'rgba(20,16,14,.95)'); ctx.fillStyle = dg; }
      ctx.beginPath(); ctx.arc(X(0), Y(0), r, 0, 6.283); ctx.fill(); }
    else { ctx.fillRect(X(0) - 3, Y(0), 6, 14); }
    // scale bar, gravity and airflow markers
    const nice = [1, 2, 5, 10, 20, 50, 100, 200, 500].find(m => m * S > 70) || 500;
    ctx.fillStyle = '#c3c2b7'; ctx.fillRect(18, H - 22, nice * S, 2); ctx.font = '12px system-ui'; ctx.fillText(`${nice} mm`, 18, H - 30);
    ctx.textAlign = 'right'; ctx.fillText(cur.gravity === '0 g' ? 'no gravity' : `gravity ${fmt(cur.g_m_s2, 2)} m/s² ↓`, W - 16, 22);
    if (u > 0) ctx.fillText(`air ${u} m/s →`, W - 16, 40);
    ctx.fillText(slow > 1.5 ? `tracers shown ${Math.round(slow)}× slower` : 'tracers at real speed', W - 16, H - 16); ctx.textAlign = 'left';
    requestAnimationFrame(draw);
  }

  const row = (label, key, opts, fmtOpt) => h('div', { class: 'row', style: 'margin-bottom:8px' }, h('label', { style: 'min-width:72px' }, label), ...opts.map(o => {
    const val = Array.isArray(o) ? o[0] : o, b = h('button', { class: 'chip', 'aria-pressed': String(st[key] === val), onclick: () => { st[key] = val; b.parentNode.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', String(c === b))); show(); } }, fmtOpt(o)); return b; }));
  const legend = h('div', { class: 'legend' });
  const setLegend = () => legend.replaceChildren(...(look === 'real'
    ? [h('span', {}, h('i', { style: 'background:linear-gradient(90deg,rgb(255,70,0),rgb(255,175,85));width:60px' }), 'Glowing hot gas'), h('span', {}, h('i', { style: 'background:rgb(90,140,255)' }), 'Blue reaction zone (flame sheet)'), h('span', {}, h('i', { style: 'background:#d9d7cf;border-radius:50%' }), 'Fuel source, to scale')]
    : [h('span', {}, h('i', { style: `background:linear-gradient(90deg,rgb(58,10,5),rgb(246,120,28),rgb(255,246,222));width:60px` }), `Gas temperature, 300 to ${T_TOP} K`), h('span', {}, h('i', { style: 'background:rgb(160,200,255)' }), 'Flame sheet'), h('span', {}, h('i', { style: 'background:#d9d7cf;border-radius:50%' }), 'Fuel source, to scale')]));
  setLegend();
  const lookNote = h('p', { style: 'margin:6px 0 0' });
  const setNote = () => lookNote.replaceChildren(h('small', {}, look === 'real' ? 'Real look: the model\'s temperature grid drawn as light. Colour follows temperature; how bright and yellow the hot gas glows is scaled by the model\'s rise speed, which is our artistic choice, not a model output. Switch to Temperature for the exact numbers.' : 'Temperature map: every pixel is the model\'s gas temperature on a fixed scale.'));
  setNote();
  const lookRow = h('div', { class: 'row', style: 'margin-bottom:8px' }, h('label', { style: 'min-width:72px' }, 'View'), ...[['real', 'Real look'], ['temp', 'Temperature map']].map(([v, t]) => { const b = h('button', { class: 'chip', 'aria-pressed': String(look === v), onclick: () => { look = v; b.parentNode.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', String(c === b))); setLegend(); setNote(); } }, t); return b; }));
  const controls = h('div', {},
    lookRow,
    row('Fuel', 'fuel', FUELS, o => o),
    row('Gravity', 'g', GRAV, o => `${o[1]} · ${o[2]}`),
    row('Oxygen', 'o2', [0.21, 0.34], o => `${Math.round(o * 100)}%`),
    row('Pressure', 'p', [101.3, 70.3], o => o === 101.3 ? '101.3 kPa (sea level)' : '70.3 kPa (exploration cabin)'),
    row('Airflow', 'flow', flows, o => o === 0 ? 'still air' : `${o} m/s`));

  function show() {
    const f = idx.get(`${st.fuel}|${st.g}|${st.o2}|${st.p}|${st.flow}`); if (!f) return;
    if (cur && f !== cur) { prev = cur; from = view || viewOf(cur); t0 = performance.now(); parts = []; }
    cur = f;
    const val = (k, v, s) => h('div', {}, h('small', {}, k), h('div', { class: 'stat', style: 'font-size:22px' }, v, s ? h('small', {}, s) : null));
    readout.replaceChildren(
      val('Flame temperature', fmt(f.T_flame_K, 0), 'K'),
      val('Shape (length ÷ width)', fmt(f.aspect, 1), f.aspect < 1.05 ? 'a sphere' : 'elongated'),
      val('Buoyant rise speed', fmt(f.U_buoy_m_s, 2), 'm/s'),
      val('Source', f.source.type === 'droplet' ? `${f.source.d0_mm} mm` : `${f.source.Q_F_cm3_s} cm³/s`, f.source.type === 'droplet' ? 'droplet' : 'gas jet'),
      val('Tilt from vertical', fmt(f.tilt_deg_from_vertical, 0), '°'),
      val('Stoichiometric mixture fraction', fmt(f.Z_st, 3)));
    const validated = f.gravity_label === 'validated';
    labelBox.replaceChildren(h('p', { style: 'margin:0' }, validated
      ? h('span', {}, badge('model'), ' NASA has flame data at this gravity, and the checks below compare the model with it (some fail).')
      : h('span', {}, h('span', { class: 'badge', style: 'border-color:var(--warn);color:var(--warn)' }, 'model only'), ' Not validated: NASA has no flame data at this gravity. It lies between the microgravity and Earth results.')));
  }
  show(); requestAnimationFrame(draw);

  return card('Flame simulator', fs.status, 'Pick a fuel, gravity, oxygen level, cabin pressure and airflow. Real look draws the model as light; Temperature map shows the exact gas temperatures. The blue line is the flame sheet, where fuel and oxygen meet in the right ratio.',
    h('div', { class: 'grid', style: 'grid-template-columns:minmax(0,1.7fr) minmax(0,1fr);gap:16px;align-items:start' },
      h('div', {}, cv, legend, lookNote),
      h('div', {}, controls, labelBox)),
    readout,
    h('p', { style: 'margin-top:10px' }, h('small', {}, 'Reduced-order model: a point fuel source in a uniform effective flow (forced air plus buoyant rise). Flame shapes follow the physics; absolute sizes do not: at 1 g the model runs 2.2 to 2.8 times taller than a published laminar-flame correlation (check S1-height, failed). Not combustion CFD.')));
}

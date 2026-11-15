// Interactive flame simulator: renders the reduced-order flame model in data/flame_static.json.
// Every pixel comes from the model's temperature grid and flame contour; nothing is drawn freehand. The Real look view
// re-colours the same grid as light (see imageReal).
// Hot-gas tracers move with the model's own effective flow (forced air + buoyant rise), slowed down for viewing.
// Rendering constants are verbatim from main's js/flame_sim.js. New here (site/REBUILD_PLAN.md §3.8):
//  - the animation starts in ctx.onMount and stops in ctx.onLeave (never in a detached render);
//  - a Pause / Play button; in Calm motion nothing animates: one still frame is drawn, and redrawn on every change;
//  - keyboard reading of the temperature grid (charts.keyNav), a text summary and a "Show the numbers" stats table;
//  - Moon and Mars gravity only behind the "Show Moon and Mars (model only)" switch, drawn with a dashed flame sheet,
//    a "model only" stamp and the file's gravity_note.
import { h, add, card, badge, fmt, seg, stat, announce, calm, tip, untip } from './lib.js';
import { keyNav, numbers } from './charts.js';
import { moonMarsSwitch, modelOnly, gravities, mmStamp } from './fig_flame.js';

/** Replace an element's children, dropping null/false/undefined (replaceChildren(null) would print "null"). */
const put = (el, ...kids) => { el.replaceChildren(); add(el, ...kids); };

const FUELS = ['methane', 'ethylene', 'propane', 'n-heptane', 'ethanol'];
const GSHORT = { '0 g': 'Orbit', 'Moon 0.16 g': 'Moon', 'Mars 0.38 g': 'Mars', 'Earth 1 g': 'Earth' };
const gPart = g => (/([\d.]+\s*g)$/.exec(g) || [0, g])[1];
const gLabel = (g, mm) => `${GSHORT[g] || g} · ${gPart(g)}${mm ? ' (model only)' : ''}`;
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
const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// How many NASA tests ran near these conditions (same window as the gap map: 3 oxygen points, 10 kPa), by fire type.
export function nearTests(gaps, kind, o2pct, kpa) {
  if (!gaps || gaps.status === 'missing' || !Array.isArray(gaps.tested)) return null;
  return gaps.tested.filter(t => t.kind === kind).reduce((n, t) => n + t.points.filter(([o, p]) => Math.abs(o - o2pct) <= 3 && Math.abs(p - kpa) <= 10).length, 0);
}

// Choices survive a theme or motion re-render of the page (the module stays loaded); a fresh page load starts at main's defaults.
let saved = null;

export function flameSimCard(fs, gaps, ctx = {}, opts = {}) {
  let showMM = !!opts.showMM;
  const idx = new Map(fs.flames.map(f => [`${f.fuel}|${f.gravity}|${f.X_O2}|${f.P_kPa}|${f.flow_m_s}`, f]));
  const flows = [...new Set(fs.flames.map(f => f.flow_m_s))].sort((a, b) => a - b);
  const fuels = FUELS.filter(f => fs.flames.some(x => x.fuel === f)).concat([...new Set(fs.flames.map(f => f.fuel))].filter(f => !FUELS.includes(f)));
  const G = gravities(fs.flames);
  const st = saved || (saved = { fuel: 'n-heptane', g: '0 g', o2: 0.21, p: 101.3, flow: 0, look: 'real' });
  if (!showMM && G.find(x => x.g === st.g)?.mm) st.g = '0 g';
  const W = 760, H = 470, dpr = Math.min(2, (typeof devicePixelRatio === 'number' && devicePixelRatio) || 1);
  const sumId = `flsim-sum-${Math.random().toString(36).slice(2, 8)}`;
  const cv = h('canvas', { width: W * dpr, height: H * dpr, class: 'fl-simcv', 'aria-describedby': sumId });
  const g2 = cv.getContext('2d'); if (g2) g2.scale(dpr, dpr);
  const readout = h('div', { class: 'grid g3 fl-stats' }), labelBox = h('div', { class: 'fl-labels' });
  const summary = h('p', { class: 'fl-sum', id: sumId }), tableSlot = h('div');

  // one offscreen image per case: the temperature grid coloured once
  const imgCache = new Map(), realCache = new Map();
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
  let cur = null, prev = null, view = null, from = null, t0 = 0, parts = [], last = 0, focusCell = -1;
  const resample = (c, n) => (c.length === n ? c : Array.from({ length: n }, (_, k) => c[Math.floor(k * c.length / n)]));

  // ---------- lifecycle: nothing runs until mounted; Calm or Pause draws still frames only ----------
  let raf = 0, mounted = false, playing = false, visible = true, io = null;
  const animating = () => mounted && playing && visible && !calm();
  function loop(now) { raf = 0; if (!mounted) return; frame(now, false); if (animating()) raf = requestAnimationFrame(loop); }
  function start() { if (!raf && animating()) { last = performance.now(); raf = requestAnimationFrame(loop); } }
  function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }
  function still() { if (!mounted) return; prev = null; frame(performance.now(), true); }

  function frame(now, isStill) {
    if (!cur || !g2) return;
    const ctx2 = g2;
    const dt = isStill ? 0 : Math.min(0.05, (now - last) / 1000); last = now;
    const tt = prev && !isStill ? Math.min(1, (now - t0) / 650) : 1, e = ease(tt);
    if (tt >= 1) prev = null;
    const tv = viewOf(cur), v = prev && from ? { cx: lerp(from.cx, tv.cx, e), cz: lerp(from.cz, tv.cz, e), half: lerp(from.half, tv.half, e) } : tv; view = v;
    const S = H / 2 / v.half, X = x => W / 2 + (x - v.cx) * S, Y = z => H / 2 - (z - v.cz) * S;
    const look = st.look, mm = modelOnly(cur.gravity_label);
    ctx2.clearRect(0, 0, W, H); ctx2.fillStyle = '#05070d'; ctx2.fillRect(0, 0, W, H);
    if (look === 'real') { const vg = ctx2.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, W * 0.7); vg.addColorStop(0, 'rgba(40,50,80,.25)'); vg.addColorStop(1, 'rgba(0,0,0,0)'); ctx2.fillStyle = vg; ctx2.fillRect(0, 0, W, H); }
    ctx2.imageSmoothingEnabled = true; ctx2.imageSmoothingQuality = 'high';
    const put = (f, a) => { if (a <= 0) return; const x = f.grid.x_mm, z = f.grid.z_mm, dx = (x[x.length - 1] - x[0]) / (x.length - 1), dz = (z[z.length - 1] - z[0]) / (z.length - 1);
      ctx2.globalAlpha = a; ctx2.drawImage(look === 'real' ? imageReal(f) : image(f), X(x[0] - dx / 2), Y(z[z.length - 1] + dz / 2), (x[x.length - 1] - x[0] + dx) * S, (z[z.length - 1] - z[0] + dz) * S); ctx2.globalAlpha = 1; };
    ctx2.save(); if (look === 'real') ctx2.globalCompositeOperation = 'lighter';
    if (prev && tt < 1) put(prev, 1 - e); put(cur, prev && tt < 1 ? e : 1); ctx2.restore();
    // glow: a blurred copy gives the bright core a soft halo
    ctx2.save(); ctx2.globalCompositeOperation = 'lighter'; ctx2.filter = look === 'real' ? 'blur(18px)' : 'blur(10px)'; put(cur, look === 'real' ? 0.7 : 0.35); ctx2.restore(); ctx2.filter = 'none';
    // hot-gas tracers carried by the model's effective flow (frozen in a still frame)
    const g = cur.U_buoy_m_s || 0, u = cur.flow_m_s || 0, sp = Math.hypot(u, g);
    const slow = sp > 0 ? Math.max(1, sp * 1000 * S / 90) : 1;               // so the fastest tracer moves ~90 px/s
    const cont = resample(cur.contour_mm, 72);
    if (!isStill && parts.length < 140 && Math.random() < 0.9) { const p = cont[Math.floor(Math.random() * cont.length)]; parts.push({ x: p[0] * (0.6 + 0.4 * Math.random()), z: p[1] * (0.6 + 0.4 * Math.random()), life: 1 }); }
    ctx2.save(); ctx2.globalCompositeOperation = 'lighter';
    parts = parts.filter(p => p.life > 0);
    for (const p of parts) {
      let vx = u * 1000 / slow, vz = g * 1000 / slow;
      if (sp === 0) { const r = Math.hypot(p.x, p.z) || 1; vx = p.x / r * 6; vz = p.z / r * 6; }   // no flow, no rise: gas only spreads outward
      if (dt > 0) { p.x += (vx + (Math.random() - 0.5) * 8) * dt; p.z += (vz + (Math.random() - 0.5) * 8) * dt; p.life -= dt * 0.45; }
      ctx2.fillStyle = `rgba(255,170,90,${(look === 'real' ? 0.12 : 0.22) * p.life})`; ctx2.beginPath(); ctx2.arc(X(p.x), Y(p.z), 1.6, 0, 6.283); ctx2.fill();
    }
    ctx2.restore();
    // flame sheet (stoichiometric surface): morphs between cases; dashed for Moon and Mars (model only)
    const pc = prev && tt < 1 ? resample(prev.contour_mm, 72) : null;
    ctx2.beginPath(); cont.forEach((p, k) => { const x = pc ? lerp(pc[k][0], p[0], e) : p[0], z = pc ? lerp(pc[k][1], p[1], e) : p[1]; if (k) ctx2.lineTo(X(x), Y(z)); else ctx2.moveTo(X(x), Y(z)); }); ctx2.closePath();
    ctx2.setLineDash(mm ? [9, 7] : []);
    if (look === 'real') {
      // blue light from the reaction zone, strongest where fresh oxygen meets fuel: all round in orbit, near the base when buoyancy lifts the flame
      const zs = cont.map(p => p[1]), zmin = Math.min(...zs), zmax = Math.max(...zs), lift = Math.min(1, (cur.U_buoy_m_s || 0) / 0.3);
      const gr = ctx2.createLinearGradient(0, Y(zmin), 0, Y(zmax));
      gr.addColorStop(0, 'rgba(90,140,255,1)'); gr.addColorStop(0.35, `rgba(90,140,255,${1 - 0.8 * lift})`); gr.addColorStop(1, `rgba(90,140,255,${1 - 0.95 * lift})`);
      ctx2.save(); ctx2.globalCompositeOperation = 'lighter'; ctx2.strokeStyle = gr; ctx2.lineJoin = 'round';
      for (const [w, a, bl] of [[14, 0.18, 12], [6, 0.35, 4], [2.2, 0.9, 0]]) { ctx2.globalAlpha = a; ctx2.lineWidth = w; ctx2.filter = bl ? `blur(${bl}px)` : 'none'; ctx2.stroke(); }
      ctx2.restore(); ctx2.filter = 'none';
    } else { ctx2.strokeStyle = 'rgba(160,200,255,.9)'; ctx2.lineWidth = 1.5; ctx2.stroke(); }
    ctx2.setLineDash([]);
    // fuel source to scale
    const src = cur.source; ctx2.fillStyle = '#d9d7cf';
    if (src.type === 'droplet') { const r = Math.max(2.5, src.d0_mm / 2 * S);
      if (look === 'real') { const dg = ctx2.createRadialGradient(X(0) - r * 0.35, Y(0) - r * 0.35, r * 0.1, X(0), Y(0), r); dg.addColorStop(0, 'rgba(255,240,220,.95)'); dg.addColorStop(0.35, 'rgba(120,90,70,.9)'); dg.addColorStop(1, 'rgba(20,16,14,.95)'); ctx2.fillStyle = dg; }
      ctx2.beginPath(); ctx2.arc(X(0), Y(0), r, 0, 6.283); ctx2.fill(); }
    else { ctx2.fillRect(X(0) - 3, Y(0), 6, 14); }
    // scale bar, gravity and airflow markers
    const nice = [1, 2, 5, 10, 20, 50, 100, 200, 500].find(n => n * S > 70) || 500;
    ctx2.fillStyle = '#c3c2b7'; ctx2.fillRect(18, H - 22, nice * S, 2); ctx2.font = '12px system-ui'; ctx2.textAlign = 'left'; ctx2.fillText(`${nice} mm`, 18, H - 30);
    ctx2.textAlign = 'right'; ctx2.fillText(cur.gravity === '0 g' ? 'no gravity' : `gravity ${fmt(cur.g_m_s2, 2)} m/s² ↓`, W - 16, 22);
    if (u > 0) ctx2.fillText(`air ${u} m/s →`, W - 16, 40);
    ctx2.fillText(!animating() ? (calm() ? 'Calm motion: still frame' : 'tracers paused') : slow > 1.5 ? `tracers shown ${Math.round(slow)}× slower` : 'tracers at real speed', W - 16, H - 16);
    if (mm) { ctx2.textAlign = 'left'; ctx2.fillStyle = '#fab219'; ctx2.font = '700 12px system-ui'; ctx2.fillText('MODEL ONLY · NOT VALIDATED', 16, 22); }
    ctx2.textAlign = 'left';
    // keyboard focus ring on the grid cell being read
    if (focusCell >= 0) {
      const x = cur.grid.x_mm, z = cur.grid.z_mm, nx = x.length, dx = (x[nx - 1] - x[0]) / (nx - 1), dz = (z[z.length - 1] - z[0]) / (z.length - 1);
      const ii = focusCell % nx, jj = z.length - 1 - Math.floor(focusCell / nx);
      ctx2.strokeStyle = '#eef1f7'; ctx2.lineWidth = 2; ctx2.strokeRect(X(x[ii] - dx / 2), Y(z[jj] + dz / 2), dx * S, dz * S);
    }
  }

  // ---------- keyboard and pointer reading of the grid ----------
  const items = [];
  const cellHtml = (i, j) => { const x = cur.grid.x_mm[i], z = cur.grid.z_mm[j], T = cur.grid.T_K[j][i];
    return `<b>${fmt(T, 0)} K</b><br>${fmt(x, 1)} mm across, ${fmt(z, 1)} mm up from the fuel${modelOnly(cur.gravity_label) ? '<br><span>model only, not validated</span>' : ''}`; };
  const toClient = (x, z) => { const r = cv.getBoundingClientRect(), v = view || viewOf(cur), S = H / 2 / v.half;
    return { x: r.left + (W / 2 + (x - v.cx) * S) / W * r.width, y: r.top + (H / 2 - (z - v.cz) * S) / H * r.height }; };
  const nav = keyNav(cv, items, { label: 'Flame simulator: the model temperature grid', cols: fs.flames[0]?.grid?.x_mm?.length || 31,
    onMove: i => { focusCell = i; if (!animating()) still(); }, onClear: () => { focusCell = -1; if (!animating()) still(); } });
  function setItems() {
    items.length = 0;
    const x = cur.grid.x_mm, z = cur.grid.z_mm;
    for (let j = z.length - 1; j >= 0; j--) for (let i = 0; i < x.length; i++) { const ii = i, jj = j; items.push({ html: cellHtml(ii, jj), anchor: () => toClient(x[ii], z[jj]) }); }
  }
  cv.addEventListener('pointermove', e => {
    if (!cur) return;
    const r = cv.getBoundingClientRect(), v = view || viewOf(cur), S = H / 2 / v.half;
    const mx = v.cx + ((e.clientX - r.left) / r.width * W - W / 2) / S, mz = v.cz - ((e.clientY - r.top) / r.height * H - H / 2) / S;
    const x = cur.grid.x_mm, z = cur.grid.z_mm;
    if (mx < x[0] || mx > x[x.length - 1] || mz < z[0] || mz > z[z.length - 1]) return untip();
    const near = (arr, val) => arr.reduce((b, q, k) => (Math.abs(q - val) < Math.abs(arr[b] - val) ? k : b), 0);
    tip(e, cellHtml(near(x, mx), near(z, mz)));
  });
  cv.addEventListener('pointerleave', untip);

  // ---------- controls ----------
  const legendEl = h('div', { class: 'legend fl-legend' });
  const sw_ = (cls, style) => h('i', { class: `fl-sw ${cls || ''}`, style, 'aria-hidden': 'true' });
  const setLegend = () => put(legendEl, ...(st.look === 'real'
    ? [h('span', {}, sw_('wide', 'background:linear-gradient(90deg,rgb(255,70,0),rgb(255,175,85))'), 'Glowing hot gas'), h('span', {}, sw_('', 'background:rgb(90,140,255)'), 'Blue reaction zone (flame sheet)'), h('span', {}, sw_('round', 'background:#d9d7cf'), 'Fuel source, to scale')]
    : [h('span', {}, sw_('wide', 'background:linear-gradient(90deg,rgb(58,10,5),rgb(246,120,28),rgb(255,246,222))'), `Gas temperature, 300 to ${T_TOP} K`), h('span', {}, sw_('', 'background:rgb(160,200,255)'), 'Flame sheet'), h('span', {}, sw_('round', 'background:#d9d7cf'), 'Fuel source, to scale')]),
    showMM ? h('span', {}, sw_('dash', ''), 'Dashed flame sheet: Moon or Mars, model only') : null);
  const lookNote = h('p', { class: 'fl-look' });
  const setNote = () => put(lookNote, h('small', {}, st.look === 'real' ? 'Real look: the model\'s temperature grid drawn as light. Colour follows temperature; how bright and yellow the hot gas glows is scaled by the model\'s rise speed, which is our artistic choice, not a model output. Switch to Temperature for the exact numbers.' : 'Temperature map: every pixel is the model\'s gas temperature on a fixed scale.'));
  const playBtn = h('button', { type: 'button', class: 'btn fl-play' });
  const setBtn = () => {
    const c = calm();
    playBtn.textContent = playing && !c ? 'Pause' : 'Play';
    playBtn.setAttribute('aria-label', playing && !c ? 'Pause the tracer animation' : 'Play the tracer animation');
    playBtn.disabled = c;
    playBtn.title = c ? 'Motion is set to Calm in "Read your way", so the simulator shows still frames.' : '';
  };
  playBtn.addEventListener('click', () => { playing = !playing; setBtn(); if (animating()) start(); else { stop(); still(); } });
  const calmNote = h('small', { class: 'fl-calm' });

  const lookRow = seg({ label: 'View', options: [['real', 'Real look'], ['temp', 'Temperature map']], value: st.look, onChange: v => { st.look = v; setLegend(); setNote(); if (!animating()) still(); } });
  const gravSlot = h('div');
  const gravRow = () => {
    const row = seg({ label: 'Gravity', options: G.filter(x => showMM || !x.mm).map(x => [x.g, gLabel(x.g, x.mm)]), value: st.g, onChange: v => { st.g = v; show(); } });
    row.querySelectorAll('button').forEach(b => { if (G.find(x => x.g === b.dataset.v)?.mm) b.classList.add('mm'); });
    put(gravSlot, row);
  };
  const sw = moonMarsSwitch(v => (opts.onShowMM ? opts.onShowMM(v) : setShowMM(v)), { value: showMM });
  function setShowMM(v) {
    showMM = !!v; sw.set(showMM);
    if (!showMM && G.find(x => x.g === st.g)?.mm) st.g = G.find(x => !x.mm)?.g || '0 g';
    gravRow(); setLegend(); show();
  }
  const controls = h('div', { class: 'fl-controls' },
    sw, lookRow, seg({ label: 'Fuel', options: fuels.map(f => [f, f]), value: st.fuel, onChange: v => { st.fuel = v; show(); } }),
    gravSlot,
    seg({ label: 'Oxygen', options: [[0.21, '21%'], [0.34, '34%']], value: st.o2, onChange: v => { st.o2 = Number(v); show(); } }),
    seg({ label: 'Pressure', options: [[101.3, '101.3 kPa (sea level)'], [70.3, '70.3 kPa (exploration cabin)']], value: st.p, onChange: v => { st.p = Number(v); show(); } }),
    seg({ label: 'Airflow', options: flows.map(o => [o, o === 0 ? 'still air' : `${o} m/s`]), value: st.flow, onChange: v => { st.flow = Number(v); show(); } }));

  const srcText = f => (f.source.type === 'droplet' ? `${f.source.d0_mm} mm droplet` : `${f.source.Q_F_cm3_s} cm³/s gas jet`);
  function show() {
    const f = idx.get(`${st.fuel}|${st.g}|${st.o2}|${st.p}|${st.flow}`); if (!f) return;
    if (cur && f !== cur) { if (animating()) { prev = cur; from = view || viewOf(cur); t0 = performance.now(); } else prev = null; parts = []; }
    cur = f;
    const mm = modelOnly(f.gravity_label), gname = gLabel(f.gravity, mm);
    put(readout, 
      stat('Flame temperature', fmt(f.T_flame_K, 0), 'K'),
      stat('Shape (length ÷ width)', fmt(f.aspect, 1), f.aspect < 1.05 ? 'a sphere' : 'elongated'),
      stat('Buoyant rise speed', fmt(f.U_buoy_m_s, 2), 'm/s'),
      stat('Source', f.source.type === 'droplet' ? `${f.source.d0_mm} mm` : `${f.source.Q_F_cm3_s} cm³/s`, f.source.type === 'droplet' ? 'droplet' : 'gas jet'),
      stat('Tilt from vertical', fmt(f.tilt_deg_from_vertical, 0), '°'),
      stat('Stoichiometric mixture fraction', fmt(f.Z_st, 3)));
    readout.classList.toggle('mm', mm);
    const kind = f.source.type === 'droplet' ? 'liquid droplets' : 'gas flames', near = nearTests(gaps, kind, st.o2 * 100, st.p), word = kind === 'gas flames' ? 'gas-flame' : 'droplet';
    const domain = near == null ? h('p', { class: 'dom' }, 'NASA test conditions are not available yet (data/gaps.json missing).') : near > 0
      ? h('p', { class: 'dom ok' }, h('b', {}, 'Inside NASA\'s test conditions: '), `${near} NASA ${word} test${near > 1 ? 's' : ''} ran near ${Math.round(st.o2 * 100)}% oxygen and ${st.p} kPa.${mm ? ' None ran at this gravity.' : ''}`)
      : h('p', { class: 'dom out' }, h('b', {}, 'Outside NASA\'s test conditions: '), `no NASA ${word} test ran near ${Math.round(st.o2 * 100)}% oxygen and ${st.p} kPa. This view is the model alone, with nothing to check it against.`);
    put(labelBox, domain, h('p', { class: 'fl-valid' }, !mm
      ? [badge('model'), ' NASA has flame data at this gravity, and the checks below compare the model with it (some fail).']
      : [mmStamp(), ' Not validated: NASA has no flame data at this gravity. It lies between the microgravity and Earth results.']),
      mm ? h('p', { class: 'mm-note' }, fs.gravity_note || '') : null);
    const sumText = `${f.fuel}, ${srcText(f)}, ${gname}, ${Math.round(st.o2 * 100)}% oxygen, ${st.p} kPa, ${st.flow ? `${st.flow} m/s airflow` : 'still air'}. `
      + `The model gives a flame temperature of ${fmt(f.T_flame_K, 0)} K. Its flame is ${fmt(f.length_mm, 0)} mm long and ${fmt(f.width_mm, 0)} mm wide (length ÷ width ${fmt(f.aspect, 1)}, ${f.aspect < 1.05 ? 'a sphere' : 'elongated'}), `
      + `tilted ${fmt(f.tilt_deg_from_vertical, 0)}° from vertical, with a buoyant rise speed of ${fmt(f.U_buoy_m_s, 2)} m/s.${mm ? ' Model only, not validated.' : ''}`;
    summary.textContent = sumText;
    cv.setAttribute('aria-label', `Flame simulator, ${gname}: the model temperature grid. Use the arrow keys to read the gas temperature cell by cell, or open "Show the numbers".`);
    const was = tableSlot.querySelector('details')?.open;
    const nb = numbers('Flame simulator: the case on screen (model output)', ['Quantity', 'Value', 'Unit'], [
      ['Fuel', f.fuel, ''], ['Fuel source', f.source.type === 'droplet' ? f.source.d0_mm : f.source.Q_F_cm3_s, f.source.type === 'droplet' ? 'mm droplet' : 'cm³/s gas jet'],
      ['Gravity', gname, ''], ['Gravity, acceleration', f.g_m_s2, 'm/s²'], ['Oxygen', Math.round(f.X_O2 * 100), '%'], ['Pressure', f.P_kPa, 'kPa'], ['Airflow', f.flow_m_s, 'm/s'],
      ['Flame temperature', f.T_flame_K, 'K'], ['Flame length', f.length_mm, 'mm'], ['Flame width', f.width_mm, 'mm'], ['Shape (length ÷ width)', f.aspect, ''],
      ['Tilt from vertical', f.tilt_deg_from_vertical, '°'], ['Buoyant rise speed', f.U_buoy_m_s, 'm/s'], ['Stoichiometric mixture fraction', f.Z_st, ''],
      ['Validation', f.gravity_label, ''],
    ], 'The arrow keys on the picture read the full temperature grid, one cell at a time.');
    if (was) nb.open = true;
    put(tableSlot, nb);
    setItems(); nav.clear(); nav.index = -1; focusCell = -1;
    if (mounted) announce(`${f.fuel}, ${gname}: flame temperature ${fmt(f.T_flame_K, 0)} K, shape ${fmt(f.aspect, 1)}${mm ? ', model only' : ''}.`);
    if (!animating()) still();
  }

  if (!ctx.detached && typeof ctx.onMount === 'function') {
    ctx.onMount(() => {
      mounted = true; playing = !calm(); setBtn();
      calmNote.textContent = calm() ? 'Motion is Calm, so the simulator draws still frames. Change it in "Read your way".' : '';
      if ('IntersectionObserver' in window) { io = new IntersectionObserver(es => { visible = es.some(x => x.isIntersecting); if (animating()) start(); else stop(); }); io.observe(cv); }
      if (animating()) start(); else still();
    });
    ctx.onLeave?.(() => { mounted = false; stop(); io?.disconnect(); io = null; });
  }
  setBtn(); setLegend(); setNote(); gravRow(); show();

  // "2.2 to 2.8 times taller": read from roper_check (main typed the range in)
  const ratios = (fs.roper_check || []).map(r => r.ratio).filter(Number.isFinite);
  const roper = ratios.length ? `at 1 g the model runs ${fmt(Math.min(...ratios), 1)} to ${fmt(Math.max(...ratios), 1)} times taller than a published laminar-flame correlation` : 'at 1 g the model runs taller than a published laminar-flame correlation';
  const el = card('Flame simulator', fs.status, 'Pick a fuel, gravity, oxygen level, cabin pressure and airflow. Real look draws the model as light; Temperature map shows the exact gas temperatures. The blue line is the flame sheet, where fuel and oxygen meet in the right ratio.',
    h('div', { class: 'fl-sim' },
      h('div', { class: 'fl-left' }, cv, h('div', { class: 'fl-bar' }, playBtn, calmNote), legendEl, lookNote),
      h('div', { class: 'fl-right' }, controls, labelBox)),
    readout,
    h('div', { class: 'fl-sumwrap' }, summary, tableSlot),
    h('p', {}, h('small', {}, `Reduced-order model: a point fuel source in a uniform effective flow (forced air plus buoyant rise). Flame shapes follow the physics; absolute sizes do not: ${roper} (check S1-height, failed). Not combustion CFD.`)));
  el.setShowMM = setShowMM;
  return el;
}

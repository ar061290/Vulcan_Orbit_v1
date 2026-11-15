// Smoke drift figures for Predict it (package P4-B): the animated concentration map, the what-if runs, the check
// against the Saffire-III flight record, the robustness tables and the lattice Boltzmann second opinion.
// Data: data/drift.json, whatif.json, drift_calibration.json, drift_lbm.json, drift_whatif.json (all status "model").
// Every number on screen is read from those files. Interface: site/REBUILD_PLAN.md §2.12.
import { h, card, empty, fmt, sig, isMissing, tip, untip, stat, table, seg } from './lib.js';
import { C, SCREEN, lineChart, keyNav, numbers } from './charts.js';

// Sequential single-hue ramp on the dark surface: surface -> deep blue -> pale blue (verbatim from main's drift_ui.js).
const RAMP = [[26, 26, 25], [16, 66, 129], [37, 106, 191], [109, 167, 236], [205, 226, 251]];
const ramp = v => {
  const x = Math.max(0, Math.min(1, v)) * (RAMP.length - 1), i = Math.min(RAMP.length - 2, Math.floor(x)), f = x - i;
  return RAMP[i].map((a, k) => Math.round(a + (RAMP[i + 1][k] - a) * f));
};
const rgb = c => `rgb(${c[0]},${c[1]},${c[2]})`;
const pc = v => Math.round(v * 100) + '%';
const m = v => fmt(v, 2);                       // metres as written in the files (0.633 → "0.63")
const PLAY_MS = 120;                            // main: one frame per 120 ms

// ---------- shared helpers (also used by fig_cabin3d.js) ----------

/** A drift-shaped file the map can draw: grid size, cabin size, frames, fire and detectors. */
export const driftOK = d => !isMissing(d) && Array.isArray(d.frames) && d.frames.length > 0 && d.nx > 0 && d.ny > 0 &&
  d.lx_m > 0 && d.ly_m > 0 && Array.isArray(d.fire) && Array.isArray(d.detectors);

const DRIFT_SCHEMA = '{ "status":"model", "nx":40, "ny":20, "lx_m":4.0, "ly_m":2.0, "frame_dt_s":5, "flow_m_s":0.1,\n  "detectors":[{ "x":3.9, "y":0.6, "name":"Return duct", "alarm_s":40 }],\n  "frames":[[0,0,0.1, ...nx*ny values], ...] }';
export const driftEmpty = (title, file = 'drift') => card(title, 'missing', 'Smoke drift in a cabin with ventilation and no buoyancy.',
  empty('Waiting for the drift simulation', file, 'A grid of smoke concentration per time step, plus detector positions.', DRIFT_SCHEMA));

/** Frame byte (0-255) → mg/m³, the inverse of the file's own `scale` text
 *  ("value = 255 * log10(1 + 99*c/scale_max) / 2"; source: data/drift.json and data/drift_lbm.json `scale`).
 *  Returns null when the file states a different scale, so no concentration is shown rather than a wrong one. */
export function decoder(d) {
  const ok = /value\s*=\s*255\s*\*\s*log10\(\s*1\s*\+\s*99\s*\*\s*c\s*\/\s*scale_max\s*\)\s*\/\s*2/.test(d.scale || '') && d.scale_max_mg_m3 > 0;
  return ok ? v => d.scale_max_mg_m3 * (Math.pow(10, 2 * v / 255) - 1) / 99 : null;
}
const cellOf = (d, x, y) => {            // frames are stored row by row from the top (drift_lbm.json `scale` says so)
  const i = Math.min(d.nx - 1, Math.max(0, Math.floor(x / d.lx_m * d.nx)));
  const j = Math.min(d.ny - 1, Math.max(0, Math.floor((d.ly_m - y) / d.ly_m * d.ny)));
  return j * d.nx + i;
};
const tOf = (d, k) => k * (d.frame_dt_s ?? 0);
const detState = (det, t) => det.alarm_s == null ? 'no alarm' : t >= det.alarm_s ? `alarm at ${fmt(det.alarm_s, 0)} s` : 'quiet';

/** Values the map shows at frame k: densest cell, share above the alarm level, smoke at each detector's cell. */
export function frameValues(d, k) {
  const fr = d.frames[k] || [], dec = decoder(d);
  let best = 0;
  for (let p = 1; p < fr.length; p++) if (fr[p] > fr[best]) best = p;
  const peak = { x: (best % d.nx + 0.5) * d.lx_m / d.nx, y: d.ly_m - (Math.floor(best / d.nx) + 0.5) * d.ly_m / d.ny, c: dec ? dec(fr[best] ?? 0) : null, v: fr[best] ?? 0 };
  const above = dec && d.alarm_mg_m3 != null && fr.length ? fr.filter(v => dec(v) >= d.alarm_mg_m3).length / fr.length : null;
  const dets = d.detectors.map(det => ({ ...det, c: dec ? dec(fr[cellOf(d, det.x, det.y)] ?? 0) : null }));
  return { t: tOf(d, k), peak, above, dets };
}
const conc = c => c == null ? 'n/a' : c < 0.005 ? 'below 0.01' : sig(c, 2);

/** One-paragraph text summary of frame k (D5.6), built from the same values the map draws. */
export function driftSummary(d, k) {
  const v = frameValues(d, k);
  const head = `At ${fmt(v.t, 0)} s after the fire starts (${fmt(d.fire[0], 2)} m along, ${fmt(d.fire[1], 2)} m up${d.rate_mg_s != null ? `, ${fmt(d.rate_mg_s, 3)} mg/s of smoke` : ''}):`;
  const peak = v.peak.v > 0
    ? ` the densest smoke is ${m(v.peak.x)} m along and ${m(v.peak.y)} m up${v.peak.c != null ? `, about ${conc(v.peak.c)} mg/m³` : ''}.`
    : ' there is no smoke on the map yet.';
  const above = v.above != null ? ` Smoke at or above the ${fmt(d.alarm_mg_m3, 2)} mg/m³ alarm level covers ${pc(v.above)} of the section.` : '';
  const dets = ' ' + v.dets.map((x, i) => `Detector ${i + 1} (${x.name}): ${detState(x, v.t)}${x.c != null ? `, about ${conc(x.c)} mg/m³ in its grid cell` : ''}.`).join(' ');
  return head + peak + above + dets;
}

/** "Show the numbers" for a drift file: every frame, the densest cell and the smoke at each detector. */
export function driftNumbers(d, caption) {
  const dec = decoder(d);
  const heads = ['Time (s)', 'Densest cell (mg/m³)', ...d.detectors.map((x, i) => `${i + 1}. ${x.name} (mg/m³)`), ...d.detectors.map((x, i) => `${i + 1}. state`)];
  const rows = d.frames.map((_, k) => { const v = frameValues(d, k); return [v.t, conc(v.peak.c), ...v.dets.map(x => conc(x.c)), ...v.dets.map(x => detState(x, v.t))]; });
  const note = (dec ? 'Concentrations are read back from the file\'s 8-bit log-scale frames, so they are rounded; a value is the smoke in the grid cell that holds the detector. ' : 'The file states no scale this page can read, so no concentration is shown. ') +
    (d.detector_delay_s != null ? `Alarm times include the ${fmt(d.detector_delay_s, 0)} s detector delay in the file.` : '');
  return numbers(caption || 'Smoke at each detector, every frame', heads, rows, note);
}

// ---------- 1. Where the smoke goes (also "Second opinion: a cabin with racks") ----------

/** Animated concentration map. opts: {title, sub, file}. Starts nothing on its own; Play is a user action and stops in ctx.onLeave. */
export function driftCard(d, { title = 'Where the smoke goes', sub = null, file = 'drift' } = {}, ctx) {
  if (!driftOK(d)) return driftEmpty(title, file);
  const n = d.frames.length, W = 720, H = Math.round(W * d.ly_m / d.lx_m), X = x => x / d.lx_m * W, Y = y => H - y / d.ly_m * H;
  const cv = h('canvas', { width: W, height: H, class: 'drift-canvas' });
  const g = cv.getContext('2d');
  const off = document.createElement('canvas'); off.width = d.nx; off.height = d.ny;
  const og = off.getContext('2d'), img = og ? og.createImageData(d.nx, d.ny) : null;
  const sid = `drift-t-${Math.random().toString(36).slice(2, 8)}`;
  let k = Math.floor(n * 0.12), playing = false, timer = 0;   // open on a frame with smoke in it (main: 12 %)
  const slider = h('input', { type: 'range', id: sid, min: 0, max: n - 1, step: 1, value: k, class: 'drift-slider' });
  const tOut = h('output', { class: 'drift-time', for: sid }, '0 s');
  const btn = h('button', { type: 'button', class: 'chip drift-play', 'aria-pressed': false }, 'Play');
  const rows = h('div', { class: 'grid g3 drift-dets' });
  const summary = h('p', { class: 'drift-sum' });

  function draw() {
    const fr = d.frames[k], t = tOf(d, k);
    if (g && img) {
      for (let p = 0; p < fr.length; p++) { const [r, gg, b] = ramp(fr[p] / 255); img.data[p * 4] = r; img.data[p * 4 + 1] = gg; img.data[p * 4 + 2] = b; img.data[p * 4 + 3] = 255; }
      og.putImageData(img, 0, 0); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(off, 0, 0, W, H);
      g.strokeStyle = 'rgba(240,239,236,.22)'; g.lineWidth = 1;                         // airflow arrows
      for (const [x, y, u, v] of d.arrows || []) {
        const s = 140, x0 = X(x), y0 = Y(y), x1 = x0 + u * s, y1 = y0 - v * s, a = Math.atan2(y1 - y0, x1 - x0);
        g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.lineTo(x1 - 5 * Math.cos(a - .5), y1 - 5 * Math.sin(a - .5)); g.moveTo(x1, y1); g.lineTo(x1 - 5 * Math.cos(a + .5), y1 - 5 * Math.sin(a + .5)); g.stroke();
      }
      g.fillStyle = '#2f2f2c'; g.strokeStyle = '#4a4a46'; g.lineWidth = 1;
      for (const [x0, x1, y0, y1] of d.racks || []) { g.fillRect(X(x0), Y(y1), X(x1) - X(x0), Y(y0) - Y(y1)); g.strokeRect(X(x0), Y(y1), X(x1) - X(x0), Y(y0) - Y(y1)); }
      const opening = (wall, ab, label) => {
        if (!Array.isArray(ab)) return;
        const [a, b] = ab;
        g.fillStyle = C.s3; g.font = '12px system-ui';
        if (wall === 'top' || wall === 'bottom') { const y = wall === 'top' ? 0 : H - 5; g.fillRect(X(a * d.lx_m), y, X(b * d.lx_m) - X(a * d.lx_m), 5); g.fillStyle = SCREEN.ink; g.fillText(label, X(a * d.lx_m), wall === 'top' ? 18 : H - 10); }
        else { const x = wall === 'right' ? W - 5 : 0; g.fillRect(x, Y(b * d.ly_m), 5, Y(a * d.ly_m) - Y(b * d.ly_m)); g.fillStyle = SCREEN.ink; g.save(); g.translate(wall === 'right' ? W - 10 : 16, Y(a * d.ly_m) - 4); g.rotate(-Math.PI / 2); g.fillText(label, 0, 0); g.restore(); }
      };
      opening(d.supply_wall || 'top', d.supply, 'air supply'); opening(d.return_wall || 'right', d.ret, 'air return');
      g.fillStyle = C.s2; g.beginPath(); g.arc(X(d.fire[0]), Y(d.fire[1]), 6, 0, 6.283); g.fill(); g.strokeStyle = SCREEN.surface; g.lineWidth = 2; g.stroke();
      g.fillStyle = SCREEN.ink; g.font = '12px system-ui'; g.fillText('fire', X(d.fire[0]) + 10, Y(d.fire[1]) + 4);
      d.detectors.forEach((det, i) => {
        const on = det.alarm_s != null && t >= det.alarm_s, x = Math.min(W - 12, Math.max(12, X(det.x))), y = Math.min(H - 12, Math.max(12, Y(det.y)));
        g.beginPath(); g.arc(x, y, 8, 0, 6.283); g.fillStyle = on ? C.warn : 'rgba(0,0,0,.55)'; g.fill(); g.strokeStyle = SCREEN.ink; g.lineWidth = 2; g.stroke();
        g.fillStyle = on ? '#0b0b0b' : SCREEN.ink; g.font = '600 11px system-ui'; g.textAlign = 'center'; g.fillText(String(i + 1), x, y + 4); g.textAlign = 'left'; g.font = '12px system-ui';
      });
    }
    tOut.textContent = `${fmt(t, 0)} s`; slider.value = String(k); slider.setAttribute('aria-valuetext', `${fmt(t, 0)} s`);
    rows.replaceChildren(...d.detectors.map((det, i) => {
      const on = det.alarm_s != null && t >= det.alarm_s;
      const box = stat(`${i + 1}. ${det.name}`, detState(det, t));
      if (on) box.classList.add('drift-on');
      return box;
    }));
    summary.textContent = driftSummary(d, k);
  }
  const stop = () => { playing = false; clearInterval(timer); timer = 0; btn.textContent = 'Play'; btn.setAttribute('aria-pressed', 'false'); };
  btn.addEventListener('click', () => {
    if (playing) return stop();
    if (k >= n - 1) k = 0;
    playing = true; btn.textContent = 'Pause'; btn.setAttribute('aria-pressed', 'true');
    timer = setInterval(() => { if (!cv.isConnected || k >= n - 1) return stop(); if (document.hidden) return; k++; draw(); }, PLAY_MS);   // a hidden tab holds the frame
  });
  slider.addEventListener('input', () => { stop(); k = +slider.value; draw(); });
  ctx?.onLeave?.(stop);
  draw();

  // keyboard reading of the canvas: fire, each detector, the openings and the densest smoke (values of the current frame)
  const at = (x, y) => () => { const r = cv.getBoundingClientRect(); return { x: r.left + Math.min(W - 12, Math.max(12, X(x))) / W * r.width, y: r.top + Math.min(H - 12, Math.max(12, Y(y))) / H * r.height }; };
  const wallTxt = (wall, ab) => Array.isArray(ab) ? ((wall === 'top' || wall === 'bottom') ? `${wall === 'top' ? 'ceiling' : 'floor'}, ${m(ab[0] * d.lx_m)} to ${m(ab[1] * d.lx_m)} m along` : `${wall} wall, ${m(ab[0] * d.ly_m)} to ${m(ab[1] * d.ly_m)} m up`) : null;
  const wallAt = (wall, ab) => (wall === 'top' || wall === 'bottom') ? at((ab[0] + ab[1]) / 2 * d.lx_m, wall === 'top' ? d.ly_m : 0) : at(wall === 'right' ? d.lx_m : 0, (ab[0] + ab[1]) / 2 * d.ly_m);
  const items = [
    { html: `<b>Fire (smoke source)</b><br>${m(d.fire[0])} m along, ${m(d.fire[1])} m up${d.rate_mg_s != null ? `<br>${fmt(d.rate_mg_s, 3)} mg/s of smoke` : ''}`, anchor: at(d.fire[0], d.fire[1]) },
    ...d.detectors.map((det, i) => ({
      get html() { const v = frameValues(d, k), x = v.dets[i]; return `<b>${i + 1}. ${det.name}</b><br>${m(det.x)} m along, ${m(det.y)} m up<br>At ${fmt(v.t, 0)} s: ${detState(det, v.t)}${x.c != null ? `, about ${conc(x.c)} mg/m³` : ''}`; },
      anchor: at(det.x, det.y) })),
    ...(Array.isArray(d.supply) ? [{ html: `<b>Air supply</b><br>${wallTxt(d.supply_wall || 'top', d.supply)}`, anchor: wallAt(d.supply_wall || 'top', d.supply) }] : []),
    ...(Array.isArray(d.ret) ? [{ html: `<b>Air return</b><br>${wallTxt(d.return_wall || 'right', d.ret)}`, anchor: wallAt(d.return_wall || 'right', d.ret) }] : []),
    { get html() { const v = frameValues(d, k); return v.peak.v > 0 ? `<b>Densest smoke at ${fmt(v.t, 0)} s</b><br>${m(v.peak.x)} m along, ${m(v.peak.y)} m up${v.peak.c != null ? `<br>about ${conc(v.peak.c)} mg/m³` : ''}` : `<b>At ${fmt(v.t, 0)} s</b><br>no smoke on the map yet`; },
      anchor: () => { const v = frameValues(d, k); return at(v.peak.x, v.peak.y)(); } },
  ];
  keyNav(cv, items, { label: 'Animated map of smoke concentration in the cabin. Arrow keys read the fire, the detectors, the air openings and the densest smoke at the current time' });

  const lid = `${sid}-l`;
  return card(title, d.status, sub || `Side view of a ${fmt(d.lx_m, 2)} m by ${fmt(d.ly_m, 2)} m cabin section, airflow ${fmt(d.flow_m_s, 3)} m/s, smoke released at ${fmt(d.rate_mg_s, 3)} mg/s. No buoyancy.`,
    h('div', { class: 'row drift-ctl' }, btn, h('label', { for: sid, id: lid, class: 'drift-tlabel' }, 'Time'), slider, tOut),
    cv,
    h('div', { class: 'legend' },
      h('span', { class: 'lg-item' }, h('i', { class: 'drift-sw drift-sw-ramp', style: `background:linear-gradient(90deg,${rgb(RAMP[1])},${rgb(RAMP[4])})` }), `Smoke, up to ${fmt(d.scale_max_mg_m3, 2)} mg/m³ (log scale)`),
      h('span', { class: 'lg-item' }, h('i', { class: 'drift-sw drift-sw-dot', style: `background:${C.warn}` }), `Detector in alarm (${fmt(d.alarm_mg_m3, 2)} mg/m³)`),
      h('span', { class: 'lg-item' }, h('i', { class: 'drift-sw drift-sw-dot', style: `background:${C.s2}` }), 'Fire'),
      h('span', { class: 'lg-item' }, h('i', { class: 'drift-sw', style: `background:${C.s3}` }), 'Supply and return')),
    // a second drift card on the page (the racks cabin) names itself, so the two table regions have distinct labels
    rows, summary, driftNumbers(d, title === 'Where the smoke goes' ? undefined : `Smoke at each detector, every frame: ${title}`),
    Array.isArray(d.assumptions) && d.assumptions.length ? h('p', {}, h('small', {}, d.assumptions.join('. ') + '.')) : null);
}

// ---------- blind-spot map (whatif and drift_whatif) ----------

const MISS_BG = 'repeating-linear-gradient(135deg,#3a1616 0 5px,#241010 5px 10px)';
/** Positioned cells with a keyboard walk, a text summary and a table. cells: [{x, y, v}] (v = seconds, null = usually missed). */
function blindMap({ title, cells, dets, lx, ly, cw, ch, word }) {
  const vals = cells.map(c => c.v).filter(v => v != null), vmax = Math.max(60, ...vals);   // main: colour scale floor 60 s
  const order = cells.map((c, i) => i).sort((a, b) => cells[b].y - cells[a].y || cells[a].x - cells[b].x);   // top row first
  const tipHtml = c => `Fire at ${c.x} m along, ${c.y} m up<br><b>${c.v == null ? 'usually not detected' : `${word} ${c.v} s`}</b>`;
  const els = cells.map(c => {
    const miss = c.v == null;
    const el = h('div', { class: `drift-cell${miss ? ' drift-miss' : ''}`, style: `left:calc(${c.x / lx * 100}% - ${cw / 2}% + 1px);bottom:calc(${c.y / ly * 100}% - ${ch / 2}% + 1px);width:calc(${cw}% - 2px);height:calc(${ch}% - 2px);background:${miss ? MISS_BG : rgb(ramp(1 - 0.85 * c.v / vmax))}` });
    el.addEventListener('pointermove', e => tip(e, tipHtml(c))); el.addEventListener('pointerleave', untip);
    return el;
  });
  const box = h('div', { class: 'drift-map', style: `aspect-ratio:${lx}/${ly}` }, ...els,
    ...dets.map(([x, y]) => h('div', { class: 'drift-det', title: 'detector', style: `left:calc(${x / lx * 100}% - 8px);bottom:calc(${y / ly * 100}% - 8px)` })));
  const rowsOf = [...new Set(order.map(i => cells[i].y))].length, colsOf = cells.length / rowsOf;
  keyNav(box, order.map(i => ({ html: tipHtml(cells[i]), anchor: els[i] })), { label: `${title}. ${cells.length} possible fire positions`, cols: Number.isInteger(colsOf) ? colsOf : undefined });
  const missed = cells.filter(c => c.v == null).length;
  const fast = vals.length ? cells.filter(c => c.v === Math.min(...vals)) : [], slow = vals.length ? cells.filter(c => c.v === Math.max(...vals)) : [];
  const median = vals.length ? [...vals].sort((a, b) => a - b)[Math.floor((vals.length - 1) / 2)] : null;
  const sum = `${title}: ${missed} of ${cells.length} fire positions are usually not detected.` +
    (vals.length ? ` Where a fire is detected, the typical alarm comes after ${fmt(Math.min(...vals), 0)} s at best (fire at ${fast[0].x} m along, ${fast[0].y} m up) and ${fmt(Math.max(...vals), 0)} s at worst (${slow[0].x} m along, ${slow[0].y} m up); the middle value is ${fmt(median, 0)} s.` : '') +
    ` ${dets.length} detector${dets.length === 1 ? '' : 's'}: ${dets.map(([x, y]) => `${x} m along, ${y} m up`).join('; ')}.`;
  return [box,
    h('div', { class: 'legend' },
      h('span', { class: 'lg-item' }, h('i', { class: 'drift-sw', style: `background:${rgb(ramp(1))}` }), 'Detected fast'),
      h('span', { class: 'lg-item' }, h('i', { class: 'drift-sw', style: `background:${rgb(ramp(0.2))}` }), `Slow (up to ${fmt(vmax, 0)} s)`),
      h('span', { class: 'lg-item' }, h('i', { class: 'drift-sw drift-sw-miss' }), 'Usually missed'),
      h('span', { class: 'lg-item' }, h('i', { class: 'drift-sw drift-sw-dot drift-sw-det' }), 'Detector')),
    h('p', { class: 'drift-sum' }, sum),
    numbers(title, ['Fire position', 'Along (m)', 'Up (m)', 'Typical time to alarm (s)'], order.map((i, r) => [String(r + 1), cells[i].x, cells[i].y, cells[i].v == null ? 'usually not detected' : cells[i].v]))];
}

// ---------- 2. What if the fire starts somewhere else? ----------

// source: 10 mg/m³ ISS-like alarm level, NTRS 20170002629 (main's drift_ui.js text and MADE inputs); used only if the file lacks alarm_hi_mg_m3
const ISS_ALARM = 10;
const WHATIF_SCHEMA = '{ "status":"model", "runs":4000, "t_end_s":360, "lx_m":4, "ly_m":2, "map_nx":12, "map_ny":6,\n  "map_xy":[[x,y], ...], "varied":{ "airflow_m_s":[...], "release_mg_s":"..." },\n  "layouts":[{ "name":"...", "caught_120":0.5, "caught_120_range":[0.4,0.6], "never":0.4, "map":[seconds per position; a missed position left empty, ...], "detectors":[[x,y]] }] }';

export function whatifCard(w) {
  const title = 'What if the fire starts somewhere else?';
  if (isMissing(w) || !Array.isArray(w.layouts) || !w.layouts.length)
    return card(title, 'missing', 'Thousands of simulated fires at random positions, and how often each detector layout catches them.',
      empty('Waiting for the what-if runs', 'whatif', 'Shares of simulated fires caught within a time, per detector layout, plus a map of time to alarm.', WHATIF_SCHEMA));
  const label = { caught_60: 'within 60 s', caught_120: 'within 2 min', caught_300: 'within 5 min' };   // 10 mg/m³ shares exist for 2 and 5 min
  const wins = Object.keys(label).filter(kx => w.layouts.some(L => L[kx] != null));
  let win = wins.includes('caught_120') ? 'caught_120' : wins[0], sel = Math.min(1, w.layouts.length - 1);   // main: default layout index 1, "At the air return"
  const holder = h('div');
  function draw(focusSel = false) {
    const bars = h('div', { class: 'drift-layouts' }, ...w.layouts.map((L, i) => {
      const r = L.caught_120_model_range || L.caught_120_range;
      return h('button', { type: 'button', class: 'drift-q', 'aria-pressed': i === sel, onclick: () => { sel = i; draw(true); } },
        h('span', { class: 'drift-q-head' }, h('span', {}, L.name), h('b', {}, L[win] == null ? 'n/a' : pc(L[win]))),
        h('span', { class: 'drift-track', 'aria-hidden': 'true' }, h('i', { style: `width:${(L[win] || 0) * 100}%` })),
        L[win + '_at_10mg'] != null ? h('small', { class: 'drift-warn' }, `At the ISS-like ${fmt(w.alarm_hi_mg_m3 ?? ISS_ALARM, 0)} mg/m³ alarm level: ${pc(L[win + '_at_10mg'])}`) : null,
        h('small', {}, (L.never != null && w.t_end_s != null ? `not caught within ${Math.round(w.t_end_s / 60)} min: ${pc(L.never)}` : '') +
          (win === 'caught_120' && r ? `; ${Math.round(r[0] * 100)} to ${Math.round(r[1] * 100)}% across the settings the flight data allows` : '')));
    }));
    const L = w.layouts[sel];
    const map = Array.isArray(L.map) && Array.isArray(w.map_xy) && w.map_nx && w.map_ny && w.lx_m && w.ly_m
      ? blindMap({ title: `Blind-spot map: ${L.name}`, cells: w.map_xy.map(([x, y], i) => ({ x, y, v: L.map[i] ?? null })), dets: L.detectors || [], lx: w.lx_m, ly: w.ly_m, cw: 100 / w.map_nx, ch: 100 / w.map_ny, word: 'typical time to alarm' })
      : [h('p', {}, h('small', {}, 'This layout has no blind-spot map in data/whatif.json.'))];
    holder.replaceChildren(bars, h('h3', { class: 'drift-h3' }, `Blind-spot map: ${L.name}`), ...map,
      h('p', {}, h('small', {}, 'Each square is a place a fire could start; its colour is the typical time until that layout raises an alarm.')));
    if (focusSel) holder.querySelectorAll('.drift-q')[sel]?.focus();
  }
  draw();
  const chips = seg({ label: 'Count a fire as caught if the alarm comes', options: wins.map(kx => [kx, label[kx]]), value: win, onChange: kx => { win = kx; draw(); } });
  const v = w.varied || {}, dur = Array.isArray(v.fire_duration_s) && v.fire_duration_s.length ? v.fire_duration_s : null;
  return card(title, w.status,
    `${fmt(w.runs, 0)} simulated fires: random position, airflow ${(v.airflow_m_s || []).join(', ')} m/s, smoke release ${v.release_mg_s ?? 'n/a'} mg/s` +
      (dur ? `, burning for times measured on Saffire-I and II (${Math.min(...dur)} to ${Math.max(...dur)} s).` : '.'),
    chips, holder, w.note ? h('p', {}, h('small', {}, w.note)) : null);
}

// ---------- 3. Checked against a real spacecraft fire ----------

const CAL_SCHEMA = '{ "status":"model", "best":{ "burn_r2":0.9 }, "clearance_s_range":[lo,hi], "delay_s_range":[lo,hi],\n  "pulse":{ "observed_peak_s":43, "model_peak_s_range":[lo,mid,hi] },\n  "burn_curve":{ "t":[], "lo":[], "hi":[], "best":[], "obs_t":[], "obs":[], "flame":[on,off] },\n  "pulse_curve":{ "t":[], "lo":[], "hi":[], "best":[], "obs_t":[], "obs":[], "wire":[on,off] } }';

export function calibrationCard(c) {
  const title = 'Checked against a real spacecraft fire';
  if (isMissing(c) || !c.burn_curve || !c.pulse_curve || !c.best)
    return card(title, 'missing', 'The smoke model tuned on one Saffire-III burn and tested on an event it never saw.',
      empty('Waiting for the calibration', 'drift_calibration', 'Model and flight detector curves for the tuning burn and the held-out smoke puff.', CAL_SCHEMA));
  const band = cv => cv.t.map((t, i) => [t, cv.lo[i], cv.hi[i]]);
  const pts = (t, y) => t.map((x, i) => [x, y[i]]);
  const burn = lineChart({ title: 'Tuned on: Sample 1 burn', xLabel: 'Seconds after T0', yLabel: 'Detector signal', legend: false,
    markers: [{ x: c.burn_curve.flame?.[0], label: 'flame on', color: C.s2 }, { x: c.burn_curve.flame?.[1], label: 'flame out', color: C.s2, dy: 14 }],
    series: [{ name: 'Model (best fit)', color: C.s1, points: pts(c.burn_curve.t, c.burn_curve.best), band: band(c.burn_curve) },
             { name: 'Flight detector', color: C.s4, dots: true, near: 6, points: pts(c.burn_curve.obs_t, c.burn_curve.obs) }] });
  const p = c.pulse || {};
  const pulse = lineChart({ title: 'Tested on: smoke-wire puff (held out)', xLabel: 'Seconds after T0', yLabel: 'Detector signal', legend: false,
    markers: [{ x: c.pulse_curve.wire?.[0], label: 'smoke wire on', color: C.s2 }],
    series: [{ name: 'Model, never tuned on this', color: C.s1, points: pts(c.pulse_curve.t, c.pulse_curve.best), band: band(c.pulse_curve) },
             { name: 'Flight detector', color: C.s4, dots: true, near: 6, points: pts(c.pulse_curve.obs_t, c.pulse_curve.obs) }] });
  const lg = h('div', { class: 'legend' },
    h('span', { class: 'lg-item' }, h('i', { class: 'drift-sw drift-sw-line', style: `background:${C.s1}` }), 'Model, best setting'),
    h('span', { class: 'lg-item' }, h('i', { class: 'drift-sw', style: `background:${C.s1};opacity:.3` }), 'Every setting the record cannot rule out'),
    h('span', { class: 'lg-item' }, h('i', { class: 'drift-sw drift-sw-sq', style: `background:${C.s4}` }), 'Flight detector reading'));
  const r = p.model_peak_s_range;
  return card(title, c.status, 'Saffire-III flew a real fire inside a Cygnus cargo ship. We tuned the drift model on the burn and tested it on a smoke puff it never saw.',
    h('div', { class: 'grid g3 drift-stats' },
      stat('Fit to the burn (R²)', c.best.burn_r2 == null ? 'n/a' : Number(c.best.burn_r2).toFixed(2)),
      stat('Smoke cleared in', Array.isArray(c.clearance_s_range) ? `${fmt(c.clearance_s_range[0], 0)}–${fmt(c.clearance_s_range[1], 0)} s` : 'n/a'),
      stat('Held-out puff: peak', p.observed_peak_s == null ? 'n/a' : `${Math.round(p.observed_peak_s)} s`,
        [Array.isArray(r) ? `model ${Math.round(r[0])}–${Math.round(r[r.length - 1])} s` : null, p.shape_r2_median != null ? `shape R² ${Number(p.shape_r2_median).toFixed(2)}` : null].filter(Boolean).join('; '))),
    // feat/v3-merge: the tuned and the held-out charts sit side by side on wide screens (css/p-predict.css .drift-cal2)
    h('div', { class: 'drift-cal2' },
      h('div', {}, h('h3', {}, 'Tuned on: Sample 1 burn'), burn),
      h('div', {}, h('h3', { class: 'drift-h3' }, 'Tested on: smoke-wire puff (held out)'), pulse)), lg,
    h('p', {}, h('small', {}, `${c.settings_kept} of ${c.settings_tried} settings fit the burn equally well; all of them feed the what-if runs.` +
      (Array.isArray(c.delay_s_range) ? ` Detector delay ${fmt(c.delay_s_range[0], 0)}–${fmt(c.delay_s_range[1], 0)} s. ` : ' ') + (c.limits || []).join(' ') + ' Source: NASA PSI-100, CC0.')));
}

// ---------- 4. What actually decides if a fire is caught? ----------

export function robustCard(w) {
  const title = 'What actually decides if a fire is caught?';
  if (isMissing(w) || !Array.isArray(w.robustness))
    return card(title, 'missing', 'The what-if runs repeated in three cabin layouts and split by how much smoke the fire makes.',
      empty('Waiting for the robustness runs', 'whatif', isMissing(w) ? 'The what-if file is missing.' : 'data/whatif.json has no "robustness" block yet.',
        '{ "robustness":[{ "cabin":"A", "label":"...", "ceiling_120":0.45, "ceiling_range":[lo,hi], "return_120":0.49, "return_range":[lo,hi], "pair_120":0.52 }] }'));
  const rr = r => Array.isArray(r) ? h('small', {}, ` ${pc(r[0])}–${pc(r[1])}`) : null;
  const A = (w.layouts || []).find(L => L.name === 'At the air return'), Cl = (w.layouts || []).find(L => L.name.startsWith('Ceiling'));
  const sizeRows = A && Cl && Array.isArray(A.by_rate) && Array.isArray(Cl.by_rate)
    ? A.by_rate.map((b, k) => [k === A.by_rate.length - 1 ? `over ${b.lo} mg/s` : `${b.lo}–${b.hi} mg/s`, Cl.by_rate[k] ? pc(Cl.by_rate[k].caught_120) : 'n/a', pc(b.caught_120)]) : [];
  return card(title, w.status, 'Share of simulated fires caught within 2 minutes. Small ranges: across the settings the flight data cannot rule out.',
    h('h3', {}, 'Detector position, in three different cabins'),
    table(['Cabin', 'Ceiling, mid-cabin', 'At the air return', 'Best pair'],
      w.robustness.map(r => [h('span', {}, h('b', {}, r.cabin), ' ', h('small', {}, r.label)), h('span', {}, pc(r.ceiling_120), rr(r.ceiling_range)), h('span', {}, pc(r.return_120), rr(r.return_range)), pc(r.pair_120)]),
      { caption: 'Share caught within 2 minutes, by detector position and cabin' }),
    sizeRows.length ? h('h3', { class: 'drift-h3' }, 'How much smoke the fire makes (cabin A)') : null,
    sizeRows.length ? table(['Smoke release', 'Ceiling', 'Air return'], sizeRows, { caption: 'Share caught within 2 minutes, by smoke release (cabin A)' }) : null,
    h('p', {}, h('small', {}, 'Once the air is recirculated and mixed the way the flight data says it is, where the detector sits matters less than how much smoke the fire makes. Small smouldering sources often never reach the alarm level anywhere: that is the case for sensing closer to the source.')));
}

// ---------- 5. Second opinion: agreement text, and the LBM what-if ----------

/** The agreement share from drift_whatif.json check X-agree ("alarm vs no alarm agree on 94% of 64 fire-detector pairs …") → "94%", or null. */
export function lbmAgreement(dw) {
  if (isMissing(dw) || !Array.isArray(dw.checks)) return null;
  const c = dw.checks.find(x => x && x.id === 'X-agree');
  const mm = c && /agree on\s+(\d+(?:\.\d+)?)\s*%/i.exec(String(c.result || ''));
  return mm ? `${mm[1]}%` : null;
}

const spacing = vs => { const u = [...new Set(vs)].sort((a, b) => a - b); let s = Infinity; for (let i = 1; i < u.length; i++) s = Math.min(s, u[i] - u[i - 1]); return Number.isFinite(s) ? s : null; };

/** lx, ly: the cabin size from data/drift_lbm.json (lx_m, ly_m). Without them the blind-spot map is not drawn. */
export function lbmWhatifCard(dw, lx, ly) {
  const title = 'What if the fire starts somewhere else? (cabin with racks)';
  if (isMissing(dw) || !Array.isArray(dw.layouts) || !dw.layouts.length)
    return card(title, 'missing', 'Simulated fires in the lattice Boltzmann cabin with racks.',
      empty('Waiting for the cabin-with-racks runs', 'drift_whatif', 'Shares of simulated fires caught within 60 s and 3 min for the best and worst detector layouts.',
        '{ "status":"model", "runs":524, "varied":{ "fire_position":"...", "flow_m_s":[...], "release_mg_s":"..." },\n  "layouts":[{ "name":"Best 3 found", "caught_60":0.47, "caught_60_range":[lo,hi], "caught_180":0.65, "caught_180_range":[lo,hi], "detectors":[[x,y]] }],\n  "by_rate":[{ "rate_mg_s":0.2, "best_caught_180":1 }], "map_xy":[[x,y]], "map_median_alarm_s_best":[seconds per position; a missed position left empty] }'));
  const WL = { caught_60: 'within 60 s', caught_180: 'within 3 min' };
  const best = dw.layouts[0], v = dw.varied || {};
  const bar = (L, key) => L[key] == null ? null : h('div', { class: 'drift-bar' },
    h('div', { class: 'drift-q-head' }, h('span', {}, L.name, ' · ', WL[key]), h('b', {}, pc(L[key]))),
    h('span', { class: 'drift-track', 'aria-hidden': 'true' }, h('i', { style: `width:${L[key] * 100}%` })),
    Array.isArray(L[key + '_range']) ? h('small', {}, `range ${pc(L[key + '_range'][0])}–${pc(L[key + '_range'][1])}`) : null);
  const byRate = Array.isArray(dw.by_rate) ? dw.by_rate : [];
  let map;
  if (lx > 0 && ly > 0 && Array.isArray(dw.map_xy) && Array.isArray(dw.map_median_alarm_s_best)) {
    const dx = spacing(dw.map_xy.map(p => p[0])), dy = spacing(dw.map_xy.map(p => p[1]));
    map = blindMap({ title: `Blind-spot map, best ${(best.detectors || []).length} detectors`, cells: dw.map_xy.map(([x, y], i) => ({ x, y, v: dw.map_median_alarm_s_best[i] ?? null })),
      dets: best.detectors || [], lx, ly, cw: (dx || lx) / lx * 100, ch: (dy || ly) / ly * 100, word: 'typical alarm' });
  } else map = [h('p', {}, h('small', {}, 'The blind-spot map needs the cabin size from data/drift_lbm.json, which is not available.'))];
  const maxRate = byRate.length ? Math.max(...byRate.map(b => b.rate_mg_s)) : null;
  const assumed = maxRate != null && /high end assumed/i.test(String(v.release_mg_s || '')) ? ` The ${fmt(maxRate, 1)} mg/s upper release rate is assumed, not measured.` : '';
  return card(title, dw.status,
    `${fmt(dw.runs, 0)} simulated fires${dw.gravity_m_s2 === 0 ? ' at 0 g' : ''} with the lattice Boltzmann air model: ${v.fire_position ?? 'n/a'}, airflow ${(v.flow_m_s || []).join(', ')} m/s, smoke release ${v.release_mg_s ?? 'n/a'}.`,
    h('div', { class: 'grid g2 drift-g2' },
      h('div', {}, ...dw.layouts.slice(0, 2).flatMap(L => [bar(L, 'caught_60'), bar(L, 'caught_180')])),
      byRate.length ? h('div', {}, h('h3', { class: 'drift-h3 drift-h3-top' }, 'Smoke release decides it'),
        table(['Release', 'Caught in 3 min, best layout'], byRate.map(b => [`${fmt(b.rate_mg_s, b.rate_mg_s < 0.1 ? 3 : 1)} mg/s`, pc(b.best_caught_180)]), { caption: 'Share caught within 3 minutes by the best layout, by smoke release' })) : null),
    h('h3', { class: 'drift-h3' }, `Blind-spot map, best ${(best.detectors || []).length} detectors`), ...map,
    h('p', {}, h('small', {}, (dw.note || '') + assumed)));
}

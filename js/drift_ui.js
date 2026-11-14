// Panels for the smoke drift model: an animated concentration map and the what-if results.
import { h, card, badge, tip, untip, fmt } from './lib.js';
import { C, lineChart } from './charts.js';

// Sequential single-hue ramp on the dark surface: surface -> deep blue -> pale blue.
const RAMP = [[26, 26, 25], [16, 66, 129], [37, 106, 191], [109, 167, 236], [205, 226, 251]];
const ramp = v => { const x = Math.max(0, Math.min(1, v)) * (RAMP.length - 1), i = Math.min(RAMP.length - 2, Math.floor(x)), f = x - i; return RAMP[i].map((a, k) => Math.round(a + (RAMP[i + 1][k] - a) * f)); };

export function driftCard(d) {
  const W = 720, H = Math.round(W * d.ly_m / d.lx_m), X = x => x / d.lx_m * W, Y = y => H - y / d.ly_m * H;
  const cv = h('canvas', { width: W, height: H, style: 'width:100%;height:auto;border-radius:8px;border:1px solid var(--grid);display:block', 'aria-label': 'Animated map of smoke concentration in the cabin' });
  const ctx = cv.getContext('2d'), off = document.createElement('canvas'); off.width = d.nx; off.height = d.ny; const octx = off.getContext('2d'), img = octx.createImageData(d.nx, d.ny);
  const tOut = h('b', { style: 'font-family:var(--mono);min-width:64px;display:inline-block' }, '0 s');
  const slider = h('input', { type: 'range', min: 0, max: d.frames.length - 1, value: 0, step: 1, style: 'flex:1', 'aria-label': 'Time' });
  const btn = h('button', { class: 'chip' }, 'Play');
  const rows = h('div', { class: 'grid g3', style: 'margin-top:10px' });
  let k = 0, playing = false, timer = 0;
  function draw() {
    const fr = d.frames[k], t = k * d.frame_dt_s;
    for (let p = 0; p < fr.length; p++) { const [r, g, b] = ramp(fr[p] / 255); img.data[p * 4] = r; img.data[p * 4 + 1] = g; img.data[p * 4 + 2] = b; img.data[p * 4 + 3] = 255; }
    octx.putImageData(img, 0, 0); ctx.imageSmoothingEnabled = true; ctx.drawImage(off, 0, 0, W, H);
    ctx.strokeStyle = 'rgba(240,239,236,.22)'; ctx.lineWidth = 1;                         // airflow arrows
    for (const [x, y, u, v] of d.arrows) { const s = 140, x0 = X(x), y0 = Y(y), x1 = x0 + u * s, y1 = y0 - v * s, a = Math.atan2(y1 - y0, x1 - x0); ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.lineTo(x1 - 5 * Math.cos(a - .5), y1 - 5 * Math.sin(a - .5)); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 5 * Math.cos(a + .5), y1 - 5 * Math.sin(a + .5)); ctx.stroke(); }
    ctx.fillStyle = C.s3; ctx.fillRect(X(d.supply[0]), 0, X(d.supply[1]) - X(d.supply[0]), 5); ctx.fillRect(W - 5, Y(d.ret[1]), 5, Y(d.ret[0]) - Y(d.ret[1]));
    ctx.font = '12px system-ui'; ctx.fillStyle = C.ink; ctx.fillText('air supply', X(d.supply[0]), 18); ctx.save(); ctx.translate(W - 10, Y(d.ret[0]) - 4); ctx.rotate(-Math.PI / 2); ctx.fillText('air return', 0, 0); ctx.restore();
    ctx.fillStyle = C.s2; ctx.beginPath(); ctx.arc(X(d.fire[0]), Y(d.fire[1]), 6, 0, 6.283); ctx.fill(); ctx.strokeStyle = C.surface; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = C.ink; ctx.fillText('fire', X(d.fire[0]) + 10, Y(d.fire[1]) + 4);
    d.detectors.forEach((det, i) => {
      const on = det.alarm_s != null && t >= det.alarm_s, x = Math.min(W - 12, Math.max(12, X(det.x))), y = Math.min(H - 12, Math.max(12, Y(det.y)));
      ctx.beginPath(); ctx.arc(x, y, 8, 0, 6.283); ctx.fillStyle = on ? C.warn : 'rgba(0,0,0,.55)'; ctx.fill(); ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = on ? '#0b0b0b' : C.ink; ctx.font = '600 11px system-ui'; ctx.textAlign = 'center'; ctx.fillText(String(i + 1), x, y + 4); ctx.textAlign = 'left'; ctx.font = '12px system-ui';
    });
    tOut.textContent = t + ' s'; slider.value = k;
    rows.replaceChildren(...d.detectors.map((det, i) => { const on = det.alarm_s != null && t >= det.alarm_s; return h('div', {}, h('small', {}, `${i + 1}. ${det.name}`), h('div', { class: 'stat', style: `font-size:20px;color:${on ? 'var(--warn)' : 'var(--ink)'}` }, det.alarm_s == null ? 'no alarm' : on ? `alarm at ${fmt(det.alarm_s, 0)} s` : 'quiet')); }));
  }
  const stop = () => { playing = false; clearInterval(timer); btn.textContent = 'Play'; };
  btn.addEventListener('click', () => { if (playing) return stop(); if (k >= d.frames.length - 1) k = 0; playing = true; btn.textContent = 'Pause'; timer = setInterval(() => { if (!cv.isConnected || k >= d.frames.length - 1) return stop(); k++; draw(); }, 120); });
  slider.addEventListener('input', () => { stop(); k = +slider.value; draw(); });
  draw();
  return card('Where the smoke goes', d.status, `Side view of a ${d.lx_m} m by ${d.ly_m} m cabin section, airflow ${d.flow_m_s} m/s, smoke released at ${d.rate_mg_s} mg/s. No buoyancy.`,
    h('div', { class: 'row' }, btn, slider, tOut), cv,
    h('div', { class: 'legend' }, h('span', {}, h('i', { style: `background:linear-gradient(90deg,rgb(${RAMP[1]}),rgb(${RAMP[4]}));width:60px` }), `Smoke, up to ${d.scale_max_mg_m3} mg/m³ (log scale)`), h('span', {}, h('i', { style: `background:${C.warn};border-radius:50%` }), `Detector in alarm (${d.alarm_mg_m3} mg/m³)`), h('span', {}, h('i', { style: `background:${C.s3}` }), 'Supply and return')),
    rows, h('p', { style: 'margin-top:10px' }, h('small', {}, d.assumptions.join('. ') + '.')));
}

export function whatifCard(w) {
  let win = 'caught_120', sel = 1; const holder = h('div');
  const label = { caught_60: 'within 60 s', caught_120: 'within 2 min', caught_300: 'within 5 min' };
  function draw() {
    const bars = h('div', { style: 'display:grid;gap:10px;margin:6px 0 14px' }, ...w.layouts.map((L, i) => h('button', { class: 'q', 'aria-pressed': i === sel, style: 'margin:0', onclick: () => { sel = i; draw(); } },
      h('div', { style: 'display:flex;justify-content:space-between;gap:10px' }, h('span', {}, L.name), h('b', { style: 'font-family:var(--mono)' }, Math.round(L[win] * 100) + '%')),
      h('div', { class: 'track', style: 'margin-top:6px' }, h('i', { style: `width:${L[win] * 100}%` })),
      h('small', {}, `not caught within ${Math.round(w.t_end_s / 60)} min: ${Math.round(L.never * 100)}%` + (win === 'caught_120' ? `; ${Math.round((L.caught_120_model_range || L.caught_120_range)[0] * 100)} to ${Math.round((L.caught_120_model_range || L.caught_120_range)[1] * 100)}% across the settings the flight data allows` : '')))));
    const L = w.layouts[sel], cw = 100 / w.map_nx, vals = L.map.filter(v => v != null), vmax = Math.max(60, ...vals);
    const cells = h('div', { style: `position:relative;aspect-ratio:${w.lx_m}/${w.ly_m};border:1px solid var(--grid);border-radius:8px;overflow:hidden;background:var(--page)` },
      ...L.map.map((v, idx) => {
        const [x, y] = w.map_xy[idx], miss = v == null, [r, g, b] = miss ? [0, 0, 0] : ramp(1 - 0.85 * v / vmax);
        const el = h('div', { style: `position:absolute;left:calc(${x / w.lx_m * 100}% - ${cw / 2}% + 1px);bottom:calc(${y / w.ly_m * 100}% - ${50 / w.map_ny}% + 1px);width:calc(${cw}% - 2px);height:calc(${100 / w.map_ny}% - 2px);border-radius:3px;background:${miss ? 'repeating-linear-gradient(135deg,#3a1616 0 5px,#241010 5px 10px)' : `rgb(${r},${g},${b})`}` });
        el.addEventListener('pointermove', e => tip(e, `Fire at ${x} m along, ${y} m up<br><b>${miss ? 'usually not detected' : 'typical time to alarm ' + v + ' s'}</b>`)); el.addEventListener('pointerleave', untip); return el;
      }),
      ...L.detectors.map(([x, y]) => h('div', { title: 'detector', style: `position:absolute;left:calc(${x / w.lx_m * 100}% - 8px);bottom:calc(${y / w.ly_m * 100}% - 8px);width:16px;height:16px;border-radius:50%;background:var(--warn);border:2px solid #0b0b0b` })));
    holder.replaceChildren(bars, h('h3', { style: 'margin-bottom:6px' }, `Blind-spot map: ${L.name}`), cells,
      h('div', { class: 'legend' }, h('span', {}, h('i', { style: `background:rgb(${ramp(1)})` }), 'Detected fast'), h('span', {}, h('i', { style: `background:rgb(${ramp(0.2)})` }), `Slow (up to ${vmax} s)`), h('span', {}, h('i', { style: 'background:repeating-linear-gradient(135deg,#3a1616 0 3px,#241010 3px 6px)' }), 'Usually missed'), h('span', {}, h('i', { style: 'background:var(--warn);border-radius:50%' }), 'Detector')),
      h('p', { style: 'margin-top:8px' }, h('small', {}, 'Each square is a place a fire could start; its colour is the typical time until that layout raises an alarm.')));
  }
  draw();
  const chips = h('div', { class: 'row' }, h('label', {}, 'Count a fire as caught if the alarm comes'), ...Object.keys(label).map(kx => h('button', { class: 'chip', 'aria-pressed': kx === win, onclick: e => { win = kx; e.target.parentNode.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', c === e.target)); draw(); } }, label[kx])));
  return card('What if the fire starts somewhere else?', w.status, `${fmt(w.runs, 0)} simulated fires: random position, airflow ${w.varied.airflow_m_s.join(', ')} m/s, smoke release ${w.varied.release_mg_s} mg/s` + (w.varied.fire_duration_s ? `, burning for times measured on Saffire-I and II (${Math.min(...w.varied.fire_duration_s)} to ${Math.max(...w.varied.fire_duration_s)} s).` : '.'), chips, holder, h('p', {}, h('small', {}, w.note)));
}

/** Model vs the Saffire-III flight smoke detector: tuned on the burn, tested on the held-out smoke-wire puff. */
export function calibrationCard(c) {
  const band = cv => cv.t.map((t, i) => [t, cv.lo[i], cv.hi[i]]);
  const pts = (t, y) => t.map((x, i) => [x, y[i]]);
  const burn = lineChart({ xLabel: 'Seconds after T0', yLabel: 'Detector signal', markers: [{ x: c.burn_curve.flame[0], label: 'flame on', color: C.s2 }, { x: c.burn_curve.flame[1], label: 'flame out', color: C.s2, dy: 14 }],
    series: [{ name: 'Model (best fit)', color: C.s1, points: pts(c.burn_curve.t, c.burn_curve.best), band: band(c.burn_curve) },
             { name: 'Flight detector', color: C.s4, dots: true, near: 6, points: pts(c.burn_curve.obs_t, c.burn_curve.obs) }] });
  const p = c.pulse;
  const pulse = lineChart({ xLabel: 'Seconds after T0', yLabel: 'Detector signal', markers: [{ x: c.pulse_curve.wire[0], label: 'smoke wire on', color: C.s2 }],
    series: [{ name: 'Model, never tuned on this', color: C.s1, points: pts(c.pulse_curve.t, c.pulse_curve.best), band: band(c.pulse_curve) },
             { name: 'Flight detector', color: C.s4, dots: true, near: 6, points: pts(c.pulse_curve.obs_t, c.pulse_curve.obs) }] });
  const lg = h('div', { class: 'legend' }, h('span', {}, h('i', { style: `background:${C.s1}` }), 'Model, best setting'), h('span', {}, h('i', { style: `background:${C.s1};opacity:.3` }), 'Every setting the record cannot rule out'), h('span', {}, h('i', { style: `background:${C.s4};border-radius:50%` }), 'Flight detector reading'));
  return card('Checked against a real spacecraft fire', c.status, `Saffire-III flew a real fire inside a Cygnus cargo ship. We tuned the drift model on the burn and tested it on a smoke puff it never saw.`,
    h('div', { class: 'grid g3', style: 'margin-bottom:8px' },
      h('div', {}, h('small', {}, 'Fit to the burn (R²)'), h('div', { class: 'stat' }, c.best.burn_r2.toFixed(2))),
      h('div', {}, h('small', {}, 'Smoke cleared in'), h('div', { class: 'stat' }, `${c.clearance_s_range[0]}–${c.clearance_s_range[1]} s`)),
      h('div', {}, h('small', {}, 'Held-out puff: peak'), h('div', { class: 'stat' }, `${Math.round(p.observed_peak_s)} s`, h('small', {}, `model ${Math.round(p.model_peak_s_range[0])}–${Math.round(p.model_peak_s_range[2])} s`)))),
    h('h3', {}, 'Tuned on: Sample 1 burn'), burn, h('h3', { style: 'margin-top:10px' }, 'Tested on: smoke-wire puff (held out)'), pulse, lg,
    h('p', { style: 'margin-top:8px' }, h('small', {}, `${c.settings_kept} of ${c.settings_tried} settings fit the burn equally well; all of them feed the what-if runs. Detector delay ${c.delay_s_range[0]}–${c.delay_s_range[1]} s. ` + c.limits.join(' ') + ' Source: NASA PSI-100, CC0.')));
}

export function robustCard(w) {
  if (!w.robustness) return null;
  const pct = v => Math.round(v * 100) + '%', rng = r => r ? h('small', {}, ` ${pct(r[0])}–${pct(r[1])}`) : null;
  const A = w.layouts.find(L => L.name === 'At the air return'), Cl = w.layouts.find(L => L.name.startsWith('Ceiling'));
  const sizeRows = A && A.by_rate ? A.by_rate.map((b, k) => h('tr', {}, h('td', {}, k === 2 ? `over ${b.lo} mg/s` : `${b.lo}–${b.hi} mg/s`), h('td', {}, pct(Cl.by_rate[k].caught_120)), h('td', {}, pct(b.caught_120)))) : [];
  return card('What actually decides if a fire is caught?', w.status, 'Share of simulated fires caught within 2 minutes. Small ranges: across the settings the flight data cannot rule out.',
    h('h3', {}, 'Detector position, in three different cabins'),
    h('div', { class: 'scroll' }, h('table', {}, h('thead', {}, h('tr', {}, ...['Cabin', 'Ceiling, mid-cabin', 'At the air return', 'Best pair'].map(t => h('th', {}, t)))),
      h('tbody', {}, ...w.robustness.map(r => h('tr', {}, h('td', {}, h('b', {}, r.cabin), ' ', h('small', {}, r.label)), h('td', {}, pct(r.ceiling_120), rng(r.ceiling_range)), h('td', {}, pct(r.return_120), rng(r.return_range)), h('td', {}, pct(r.pair_120))))))),
    sizeRows.length ? h('h3', { style: 'margin-top:12px' }, 'How much smoke the fire makes (cabin A)') : null,
    sizeRows.length ? h('div', { class: 'scroll' }, h('table', {}, h('thead', {}, h('tr', {}, ...['Smoke release', 'Ceiling', 'Air return'].map(t => h('th', {}, t)))), h('tbody', {}, ...sizeRows))) : null,
    h('p', { style: 'margin-top:8px' }, h('small', {}, 'Once the air is recirculated and mixed the way the flight data says it is, where the detector sits matters less than how much smoke the fire makes. Small smouldering sources often never reach the alarm level anywhere: that is the case for sensing closer to the source.')));
}

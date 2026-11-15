// #24 Saffire-III replay and #7 DAFT card. Data: saffire_latency.json (real), daft.json (real).
import { h, card, params } from './lib.js';
import { SERIES, C, SCREEN } from './charts.js';
export function replayCard(lat) {
  const sel = h('select', { 'aria-label': 'Event' }, ...lat.burns.map((b, i) => h('option', { value: i }, b.name)));
  const cv = h('canvas', { class: 'replay', width: 1280, height: 420, role: 'img', 'aria-label': 'Replay of sensor signals after ignition' });
  const clock = h('div', { class: 'clock', 'aria-live': 'off' }, '0 s'), lamps = h('div', { class: 'lamps' });
  const btn = h('button', { class: 'chip', 'aria-pressed': 'false' }, '▶ Play'), slider = h('input', { type: 'range', min: 0, max: 1000, value: 0, 'aria-label': 'Time' });
  let b, T0, T1, raf = 0, playing = false, last = 0, f = 0;
  const ctx = cv.getContext('2d');
  const setup = () => { b = lat.burns[sel.value]; T0 = b.t[0]; T1 = b.t[b.t.length - 1]; f = 1; slider.value = 1000;
    lamps.replaceChildren(...b.channels.map((c, i) => h('div', { class: 'lamp', 'data-i': i, style: `--c:${SERIES[i]}` }, h('i'), h('span', {}, c.name), h('b', {}, c.alarm_s == null ? 'never alarmed' : `alarm at ${c.alarm_s} s`)))); draw(); };
  const draw = () => {
    const W = cv.width, H = cv.height, now = T0 + f * (T1 - T0), pad = 50, rowH = (H - pad - 20) / b.channels.length;
    ctx.clearRect(0, 0, W, H); ctx.font = '22px Inter, system-ui, sans-serif';
    const X = t => pad + (t - T0) / (T1 - T0) * (W - pad - 20);
    b.channels.forEach((c, i) => {
      const y0 = 10 + i * rowH, mid = y0 + rowH * 0.62, sc = rowH * 0.5;
      ctx.fillStyle = 'rgba(255,255,255,0.03)'; ctx.fillRect(pad, y0, W - pad - 20, rowH - 8);
      ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.moveTo(pad, mid - sc); ctx.lineTo(W - 20, mid - sc); ctx.stroke(); ctx.setLineDash([]);
      const g = ctx.createLinearGradient(0, mid - sc * 2, 0, mid); g.addColorStop(0, SERIES[i]); g.addColorStop(1, 'transparent');
      ctx.beginPath(); ctx.moveTo(X(T0), mid); let k = 0;
      for (; k < b.t.length && b.t[k] <= now; k++) ctx.lineTo(X(b.t[k]), mid - Math.max(-0.5, Math.min(2, c.values[k] ?? 0)) * sc);
      const xe = X(b.t[Math.max(0, k - 1)]); ctx.lineTo(xe, mid); ctx.closePath(); ctx.fillStyle = g; ctx.globalAlpha = 0.35; ctx.fill(); ctx.globalAlpha = 1;
      ctx.beginPath(); for (let j = 0; j < k; j++) { const x = X(b.t[j]), y = mid - Math.max(-0.5, Math.min(2, c.values[j] ?? 0)) * sc; j ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.strokeStyle = SERIES[i]; ctx.lineWidth = 3; ctx.shadowColor = SERIES[i]; ctx.shadowBlur = 12; ctx.stroke(); ctx.shadowBlur = 0;
      ctx.fillStyle = SCREEN.mute; ctx.fillText(c.name, pad + 8, y0 + 26);
      if (c.alarm_s != null && now >= c.alarm_s) { ctx.fillStyle = SERIES[i]; ctx.beginPath(); ctx.arc(X(c.alarm_s), mid - sc, 9, 0, 7); ctx.fill(); }
      lamps.children[i]?.classList.toggle('on', c.alarm_s != null && now >= c.alarm_s);
    });
    if (T0 <= 0 && T1 >= 0) { ctx.strokeStyle = C.warn; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(X(0), 4); ctx.lineTo(X(0), H - pad + 6); ctx.stroke(); ctx.fillStyle = C.warn; ctx.fillText('ignition', X(0) + 6, H - pad + 30); }
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(X(now), 4); ctx.lineTo(X(now), H - pad + 6); ctx.stroke();
    clock.textContent = `${Math.round(now)} s after ignition`;
  };
  const tick = ts => { if (!playing) return; const dt = last ? (ts - last) / 1000 : 0; last = ts; f = Math.min(1, f + dt / 14); slider.value = f * 1000; draw(); if (f >= 1) stop(); else raf = requestAnimationFrame(tick); };
  const stop = () => { playing = false; btn.textContent = '▶ Play'; btn.setAttribute('aria-pressed', 'false'); cancelAnimationFrame(raf); };
  btn.onclick = () => { if (playing) return stop(); if (f >= 1) f = 0; playing = true; last = 0; btn.textContent = '❚❚ Pause'; btn.setAttribute('aria-pressed', 'true'); raf = requestAnimationFrame(tick); };
  slider.oninput = () => { stop(); f = slider.value / 1000; draw(); };
  sel.onchange = () => { stop(); setup(); };
  const want = { wire: /wire/i, s2: /Sample 2/, s1: /Sample 1/ }[params().event] || /Sample 1/;
  sel.value = String(Math.max(0, lat.burns.findIndex(b => want.test(b.name))));   // ?event=s1|s2|wire opens that event   // open on a real fire, not the smoke-wire puff
  setup();
  return card('Replay an orbital fire', lat.status, 'Saffire-III telemetry, replayed at about 14 seconds per event. Each lane is one sensor, scaled so the dashed line is its alarm threshold. A dot marks the moment it would alarm.',
    h('div', { class: 'row' }, h('label', {}, 'Event ', sel), btn, clock), cv, slider, lamps,
    h('p', {}, h('small', {}, 'NASA has not published Cygnus smoke detector alarm times for Saffire-III that we could find, so these thresholds are ours (stated on the panel above), not NASA\'s.')));
}
export function daftCard(d) {
  return card('Dust or smoke? Checking the counter first', d.status, d.source,
    h('p', {}, `“${d.objective_quote}” `, d.what_it_means),
    h('div', { class: 'timeline' }, ...d.sessions.map(s => h('div', { class: 'tl-item' }, h('b', {}, `${s.session} · ${s.day}`), h('span', {}, s.hardware), h('small', {}, s.where)))),
    h('p', {}, h('small', {}, d.not_in_archive)));
}

// Alarm vs toxic gas: Saffire IV-VI cabin gas rise against crew limits (data/saffire_gas.json, reported).
export function gasCard(g) {
  const NS = 'http://www.w3.org/2000/svg', s = (t, a = {}, txt) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); if (txt != null) e.textContent = txt; return e; };
  const panel = (title, key, max, lines, unit) => {
    const W = 520, rowH = 30, m = { l: 150, r: 20, t: 26, b: 30 }, H = m.t + g.tests.length * rowH + m.b, X = v => m.l + v / max * (W - m.l - m.r);
    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': `${title}, by test, with crew limits` });
    svg.append(s('text', { x: m.l, y: 14, style: `fill:${C.ink};font-weight:700` }, title));
    g.tests.forEach((t, i) => {
      const y = m.t + i * rowH, v = t[key], over = lines.some(([l]) => v > l);
      svg.append(s('text', { x: m.l - 8, y: y + 18, 'text-anchor': 'end' }, `${t.test} · ${t.material.split(',')[0]}`));
      svg.append(s('rect', { x: m.l, y: y + 6, width: Math.max(2, X(v) - m.l), height: 16, rx: 3, fill: over ? C.s2 : C.s1 }));
      svg.append(s('text', { x: X(v) + 6, y: y + 18, style: `fill:${C.ink}` }, `${v} ${unit}`));
    });
    for (const [l, lab] of lines) { svg.append(s('line', { x1: X(l), x2: X(l), y1: m.t - 4, y2: H - m.b + 4, stroke: C.warn, 'stroke-width': 2, 'stroke-dasharray': '4 3' }), s('text', { x: X(l), y: H - 8, 'text-anchor': 'middle', style: `fill:${C.ink}` }, lab)); }
    return svg;
  };
  const L = g.limits;
  return card('The alarm can come after the gas', g.status, 'NASA\'s Saffire IV-VI fires in empty Cygnus cargo ships: how much the cabin carbon monoxide and carbon dioxide rose, against crew exposure limits.',
    h('div', { class: 'grid g2' }, panel('Carbon monoxide rise', 'co_rise', 460, [[L.co_smac_24h_ppm, '24 h limit'], [L.co_smac_1h_ppm, '1 h limit']], 'ppm'),
      panel('Carbon dioxide rise', 'co2_rise_mmHg', 4, [[L.co2_1h_mmHg, '1 h limit']], 'mmHg')),
    h('p', {}, g.takeaway),
    h('p', {}, h('b', {}, `Timing: `), g.alarm.note),
    h('p', {}, h('small', {}, `Bars over a limit are orange. ${g.source} Limits: ${L.source}.`)));
}

// Rate-of-rise vs fixed alarm level on the same Saffire-III smoke channels (data/rate_of_rise.json).
export function rateCard(r) {
  const sc = r.events.filter(e => /scatter/.test(e.channel));
  const fmtT = v => v == null ? 'never' : typeof v === 'string' ? v : `${Math.round(v)} s`;
  return card('Would a "fast rise" alarm be quicker?', r.status, 'NASA has proposed alarms that trigger on how fast smoke rises, not how high it gets. We tested that idea on the real Saffire-III smoke detector, with the pass rule written first.',
    h('div', { class: 'scroll' }, h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, 'Event'), h('th', {}, 'Fixed level alarm'), h('th', {}, 'Fast-rise alarm'))),
      h('tbody', {}, ...sc.map(e => h('tr', {}, h('td', {}, e.event), h('td', {}, fmtT(e.fixed_alarm_s)), h('td', {}, fmtT(e.rate_alarm_s))))))),
    h('p', { style: 'margin-top:10px' }, h('b', {}, r.result.text)),
    h('p', {}, 'Why: in a ventilated cabin the smoke reaching the detector builds up slowly, so its rise rate never stands out from normal noise, while its level eventually does. One detector, three events: this says nothing about other designs.'),
    h('p', {}, h('small', {}, `${r.rule} Source: ${r.source}.`)));
}

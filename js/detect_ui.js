// #24 Saffire-III replay and #7 DAFT card. Data: saffire_latency.json (real), daft.json (real).
import { h, card } from './lib.js';
import { SERIES, C } from './charts.js';
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
      ctx.fillStyle = C.mute; ctx.fillText(c.name, pad + 8, y0 + 26);
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

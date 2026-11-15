// Find it figures (#/detect): the Saffire-III replay (#24), cabin gas against crew limits, the rate-of-rise test,
// the alarm-rule sensitivity table, Blind Spot (#1), Smoke the detector misses (#2) and DAFT (#7).
// Frozen interface: site/REBUILD_PLAN.md §2.12. Wording and behaviour ported from main's js/detect_ui.js,
// js/verify_ui.js (sensitivityCard) and js/pages/detect.js. Every number on screen is read from the data file
// the card is stamped with; the only constants below are display choices carried over from main (marked).
import { h, card, empty, fmt, isMissing, seg, legend, table, announce, setParams, tip, untip } from './lib.js';
import { lineChart, dotRows, keyNav, numbers, SERIES, SCREEN, DASH, C } from './charts.js';
import { figLink, revealFigure } from './passes.js';

let uidN = 0;
const uid = p => `det-${p}-${++uidN}`;
const SVGNS = 'http://www.w3.org/2000/svg';
const sv = (tag, a = {}, text) => {
  const e = document.createElementNS(SVGNS, tag);
  for (const k in a) if (a[k] != null && a[k] !== false) e.setAttribute(k, a[k]);
  if (text != null) e.textContent = text;
  return e;
};
const esc = v => String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
/** A small line swatch with the same colour and dash the line chart gives series i (D5.12: not colour alone). */
const swatch = i => {
  const s = sv('svg', { class: 'det-sw', width: 22, height: 10, viewBox: '0 0 22 10', 'aria-hidden': 'true', focusable: 'false' });
  s.append(sv('line', { x1: 1, x2: 21, y1: 5, y2: 5, stroke: SERIES[i % SERIES.length], 'stroke-width': 3, 'stroke-dasharray': DASH[i % DASH.length] || null }));
  return s;
};

const T_REPLAY = 'Replay an orbital fire';
const T_BLIND = 'Blind Spot: who alarms first?';
const T_WHATIF = 'What if the fire starts somewhere else?';   // the Predict what-if figure (fig_drift.whatifCard), #6
const LAT_SCHEMA = '{ "status":"real", "y_meaning":"...", "burns":[{ "name":"Burn 1", "t":[0,1,2], "channels":[{ "key":"radiometer", "name":"Radiometer", "values":[0,0.2,1.1], "alarm_s":2 }] }] }';
const latEmpty = () => empty('Waiting for Saffire-III telemetry', 'saffire_latency', 'One burn per entry, each channel scaled so 1.0 is its alarm threshold.', LAT_SCHEMA);

// ---------------------------------------------------------------------------------------------------------------
// #24 Replay an orbital fire (canvas on the dark SCREEN palette)
// ---------------------------------------------------------------------------------------------------------------
/** params: the route query ({event:'wire'|'s2'|'s1'}); ctx: the page ctx (playback stops in ctx.onLeave). */
export function replayCard(lat, params = {}, ctx = {}) {
  if (isMissing(lat) || !Array.isArray(lat.burns) || !lat.burns.length) return card(T_REPLAY, 'missing', null, latEmpty());
  const REPLAY_S = 14;   // display choice from main (detect_ui.js): every event replays in about 14 s, stated in the sub
  const selId = uid('event'), sliderId = uid('time'), sumId = uid('sum');
  const sel = h('select', { id: selId }, lat.burns.map((b, i) => h('option', { value: i }, b.name)));
  const cv = h('canvas', { class: 'replay', width: 1280, height: 420, role: 'img', 'aria-describedby': sumId });
  const clock = h('span', { class: 'clock' }, '0 s after ignition');
  const btn = h('button', { type: 'button', class: 'chip', 'aria-pressed': 'false' }, '▶ Play');
  const slider = h('input', { type: 'range', id: sliderId, min: 0, max: 1, step: 1, value: 0 });
  const lamps = h('div', { class: 'lamps' });
  const summary = h('p', { id: sumId, class: 'replay-sum' });
  const tableBox = h('div', { class: 'replay-table' });
  const g = cv.getContext('2d');
  let b, T0, T1, raf = 0, playing = false, last = 0, f = 1;
  const items = [];   // keyboard stops (one per reading); mutated in place so keyNav always reads the current event
  const W = cv.width, H = cv.height, pad = 50;
  const X = t => pad + (t - T0) / (T1 - T0) * (W - pad - 20);
  const clampV = v => Math.max(-0.5, Math.min(2, v ?? 0));   // display clamp from main: lanes show -0.5 to 2 alarm margins
  const nowT = () => T0 + f * (T1 - T0);

  const draw = () => {
    if (!g || !b) return;
    const now = nowT(), rowH = (H - pad - 20) / b.channels.length;
    g.clearRect(0, 0, W, H);
    g.font = '22px "Atkinson Hyperlegible", system-ui, sans-serif';
    b.channels.forEach((c, i) => {
      const col = SERIES[i % SERIES.length], y0 = 10 + i * rowH, mid = y0 + rowH * 0.62, sc = rowH * 0.5;
      g.fillStyle = 'rgba(255,255,255,0.03)'; g.fillRect(pad, y0, W - pad - 20, rowH - 8);
      g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 1; g.setLineDash([6, 6]);
      g.beginPath(); g.moveTo(pad, mid - sc); g.lineTo(W - 20, mid - sc); g.stroke(); g.setLineDash([]);
      const grad = g.createLinearGradient(0, mid - sc * 2, 0, mid); grad.addColorStop(0, col); grad.addColorStop(1, 'transparent');
      let k = 0;
      // keep each trace inside its own lane: at the top of main's clamp (2 alarm margins) the line rose into the lane above,
      // and lane 1 ran off the canvas (P7-B shots); the alarm line and dot sit well inside the band
      g.save(); g.beginPath(); g.rect(pad, y0, W - pad - 20, rowH - 8); g.clip();
      g.beginPath(); g.moveTo(X(T0), mid);
      for (; k < b.t.length && b.t[k] <= now; k++) g.lineTo(X(b.t[k]), mid - clampV(c.values[k]) * sc);
      g.lineTo(X(b.t[Math.max(0, k - 1)]), mid); g.closePath();
      g.fillStyle = grad; g.globalAlpha = 0.35; g.fill(); g.globalAlpha = 1;
      g.beginPath();
      for (let j = 0; j < k; j++) { const x = X(b.t[j]), y = mid - clampV(c.values[j]) * sc; j ? g.lineTo(x, y) : g.moveTo(x, y); }
      // each lane is named on the canvas and in its lamp, so colour is never the only cue
      g.strokeStyle = col; g.lineWidth = 3; g.shadowColor = col; g.shadowBlur = 12; g.stroke(); g.shadowBlur = 0;
      g.restore();
      g.fillStyle = SCREEN.mute; g.fillText(c.name, pad + 8, y0 + 26);
      const on = c.alarm_s != null && now >= c.alarm_s;
      if (on) { g.fillStyle = col; g.beginPath(); g.arc(X(c.alarm_s), mid - sc, 9, 0, 7); g.fill(); }
      lamps.children[i]?.classList.toggle('on', on);
    });
    if (T0 <= 0 && T1 >= 0) {
      g.strokeStyle = C.warn; g.lineWidth = 2; g.beginPath(); g.moveTo(X(0), 4); g.lineTo(X(0), H - pad + 6); g.stroke();
      g.fillStyle = C.warn; g.fillText('ignition', X(0) + 6, H - pad + 30);
    }
    g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.moveTo(X(now), 4); g.lineTo(X(now), H - pad + 6); g.stroke();
    const txt = `${Math.round(now)} s after ignition`;
    clock.textContent = txt;
    slider.value = String(Math.round(now));
    slider.setAttribute('aria-valuetext', txt);
  };

  const stop = () => { playing = false; btn.textContent = '▶ Play'; btn.setAttribute('aria-pressed', 'false'); cancelAnimationFrame(raf); raf = 0; };
  const tick = ts => {
    if (!playing) return;
    const dt = last ? (ts - last) / 1000 : 0; last = ts;
    f = Math.min(1, f + dt / REPLAY_S); draw();
    if (f >= 1) stop(); else raf = requestAnimationFrame(tick);
  };
  btn.addEventListener('click', () => {
    if (playing) return stop();
    if (f >= 1) f = 0;
    playing = true; last = 0; btn.textContent = '❚❚ Pause'; btn.setAttribute('aria-pressed', 'true');
    raf = requestAnimationFrame(tick);
  });
  slider.addEventListener('input', () => { stop(); f = (Number(slider.value) - T0) / (T1 - T0); f = Math.max(0, Math.min(1, f)); draw(); });

  const alarmText = c => (c.alarm_s == null ? 'no alarm' : `alarm at ${c.alarm_s} s${c.resolution_s > 2 ? ` ± ${c.resolution_s}` : ''}`);
  const setup = () => {
    b = lat.burns[Number(sel.value)] || lat.burns[0];
    T0 = b.t[0]; T1 = b.t[b.t.length - 1]; f = 1;
    slider.min = String(T0); slider.max = String(T1);
    lamps.replaceChildren(...b.channels.map((c, i) => h('div', { class: 'lamp', 'data-i': i, style: `--c:${SERIES[i % SERIES.length]}` }, h('i'), h('span', {}, c.name), h('b', {}, alarmText(c)))));
    // text summary of the canvas (D5.6), built from the same values
    const al = b.channels.filter(c => c.alarm_s != null).sort((p, q) => p.alarm_s - q.alarm_s);
    summary.textContent = `${b.name}. The lanes run from ${fmt(T0, 0)} s to ${fmt(T1, 0)} s after ignition. ` +
      b.channels.map(c => `${c.name}: ${alarmText(c)}`).join('; ') + '.' +
      (al.length > 1 ? ` The first alarm came at ${al[0].alarm_s} s and the last at ${al[al.length - 1].alarm_s} s.` : '');
    // keyboard stops: one per reading; each step moves the playhead there
    items.length = 0;
    b.t.forEach((t, k) => items.push({
      html: `<b>${esc(fmt(t, 1))} s after ignition</b>` + b.channels.map((c, i) => {
        const v = c.values[k];
        const st = c.alarm_s == null ? 'never alarms in this event' : t >= c.alarm_s ? `alarmed at ${c.alarm_s} s` : 'below its alarm line';
        return `<br><span style="color:${SERIES[i % SERIES.length]}">&#9632;</span> ${esc(c.name)}: <b>${v == null ? 'n/a' : esc(fmt(v, 2)) + '×'}</b> (${st})`;
      }).join(''),
      anchor: () => { const r = cv.getBoundingClientRect(); return { x: r.left + X(t) / W * r.width, y: r.top + 12 / H * r.height }; },
    }));
    kn.index = -1;
    // lane-value table: the raw readings the lanes draw (unclamped)
    tableBox.replaceChildren(numbers(`${b.name}: signal ÷ alarm margin, by time after ignition`,
      ['Time after ignition (s)', ...b.channels.map(c => `${c.name} (× alarm margin)`)],
      b.t.map((t, k) => [t, ...b.channels.map(c => (c.values[k] == null ? 'n/a' : c.values[k]))]),
      `1.0 is the alarm line. Alarm times: ${b.channels.map(c => `${c.name} ${alarmText(c)}`).join('; ')}.`));
    draw();
  };
  const kn = keyNav(cv, items, {
    label: 'Replay of sensor signals after ignition',
    onMove: k => { stop(); const t = b.t[k]; f = Math.max(0, Math.min(1, (t - T0) / (T1 - T0))); draw(); },
  });
  sel.addEventListener('change', () => {
    stop(); setup();
    if (!ctx.detached && b.key) setParams({ event: b.key });   // ?event= round-trips (main read it but never wrote it)
  });

  // ?event=wire|s2|s1 opens that event; with none, open on a real fire (Sample 1), not the smoke-wire puff (main)
  const ev = params && params.event;
  const want = { wire: /wire/i, s2: /Sample 2/, s1: /Sample 1/ }[ev] || /Sample 1/;
  let idx = lat.burns.findIndex(x => ev && x.key === ev);
  if (idx < 0) idx = lat.burns.findIndex(x => want.test(x.name));
  sel.value = String(Math.max(0, idx));
  setup();
  ctx.onLeave?.(stop);

  const blindLink = h('a', { href: figLink('detect', T_BLIND), onclick: e => {
    if (ctx.detached || e.metaKey || e.ctrlKey || e.shiftKey || e.button > 0) return;
    if (revealFigure(T_BLIND)) e.preventDefault();
  } }, 'stated on the Blind Spot panel');

  return card(T_REPLAY, lat.status,
    'Saffire-III telemetry, replayed at about 14 seconds per event. Each lane is one sensor, scaled so the dashed line is its alarm threshold. A dot marks the moment it would alarm.',
    h('div', { class: 'row replay-ctl' }, h('label', { for: selId }, 'Event'), sel, btn),
    cv,
    h('div', { class: 'replay-time' }, h('label', { for: sliderId }, 'Time after ignition, s'), slider, clock),
    lamps, summary, tableBox,
    h('p', {}, h('small', {}, 'NASA has not published Cygnus smoke detector alarm times for Saffire-III that we could find, so these thresholds are ours (', blindLink, '), not NASA\'s.')));
}

// ---------------------------------------------------------------------------------------------------------------
// The alarm can come after the gas (saffire_gas.json, reported)
// ---------------------------------------------------------------------------------------------------------------
export function gasCard(g) {
  const T = 'The alarm can come after the gas';
  if (isMissing(g) || !Array.isArray(g.tests) || !g.limits) return card(T, 'missing', null,
    empty('Waiting for the Saffire IV-VI cabin gas table', 'saffire_gas', 'One row per test: carbon monoxide and carbon dioxide rise, with the crew limits the paper cites.',
      '{ "status":"reported", "source":"...", "tests":[{ "test":"...", "material":"...", "co_rise":"<ppm>", "co2_rise_mmHg":"<mmHg>" }], "limits":{ "co_smac_24h_ppm":"<ppm>", "co_smac_1h_ppm":"<ppm>", "co2_1h_mmHg":"<mmHg>", "source":"..." }, "alarm":{ "note":"..." }, "takeaway":"..." }'));
  const L = g.limits;
  const panel = (title, key, lines, unit) => {
    lines = lines.filter(([l]) => Number.isFinite(l));
    const vals = g.tests.map(t => t[key]).filter(Number.isFinite);
    // axis end: the largest value or limit plus 8 % room (main typed 460 ppm and 4 mmHg; this derives them from the file)
    const max = Math.max(...vals, ...lines.map(([l]) => l), 1e-9) * 1.08;
    const W = 640, rowH = 30, m = { l: 150, r: 170, t: 26, b: 30 }, Hh = m.t + g.tests.length * rowH + m.b;
    const X = v => m.l + v / max * (W - m.l - m.r);
    const label = `${title}, by test, with crew limits`;
    const svg = sv('svg', { viewBox: `0 0 ${W} ${Hh}`, class: 'chart', role: 'img' });
    svg.append(sv('text', { x: m.l, y: 14, class: 'ch-ink', style: 'font-weight:700;font-size:12px' }, title));
    const items = [], rows = [];
    const overOf = v => { const hit = lines.filter(([l]) => v > l).sort((a, b2) => b2[0] - a[0])[0]; return hit ? hit[1] : null; };
    g.tests.forEach((t, i) => {
      const y = m.t + i * rowH, v = t[key], over = Number.isFinite(v) ? overOf(v) : null, name = `${t.test} · ${String(t.material).split(',')[0]}`;
      svg.append(sv('text', { x: m.l - 8, y: y + 18, 'text-anchor': 'end', class: 'ch-ink' }, name));
      if (!Number.isFinite(v)) {
        const na = sv('text', { x: m.l + 4, y: y + 18 }, 'n/a'); svg.append(na);
        items.push({ html: `<b>${esc(name)}</b><br>${esc(title)}: n/a`, anchor: na }); rows.push([t.test, t.material, 'n/a', '']); return;
      }
      const r = sv('rect', { x: m.l, y: y + 6, width: Math.max(2, X(v) - m.l), height: 16, rx: 3, fill: over ? C.s2 : C.s1 });
      const lab = sv('text', { x: X(v) + 6, y: y + 18, class: 'ch-ink' }, `${v} ${unit}`);
      if (over) lab.append(sv('tspan', { style: 'font-weight:700' }, ` · over ${over}`));   // text marker, not colour alone
      svg.append(r, lab);
      const html = `<b>${esc(t.test)} · ${esc(t.material)}</b><br>${esc(title)}: <b>${esc(v)} ${esc(unit)}</b><br>${over ? `Over the ${esc(over)}` : 'Below the limits shown'}`;
      r.addEventListener('pointermove', e => tip(e, html)); r.addEventListener('pointerdown', e => tip(e, html)); r.addEventListener('pointerleave', untip);
      items.push({ html, anchor: r });
      rows.push([t.test, t.material, v, over ? `over ${over}` : 'none']);
    });
    for (const [l, lab] of lines) svg.append(
      sv('line', { x1: X(l), x2: X(l), y1: m.t - 4, y2: Hh - m.b + 4, stroke: C.warn, 'stroke-width': 2, 'stroke-dasharray': '4 3' }),
      sv('text', { x: X(l), y: Hh - 8, 'text-anchor': 'middle', class: 'ch-ink' }, lab));
    keyNav(svg, items, { label });
    return h('div', { class: 'chart-wrap' }, svg,
      numbers(label, ['Test', 'Material', `${title} (${unit})`, 'Crew limit passed'], rows,
        `Limits: ${lines.map(([l, lab]) => `${lab} ${l} ${unit}`).join('; ')}.`));
  };
  return card(T, g.status, 'NASA\'s Saffire IV-VI fires in empty Cygnus cargo ships: how much the cabin carbon monoxide and carbon dioxide rose, against crew exposure limits.',
    h('div', { class: 'grid g2' },
      panel('Carbon monoxide rise', 'co_rise', [[L.co_smac_24h_ppm, '24 h limit'], [L.co_smac_1h_ppm, '1 h limit']], 'ppm'),
      panel('Carbon dioxide rise', 'co2_rise_mmHg', [[L.co2_1h_mmHg, '1 h limit']], 'mmHg')),
    g.takeaway ? h('p', {}, g.takeaway) : null,
    g.alarm?.note ? h('p', {}, h('b', {}, 'Timing: '), g.alarm.note) : null,
    h('p', {}, h('small', {}, `Bars over a limit are orange and say "over" the limit they pass. ${g.source || ''} Limits: ${L.source || ''}.`)));
}

// ---------------------------------------------------------------------------------------------------------------
// Would a "fast rise" alarm be quicker? (rate_of_rise.json, real)
// ---------------------------------------------------------------------------------------------------------------
export function rateCard(r) {
  const T = 'Would a "fast rise" alarm be quicker?';
  if (isMissing(r) || !Array.isArray(r.events)) return card(T, 'missing', null,
    empty('Waiting for the rate-of-rise test', 'rate_of_rise', 'Fixed-level and fast-rise alarm times on the same Saffire-III smoke channels, with the pass rule result.',
      '{ "status":"real", "rule":"...", "source":"...", "events":[{ "event":"...", "channel":"Smoke detector: scatter", "fixed_alarm_s":"<s or null>", "rate_alarm_s":"<s or null>" }], "result":{ "passed":false, "text":"..." } }'));
  const sc = r.events.filter(e => /scatter/.test(e.channel));
  const fmtT = v => (v == null ? 'never' : typeof v === 'string' ? v : `${Math.round(v)} s`);
  return card(T, r.status, 'NASA has proposed alarms that trigger on how fast smoke rises, not how high it gets. We tested that idea on the real Saffire-III smoke detector, with the pass rule written first.',
    table(['Event', 'Fixed level alarm', 'Fast-rise alarm'], sc.map(e => [e.event, fmtT(e.fixed_alarm_s), fmtT(e.rate_alarm_s)])),
    r.result?.text ? h('p', { class: 'det-result' }, h('b', {}, r.result.text)) : null,
    h('p', {}, 'Why: in a ventilated cabin the smoke reaching the detector builds up slowly, so its rise rate never stands out from normal noise, while its level eventually does. One detector, three events: this says nothing about other designs.'),
    h('p', {}, h('small', {}, `${r.rule || ''} Source: ${r.source || ''}.`)));
}

// ---------------------------------------------------------------------------------------------------------------
// Does the alarm rule change the answer? (latency_sensitivity.json, real) [NIS]
// ---------------------------------------------------------------------------------------------------------------
export function sensitivityCard(s) {
  const T = 'Does the alarm rule change the answer?';
  if (isMissing(s) || !Array.isArray(s.rows) || !Array.isArray(s.ks)) return card(T, 'missing', null,
    empty('Waiting for the alarm-rule sensitivity table', 'latency_sensitivity', 'The alarm rule rerun with stricter and looser thresholds, one row per event and sensor.',
      '{ "status":"real", "resolution":"...", "ks":["<SD values>"], "rows":[{ "event":"...", "channel":"...", "k<SD>":"<s or null>" }] }'));
  const USED = 5;   // the 5 SD rule used everywhere on the site (saffire_latency.json threshold_rule)
  const t = h('table', {},
    h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Event'), h('th', { scope: 'col' }, 'Sensor'),
      s.ks.map(k => h('th', { scope: 'col', class: k === USED ? 'sel' : null }, k === USED ? `${k} SD (site rule)` : `${k} SD`)))),
    h('tbody', {}, s.rows.map(row => h('tr', {}, h('td', {}, row.event), h('td', {}, row.channel),
      s.ks.map(k => h('td', { class: k === USED ? 'sel' : null }, row[`k${k}`] == null ? 'never' : `${row[`k${k}`]} s`))))));
  return card(T, s.status, 'Our alarm rule is ours, so we tried stricter and looser versions. t = 0 is when the igniter (or smoke wire) switches on.',
    h('div', { class: 'scroll' }, t),
    h('p', {}, `Seconds after ignition. 5 SD is the rule used everywhere on the site. Resolution: ${s.resolution || 'n/a'}.`));
}

// ---------------------------------------------------------------------------------------------------------------
// #1 Blind Spot: who alarms first? (saffire_latency.json, real)
// ---------------------------------------------------------------------------------------------------------------
export function blindSpotCard(lat) {
  if (isMissing(lat) || !Array.isArray(lat.burns) || !lat.burns.length) return card(T_BLIND, 'missing', null, latEmpty());
  const CAP = 2;   // display choice from main: y is capped, because radiometers reach about 100x their alarm margin
  const selId = uid('burn');
  const holder = h('div');
  const sel = h('select', { id: selId }, lat.burns.map((b, i) => h('option', { value: i }, b.name)));
  let gapText = '';
  const draw = () => {
    const b = lat.burns[Number(sel.value)] || lat.burns[0];
    const series = b.channels.map((c, i) => ({ name: c.name, color: SERIES[i % SERIES.length], points: b.t.map((t, k) => [t, c.values[k] == null ? null : Math.max(-1, Math.min(CAP, c.values[k]))]) }));
    const alarms = b.channels.map((c, i) => ({ c, i })).filter(o => o.c.alarm_s != null);
    const first = Math.min(...alarms.map(a => a.c.alarm_s)), last = Math.max(...alarms.map(a => a.c.alarm_s));
    gapText = alarms.length > 1 ? `In this event the slowest sensor alarmed ${fmt(last - first, 0)} s after the fastest. That gap is the blind spot.`
      : alarms.length === 1 ? 'Only one sensor type responded in this event.' : 'No sensor alarmed in this event.';
    const stats = b.channels.map((c, i) => h('div', { class: 'statbox' },
      h('span', { class: 'stat-label det-ch' }, swatch(i), c.name),
      h('div', { class: 'stat' }, c.alarm_s == null ? 'no alarm' : fmt(c.alarm_s, 0),
        c.alarm_s != null ? h('small', {}, `s${c.resolution_s > 2 ? ` ± ${Math.round(c.resolution_s)}` : ''}`) : null),
      Array.isArray(c.alarm_s_range) && c.alarm_s != null && c.alarm_s_range[0] != null && c.alarm_s_range[0] !== c.alarm_s_range[1]
        ? h('small', {}, `${c.alarm_s_range[0]} s with a looser threshold`) : null));
    holder.replaceChildren(
      h('div', { class: 'grid g3 det-stats' }, stats),
      lineChart({
        title: `${T_BLIND} ${b.name}`, series, xLabel: 'Time since ignition, s', yLabel: 'Signal ÷ alarm margin (capped at 2)', yDom: [-1, 2.1], unit: 'x',
        markers: [{ x: 0, label: '', color: 'transparent' }, ...alarms.map((a, k) => ({ x: a.c.alarm_s, label: `${a.c.key || ''} ${a.c.alarm_s} s`.trim(), color: SERIES[a.i % SERIES.length], dy: k * 13 }))],
      }),
      h('p', { class: 'det-gap' }, gapText),
      lat.threshold_rule ? h('p', {}, h('small', {}, [lat.threshold_rule, lat.resolution_note, lat.baseline_note, lat.placement_note, lat.observation, lat.assumption].filter(Boolean).join(' '))) : null);
  };
  sel.addEventListener('change', () => { draw(); announce(`${lat.burns[Number(sel.value)]?.name}. ${gapText}`); });
  draw();
  return card(T_BLIND, lat.status, lat.source,
    h('div', { class: 'row' }, h('label', { for: selId }, 'Burn'), sel),
    lat.y_meaning ? h('p', { class: 'det-ymean' }, h('small', {}, lat.y_meaning)) : null,
    holder);
}

// ---------------------------------------------------------------------------------------------------------------
// #2 Smoke the detector misses (smoke_sizes.json, reported)
// ---------------------------------------------------------------------------------------------------------------
export function smokeMissCard(smoke) {
  const T = 'Smoke the detector misses';
  // the main empty-state shape, with its example size replaced by a placeholder so no made-up size is shown
  if (isMissing(smoke) || !Array.isArray(smoke.materials) || !smoke.materials.length) return card(T, 'missing', null,
    empty('Waiting for SAME particle sizes', 'smoke_sizes', 'Mean particle diameter per material.', '{ "status":"real", "detector_thresholds_nm":[300,500,1000], "materials":[{ "name":"Kapton", "d_nm":"<nm>" }] }'));
  const thrs = Array.isArray(smoke.detector_thresholds_nm) && smoke.detector_thresholds_nm.length ? smoke.detector_thresholds_nm : null;
  let thr = thrs ? (thrs[1] ?? thrs[0]) : null;   // main's default: the middle limit (500 nm)
  const holder = h('div');
  const draw = () => {
    const mb = m => m.mass_below && m.mass_below[String(thr)];
    const share = v => `${Math.round(v * 100)}%`;
    const rows = [...smoke.materials].sort((a, b) => a.d_nm - b.d_nm).map(m => ({
      name: m.name, value: m.d_nm,
      text: mb(m) ? `${m.d_nm} nm · ${share(mb(m).unaged)} hidden` : `${m.d_nm} nm`,
      label: `<b>${esc(m.name)}</b><br>${m.d_kind ? 'mass median ' : ''}${esc(m.d_nm)} nm` +
        (mb(m) ? `<br>${share(mb(m).unaged)} of the smoke mass is finer than ${esc(thr)} nm (${share(mb(m).aged)} after 12 min of aging)` : ''),
    }));
    const below = r => thr != null && r.value < thr;
    const hidden = rows.filter(below).length;
    holder.replaceChildren(
      dotRows({
        title: `${T} (limit ${thr} nm)`, rows, xDom: [20, 3000],   // display domain from main: 20 to 3000 nm, log scale
        xLabel: smoke.materials[0].d_kind ? 'Mass median smoke particle diameter, nm (log scale)' : 'Smoke particle diameter, nm (log scale)',
        shadeBelow: thr, refs: thr != null ? [{ x: thr, label: `detector sensitive above ~${thr} nm` }] : [],
        colorFn: r => (below(r) ? C.s2 : C.s3), shapeFn: r => (below(r) ? 'diamond' : 'circle'),
      }),
      legend([{ label: `Most smoke mass finer than ${thr} nm`, color: C.s2, mark: 'diamond' }, { label: `Most smoke mass coarser than ${thr} nm`, color: C.s3, mark: 'dot' }]),
      h('p', { class: 'det-count' }, `For ${hidden} of ${rows.length} materials, most of the smoke mass is finer than the chosen limit. The shaded zone is where a light-scattering detector responds weakly.`));
    return `${thr} nm. For ${hidden} of ${rows.length} materials, most of the smoke mass is finer than the chosen limit.`;
  };
  draw();
  const chips = thrs ? seg({ label: 'Detector sensitivity threshold', options: thrs.map(t => [t, `${t} nm`]), value: thr, onChange: v => { thr = Number(v); announce(draw()); } }) : null;
  return card(T, smoke.status, smoke.source,
    chips, holder,
    h('p', { class: 'det-link' }, h('a', { href: figLink('predict', T_WHATIF) }, 'Where should detectors go? See the what-if runs →')),
    smoke.note ? h('p', {}, h('small', {}, smoke.note)) : null);
}

// ---------------------------------------------------------------------------------------------------------------
// #7 Dust or smoke? Checking the counter first (daft.json, real)
// ---------------------------------------------------------------------------------------------------------------
export function daftCard(d) {
  const T = 'Dust or smoke? Checking the counter first';
  if (isMissing(d) || !Array.isArray(d.sessions)) return card(T, 'missing', null,
    empty('Waiting for the DAFT session table', 'daft', 'NASA\'s DAFT / DAFT-2 sessions: session, day, hardware and where it sampled.',
      '{ "status":"real", "source":"...", "objective_quote":"...", "what_it_means":"...", "sessions":[{ "session":"...", "day":"...", "hardware":"...", "where":"..." }], "not_in_archive":"..." }'));
  return card(T, d.status, d.source,
    h('p', {}, d.objective_quote ? `“${d.objective_quote}” ` : null, d.what_it_means),
    h('ol', { class: 'timeline' }, d.sessions.map(s => h('li', { class: 'tl-item' }, h('b', {}, `${s.session} · ${s.day}`), h('span', {}, s.hardware), h('small', {}, s.where)))),
    d.not_in_archive ? h('p', {}, h('small', {}, d.not_in_archive)) : null);
}

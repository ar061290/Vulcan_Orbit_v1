import { h, load, page, card, empty, fmt } from '../lib.js';
import { lineChart, dotRows, SERIES, C } from '../charts.js';
import { replayCard, daftCard, gasCard, rateCard } from '../detect_ui.js';
export default async function (root) {
  const [lat, smoke, daft, gas, ror] = await Promise.all([load('saffire_latency'), load('smoke_sizes'), load('daft'), load('saffire_gas'), load('rate_of_rise')]);
  // Blind Spot timeline
  let latCard;
  if (lat.status === 'missing') latCard = card('Blind Spot: who alarms first?', 'missing', null, empty('Waiting for Saffire-III telemetry', 'saffire_latency', 'One burn per entry, each channel scaled so 1.0 is its alarm threshold.', '{ "status":"real", "y_meaning":"...", "burns":[{ "name":"Burn 1", "t":[0,1,2], "channels":[{ "key":"radiometer", "name":"Radiometer", "values":[0,0.2,1.1], "alarm_s":2 }] }] }'));
  else {
    const holder = h('div'), sel = h('select', { 'aria-label': 'Burn' }, ...lat.burns.map((b, i) => h('option', { value: i }, b.name)));
    const draw = () => {
      const b = lat.burns[sel.value];
      const CAP = 2;   // y is capped for display: radiometers reach about 100x their alarm margin
      const series = b.channels.map((c, i) => ({ name: c.name, color: SERIES[i], points: b.t.map((t, k) => [t, Math.max(-1, Math.min(CAP, c.values[k]))]) }));
      const alarms = b.channels.map((c, i) => ({ c, i })).filter(o => o.c.alarm_s != null);
      const first = Math.min(...alarms.map(a => a.c.alarm_s)), last = Math.max(...alarms.map(a => a.c.alarm_s));
      holder.replaceChildren(
        h('div', { class: 'grid g3', style: 'margin-bottom:10px' }, ...b.channels.map((c, i) => h('div', {}, h('small', {}, h('i', { style: `display:inline-block;width:10px;height:10px;border-radius:2px;background:${SERIES[i]};margin-right:6px` }), c.name), h('div', { class: 'stat' }, c.alarm_s == null ? 'never' : fmt(c.alarm_s, 0), c.alarm_s != null && h('small', {}, `s${c.resolution_s > 2 ? ` ± ${Math.round(c.resolution_s)}` : ''}`)),
          c.alarm_s_range && c.alarm_s != null && c.alarm_s_range[0] !== c.alarm_s_range[1] ? h('small', {}, `${c.alarm_s_range[0]} s with a looser threshold`) : null))),
        lineChart({ series, xLabel: 'Time since ignition, s', yLabel: 'Signal ÷ alarm margin (capped at 2)', yDom: [-1, 2.1], unit: 'x', markers: [{ x: 0, label: '', color: 'transparent' }, ...alarms.map((a, k) => ({ x: a.c.alarm_s, label: `${a.c.alarm_s} s`, color: SERIES[a.i], dy: k * 13 }))] }),
        h('p', { style: 'margin-top:8px' }, alarms.length > 1 ? `In this event the slowest sensor alarmed ${fmt(last - first, 0)} s after the fastest. That gap is the blind spot.` : alarms.length === 1 ? `Only one sensor type responded in this event.` : 'No sensor alarmed in this event.'),
        lat.threshold_rule ? h('p', {}, h('small', {}, lat.threshold_rule + ' ' + (lat.resolution_note || '') + ' ' + (lat.observation || '') + ' ' + (lat.assumption || ''))) : null);
    };
    sel.addEventListener('change', draw); draw();
    latCard = card('Blind Spot: who alarms first?', lat.status, lat.source, h('div', { class: 'row' }, h('label', {}, 'Burn ', sel), h('small', {}, lat.y_meaning)), holder);
  }
  // Smoke miss map
  let smCard;
  if (smoke.status === 'missing') smCard = card('Smoke the detector misses', 'missing', null, empty('Waiting for SAME particle sizes', 'smoke_sizes', 'Mean particle diameter per material.', '{ "status":"real", "detector_thresholds_nm":[300,500,1000], "materials":[{ "name":"Kapton", "d_nm":47 }] }'));
  else {
    const holder = h('div'); let thr = smoke.detector_thresholds_nm[1];
    const draw = () => {
      const mb = m => m.mass_below && m.mass_below[String(thr)];
      const rows = [...smoke.materials].sort((a, b) => a.d_nm - b.d_nm).map(m => ({ name: m.name, value: m.d_nm, text: mb(m) ? `${m.d_nm} nm · ${Math.round(mb(m).unaged * 100)}% hidden` : `${m.d_nm} nm`,
        label: `<b>${m.name}</b><br>${m.d_kind ? 'mass median ' : ''}${m.d_nm} nm` + (mb(m) ? `<br>${Math.round(mb(m).unaged * 100)}% of the smoke mass is finer than ${thr} nm (${Math.round(mb(m).aged * 100)}% after 12 min of aging)` : '') }));
      const hidden = rows.filter(r => r.value < thr).length;
      holder.replaceChildren(dotRows({ rows, xDom: [20, 3000], xLabel: smoke.materials[0].d_kind ? 'Mass median smoke particle diameter, nm (log scale)' : 'Smoke particle diameter, nm (log scale)', shadeBelow: thr, refs: [{ x: thr, label: `detector sensitive above ~${thr} nm` }], colorFn: r => r.value < thr ? C.s2 : C.s3 }),
        h('p', { style: 'margin-top:8px' }, `For ${hidden} of ${rows.length} materials, most of the smoke mass is finer than the chosen limit. The shaded zone is where a light-scattering detector responds weakly.`));
    };
    draw();
    smCard = card('Smoke the detector misses', smoke.status, smoke.source,
      h('div', { class: 'row' }, h('label', {}, 'Detector sensitivity threshold '), ...smoke.detector_thresholds_nm.map(t => h('button', { class: 'chip', 'aria-pressed': t === thr, onclick: e => { thr = t; e.target.parentNode.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', c === e.target)); draw(); } }, `${t} nm`))),
      holder, h('p', {}, h('small', {}, smoke.note)));
  }
  root.append(page('Detect', 'A fire you find late is a bigger fire. These panels use NASA\'s orbital burns and smoke measurements to show which sensors see a fire first and which smoke slips past.',
    lat.status !== 'missing' ? replayCard(lat) : null,
    gas.status !== 'missing' ? gasCard(gas) : null,
    ror.status !== 'missing' ? rateCard(ror) : null,
    h('div', { class: 'grid g2' }, latCard, smCard),
    daft.status !== 'missing' ? daftCard(daft) : null));
}

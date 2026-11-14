import { h, load, page, card, empty, fmt } from '../lib.js';
import { lineChart, dotRows, SERIES, C } from '../charts.js';
export default async function (root) {
  const [lat, smoke] = await Promise.all([load('saffire_latency'), load('smoke_sizes')]);
  // Blind Spot timeline
  let latCard;
  if (lat.status === 'missing') latCard = card('Blind Spot: who alarms first?', 'missing', null, empty('Waiting for Saffire-III telemetry', 'saffire_latency', 'One burn per entry, each channel scaled so 1.0 is its alarm threshold.', '{ "status":"real", "y_meaning":"...", "burns":[{ "name":"Burn 1", "t":[0,1,2], "channels":[{ "key":"radiometer", "name":"Radiometer", "values":[0,0.2,1.1], "alarm_s":2 }] }] }'));
  else {
    const holder = h('div'), sel = h('select', { 'aria-label': 'Burn' }, ...lat.burns.map((b, i) => h('option', { value: i }, b.name)));
    const draw = () => {
      const b = lat.burns[sel.value];
      const series = b.channels.map((c, i) => ({ name: c.name, color: SERIES[i], points: b.t.map((t, k) => [t, c.values[k]]) }));
      const alarms = b.channels.map((c, i) => ({ c, i })).filter(o => o.c.alarm_s != null);
      const first = Math.min(...alarms.map(a => a.c.alarm_s)), last = Math.max(...alarms.map(a => a.c.alarm_s));
      holder.replaceChildren(
        h('div', { class: 'grid g3', style: 'margin-bottom:10px' }, ...b.channels.map((c, i) => h('div', {}, h('small', {}, h('i', { style: `display:inline-block;width:10px;height:10px;border-radius:2px;background:${SERIES[i]};margin-right:6px` }), c.name), h('div', { class: 'stat' }, c.alarm_s == null ? 'never' : fmt(c.alarm_s, 0), c.alarm_s != null && h('small', {}, 's to alarm'))))),
        lineChart({ series, xLabel: 'Time since ignition, s', yLabel: 'Multiple of alarm threshold', yDom: [0, 1.8], unit: 'x', markers: [{ x: 0, label: '', color: 'transparent' }, ...alarms.map((a, k) => ({ x: a.c.alarm_s, label: `${a.c.alarm_s} s`, color: SERIES[a.i], dy: k * 13 }))] }),
        h('p', { style: 'margin-top:8px' }, alarms.length > 1 ? `In this burn the slowest sensor alarmed ${fmt(last - first, 0)} s after the fastest. That gap is the blind spot.` : ''));
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
      const rows = [...smoke.materials].sort((a, b) => a.d_nm - b.d_nm).map(m => ({ name: m.name, value: m.d_nm, text: `${m.d_nm} nm`, label: `<b>${m.name}</b><br>${m.d_nm} nm, ${(thr / m.d_nm).toFixed(1)}x smaller than the threshold` }));
      holder.replaceChildren(dotRows({ rows, xDom: [20, 2000], xLabel: 'Smoke particle diameter, nm (log scale)', shadeBelow: thr, refs: [{ x: thr, label: `detector sensitive above ~${thr} nm` }], colorFn: r => r.value < thr ? C.s2 : C.s3 }),
        h('p', { style: 'margin-top:8px' }, `${rows.filter(r => r.value < thr).length} of ${rows.length} materials make smoke finer than the chosen threshold. The shaded zone is where a photoelectric detector responds weakly.`));
    };
    draw();
    smCard = card('Smoke the detector misses', smoke.status, smoke.source,
      h('div', { class: 'row' }, h('label', {}, 'Detector sensitivity threshold '), ...smoke.detector_thresholds_nm.map(t => h('button', { class: 'chip', 'aria-pressed': t === thr, onclick: e => { thr = t; e.target.parentNode.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', c === e.target)); draw(); } }, `${t} nm`))),
      holder, h('p', {}, h('small', {}, smoke.note)));
  }
  root.append(page('Detect', 'A fire you find late is a bigger fire. These panels use NASA\'s orbital burns and smoke measurements to show which sensors see a fire first and which smoke slips past.',
    h('div', { class: 'grid g2' }, latCard, smCard)));
}

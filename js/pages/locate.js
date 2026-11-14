import { h, load, page, card, empty, fmt } from '../lib.js';
import { scatter, lineChart, C } from '../charts.js';
export default async function (root) {
  const [loc, cnt] = await Promise.all([load('dome_locator'), load('dome_sensor_count')]);
  let a, b;
  if (loc.status === 'missing') a = card('Where the locator put the source', 'missing', 'Top view of the dome. Filled dot is the true position, ring is the estimate.',
    empty('Waiting for dome data', 'dome_locator', 'One entry per test position on the grid, in centimetres from the dome centre.',
      '{ "status":"dome", "units":"cm", "method":"least squares", "points":[\n   { "true":[10,0,5], "pred":[11.2,-0.6,5.9] }\n ] }'));
  else {
    const pts = loc.points.map(p => { const e = Math.hypot(...p.true.map((v, i) => v - p.pred[i])); return { x: p.true[0], y: p.true[1], x2: p.pred[0], y2: p.pred[1], e, label: `True (${p.true.join(', ')})<br>Estimate (${p.pred.map(v => fmt(v)).join(', ')})<br><b>Error ${fmt(e)} ${loc.units}</b>` }; });
    const errs = pts.map(p => p.e), mean = errs.reduce((x, y) => x + y, 0) / errs.length;
    a = card('Where the locator put the source', loc.status, `Top view. Method: ${loc.method || 'n/a'}. Error is measured in 3D.`,
      h('div', { class: 'grid g3', style: 'margin-bottom:8px' }, ...[['Test positions', errs.length, ''], ['Mean error', fmt(mean), loc.units], ['Worst error', fmt(Math.max(...errs)), loc.units]].map(([l, v, u]) => h('div', {}, h('small', {}, l), h('div', { class: 'stat' }, String(v), h('small', {}, u))))),
      scatter({ points: pts, xLabel: `x, ${loc.units}`, yLabel: `y, ${loc.units}`, square: true }));
  }
  if (cnt.status === 'missing') b = card('More sensors, less error', 'missing', 'How quickly accuracy improves as sensors are added.',
    empty('Waiting for dome data', 'dome_sensor_count', 'Mean error for each number of sensors, one series per method so the physics model and the neural net can be compared.',
      '{ "status":"dome", "units":"cm", "series":[\n   { "name":"Least squares", "points":[[2,6.1],[3,3.4],[4,2.2]] },\n   { "name":"Neural net",   "points":[[2,7.0],[3,4.1],[4,2.9]] }\n ] }'));
  else b = card('More sensors, less error', cnt.status, 'Mean location error on held-out positions.',
    h('div', { class: 'legend' }, ...cnt.series.map((s, i) => h('span', {}, h('i', { style: `background:${[C.s1, C.s2][i]}` }), s.name))),
    lineChart({ series: cnt.series.map((s, i) => ({ ...s, color: [C.s1, C.s2][i] })), xLabel: 'Number of sensors', yLabel: `Mean error, ${cnt.units}`, unit: ' ' + cnt.units }));
  root.append(page('Locate', 'A handful of heat sensors on a dome, and a model that works out where the source is. NASA watched its orbital burns with a similarly sparse set of radiometers; this is the bench version of that problem.',
    h('div', { class: 'grid g2' }, a, b),
    h('div', { style: 'margin-top:14px' }, card('What this does and does not show', null, null,
      h('p', {}, 'The rig runs at Earth gravity with a steady heat source. It tests whether sparse sensors can locate a source that does not flicker or send heat upward. It does not reproduce a microgravity flame.')))));
}

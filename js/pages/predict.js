import { h, load, page, card, empty, fmt } from '../lib.js';
import { scatter, C } from '../charts.js';
import { driftCard, whatifCard } from '../drift_ui.js';
export default async function (root) {
  const [m, drift, gaps, wi] = await Promise.all([load('models'), load('drift'), load('gaps'), load('whatif')]);
  const schema = '{ "status":"real", "models":[{\n   "id":"spread", "name":"Flame spread over PMMA", "question":"How fast does it spread?",\n   "data":"BASS-II (PSI-25)", "method":"de Ris formula + learned correction", "validation":"leave one session out",\n   "metric":"R2", "score":0.58, "score_range":[0.41,0.70], "baseline_name":"de Ris formula", "baseline_score":0.44,\n   "unit":"mm/s", "points":[{ "obs":1.2, "pred":1.1, "lo":0.8, "hi":1.5, "label":"21% O2, 10 cm/s" }],\n   "drivers":[{ "name":"Oxygen", "share":0.5 }], "limits":"..." }] }';
  const modelCards = m.status === 'missing'
    ? [card('Models trained on NASA tables', 'missing', 'Spread, extinction and cool-flame models appear here as they are trained.', empty('Waiting for model results', 'models', 'One entry per model. Predictions come from test sessions the model never saw.', schema))]
    : m.models.map(mod => card(mod.name, m.status, mod.question,
      h('div', { class: 'grid g3', style: 'margin-bottom:8px' },
        h('div', {}, h('small', {}, mod.metric + ' on unseen sessions'), h('div', { class: 'stat' }, fmt(mod.score, 2), mod.score_range && h('small', {}, `${fmt(mod.score_range[0], 2)} to ${fmt(mod.score_range[1], 2)}`))),
        h('div', {}, h('small', {}, mod.baseline_name || 'Baseline'), h('div', { class: 'stat' }, fmt(mod.baseline_score, 2))),
        h('div', {}, h('small', {}, 'Test points'), h('div', { class: 'stat' }, String(mod.points?.length || 0)))),
      mod.points?.length ? scatter({ diagonal: true, xLabel: `Observed, ${mod.unit}`, yLabel: `Predicted, ${mod.unit}`, points: mod.points.map(p => ({ x: p.obs, y: p.pred, color: C.s1, label: `<b>${p.label || ''}</b><br>Observed ${fmt(p.obs, 2)}<br>Predicted ${fmt(p.pred, 2)}` + (p.lo != null ? ` (${fmt(p.lo, 2)} to ${fmt(p.hi, 2)})` : '') })) }) : null,
      h('dl', { class: 'kv', style: 'margin-top:10px' }, ...[['Data', mod.data], ['Method', mod.method], ['Tested by', mod.validation], ['What drove it', (mod.drivers || []).map(d => `${d.name} ${Math.round(d.share * 100)}%`).join(', ')], ['Limits', mod.limits]].filter(r => r[1]).flatMap(([k, v]) => [h('dt', {}, k), h('dd', {}, v)]))));
  const dCard = drift.status === 'missing'
    ? card('Where the smoke goes', 'missing', 'Smoke drift in a cabin with ventilation and no buoyancy.', empty('Waiting for the drift simulation', 'drift', 'A grid of smoke concentration per time step, plus detector positions.', '{ "status":"model", "nx":40, "ny":20, "dt_s":5, "flow_m_s":0.1,\n  "detectors":[{ "x":35, "y":10, "name":"Return duct" }],\n  "frames":[[0,0,0.1, ...nx*ny values], ...] }'))
    : driftCard(drift);
  const wiCard = wi.status === 'missing' ? null : whatifCard(wi);
  const gapCard = gaps.status === 'missing'
    ? card('What NASA has not tested', 'missing', 'Conditions with no data, and the next experiment worth running.', empty('Waiting for the gap table', 'gaps', 'Tested ranges per investigation and the gaps the team judges most important.', '{ "status":"real", "axes":["O2 %","Pressure, kPa"],\n  "tested":[{ "inv":"BASS-II", "x":[17,22], "y":[101,101] }],\n  "verdicts":[{ "text":"Solids: no data above X% O2", "source":"..." }] }'))
    : card('What NASA has not tested', gaps.status, null, ...(gaps.verdicts || []).map(v => h('p', {}, h('b', {}, v.text), ' ', h('small', {}, v.source || ''))));
  root.append(page('Predict', 'Small models fitted to NASA\'s own tables, each compared with the textbook formula and tested on sessions it never saw. Every prediction carries a range.',
    h('div', { class: 'grid g2' }, dCard, wiCard),
    h('div', { class: 'grid g2', style: 'margin-top:14px' }, ...modelCards, gapCard),
    h('div', { style: 'margin-top:14px' }, card('Moon and Mars', null, null, h('p', {}, 'NASA\'s archive holds no combustion data taken at lunar or Martian gravity. We show microgravity and Earth-gravity results as the two ends of the range and do not invent a value in between.')))));
}

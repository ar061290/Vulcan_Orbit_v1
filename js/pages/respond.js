import { h, load, page, card, empty, fmt } from '../lib.js';
import { bars, C } from '../charts.js';
import { extinctionCard, coolFlameCard, evidenceCard } from '../respond_ui.js';
export default async function (root) {
  const [tr, ef, fx, m7, gaps, inv] = await Promise.all([load('response_trials'), load('efield'), load('flex_suppression'), load('m7_explorer'), load('gaps'), load('investigations')]);
  const trials = tr.status === 'missing'
    ? card('Bench trials: ion wind and fine mist', 'missing', 'Each trial is measured by the dome\'s own sensors, before and after.', empty('Waiting for dome trials', 'response_trials', 'One entry per trial. Use the same sensor reading before and after so the change is measured, not judged by eye.', '{ "status":"dome", "reading":"Peak thermopile temperature", "unit":"C",\n  "trials":[{ "method":"Ion wind", "source":"tea light", "before":212, "after":148, "repeat":1, "note":"flame deflected 30 deg" }] }'))
    : card('Bench trials: ion wind and fine mist', tr.status, `${tr.reading}, before and after each response. Earth gravity.`,
      h('div', { class: 'legend' }, h('span', {}, h('i', { style: `background:${C.s1}` }), 'Before'), h('span', {}, h('i', { style: `background:${C.s2}` }), 'After')),
      bars({ yLabel: `${tr.reading}, ${tr.unit}`, unit: ' ' + tr.unit, groups: tr.trials.map(t => ({ name: `${t.method} #${t.repeat || 1}`, values: [{ key: 'Before', value: t.before, color: C.s1 }, { key: 'After', value: t.after, color: C.s2 }] })) }),
      h('div', { class: 'scroll' }, h('table', {}, h('thead', {}, h('tr', {}, ...['Method', 'Source', 'Before', 'After', 'Change', 'Note'].map(x => h('th', {}, x)))), h('tbody', {}, ...tr.trials.map(t => h('tr', {}, h('td', {}, h('b', {}, t.method)), h('td', {}, t.source), h('td', { class: 'num' }, fmt(t.before)), h('td', { class: 'num' }, fmt(t.after)), h('td', { class: 'num' }, fmt((t.after - t.before) / t.before * 100, 0) + '%'), h('td', {}, t.note || '')))))));
  const efield = ef.status === 'missing'
    ? card('NASA: flames in an electric field', 'missing', 'What the ACME E-FIELD Flames experiment found in orbit, to set beside our ion wind trial.', empty('Waiting for the E-FIELD table', 'efield', 'Rows from the NASA experiment summary, plus a one-line finding with its source.', '{ "status":"real", "finding":"...", "source":"PSI-22", "rows":[{ "fuel":"...", "field_kV":2, "result":"..." }] }'))
    : card('NASA: flames in an electric field', ef.status, ef.source, h('p', {}, ef.finding),
      h('div', { class: 'scroll' }, h('table', {}, h('thead', {}, h('tr', {}, ...Object.keys(ef.rows[0] || {}).map(k => h('th', {}, k)))), h('tbody', {}, ...ef.rows.map(r => h('tr', {}, ...Object.values(r).map(v => h('td', {}, String(v)))))))));
  const flex = fx.status === 'missing'
    ? card('NASA: which gas puts a droplet flame out', 'missing', 'Share of FLEX tests that ended in extinction, by added gas.', empty('Waiting for the FLEX table', 'flex_suppression', 'Counts per suppressant gas from the FLEX summary table.', '{ "status":"real", "source":"PSI-69", "groups":[{ "gas":"CO2", "tests":40, "extinguished":31 }] }'))
    : card('NASA: which gas puts a droplet flame out', fx.status, fx.source, bars({ yLabel: 'Tests ending in extinction, %', unit: '%', groups: fx.groups.map(g => ({ name: g.gas, values: [{ key: `${g.extinguished} of ${g.tests} tests`, value: Math.round(g.extinguished / g.tests * 100), color: C.s3 }] })) }));
  root.append(page('Respond', 'What NASA\'s experiments say about putting a fire out without gravity, next to what our bench rig measured. The two are shown together and never merged.',
    gaps.status === 'missing' ? null : h('div', { style: 'margin-bottom:14px' }, evidenceCard(gaps, inv)),
    m7.status === 'missing' ? null : h('div', { class: 'grid g2', style: 'margin-bottom:14px' }, extinctionCard(m7), coolFlameCard(m7)),
    h('div', { class: 'grid g2' }, trials, efield, flex,
      card('Reading the comparison', null, null,
        h('p', {}, 'Our trials happen at Earth gravity, where hot gas rises and feeds the flame fresh air. A result on the bench shows a method can disturb a flame; it does not show it would work in orbit.'),
        h('p', {}, 'This page summarises evidence. It is not a firefighting procedure.')))));
}

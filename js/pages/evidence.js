import { trustCard } from '../trust.js';
import { h, load, page, card, badge } from '../lib.js';
export default async function (root) {
  const [ev, man, fs, sp, lw, tr] = await Promise.all([load('evidence'), load('manifest'), load('flame_static'), load('flame_spread'), load('drift_whatif'), load('trust')]);
  const sims = [['Flame model', fs], ['Flame spread', sp], ['Cabin air model (LBM)', lw]].flatMap(([n, f]) => (f.checks || []).map(c => ({ n, ...c })));
  const simLab = v => v === true ? ['pass', 'Pass'] : v === false ? ['fail', 'Fail (kept on record)'] : ['pending', 'Not run: no data'];
  const lab = { pending: 'Not run yet', pass: 'Pass', fail: 'Fail (kept on record)' };
  root.append(page('Evidence', 'Every claim on this site has a check, a reference and a pass limit written before the check was run. Failures stay on the page.',
    tr.status === 'missing' ? null : trustCard(tr),
    card('Checks', null, ev.note, h('div', { class: 'scroll' }, h('table', {}, h('thead', {}, h('tr', {}, ...['', 'Check', 'Compared against', 'Pass limit', 'Result', 'Owner'].map(t => h('th', {}, t)))),
      h('tbody', {}, ...(ev.checks || []).map(c => h('tr', {}, h('td', {}, c.id), h('td', {}, h('b', {}, c.what)), h('td', {}, c.ref), h('td', {}, c.limit),
        h('td', {}, h('span', { class: `status ${c.state}` }, c.result || lab[c.state] || c.state)), h('td', {}, c.owner))))))),
    sims.length ? h('div', { style: 'margin-top:14px' }, card('Simulation checks', 'model', `${sims.filter(c => c.ok === true).length} pass, ${sims.filter(c => c.ok === false).length} fail, ${sims.filter(c => c.ok == null).length} not run. Pass rules in models/*/RULES.md were committed before any check ran.`,
      h('div', { class: 'scroll' }, h('table', {}, h('thead', {}, h('tr', {}, ...['Model', 'Check', 'Result', 'Status'].map(t => h('th', {}, t)))),
        h('tbody', {}, ...sims.map(c => { const [s, t] = simLab(c.ok); return h('tr', {}, h('td', {}, c.n), h('td', {}, h('code', {}, c.id)), h('td', {}, c.result), h('td', {}, h('span', { class: `status ${s}` }, t))); })))))) : null,
    h('div', { style: 'margin-top:14px' }, card('Where each number comes from', null, 'One row per data file. A panel is only as good as the file behind it.',
      h('div', { class: 'scroll' }, h('table', {}, h('thead', {}, h('tr', {}, ...['File', 'Feeds', 'Status', 'Owner'].map(t => h('th', {}, t)))),
        h('tbody', {}, ...(man.files || []).map(f => h('tr', {}, h('td', {}, h('code', {}, `data/${f.name}.json`)), h('td', {}, f.what), h('td', {}, badge(f.status)), h('td', {}, f.owner)))))))),
    h('div', { style: 'margin-top:14px' }, card('Known limits', null, null, h('ul', { style: 'margin:0;padding-left:18px;color:var(--ink2)' },
      ...['The bench rig runs at Earth gravity. It tests sensing and response ideas; it does not reproduce a microgravity flame.',
        'NASA tables for each model are small (tens to a few hundred rows). Scores are reported as ranges from sessions the model never saw.',
        'No prediction is made for lunar or Martian gravity; the archive has no such data.',
        'A line of sight to a sensor is not a guarantee of detection, and a model output is not a safety certification.'].map(t => h('li', { style: 'margin-bottom:6px' }, t)))))));
}

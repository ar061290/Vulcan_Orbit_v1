// "NASA says / we get" (data/crosscheck.json), permutation tests (data/permutation.json), alarm-threshold sensitivity
// (data/latency_sensitivity.json).
import { h, card } from './lib.js';
export function crosscheckCard(c) {
  return card('NASA says / we get', c.status, `${c.what} Checked ${c.checked}. Where NASA's own sources disagree, both are shown.`,
    h('div', { class: 'scroll' }, h('table', { class: 'xcheck' },
      h('thead', {}, h('tr', {}, ...['Topic', 'NASA says (summarised)', 'We get / use', 'Verdict'].map(x => h('th', {}, x)))),
      h('tbody', {}, ...c.rows.map(r => h('tr', {},
        h('td', {}, h('b', {}, r.topic)),
        h('td', {}, r.nasa, h('br'), h('small', {}, ...r.sources.flatMap(([t, u], i) => [i ? ' · ' : '', h('a', { href: u, target: u.startsWith('#') ? null : '_blank', rel: 'noopener' }, t)]))),
        h('td', {}, r.ours),
        h('td', {}, h('span', { class: `lvl ${/conflict|not compared/i.test(r.verdict) ? 'demo' : 'real'}` }, r.verdict))))))));
}
export function permutationCard(p) {
  return card('Could the scores be luck?', p.status, 'We shuffled the yes/no answers and reran the exact same validation, many times. If the real score is rarely matched by shuffled data, it is not luck.',
    h('div', { class: 'scroll' }, h('table', {}, h('thead', {}, h('tr', {}, ...['Model', 'Real score (AUC)', 'Shuffled: average', 'Shuffled: top 5%', 'p-value', 'Validation'].map(x => h('th', {}, x)))),
      h('tbody', {}, ...p.rows.map(r => h('tr', {}, h('td', {}, r.name), h('td', {}, h('b', {}, r.real_auc)), h('td', {}, r.null_mean), h('td', {}, r.null_95),
        h('td', {}, h('span', { class: `lvl ${r.p < 0.01 ? 'real' : 'demo'}` }, `p = ${r.p}`), h('br'), h('small', {}, `${r.n_perm} shuffles`)), h('td', {}, h('small', {}, r.split))))))),
    h('p', {}, 'Reading it: p = 0.001 is the smallest value 1,000 shuffles can give. The smoke-miss model beats shuffled labels (p ≈ 0.04) but its score range still reaches 0.44, so 16 tests are too few to rely on it.'),
    h('p', {}, h('small', {}, `${p.method} M7 scores here use a fixed reference model on one grouped split, so they differ slightly from M7's headline scores. Script: scripts/permutation_tests.py.`)));
}
export function sensitivityCard(s) {
  return card('Does the alarm rule change the answer?', s.status, 'Our alarm rule is ours, so we tried stricter and looser versions. t = 0 is when the igniter (or smoke wire) switches on.',
    h('div', { class: 'scroll' }, h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, 'Event'), h('th', {}, 'Sensor'), ...s.ks.map(k => h('th', {}, `${k} SD`)))),
      h('tbody', {}, ...s.rows.map(r => h('tr', {}, h('td', {}, r.event), h('td', {}, r.channel), ...s.ks.map(k => h('td', { class: k === 5 ? 'sel' : '' }, r[`k${k}`] == null ? 'never' : `${r[`k${k}`]} s`))))))),
    h('p', {}, `Seconds after ignition. 5 SD is the rule used everywhere on the site. Resolution: ${s.resolution}.`));
}

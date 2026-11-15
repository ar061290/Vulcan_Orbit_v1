// "Can you trust this?": every model on one table (data/trust.json, built from each model's own output file).
import { h, card } from './lib.js';
import { CRED, FACTORS } from './provenance.js';
const CK = { 'm7-extinction': 'ext', 'm7-burning-rate': 'rate', 'm7-cool-flame': 'cool', 'smoke-miss': 'miss', m6: 'm6', m6b: 'm6b', drift: 'drift', rate: 'latency' };
const f = v => v == null ? '—' : typeof v === 'number' ? (Math.abs(v) < 1 ? v.toFixed(3) : String(v)) : String(v);
export function trustCard(t) {
  const passed = t.rows.filter(r => r.passed).length;
  return card('Can you trust this?', t.status, `${t.what} ${passed} of ${t.rows.length} met their own rule; the rest are shown as misses.`,
    h('div', { class: 'scroll' }, h('table', { class: 'trust' },
      h('thead', {}, h('tr', {}, ...['Question', 'Kind', 'Score on unseen data', 'Range', 'Could it be luck?', 'Simple baseline', 'Own rule', 'Trust (0-4)'].map(x => h('th', {}, x)))),
      h('tbody', {}, ...t.rows.map(r => { const c = CRED[CK[r.id]];
        return h('tr', {},
          h('td', {}, h('a', { href: `#/${r.page}` }, r.name), h('br'), h('small', {}, r.metric || '')),
          h('td', {}, r.kind), h('td', { class: 'num' }, f(r.score)), h('td', {}, h('small', {}, Array.isArray(r.range) ? `${f(r.range[0])} to ${f(r.range[1])}` : f(r.range))),
          h('td', {}, r.perm_p != null ? h('small', {}, `p = ${r.perm_p}`, h('br'), `${r.perm_n} label shuffles`) : h('small', {}, '—')),
          h('td', {}, h('small', {}, r.baseline ? `${r.baseline}${r.baseline_score != null ? ': ' + f(r.baseline_score) : ''}` : '—', r.caveat ? h('br') : null, r.caveat ? h('b', {}, r.caveat) : null)),
          h('td', {}, h('span', { class: `lvl ${r.passed ? 'real' : 'demo'}` }, r.passed ? 'Met' : 'Missed'), h('br'), h('small', {}, r.rule)),
          h('td', {}, c ? h('span', { class: 'trust-dots', title: FACTORS.map(([k, n]) => `${n} ${c[k]}/4`).join(', '), 'aria-label': FACTORS.map(([k, n]) => `${n} ${c[k]} of 4`).join(', ') }, FACTORS.map(([k]) => c[k]).join(' · ')) : '—'));
      })))),
    h('p', {}, h('a', { href: '#/models' }, 'Open the full model cards →')),
    h('p', {}, h('small', {}, `Trust column: Verification · Validation · Input pedigree · Uncertainty · Robustness, each 0-4 after NASA-STD-7009A, self-assessed. ${t.note}`)));
}

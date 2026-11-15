// Mission check: pick a cabin atmosphere, see how much NASA microgravity fire data exists near it (data/gaps.json),
// plus the large Saffire burns reported nearby. Counts only: no prediction for any atmosphere or gravity.
import { h, badge, params } from './lib.js';
const SHORT = a => a.replace(/ \(.*NASA EAWG.*\)/, ' (NASA-recommended)').replace(' at ', ' / ').replace(/ \((10\.2|8\.0) psi[a]?\)/, '');
export function coverageLine(g) {
  const iss = g.probes[0], other = g.probes.slice(1), kinds = Object.keys(iss.counts);
  const holes = other.reduce((n, p) => n + kinds.filter(k => p.counts[k] === 0).length, 0);
  return `NASA's microgravity tests cover today's station air for all ${kinds.length} fire types. For the ${other.length} lower-pressure, oxygen-richer cabins planned for exploration, ${holes} of ${other.length * kinds.length} fire-type checks have no test at all.`;
}
export function missionCheck(g) {
  const want = params().atm, start = Math.max(0, g.probes.findIndex(p => want && SHORT(p.atmosphere).toLowerCase().startsWith(want.toLowerCase())));
  const body = h('div', { class: 'mc-body', 'aria-live': 'polite' });
  const btns = g.probes.map((p, i) => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(i === start), onclick: () => show(i) }, SHORT(p.atmosphere)));
  const show = i => {
    btns.forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)));
    const p = g.probes[i], near = (g.reported?.points || []).filter(([o, k]) => Math.abs(o - p.o2) <= 3 && Math.abs(k - p.kpa) <= 10);
    body.replaceChildren(...[
      h('div', { class: 'mc-counts' }, ...Object.entries(p.counts).map(([k, n]) => h('div', { class: `mc-c ${n ? '' : 'none'}` }, h('b', {}, n), h('span', {}, k), h('small', {}, n ? 'NASA tests nearby' : 'no NASA test')))),
      near.length ? h('p', {}, `Also nearby: ${near.length} large Saffire burn${near.length > 1 ? 's' : ''} in cargo ships (${near.map(x => x[2]).join(', ')}), reported in a NASA paper.`) : null,
      h('p', { class: 'mc-note' }, `${p.o2}% oxygen at ${p.kpa} kPa. "Nearby" means within 3 oxygen points and 10 kPa. ${g.note}`),
      h('p', {}, h('a', { href: '#/predict' }, 'See the full map of what NASA has tested →'))].filter(Boolean));
    try { history.replaceState(null, '', `#/${location.hash.replace(/^#\//, '').split('?')[0] || 'overview'}?atm=${encodeURIComponent(SHORT(p.atmosphere).split(' ')[0])}`); } catch {}
  };
  show(start);
  return h('section', { class: 'card mission', 'aria-labelledby': 'mc-h' },
    h('h2', { id: 'mc-h' }, 'Mission check: is there NASA data for your cabin air?', badge(g.status)),
    h('p', { class: 'sub' }, 'Pick a cabin atmosphere. We count NASA\'s microgravity fire tests run near it, by type of fire. Counts only: we make no prediction for air NASA did not test, and none for Moon or Mars gravity.'),
    h('div', { class: 'row', role: 'group', 'aria-label': 'Cabin atmosphere' }, ...btns), body);
}

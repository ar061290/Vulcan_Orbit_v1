// Mission check: pick a cabin atmosphere, see how much NASA microgravity fire data exists near it (data/gaps.json),
// plus the large Saffire burns reported nearby. Counts only: no prediction for any atmosphere or gravity.
// Ported from main's js/mission.js (site/REBUILD_PLAN.md §2.11). Changes from main:
//  - the body has no aria-live of its own; a chip change calls announce(), the site's one polite live region (D5.9);
//  - ?atm= is written back with setParams (other query keys are kept);
//  - "See the full map…" links with figLink, so it opens the Predict fold that holds the gap map;
//  - the chips are pressed buttons inside a labelled group with a visible label.
import { h, add, badge, params, setParams, announce } from './lib.js';
import { figLink } from './passes.js';

// Display names for the probe atmospheres (main, verbatim).
const SHORT = a => a.replace(/ \(.*NASA EAWG.*\)/, ' (NASA-recommended)').replace(' at ', ' / ').replace(/ \((10\.2|8\.0) psi[a]?\)/, '');
// The "nearby" window is a team choice from main (no citation); it is stated on screen in the note below the counts.
const NEAR_O2 = 3, NEAR_KPA = 10;
const probesOf = g => (Array.isArray(g?.probes) ? g.probes : []);

/** "NASA's microgravity tests cover today's station air for all 3 fire types. For the 3 …, 6 of 9 … have no test at all." */
export function coverageLine(g) {
  const probes = probesOf(g);
  if (!probes.length) return 'Coverage is not available yet (data/gaps.json has no probe atmospheres).';
  const iss = probes[0], other = probes.slice(1), kinds = Object.keys(iss.counts || {});
  const holes = other.reduce((n, p) => n + kinds.filter(k => (p.counts || {})[k] === 0).length, 0);
  return `NASA's microgravity tests cover today's station air for all ${kinds.length} fire types. For the ${other.length} lower-pressure, oxygen-richer cabins planned for exploration, ${holes} of ${other.length * kinds.length} fire-type checks have no test at all.`;
}

/** The mission-check card. opts.params: the route's query (defaults to the current URL's). */
export function missionCheck(g, opts = {}) {
  const probes = probesOf(g);
  const want = (opts.params || params()).atm;
  const start = Math.max(0, probes.findIndex(p => want && SHORT(p.atmosphere).toLowerCase().startsWith(String(want).toLowerCase())));
  const body = h('div', { class: 'mc-body' });
  const nearOf = p => (g.reported?.points || []).filter(([o, k]) => Math.abs(o - p.o2) <= NEAR_O2 && Math.abs(k - p.kpa) <= NEAR_KPA);
  const summary = i => {
    const p = probes[i], near = nearOf(p);
    const counts = Object.entries(p.counts || {}).map(([k, n]) => (n ? `${n} NASA tests nearby for ${k}` : `no NASA test for ${k}`)).join(', ');
    return `${SHORT(p.atmosphere)}: ${counts}.${near.length ? ` Also ${near.length} reported large Saffire burn${near.length > 1 ? 's' : ''} nearby.` : ''}`;
  };
  const show = (i, user) => {
    btns.forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)));
    const p = probes[i], near = nearOf(p);
    body.replaceChildren();   // replaceChildren(null) would print "null"; add() drops it
    add(body,
      h('div', { class: 'mc-counts' }, Object.entries(p.counts || {}).map(([k, n]) => h('div', { class: `mc-c${n ? '' : ' none'}` },
        h('b', {}, n), h('span', {}, k), h('small', {}, n ? 'NASA tests nearby' : 'no NASA test')))),
      near.length ? h('p', {}, `Also nearby: ${near.length} large Saffire burn${near.length > 1 ? 's' : ''} in cargo ships (${near.map(x => x[2]).join(', ')}), reported in a NASA paper.`, ' ', badge(g.reported.status || 'reported')) : null,
      h('p', { class: 'mc-note' }, `${p.o2}% oxygen at ${p.kpa} kPa. "Nearby" means within ${NEAR_O2} oxygen points and ${NEAR_KPA} kPa. ${g.note || ''}`.trim()),
      h('p', {}, h('a', { href: figLink('predict', 'What NASA has not tested') }, 'See the full map of what NASA has tested →')));
    if (user) {   // only on a visitor's click: never during a (possibly detached) render
      try { setParams({ atm: SHORT(p.atmosphere).split(' ')[0] }); } catch { /* URL state is a convenience */ }
      announce(summary(i));
    }
  };
  const btns = probes.map((p, i) => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(i === start), onclick: () => show(i, true) }, SHORT(p.atmosphere)));
  if (probes.length) show(start, false);
  else body.append(h('p', {}, 'No probe atmospheres in data/gaps.json yet.'));
  return h('section', { class: 'card mission', 'aria-labelledby': 'mc-h', 'data-title': 'Mission check: is there NASA data for your cabin air?' },
    h('h2', { id: 'mc-h' }, 'Mission check: is there NASA data for your cabin air?', badge(g.status)),
    h('p', { class: 'sub' }, 'Pick a cabin atmosphere. We count NASA\'s microgravity fire tests run near it, by type of fire. Counts only: we make no prediction for air NASA did not test, and none for Moon or Mars gravity.'),
    h('div', { class: 'mc-pick' },
      h('span', { id: 'mc-atm', class: 'seg-label' }, 'Cabin atmosphere'),
      h('div', { class: 'row', role: 'group', 'aria-labelledby': 'mc-atm' }, btns)),
    body);
}

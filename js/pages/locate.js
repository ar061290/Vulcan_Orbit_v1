// #/locate "Our bench rig" (REBUILD_PLAN §3.13, spec C5): the camera and optical-flow rig. The old thermopile panels
// are dropped (plan v2 removed features 3, 4 and 5). keep = 1 (site.js), so only the first block shows before the fold;
// the first block holds the explainer and its limits side by side, so the limits are never hidden.
import { h, load, page, card, isMissing } from '../lib.js';
import { benchExplainCard, cvLatestCard, pendingCard, doesNotShowCard, plannedCard } from '../fig_bench.js';
import { figLink } from '../passes.js';

/** "Bench mist trial" is drawn by fig_respond.mistTrialCard (shared with Put it out). If that module cannot be loaded,
 *  this fallback says the same thing the spec requires (C6) and draws nothing: "Bench mist trial: not completed". */
async function mistCard(tr) {
  try {
    const m = await import('../fig_respond.js');
    if (typeof m.mistTrialCard === 'function') return m.mistTrialCard(tr);
  } catch (e) { console.warn('locate: js/fig_respond.js not available, using the plain mist-trial card', e); }
  const measured = !isMissing(tr) && tr.status === 'dome';
  return card('Bench mist trial', measured ? 'dome' : 'missing', 'Fine mist on a small flame on the bench, measured by the dome before and after. Optional in plan v2.',
    measured
      ? h('p', {}, 'The measured trial is drawn on ', h('a', { href: figLink('respond', 'Bench mist trial') }, 'the Put it out page'), '.')
      : h('div', { class: 'empty' }, h('h3', {}, 'Bench mist trial: not completed.'),
        h('p', {}, 'It is optional and is done last, after the camera model and the smoke sensor. Nothing is drawn until data/response_trials.json holds measured dome data.')));
}

export default async function render(root, ctx) {
  // card titles first (site map): the explainer and limits need no data
  const first = h('div', { class: 'grid g2' }, benchExplainCard(), doesNotShowCard());
  const pg = page('Bench rig',
    'A camera and a smoke-flow sensor on a bench-top dome, at Earth gravity. The camera\'s reading of the flame is meant to be the first step of the site\'s pipeline, feeding the growth simulation on the Assess page.',
    first);
  root.append(pg);
  const [cv, tr] = await Promise.all([load('cv_latest'), load('response_trials')]);
  pg.append(
    cvLatestCard(cv),
    h('div', { class: 'grid g3' }, pendingCard('cv'), pendingCard('depth'), pendingCard('flow')),
    await mistCard(tr),
    plannedCard());
}

// Put it out (#/respond): "What puts it out?" (site/REBUILD_PLAN.md §3.7).
// Order: 1 evidence coverage, 2 response evidence for the fire on Assess (js/fig_response.js), then, folded (keep 2):
// droplet extinction, cool flames, FLEX suppressants beside the M7 points, NASA E-FIELD (context only), the bench mist
// trial and "Reading the comparison". Ion wind is not mentioned anywhere (spec C6).
import { h, load, page, card, isMissing, pct } from '../lib.js';
import { coverageCard, extinctionCard, coolFlameCard, flexCard, efieldCard, mistTrialCard, readingCard, mistRows, dropletHero } from '../fig_respond.js';
import { setField } from '../field.js';

const RESPONSE_TITLE = 'Response evidence for this fire';

/** The C4 card from js/fig_response.js, fed by the shared Assess store. If that module (or assess_core.js) cannot be
 *  loaded, the card still renders, with its title, as a "No data yet" panel, so the page never goes blank. */
async function responseBlock(ctx, examples) {
  // Both Assess and Put it out start the store from the URL (idempotent; §3.5). Not on a detached render (§0 rule 6).
  if (!ctx.detached && ctx.store?.initFromURL && !isMissing(examples)) ctx.store.initFromURL(ctx.params || {}, examples);
  try {
    const { responseEvidenceCard } = await import('../fig_response.js');
    // Detached (the Sources site map) only needs the title, so the Assess data files are not fetched there.
    const data = ctx.detached ? null : await (await import('../assess_core.js')).loadAssessData();
    const el = await responseEvidenceCard(data, ctx.store, ctx);
    if (el) return el;
    throw new Error('responseEvidenceCard returned nothing');
  } catch (e) {
    console.warn('Put it out: the response evidence card could not be built', e);
    return card(RESPONSE_TITLE, 'missing', 'The evidence that applies to the fire set on Assess: suppressants, flames going out at low airflow, what NASA has not tested, and the urgency.',
      h('div', { class: 'empty' }, h('h3', {}, 'This card is not available yet'),
        h('p', {}, 'The response evidence card (js/fig_response.js) could not be loaded. The figures below do not depend on it.'),
        h('p', {}, h('a', { href: '#/assess' }, 'Set up a fire on Assess'))),
      h('p', {}, 'A summary of evidence, not a flight procedure.'));
  }
}

export default async function render(root, ctx) {
  const [tr, ef, fx, m7, gaps, inv, examples, models] = await Promise.all([
    load('response_trials'), load('efield'), load('flex_suppression'), load('m7_explorer'), load('gaps'), load('investigations'), load('growth_examples'), load('models'),
  ]);
  // UI lock: zoom the shared field into the droplet (camera only; field values never stand for data here).
  if (!ctx.detached) ctx.onMount(() => setField({ dist: 2.2, g: 0 }));
  const mistDone = mistRows(tr).length > 0;
  const lead = `What NASA's experiments say about putting a fire out without gravity, next to ${mistDone ? 'what our bench mist trial measured' : 'our bench mist trial, which is not completed yet'}. The two are shown together and never merged.`;
  root.append(page('Put it out', lead,
    // The hero instrument shares the first block with the coverage card, so page.keep (2) still keeps the same
    // two figures open and the figure numbers do not change (js/passes.js foldBlocks).
    h('div', { class: 'fr-top' }, dropletHero(models, m7, ctx), coverageCard(gaps, inv)),
    await responseBlock(ctx, examples),
    h('div', { class: 'grid g2' }, extinctionCard(m7), coolFlameCard(m7)),
    h('div', { class: 'grid g2' }, flexCard(fx, m7), efieldCard(ef)),
    h('div', { class: 'grid g2' }, mistTrialCard(tr), readingCard())));
}

/** "The short answer": main's summaries.js sentences; line 3 ends "Bench mist trial: not completed." (C6). */
export async function short() {
  const [x, f, e, tr] = await Promise.all([load('m7_explorer'), load('flex_suppression'), load('efield'), load('response_trials')]);
  const out = [];
  if (isMissing(f)) out.push('The FLEX suppressant shares are not available yet (data/flex_suppression.json missing).');
  else {
    const g = Object.fromEntries((f.groups || []).map(r => [String(r.gas).split(' ')[0], r]));
    out.push(g.CO2 && g.He
      ? `In NASA's droplet tests, flames went out in ${pct(g.CO2.extinguished / g.CO2.tests)} of burns with added carbon dioxide and ${pct(g.He.extinguished / g.He.tests)} with added helium. NASA chose hard cases on purpose, so these are not a fair contest between the gases.`
      : 'The FLEX suppressant table has no carbon dioxide or helium group, so no share is given (data/flex_suppression.json).');
  }
  const auc = x?.extinction?.headline?.auc_median;
  out.push(isMissing(x) || !Number.isFinite(auc)
    ? 'The droplet extinction model is not available yet (data/m7_explorer.json missing).'
    : `Our model predicts whether a droplet flame goes out from oxygen, droplet size, fuel and added gas; oxygen matters most. It ranks the cases right ${Math.round(auc * 10)} times in 10 on test sessions it never saw.`);
  const n = mistRows(tr).length;
  const mist = n ? `Bench mist trial: ${n} mist run${n > 1 ? 's' : ''} measured on the dome, at Earth gravity.` : 'Bench mist trial: not completed.';
  out.push(isMissing(e)
    ? `The NASA E-FIELD summary is not available yet (data/efield.json missing). ${mist}`
    : `NASA's electric-field flame tests studied how fields change a flame's shape and soot, not how to put fires out. ${mist}`);
  return out;
}

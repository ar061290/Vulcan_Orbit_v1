// #/predict "Predict it": what will it do? Block order follows site/REBUILD_PLAN.md §3.6 with keep 1 (site.js): the smoke
// map and the what-if runs show first; everything else sits under "Show N more figures" (the tour and ?fig= open it).
// Every card renders even when its file is missing (an empty state, never a dropped card), except the robustness card,
// which is drawn when data/whatif.json has its "robustness" block (or as an empty state when the file is missing).
// Figures: js/fig_drift.js and js/fig_cabin3d.js (package P4-B), js/fig_spread.js, js/fig_models.js, js/fig_gaps.js.
import { h, load, loadPath, page, card, empty, isMissing, fmt, pct, params as urlParams } from '../lib.js';
import { driftCard, whatifCard, calibrationCard, robustCard, lbmWhatifCard, lbmAgreement } from '../fig_drift.js';
import { cabin3dCard } from '../fig_cabin3d.js';
import { spreadCard, growthCard, m6bCard, m6bSpreadChartCard } from '../fig_spread.js';
import { modelCard, m6Card } from '../fig_models.js';
import { gapCard, nextExperimentCard, moonMarsCard } from '../fig_gaps.js';

const LEAD = 'Small models fitted to NASA\'s own tables, each compared with the textbook formula and tested on sessions it never saw. Every prediction carries a range.';
const MODELS_SCHEMA = '{ "status":"model", "models":[{\n   "id":"…", "name":"…", "question":"…", "status":"real|model",\n   "data":"…", "method":"…", "validation":"…", "metric":"…", "score":…, "score_range":[lo, hi],\n   "baseline_name":"…", "baseline_score":…, "unit":"…", "points":[{ "obs":…, "pred":…, "lo":…, "hi":…, "label":"…" }],\n   "drivers":[{ "name":"…", "share":… }], "limits":"…" }] }';

function lbmSub(lbm, dw) {
  const agree = lbmAgreement(dw);
  return `Independent lattice Boltzmann air model, ${fmt(lbm.lx_m, 2)} × ${fmt(lbm.ly_m, 2)} m module cross-section with racks, airflow ${fmt(lbm.flow_m_s, 3)} m/s, no buoyancy. ` +
    (agree ? `It agrees with the model above on alarm vs no alarm for ${agree} of fire-detector pairs.`
      : 'Its agreement with the model above is not available yet (data/drift_whatif.json missing or without its X-agree check).');
}

function modelCards(m, m6res) {
  if (isMissing(m) || !Array.isArray(m.models) || !m.models.length)
    return [card('Models trained on NASA tables', 'missing', 'Spread, extinction and cool-flame models appear here as they are trained.',
      empty('Waiting for model results', 'models', 'One entry per model. Predictions come from test sessions the model never saw.', MODELS_SCHEMA))];
  return m.models.map(mod => (mod && mod.id === 'm6' ? m6Card(mod, m6res) : modelCard(mod)));
}

export default async function render(root, ctx = {}) {
  const names = ['models', 'drift', 'gaps', 'whatif', 'drift_calibration', 'drift_lbm', 'drift_whatif', 'spread_predictor', 'growth_examples'];
  const [[m, drift, gaps, wi, cal, lbm, lwi, sp, gr], m6bRes, m6Res] = await Promise.all([
    Promise.all(names.map(load)), loadPath('models/m6b-predictor/results.json'), loadPath('models/m6-spread/results.json')]);
  const q = ctx.params || (ctx.detached ? {} : urlParams());
  const showRobust = isMissing(wi) || Array.isArray(wi.robustness);
  const lbmTitle = 'Second opinion: a cabin with racks';
  root.append(page('What will it do?', LEAD,
    h('div', { class: 'grid g2' }, driftCard(drift, {}, ctx), whatifCard(wi)),
    cabin3dCard(drift, ctx),
    h('div', { class: 'grid g2' }, calibrationCard(cal), showRobust ? robustCard(wi) : null),
    h('div', { class: 'grid g2' },
      driftCard(lbm, { title: lbmTitle, sub: isMissing(lbm) ? null : lbmSub(lbm, lwi), file: 'drift_lbm' }, ctx),
      lbmWhatifCard(lwi, isMissing(lbm) ? undefined : lbm.lx_m, isMissing(lbm) ? undefined : lbm.ly_m)),
    spreadCard(sp, { case: q.fuel, o2: q.o2, flow: q.flow, ctx }),
    growthCard(gr),
    m6bCard(sp, m6bRes),
    m6bSpreadChartCard(sp, { case: q.fuel, o2: q.o2 }),
    h('div', { class: 'grid g2 pr-models' }, modelCards(m, m6Res)),
    gapCard(gaps),
    nextExperimentCard(gaps),
    moonMarsCard()));
}

/** "The short answer" (main's summaries.js predict lines). A sentence whose file is missing says so (D1.4). */
export async function short() {
  const w = await load('whatif');
  const c = !isMissing(w) && Array.isArray(w.layouts) ? w.layouts[0] : null;
  const out = ['With nothing to make it rise, smoke goes where the fans push it, not to the ceiling.'];
  if (c && Number.isFinite(c.caught_120_at_10mg)) out.push(`In ${Number.isFinite(w.runs) ? fmt(w.runs, 0) : 'our'} simulated cabin fires with small, slow smoke sources (an assumption, not a measurement), a ceiling detector set to the station's alarm level reached it within 2 minutes in only ${pct(c.caught_120_at_10mg, 1)} of runs.`);
  else out.push('The share of simulated fires a ceiling detector catches is not available yet (data/whatif.json missing).');
  // alarm levels: whatif.json alarm_mg_m3 (1, NASA ICES-2024-365) and alarm_hi_mg_m3 (10, the station level, NTRS 20170002629)
  if (c && Number.isFinite(c.caught_120)) out.push(`A far more sensitive alarm level${Number.isFinite(w.alarm_mg_m3) ? ` (${fmt(w.alarm_mg_m3, 2)} mg/m³)` : ''} would catch about ${pct(c.caught_120)}. In this model, sensitivity mattered more than placement. It is a 2D model, not a test of the station's detectors.`);
  else out.push('The share caught at a more sensitive alarm level is not available yet (data/whatif.json missing).');
  return out;
}

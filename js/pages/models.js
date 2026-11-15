// Model cards (#/models): one section per model, after Mitchell et al. (2019). site/REBUILD_PLAN.md §3.10, package P5-C.
// The sections and their numbers live in js/fig_modelcards.js; this module only loads the files and lays them out.
// Every file is optional: a missing file shows its own "No data yet" state inside the section that needs it, and a
// missing data/trust.json no longer crashes the page (main read tr.rows unguarded).
// The registry row sets provenance:false: each card body already says how it was made, so no second "Made by" block.
import { h, load, loadPath, page, isMissing } from '../lib.js';
import { MODEL_SECTIONS, modelSection } from '../fig_modelcards.js';

const LEAD = 'One card per model: what it is for, what it is not for, how it was tested, and how well it did, misses included.';
// main's footer, verbatim (js/pages/models.js @ f1a9df7)
const FOOT = 'Format after Mitchell et al., "Model Cards for Model Reporting" (2019). Trust ratings are a self-assessment after NASA-STD-7009A, not a NASA review.';

const RESULTS = {
  m3: 'models/m3-drift/results.json', m4: 'models/m4-latency/results.json', m5: 'models/m5-smoke-miss/results.json',
  m6: 'models/m6-spread/results.json', m6b: 'models/m6b-predictor/results.json', m7: 'models/m7-extinction/results.json',
  fs: 'models/flame-sim/results.json',
};
const FILES = {
  models: 'models', trust: 'trust', perm: 'permutation', sp: 'spread_predictor', whatif: 'whatif', dcal: 'drift_calibration',
  dw: 'drift_whatif', lat: 'saffire_latency', ror: 'rate_of_rise', cv: 'cv_latest', fspread: 'flame_spread',
};

/** Everything the ten sections read, keyed as fig_modelcards.js expects: D.<key> for data/*.json, D.res.<key> for results.json. */
export async function loadModelData() {
  const fk = Object.keys(FILES), rk = Object.keys(RESULTS);
  const [files, res] = await Promise.all([
    Promise.all(fk.map(k => load(FILES[k]))),
    Promise.all(rk.map(k => loadPath(RESULTS[k]))),
  ]);
  const D = { res: {} };
  fk.forEach((k, i) => { D[k] = files[i]; });
  rk.forEach((k, i) => { D.res[k] = res[i]; });
  return D;
}

export default async function render(root, ctx) {
  const D = await loadModelData();
  root.append(page('Model cards', LEAD,
    ...MODEL_SECTIONS.map(spec => modelSection(spec, D)),
    h('p', { class: 'mc-foot' }, h('small', {}, FOOT))));
}

// "The short answer": how many models met the pass rule they wrote down before testing, read from data/trust.json.
export async function short() {
  const tr = await load('trust');
  const rows = !isMissing(tr) && Array.isArray(tr.rows) ? tr.rows : null;
  if (!rows || !rows.length) return [
    `This page has ${MODEL_SECTIONS.length} model cards; each says what the model is for, what it is not for, and how it was tested.`,
    'The pass-rule summary is not available yet (data/trust.json missing).',
  ];
  const met = rows.filter(r => r.passed === true), missed = rows.filter(r => r.passed === false);
  const names = list => list.map(r => r.name.replace(/\s*\(M\d+b?\)$/, '').replace(/\?$/, '')).join('; ');
  return [
    `Each card says what the model is for, what it is not for, how it was tested, and its score with a range beside a baseline.`,
    `${met.length} of the ${rows.length} rated models and tests met the pass rule written before testing${met.length ? `: ${names(met)}` : ''}.`,
    missed.length ? `${missed.length} missed and stay on the page: ${names(missed)}.` : 'None missed.',
  ];
}

// Model cards (after Mitchell et al. 2019): one plain card per model. Scores, ranges and pass results come from
// data/trust.json and data/models.json; "use for / not for" is the team's statement of scope.
import { h, load, page, card } from '../lib.js';
import { MADE, CRED, FACTORS } from '../provenance.js';
const SCOPE = {
  'm7-extinction': ['Comparing which oxygen, pressure and added-gas conditions make a single methanol or heptane droplet flame go out early in microgravity.', 'Other fuels, sprays or pools, Moon or Mars gravity, or deciding that any cabin air is safe.', 'Droplet flame goes out'],
  'm7-burning-rate': ['Estimating how fast a single droplet burns (K, mm²/s) under FLEX-like conditions.', 'Large fires, other fuels, or anything outside the FLEX test range.', 'Droplet burning rate'],
  'm7-cool-flame': ['Flagging conditions where a droplet may keep burning as an invisible cool flame.', 'Proving a fire is out. It does not beat a pressure-only rule by much.', 'Burns on invisibly after the flame goes out'],
  'smoke-miss': ['Showing which materials make smoke too fine for light-scattering detectors, as a discussion aid.', 'Any decision: it rests on 16 tests and its range reaches chance.', 'Will the detector miss this smoke?'],
  m6: ['Showing how far the textbook spread formula is from NASA\'s slab data.', 'Predicting spread rates: it missed its target.', 'Flame spread over PMMA slabs (BASS-II)'],
  m6b: ['Estimating flame spread over acrylic or cotton-fiberglass fabric in microgravity at 1 atm, inside the marked NASA range.', 'Values outside the marked range, other materials, other pressures, Moon or Mars, or calling a material safe.', 'Will it spread, and how fast?'],
  drift: ['Showing how smoke moves with ventilation when nothing rises, and comparing detector positions.', 'Exact alarm times in a real module: it fails on an event it was not tuned on.', 'Where the smoke goes'],
  rate: ['Testing one alarm idea on real flight data.', 'Judging rate-of-rise detectors in general: one detector, three events.', 'Would a "fast rise" alarm be quicker?'],
};
const CK = { 'm7-extinction': 'ext', 'm7-burning-rate': 'rate', 'm7-cool-flame': 'cool', 'smoke-miss': 'miss', m6: 'm6', m6b: 'm6b', drift: 'drift', rate: 'latency' };
const f = v => v == null ? '—' : typeof v === 'number' ? (Math.abs(v) < 1 ? v.toFixed(3) : String(v)) : Array.isArray(v) ? `${f(v[0])} to ${f(v[1])}` : String(v);
export default async function (root) {
  const [tr, mo] = await Promise.all([load('trust'), load('models')]);
  const lim = Object.fromEntries((mo.models || []).map(m => [m.id, m.limits]));
  root.append(page('Model cards', 'One card per model: what it is for, what it is not for, how it was tested, and how well it did, misses included.',
    ...tr.rows.map(r => { const [use, not, made] = SCOPE[r.id] || ['', '', r.name], m = MADE[made] || {}, c = CRED[CK[r.id]];
      const row = (k, v) => v ? [h('dt', {}, k), h('dd', {}, v)] : [];
      return h('div', { style: 'margin-top:14px' }, card(r.name, tr.status, m.kind || r.kind,
        h('dl', { class: 'made mc' }, ...row('Use it for', use), ...row('Not for', not), ...row('Method', m.how), ...row('Inputs', m.inputs), ...row('NASA data', m.check),
          ...row('Tested on', r.tested), ...row('Score', `${r.metric || ''}: ${f(r.score)} (range ${f(r.range)})`), ...row('Baseline', r.baseline ? `${r.baseline}${r.baseline_score != null ? ': ' + f(r.baseline_score) : ''}` : null),
          ...row('Could it be luck?', r.perm_p != null ? `p = ${r.perm_p} (${r.perm_n} label shuffles)` : null), ...row('Own pass rule', `${r.passed ? 'Met' : 'Missed'}: ${r.rule}`),
          ...row('Limits', lim[r.id]), ...row('Trust (0-4)', c ? FACTORS.map(([k, n]) => `${n} ${c[k]}`).join(' · ') + `. ${c.why}` : null), ...row('Files', m.files))));
    }),
    h('p', {}, h('small', {}, 'Format after Mitchell et al., "Model Cards for Model Reporting" (2019). Trust ratings are a self-assessment after NASA-STD-7009A, not a NASA review.'))));
}

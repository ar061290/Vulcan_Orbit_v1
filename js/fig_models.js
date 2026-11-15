// Model cards on Predict it, one per data/models.json entry (site/REBUILD_PLAN.md §2.12, §3.6 rows 12-16).
// Ported from main's js/pages/predict.js. Changes: the stamp is the entry's own status (main used the file's status),
// point ranges are drawn as error bars, every chart has keyboard access and a table, a classifier's actual outcome is
// told by shape as well as colour, M5 states its pass-rule misses, and M6 leads with its findings (spec C9).
import { h, card, empty, isMissing, sig, stat, setParams, slug } from './lib.js';
import { C, scatter } from './charts.js';
import { revealFigure, figLink } from './passes.js';

const isF = Number.isFinite;
const rngText = r => (Array.isArray(r) && r.length === 2 ? `${sig(r[0], 2)} to ${sig(r[1], 2)}` : null);
const strip = html => String(html ?? '').replace(/<br\s*\/?>/gi, ' · ').replace(/<[^>]+>/g, '');
const M6B_TITLE = 'M6b spread predictor: score and calibration box';

/** A link to another figure on this page that opens its fold and scrolls to it (falls back to a normal hash link). */
function figAnchor(pageId, title, text) {
  return h('a', { href: figLink(pageId, title), onclick: e => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button > 0) return;
    const here = (location.hash.replace(/^#\//, '').split('?')[0]) === pageId;
    if (!here) return;
    if (revealFigure(slug(title))) { e.preventDefault(); setParams({ fig: slug(title) }); }
  } }, text);
}

function statsRow(mod) {
  return h('div', { class: 'grid g3 mc-stats' },
    stat(`${mod.metric} on unseen sessions`, sig(mod.score, 3), rngText(mod.score_range)),
    stat(mod.baseline_name || 'Baseline', mod.baseline_score == null ? '—' : sig(mod.baseline_score, 3), mod.baseline_metric_note || null),
    stat('Test points', String(Array.isArray(mod.points) ? mod.points.length : 0)));
}

/** Pass-rule ids marked FAIL in the entry's checks_note (M5 is the one entry that carries them). */
const failsOf = mod => [...String(mod.checks_note || '').matchAll(/([A-Za-z0-9_.-]+)\s+FAIL\b/g)].map(m => m[1]);

function chartFor(mod) {
  const P = (Array.isArray(mod.points) ? mod.points : []).filter(p => isF(p.pred));
  if (!P.length) return null;
  const bars = P.some(p => isF(p.lo) && isF(p.hi));
  const rangeTxt = p => (isF(p.lo) && isF(p.hi) ? ` (${sig(p.lo, 2)} to ${sig(p.hi, 2)})` : '');
  if (mod.kind === 'classifier') {
    // main's classifier scatter: predicted miss chance against air velocity, the actual outcome by colour and shape
    const yes = 'Actually too fine', no = 'Actually large enough';
    return scatter({ title: `${mod.name}: predicted chance against air velocity`, xLabel: 'Air velocity past the sample, cm/s', yLabel: 'Predicted chance the detector misses it',
      yDom: [-0.05, 1.05], errorBars: bars,   // yDom: main's
      points: P.map(p => ({ x: p.x, y: p.pred, lo: p.lo, hi: p.hi, group: p.obs ? yes : no, color: p.obs ? C.s2 : C.s3, shape: p.obs ? 'circle' : 'square',
        label: `<b>${p.label}</b><br>model: ${Math.round(p.pred * 100)}% chance of a miss${rangeTxt(p)}<br>actual: ${p.obs ? 'mostly too fine (missed)' : 'large enough (seen)'}` })),
      columns: [['Test', p => strip(p.label).split(' · ')[0]], ['Air velocity (cm/s)', p => p.x], ['Predicted chance of a miss', p => p.y], ['Actual', p => p.group]] });
  }
  if (/\bAUC\b/.test(mod.metric || '') && P.every(p => p.obs === 0 || p.obs === 1)) {
    // a yes/no outcome: predicted chance for each burn, grouped by what NASA recorded. The sideways spread inside each
    // group is only so the dots do not sit on top of each other; the table lists the real values.
    const jit = k => ((k * 0.6180339887) % 1 - 0.5) * 0.5;
    return scatter({ title: `${mod.name}: predicted chance by what NASA recorded`, xLabel: 'What NASA recorded (0 = no, 1 = yes; dots spread sideways)', yLabel: `Predicted ${mod.unit || 'chance'}`,
      xDom: [-0.45, 1.45], yDom: [-0.05, 1.05], errorBars: bars,
      points: P.map((p, k) => ({ x: p.obs + jit(k), y: p.pred, lo: p.lo, hi: p.hi, group: p.obs ? 'Recorded: yes (1)' : 'Recorded: no (0)',
        label: `<b>${p.label || ''}</b><br>Recorded ${p.obs}<br>Predicted ${sig(p.pred, 2)}${rangeTxt(p)}` })),
      columns: [['Burn', p => strip(p.label).split(' · ')[0]], ['Recorded', p => (p.group.endsWith('(1)') ? 1 : 0)], ['Predicted', p => p.y], ['Low', p => p.lo ?? '—'], ['High', p => p.hi ?? '—']] });
  }
  return scatter({ title: `${mod.name}: observed against predicted`, diagonal: true, errorBars: bars, xLabel: `Observed, ${mod.unit}`, yLabel: `Predicted, ${mod.unit}`,
    points: P.filter(p => isF(p.obs)).map(p => ({ x: p.obs, y: p.pred, lo: p.lo, hi: p.hi, color: C.s1, label: `<b>${p.label || ''}</b><br>Observed ${sig(p.obs, 3)}<br>Predicted ${sig(p.pred, 3)}${rangeTxt(p)}` })),
    columns: [['Point', p => strip(p.label).split(' · ')[0]], [`Observed (${mod.unit})`, p => p.x], [`Predicted (${mod.unit})`, p => p.y], ['Low', p => p.lo ?? '—'], ['High', p => p.hi ?? '—']] });
}

function kv(mod) {
  const rows = [['Data', mod.data], ['Method', mod.method], ['Tested by', mod.validation],
    ['What drove it', (mod.drivers || []).map(d => `${d.name} ${Math.round(d.share * 100)}%`).join(', ')],
    ['Checks', mod.checks_note || ''], ['Limits', mod.limits]].filter(r => r[1]);
  return h('dl', { class: 'kv mc-kv' }, rows.flatMap(([k, v]) => [h('dt', {}, k), h('dd', {}, v)]));
}

/** One models.json entry. The stamp is entry.status. */
export function modelCard(mod) {
  if (!mod || typeof mod !== 'object') return card('Model', 'missing', null, empty('No data yet', 'models', 'This models.json entry is empty.', null));
  const fails = failsOf(mod);
  const passLine = fails.length ? h('p', { class: 'mc-fail' }, h('span', { class: 'lvl demo' }, 'Missed its pass rule'), ' ',
    `${fails.join(' and ')} failed. The rules were written before training; the result is shown as it came out.`) : null;
  return card(mod.name, mod.status || 'missing', mod.question, statsRow(mod), passLine, chartFor(mod), kv(mod));
}

/** M6 (BASS-II) leads with its findings, keeps the R² visible and points to M6b (spec C9).
 *  Findings: models/m6-spread/results.json → de_ris.median_obs_over_pred, no_spread_cases, rules; wording from its REPORT.md. */
export function m6Card(mod, m6res) {
  if (!mod) return card('Flame spread over PMMA slabs (BASS-II)', 'missing', null, empty('No data yet', 'models', 'models.json has no m6 entry.', null));
  const haveRes = !isMissing(m6res) && m6res.de_ris;
  const fac = haveRes && isF(m6res.de_ris.median_obs_over_pred) && m6res.de_ris.median_obs_over_pred > 0 ? 1 / m6res.de_ris.median_obs_over_pred : null;
  const ns = haveRes ? m6res.no_spread_cases : null;
  const drv = (mod.drivers || []).filter(d => d.share > 0).sort((a, b) => b.share - a.share);
  const p1 = haveRes ? Object.entries(m6res.rules || {}).find(([k]) => /^P1_r2_ge_/.test(k)) : null;
  const target = p1 ? p1[0].replace(/^P1_r2_ge_/, '') : null;
  const findings = h('ul', { class: 'mc-findings' },
    h('li', {}, fac != null ? `The textbook de Ris formula over-predicts the spread rate over these PMMA slabs about ${sig(fac, 2)}-fold.`
      : 'The de Ris over-prediction factor is not available yet (models/m6-spread/results.json missing).'),
    h('li', {}, ns && isF(ns.real) ? `NASA recorded flames that did not spread: ${ns.real} tests in NASA's PSI-25 table${isF(ns.reported) ? ` and ${ns.reported} more cases in the BASS-II report (reported)` : ''}, listed as observed with no boundary drawn.`
      : 'The count of NASA no-spread cases is not available yet (models/m6-spread/results.json missing).'),
    drv.length ? h('li', {}, `What changed its error most: ${drv.map(d => `${d.name.toLowerCase()} (${Math.round(d.share * 100)}%)`).join(' and ')}.`) : null,
    h('li', {}, `It does not yet support a correction that carries over to a new ISS session: R² on held-out sessions ${sig(mod.score, 2)} [${rngText(mod.score_range) || 'n/a'}], against ${sig(mod.baseline_score, 3)} for ${mod.baseline_name || 'the baseline'} alone`,
      target ? `; the target written before training was ${target}, ${p1[1].pass ? 'met' : 'missed'}.` : '.'));
  return card(mod.name, mod.status || 'missing', mod.question,
    h('h3', { class: 'mc-h' }, 'What it found'), findings,
    h('p', { class: 'mc-next' }, 'The fix: ', figAnchor('predict', M6B_TITLE, 'M6b calibrates de Ris with one factor per regime →')),
    statsRow(mod), chartFor(mod), kv(mod));
}

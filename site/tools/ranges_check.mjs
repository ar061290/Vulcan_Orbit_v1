#!/usr/bin/env node
// Phase 7 coverage check P7-E: "Ranges on everything" (plan v2 feature 13; spec C10 row 13; REBUILD_PLAN §3.15).
// Lists every prediction the site shows without a low and high value. Two passes:
//   A. Data: a registry of every model prediction a figure draws (file, field, which figure shows it). For each, count
//      the values and how many carry a range in the file (lo/hi, *_range, *_range_95, bootstrap_95). A miss here is
//      owned by the script that writes the file (outside the site: models/, engine/), and is listed, not fixed.
//   B. Rendered: every figure whose "Made by" kind says it is model output (trained model, physics formula, model run)
//      must show at least one range in its text (a [lo–hi] pair, "lo"/"hi" columns, "range", "±", or a lo–hi band
//      legend). A miss here is owned by the figure module (found from the title literal, as made_check.mjs does).
// Pass B and the "is it shown" column need a crawl: --from <made_check JSON> reuses made_check's run (no browser),
// otherwise this script runs the same crawl itself (one headless Chromium; same flags as made_check.mjs).
//
// Usage: node site/tools/ranges_check.mjs [--from crawl.json | --base URL] [--out ranges.json] [--write]
//   --write  replace the <!-- ranges_check:… --> section of site/PLAN_COVERAGE.md
// Exit code 1 if a rendered model figure hides a range its data has, or a registry file is unreadable; data-side misses
// are listed (they are gaps in model outputs the site may not edit) and do not fail the run unless --strict is given.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, argv, crawl, ownerOf, replaceSection } from './made_check.mjs';

const COVERAGE = path.join(ROOT, 'site/PLAN_COVERAGE.md');
const read = rel => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')); } catch { return null; } };
const num = v => typeof v === 'number' && Number.isFinite(v);
const pair = v => Array.isArray(v) && v.length >= 2 && v.every(num);   // [lo, hi] or [lo, mid, hi]

// Each entry: what is predicted, where it is drawn, who writes the file, and a function counting {n, ranged, eg}.
// shown: [[route, figure title], ...]; a value is "shown" when one of those figures rendered in the crawl.
function registry() {
  const R = [];
  const models = read('data/models.json');
  const FOLDER = { 'm7-extinction': 'models/m7-extinction', 'm7-burning-rate': 'models/m7-extinction', 'm7-cool-flame': 'models/m7-extinction', 'smoke-miss': 'models/m5-smoke-miss', m6: 'models/m6-spread' };
  const CARD = { 'm7-extinction': 'M7 Droplet flame goes out', 'm7-burning-rate': 'M7 Droplet burning rate', 'm7-cool-flame': 'M7 Cool flame', 'smoke-miss': 'M5 Smoke miss', m6: 'M6 Flame spread over PMMA slabs' };
  for (const e of models?.models || []) {
    const shown = [['predict', e.name], ['models', CARD[e.id] || e.name]];
    const by = `${FOLDER[e.id] || 'models/?'}/build.py → data/models.json`;
    R.push({ id: `models.${e.id}.score`, what: `${e.name}: held-out ${e.metric}`, file: 'data/models.json', field: `models[id=${e.id}].score → score_range`, shown, by,
      count: () => ({ n: num(e.score) ? 1 : 0, ranged: pair(e.score_range) ? 1 : 0, eg: `${e.score} ${JSON.stringify(e.score_range)}` }) });
    R.push({ id: `models.${e.id}.points`, what: `${e.name}: each held-out prediction`, file: 'data/models.json', field: `models[id=${e.id}].points[].pred → lo, hi`, shown, by,
      count: () => { const p = (e.points || []).filter(x => num(x.pred)); const bad = p.filter(x => !(num(x.lo) && num(x.hi))); return { n: p.length, ranged: p.length - bad.length, eg: bad[0]?.label || '' }; } });
    if (num(e.baseline_score)) R.push({ id: `models.${e.id}.baseline`, what: `${e.name}: baseline (${e.baseline_name})`, file: 'data/models.json', field: `models[id=${e.id}].baseline_score`, shown, by, comparison: true,
      count: () => ({ n: 1, ranged: pair(e.baseline_range) || pair(e.baseline_score_range) ? 1 : 0, eg: String(e.baseline_score) }) });
  }
  const m7 = read('data/m7_explorer.json');
  const M7 = 'models/m7-extinction/build.py → data/m7_explorer.json';
  R.push({ id: 'm7.ext.o2_half', what: 'O₂ at 50% extinction chance, per fuel, pressure and added gas', file: 'data/m7_explorer.json', field: 'extinction.table[].o2_half → o2_half_range', shown: [['respond', 'When does a droplet flame go out?'], ['respond', 'NASA: which gas puts a droplet flame out'], ['respond', 'Response evidence for this fire']], by: M7,
    count: () => { const t = (m7?.extinction?.table || []).filter(r => num(r.o2_half)); const bad = t.filter(r => !pair(r.o2_half_range)); return { n: t.length, ranged: t.length - bad.length, eg: bad[0] ? `${bad[0].fuel} ${bad[0].p_atm} atm ${bad[0].added_gas}` : '' }; } });
  for (const k of ['extinction', 'cool_flame']) R.push({ id: `m7.${k}.auc`, what: `M7 ${k.replace('_', ' ')}: headline AUC`, file: 'data/m7_explorer.json', field: `${k}.headline.auc_median → auc_session_bootstrap_95`, shown: [['respond', k === 'extinction' ? 'When does a droplet flame go out?' : 'Looks out, still burning: cool flames']], by: M7,
    count: () => { const hd = m7?.[k]?.headline || {}; return { n: num(hd.auc_median) ? 1 : 0, ranged: pair(hd.auc_session_bootstrap_95) ? 1 : 0, eg: String(hd.auc_median) }; } });
  R.push({ id: 'm7.cool.p_half', what: 'Pressure at 50% cool-flame chance (the 3.22 atm marker)', file: 'data/m7_explorer.json', field: 'cool_flame.pressure_at_half_atm', shown: [['respond', 'Looks out, still burning: cool flames']], by: M7,
    count: () => { const c = m7?.cool_flame || {}; return { n: num(c.pressure_at_half_atm) ? 1 : 0, ranged: pair(c.pressure_at_half_range) || pair(c.pressure_at_half_atm_range) ? 1 : 0, eg: String(c.pressure_at_half_atm) }; } });

  const sp = read('data/spread_predictor.json');
  R.push({ id: 'sp.grid', what: 'M6b spread rate on the O₂ × airflow grid', file: 'data/spread_predictor.json', field: 'cases[].rate_mm_s[i][j] → lo[i][j], hi[i][j]', shown: [['predict', 'Will it spread, and how fast?'], ['predict', 'Spread rate against airflow: M6b vs de Ris']], by: 'models/m6b-predictor/build.py → data/spread_predictor.json',
    count: () => { let n = 0, ok = 0, eg = ''; for (const c of sp?.cases || []) (c.rate_mm_s || []).forEach((row, i) => row.forEach((x, j) => { if (!num(x)) return; n++; if (num(c.lo?.[i]?.[j]) && num(c.hi?.[i]?.[j])) ok++; else eg ||= `${c.id} [${i}][${j}]`; })); return { n, ranged: ok, eg }; } });
  const res6b = read('models/m6b-predictor/results.json');
  R.push({ id: 'm6b.mae', what: 'M6b held-out MAE, raw de Ris and one-constant baseline', file: 'models/m6b-predictor/results.json', field: 'opposed.mae_mm_s.{kept,B1_raw_de_ris,B2_one_constant} → mae_range_95', shown: [['predict', 'M6b spread predictor: score and calibration box'], ['evidence', 'Checks'], ['models', 'M6b Spread predictor and growth']], by: 'models/m6b-predictor/build.py',
    count: () => { const m = res6b?.opposed?.mae_mm_s || {}, r = res6b?.opposed?.mae_range_95 || {}; const ks = Object.keys(m).filter(k => num(m[k])); const bad = ks.filter(k => !pair(r[k])); return { n: ks.length, ranged: ks.length - bad.length, eg: bad.join(', ') }; } });
  R.push({ id: 'm6b.independent', what: 'M6b predictions for the independent Saffire-II and film points', file: 'models/m6b-predictor/results.json', field: 'independent.saffire2[].pred_mm_s, independent.film.pred_mm_s → lo, hi', shown: [['predict', 'M6b spread predictor: score and calibration box']], by: 'models/m6b-predictor/build.py',
    count: () => { const ind = res6b?.independent || {}; const p = [...(ind.saffire2 || []), ...(ind.film ? [ind.film] : [])].filter(x => num(x.pred_mm_s)); const bad = p.filter(x => !(num(x.lo) && num(x.hi))); return { n: p.length, ranged: p.length - bad.length, eg: bad[0]?.sample || '' }; } });
  const ge = read('data/growth_examples.json');
  R.push({ id: 'growth.summary', what: 'Growth examples: max area, time to max, end time (and Assess, which runs the same code)', file: 'data/growth_examples.json', field: 'examples[].summary.{lo,mid,hi}', shown: [['predict', 'How big does it get, and when does it stop?'], ['assess', 'Burning area over time']], by: 'models/m6b-predictor/growth.py → data/growth_examples.json; js/growth.js on Assess',
    count: () => { const ex = ge?.examples || []; const bad = ex.filter(e => !['lo', 'mid', 'hi'].every(k => num(e.summary?.[k]?.max_area_cm2))); return { n: ex.length, ranged: ex.length - bad.length, eg: bad[0]?.id || '' }; } });
  const r6 = read('models/m6-spread/results.json');
  R.push({ id: 'm6.overpredict', what: 'M6 finding "de Ris over-predicts about N-fold" (1 / median observed ÷ predicted)', file: 'models/m6-spread/results.json', field: 'de_ris.median_obs_over_pred', shown: [['predict', 'Flame spread over PMMA slabs (BASS-II)'], ['models', 'M6 Flame spread over PMMA slabs']], by: 'models/m6-spread/build.py',
    count: () => ({ n: num(r6?.de_ris?.median_obs_over_pred) ? 1 : 0, ranged: pair(r6?.de_ris?.median_obs_over_pred_range) ? 1 : 0, eg: String(r6?.de_ris?.median_obs_over_pred) }) });

  const wi = read('data/whatif.json');
  for (const k of ['caught_60', 'caught_120', 'caught_300']) R.push({ id: `whatif.${k}`, what: `Cabin what-if: share of fires caught ${k.replace('caught_', 'within ')} s`, file: 'data/whatif.json', field: `layouts[].${k} → ${k}_range`, shown: [['predict', 'What if the fire starts somewhere else?'], ['assess', 'Risk: the parts and the rule that fired']], by: 'engine/drift.py → data/whatif.json',
    count: () => { const L = (wi?.layouts || []).filter(l => num(l[k])); const bad = L.filter(l => !pair(l[`${k}_range`])); return { n: L.length, ranged: L.length - bad.length, eg: bad[0]?.name || '' }; } });
  R.push({ id: 'whatif.median_s', what: 'Cabin what-if: median alarm time per layout', file: 'data/whatif.json', field: 'layouts[].median_s', shown: [['predict', 'What if the fire starts somewhere else?']], by: 'engine/drift.py → data/whatif.json',
    count: () => { const L = (wi?.layouts || []).filter(l => num(l.median_s)); return { n: L.length, ranged: L.filter(l => pair(l.median_s_range)).length, eg: L[0]?.name || '' }; } });
  const dw = read('data/drift_whatif.json');
  for (const k of ['caught_60', 'caught_180']) R.push({ id: `drift_whatif.${k}`, what: `Racks cabin (LBM) what-if: share caught ${k.replace('caught_', 'within ')} s`, file: 'data/drift_whatif.json', field: `layouts[].${k} → ${k}_range`, shown: [['predict', 'What if the fire starts somewhere else? (cabin with racks)'], ['assess', 'Risk: the parts and the rule that fired']], by: 'models/m3-drift/build.py → data/drift_whatif.json',
    count: () => { const L = (dw?.layouts || []).filter(l => num(l[k])); const bad = L.filter(l => !pair(l[`${k}_range`])); return { n: L.length, ranged: L.length - bad.length, eg: bad[0]?.name || '' }; } });
  R.push({ id: 'drift_whatif.by_rate', what: 'Racks cabin (LBM) what-if: share caught by smoke release rate', file: 'data/drift_whatif.json', field: 'by_rate[].best_caught_180, hero_caught_180', shown: [['predict', 'What if the fire starts somewhere else? (cabin with racks)']], by: 'models/m3-drift/build.py → data/drift_whatif.json',
    count: () => { const L = dw?.by_rate || []; return { n: L.length, ranged: L.filter(b => pair(b.best_caught_180_range)).length, eg: L[0] ? `${L[0].rate_mg_s} mg/s` : '' }; } });
  for (const [f, title, by] of [['drift', 'Where the smoke goes', 'engine/drift.py → data/drift.json'], ['drift_lbm', 'Second opinion: a cabin with racks', 'models/m3-drift/build.py → data/drift_lbm.json']]) {
    const d = read(`data/${f}.json`);
    R.push({ id: `${f}.alarm_s`, what: `${title}: model alarm time at each detector`, file: `data/${f}.json`, field: 'detectors[].alarm_s', shown: [['predict', title], ...(f === 'drift' ? [['predict', 'Walk around the smoke (3D)']] : [])], by,
      count: () => { const D = (d?.detectors || []).filter(x => num(x.alarm_s)); return { n: D.length, ranged: D.filter(x => pair(x.alarm_s_range) || (num(x.lo) && num(x.hi))).length, eg: D[0]?.name || '' }; } });
  }
  const fs_ = read('data/flame_static.json'), fp = read('data/flame_spread.json');
  const FS = 'models/flame-sim/build.py';
  R.push({ id: 'flame.K', what: 'Flame sim: model droplet burning rate K beside each FLEX burn', file: 'data/flame_static.json', field: 'flex_comparison[].K_model_mm2_s', shown: [['flame', 'Droplet burning rate vs NASA FLEX']], by: FS,
    count: () => { const r = (fs_?.flex_comparison || []).filter(x => num(x.K_model_mm2_s)); return { n: r.length, ranged: r.filter(x => num(x.K_model_lo) && num(x.K_model_hi)).length, eg: r[0]?.id || '' }; } });
  R.push({ id: 'flame.stats', what: 'Flame sim: flame temperature, shape, tilt and rise speed per case', file: 'data/flame_static.json', field: 'flames[].{T_flame_K, aspect, tilt_deg_from_vertical, U_buoy_m_s}', shown: [['flame', 'Flame simulator']], by: FS,
    count: () => { const r = (fs_?.flames || []).filter(x => num(x.T_flame_K)); return { n: r.length, ranged: r.filter(x => pair(x.T_flame_K_range)).length, eg: r[0] ? `${r[0].fuel} ${r[0].gravity}` : '' }; } });
  R.push({ id: 'flame.rates', what: 'Flame sim: spread rate curves against airflow', file: 'data/flame_spread.json', field: 'rates[].rate_mm_s[]', shown: [['flame', 'How fast flame crosses a solid']], by: FS,
    count: () => { const r = fp?.rates || []; return { n: r.length, ranged: r.filter(x => Array.isArray(x.lo) && Array.isArray(x.hi)).length, eg: r[0] ? `${r[0].fuel} ${r[0].gravity}` : '' }; } });
  R.push({ id: 'flame.bass', what: 'Flame sim: model spread rate beside each BASS-II point', file: 'data/flame_spread.json', field: 'bass_ii_comparison[].model_mm_s', shown: [['flame', 'How fast flame crosses a solid']], by: FS,
    count: () => { const r = (fp?.bass_ii_comparison || []).filter(x => num(x.model_mm_s)); return { n: r.length, ranged: r.filter(x => num(x.model_lo_mm_s) && num(x.model_hi_mm_s)).length, eg: r[0]?.test || '' }; } });
  R.push({ id: 'flame.min_O2', what: 'Flame sim: lowest O₂ that burns on each survival map', file: 'data/flame_spread.json', field: 'flammability_maps[].min_O2', shown: [['flame', 'Where a flame can survive']], by: FS,
    count: () => { const r = (fp?.flammability_maps || []).filter(x => num(x.min_O2)); return { n: r.length, ranged: r.filter(x => pair(x.min_O2_range)).length, eg: r[0] ? `${r[0].fuel} ${r[0].gravity} ${r[0].P_kPa} kPa` : '' }; } });
  R.push({ id: 'flame.fronts', what: 'Flame sim: spread rate of each growing-fire case', file: 'data/flame_spread.json', field: 'fronts[].spread_mm_s', shown: [['flame', 'A fire growing across a sample']], by: FS,
    count: () => { const r = (fp?.fronts || []).filter(x => num(x.spread_mm_s)); return { n: r.length, ranged: r.filter(x => pair(x.spread_mm_s_range)).length, eg: r[0]?.case || '' }; } });
  const ss = read('data/smoke_sizes.json');
  R.push({ id: 'smoke.mass_below', what: 'Share of smoke mass finer than the detector limit (our lognormal calculation)', file: 'data/smoke_sizes.json', field: 'materials[].mass_below[thr].{unaged,aged}', shown: [['detect', 'Smoke the detector misses']], by: 'models/m5-smoke-miss/build.py → data/smoke_sizes.json',
    count: () => { const m = ss?.materials || []; let n = 0, ok = 0; m.forEach(x => Object.values(x.mass_below || {}).forEach(v => { if (num(v?.unaged)) { n++; if (pair(v.unaged_range)) ok++; } })); return { n, ranged: ok, eg: m[0]?.name || m[0]?.material || '' }; } });
  const tr = read('data/trust.json');
  R.push({ id: 'trust.score', what: '"Can you trust this?" score per model', file: 'data/trust.json', field: 'rows[].score → range', shown: [['evidence', 'Can you trust this?']], by: 'scripts/build_trust.py → data/trust.json',
    count: () => { const r = (tr?.rows || []).filter(x => num(x.score)); const bad = r.filter(x => !pair(x.range)); return { n: r.length, ranged: r.length - bad.length, eg: bad.map(x => x.name).join('; ') }; } });
  const dc = read('data/drift_calibration.json');
  R.push({ id: 'drift_cal.pulse', what: 'Smoke model peak time for the held-out puff', file: 'data/drift_calibration.json', field: 'pulse.model_peak_s_range', shown: [['predict', 'Checked against a real spacecraft fire']], by: 'engine/calibrate.py → data/drift_calibration.json',
    count: () => ({ n: dc?.pulse ? 1 : 0, ranged: pair(dc?.pulse?.model_peak_s_range) ? 1 : 0, eg: '' }) });
  return R;
}

// Rendered pass: a model figure must show a range somewhere in its text or tables.
const MODEL_KIND = /trained model|physics (model|formula)|model run|many runs|model output|calculation|simulation|predictor|calibration|forward in time|independent physics/i;
const NOT_MODEL = /^(NASA data, no model|Published NASA measurements, no model|Checks|NASA catalogue|Camera reading|Team rules|Limits of this run|Your inputs)/i;
// Model figures that show no number to put a range on. Each reason is printed in the report, so a reader can disagree.
const EXEMPT = {
  'Will it spread here?': 'a categorical verdict (spreads / near observed extinction / observed no-spread) with its matched NASA cases and the calibration-box table; the rates and areas with their ranges are on "Burning area over time"',
};
// Input spans such as "0-50 cm/s" or "1-5 mm" are not output ranges, so a bare a–b pair does not count.
const RANGE = /\[\s*-?[\d.]+%?\s*[–,-]\s*-?[\d.]+%?\s*\]|\(\s*-?[\d.]+%?\s*[–-]\s*-?[\d.]+%?\s*\)|\d%\s*[–-]\s*\d[\d.]*%|\d[\d.]*%?\s+to\s+\d[\d.]*%[^.\n]{0,40}\b(across|range|interval|bootstrap)|\(range [^)]*\d|\branges? (of|from|is|was)?\s*-?[\d.]+|±\s*\d|\blo\b[^\n]{0,80}\bhi\b|\blow\b[^\n]{0,40}\bhigh\b|\bslow, middle and fast\b|\bslow run\b[\s\S]{0,200}\bfast run\b|\bslow-to-fast\b|\b95% (range|interval|bootstrap)|\b(lo|low)[–-](hi|high) band\b|\bband\b[^\n.]{0,40}\b(lo|low|slow)\b/i;

function renderedPass(crawlData, data) {
  // A figure whose data has no range (data pass) is owned by the data file's producer, not by the figure module.
  const dataMiss = new Map();
  for (const d of data) if (d.missing > 0 && !d.comparison) for (const [rt, t] of d.shown) dataMiss.set(`${rt}|${t}`, d);
  const out = [];
  for (const r of crawlData.routes) for (const c of r.cards) {
    if (c.nested || !c.made || NOT_MODEL.test(c.made) || !MODEL_KIND.test(c.made)) continue;
    if (EXEMPT[c.title]) { out.push({ route: r.route, title: c.title, kind: c.made.split(' · ')[0], ok: true, exempt: EXEMPT[c.title], sample: '', owner: null }); continue; }
    // the "Made by" block describes the method (it often says "ranges: …"); only the figure's own text counts
    let body = c.text; if (c.madeText) body = body.replace(c.madeText, '');
    const txt = body + '\n' + c.tables.map(t => t.head.join(' ')).join('\n');
    const m = txt.match(RANGE), dm = dataMiss.get(`${r.route}|${c.title}`);
    out.push({ route: r.route, title: c.title, kind: c.made.split(' · ')[0], ok: !!m, sample: m ? m[0] : '', siteOwned: !m && !dm,
      owner: m ? null : dm ? `${dm.by} (the file has no range: ${dm.field})` : ownerOf(c.title, r.route) });
  }
  return out;
}

export function rangesCheck(crawlData) {
  const shownTitles = new Map();
  for (const r of crawlData?.routes || []) for (const c of r.cards) shownTitles.set(`${r.route}|${c.title}`, true);
  const data = registry().map(item => {
    let c;
    try { c = item.count(); } catch (e) { c = { n: 0, ranged: 0, eg: `error: ${e.message}` }; }
    const shownOn = item.shown.filter(([rt, t]) => shownTitles.has(`${rt}|${t}`)).map(([rt, t]) => `#/${rt} "${t}"`);
    const readable = !!read(item.file);
    return { ...item, count: undefined, ...c, missing: c.n - c.ranged, readable, shownOn, crawled: !!crawlData };
  });
  const rendered = crawlData ? renderedPass(crawlData, data) : [];
  const issues = [];
  for (const d of data) {
    if (!d.readable) { issues.push(`Ranges: ${d.file} could not be read (owner: ${d.by})`); continue; }
    if (d.missing > 0 && (d.shownOn.length || !d.crawled) && !d.comparison)
      issues.push(`Ranges: ${d.what}: ${d.missing} of ${d.n} shown without lo/hi (${d.field}; owner: ${d.by}${d.shownOn.length ? `; shown on ${d.shownOn.join(', ')}` : ''})`);
  }
  for (const r of rendered.filter(x => !x.ok)) issues.push(`Ranges: model figure "${r.title}" on #/${r.route} shows no range in its text or tables (owner: ${r.owner})`);
  return { data, rendered, issues, renderedFails: rendered.filter(x => !x.ok).length, siteFails: rendered.filter(x => x.siteOwned).length };
}

const esc = s => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
function markdown(res, at) {
  const L = [`Generated by \`node site/tools/ranges_check.mjs --write\` on ${at}. Data pass: ${res.data.length} predictions in the registry; rendered pass: ${res.rendered.length} model figures.`, ''];
  const miss = res.data.filter(d => d.missing > 0 && !d.comparison);
  L.push(`### Predictions shown without lo/hi: ${miss.length} of ${res.data.filter(d => !d.comparison).length}`, '');
  L.push('| Prediction | File and field | Values | Without lo/hi | Shown on | Owner of the fix |', '|---|---|---|---|---|---|');
  for (const d of res.data.filter(x => !x.comparison).sort((a, b) => (b.missing > 0) - (a.missing > 0))) {
    L.push(`| ${esc(d.what)} | \`${esc(d.file)}\` ${esc(d.field)} | ${d.n} | ${d.missing > 0 ? `**${d.missing}**${d.eg ? ` (e.g. ${esc(d.eg)})` : ''}` : '0'} | ${esc(d.shownOn.join('; ')) || (d.crawled ? 'not rendered in this crawl' : 'not crawled')} | ${d.missing > 0 ? esc(d.by) : '-'} |`);
  }
  const cmp = res.data.filter(d => d.comparison);
  if (cmp.length) L.push('', `Baselines shown beside a score with no range of their own (a comparison, not a prediction; information only): ${cmp.map(d => `${esc(d.what)} ${d.missing ? '(no range)' : '(ranged)'}`).join('; ')}.`);
  L.push('', `### Rendered model figures with no visible range: ${res.renderedFails} of ${res.rendered.length}`, '',
    'A text heuristic, so read it by hand: a figure counts as showing a range when its own text (not its "Made by" block) has a [lo–hi] pair, "range of N", ±N, lo and hi columns, a lo–hi band or the slow, middle and fast runs (lo, mid, hi).', '');
  L.push('| Page | Figure | Made-by kind | Range seen |', '|---|---|---|---|');
  for (const r of res.rendered) L.push(`| #/${r.route} | ${esc(r.title)} | ${esc(r.kind)} | ${r.exempt ? `exempt: ${esc(r.exempt)}` : r.ok ? `yes: "${esc(r.sample.slice(0, 40))}"` : `**no** (owner: ${esc(r.owner)})`} |`);
  L.push('', `Of the ${res.renderedFails} figures with no visible range, ${res.siteFails} are owned by a site module (the data has a range the figure does not show) and ${res.renderedFails - res.siteFails} by the script that writes the file (the file has no range to show; the site may not edit model outputs).`);
  L.push('', `### Issues: ${res.issues.length}`, '');
  res.issues.forEach(i => L.push(`- ${esc(i)}`));
  if (!res.issues.length) L.push('None.');
  return L.join('\n');
}

async function main() {
  const from = argv('--from');
  let crawlData = null;
  if (from) crawlData = JSON.parse(fs.readFileSync(from, 'utf8')).crawl;
  else if (!argv('--no-crawl')) crawlData = await crawl({ base: argv('--base') || null });
  const res = rangesCheck(crawlData);
  const at = crawlData?.at || new Date().toISOString();
  fs.writeFileSync(argv('--out') || path.join(os.tmpdir(), 'vo_ranges_check.json'), JSON.stringify(res, null, 1));
  const md = markdown(res, at);
  if (argv('--write')) {
    let cur = ''; try { cur = fs.readFileSync(COVERAGE, 'utf8'); } catch { /* new */ }
    fs.writeFileSync(COVERAGE, replaceSection(cur, 'ranges_check', md));
  }
  process.stdout.write(md + '\n');
  const unreadable = res.data.some(d => !d.readable);
  // fail on what the site can fix (a figure hiding a range its data has) or an unreadable file; --strict also fails on
  // the data-side gaps, which belong to models/, engine/ and scripts/
  process.exitCode = res.siteFails || unreadable || (argv('--strict') && res.issues.length) ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) main().catch(e => { console.error(e); process.exit(2); });

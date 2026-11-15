// Model cards (after Mitchell et al. 2019): one section per model, REBUILD_PLAN §3.10 and §2.12.
// Every number is read at run time from data/*.json or models/*/results.json (passed in as `data`), never typed here.
// The "Use it for / Not for" lines are main's SCOPE text (js/pages/models.js @ f1a9df7), verbatim except where main typed
// a count ("16 tests", "three events", "1 atm"): those are now read from the files (REBUILD_PLAN §0 rule 2).
// Short quoted sentences from a model's README or REPORT carry no numbers; each names its source file.
import { h, card, empty, fmt, pct, isMissing, table, fold, stat } from './lib.js';
import { MADE, CRED, FACTORS, registerMade } from './provenance.js';
import { SCRAPPED, CV_PENDING } from './overlays.js';
import { figLink } from './passes.js';

// ---------- formatting (values shown as the file gives them, or to 3 significant figures for long floats) ----------
const isNum = v => typeof v === 'number' && Number.isFinite(v);
/** A value exactly as written in the file (models.json, trust.json and permutation.json are already rounded). */
const raw = v => (isNum(v) ? String(v) : v == null ? 'n/a' : String(v));
/** Long floats from models/*\/results.json: 3 significant figures, trailing zeros kept (0.0200, not 0.02). */
const p3 = v => (!isNum(v) ? 'n/a' : Number.isInteger(v) ? fmt(v, 0) : v.toPrecision(3));
const br = (r, f = raw) => (Array.isArray(r) && r.length === 2
  ? `[${f(r[0])}${r.some(v => isNum(v) && v < 0) ? ' to ' : '–'}${f(r[1])}]` : '');
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const word = n => (Number.isInteger(n) && n >= 0 && n < WORDS.length ? WORDS[n] : fmt(n, 0));
const get = (o, path) => path.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);
const ok = d => d && !isMissing(d);

// ---------- main's SCOPE text (team statement of scope), verbatim; counts typed on main are now file reads ----------
const SCOPE = {
  'm7-extinction': () => ['Comparing which oxygen, pressure and added-gas conditions make a single methanol or heptane droplet flame go out early in microgravity.', 'Other fuels, sprays or pools, Moon or Mars gravity, or deciding that any cabin air is safe.'],
  'm7-burning-rate': () => ['Estimating how fast a single droplet burns (K, mm²/s) under FLEX-like conditions.', 'Large fires, other fuels, or anything outside the FLEX test range.'],
  'm7-cool-flame': () => ['Flagging conditions where a droplet may keep burning as an invisible cool flame.', 'Proving a fire is out. It does not beat a pressure-only rule by much.'],
  // main: "it rests on 16 tests" → the number of test points in models.json smoke-miss
  'smoke-miss': D => { const n = entry(D, 'smoke-miss')?.points?.length; return ['Showing which materials make smoke too fine for light-scattering detectors, as a discussion aid.', `Any decision: it rests on ${isNum(n) ? n + ' tests' : 'a few tests'} and its range reaches chance.`]; },
  m6: () => ['Showing how far the textbook spread formula is from NASA\'s slab data.', 'Predicting spread rates: it missed its target.'],
  // main: "at 1 atm" → spread_predictor.json pressure_atm
  m6b: D => { const p = D.sp?.pressure_atm; return [`Estimating flame spread over acrylic or cotton-fiberglass fabric in microgravity${isNum(p) ? ` at ${p} atm` : ''}, inside the marked NASA range.`, 'Values outside the marked range, other materials, other pressures, Moon or Mars, or calling a material safe.']; },
  drift: () => ['Showing how smoke moves with ventilation when nothing rises, and comparing detector positions.', 'Exact alarm times in a real module: it fails on an event it was not tuned on.'],
  // main: "three events" → distinct events in rate_of_rise.json
  rate: D => { const n = Array.isArray(D.ror?.events) ? new Set(D.ror.events.map(e => e.event)).size : null; return ['Testing one alarm idea on real flight data.', `Judging rate-of-rise detectors in general: one detector, ${n ? word(n) + ' events' : 'a few events'}.`]; },
};

// ---------- lookups ----------
const entry = (D, id) => (ok(D.models) ? (D.models.models || []).find(m => m.id === id) : null) || null;
const trow = (D, id) => (ok(D.trust) ? (D.trust.rows || []).find(r => r.id === id) : null) || null;
const prow = (D, id) => (ok(D.perm) ? (D.perm.rows || []).find(r => r.id === id) : null) || null;

// ---------- building blocks ----------
const dl = rows => {
  const kids = rows.filter(r => r && r[1] != null && r[1] !== '' && r[1] !== false).flatMap(([k, v]) => [h('dt', {}, k), h('dd', {}, v)]);
  return kids.length ? h('dl', { class: 'made mc' }, kids) : null;
};
const scope = pair => (pair ? h('div', { class: 'mc-scope' },
  h('div', { class: 'mc-use' }, h('span', { class: 'mc-k' }, 'Use it for'), h('p', {}, pair[0])),
  h('div', { class: 'mc-not' }, h('span', { class: 'mc-k' }, 'Not for'), h('p', {}, pair[1]))) : null);
const stats = (...boxes) => h('div', { class: 'mc-stats' }, boxes.filter(Boolean));
const part = (title, ...kids) => h('div', { class: 'mc-part' }, h('h3', {}, title), ...kids);
const quote = (text, src) => h('p', { class: 'mc-quote' }, h('q', {}, text), ' ', h('small', {}, `(${src})`));
const links = items => {
  const a = items.filter(Boolean).map(([href, text]) => h('li', {}, h('a', { href }, text)));
  return a.length ? h('div', { class: 'mc-links' }, h('span', { class: 'mc-k' }, 'See it on the site'), h('ul', {}, a)) : null;
};
/** A results.json file that is not there yet: say which file and which command writes it. */
const missingResults = (path, label) => h('div', { class: 'empty' }, h('h3', {}, `${label}: no data yet`),
  h('p', {}, 'Drop in ', h('code', {}, path), ' (written by ', h('code', {}, `python ${path.replace(/\/results\.json$/, '')}/build.py`), ') and this part fills itself.'));
const missingData = (file, label, why) => empty(`${label}: no data yet`, file, why || null, null);

// Drivers: one row per input, the share as text, plus a bar that is decoration only (the text carries the value).
function drivers(list) {
  if (!Array.isArray(list) || !list.length) return null;
  return h('ul', { class: 'mc-drivers', 'aria-label': 'Drivers: share of the effect on held-out predictions' },
    list.map(d => h('li', {},
      h('span', { class: 'mc-dn' }, d.name),
      h('span', { class: 'mc-bar', 'aria-hidden': 'true' }, h('span', { style: { width: `${Math.max(0, Math.min(1, Number(d.share) || 0)) * 100}%` } })),
      h('span', { class: 'mc-ds' }, pct(Number(d.share) || 0)))));
}

// Pass-rule results. state: pass | fail | pending (not run) | reported | scrapped | na
const PILL = { pass: 'Pass', fail: 'Fail', pending: 'Not run', reported: 'Reported', scrapped: 'Scrapped (see plan v2)', na: 'Not applicable' };
const pill = s => h('span', { class: `status ${['pass', 'fail', 'pending', 'scrapped'].includes(s) ? s : ''}`.trim() }, PILL[s] || s);
/** State of a {id, ok, result} check as the file gives it; D-dome reads "scrapped" only once SCRAPPED.approved (Q1). */
const stateOf = c => {
  if (SCRAPPED.approved && SCRAPPED.simChecks.includes(c.id)) return 'scrapped';
  if (c.ok === true) return 'pass';
  if (c.ok === false) return 'fail';
  return /^\s*not run/i.test(String(c.result ?? c.value ?? '')) ? 'pending' : 'reported';
};
const isDump = v => typeof v === 'string' && /^\s*[{[]/.test(v);
const fromChecks = list => (Array.isArray(list) ? list.map(c => ({
  id: c.id, state: stateOf(c),
  text: [c.what, c.value != null ? String(c.value) : null, isDump(c.result) ? 'the numbers are in the table above' : c.result,
    c.limit ? `limit ${c.limit}` : null].filter(Boolean).join(': '),
})) : []);
function checkList(rows, { title = 'Pass-rule results', source, max = 12 } = {}) {
  if (!rows.length) return null;
  const n = s => rows.filter(r => r.state === s).length;
  const count = ['pass', 'fail', 'pending', 'reported', 'scrapped', 'na'].filter(s => n(s)).map(s => `${n(s)} ${PILL[s].toLowerCase()}`).join(' · ');
  const li = r => h('li', { 'data-state': r.state }, pill(r.state), ' ', h('b', {}, r.id), r.text ? ' ' : null, r.text || null);
  const head = [h('h3', {}, title), h('p', { class: 'mc-count' }, count, source ? h('small', {}, ` · from ${source}`) : null)];
  if (rows.length <= max) return h('div', { class: 'mc-checks' }, head, h('ul', {}, rows.map(li)));
  const notPass = rows.filter(r => r.state !== 'pass');
  return h('div', { class: 'mc-checks' }, head,
    notPass.length ? h('ul', {}, notPass.map(li)) : null,
    fold(`All ${rows.length} checks`, h('ul', {}, rows.map(li))));
}

// Trust strip: the team's self-assessment after NASA-STD-7009A (same layout and classes as the "Made by" strip).
function trust(key) {
  const c = CRED[key];
  if (!c) return h('div', { class: 'cred' }, h('p', { class: 'cred-cap' }, 'How much to trust it'), h('p', { class: 'cred-why' }, 'Not rated by the team.'));
  const cap = h('p', { class: 'cred-cap' }, 'How much to trust it (0-4 per factor, after NASA-STD-7009A; self-assessed by the team)',
    c.draft ? [' ', h('strong', { class: 'cred-draft' }, 'Draft: ratings still to be confirmed by the team.')] : null);
  return h('div', { class: 'cred' }, cap,
    h('ul', {}, FACTORS.map(([k, name, q]) => {
      const v = c[k];
      return h('li', { title: q, 'aria-label': v == null ? `${name}: not rated. ${q}` : `${name}: ${v} of 4. ${q}` },
        h('span', {}, name),
        v == null ? h('b', { class: 'cred-none' }, 'not rated') : h('b', { 'aria-hidden': 'true' }, `${'●'.repeat(v)}${'○'.repeat(4 - v)}`));
    })),
    h('p', { class: 'cred-why' }, c.why));
}

// "Could it be luck?" from trust.json (perm_p, perm_n) and permutation.json (null distribution, split).
function luck(D, id) {
  const t = trow(D, id), p = prow(D, id);
  const pv = t?.perm_p ?? p?.p, n = t?.perm_n ?? p?.n_perm;
  if (pv == null) return null;
  const s = [`p = ${raw(pv)} over ${fmt(n, 0)} label shuffles`];
  if (p) s.push(`; shuffled labels scored ${raw(p.null_mean)} on average and ${raw(p.null_95)} at the 95th percentile. The test used ${p.split}, where the real AUC was ${raw(p.real_auc)}: that is not the headline score above.`);
  return s.join('');
}
// The stat box for the model's own pass rule (trust.json), with a fallback when trust.json is missing.
function ruleBox(D, id, fallback) {
  const t = trow(D, id);
  if (t) return stat('Own pass rule', t.passed ? 'Met' : 'Missed', t.rule);
  if (fallback) return stat('Own pass rule', fallback[0], fallback[1]);
  return stat('Own pass rule', 'n/a', 'data/trust.json is missing');
}
const trustRuleRow = (D, id) => { const t = trow(D, id); return t ? { id: 'Rule', state: t.passed ? 'pass' : 'fail', text: t.rule } : null; };

// ---------- M7 shared (three models.json entries + models/m7-extinction/results.json) ----------
function m7Common(D, id, part) {
  const e = entry(D, id), r = ok(D.res.m7) ? D.res.m7[part] : null;
  return { e, r };
}

// ====================================================================================================================
// The ten sections. Each build(D) returns {status, sub, body}. A missing file shows its own empty state, never a crash.
// ====================================================================================================================
export const MODEL_SECTIONS = [
  {
    id: 'm3', title: 'M3 Smoke drift', models: ['models/m3-drift'],
    files: 'data/drift.json, data/whatif.json, data/drift_calibration.json ← engine/ (grid model); data/drift_lbm.json, data/drift_whatif.json, models/m3-drift/results.json ← models/m3-drift/build.py (lattice Boltzmann)',
    build(D) {
      const { whatif: w, dcal, dw } = D, r = D.res.m3;
      const status = ok(dw) ? dw.status : ok(w) ? w.status : 'missing';
      const t = trow(D, 'drift');
      // the grid model (engine/), tuned on one Saffire-III burn
      const grid = (!ok(dcal) && !ok(w)) ? missingData('drift_calibration', 'Grid model') : part('Grid model (engine/, tuned on one Saffire-III burn)',
        ok(dcal) ? stats(
          stat('Held-out smoke puff, R²', p3(dcal.best?.pulse_r2), 'timing and shape at the flight detector'),
          stat('Fit to the tuning burn, R²', p3(dcal.best?.burn_r2), 'the burn it was tuned on'),
          ruleBox(D, 'drift')) : missingData('drift_calibration', 'Calibration'),
        dl([
          ['Data', ok(dcal) ? dcal.data : null],
          ['Method', MADE['Where the smoke goes']?.how],
          ['How it was tested', ok(dcal) ? `Tuned on the ${dcal.tuned_on}; held out: the ${dcal.held_out}. ${fmt(dcal.settings_kept, 0)} of ${fmt(dcal.settings_tried, 0)} settings tried were kept.` : t?.tested],
          ['What-if runs', MADE['What if the fire starts somewhere else?']?.how],
          ['Baseline', 'None in the files.'],
          ['Drivers', 'Not computed.'],
          ['Range note', ok(w) ? w.note : null],
          ['Limits', ok(dcal) && Array.isArray(dcal.limits) ? dcal.limits.join(' ') : null],
        ]),
        ok(w) && Array.isArray(w.layouts) && w.layouts.length ? table(['Detector layout (grid model)', 'Caught within 60 s', 'Within 2 min [resampling; across settings]', 'Within 5 min'],
          w.layouts.map(L => [L.name, isNum(L.caught_60) ? pct(L.caught_60) : 'n/a',
            `${isNum(L.caught_120) ? pct(L.caught_120) : 'n/a'} ${br(L.caught_120_range, pct)}${L.caught_120_model_range ? `; ${br(L.caught_120_model_range, pct)}` : ''}`,
            isNum(L.caught_300) ? pct(L.caught_300) : 'n/a']),
          { caption: `What-if share: ${fmt(w.runs, 0)} simulated fires, alarm at ${raw(w.alarm_mg_m3)} mg/m³ (data/whatif.json → layouts)` }) : null,
        ok(w) ? checkList(fromChecks(w.checks), { source: 'data/whatif.json' }) : missingData('whatif', 'Grid-model checks'),
        trust('drift'));
      // the lattice Boltzmann cabin (models/m3-drift)
      const L = ok(dw) ? dw.layouts || [] : [], best = L[0], worst = L.find(l => /worst/i.test(l.name));
      const x = ok(r) ? r.cross_check_engine : null;
      const lbm = !ok(dw) ? missingData('drift_whatif', 'Lattice Boltzmann what-if runs') : part('Second opinion: lattice Boltzmann cabin with racks (models/m3-drift)',
        stats(
          best ? stat(`${best.name}: caught within 60 s`, pct(best.caught_60), `${br(best.caught_60_range, pct)} bootstrap; ${br(best.caught_60_model_range, pct)} across settings`) : null,
          best ? stat(`${best.name}: caught within 180 s`, pct(best.caught_180), `${br(best.caught_180_range, pct)} bootstrap; ${br(best.caught_180_model_range, pct)} across settings`) : null,
          worst ? stat(`${worst.name} (for comparison): within 180 s`, pct(worst.caught_180), br(worst.caught_180_range, pct)) : null),
        dl([
          ['Method', MADE['Second opinion: a cabin with racks']?.how],
          ['What-if runs', `${fmt(dw.runs, 0)} runs at g = ${raw(dw.gravity_m_s2)}: ${dw.varied?.fire_position || ''}; airflow ${(dw.varied?.flow_m_s || []).join(', ')} m/s; smoke release ${dw.varied?.release_mg_s || ''} mg/s. Alarm at ${raw(dw.alarm_mg_m3)} mg/m³ with a ${raw(dw.detector_delay_s)} s detector delay, ${raw(dw.t_end_s)} s per run.`],
          ['Cross-check', x ? `Against the grid model: alarm vs no alarm agree on ${pct(x.agree)} of ${fmt(x.pairs, 0)} fire-detector pairs; median alarm-time ratio ${p3(x.median_ratio)}.` : (ok(r) ? null : 'models/m3-drift/results.json is missing.')],
          ['Range note', dw.note],
          ['Drivers', 'Not computed.'],
        ]),
        quote('2D screening model with an effective viscosity. It is not validated fluid dynamics of a real module and does not predict real spacecraft fires.', 'models/m3-drift/README.md'),
        ok(r) ? checkList(fromChecks(r.checks), { source: 'models/m3-drift/results.json' }) : missingResults('models/m3-drift/results.json', 'Lattice Boltzmann checks'),
        trust(null));
      return {
        status, sub: 'With no buoyancy, where does smoke go, and how often would a detector catch it in time?',
        body: [scope(SCOPE.drift(D)), grid, lbm,
          links([[figLink('predict', 'Where the smoke goes'), 'Where the smoke goes'], [figLink('predict', 'What if the fire starts somewhere else?'), 'What if the fire starts somewhere else?'],
            [figLink('predict', 'Second opinion: a cabin with racks'), 'Second opinion: a cabin with racks']])],
      };
    },
  },
  {
    id: 'm4', title: 'M4 Alarm timing', models: ['models/m4-latency'],
    files: 'data/saffire_latency.json, data/rate_of_rise.json, data/latency_sensitivity.json, models/m4-latency/results.json ← models/m4-latency/build.py',
    build(D) {
      const { lat, ror } = D, r = D.res.m4;
      if (!ok(lat)) return { status: 'missing', sub: 'For each real orbital event in Saffire-III, when would each sensor type have alarmed?', body: [missingData('saffire_latency', 'Alarm times')] };
      const KEYS = ['radiometer', 'scatter', 'obscuration'];
      const name = k => lat.burns?.[0]?.channels?.find(c => c.key === k)?.name || k;
      const cell = c => {
        if (!c || c.alarm_s == null) return 'no alarm';
        const lo = Array.isArray(c.alarm_s_range) ? c.alarm_s_range[0] : null;
        return `${raw(c.alarm_s)} s${isNum(lo) && lo !== c.alarm_s ? ` (${raw(lo)} s at 3 SD)` : ''}`;
      };
      const rows = (lat.burns || []).map(b => [b.name, ...KEYS.map(k => cell(b.channels?.find(c => c.key === k)))]);
      const e3 = ok(r) ? (r.checks || []).find(c => c.id === 'E3') : null;
      const rateRows = ok(ror) ? [{ id: 'Rate of rise', state: ror.result?.passed ? 'pass' : 'fail', text: ror.result?.text }] : [];
      const tr = trustRuleRow(D, 'rate'); if (tr) rateRows.push({ ...tr, id: 'Rule' });
      return {
        status: lat.status,
        sub: 'For each real orbital event in Saffire-III, when would each sensor type have alarmed?',
        body: [
          stats(
            ...(lat.burns || []).filter(b => b.channels?.find(c => c.key === 'radiometer')?.alarm_s != null).slice(0, 2)
              .map(b => stat(b.name, cell(b.channels.find(c => c.key === 'radiometer')), name('radiometer'))),
            stat('Score against a published alarm time', 'none', e3 ? e3.result : 'models/m4-latency/results.json is missing')),
          table(['Event', ...KEYS.map(name)], rows, { caption: `Alarm time, ${lat.units?.time || 's'}. Where a 3 SD margin alarms earlier than the 5 SD rule, that time is in brackets. Every event is reported on its own.` }),
          dl([
            ['Data', lat.source],
            ['Method', lat.threshold_rule],
            ['How it was tested', 'Each event on its own, no averages; negative and positive controls listed below.'],
            ['Baseline', 'None: no published Saffire-III alarm time was found to compare against.'],
            ['Drivers', 'Not applicable: no model is fitted.'],
            ['Resolution', lat.resolution_note],
            ['Observation', lat.observation],
            ['Assumption', lat.assumption],
          ]),
          ok(r) ? checkList(fromChecks(r.checks), { source: 'models/m4-latency/results.json' }) : missingResults('models/m4-latency/results.json', 'Alarm-timing checks'),
          trust('latency'),
          part('Extension: would a "fast rise" alarm be quicker?',
            scope(SCOPE.rate(D)),
            ok(ror) ? dl([['Rule', ror.rule], ['Result', ror.result?.text]]) : missingData('rate_of_rise', 'Rate-of-rise test'),
            rateRows.length ? checkList(rateRows, { title: 'Its own pass rule', source: 'data/rate_of_rise.json, data/trust.json' }) : null),
          links([[figLink('detect', 'Replay an orbital fire'), 'Replay an orbital fire'], [figLink('detect', 'Blind Spot: who alarms first?'), 'Blind Spot: who alarms first?'],
            [figLink('detect', 'Would a "fast rise" alarm be quicker?'), 'Would a "fast rise" alarm be quicker?'], [figLink('detect', 'Does the alarm rule change the answer?'), 'Does the alarm rule change the answer?']]),
        ],
      };
    },
  },
  {
    id: 'm5', title: 'M5 Smoke miss', models: ['models/m5-smoke-miss'],
    files: 'data/models.json (id smoke-miss), data/smoke_sizes.json, data/permutation.json, models/m5-smoke-miss/results.json ← models/m5-smoke-miss/build.py',
    build(D) {
      const e = entry(D, 'smoke-miss'), r = D.res.m5;
      if (!e) return { status: 'missing', sub: 'Will the detector miss this smoke?', body: [missingData('models', 'Smoke-miss model')] };
      const t = trow(D, 'smoke-miss');
      const auc = ok(r) ? (r.checks || []).find(c => c.id === 'M5-auc') : null;
      const sens = ok(r) && r.sensitivity ? Object.entries(r.sensitivity) : [];
      return {
        status: e.status, sub: e.question,
        body: [
          scope(SCOPE['smoke-miss'](D)),
          (t && !t.passed) || auc?.ok === false ? h('p', { class: 'mc-verdict fail' }, h('b', {}, 'It failed its own pass rule. '),
            t ? `${t.rule}. ` : '', auc ? `Result: ${auc.result}.` : `Result: ${e.metric} ${raw(e.score)} ${br(e.score_range)}.`) : null,
          stats(
            stat(`${e.metric}, held out`, raw(e.score), br(e.score_range)),
            stat(`Baseline: ${e.baseline_name}`, e.baseline_score == null ? 'n/a' : raw(e.baseline_score), e.baseline_metric_note || null),
            ruleBox(D, 'smoke-miss')),
          dl([
            ['Data', e.data], ['Method', e.method], ['How it was tested', e.validation],
            ['Could it be luck?', luck(D, 'smoke-miss')],
            ['Coefficients', e.coefficients ? Object.entries(e.coefficients).map(([k, v]) => `${k} ${raw(v)}`).join('; ') : null],
            ['Limits', e.limits],
          ]),
          h('div', { class: 'mc-dr' }, h('h3', {}, 'Drivers'), drivers(e.drivers) || h('p', {}, 'Not computed.')),
          sens.length ? table(['Detector limit', 'Missed', 'Seen', 'AUC', 'Balanced accuracy', 'Material only', 'Note'],
            sens.map(([k, s]) => [k, raw(s.missed), raw(s.seen), raw(s.auc), raw(s.balanced_accuracy), raw(s.material_baseline), s.note || '']),
            { caption: 'The same model at other detector limits (models/m5-smoke-miss/results.json → sensitivity)' }) : null,
          ok(r) ? checkList(fromChecks(r.checks), { source: 'models/m5-smoke-miss/results.json' }) : missingResults('models/m5-smoke-miss/results.json', 'Smoke-miss checks'),
          trust('miss'),
          links([[figLink('detect', 'Smoke the detector misses'), 'Smoke the detector misses'], [figLink('predict', e.name), e.name]]),
        ],
      };
    },
  },
  {
    id: 'm6', title: 'M6 Flame spread over PMMA slabs', models: ['models/m6-spread'],
    files: 'data/models.json (id m6), models/m6-spread/results.json ← models/m6-spread/build.py; findings worded from models/m6-spread/REPORT.md',
    build(D) {
      const e = entry(D, 'm6'), r = D.res.m6;
      if (!e) return { status: 'missing', sub: 'How fast does flame spread over a solid at this airflow and oxygen level?', body: [missingData('models', 'M6 spread model')] };
      const dr = r?.de_ris, ns = r?.no_spread_cases, kept = r?.candidates?.session?.a_calibrated_deris;
      const fold3 = isNum(dr?.median_obs_over_pred) && dr.median_obs_over_pred > 0 ? 1 / dr.median_obs_over_pred : null;
      const top = (e.drivers || []).filter(d => d.share > 0), zero = (e.drivers || []).filter(d => !(d.share > 0));
      const find = ok(r) ? h('ol', { class: 'mc-find' },
        fold3 != null ? h('li', {}, `The textbook de Ris formula over-predicts these slabs about ${fmt(fold3, 1)}-fold: the median of observed over de Ris is ${raw(dr.median_obs_over_pred)}, over ${fmt(r.rows, 0)} spread rates from ${fmt(r.tests, 0)} tests in ${fmt(r.sessions?.length, 0)} ISS sessions.`) : null,
        ns ? h('li', {}, `NASA recorded flames that did not spread: ${fmt(ns.real, 0)} cases in NASA's own files and ${fmt(ns.reported, 0)} more reported in the BASS-II summary.`) : null,
        top.length ? h('li', {}, `Its errors are driven by ${top.map(d => `${d.name.toLowerCase()} (${pct(d.share)})`).join(' and ')}${zero.length ? `; ${zero.map(d => d.name.toLowerCase()).join(', ')} add nothing on held-out sessions` : ''}.`) : null,
        h('li', {}, 'It does not yet support a correction that carries over to a new ISS session. ', h('small', {}, '(models/m6-spread/REPORT.md)')),
        h('li', {}, 'The fix is M6b, which calibrates de Ris separately for thin and thick fuel: ', h('a', { href: figLink('models', 'M6b Spread predictor and growth') }, 'see the M6b card'), '.'))
        : missingResults('models/m6-spread/results.json', 'M6 findings');
      const cand = r?.candidates?.session;
      const p1 = r?.rules ? Object.entries(r.rules).find(([k]) => k.startsWith('P1')) : null;
      const NAMES = { a_calibrated_deris: 'de Ris × one constant (kept)', b_linear: 'Linear correction', c_gp: 'Gaussian process', d_gbt: 'Boosted trees' };
      const rules = r?.rules ? Object.entries(r.rules).map(([k, v]) => ({
        id: k.split('_')[0],
        state: v.pass === true ? 'pass' : v.pass === false ? 'fail' : (v.note && /not applicable/i.test(v.note)) ? 'na' : 'reported',
        text: k.startsWith('P1') ? `held-out R² at least ${k.split('_ge_')[1]}: ${raw(v.value)}`
          : k.startsWith('P2') ? `beats de Ris: MAE ${raw(v.mae?.[0])} vs ${raw(v.mae?.[1])} mm/s; R² ${raw(v.r2?.[0])} vs ${raw(v.r2?.[1])}`
          : k.startsWith('P4') ? `range reported ${br(v.range)}${v.weak_lower_bound ? '; the lower bound is flagged as weak' : ''}`
          : (v.note || k),
      })) : [];
      return {
        status: e.status, sub: e.question,
        body: [
          scope(SCOPE.m6(D)),
          part('What M6 found', find),
          stats(
            stat('R², sessions held out', raw(e.score), p1 ? `${br(e.score_range)}; target at least ${p1[0].split('_ge_')[1]}: ${p1[1].pass ? 'met' : 'missed'}` : br(e.score_range)),
            stat(`Baseline: ${e.baseline_name}, R²`, raw(e.baseline_score), dr ? `MAE ${raw(dr.mae_mm_s)} mm/s ${br(dr.mae_range)}` : null),
            kept ? stat('Mean error, sessions held out', `${raw(kept.mae)} mm/s`, br(kept.mae_range)) : null,
            ruleBox(D, 'm6')),
          dl([['Data', e.data], ['Method', e.method], ['How it was tested', e.validation], ['Honest caveat', trow(D, 'm6')?.caveat ? `${trow(D, 'm6').caveat} (${trow(D, 'm6').baseline}: R² ${raw(trow(D, 'm6').baseline_score)}; data/trivial_baselines.json)` : null], ['Limits', e.limits]]),
          h('div', { class: 'mc-dr' }, h('h3', {}, 'Drivers'), drivers(e.drivers) || h('p', {}, 'Not computed.')),
          cand ? table(['Correction tried', 'R² [range]', 'MAE, mm/s [range]'],
            [...Object.entries(cand).map(([k, c]) => [NAMES[k] || k, `${raw(c.r2)} ${br(c.r2_range)}`, `${raw(c.mae)} ${br(c.mae_range)}`]),
              dr ? ['de Ris alone (baseline)', `${raw(dr.r2)} ${br(dr.r2_range)}`, `${raw(dr.mae_mm_s)} ${br(dr.mae_range)}`] : null].filter(Boolean),
            { caption: 'Every correction tried, whole ISS sessions held out (models/m6-spread/results.json → candidates.session)' }) : null,
          rules.length ? checkList(rules, { source: 'models/m6-spread/results.json → rules' }) : null,
          trust('m6'),
          links([[figLink('predict', e.name), e.name]]),
        ],
      };
    },
  },
  {
    id: 'm6b', title: 'M6b Spread predictor and growth', models: ['models/m6b-predictor'],
    files: 'data/spread_predictor.json, data/growth_examples.json, models/m6b-predictor/results.json ← models/m6b-predictor/build.py (not in data/models.json, by design)',
    build(D) {
      const sp = D.sp, r = D.res.m6b;
      const sub = 'How fast does a flame spread over this solid, at this airflow, oxygen and pressure? Will it spread at all? Starting from what the camera sees now, how does the burning area develop?';
      if (!ok(sp) && !ok(r)) return { status: 'missing', sub, body: [missingData('spread_predictor', 'M6b spread predictor'), missingResults('models/m6b-predictor/results.json', 'M6b scores')] };
      const o = r?.opposed, c = r?.concurrent, ind = r?.independent;
      const mae = o?.mae_mm_s, rg = o?.mae_range_95;
      const nIn = isNum(o?.coverage_nested) && isNum(o?.rows) ? Math.round(o.coverage_nested * o.rows) : null;
      const ruleKey = (obj, pre) => Object.keys(obj || {}).find(k => k.startsWith(pre));
      const thr = (k, sep) => (k ? k.split(sep)[1] : null);
      const r1 = ruleKey(o, 'R1_'), r2 = ruleKey(o, 'R2_'), r3 = ruleKey(c, 'R3_');
      const G = { G1: 'hand calculation', G2: 'fuel edge', G3: 'no-spread cases', G4: 'non-negative area', G5: 'monotone in length' }; // names from models/m6b-predictor/RULES.md §6
      const rules = r?.rules ? Object.entries(r.rules).map(([k, v]) => ({
        id: k, state: v ? 'pass' : 'fail',
        text: k === 'R1' && r1 ? `opposed held-out MAE at most ${thr(r1, '_le_')} mm/s (M6's one-constant MAE): ${p3(o[r1]?.value)}`
          : k === 'R2' && r2 ? `opposed nested range coverage at least ${pct(Number(thr(r2, '_ge_')))}: ${pct(o[r2]?.value)}`
          : k === 'R3' && r3 ? `concurrent nested coverage at least ${pct(Number(thr(r3, '_ge_')))}: ${pct(c[r3]?.value)}`
          : k === 'R4a' ? 'both independent Saffire-II rates inside the shipped range'
          : k === 'R4b' ? 'the independent 100 µm film rate inside the shipped range'
          : G[k] ? `growth check: ${G[k]}` : '',
      })) : [];
      // source: "100 µm PMMA film (Bhattacharjee et al. 2016)", models/m6b-predictor/README.md data table and RULES.md R4b
      // (the film thickness is not a field of results.json; the film rate is a reported value, not NASA data we checked)
      const indRows = ind ? [
        ...(ind.saffire2 || []).map(s => [`Saffire-II ${s.sample}${s.scored ? '' : ' (sensitivity, not scored)'}`, `${raw(s.flow_cm_s)} cm/s`, s.obs_mm_s == null ? 'n/a' : raw(s.obs_mm_s), `${p3(s.pred_mm_s)} [${p3(s.lo)}–${p3(s.hi)}]`, s.inside ? 'inside' : 'outside']),
        ind.film ? ['100 µm PMMA film (reported, Bhattacharjee et al. 2016)', 'n/a', raw(ind.film.obs_mm_s), `${p3(ind.film.pred_mm_s)} [${p3(ind.film.lo)}–${p3(ind.film.hi)}]; raw de Ris ${p3(ind.film.raw_de_ris_mm_s)}`, ind.film.inside ? 'inside' : 'outside'] : null,
      ].filter(Boolean) : [];
      const dom = sp?.constants;
      const box = (label, d) => (d ? [label, d.tau_mm ? `${br(d.tau_mm)} mm` : 'n/a', `${br(d.flow_cm_s)} cm/s`, `${br(d.o2_vol_pct)} %`, `${br(d.pressure_atm)} atm`] : null);
      const boxes = dom ? [
        box('PMMA opposed, thin regime', dom.opposed?.domain?.thin), box('PMMA opposed, thick regime', dom.opposed?.domain?.thick),
        box('PMMA concurrent (bound)', dom.pmma_concurrent_bound?.domain), box('Fabric concurrent', dom.concurrent?.domain),
      ].filter(Boolean) : [];
      return {
        status: ok(sp) ? sp.status : 'model', sub,
        body: [
          scope(SCOPE.m6b(D)),
          o ? stats(
            stat('Opposed flow: mean error, sessions held out', `${p3(mae?.kept)} mm/s`, br(rg?.kept, p3)),
            stat('Baseline: raw de Ris', `${p3(mae?.B1_raw_de_ris)} mm/s`, br(rg?.B1_raw_de_ris, p3)),
            stat('Baseline: M6 one constant', `${p3(mae?.B2_one_constant)} mm/s`, br(rg?.B2_one_constant, p3)),
            stat('Ranges hold the real result', pct(o.coverage_nested), nIn != null ? `${nIn} of ${o.rows} held-out points (nested)` : null),
            rules.length ? stat('Own pass rules', `${rules.filter(x => x.state === 'pass').length} of ${rules.length} met`, 'models/m6b-predictor/RULES.md') : null)
            : missingResults('models/m6b-predictor/results.json', 'M6b scores'),
          dl([
            ['Data', ok(sp) ? (sp.sources || []).map(s => `${s.label}${s.doi ? ` (doi:${s.doi})` : s.url ? ` (${s.url})` : ''}`).join('; ') : null],
            ['Method', MADE['Will it spread, and how fast?']?.how],
            ['How it was tested', o ? `Opposed flow: leave one ISS session out (${fmt(o.sessions, 0)} sessions, ${fmt(o.rows, 0)} spread rates), with nested range coverage. Concurrent flow: leave one flight out (${fmt(c?.rows, 0)} flights). Independent checks on data the calibration never saw (table below).` : null],
            ['R², sessions held out', o?.r2 ? `kept ${p3(o.r2.kept)}; M6 one constant ${p3(o.r2.B2_one_constant)}; raw de Ris ${p3(o.r2.B1_raw_de_ris)}` : null],
            ['Concurrent flow', c ? `Mean error ${p3(c.mae_mm_s)} mm/s against ${p3(c.mae_baseline_mean_mm_s)} for the mean of the training flights; nested coverage ${pct(c.coverage_nested)}. The concurrent law barely beats a constant (models/m6b-predictor/README.md).` : null],
            ['Drivers', o ? `Not computed: there are no permutation drivers for M6b. The model has three fitted constants: thin factor ${p3(o.factors_all_rows?.thin)}, thick factor ${p3(o.factors_all_rows?.thick)}, concurrent K ${p3(c?.K)}.` : 'Not computed.'],
            ['Disclosure', mae ? `The one-factor-per-regime form was written into RULES.md before fitting. It was chosen after M6 had shown that thickness and sides drove its errors. The improvement over M6's model (${p3(mae.kept)} vs ${p3(mae.B2_one_constant)} mm/s) is therefore not a blind result (models/m6b-predictor/README.md, Decision 15).` : null],
            ['Verdict', ok(sp) ? sp.verdict_meaning : null],
            ['Honest caveat', trow(D, 'm6b')?.caveat ? `${trow(D, 'm6b').caveat} (${trow(D, 'm6b').baseline}: ${raw(trow(D, 'm6b').baseline_score)} mm/s; data/trivial_baselines.json)` : null],
            ['Limits', ok(sp) ? sp.limits : null],
          ]),
          indRows.length ? table(['Independent check', 'Airflow', 'Observed, mm/s', 'Predicted, mm/s [range]', 'Inside the range?'], indRows,
            { caption: 'Data the calibration never saw (models/m6b-predictor/results.json → independent). All are outside the calibration box.' }) : null,
          boxes.length ? table(['Calibration box (in domain)', 'Thickness', 'Airflow', 'Oxygen', 'Pressure'], boxes,
            { caption: 'Inside these ranges the predictor is calibrated; outside them every value is an extrapolation (data/spread_predictor.json → constants)' }) : null,
          rules.length ? checkList(rules, { source: 'models/m6b-predictor/results.json → rules' }) : null,
          trust('m6b'),
          links([[figLink('predict', 'M6b spread predictor: score and calibration box'), 'M6b spread predictor: score and calibration box'],
            [figLink('predict', 'Will it spread, and how fast?'), 'Will it spread, and how fast?'], ['#/assess', 'Run it on your own fire (Assess)']]),
        ],
      };
    },
  },
  {
    id: 'm7-extinction', title: 'M7 Droplet flame goes out', models: ['models/m7-extinction'],
    files: 'data/models.json (id m7-extinction), data/m7_explorer.json, data/permutation.json, models/m7-extinction/results.json ← models/m7-extinction/build.py',
    build(D) {
      const { e, r } = m7Common(D, 'm7-extinction', 'extinction');
      if (!e) return { status: 'missing', sub: 'Will a droplet flame go out?', body: [missingData('models', 'M7 extinction model')] };
      const sens = r ? [
        r.S1_drop_disruption ? `Disruption burns dropped (${fmt(r.S1_drop_disruption.rows, 0)} rows): ${p3(r.S1_drop_disruption.auc_median)} ${br(r.S1_drop_disruption.auc_session_bootstrap_95, p3)}` : null,
        r.S2_label_dext_gt0 ? `label = a visible extinction diameter (${fmt(r.S2_label_dext_gt0.rows, 0)} rows, ${fmt(r.S2_label_dext_gt0.positives, 0)} positives): ${p3(r.S2_label_dext_gt0.auc_median)} ${br(r.S2_label_dext_gt0.auc_session_bootstrap_95, p3)}` : null,
        r.atmosphere_held_out ? `whole atmospheres held out (${fmt(r.atmospheres, 0)}): ${p3(r.atmosphere_held_out.auc_median)} ${br(r.atmosphere_held_out.auc_session_bootstrap_95, p3)}` : null,
      ].filter(Boolean) : [];
      const rows = [trustRuleRow(D, 'm7-extinction'), r ? { id: 'Leakage', state: r.leakage_triggered ? 'fail' : 'pass', text: r.leakage_triggered ? 'leakage check triggered' : 'leakage check not triggered' } : null].filter(Boolean);
      return {
        status: e.status, sub: e.question,
        body: [
          scope(SCOPE['m7-extinction'](D)),
          stats(stat(`${e.metric}, sessions held out`, raw(e.score), br(e.score_range)),
            stat(`Baseline: ${e.baseline_name}`, raw(e.baseline_score), r ? `always-majority AUC ${p3(r.baseline_majority_auc)}` : null),
            ruleBox(D, 'm7-extinction', r ? [r.pass ? 'Met' : 'Missed', 'models/m7-extinction/RULES.md, R1'] : null)),
          dl([['Data', e.data], ['Method', e.method], ['How it was tested', e.validation],
            ['Could it be luck?', luck(D, 'm7-extinction')],
            ['Other splits', sens.length ? `AUC ${sens.join('; ')}.` : null],
            ['Limits', e.limits]]),
          h('div', { class: 'mc-dr' }, h('h3', {}, 'Drivers'), drivers(e.drivers) || h('p', {}, 'Not computed.')),
          rows.length ? checkList(rows, { source: 'data/trust.json, models/m7-extinction/results.json' }) : null,
          ok(D.res.m7) ? null : missingResults('models/m7-extinction/results.json', 'M7 details'),
          trust('ext'),
          links([[figLink('predict', e.name), e.name], [figLink('respond', 'When does a droplet flame go out?'), 'When does a droplet flame go out?']]),
        ],
      };
    },
  },
  {
    id: 'm7-burning-rate', title: 'M7 Droplet burning rate', models: ['models/m7-extinction'],
    files: 'data/models.json (id m7-burning-rate), models/m7-extinction/results.json ← models/m7-extinction/build.py',
    build(D) {
      const { e, r } = m7Common(D, 'm7-burning-rate', 'burning_rate');
      if (!e) return { status: 'missing', sub: 'How fast does a droplet burn?', body: [missingData('models', 'M7 burning-rate model')] };
      const pi = r?.point_interval_log_resid;
      const rows = [trustRuleRow(D, 'm7-burning-rate'),
        r && isNum(r.repeats_model_beats_both) ? { id: 'R2 repeats', state: 'reported', text: `beat both the d-squared law and the per-fuel mean in ${r.repeats_model_beats_both} of ${D.res.m7.repeats} repeats` } : null].filter(Boolean);
      return {
        status: e.status, sub: e.question,
        body: [
          scope(SCOPE['m7-burning-rate'](D)),
          stats(stat(e.metric, raw(e.score), br(e.score_range)),
            stat(`Baseline: ${e.baseline_name}`, raw(e.baseline_score), r?.baseline_d2_scaled ? `R² ${p3(r.baseline_d2_scaled.r2_median)}` : null),
            r?.headline ? stat('R², sessions held out', p3(r.headline.r2_median), 'secondary score') : null,
            ruleBox(D, 'm7-burning-rate', r ? [r.pass ? 'Met' : 'Missed', 'models/m7-extinction/RULES.md, R2'] : null)),
          dl([['Data', e.data], ['Method', e.method], ['How it was tested', e.validation],
            ['Other baselines', r ? `per-fuel mean ${p3(r.baseline_fuel_mean?.mae_median)} mm²/s; textbook d-squared law with no fitted constant ${p3(r.d2_textbook_no_fit?.mae_median)} mm²/s (R² ${p3(r.d2_textbook_no_fit?.r2_median)}).` : null],
            ['Point ranges', Array.isArray(pi) ? `Each prediction × ${p3(Math.exp(pi[0]))} to × ${p3(Math.exp(pi[1]))} (from the held-out log residuals; ${pct(r.point_interval_coverage)} of points inside).` : null],
            ['Could it be luck?', luck(D, 'm7-burning-rate') || 'No label-permutation test: this is a regression, not a yes/no model.'],
            ['Limits', e.limits]]),
          h('div', { class: 'mc-dr' }, h('h3', {}, 'Drivers'), drivers(e.drivers) || h('p', {}, 'Not computed.')),
          rows.length ? checkList(rows, { source: 'data/trust.json, models/m7-extinction/results.json' }) : null,
          ok(D.res.m7) ? null : missingResults('models/m7-extinction/results.json', 'M7 details'),
          trust('rate'),
          links([[figLink('predict', e.name), e.name]]),
        ],
      };
    },
  },
  {
    id: 'm7-cool-flame', title: 'M7 Cool flame', models: ['models/m7-extinction'],
    files: 'data/models.json (id m7-cool-flame), data/m7_explorer.json, data/permutation.json, models/m7-extinction/results.json ← models/m7-extinction/build.py',
    build(D) {
      const { e, r } = m7Common(D, 'm7-cool-flame', 'cool_flame');
      if (!e) return { status: 'missing', sub: 'Does a cool flame keep burning?', body: [missingData('models', 'M7 cool-flame model')] };
      // the droplet size is read from the results.json key itself (pressure_at_half_air_<d>mm_dodecane_free)
      const k50 = r ? Object.keys(r).find(k => /^pressure_at_half_air_[\d.]+mm_dodecane_free$/.test(k)) : null;
      const p50 = k50 ? r[k50] : null, d50 = k50 ? /_([\d.]+)mm_/.exec(k50)[1] : null;
      const rows = [trustRuleRow(D, 'm7-cool-flame'), r ? { id: 'Leakage', state: r.leakage_triggered ? 'fail' : 'pass', text: r.leakage_triggered ? 'leakage check triggered' : 'leakage check not triggered' } : null].filter(Boolean);
      return {
        status: e.status, sub: e.question,
        body: [
          scope(SCOPE['m7-cool-flame'](D)),
          stats(stat(`${e.metric}, sessions held out`, raw(e.score), br(e.score_range)),
            stat(`Baseline: ${e.baseline_name}`, raw(e.baseline_score), 'the model\'s range overlaps it'),
            isNum(p50) ? stat('Droplet more likely used up than left over above', `${raw(p50)} atm`, `free ${d50} mm n-dodecane droplet in air`) : null,
            ruleBox(D, 'm7-cool-flame', r ? [r.pass ? 'Met' : 'Missed', 'models/m7-extinction/RULES.md, R3'] : null)),
          dl([['Data', e.data], ['Method', e.method], ['How it was tested', e.validation],
            ['Could it be luck?', luck(D, 'm7-cool-flame')],
            ['Other splits', r?.S3_drop_extrapolated ? `Extrapolated cool-flame ends dropped (${fmt(r.S3_drop_extrapolated.rows, 0)} rows): AUC ${p3(r.S3_drop_extrapolated.auc_median)} ${br(r.S3_drop_extrapolated.auc_session_bootstrap_95, p3)}.` : null],
            ['Limits', e.limits]]),
          h('div', { class: 'mc-dr' }, h('h3', {}, 'Drivers'), drivers(e.drivers) || h('p', {}, 'Not computed.')),
          rows.length ? checkList(rows, { source: 'data/trust.json, models/m7-extinction/results.json' }) : null,
          ok(D.res.m7) ? null : missingResults('models/m7-extinction/results.json', 'M7 details'),
          trust('cool'),
          links([[figLink('predict', e.name), e.name], [figLink('respond', 'Looks out, still burning: cool flames'), 'Looks out, still burning: cool flames']]),
        ],
      };
    },
  },
  {
    id: 'flame', title: 'Flame simulation', models: ['models/flame-sim'],
    files: 'data/flame_static.json, data/flame_spread.json, models/flame-sim/results.json ← models/flame-sim/build.py',
    build(D) {
      const r = D.res.fs, fsp = D.fspread;
      const sub = 'What shape does a flame take with and without gravity, how fast does a droplet burn, and how fast does flame cross a solid?';
      if (!ok(r)) return { status: ok(fsp) ? fsp.status : 'missing', sub, body: [missingResults('models/flame-sim/results.json', 'Flame simulation scores'), trust('flame')] };
      const K = r.K_stats || {}, G = r.groups || {};
      const thin = Object.entries(G).find(([k]) => /thin PMMA/i.test(k)), thick = Object.entries(G).find(([k]) => /thick PMMA/i.test(k));
      const ro = Array.isArray(r.roper) ? r.roper.map(x => x.ratio).filter(isNum) : [];
      const kRows = Object.entries(K).map(([fuel, s]) => [fuel, fmt(s.held_out_n, 0), `${raw(s.held_out_median_abs_err_pct)}%`, `${raw(s.baseline_held_out_median_abs_err_pct)}% (constant K ${raw(s.baseline_K_mm2_s)} mm²/s)`,
        s.held_out_median_abs_err_pct <= s.baseline_held_out_median_abs_err_pct ? 'model' : 'baseline']);
      return {
        status: r.status || 'model', sub,
        body: [
          stats(
            thin ? stat(`Spread, ${thin[0].replace(/^group:\s*/, '')}: median error`, `${raw(thin[1].median_abs_err_pct)}%`, `de Ris ${raw(thin[1].baseline_median_abs_err_pct)}%; ${fmt(thin[1].n, 0)} points`) : null,
            thick ? stat(`Spread, ${thick[0].replace(/^group:\s*/, '')}: median error`, `${raw(thick[1].median_abs_err_pct)}%`, `de Ris ${raw(thick[1].baseline_median_abs_err_pct)}%; ${fmt(thick[1].n, 0)} points`) : null,
            ro.length ? stat('Flame height against the Roper correlation', `${raw(Math.min(...ro))}–${raw(Math.max(...ro))}×`, 'too tall: shapes are usable, absolute sizes are not') : null),
          kRows.length ? table(['Fuel (FLEX)', 'Held-out tests', 'Model: median error', 'Baseline: median error', 'Better on held-out tests'], kRows,
            { caption: 'Droplet burning-rate constant K against NASA FLEX (models/flame-sim/results.json → K_stats)' }) : null,
          dl([
            ['Data', MADE['Flame simulator']?.check],
            ['Method', MADE['Flame simulator']?.how],
            ['How it was tested', 'Checked against NASA flight data (FLEX, BASS-II) and against published correlations, each against a limit written before the check ran. It is not fitted to them, except for a few lumped constants named in models/flame-sim/README.md.'],
            ['Baseline', 'Beside each check: a constant burning rate K for droplets, de Ris without extinction for spread.'],
            ['Drivers', 'Not applicable: a physics model, not trained.'],
            ['Limits', ok(fsp) && Array.isArray(fsp.limits) ? fsp.limits.join('. ') + '.' : null],
          ]),
          quote('Flame shapes (sphere, teardrop, tilt) are usable. Absolute sizes are not.', 'models/flame-sim/REPORT.md'),
          checkList(fromChecks(r.checks), { source: 'models/flame-sim/results.json' }),
          trust('flame'),
          links([[figLink('flame', 'Flame simulator'), 'Flame simulator'], [figLink('flame', 'Every check on the flame model'), 'Every check on the flame model']]),
        ],
      };
    },
  },
  {
    id: 'cv', title: 'CV model and optical flow', models: [],
    files: 'data/cv_latest.json (when the camera owner adds it); no models/ folder yet',
    build(D) {
      const cv = D.cv;
      const rows = CV_PENDING.map(p => ({ id: p.id, state: 'pending', text: `${p.what} (${p.ref}; owner ${p.owner}). ${p.limit}.` }));
      const sub = 'Where is the flame on the bench rig, how big is it and how far from the sensor, and where does the smoke move?';
      return {
        status: ok(cv) ? cv.status : 'missing', sub,
        body: [
          ok(cv)
            ? h('p', {}, 'The camera model\'s file is connected (data/cv_latest.json). Its held-out scores are still to be measured, so no accuracy is shown.')
            : empty('Camera model: no data yet', 'cv_latest', 'The camera model and the optical-flow smoke track have no output file yet. No accuracy is shown until it is measured on held-out frames, with the pass rule written in RULES.md first.',
              '{ "status": "model", "frame_time_s": …, "flame_type": "surface" | "droplet", "area_cm2": …, "centroid_cm": [x, y], "bbox_cm": [x0, y0, x1, y1], "coordinates": "fuel", "confidence": …, "droplet": … }\n"droplet" is { "diameter_mm": … } for a droplet flame and empty for a surface flame.\n(shape proposed in models/m6b-predictor/CONTRACT_PROPOSAL.md)'),
          checkList(rows, { title: 'Checks still to run', source: 'js/overlays.js CV_PENDING (no numbers)' }),
          trust(null),
          links([[figLink('locate', 'Camera reading now'), 'Camera reading now (Bench rig)'], [figLink('assess', 'Load from camera'), 'Load from camera (Assess)']]),
        ],
      };
    },
  },
];

// A "Made by" entry for every section title (escape hatch, REBUILD_PLAN §2.7; the lead folds these into MADE in phase 7).
// The page itself sets provenance:false, so these are not drawn twice: the card body is the made-by.
for (const s of MODEL_SECTIONS) {
  registerMade(s.title, {
    kind: 'Model card (summary of one model)',
    how: 'Question, data, method, held-out score with its range, baseline, drivers, limits and pass-rule results, each read from the files listed. "Use it for / Not for" is the team\'s statement of scope.',
    files: s.files, models: s.models,
  });
}

/** One model's section: a numbered figure card. A failure inside one section never blanks the page. */
export function modelSection(spec, data) {
  let out;
  try { out = spec.build(data || { res: {} }); }
  catch (e) {
    console.error(`Model card "${spec.title}" failed`, e);
    out = { status: 'missing', sub: null, body: [h('div', { class: 'empty' }, h('h3', {}, 'This card could not be drawn'), h('p', {}, 'One of its files has a shape the page does not expect. The other cards are unaffected.'))] };
  }
  const c = card(spec.title, out.status || 'missing', out.sub, ...out.body);
  c.classList.add('mcard');
  c.dataset.model = spec.id;
  if (spec.models?.length) c.dataset.models = spec.models.join(' ');
  return c;
}

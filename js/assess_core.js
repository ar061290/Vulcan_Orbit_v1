// Assessment and risk for the Assess page, the response card on Put it out and the short answers.
// Pure apart from loadAssessData (which only fetches data files): no DOM, importable by Node.
// Frozen interface: site/REBUILD_PLAN.md §2.10. Every number here comes from a data file, from the M6b growth port run on
// the visitor's inputs, or from a cited constant (see the `source:` comments).
//
//   loadAssessData() → Promise<{sp, examples, lat, whatif, dw, rules, gaps, m7, flex, cv}>
//   computeAssessment(inputs, data) → Promise<{kind, growth?, pointer?, error?, errors?, regime?, boxes, detection, gap, parts, risk, sentences}>
//   riskLevel(parts, rules) → {level, fired:{id, label, reason}, evaluated:[…], approved}
//   nearestProbe(gaps, o2, kpa) → probe (a copy, with d_o2, d_kpa and within)
//   detectionFrom(lat, whatif, dw) → detection     riskParts(result) → parts     LEVELS
import { load, isMissing, fmt, sig, pct } from './lib.js';
import { runGrowth } from './growth_run.js';
import { spreadRates, dropletPointer } from './growth.js';

export const LEVELS = ['Low', 'Elevated', 'High'];
// source: 1 atm = 101.325 kPa (standard atmosphere; the same factor REBUILD_PLAN §3.5 uses for gaps.probes kPa ÷ 101.325)
const KPA_PER_ATM = 101.325;
// source: scripts/build_gaps.py near(kind, o2, kpa, do2=3, dk=10): a gaps.json probe counts tests within 3 O2 points and 10 kPa
const PROBE_DO2 = 3, PROBE_DKPA = 10;
// source: js/growth.js inBox (predictor.py in_box): inclusive boxes with a 1e-9 tolerance
const TOL = 1e-9;

const ok = d => !isMissing(d);
const isNum = v => typeof v === 'number' && Number.isFinite(v);
const num = v => (v == null || !Number.isFinite(Number(v)) ? 'n/a' : Math.abs(Number(v)) >= 100 ? fmt(v, 0) : sig(v, 3));

// ------------------------------------------------------------------ data
/** Every file Assess, the response card and the short answers read. Missing files come back as {status:'missing'}. */
export async function loadAssessData() {
  const names = ['spread_predictor', 'growth_examples', 'saffire_latency', 'whatif', 'drift_whatif', 'risk_rules', 'gaps',
    'm7_explorer', 'flex_suppression'];
  const [sp, examples, lat, whatif, dw, rules, gaps, m7, flex, cv] = await Promise.all([...names.map(n => load(n)), loadCv()]);
  return { sp, examples, lat, whatif, dw, rules, gaps, m7, flex, cv };
}
// cv_latest.json gets a manifest line when the CV owner adds it (site/CONTRACT_PROPOSAL.md §2), so it is fetched only when
// the manifest lists it. This keeps a 404 out of the console while the camera model is not connected. With no manifest,
// it is fetched anyway.
async function loadCv() {
  const m = await load('manifest');
  const listed = ok(m) && Array.isArray(m.files) ? m.files.some(f => f.name === 'cv_latest' && f.status !== 'missing') : true;
  return listed ? load('cv_latest') : { status: 'missing' };
}

// ------------------------------------------------------------------ detection timing (data only; the same for every input)
const chan = (b, re) => (b.channels || []).find(c => re.test(c.name || ''));
/** Saffire-III alarm times (burns with a radiometer alarm, the same selection as main's Find it summary), the whatif.json
 *  ceiling layout and the best drift_whatif.json layout. Missing files give nulls and are listed in `missing`. */
export function detectionFrom(lat, whatif, dw) {
  const out = { radiometer_s: null, smoke_s: null, obscuration: null, n_burns: null, cabin: null, lbm: null, missing: [],
    note: 'Alarm times are seconds after ignition on NASA\'s Saffire-III orbital burns, a different fire, shown for scale only.' };
  if (ok(lat) && Array.isArray(lat.burns)) {
    const burns = lat.burns.filter(b => chan(b, /radiometer/i)?.alarm_s != null);
    const rad = burns.map(b => chan(b, /radiometer/i).alarm_s);
    const sc = burns.map(b => chan(b, /scatter/i)?.alarm_s).filter(v => v != null);
    const ob = burns.map(b => chan(b, /obscuration/i)?.alarm_s).filter(v => v != null);
    out.n_burns = burns.length;
    out.radiometer_s = rad.length ? Math.max(...rad) : null;
    out.smoke_s = sc.length ? [Math.min(...sc), Math.max(...sc)] : null;
    out.obscuration = burns.length ? (ob.length ? Math.min(...ob) : 'never') : null;
    out.burns = burns.map(b => ({ key: b.key, name: b.name, radiometer_s: chan(b, /radiometer/i)?.alarm_s ?? null,
      smoke_s: chan(b, /scatter/i)?.alarm_s ?? null, obscuration_s: chan(b, /obscuration/i)?.alarm_s ?? null }));
    out.source = lat.source ?? null;
  } else out.missing.push('saffire_latency');
  if (ok(whatif) && Array.isArray(whatif.layouts) && whatif.layouts.length) {
    // The ceiling layout (the Earth habit, layouts[0]), as main's Predict short answer uses it.
    const c = whatif.layouts.find(l => /ceiling/i.test(l.name || '')) || whatif.layouts[0];
    out.cabin = { layout: c.name, caught_60: c.caught_60 ?? null, caught_120: c.caught_120 ?? null, caught_300: c.caught_300 ?? null,
      range120: c.caught_120_range ?? null, alarm_mg_m3: whatif.alarm_mg_m3 ?? null,
      caught_120_at_hi: c.caught_120_at_10mg ?? null, alarm_hi_mg_m3: whatif.alarm_hi_mg_m3 ?? null, runs: whatif.runs ?? null };
  } else out.missing.push('whatif');
  if (ok(dw) && Array.isArray(dw.layouts) && dw.layouts.length) {
    const best = dw.layouts.reduce((a, l) => ((l.caught_180 ?? -Infinity) > (a.caught_180 ?? -Infinity) ? l : a));
    out.lbm = { layout: best.name, caught_60: best.caught_60 ?? null, caught_180: best.caught_180 ?? null,
      range60: best.caught_60_range ?? null, range180: best.caught_180_range ?? null, alarm_mg_m3: dw.alarm_mg_m3 ?? null,
      detector_delay_s: dw.detector_delay_s ?? null, runs: dw.runs ?? null };
  } else out.missing.push('drift_whatif');
  return out;
}

// ------------------------------------------------------------------ what NASA has not tested
/** The gaps.json probe nearest to (o2 %, kPa), distances scaled by the build_gaps.py window. `within` says whether the point
 *  sits inside that window (3 O2 points, 10 kPa), so the probe's test counts apply to it. */
export function nearestProbe(gaps, o2, kpa) {
  if (!ok(gaps) || !Array.isArray(gaps.probes) || !gaps.probes.length || !isNum(o2) || !isNum(kpa)) return null;
  let best = null, bd = Infinity;
  for (const p of gaps.probes) {
    const d = Math.hypot((p.o2 - o2) / PROBE_DO2, (p.kpa - kpa) / PROBE_DKPA);
    if (d < bd) { bd = d; best = p; }
  }
  const d_o2 = o2 - best.o2, d_kpa = kpa - best.kpa;
  return { ...JSON.parse(JSON.stringify(best)), d_o2, d_kpa,
    within: Math.abs(d_o2) <= PROBE_DO2 && Math.abs(d_kpa) <= PROBE_DKPA, window: { o2: PROBE_DO2, kpa: PROBE_DKPA } };
}

// ------------------------------------------------------------------ input checks
function validate(inputs) {
  const e = [];
  const f = inputs?.flame, fu = inputs?.fuel, c = inputs?.conditions;
  if (!f) e.push('No flame state.');
  if (!fu) e.push('No fuel.');
  if (!c) e.push('No cabin conditions.');
  if (e.length) return e;
  if (f.flame_type !== 'surface') e.push('Flame type must be surface or droplet.');
  if (!(isNum(f.area_cm2) && f.area_cm2 > 0)) e.push('Flame area must be a number above 0 cm².');
  if (!(Array.isArray(f.centroid_cm) && f.centroid_cm.length === 2 && f.centroid_cm.every(isNum))) e.push('Flame position needs x and y in cm.');
  if (f.bbox_cm != null && !(Array.isArray(f.bbox_cm) && f.bbox_cm.length === 4 && f.bbox_cm.every(isNum))) e.push('The flame box must be four numbers in cm, or none.');
  if (!(isNum(fu.width_cm) && fu.width_cm > 0)) e.push('Fuel width must be a number above 0 cm.');
  if (!(isNum(fu.length_cm) && fu.length_cm > 0)) e.push('Fuel length must be a number above 0 cm.');
  if (!(isNum(fu.thickness_mm) && fu.thickness_mm > 0)) e.push('Fuel thickness must be a number above 0 mm.');
  if (fu.sides_burning !== 1 && fu.sides_burning !== 2) e.push('Sides burning must be 1 or 2.');
  if (fu.area_density_mg_cm2 != null && !(isNum(fu.area_density_mg_cm2) && fu.area_density_mg_cm2 > 0)) e.push('Area density must be a number above 0 mg/cm², or none.');
  if (!(isNum(c.flow_cm_s) && c.flow_cm_s >= 0)) e.push('Airflow must be a number of 0 cm/s or more.');
  if (c.flow_direction_deg != null && !isNum(c.flow_direction_deg)) e.push('Airflow direction must be a number of degrees.');
  if (!(isNum(c.o2_vol_pct) && c.o2_vol_pct > 0 && c.o2_vol_pct <= 100)) e.push('O₂ must be a share above 0 and at most 100 %.');
  if (!(isNum(c.pressure_atm) && c.pressure_atm > 0)) e.push('Pressure must be a number above 0 atm.');
  return e;
}

// ------------------------------------------------------------------ calibration boxes (spread_predictor.constants.*.domain)
const SHORT = { tau_mm: 'burning thickness', flow_cm_s: 'airflow', o2_vol_pct: 'O₂', pressure_atm: 'pressure', area_density: 'fabric area density' };
const LABEL = { tau_mm: 'Burning thickness (mm; thickness ÷ 2 when both sides burn)', flow_cm_s: 'Airflow (cm/s)',
  o2_vol_pct: 'O₂ (% by volume)', pressure_atm: 'Pressure (atm)', area_density: 'Fabric area density (mg/cm²)' };
function boxRows(box, vals, name) {
  return Object.keys(box).filter(k => k in vals).map(k => {
    const [lo, hi] = box[k], value = Number(vals[k]);
    return { field: k, label: LABEL[k] || k, value, lo, hi, inside: value >= lo - TOL && value <= hi + TOL, box: name };
  });
}
/** The inputs against the calibration box of the active regime (the same boxes and test growth.js uses for in_domain). */
function calibrationBoxes(fuel, conditions, C, rates) {
  const u = Number(conditions.flow_cm_s), o2 = Number(conditions.o2_vol_pct), p = Number(conditions.pressure_atm ?? 1.0);
  if (fuel.material === 'PMMA') {
    const reg = rates.regime, out = boxRows(C.opposed.domain[reg], { tau_mm: rates.tau_mm, flow_cm_s: u, o2_vol_pct: o2, pressure_atm: p },
      `opposed (upwind) rate, ${reg}-regime PMMA`);
    if (reg === 'thick') out.push(...boxRows(C.pmma_concurrent_bound.domain, { flow_cm_s: u, o2_vol_pct: o2, pressure_atm: p },
      'downwind bound, thick PMMA'));
    return out;
  }
  return boxRows(C.concurrent.domain, { flow_cm_s: u, o2_vol_pct: o2, pressure_atm: p, area_density: rates.area_density_mg_cm2 },
    `downwind (concurrent) rate, ${fuel.material} fabric`);
}

// ------------------------------------------------------------------ risk
/** The named values the risk rules read (data/risk_rules.json `values`). Missing pieces are null. */
export function riskParts(res) {
  const g = res.growth, s = g?.summary, d = res.detection || {};
  const t0 = Number(res.inputs?.flame?.frame_time_s ?? 0);
  const abs = v => (isNum(v) ? Number((t0 + v).toPrecision(8)) : null);   // the same 8 s.f. as growth.js t_abs_s
  return {
    kind: res.kind, material: res.inputs?.fuel?.material ?? null,
    verdict_code: g?.verdict?.code ?? null, verdict_label: g?.verdict?.label ?? null,
    frame_time_s: g ? t0 : null, initial_area_cm2: g?.grid?.initial_area_cm2 ?? null,
    max_area_lo_cm2: s?.lo?.max_area_cm2 ?? null, max_area_mid_cm2: s?.mid?.max_area_cm2 ?? null, max_area_hi_cm2: s?.hi?.max_area_cm2 ?? null,
    t_max_mid_abs_s: abs(s?.mid?.t_max_s), t_max_hi_abs_s: abs(s?.hi?.t_max_s), t_end_hi_abs_s: abs(s?.hi?.t_end_s),
    stop_reason_hi: s?.hi?.stop_reason ?? null,
    out_of_box: g ? (res.boxes || []).filter(b => !b.inside).length : null,
    radiometer_s: d.radiometer_s ?? null, smoke_fastest_s: d.smoke_s?.[0] ?? null, smoke_slowest_s: d.smoke_s?.[1] ?? null,
    cabin_caught_120: d.cabin?.caught_120 ?? null, lbm_caught_180: d.lbm?.caught_180 ?? null,
  };
}

const OPS = { '==': (a, b) => a === b, '!=': (a, b) => a !== b, '>': (a, b) => a > b, '>=': (a, b) => a >= b, '<': (a, b) => a < b, '<=': (a, b) => a <= b };
const show = v => (typeof v === 'number' ? num(v) : v == null ? 'n/a' : `'${v}'`);
function evalRule(rule, parts) {
  const values = {}, tests = [], unknown = [];
  let all = true;
  for (const t of rule.test || []) {
    const op = OPS[t.op];
    const a = parts[t.a], literal = !('b' in t), b = literal ? t.value : parts[t.b];
    values[t.a] = a ?? null;
    if (!literal) values[t.b] = b ?? null;
    const rhs = literal ? show(b) : `${t.b} (${show(b)})`;
    if (!op) { unknown.push(`operator ${t.op}`); tests.push(`${t.a} ${t.op} ${rhs}: unknown operator`); all = false; continue; }
    if (a == null || b == null) { unknown.push(a == null ? t.a : t.b); tests.push(`${t.a} (${show(a)}) ${t.op} ${rhs}: not available`); all = false; continue; }
    const r = op(a, b);
    tests.push(`${t.a} (${show(a)}) ${t.op} ${rhs}: ${r ? 'yes' : 'no'}`);
    if (!r) all = false;
  }
  return { id: rule.id, level: rule.level ?? null, label: rule.label ?? null, matched: unknown.length ? null : all,
    reason: rule.reason ?? '', values, tests, unknown };
}

/** First matching rule in file order; rules.default when none match. A rule that cannot be checked (a value it needs is
 *  missing) stops the chain, and the default fires with a reason that names the missing value, so a missing file never
 *  lowers the level. Rules after the one that fired are still evaluated and listed (fired:false). */
export function riskLevel(parts, rules) {
  if (!ok(rules) || !Array.isArray(rules.rules)) {
    return { level: null, fired: { id: 'missing', label: 'No rules', reason: 'data/risk_rules.json is missing, so no level is given.' },
      evaluated: [], approved: false, status: 'missing' };
  }
  const evaluated = rules.rules.map(r => evalRule(r, parts || {}));
  let fired = null, stoppedBy = null;
  for (const e of evaluated) {
    if (e.matched === null) { stoppedBy = e; break; }
    if (e.matched) { fired = e; break; }
  }
  const def = rules.default || {};
  let out;
  if (fired) out = { level: fired.level, fired: { id: fired.id, label: fired.label, reason: fired.reason } };
  else {
    const extra = stoppedBy ? ` Rule ${stoppedBy.id} (${stoppedBy.label}) could not be checked because ${stoppedBy.unknown.join(', ')} is missing.` : '';
    out = { level: def.level ?? null, fired: { id: def.id || 'default', label: def.label ?? 'Default', reason: (def.reason ?? '') + extra } };
  }
  for (const e of evaluated) e.fired = e.id === out.fired.id;
  return { ...out, evaluated, approved: rules.approved === true, status: rules.status, default: { level: def.level ?? null, reason: def.reason ?? '' } };
}

// ------------------------------------------------------------------ sentences (the Assess short answer)
function sentencesFor(res) {
  const out = [], g = res.growth, d = res.detection, r = res.risk;
  if (res.kind === 'droplet') out.push(res.pointer?.note || 'Droplet flames are not simulated by the growth model.');
  else if (res.kind === 'unsupported') out.push(`Not supported: ${res.error}.`);
  else if (res.kind === 'invalid') out.push(`The growth model cannot run on these inputs: ${(res.errors || [res.error]).join(' ')}`);
  else if (g) {
    const v = g.verdict, n = v.matched_cases?.length || 0;
    out.push(`Verdict from NASA's observed cases: ${v.label}.` + (n ? ` It rests on ${n} matched NASA case${n === 1 ? '' : 's'} (${v.matched_cases.map(m => m.case_id).join(', ')}).` : ''));
    const s = g.summary, peaks = ['lo', 'mid', 'hi'].map(k => s[k].max_area_cm2);
    if (v.code === 2) out.push(`The model holds the flame at its starting ${num(g.grid.initial_area_cm2)} cm² until it burns out, ${num(s.lo.t_end_s)} to ${num(s.hi.t_end_s)} s after this reading.`);
    else out.push(`Model: the middle run peaks at ${num(s.mid.max_area_cm2)} cm² ${num(s.mid.t_max_s)} s after this reading (lo and hi runs: ${num(Math.min(...peaks))} to ${num(Math.max(...peaks))} cm²) and ends at ${num(s.mid.t_end_s)} s (${s.mid.stop_reason}).`);
    const outside = (res.boxes || []).filter(b => !b.inside);
    if (outside.length) out.push(`${outside.length} input${outside.length === 1 ? ' lies' : 's lie'} outside the range NASA's data covers for this model: ${[...new Set(outside.map(b => SHORT[b.field] || b.field))].join(', ')}.`);
  }
  if (r) {
    if (r.level) out.push(`Risk by the team's draft rules: ${r.level} (${r.fired.label}).${r.approved ? '' : ' The rules are a team choice, to be approved.'}`);
    else out.push(`No risk level: ${r.fired.reason}`);
  }
  if (d?.radiometer_s != null && d.smoke_s) out.push(`For scale, on NASA's ${d.n_burns} Saffire-III orbital burns (different fires) a flame light sensor alarmed within ${num(d.radiometer_s)} s of ignition and the cabin smoke detector took ${num(d.smoke_s[0])} to ${num(d.smoke_s[1])} s.`);
  else if (d?.missing?.includes('saffire_latency')) out.push('NASA alarm times: data/saffire_latency.json is missing.');
  return out;
}

// ------------------------------------------------------------------ the assessment
/** inputs: AssessInputs (js/store.js). data: loadAssessData(). Never throws: problems come back as kind 'unsupported' or
 *  'invalid' with the reason. The growth run uses the shared worker when the browser has one (js/growth_run.js). */
export async function computeAssessment(inputs, data = {}) {
  const res = { kind: 'invalid', inputs: inputs ? JSON.parse(JSON.stringify(inputs)) : null, boxes: [], regime: null,
    detection: detectionFrom(data.lat, data.whatif, data.dw), gap: null, status: 'model' };
  const c = inputs?.conditions;
  if (c && isNum(c.o2_vol_pct) && isNum(c.pressure_atm)) res.gap = nearestProbe(data.gaps, c.o2_vol_pct, c.pressure_atm * KPA_PER_ATM);
  const C = ok(data.sp) ? data.sp.constants : null;
  const flame = inputs?.flame, fuel = inputs?.fuel;
  try {
    if (flame?.flame_type === 'droplet') {
      res.kind = 'droplet';
      res.pointer = dropletPointer(flame);
    } else if (!C) {
      res.error = 'data/spread_predictor.json is missing, so the growth model cannot run';
      res.errors = [res.error + '.'];
    } else {
      let rates = null;
      try { rates = fuel ? spreadRates(fuel, c || {}, C) : null; }
      catch (e) { if (/is not modelled/.test(e.message)) { res.kind = 'unsupported'; res.error = e.message; } else throw e; }
      if (res.kind !== 'unsupported') {
        const errors = validate(inputs);
        if (errors.length) { res.errors = errors; res.error = errors.join(' '); }
        else {
          res.regime = rates.regime;
          res.boxes = calibrationBoxes(fuel, c, C, rates);
          const fs = { flame_type: 'surface', frame_time_s: flame.frame_time_s ?? 0, area_cm2: flame.area_cm2,
            centroid_cm: flame.centroid_cm, bbox_cm: flame.bbox_cm ?? null, droplet: null, confidence: flame.confidence ?? null };
          const fuelIn = { material: fuel.material, width_cm: fuel.width_cm, length_cm: fuel.length_cm, thickness_mm: fuel.thickness_mm,
            sides_burning: fuel.sides_burning };
          if (fuel.area_density_mg_cm2 != null) fuelIn.area_density_mg_cm2 = fuel.area_density_mg_cm2;
          const condIn = { flow_cm_s: c.flow_cm_s, flow_direction_deg: c.flow_direction_deg ?? 0, o2_vol_pct: c.o2_vol_pct, pressure_atm: c.pressure_atm };
          res.growth = await runGrowth({ flameState: fs, fuel: fuelIn, conditions: condIn, C });
          res.kind = 'growth';
        }
      }
    }
  } catch (e) {
    if (e && e.name === 'AbortError') throw e;          // the page stopped the run (ctx.onLeave); let it drop the result
    res.kind = /is not modelled/.test(e?.message || '') ? 'unsupported' : 'invalid';
    res.error = e?.message || String(e);
    res.errors = [res.error];
  }
  res.parts = riskParts(res);
  res.risk = riskLevel(res.parts, data.rules);
  res.sentences = sentencesFor(res);
  return res;
}

/** Share as a percentage string, for callers that print detection shares. */
export const share = v => (isNum(v) ? pct(v) : 'n/a');

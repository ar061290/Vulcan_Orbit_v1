// Plain Node test for the M6b growth port (js/growth.js, js/growth_run.js). No framework.
//   node tests/growth.test.mjs        exits 0 when every check passes, 1 otherwise.
// References: data/growth_examples.json (3 worked examples, the spec C1 test vectors), data/spread_predictor.json
// (constants + 8 step-1 grids of 21 x 26 cells), tests/fixtures/growth_vectors.json (9 extra Python reference vectors,
// the droplet pointer and the unsupported-material error, from models/m6b-predictor/growth.py; copied per decision Q6).
import { readFileSync, existsSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { simulateGrowth, spreadRates, verdict, VERDICTS, areaCurve, sig, growthCost } from '../js/growth.js';
import { runGrowth } from '../js/growth_run.js';

const ROOT = new URL('../', import.meta.url);
const readJSON = (rel) => JSON.parse(readFileSync(new URL(rel, ROOT), 'utf8'));
const SP = readJSON('data/spread_predictor.json');
const C = SP.constants;
const EX = readJSON('data/growth_examples.json').examples;
const FIXTURE = 'tests/fixtures/growth_vectors.json';
const REF = existsSync(new URL(FIXTURE, ROOT)) ? readJSON(FIXTURE) : null;
const RUNS = ['lo', 'mid', 'hi'];
const SUMMARY_NUMS = ['max_area_cm2', 't_max_s', 't_end_s', 'area_consumed_cm2'];

let failed = 0;
const results = [];
function report(name, ok, lines = []) {
  results.push([name, ok]);
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  for (const l of lines) console.log(`        ${l}`);
}

// Order-insensitive deep equality on JSON values; returns the first differing path or null.
function diff(a, b, path = '') {
  if (a === b) return null;
  if (typeof a === 'number' && typeof b === 'number' && Number.isNaN(a) && Number.isNaN(b)) return null;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return `${path}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`;
    if (a.length !== b.length) return `${path}: length ${a.length} vs ${b.length}`;
    for (let i = 0; i < a.length; i++) { const d = diff(a[i], b[i], `${path}[${i}]`); if (d) return d; }
    return null;
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ka = Object.keys(a).sort(), kb = Object.keys(b).sort();
    if (ka.join('|') !== kb.join('|')) return `${path}: keys [${ka}] vs [${kb}]`;
    for (const k of ka) { const d = diff(a[k], b[k], `${path}.${k}`); if (d) return d; }
    return null;
  }
  return `${path}: ${JSON.stringify(a)} (port) vs ${JSON.stringify(b)} (reference)`;
}
const rel = (a, b) => (a === b ? 0 : Math.abs(a - b) / Math.max(Math.abs(b), 1e-12));
const same4 = (a, b) => typeof a === 'number' && typeof b === 'number' && sig(a, 4) === sig(b, 4);

function timed(fn, reps = 3) {
  const ms = [];
  let out;
  for (let r = 0; r < reps; r++) { const t = performance.now(); out = fn(); ms.push(performance.now() - t); }
  ms.sort((x, y) => x - y);
  return { out, ms: ms[Math.floor(reps / 2)] };
}

// ------------------------------------------------------------------ run the 3 worked examples once (with internals)
const runs = EX.map((e) => {
  const i = e.inputs;
  const { out, ms } = timed(() => simulateGrowth(i.flame_state, i.fuel, i.conditions, C, { internals: true }));
  return { e, out, ms };
});

// 1. summary numbers to 4 s.f. and stop_reason equal
{
  const lines = [];
  let ok = true;
  for (const { e, out } of runs) {
    for (const r of RUNS) {
      const g = out.summary[r], x = e.summary[r];
      const bad = SUMMARY_NUMS.filter((k) => !same4(g[k], x[k]));
      if (g.stop_reason !== x.stop_reason) bad.push(`stop_reason "${g.stop_reason}" vs "${x.stop_reason}"`);
      if (bad.length) ok = false;
      lines.push(`${e.id.padEnd(26)} ${r.padEnd(3)} max ${g.max_area_cm2} cm2 at ${g.t_max_s} s, ends ${g.t_end_s} s, ` +
        `consumed ${g.area_consumed_cm2} cm2, ${g.stop_reason}${bad.length ? `   MISMATCH ${bad.map((k) => (k.includes(' ') ? k : `${k} ${g[k]} vs ${x[k]}`)).join('; ')}` : ''}`);
    }
  }
  report('1. growth_examples: 3 examples x lo/mid/hi summary to 4 s.f., stop_reason equal (36 numbers + 9 reasons)', ok, lines);
}

// 2. verdict, rates_mm_s, burnout_s, grid, labels, and the output shape exactly equal
{
  const lines = [];
  let ok = true;
  const keys = ['status', 'flame_type', 'units', 'verdict', 'rates_mm_s', 'burnout_s', 'grid', 'calibrated', 'extrapolated', 'assumed', 'notes', 'limits'];
  for (const { e, out } of runs) {
    const shapeKeys = Object.keys(e).filter((k) => !['id', 'title', 'why', 'inputs'].includes(k)).sort().join(',');
    const outKeys = Object.keys(out).sort().join(',');
    const errs = [];
    if (shapeKeys !== outKeys) errs.push(`output keys [${outKeys}] vs file [${shapeKeys}]`);
    for (const k of keys) { const d = diff(out[k], e[k], k); if (d) errs.push(d); }
    if (errs.length) ok = false;
    lines.push(`${e.id.padEnd(26)} verdict ${out.verdict.code} "${out.verdict.label}", ${out.verdict.matched_cases.length} matched case(s); ` +
      `grid ${out.grid.nx} x ${out.grid.ny}${errs.length ? `   MISMATCH ${errs.join(' | ')}` : ''}`);
  }
  report('2. growth_examples: verdict, rates_mm_s, burnout_s, grid, calibrated, extrapolated, assumed (+ notes, limits, keys) exactly equal', ok, lines);
}

// 3. t_s and t_abs_s to relative 1e-5; area_cm2 within one cell's area. A sample that sits on a burnout or ignition step
//    is reported, not failed, when the reference value is reached by the port's own curve within the time tolerance.
{
  const lines = [];
  let ok = true;
  for (const { e, out } of runs) {
    const it = out._internals;
    const cell = e.grid.dx_cm * e.grid.dy_cm;
    let worstT = 0, worstTabs = 0, worstA = 0, steps = [], bad = [];
    if (out.t_s.length !== e.t_s.length) bad.push(`t_s length ${out.t_s.length} vs ${e.t_s.length}`);
    for (let k = 0; k < e.t_s.length; k++) {
      worstT = Math.max(worstT, rel(out.t_s[k], e.t_s[k]));
      worstTabs = Math.max(worstTabs, rel(out.t_abs_s[k], e.t_abs_s[k]));
    }
    const tEnd = e.t_s[e.t_s.length - 1];
    const tol = 1e-5 * tEnd;
    for (const r of RUNS) {
      for (let k = 0; k < e.area_cm2[r].length; k++) {
        const a = out.area_cm2[r][k], x = e.area_cm2[r][k];
        const d = Math.abs(a - x);
        const slack = cell * (1 + 1e-6) + 5e-4 * Math.max(Math.abs(a), Math.abs(x));
        if (d <= slack) { worstA = Math.max(worstA, d); continue; }
        // explain as a step: does the port's unrounded curve reach the reference value within +-tol of the sample time?
        const t = it.times[k];
        const window = [];
        for (let w = -20; w <= 20; w++) window.push(t + (w / 20) * tol);
        const vals = areaCurve(it.sorted[r], it.tb[r], it.cell, window);
        const lo = Math.min(...vals) - slack, hi = Math.max(...vals) + slack;
        if (x >= lo && x <= hi) steps.push(`${r}[${k}] t=${e.t_s[k]} s: port ${a} vs file ${x} cm2 (port reaches ${sig(Math.min(...vals))}..${sig(Math.max(...vals))} within +-${sig(tol, 2)} s)`);
        else bad.push(`${r}[${k}] t=${e.t_s[k]} s: port ${a} vs file ${x} cm2`);
      }
    }
    if (worstT > 1e-5) bad.push(`t_s worst relative ${worstT.toExponential(2)}`);
    if (worstTabs > 1e-5) bad.push(`t_abs_s worst relative ${worstTabs.toExponential(2)}`);
    if (bad.length) ok = false;
    lines.push(`${e.id.padEnd(26)} t_s worst rel ${worstT.toExponential(2)}, t_abs_s worst rel ${worstTabs.toExponential(2)}, ` +
      `area worst |diff| ${sig(worstA, 3)} cm2 (one cell = ${sig(cell, 4)} cm2)${bad.length ? `   FAIL ${bad.join('; ')}` : ''}`);
    for (const s of steps) lines.push(`    reported step (not failed): ${s}`);
  }
  report('3. growth_examples: t_s, t_abs_s to relative 1e-5; area_cm2 lo/mid/hi within one cell (steps reported)', ok, lines);
}

// 4. step-1 spreadRates over all 8 spread_predictor cases x 546 cells within relative 5e-4; verdict, in_domain,
//    calibration and regime equal
{
  const lines = [];
  let ok = true;
  for (const c of SP.cases) {
    const fuel = { material: c.material, thickness_mm: c.thickness_mm, sides_burning: c.sides_burning };
    let worst = 0, n = 0;
    const mis = { rate: 0, verdict: 0, in_domain: 0, calibration: 0, regime: 0 };
    SP.o2_vol_pct.forEach((o2, i) => SP.flow_cm_s.forEach((u, j) => {
      n++;
      const cond = { flow_cm_s: u, o2_vol_pct: o2, pressure_atm: SP.pressure_atm, flow_direction_deg: 0 };
      const r = spreadRates(fuel, cond, C);
      const d = r[c.flow_direction];
      const none = d === null || d.mid === null;
      for (const [key, fk] of [['mid', 'rate_mm_s'], ['lo', 'lo'], ['hi', 'hi']]) {
        const exp = c[fk][i][j];
        if (none || exp === null) { if (!(none && exp === null)) mis.rate++; continue; }
        const e = rel(d[key], exp);
        worst = Math.max(worst, e);
        if (e > 5e-4) mis.rate++;
      }
      const code = VERDICTS.indexOf(verdict(fuel, cond, C).by_direction[c.flow_direction]);
      if (code !== c.verdict[i][j]) mis.verdict++;
      if ((d && d.in_domain ? 1 : 0) !== c.in_domain[i][j]) mis.in_domain++;
      if ((d ? d.calibration : 'none') !== c.calibration[i][j]) mis.calibration++;
      if (r.regime !== c.regime[i][j]) mis.regime++;
    }));
    const nm = Object.values(mis).reduce((s, x) => s + x, 0);
    if (nm) ok = false;
    lines.push(`${c.id.padEnd(28)} ${n} cells; worst rel rate diff ${worst.toExponential(2)}; mismatches ${JSON.stringify(mis)}`);
  }
  report('4. spreadRates: 8 spread_predictor cases x 546 cells, rates within rel 5e-4, verdict/in_domain/calibration/regime equal', ok, lines);
}

// 5. droplet pointer text and unsupported-material error text (direct and through runGrowth)
{
  const lines = [];
  let ok = true;
  if (!REF) { ok = false; lines.push(`missing ${FIXTURE}`); }
  else {
    const dropIn = { flame_type: 'droplet', frame_time_s: 3.0, droplet: { diameter_mm: 3 } };
    const d1 = diff(simulateGrowth(dropIn, { material: 'PMMA' }, {}, C), REF.droplet_pointer, 'droplet');
    const d2 = diff(await runGrowth({ flameState: dropIn, fuel: { material: 'PMMA' }, conditions: {}, C }), REF.droplet_pointer, 'runGrowth droplet');
    if (d1 || d2) ok = false;
    lines.push(`droplet pointer: ${d1 || d2 || 'equal to growth.py droplet_pointer() (direct and via runGrowth)'}`);
    const bad = [{ flame_type: 'surface', frame_time_s: 0, area_cm2: 1, centroid_cm: [1, 1], bbox_cm: [0, 0, 2, 2] },
      { material: 'Nomex', width_cm: 2, length_cm: 2, thickness_mm: 1 }, { flow_cm_s: 1, o2_vol_pct: 21 }];
    let m1 = null, m2 = null;
    try { simulateGrowth(...bad, C); } catch (err) { m1 = err.message; }
    try { await runGrowth({ flameState: bad[0], fuel: bad[1], conditions: bad[2], C }); } catch (err) { m2 = err.message; }
    if (m1 !== REF.unsupported_material_error || m2 !== REF.unsupported_material_error) ok = false;
    lines.push(`unsupported material: direct "${m1}", runGrowth "${m2}", reference "${REF.unsupported_material_error}"`);
    let m3 = null;
    try { spreadRates(bad[1], bad[2], C); } catch (err) { m3 = err.message; }
    if (m3 !== REF.unsupported_material_error) ok = false;
    lines.push(`spreadRates on the same fuel throws "${m3}"`);
  }
  report('5. droplet pointer and unsupported-material error text', ok, lines);
}

// 6. milliseconds per call (median of 3). runGrowth uses the module Worker whenever the browser has one.
{
  const lines = [];
  let ok = true;
  let worst = 0;
  for (const { e, ms } of runs) {
    worst = Math.max(worst, ms);
    lines.push(`${e.id.padEnd(26)} ${ms.toFixed(1)} ms (cost ${growthCost(e.inputs.flame_state, e.inputs.fuel).toLocaleString('en')} cell-pairs)`);
  }
  // Two large fuels at the default grid, to see whether the worker is needed (information, not a pass rule).
  const big = [
    ['40 x 100 cm SIBAL, band flame', { flame_type: 'surface', frame_time_s: 0, area_cm2: 20, centroid_cm: [0.25, 20], bbox_cm: [0, 0, 0.5, 40] },
      { material: 'SIBAL', width_cm: 40, length_cm: 100, thickness_mm: 0.32, sides_burning: 2 }, { flow_cm_s: 20, flow_direction_deg: 0, o2_vol_pct: 22, pressure_atm: 1 }],
    ['40 x 100 cm PMMA, 300 cm2 centre flame', { flame_type: 'surface', frame_time_s: 0, area_cm2: 300, centroid_cm: [50, 20], bbox_cm: [40, 10, 60, 30] },
      { material: 'PMMA', width_cm: 40, length_cm: 100, thickness_mm: 5, sides_burning: 2 }, { flow_cm_s: 10, flow_direction_deg: 30, o2_vol_pct: 21, pressure_atm: 1 }],
  ];
  for (const [label, f, fu, co] of big) {
    const { ms } = timed(() => simulateGrowth(f, fu, co, C), 1);
    worst = Math.max(worst, ms);
    lines.push(`${label.padEnd(40)} ${ms.toFixed(1)} ms (cost ${growthCost(f, fu).toLocaleString('en')} cell-pairs; information only)`);
  }
  const viaRun = await runGrowth({ flameState: EX[0].inputs.flame_state, fuel: EX[0].inputs.fuel, conditions: EX[0].inputs.conditions, C });
  const dRun = diff(JSON.parse(JSON.stringify(viaRun)), JSON.parse(JSON.stringify(runs[0].out)), 'runGrowth');
  if (dRun) ok = false;
  lines.push(`runGrowth (sync path in Node, no Worker) equals simulateGrowth: ${dRun || 'yes'}`);
  lines.push(`slowest call ${worst.toFixed(1)} ms; ${worst > 200 ? 'over' : 'under'} the ~200 ms line. ` +
    'In the browser runGrowth always runs in the module Worker when one can be started, so the page never blocks.');
  report('6. milliseconds per call', ok, lines);
}

// 7. the 9 extra Python reference vectors
{
  const lines = [];
  let ok = true;
  if (!REF) { ok = false; lines.push(`missing ${FIXTURE}`); }
  else {
    for (const v of REF.vectors) {
      const i = v.inputs, x = v.expected;
      const { out, ms } = timed(() => simulateGrowth(i.flame_state, i.fuel, i.conditions, C));
      const errs = [];
      for (const k of ['verdict', 'rates_mm_s', 'burnout_s', 'grid', 'calibrated', 'extrapolated', 'assumed', 'notes']) {
        const d = diff(out[k], x[k], k); if (d) errs.push(d);
      }
      for (const r of RUNS) {
        for (const k of SUMMARY_NUMS) if (!same4(out.summary[r][k], x.summary[r][k])) errs.push(`summary.${r}.${k} ${out.summary[r][k]} vs ${x.summary[r][k]}`);
        if (out.summary[r].stop_reason !== x.summary[r].stop_reason) errs.push(`summary.${r}.stop_reason "${out.summary[r].stop_reason}" vs "${x.summary[r].stop_reason}"`);
      }
      const [f0, fl, nT] = x.t_s_first_last;
      if (out.t_s.length !== nT || rel(out.t_s[0], f0) > 1e-5 || rel(out.t_s[out.t_s.length - 1], fl) > 1e-5) {
        errs.push(`t_s [${out.t_s[0]}, ${out.t_s[out.t_s.length - 1]}, ${out.t_s.length}] vs [${f0}, ${fl}, ${nT}]`);
      }
      const cell = x.grid.dx_cm * x.grid.dy_cm;
      const every50 = out.area_cm2.mid.filter((_, k) => k % 50 === 0);
      every50.forEach((a, k) => {
        const e = x.area_mid_every_50[k];
        if (Math.abs(a - e) > cell * (1 + 1e-6) + 5e-4 * Math.abs(e)) errs.push(`area_cm2.mid[${k * 50}] ${a} vs ${e}`);
      });
      if (i.flame_state.frame_time_s && rel(out.t_abs_s[out.t_abs_s.length - 1], i.flame_state.frame_time_s + fl) > 1e-5) {
        errs.push(`t_abs_s end ${out.t_abs_s[out.t_abs_s.length - 1]} vs frame_time + t_end ${i.flame_state.frame_time_s + fl}`);
      }
      if (errs.length) ok = false;
      const s = out.summary;
      lines.push(`${v.id.padEnd(36)} ${out.verdict.label.padEnd(20)} max mid ${s.mid.max_area_cm2} cm2, ends ${s.lo.t_end_s}/${s.mid.t_end_s}/${s.hi.t_end_s} s, ` +
        `${s.mid.stop_reason}; ${ms.toFixed(1)} ms${errs.length ? `   MISMATCH ${errs.join(' | ')}` : ''}`);
    }
  }
  report(`7. ${REF ? REF.vectors.length : 0} extra reference vectors from ${FIXTURE}: verdict, rates, burnout, grid, labels exact; summary to 4 s.f.; t_s ends; area mid every 50th sample`, ok, lines);
}

// 8. the rounding helper equals Python's f"{x:.{n}g}" (round-half-even on exact ties; toPrecision rounds ties up).
//    Expected values printed by Python 3 float(f"{v:.{n}g}"); they are test expectations, not site numbers.
{
  const cases = [[2.0625, 4, 2.062], [0.125, 2, 0.12], [20.625, 4, 20.62], [9.5625, 4, 9.562], [69.125, 4, 69.12],
    [124.3125, 6, 124.312], [183.8125, 6, 183.812], [1.0005, 4, 1.0], [123.45, 4, 123.5], [4726.0, 4, 4726.0]];
  const bad = cases.filter(([v, n, e]) => sig(v, n) !== e).map(([v, n, e]) => `sig(${v}, ${n}) = ${sig(v, n)}, Python ${e}`);
  report('8. sig() rounding equals Python format "g" on exact ties', bad.length === 0,
    bad.length ? bad : [`${cases.length} cases equal (plain toPrecision would give ${cases.filter(([v, n, e]) => Number(v.toPrecision(n)) !== e).length} wrong)`]);
}

console.log(`\n${results.filter(([, o]) => o).length}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);

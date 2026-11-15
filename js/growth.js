// M6b growth simulation, a line-by-line port of models/m6b-predictor/growth.py + predictor.py (spec: GROWTH_API.md).
// Pure: no DOM, no I/O, no randomness; importable by Node and by a module Worker.
// Every constant comes from data/spread_predictor.json -> "constants" (passed in as C). Nothing numeric is typed in here
// except the algorithm's own numbers, each copied from the Python reference:
//   default grid min(0.25 cm, L/200, W/4), 301 samples, the 1e-9 box/ceil tolerances, BIG = 1e150 and the 1e100 cut-off
//   (source: models/m6b-predictor/growth.py _grid, N_SAMPLES, _inv, _arrival; predictor.py in_box).
// Output rounding follows growth.py _sig: 4 s.f. for rates, burnout, areas and summary; 6 for dx, dy and t_s; 8 for t_abs_s.

export const VERDICTS = ['spreads', 'near observed extinction', 'observed no-spread'];   // codes 0, 1, 2 (predictor.py)
const SPREADS = 0, NEAR = 1, NO_SPREAD = 2;
const FABRICS = new Set(['SIBAL', 'cotton']);
const RUNS = ['lo', 'mid', 'hi'];
const N_SAMPLES = 301;
const BIG = 1e150;        // stands in for 1/0: BIG**2 = 1e300 stays finite, so 0 * BIG**2 = 0 keeps p = 0 exact
const DIRECTIONS = ['opposed', 'concurrent'];

export const LIMITS = 'Reduced-order model calibrated to NASA ISS data; not a reproduction of real spacecraft fires. ' +
  'Microgravity only. Says nothing about whether a material or atmosphere is safe.';

// ------------------------------------------------------------------ rounding (Python f"{x:.{n}g}", round-half-even on exact ties)
export function sig(x, n = 4) {
  if (x === null || x === undefined || !Number.isFinite(x)) return null;
  if (x === 0) return 0;
  let s = x.toPrecision(n);
  // toPrecision breaks exact decimal ties upward; Python breaks them to even. A double that sits exactly on a tie has a
  // short exact decimal expansion, so 100 exact digits are enough to see it.
  const full = Math.abs(x).toPrecision(100);
  const [mant] = full.split('e');
  const digits = mant.replace('.', '').replace(/^0+/, '');
  if (digits.length > n && digits[n] === '5' && /^0*$/.test(digits.slice(n + 1))) {
    const lastKept = Number(digits[n - 1]);
    if (lastKept % 2 === 0) {                     // round down to the even neighbour instead of up
      const e = Number(Math.abs(x).toExponential().split('e')[1]);
      const down = Math.abs(x) - 0.5 * 10 ** (e - n + 1);
      s = (Math.sign(x) * down).toPrecision(n);
    }
  }
  return Number(s);
}

function pyRepr(v) {
  if (v === undefined || v === null) return 'None';
  if (typeof v === 'string') return v.includes("'") && !v.includes('"') ? `"${v}"` : `'${v.replace(/'/g, "\\'")}'`;
  return String(v);
}

function unsupported(material) {
  return new Error(`material ${pyRepr(material)} is not modelled (PMMA, SIBAL, cotton)`);
}

function geometryClass(material, thicknessMm) {
  if (FABRICS.has(material)) return 'fabric';
  if (material === 'PMMA') return Number(thicknessMm) < 0.5 ? 'film' : 'slab';
  throw unsupported(material);
}

// ------------------------------------------------------------------ step 1: spread rates (predictor.py)
function o2MassFraction(x) { return 32.0 * x / (32.0 * x + 28.0 * (1.0 - x)); }

function flameCoefficient(o2, dr) {
  const tf21 = dr.T_v + dr.F_adb_21 * (dr.T_v - dr.T_inf);
  const tf = dr.T_inf + (tf21 - dr.T_inf) * o2MassFraction(o2 / 100.0) / o2MassFraction(0.21);
  return (tf - dr.T_v) / (dr.T_v - dr.T_inf);
}

function deRis(th, sides, u, o2, p, dr) {
  const F = flameCoefficient(o2, dr);
  const tau = sides === 2 ? th / 2.0 : th;
  const thin = dr.c_thin * F / (tau / 1000.0);
  const thick = dr.c_thick * (u / 100.0) * (F * F) * p;
  const regime = thin > thick ? 'thin' : 'thick';
  return { raw: Math.max(thin, thick) * 1000.0, regime, tau };
}

function inBox(box, vals) {
  for (const k of Object.keys(vals)) {
    const [lo, hi] = box[k];
    const v = Number(vals[k]);
    if (!(v >= lo - 1e-9 && v <= hi + 1e-9)) return false;
  }
  return true;
}

// Raw predictor rates (full precision). Mirrors predictor.spread_rates on one point; a direction with no data and no model
// carries null rates (PMMA concurrent in the thin regime is returned as null, as the frozen interface says).
function rawRates(material, th, sides, u, o2, p, C, areaDensity) {
  if (material === 'PMMA') {
    const dr = C.de_ris, op = C.opposed;
    const { raw, regime, tau } = deRis(th, sides, u, o2, p, dr);
    const mid = raw * (regime === 'thin' ? op.f_thin : op.f_thick);
    const lo = mid * Math.exp(op.log_range[0]), hi = mid * Math.exp(op.log_range[1]);
    const box = { tau_mm: tau, flow_cm_s: u, o2_vol_pct: o2, pressure_atm: p };
    const inDom = regime === 'thin' ? inBox(op.domain.thin, box) : inBox(op.domain.thick, box);
    const opposed = { lo, mid, hi, in_domain: inDom, calibration: 'calibrated' };
    let concurrent = null;
    if (regime === 'thick') {
      const cb = C.pmma_concurrent_bound;
      concurrent = { lo: cb.lo, mid: cb.mid, hi: cb.hi, calibration: 'observed bound',
        in_domain: inBox(cb.domain, { flow_cm_s: u, o2_vol_pct: o2, pressure_atm: p }) };
    }
    return { regime, raw_de_ris_mm_s: raw, tau_mm: tau, opposed, concurrent };
  }
  if (FABRICS.has(material)) {
    const cc = C.concurrent;
    const ad = areaDensity === undefined || areaDensity === null ? C.area_density[material] : areaDensity;
    const mid = cc.K * u * (o2 / 100.0) * Math.sqrt(p) * (cc.ref_area_density / ad) * 10.0;
    const lo = mid * Math.exp(cc.log_range[0]), hi = mid * Math.exp(cc.log_range[1]);
    const inDom = inBox(cc.domain, { flow_cm_s: u, o2_vol_pct: o2, pressure_atm: p, area_density: ad });
    return { regime: 'thin fabric', raw_de_ris_mm_s: null, tau_mm: null, area_density_mg_cm2: ad,
      opposed: { lo: null, mid: null, hi: null, in_domain: false, calibration: 'none' },
      concurrent: { lo, mid, hi, in_domain: inDom, calibration: 'calibrated' } };
  }
  throw unsupported(material);
}

function fuelDefaults(fuel) {
  return { material: fuel.material, th: Number(fuel.thickness_mm || 0.0), sides: Number(fuel.sides_burning === undefined ? 2 : fuel.sides_burning) };
}
function condDefaults(conditions) {
  return { u: Number(conditions.flow_cm_s), o2: Number(conditions.o2_vol_pct),
    p: Number(conditions.pressure_atm ?? 1.0), dir: Number(conditions.flow_direction_deg ?? 0.0) };
}

// Step-1 rates for one fuel and condition (mm/s, unrounded).
// → {regime, raw_de_ris_mm_s, opposed:{lo,mid,hi,in_domain,calibration}, concurrent:{…}|null}
export function spreadRates(fuel, conditions, C) {
  const { material, th, sides } = fuelDefaults(fuel);
  geometryClass(material, th);
  const { u, o2, p } = condDefaults(conditions);
  return rawRates(material, th, sides, u, o2, p, C, fuel.area_density_mg_cm2);
}

// ------------------------------------------------------------------ step 2: verdict (predictor.verdict + growth.overall_verdict)
function verdictOne(material, th, direction, u, o, C) {
  const geom = geometryClass(material, th);
  const mat = FABRICS.has(material) ? 'SIBAL' : material;   // cotton reuses the SIBAL cases (predictor.py)
  const v = C.verdict;
  let code = SPREADS;
  const matched = [];
  for (const c of v.cases) {
    if (c.material !== mat || c.geometry !== geom || c.flow_direction !== direction) continue;
    const ulo = c.flow_lo_cm_s, uhi = c.flow_hi_cm_s, olo = c.o2_lo_vol_pct, ohi = c.o2_hi_vol_pct;
    const obs = (o >= olo - v.o2_obs) && (o <= ohi + v.o2_obs) &&
      (u >= Math.max(0.0, ulo - Math.max(v.flow_obs_abs, v.flow_obs_rel * ulo))) &&
      (u <= uhi + Math.max(v.flow_obs_abs, v.flow_obs_rel * uhi));
    const near = (o >= olo - v.o2_near) && (o <= ohi + v.o2_near) &&
      (u >= Math.max(0.0, ulo / v.flow_near_factor - v.flow_obs_abs)) &&
      (u <= uhi * v.flow_near_factor + v.flow_obs_abs);
    const lvl = obs ? NO_SPREAD : near ? NEAR : SPREADS;
    if (lvl > 0) matched.push({ case_id: c.case_id, status: c.status, level: VERDICTS[lvl], outcome: c.outcome });
    code = Math.max(code, lvl);
  }
  return { code, matched };
}

// Worst verdict over the two flow directions. → {code, label, by_direction:{opposed, concurrent}, matched_cases}
export function verdict(fuel, conditions, C) {
  const th = Number(fuel.thickness_mm || 0.0);
  const u = Number(conditions.flow_cm_s), o = Number(conditions.o2_vol_pct);
  const out = { code: 0, label: VERDICTS[0], by_direction: {}, matched_cases: [] };
  for (const d of DIRECTIONS) {
    const { code, matched } = verdictOne(fuel.material, th, d, u, o, C);
    out.by_direction[d] = VERDICTS[code];
    for (const m of matched) out.matched_cases.push({ ...m, flow_direction: d });
    out.code = Math.max(out.code, code);
  }
  out.label = VERDICTS[out.code];
  return out;
}

// ------------------------------------------------------------------ rates with the null rules and their labels (growth.rates_for)
function ratesFor(fuel, conditions, C) {
  const { material: mat, th, sides } = fuelDefaults(fuel);
  const { u, o2, p } = condDefaults(conditions);
  const r = rawRates(mat, th, sides, u, o2, p, C, fuel.area_density_mg_cm2);
  const calibrated = [], extrapolated = [], assumed = [], notes = [];
  const rates = {};
  for (const run of RUNS) {
    let vo = r.opposed[run], vc = r.concurrent ? r.concurrent[run] : null;
    if (FABRICS.has(mat)) { if (vo === null) vo = 0.0; }
    else if (vc === null) vc = vo;                // thin-regime PMMA in concurrent flow: no data -> opposed rate
    rates[run] = { opposed: vo, concurrent: vc };
  }
  if (mat === 'PMMA') {
    const reg = r.regime;
    calibrated.push(`opposed (upwind) rate: de Ris x ${reg}-regime factor from 39 BASS-II slab rates`);
    if (r.opposed.in_domain) calibrated.push('opposed rate inside the calibration box');
    else extrapolated.push('opposed rate OUTSIDE the calibration box (thickness, flow, O2 or pressure)');
    if (reg === 'thick') {
      const txt = 'downwind rate: observed bound 0 to 0.167 mm/s (PSI-99 thick PMMA anchored at 20 cm/s, 22% O2)';
      if (r.concurrent.in_domain) calibrated.push(txt);
      else extrapolated.push(txt + ', used outside the observed condition');
    } else {
      assumed.push('downwind rate over thin-regime PMMA: no data; set equal to the opposed rate');
    }
  } else {
    calibrated.push('downwind (concurrent) rate: scaling law x one constant from 6 reported spacecraft flights');
    if (!r.concurrent.in_domain) {
      extrapolated.push('concurrent rate OUTSIDE the calibration box (flow 19-25 cm/s, O2 21.2-26.9%, 76-102 kPa)');
    }
    assumed.push('upwind (opposed) rate over fabric: no data and no model; set to 0, so upwind growth is not simulated');
  }
  assumed.push('cross-flow rate = mean of downwind and upwind rates (no data)');
  if (u === 0) assumed.push("zero flow: spread taken as isotropic at the opposed formula's zero-flow rate");
  return { rates, labels: { calibrated, extrapolated, assumed, notes } };
}

function burnoutTimes(fuel, C) {
  const b = C.burnout;
  if (FABRICS.has(fuel.material)) return { lo: b.fabric_s[0], mid: b.fabric_s[1], hi: b.fabric_s[2] };
  const th = Number(fuel.thickness_mm);
  const tau = Number(fuel.sides_burning === undefined ? 2 : fuel.sides_burning) === 2 ? th / 2.0 : th;
  const out = {};
  RUNS.forEach((run, k) => { out[run] = tau / b.pmma_regression_mm_s[k]; });
  return out;
}

// ------------------------------------------------------------------ step 0: droplets
export function dropletPointer(flameState) {
  return {
    status: 'model', flame_type: 'droplet', handled_by: 'M7',
    note: 'Droplet flames are not simulated by M6b. Droplet burnout follows the d-squared law: t_burnout = d0^2 / K. ' +
      "K (mm^2/s) comes from M7's burning-rate model (data/models.json id 'm7-burning-rate'); the chance the flame goes out " +
      "comes from 'm7-extinction', and whether it burns on invisibly from 'm7-cool-flame'. See GROWTH_API.md.",
    frame_time_s: flameState.frame_time_s ?? null, values: null,
  };
}

// ------------------------------------------------------------------ step 3: grid and initial region
function makeGrid(fuel, dxCm) {
  const L = Number(fuel.length_cm), W = Number(fuel.width_cm);
  if (dxCm === undefined || dxCm === null) dxCm = Math.min(0.25, L / 200.0, W / 4.0);
  const [dx, dy] = Array.isArray(dxCm) ? dxCm : [dxCm, dxCm];
  const nx = Math.max(1, Math.ceil(L / dx - 1e-9)), ny = Math.max(1, Math.ceil(W / dy - 1e-9));
  const dxx = L / nx, dyy = W / ny;
  const xc = new Float64Array(nx), yc = new Float64Array(ny);
  for (let i = 0; i < nx; i++) xc[i] = (i + 0.5) * dxx;
  for (let j = 0; j < ny; j++) yc[j] = (j + 0.5) * dyy;
  return { nx, ny, dxx, dyy, xc, yc };
}

function searchsortedLeft(arr, v) {          // first index with arr[i] >= v
  let lo = 0, hi = arr.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m] < v) lo = m + 1; else hi = m; }
  return lo;
}
function upperBound(arr, v) {                // numpy searchsorted(side='right'): first index with arr[i] > v
  let lo = 0, hi = arr.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m] <= v) lo = m + 1; else hi = m; }
  return lo;
}

function initialMask(g, flame) {
  const [x0, y0, x1, y1] = flame.bbox_cm.map(Number);
  const [cx, cy] = flame.centroid_cm.map(Number);
  const area = Number(flame.area_cm2);
  const a = Math.max((x1 - x0) / 2.0, 1e-9), b = Math.max((y1 - y0) / 2.0, 1e-9);
  const s = Math.sqrt(Math.max(area, 0.0) / (Math.PI * a * b));
  const sa = s * a, sb = s * b;
  const { nx, ny, xc, yc } = g;
  const m = new Uint8Array(nx * ny);          // index i * ny + j (i along x, j along y), as numpy (nx, ny)
  let any = false;
  for (let i = 0; i < nx; i++) {
    const ex = (xc[i] - cx) / sa, ex2 = ex * ex;
    for (let j = 0; j < ny; j++) {
      const ey = (yc[j] - cy) / sb;
      if (ex2 + ey * ey <= 1.0) { m[i * ny + j] = 1; any = true; }
    }
  }
  if (!any) {
    const i = Math.min(Math.max(searchsortedLeft(xc, cx), 0), nx - 1);
    const j = Math.min(Math.max(searchsortedLeft(yc, cy), 0), ny - 1);
    m[i * ny + j] = 1;
  }
  return m;
}

function boundaryCells(m, nx, ny) {
  const out = [];
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
    const k = i * ny + j;
    if (!m[k]) continue;
    const interior = i > 0 && m[k - ny] && i < nx - 1 && m[k + ny] && j > 0 && m[k - 1] && j < ny - 1 && m[k + 1];
    if (!interior) out.push(k);
  }
  return out;
}

const inv = (v) => (v > 0 ? 1.0 / v : BIG);

// ------------------------------------------------------------------ step 4: arrival times (growth._arrival)
function arrival(g, init, ux, uy, shapes) {
  const { nx, ny, xc, yc } = g;
  const n = nx * ny;
  const ts = shapes.map(() => {
    const t = new Float64Array(n).fill(Infinity);
    for (let k = 0; k < n; k++) if (init[k]) t[k] = 0.0;
    return t;
  });
  const live = [];
  shapes.forEach(([vc, vo, vs], k) => { if (Math.max(vc, vo, vs) > 0) live.push(k); });
  let allInit = true;
  for (let k = 0; k < n; k++) if (!init[k]) { allInit = false; break; }
  if (!live.length || allInit) return ts;
  const src = boundaryCells(init, nx, ny);
  const ns = src.length;
  const sp = new Float64Array(ns), sq = new Float64Array(ns);
  src.forEach((k, s) => {
    const sx = xc[Math.floor(k / ny)], sy = yc[k % ny];
    sp[s] = sx * ux + sy * uy; sq[s] = sx * uy - sy * ux;
  });
  const coef = live.map((k) => {
    const ic = inv(shapes[k][0]), io = inv(shapes[k][1]), iv = inv(shapes[k][2]);
    return [ic * ic, io * io, iv * iv];
  });
  const nl = live.length;
  const best = new Float64Array(nl);
  for (let i = 0; i < nx; i++) {
    const tx = xc[i];
    for (let j = 0; j < ny; j++) {
      const k = i * ny + j;
      if (init[k]) continue;
      const ty = yc[j];
      const tp = tx * ux + ty * uy, tq = tx * uy - ty * ux;
      best.fill(Infinity);
      for (let s = 0; s < ns; s++) {
        const p = tp - sp[s];
        const dq = tq - sq[s];
        const q2 = dq * dq;
        const p2 = p * p;
        const pos = p > 0;
        for (let l = 0; l < nl; l++) {
          const c = coef[l];
          const g2 = p2 * (pos ? c[0] : c[1]) + q2 * c[2];
          if (g2 < best[l]) best[l] = g2;
        }
      }
      for (let l = 0; l < nl; l++) {
        const gg = Math.sqrt(best[l]);
        ts[live[l]][k] = gg < 1e100 ? gg : Infinity;
      }
    }
  }
  return ts;
}

// ------------------------------------------------------------------ step 5: burnout, area and summary
function sortedFinite(ta) {
  const s = [];
  for (let k = 0; k < ta.length; k++) if (Number.isFinite(ta[k])) s.push(ta[k]);
  return Float64Array.from(s).sort();
}

// Burning area (cm2) at each time in `times`, from sorted finite arrival times (growth._area_curve).
export function areaCurve(sorted, tb, cellArea, times) {
  return times.map((t) => (upperBound(sorted, t) - upperBound(sorted, t - tb)) * cellArea);
}

function summarise(sorted, tb, cellArea, stopReason) {
  if (sorted.length === 0) {
    return { max_area_cm2: 0.0, t_max_s: 0.0, t_end_s: 0.0, area_consumed_cm2: 0.0, stop_reason: stopReason };
  }
  let bestA = -Infinity, bestT = 0;
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] === sorted[i - 1]) continue;          // np.unique
    const ev = sorted[i];
    const a = (upperBound(sorted, ev) - upperBound(sorted, ev - tb)) * cellArea;
    if (a > bestA) { bestA = a; bestT = ev; }                    // first argmax
  }
  return { max_area_cm2: bestA, t_max_s: bestT, t_end_s: sorted[sorted.length - 1] + tb,
    area_consumed_cm2: sorted.length * cellArea, stop_reason: stopReason };
}

function linspace(start, stop, num) {          // numpy.linspace with endpoint=True
  const out = new Array(num);
  const div = num - 1;
  const step = (stop - start) / div;
  for (let i = 0; i < num; i++) out[i] = i * step + start;
  if (num > 1) out[num - 1] = stop;
  return out;
}

// ------------------------------------------------------------------ the simulation (growth.simulate)
// opts.dxCm: number | [dx, dy]; opts.nSamples (default 301); opts.internals: true attaches the unrounded arrival
// times (_arrays, sorted finite per run), burnout (_tb) and cell area (_cell) for checks. These are not part of the output.
export function simulateGrowth(flameState, fuel, conditions, C, opts = {}) {
  if ((flameState.flame_type ?? 'surface') === 'droplet') return dropletPointer(flameState);
  geometryClass(fuel.material, fuel.thickness_mm || 0.0);          // throws for unmodelled materials
  const nSamples = opts.nSamples ?? N_SAMPLES;
  const g = makeGrid(fuel, opts.dxCm);
  const cell = g.dxx * g.dyy;
  const init = initialMask(g, flameState);
  let nInit = 0;
  for (let k = 0; k < init.length; k++) nInit += init[k];
  const v = verdict(fuel, conditions, C);
  const { rates, labels } = ratesFor(fuel, conditions, C);
  const tbs = burnoutTimes(fuel, C);
  const u = Number(conditions.flow_cm_s);
  const ang = Number(conditions.flow_direction_deg ?? 0.0) * (Math.PI / 180.0);
  const ux = Math.cos(ang), uy = Math.sin(ang);
  const shapes = [];
  for (const run of RUNS) {
    const vo = rates[run].opposed;
    let vc = rates[run].concurrent;
    if (u === 0) vc = vo;                                          // isotropic
    const vs = (vc + vo) / 2.0;
    rates[run].cross_flow = vs;
    shapes.push([vc / 10.0, vo / 10.0, vs / 10.0]);                // mm/s -> cm/s
  }
  let tas;
  if (v.code === NO_SPREAD) {
    tas = RUNS.map(() => { const t = new Float64Array(init.length); for (let k = 0; k < t.length; k++) t[k] = init[k] ? 0.0 : Infinity; return t; });
  } else {
    tas = arrival(g, init, ux, uy, shapes);
  }
  const runs = {};
  RUNS.forEach((run, k) => {
    const ta = tas[k];
    let reason;
    if (v.code === NO_SPREAD) reason = 'observed no-spread conditions';
    else reason = ta.every(Number.isFinite) ? 'fuel edge' : 'burned out';
    const sorted = sortedFinite(ta);
    runs[run] = { sorted, tb: tbs[run], reason, summary: summarise(sorted, tbs[run], cell, reason) };
  });
  const tEnd = Math.max(...RUNS.map((r) => runs[r].summary.t_end_s));
  const times = tEnd > 0 ? linspace(0.0, tEnd, nSamples) : [0.0];
  const t0 = Number(flameState.frame_time_s || 0.0);
  const rateOut = {};
  for (const run of RUNS) {
    rateOut[run] = { opposed: sig(rates[run].opposed), concurrent: sig(rates[run].concurrent), cross_flow: sig(rates[run].cross_flow) };
  }
  const out = {
    status: 'model', flame_type: 'surface',
    units: { time: 's', area: 'cm2', rate: 'mm/s', length: 'cm' },
    verdict: v,
    rates_mm_s: rateOut,
    burnout_s: { lo: sig(tbs.lo), mid: sig(tbs.mid), hi: sig(tbs.hi) },
    grid: { dx_cm: sig(g.dxx, 6), dy_cm: sig(g.dyy, 6), nx: g.nx, ny: g.ny, initial_area_cm2: sig(nInit * cell) },
    t_s: times.map((x) => sig(x, 6)),
    t_abs_s: times.map((x) => sig(t0 + x, 8)),
    area_cm2: {}, summary: {},
    calibrated: labels.calibrated, extrapolated: labels.extrapolated, assumed: labels.assumed, notes: labels.notes,
    limits: LIMITS,
  };
  for (const run of RUNS) {
    const r = runs[run];
    out.area_cm2[run] = areaCurve(r.sorted, r.tb, cell, times).map((a) => sig(a));
    const s = r.summary;
    out.summary[run] = { max_area_cm2: sig(s.max_area_cm2), t_max_s: sig(s.t_max_s), t_end_s: sig(s.t_end_s),
      area_consumed_cm2: sig(s.area_consumed_cm2), stop_reason: s.stop_reason };
  }
  if (opts.internals) {
    Object.defineProperty(out, '_internals', { enumerable: false, value: {
      sorted: Object.fromEntries(RUNS.map((r) => [r, runs[r].sorted])), tb: tbs, cell,
      times, cells: g.nx * g.ny, nInit, sources: v.code === NO_SPREAD ? 0 : boundaryCells(init, g.nx, g.ny).length } });
  }
  return out;
}

// Work estimate for one call: (non-initial cells) x (boundary cells) x 3 runs, without running the front.
export function growthCost(flameState, fuel, opts = {}) {
  if ((flameState.flame_type ?? 'surface') === 'droplet') return 0;
  const g = makeGrid(fuel, opts.dxCm);
  const init = initialMask(g, flameState);
  let nInit = 0;
  for (let k = 0; k < init.length; k++) nInit += init[k];
  return (init.length - nInit) * boundaryCells(init, g.nx, g.ny).length * 3;
}

# Growth simulation API (JavaScript port spec)

The reference implementation is `models/m6b-predictor/growth.py` plus `predictor.py`, which are pure functions with no file I/O. This page specifies the same function in JavaScript terms so a teammate can port it to the site. Every constant comes from `data/spread_predictor.json` → `constants` (called `C` below). Nothing is hard-coded except the algorithm.

## Signature

```js
// Returns the object described under "Output". Pure: no I/O, no randomness.
function simulateGrowth(flameState, fuel, conditions, C, opts = {}) { ... }
// opts.dxCm: number | [dx, dy] (default min(0.25, L/200, W/4) cm); opts.nSamples: default 301
```

**Inputs** (shapes in `CONTRACT_PROPOSAL.md`):
- `flameState`: `{flame_type, frame_time_s, area_cm2, centroid_cm:[x,y], bbox_cm:[x0,y0,x1,y1]}`, in fuel coordinates (cm).
- `fuel`: `{material, width_cm, length_cm, thickness_mm, sides_burning, area_density_mg_cm2?}`.
- `conditions`: `{flow_cm_s, flow_direction_deg, o2_vol_pct, pressure_atm}`.

## Step 0: droplets

If `flame_type === "droplet"`, return the pointer below. M6b does not simulate droplets.

```js
{status: "model", flame_type: "droplet", handled_by: "M7", values: null,
 note: "t_burnout = d0^2 / K (d-squared law). K from M7 'm7-burning-rate'; extinction chance from 'm7-extinction'; invisible cool-flame burning from 'm7-cool-flame'."}
```

**Which M7 values the site should call:**
- **Burnout time.** `t_burnout_s = d0_mm² / K_mm2_s`, where `d0_mm` is `flameState.droplet.diameter_mm`.
- **K.** M7's burning-rate model: the d² law × ridge correction, entry `m7-burning-rate` in `data/models.json`. Its held-out MAE is 0.052 mm²/s and its point range is ×0.72 to ×1.38 (M7 `results.json` → `burning_rate.point_interval_log_resid`).
- **Extinction.** The chance the flame goes out comes from `m7-extinction`. Whether it keeps burning invisibly as a cool flame comes from `m7-cool-flame`. **Do not** treat a visible flame going out as the fire being out.
- **Gap.** M7 currently publishes scores and observed-vs-predicted points, not a callable K(conditions) or P(extinction | conditions) table. The site therefore cannot compute a droplet burnout for new conditions until the M7 owner exports one (for example a `droplet_predictor.json` with K, lo and hi by fuel, O2, pressure and diluent). Until then, show the pointer text and no number. **M6b does not fill this gap with its own numbers.**

## Step 1: spread rates (`predictor.spread_rates`)

**Material PMMA.**

```
F(o2)  = (Tf - Tv)/(Tv - Tinf), with Tf = Tinf + (Tf21 - Tinf) * w(o2)/w(21), Tf21 = Tv + F_adb_21 (Tv - Tinf),
         w(x) = 32 x / (32 x + 28 (1 - x)), x = o2/100
tau_mm = thickness/2 if sides==2 else thickness
thin   = c_thin  * F / (tau_mm/1000)                   [m/s]
thick  = c_thick * (U/100) * F^2 * pressure_atm         [m/s]
regime = thin > thick ? "thin" : "thick";  raw = max(thin, thick) * 1000   [mm/s]
```

- **Opposed.**
  - `mid = raw * (regime=="thin" ? C.opposed.f_thin : C.opposed.f_thick)`.
  - `lo = mid * exp(C.opposed.log_range[0])` and `hi = mid * exp(C.opposed.log_range[1])`.
  - `in_domain`: (tau_mm, U, o2, pressure) all inside `C.opposed.domain[regime]` (inclusive).
- **Concurrent.**
  - Thick regime: `lo, mid, hi = C.pmma_concurrent_bound.{lo, mid, hi}`, label "observed bound", in domain inside `C.pmma_concurrent_bound.domain`.
  - Thin regime: `null`.

**Material SIBAL or cotton.**

- **Concurrent:**
  ```
  ad  = fuel.area_density_mg_cm2 ?? C.area_density[material]
  mid = C.concurrent.K * U * (o2/100) * sqrt(pressure_atm) * (C.concurrent.ref_area_density / ad) * 10   [mm/s]
  lo, hi = mid * exp(C.concurrent.log_range[0|1])
  ```
  `in_domain`: (U, o2, pressure, ad) inside `C.concurrent.domain`.
- **Opposed:** `null`.

**Lo / mid / hi.** Compute all three for opposed and concurrent. Then apply the null rules:
- fabric opposed `null` → 0;
- PMMA concurrent `null` → the opposed rate of the same run.

**Zero flow.** If `U === 0`, set concurrent = opposed (isotropic).

**Cross-flow rate.** `vs = (vc + vo)/2` per run.

## Step 2: verdict (`predictor.verdict`, per flow direction)

**Geometry.** `fabric` for SIBAL or cotton; for PMMA, `film` if thickness < 0.5 mm, else `slab`. Cotton uses the SIBAL cases.

**Boxes.** For each case in `C.verdict.cases` with the same material, geometry and flow direction:

```
obs  = o2 in [o2_lo - o2_obs, o2_hi + o2_obs]  &&
       U  in [max(0, flow_lo - max(flow_obs_abs, flow_obs_rel*flow_lo)), flow_hi + max(flow_obs_abs, flow_obs_rel*flow_hi)]
near = o2 in [o2_lo - o2_near, o2_hi + o2_near] &&
       U  in [max(0, flow_lo/flow_near_factor - flow_obs_abs), flow_hi*flow_near_factor + flow_obs_abs]
level = obs ? 2 : near ? 1 : 0
```

**Codes.** The verdict per direction is the maximum level over its cases. The overall verdict is the maximum over the two directions. Codes: 0 "spreads", 1 "near observed extinction", 2 "observed no-spread". Keep the matched case ids and their `status` (real or reported) for display.

## Step 3: grid and initial region

- **Grid.**
  - `nx = ceil(L/dx - 1e-9)`, `ny = ceil(W/dy - 1e-9)`;
  - cell size `L/nx × W/ny`;
  - cell centres `x_i = (i + 0.5) L/nx`, `y_j = (j + 0.5) W/ny`.
- **Initial burning cells.** Inside the ellipse centred on `centroid_cm`, with semi-axes `a = (x1-x0)/2`, `b = (y1-y0)/2` scaled by `s = sqrt(area/(π a b))`. If none fall inside, use the centroid's cell.

## Step 4: arrival times (the front)

- **Flow axes.** `ux = cos(dir)`, `uy = sin(dir)` (dir in radians, from `flow_direction_deg`).
- **Coordinates.** For each cell: `p = x*ux + y*uy` (along the flow), `q = x*uy - y*ux` (across).
- **Rates.** Convert mm/s to cm/s (÷10).
- **Arrival time:**
  ```
  t(cell) = min over boundary initial cells s of sqrt( (Δp / (Δp > 0 ? vc : vo))^2 + (Δq / vs)^2 )
  ```
  - A zero rate makes any non-zero displacement in that half unreachable (`Infinity`).
  - Initial cells have t = 0.
  - Boundary initial cells are initial cells with at least one 4-neighbour that is not initial (the grid outside counts as not initial).
- **Observed no-spread verdict.** Skip this step: every non-initial cell has t = Infinity.

This is exact Huygens propagation for the convex two-half-ellipse spread shape on a rectangle. It needs no time stepping and has no numerical diffusion. The front at time t is `{cells : arrival ≤ t}`.

## Step 5: burnout and area

- **Burnout time `tb`** (per run lo, mid, hi):
  - fabric: `C.burnout.fabric_s[k]`;
  - PMMA: `tau_mm / C.burnout.pmma_regression_mm_s[k]`.
- **Burning area at time t:**
  ```
  (#cells with arrival <= t  -  #cells with arrival <= t - tb) * cellArea
  ```
  Use sorted arrival times and binary search.
- **Summary per run:**
  - `max_area_cm2` and `t_max_s`: evaluate at every distinct finite arrival time; the area can rise only at an ignition.
  - `t_end_s = max finite arrival + tb`.
  - `area_consumed_cm2 = #finite cells × cellArea`.
  - `stop_reason`: "observed no-spread conditions" if verdict 2; else "fuel edge" if every cell has a finite arrival; else "burned out".
- **Sampling.** Sample `t_s` evenly from 0 to the largest `t_end_s` of the three runs (`nSamples` points). `t_abs_s = frame_time_s + t_s`.

## Output

```js
{status: "model", flame_type: "surface", units: {time: "s", area: "cm2", rate: "mm/s", length: "cm"},
 verdict: {code, label, by_direction: {opposed, concurrent}, matched_cases: [{case_id, status, level, outcome, flow_direction}]},
 rates_mm_s: {lo: {opposed, concurrent, cross_flow}, mid: {...}, hi: {...}}, burnout_s: {lo, mid, hi},
 grid: {dx_cm, dy_cm, nx, ny, initial_area_cm2},
 t_s: [...], t_abs_s: [...], area_cm2: {lo: [...], mid: [...], hi: [...]},
 summary: {lo|mid|hi: {max_area_cm2, t_max_s, t_end_s, area_consumed_cm2, stop_reason}},
 calibrated: [text], extrapolated: [text], assumed: [text], limits: text}
```

**What to show.** Always show the `extrapolated` and `assumed` lists next to the curve. A value outside the calibration box must not be presented as validated.

## Test vectors

`data/growth_examples.json` holds three worked examples with their exact inputs and outputs. A port is correct when it reproduces their `summary` numbers to 4 significant figures with the default grid.

## Performance

The Python version takes about 0.1–2 s per call for fuels up to 40 × 100 cm. In JS, run it in a Web Worker for large fuels, or pass a coarser `opts.dxCm`.

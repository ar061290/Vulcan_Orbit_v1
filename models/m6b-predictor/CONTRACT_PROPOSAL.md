# M6b contract proposal (for the team lead)

M6b adds two `data/` files and needs one shape agreed with the CV teammate. `CONTRACT.md` is **not** edited by M6b. The rows below are proposed for its table; the files are already written in these shapes with `status: "model"`. If the lead changes a shape, `build.py` changes with it.

## Proposed rows for `CONTRACT.md`

| File | Owner | Shape |
|---|---|---|
| `spread_predictor.json` | M6b | `{status:"model", what, units:{rate:"mm/s", flow:"cm/s", o2:"vol%", pressure:"atm", thickness:"mm"}, pressure_atm, flow_cm_s:[...], o2_vol_pct:[...], layout, verdict_codes:{"0":"spreads","1":"near observed extinction","2":"observed no-spread"}, verdict_meaning, scores:{...}, cases:[{id, material, fuel, thickness_mm, sides_burning, flow_direction, rate_mm_s:[[o2][flow]], lo:[[..]], hi:[[..]], verdict:[[0|1|2]], in_domain:[[0|1]], calibration:[["calibrated"|"observed bound"|"none"]], regime:[[..]], note}], constants:{...}, sources:[{label, doi|url}], limits}` |
| `growth_examples.json` | M6b | `{status:"model", what, units:{time:"s", area:"cm2", rate:"mm/s", length:"cm"}, area_meaning, examples:[{id, title, why, inputs:{flame_state, fuel, conditions}, verdict:{code, label, by_direction, matched_cases}, rates_mm_s:{lo,mid,hi:{opposed, concurrent, cross_flow}}, burnout_s:{lo,mid,hi}, grid:{dx_cm, dy_cm, nx, ny, initial_area_cm2}, t_s:[...], t_abs_s:[...], area_cm2:{lo:[...], mid:[...], hi:[...]}, summary:{lo|mid|hi:{max_area_cm2, t_max_s, t_end_s, area_consumed_cm2, stop_reason}}, calibrated:[text], extrapolated:[text], assumed:[text], limits}], limits}` |

### Notes on `spread_predictor.json`

- **Grid.** Every 2-D array is indexed `[o2 index][flow index]` over `o2_vol_pct` (15–35, step 1) and `flow_cm_s` (0–50, step 2), at `pressure_atm` = 1.
- **Nulls.** `null` means no data and no model. Example: SIBAL in opposed flow.
- **`in_domain: 0`** means the value is an extrapolation outside the calibration box. The site should grey such cells out or label them, never show them as validated.
- **`calibration`.**
  - `calibrated`: fitted on NASA data.
  - `observed bound`: thick PMMA downstream, from one PSI-99 observation.
  - `none`: no rate.
- **`constants`** holds everything the growth function needs (calibration factors, ranges, domain boxes, burnout values, the observed no-spread cases and the verdict tolerances). The site can then run `growth.simulate` in JavaScript without this repo's Python (see `GROWTH_API.md`).
- **Size.** About 0.1–0.2 MB; `build.py` asserts it stays under 1 MB.

### Notes on `growth_examples.json`

- **Area.** `area_cm2` is the projected area of one face of the fuel that is burning: ignited and not yet burned out.
- **Runs.**
  - `lo` = low spread rate with fast burnout;
  - `hi` = high spread rate with slow burnout;
  - so lo–hi is an envelope, not a confidence interval.
- **Stop reason.** `summary.*.stop_reason` is one of `"fuel edge"`, `"burned out"` or `"observed no-spread conditions"`.

## Proposed shape for the CV model's output (the "flame state")

The growth simulation reads one object per analysed camera frame. Proposed for the CV teammate:

```json
{
  "status": "model",
  "frame_time_s": 12.4,
  "flame_type": "surface",
  "area_cm2": 2.5,
  "centroid_cm": [0.25, 2.5],
  "bbox_cm": [0.0, 0.0, 0.5, 5.0],
  "coordinates": "fuel",
  "confidence": 0.0,
  "droplet": null
}
```

The numbers above are layout placeholders, not data.

| Field | Meaning | Unit |
|---|---|---|
| `frame_time_s` | time stamp of the frame | s (same clock as the video) |
| `flame_type` | `"surface"` (flame on a solid: sheet, fabric, slab) or `"droplet"` | – |
| `area_cm2` | visible flame area projected on the fuel surface | cm² |
| `centroid_cm` | flame centroid `[x, y]` | cm |
| `bbox_cm` | `[x0, y0, x1, y1]`, axis-aligned box around the flame | cm |
| `coordinates` | must be `"fuel"`: x along the fuel's length from its edge at x = 0, y across its width from y = 0. The CV model maps pixels to these coordinates with the fuel's known size (or a fiducial). | – |
| `confidence` | CV model confidence, 0–1 (not used by the growth simulation; passed through to risk) | – |
| `droplet` | for `flame_type: "droplet"` only: `{"diameter_mm": d0}` (initial or current droplet diameter); else `null` | mm |

The fuel and the conditions are **not** in the flame state. They come from the scene set-up or the user:

```
fuel       = {material: "PMMA"|"SIBAL"|"cotton", width_cm, length_cm, thickness_mm, sides_burning: 1|2, area_density_mg_cm2 (fabric, optional)}
conditions = {flow_cm_s, flow_direction_deg (direction the air moves, in fuel coordinates, 0 = +x), o2_vol_pct, pressure_atm}
```

## What M6b does not change

- `CONTRACT.md`.
- `js/`.
- M6's files and M6's `models.json` entry.
- Other features' outputs.

The two new manifest lines (`spread_predictor`, `growth_examples`) are added by `build.py`. A site panel to show these files does not exist yet; adding one is a `js/pages/` change for the team to agree.

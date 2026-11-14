# Data contract

The site is static. Every panel reads one JSON file from `data/`. To fill a panel, write the file in the shape below and commit it. No code change is needed.

Rules
- Every file has `"status"`: `real` (NASA data we downloaded), `dome` (measured on our rig), `model` (simulation output), `reported` (from a paper or another team, not yet checked by us), `demo` (placeholder), `plan`, `team`.
- When you add or replace a file, update its line in `data/manifest.json`. The banner and the Evidence page read from it.
- Never ship `demo` data in the submission. The banner at the top counts what is left.
- Units go in the file (`"units": "cm"`), never assumed.

| File | Owner | Shape |
|---|---|---|
| `dome_locator.json` | Mukund | `{status:"dome", units:"cm", method, points:[{true:[x,y,z], pred:[x,y,z]}]}` |
| `dome_sensor_count.json` | Mukund | `{status:"dome", units:"cm", series:[{name, points:[[n_sensors, mean_error]]}]}` |
| `response_trials.json` | Mukund | `{status:"dome", reading, unit, trials:[{method, source, before, after, repeat, note}]}` |
| `drift.json` | Mukund | `{status:"model", nx, ny, dt_s, flow_m_s, detectors:[{x,y,name}], frames:[[nx*ny values]]}` |
| `saffire_latency.json` | Karthikeya | `{status, y_meaning, burns:[{name, t:[s], channels:[{key, name, values:[multiple of alarm threshold], alarm_s}]}]}` |
| `smoke_sizes.json` | Karthikeya | `{status, source, detector_thresholds_nm:[...], materials:[{name, d_nm}]}` |
| `models.json` | Karthikeya | `{status, models:[{id, name, question, data, method, validation, metric, score, score_range:[lo,hi], baseline_name, baseline_score, unit, points:[{obs,pred,lo,hi,label}], drivers:[{name,share}], limits}]}` |
| `efield.json` | Karthikeya | `{status, finding, source, rows:[{...}]}` |
| `flex_suppression.json` | Karthikeya | `{status, source, groups:[{gas, tests, extinguished}]}` |
| `gaps.json` | Karthikeya | `{status, verdicts:[{text, source}]}` |
| `investigations.json` | Dashboard | `{status, items:[{id, name, psi, doi, facility, focus, fuel, measured, rows, tags:[...]}]}` |
| `ranking_weights.json` | Team | `{missions:{id:label}, weights:{mission:{tag:weight}}}` |
| `evidence.json` | Evidence | `{checks:[{id, what, ref, limit, owner, result, state:"pending"|"pass"|"fail"}]}` |
| `assistant_cache.json` | Assistant | `{items:[{q, a, sources:[{label,url}], kind:"answer"|"refusal"}]}` |

# Site v2 contract proposal (for the team lead)

Written by the lead agent for the site rebuild (plan `site/REBUILD_PLAN.md` §5 step 7). `CONTRACT.md` is **not** edited by the site. The rows below are proposals for the team to agree; until then the site reads these files defensively and shows "No data yet" when one is missing.

Shapes use the same notation as `CONTRACT.md`. No example numbers are given: every number in these files must come from a dataset, a model run or a measurement (AGENTS.md hard rule 1).

Status of this file: phases 3 to 6. The four new data files now exist (P3-A: `risk_rules`, `cv_example`; P5-F: `earth_apps`; P5-G: `i18n`), and the rows in §1 give the shapes as written. If a builder changes a shape, the lead updates the row here in the same phase commit.

## 1. Four new data files (allowed by the spec)

| File | Owner | Status | Shape |
|---|---|---|---|
| `risk_rules.json` | Team (written by P3-A) | `team` | `{status:"team", approved:false, what, units:{time:"s", area:"cm2"}, test_grammar, values:{<name>: meaning}, rules:[{id, level:"Low"\|"Elevated"\|"High"\|null, label, test:[{a, op, b}\|{a, op, value}], reason}], default:{id, level, label, reason}}`. `op` is one of `== != > >= < <=`; `a` and `b` name entries in `values` (computed by `assess_core.riskParts`, for example `t_max_hi_abs_s` and `smoke_slowest_s`); `value` is a fixed category value (`kind`, `verdict_code`), never a threshold number. Every condition in `test` must hold. Rules are evaluated in file order and the first match fires (`assess_core.riskLevel`); if a value a rule needs is missing, the chain stops and `default` fires, naming the missing value, so a missing file never yields a lower level. Rule R0 (no growth run) has `level:null`. The site prints "Rules are a team choice, to be approved" until `approved` is `true`. |
| `cv_example.json` | Dashboard (written by P3-A) | `demo` | The flame-state shape of §2 below, copied value for value from growth example 1's `inputs.flame_state` (`sibal_concurrent_panel`) in `data/growth_examples.json`, with `confidence:null`, `droplet:null`, `coordinates:"fuel"`, plus `status`, `what`, `source`, `example_id` and `units:{time:"s", area:"cm2", length:"cm"}`. Used only by the "Try an example camera reading" button, which is stamped Demo. It passes `store.applyFlameState()`. |
| `earth_apps.json` | Team (written by P5-F) | `team` | `{status:"team", what, units:{note}, cards:[{id, title, status, sub, text:[item], short:[item], links:[{label, page, fig?}], sources:[{label, doi\|url}]}]}`, where an item is `{h}` (heading), `{t}` (team text), `{ref:{file, path}, unit?}`, `{table}` or `{trial}` (the bench mist trial rows, when they exist). Numbers appear **only** as `ref` items, resolved at run time against `data/<file>.json`, and each ref carries the unit from that file's own `units` block; an unresolved ref prints no number and names the file it waits for. A card carrying text from a paper or a news report sets its own `status:"reported"` and lists the source (also in `REFERENCES.md`). All three cards are `team` today. |
| `i18n.json` | Team (written by P5-G) | `team` | `{status:"team", reviewed:false, what, drafted, how, languages:{en, te, hi}, scope, strings:{<key>:{en, te, hi}}}`. Each entry keeps the English it translates in `en`; templates use `{var}` placeholders filled from the same computed values as the English (`js/facts.js` `vars`), so no number is typed into a translation. A translation is shown only while its `en`, filled with the same numbers, still equals the English the page prints; otherwise the page falls back to English. `reviewed` becomes `true` only when a Telugu and a Hindi speaker on the team have checked every string. |

Manifest lines (appended by the data steward with `json.dumps(m, indent=1, ensure_ascii=False)`, as `scripts/build_crosscheck.py` writes it):

| name | status | owner | what |
|---|---|---|---|
| risk_rules | team | Team | Assess risk rules (team choice, to be approved) |
| cv_example | demo | Dashboard | Example camera reading for the Assess button: a copy of growth example 1's flame state |
| earth_apps | team | Team | On Earth cards linking site findings to Earth uses |
| i18n | team | Team | Telugu and Hindi strings for the Home short answer and India card (draft until reviewed) |

## 2. The camera output: `cv_latest.json` (CV owner)

The site reads `data/cv_latest.json` if it exists (Assess "Load from camera", Bench rig "Camera reading now"). When it is added, it **must** also get a manifest line in the same commit: since phase 3 the site (`lib.load` and `assess_core.loadCv`) does not fetch a data file that the manifest does not list, or lists as `missing`. For example `{name:"cv_latest", status:"model", owner:"<CV owner>", what:"Latest camera reading from the CV model"}`.

Base shape: the flame state proposed in `models/m6b-predictor/CONTRACT_PROPOSAL.md`, unchanged:

```
{status:"model"|"dome", frame_time_s, flame_type:"surface"|"droplet", area_cm2, centroid_cm:[x, y], bbox_cm:[x0, y0, x1, y1],
 coordinates:"fuel", confidence:0..1|null, droplet:{diameter_mm}|null}
```

`js/store.js` `applyFlameState()` accepts exactly this shape. It rejects the whole object (never fills it partially) unless `coordinates === "fuel"`, `flame_type` is one of the two values, and every number present is finite. The fuel and the cabin conditions are not part of it.

### 2.1 Optional dome-output fields (plan v2 §2.1)

Plan v2 §2.1 says the dome's outputs are fuel source, flame volume and distance from the sensor. Proposed as optional, nullable fields on `cv_latest.json`. They are information only: the growth simulation does not read them.

| Field | Meaning | Unit | Nullable |
|---|---|---|---|
| `fuel_source` | what the CV model thinks is burning, as free text or one of the growth materials (`"PMMA"`, `"SIBAL"`, `"cotton"`) | none | yes |
| `flame_volume_cm3` | flame volume estimated from the camera and the depth model | cm³ | yes |
| `distance_from_sensor_cm` | distance from the camera (depth model) to the flame centroid | cm | yes |

The Bench rig card "Camera reading now" prints each field only when present; an absent or `null` field reads "Not in the camera file yet".

### 2.2 Proposed smoke-flow field (information only)

```
smoke_flow: {speed_mm_s, direction_deg, frame_time_s, status} | null
```

| Field | Meaning | Unit |
|---|---|---|
| `speed_mm_s` | smoke speed measured by the optical-flow sensor | mm/s |
| `direction_deg` | direction the smoke moves, in fuel coordinates (0 = +x, as `flow_direction_deg`) | degrees |
| `frame_time_s` | time stamp of the frame pair used | s (same clock as `frame_time_s` above) |
| `status` | `dome` when measured on the rig, `demo` for a placeholder | none |

Assess shows it as "Smoke flow at the dome" (spec C2 item 28). It is not a growth input and does not change the Assess cabin airflow.

## 3. A `scrapped` manifest status

Plan v2 scraps the thermopile locator and the ion-wind trial. The site keeps the scrapped list in one constant (`js/overlays.js` `SCRAPPED`, `approved:false` until the human approves it) and never counts those files as "still to come".

Proposal for `CONTRACT.md`: add `scrapped` to the status list, meaning "a planned output dropped by a recorded plan change; the manifest line is kept so the history is visible, and no data file is expected". Manifest lines `dome_locator` and `dome_sensor_count` would then carry `status:"scrapped"`.

This also needs a change to `scripts/check_data.py`, which the site may not make:
- add `"scrapped"` to `OK`;
- treat a `scrapped` line like `missing` in the "manifest lists X but data/X.json is missing" check.

Until both changes land, the site leaves the manifest as it is and shows `badge('scrapped')` from the `SCRAPPED` constant only when `approved` is `true`.

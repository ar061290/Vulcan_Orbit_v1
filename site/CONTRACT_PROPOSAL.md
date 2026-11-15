# Site v2 contract proposal (for the team lead)

Written by the lead agent for the site rebuild (plan `site/REBUILD_PLAN.md` §5 step 7). `CONTRACT.md` is **not** edited by the site. The rows below are proposals for the team to agree; until then the site reads these files defensively and shows "No data yet" when one is missing.

Shapes use the same notation as `CONTRACT.md`. No example numbers are given: every number in these files must come from a dataset, a model run or a measurement (AGENTS.md hard rule 1).

Status of this file: phase 1+2. The four new data files are written in phase 3 (P3-A: `risk_rules`, `cv_example`) and phase 5 (P5-F: `earth_apps`, P5-G: `i18n`). If a builder changes a shape, the lead updates the row here in the same phase commit.

## 1. Four new data files (allowed by the spec)

| File | Owner | Status | Shape |
|---|---|---|---|
| `risk_rules.json` | Team (written by P3-A) | `team` | `{status:"team", approved:false, what, units:{time:"s"}, default:{level:"Low"\|"Elevated"\|"High", reason}, rules:[{id, level, test, reason}]}`. `rules` are evaluated in file order and the first match fires (`assess_core.riskLevel`). `test` compares computed values with each other where possible (for example the hi-run time of maximum area against the slowest cabin smoke-detector alarm); a fixed threshold is allowed only when there is no alternative, and its `reason` must say it is a team choice. The site prints "Rules are a team choice, to be approved" until `approved` is `true`. The exact `test` grammar is P3-A's to finalise. |
| `cv_example.json` | Dashboard (written by P3-A) | `demo` | The flame-state shape of §2 below, copied from growth example 1's `inputs.flame_state` in `data/growth_examples.json`, with `confidence:null`, `droplet:null`, `coordinates:"fuel"`. Used only by the "Try an example camera reading" button, which is stamped Demo. |
| `earth_apps.json` | Team (written by P5-F) | `team` | `{status:"team", what, cards:[{id, title, status, text:[{t}\|{ref:{file, path}, unit?}], links:[{label, href}], sources:[{label, doi\|url}]}]}`. Numbers appear **only** as `{ref:{file, path}}` items, resolved at run time against `data/<file>.json`; a card with no ref shows no number. A card carrying text from a paper or a news report sets its own `status:"reported"` and lists the source (also added to `REFERENCES.md`). |
| `i18n.json` | Team (written by P5-G) | `team` | `{status:"team", reviewed:false, what, langs:{te:{<key>: template}, hi:{<key>: template}}}`. Templates use `{var}` placeholders filled from the same computed values as the English text (`js/facts.js`), so no number is typed into a translation. `reviewed` becomes `true` only when a native speaker on the team has checked the strings. |

Manifest lines (appended by the data steward with `json.dumps(m, indent=1, ensure_ascii=False)`, as `scripts/build_crosscheck.py` writes it):

| name | status | owner | what |
|---|---|---|---|
| risk_rules | team | Team | Assess risk rules (team choice, to be approved) |
| cv_example | demo | Dashboard | Example camera reading for the Assess button: a copy of growth example 1's flame state |
| earth_apps | team | Team | On Earth cards linking site findings to Earth uses |
| i18n | team | Team | Telugu and Hindi strings for the Home short answer and India card (draft until reviewed) |

## 2. The camera output: `cv_latest.json` (CV owner)

The site reads `data/cv_latest.json` if it exists (Assess "Load from camera", Bench rig "Camera reading now"). When it is added, it also needs a manifest line, for example `{name:"cv_latest", status:"model", owner:"<CV owner>", what:"Latest camera reading from the CV model"}`.

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

# Plan coverage

Spec C10: every item in plan v2 (`Vulcan_Orbit_Plan_v2.md`) has a place on the site, with one of four statuses:

- **done**: built and on the page named here;
- **pending data**: the place is built, and shows a pending or empty state until a data file exists (no number is made up meanwhile);
- **planned**: not built yet, on purpose (waits for the team or a later phase);
- **scrapped**: removed in plan v2, or a plan v2 "Skip".

Package P7-E wrote this table by hand from plan v2, the spec (Part C) and `site/REBUILD_PLAN.md` §3. `site/tools/made_check.mjs` checks it against a crawl of the built site. In the Check column:

- `title:"…"` means a figure card (or the page heading) with that exact title renders on the page.
- `text:"…"` means that phrase appears in the rendered text, labels or Ask answers.
- `sel:"…"` means that CSS selector matches inside the page.
- `shell:"…"` means that phrase appears in the header, the More menu, the banner or the footer.
- `absent:"…"` means that phrase appears on no route.
- `@route` sets the page when it is not the first page in the Page column.

Every check runs with every fold opened and every disclosure button pressed. A **done** row needs at least one check, and each of its figure titles must also appear in the reached list of `site/REACH.md` (P7-C's reachability crawl, which starts at Home and only clicks). The results, the C9 model-folder check, the wording grep and the ranges list are generated below the hand-written tables.

Rebuild the generated sections with these commands (they need the playwright package outside the repo, and the thermal lock on this machine):

```
PW_DIR=<folder with node_modules/playwright-core> node site/tools/made_check.mjs --out /tmp/vo_made_check.json --write
node site/tools/ranges_check.mjs --from /tmp/vo_made_check.json --write
```

## 1. The product and the MVP (plan v2 §1 and §2)

| ID | Item | Page | Figure | Status | Check | Notes |
|---|---|---|---|---|---|---|
| MVP-1 | Pipeline: CV model → growth simulation → risk assessment (§1) | #/overview, #/assess | From camera to risk | done | title:"From camera to risk" title:"Risk: the parts and the rule that fired"@assess | Each of the four steps links to its page: Bench rig, Assess, the Assess risk figure and Put it out (C8) |
| MVP-2 | Locate: CV model for flame size and position, with a depth model and a fire-detection model (§2.1) | #/locate | Bench rig: camera; CV detection rate and size error; Depth: distance from the sensor | pending data | title:"Bench rig: camera" title:"CV detection rate and size error" title:"Depth: distance from the sensor" | The plain-words explainer is built. The results wait on the CV owner's files. No accuracy is shown until it is measured (plan v2 §10) |
| MVP-3 | Dome outputs: fuel source, flame volume and distance from the sensor (§2.1) | #/locate, #/assess | Camera reading now; Load from camera | pending data | title:"Camera reading now" text:"Not in the camera file yet" title:"Load from camera"@assess text:"Camera model not connected yet: using the sliders"@assess | `data/cv_latest.json` does not exist yet. The optional field names are proposed in site/CONTRACT_PROPOSAL.md |
| MVP-4 | NASA link: Saffire as the sparse-sensor problem the dome emulates (§2.1) | #/detect | Blind Spot: who alarms first?; Replay an orbital fire | done | title:"Blind Spot: who alarms first?" title:"Replay an orbital fire" | |
| MVP-5 | Predict: spread and extinction models, grouped validation, prediction ranges (§2.2) | #/predict | Droplet flame goes out (FLEX); Flame spread over PMMA slabs (BASS-II); M6b spread predictor: score and calibration box | done | title:"Droplet flame goes out (FLEX)" title:"Flame spread over PMMA slabs (BASS-II)" title:"M6b spread predictor: score and calibration box" | See the ranges list below for the predictions whose files carry no range |
| MVP-6 | Predict: smoke drift on a grid, labelled a model and not validated fluid dynamics (§2.2) | #/predict | Where the smoke goes | done | title:"Where the smoke goes" text:"Screening model, not a full fluid-dynamics simulation" | |
| MVP-7 | Also built: growth simulation M6b (§2.2) | #/assess, #/predict | Burning area over time; How big does it get, and when does it stop? | done | title:"Burning area over time" title:"How big does it get, and when does it stop?"@predict | Runs `js/growth.js`, the port tested by `tests/growth.test.mjs` |
| MVP-8 | Also built: flame simulation stages 1 to 3 at 0 g, Moon, Mars and 1 g (§2.2) | #/flame | Flame simulator; How fast flame crosses a solid; A fire growing across a sample | done | title:"Flame simulator" title:"How fast flame crosses a solid" title:"A fire growing across a sample" text:"Show Moon and Mars (model only)" | Moon and Mars appear only behind the model-only switch (row 30) |
| MVP-9 | Also built: second smoke-drift model (LBM) with 524 what-if runs (§2.2) | #/predict | Second opinion: a cabin with racks; What if the fire starts somewhere else? (cabin with racks) | done | title:"Second opinion: a cabin with racks" title:"What if the fire starts somewhere else? (cabin with racks)" | |
| MVP-10 | Respond: ion wind (§2.3) | none | none | scrapped | absent:"ion wind" absent:"ion-wind" | Removed in plan v2: the high-voltage supply's interference. js/overlays.js removes it from the text shown |
| MVP-11 | Respond: fine water mist, optional (§2.3) | #/respond, #/locate | Bench mist trial | pending data | title:"Bench mist trial" text:"Bench mist trial: not completed." title:"Bench mist trial"@locate | Shown as not completed until `data/response_trials.json` has status `dome` (C6) |
| MVP-12 | Ultrasound aimed at the flame: "park this" (§2.3) | none | none | scrapped | absent:"ultrasound aimed" | Parked in plan v2, so there is no site text |
| MVP-13 | Respond done means: one filmed mist trial, measured by the dome's own sensors (§2.3) | #/respond | Bench mist trial | pending data | text:"Bench mist trial: not completed." | |
| MVP-14 | Finish line: the dome reads sensors and logs to a file (§2.4) | #/locate | Camera reading now | pending data | title:"Camera reading now" | |
| MVP-15 | Finish line: the CV model returns the flame's size and position (§2.4) | #/locate | CV detection rate and size error | pending data | title:"CV detection rate and size error" | |
| MVP-16 | Finish line: one spread or extinction model trained on a NASA table, with ranges (§2.4) | #/predict | Droplet flame goes out (FLEX) | done | title:"Droplet flame goes out (FLEX)" | |
| MVP-17 | Finish line: one response trial filmed and measured (§2.4) | #/respond | Bench mist trial | pending data | title:"Bench mist trial" | |
| MVP-18 | Finish line: dashboard on a public link, with the NASA investigations and the three stages in real numbers (§2.4) | #/explorer, #/overview | Find and rank | done | title:"Find and rank" shell:"Find it"@overview shell:"Predict it"@overview shell:"Put it out"@overview | The live public link is main. This branch goes live only when the lead merges it (agents never push) |

## 2. Baseline features B1 to B10 (plan v2 §3)

| ID | Item | Page | Figure | Status | Check | Notes |
|---|---|---|---|---|---|---|
| B1 | Explorer of PSI investigations with search and filters, in the top menu | #/explorer | Find and rank | done | title:"Find and rank" text:"Matches the name, what it measured, the fuel and the facility." shell:"NASA experiments"@explorer | |
| B2 | Ranking by mission: station, lunar base, Mars base, rover, suit | #/explorer | Find and rank | done | text:"Lunar base" text:"Mars base" text:"Pressurised rover" text:"Spacesuit" text:"This is relevance weighting, not a prediction" | The weights come from `data/ranking_weights.json` |
| B3 | Attributes per investigation: the fields `investigations.json` holds, plus the tested O₂ and pressure range from `gaps.json` | #/explorer | Find and rank (expand row) | done | sel:"button.xp-x[aria-expanded]" text:"show all attributes" | The tested range is matched by PSI id (REBUILD_PLAN §3.9) |
| B3-gap | Attributes not in our data: goals, sample shape, variables | #/explorer | Find and rank (expand row) | pending data | text:"Not in our table yet" | Each one shows "Not in our table yet". The gap list is in site/DECISIONS.md for the data owner |
| B4 | Side-by-side comparison of investigations | #/explorer | Find and rank | done | text:"Compare" sel:"button[aria-pressed]" | At most 2, chosen with a keyboard-reachable `aria-pressed` button |
| B5 | Grouping by hardware family | #/explorer | Find and rank | done | text:"Group by hardware" text:"17 of 17 experiments map to a family" | The prefix rule is shown on the page |
| B6 | O₂ and pressure sliders, including the 34 % exploration atmosphere | #/assess, #/flame, #/respond | Flame now, fuel and cabin; Where a flame can survive; Response evidence for this fire | done | title:"Flame now, fuel and cabin" sel:"input[type=range]" title:"Where a flame can survive"@flame text:"34% O2 at 70.3 kPa"@respond | Assess bounds come from the data files (Q10) |
| B6-hr | samuelakosa "hidden-risk zone": out at 21 % O₂, burns at 34 % | #/flame | Where a flame can survive | done | text:"Hidden-risk band (model)" | Labelled "model" |
| B7 | A FLEX extinction or burning-rate model | #/predict, #/respond | Droplet flame goes out (FLEX); Droplet burning rate (FLEX); When does a droplet flame go out? | done | title:"Droplet flame goes out (FLEX)" title:"Droplet burning rate (FLEX)" title:"When does a droplet flame go out?"@respond | |
| B8 | An assistant that answers with citations | #/ask | Answer | done | title:"Answer" text:"Numbers from" | Static traced answers. The live mode is phase 8 (row A-4) |
| B9 | Earth applications: water mist, smoke detection, firefighter gear | #/earth | Water mist; Smoke detectors; Materials and firefighter gear | done | title:"Water mist" title:"Smoke detectors" title:"Materials and firefighter gear" | From `data/earth_apps.json` (status `team`). Numbers only as `{file, path}` references |
| B10 | Public link, English text, sources list, AI-use statement | #/about | NASA data used; Use of AI tools | done | title:"NASA data used" title:"NASA papers we checked numbers against" title:"Use of AI tools" | The AI-use text carries "Team to edit before submission" |

## 3. Features 1 to 31 (plan v2 §4 and the added 26 to 31)

| ID | Item | Page | Figure | Status | Check | Notes |
|---|---|---|---|---|---|---|
| 1 | Blind Spot timeline | #/detect | Blind Spot: who alarms first? | done | title:"Blind Spot: who alarms first?" | |
| 2 | Smoke miss map | #/detect | Smoke the detector misses | done | title:"Smoke the detector misses" | |
| 3 | Flicker test | none | none | scrapped | absent:"flicker test" | Removed in plan v2: the CV model replaced the thermopile array |
| 4 | Error vs sensor count | none | none | scrapped | absent:"More sensors, less error" | Removed in plan v2. The old panel is dropped (C5). Its file is on the proposed scrapped list (Q1, not yet approved) |
| 5 | Physics vs neural net locator | none | none | scrapped | absent:"Where the locator put the source" | Removed in plan v2. Checks E1 and E2 are proposed for scrapping (see C7-scrap) |
| 6 | Detector placement | #/predict, #/detect | What if the fire starts somewhere else? | done | title:"What if the fire starts somewhere else?" text:"Where should detectors go"@detect | Linked from Find it with a fold-aware figure link |
| 7 | Dust or smoke? | #/detect | Dust or smoke? Checking the counter first | done | title:"Dust or smoke? Checking the counter first" | |
| 8 | Smoke drift view | #/predict | Where the smoke goes | done | title:"Where the smoke goes" text:"Play" | Never autoplays |
| 9 | Spread predictor with baseline, plus a chart against airflow | #/predict | M6b spread predictor: score and calibration box; Spread rate against airflow: M6b vs de Ris; Will it spread, and how fast? | done | title:"M6b spread predictor: score and calibration box" title:"Spread rate against airflow: M6b vs de Ris" title:"Will it spread, and how fast?" | The chart is computed from `spreadRates()` in js/growth.js |
| 10 | Extinction predictor | #/predict, #/respond | Droplet flame goes out (FLEX); When does a droplet flame go out? | done | title:"Droplet flame goes out (FLEX)" title:"When does a droplet flame go out?"@respond | |
| 11 | Cool-flame warning | #/respond, #/predict | Looks out, still burning: cool flames; Burns on invisibly after the flame goes out (CFI) | done | title:"Looks out, still burning: cool flames" text:"Model 50% point" title:"Burns on invisibly after the flame goes out (CFI)"@predict | The 50 % pressure marker is drawn |
| 12 | Moon and Mars bounds | #/predict | Moon and Mars | done | title:"Moon and Mars" | Bounds only, with no value (the wording grep checks this) |
| 13 | Ranges on everything | every page | every model figure | pending data | text:"Every prediction carries a range"@predict | The site shows every range its files hold. The predictions whose model outputs carry no range are listed below, with the script that would have to add one (outside the site) |
| 14 | Evidence gap map | #/predict | What NASA has not tested | done | title:"What NASA has not tested" | |
| 14-next | AstraFlame "next experiment worth running" | #/predict | Next experiment worth running | done | title:"Next experiment worth running" text:"Team rule: the probed cabin atmosphere with the fewest NASA tests near it comes first." | Stamped as a team rule |
| 15 | Ion wind vs NASA | #/respond | NASA: flames in an electric field (context only) | scrapped | absent:"ion wind" title:"NASA: flames in an electric field"@respond | Removed in plan v2. The E-FIELD panel stays as NASA context only (Q8, default keep) |
| 16 | Ultrasonic mist trial (optional) | #/respond, #/locate | Bench mist trial | pending data | title:"Bench mist trial" text:"Bench mist trial: not completed." title:"Bench mist trial"@locate | |
| 17 | Suppressant comparison | #/respond | NASA: which gas puts a droplet flame out | done | title:"NASA: which gas puts a droplet flame out" text:"not a controlled comparison" text:"nitrogen only, no added suppressant" | |
| 18 | Response evidence card | #/respond | Response evidence for this fire | done | title:"Response evidence for this fire" text:"A summary of evidence, not a flight procedure" | Driven by the Assess store and the URL |
| 19 | Closed loop: the locator steers the mist | #/locate | Planned, not built | planned | title:"Planned, not built" text:"Closed loop" | Status `plan`, never shown as a result |
| 20 | Traced answers | #/ask | Answer | done | text:"Matched to" text:"Numbers from" text:"no NASA evidence" | |
| 21 | Assistant scorecard | #/ask | Assistant scorecard | done | title:"Assistant scorecard" | The plan says 30 questions. The counts shown are read from `data/assistant_gold.json`. The ion-wind question is scored but not listed, with a footnote (Q4) |
| 22 | Rules written first; a check shown failing on purpose | #/evidence, #/flame | Checks; Every check on the flame model | done | title:"Checks" text:"Failures stay on the page." title:"Every check on the flame model"@flame | |
| 23 | Model cards with "why" | #/models | M3 Smoke drift to Flame simulation (9 sections) | done | title:"M3 Smoke drift" title:"M4 Alarm timing" title:"M5 Smoke miss" title:"M6 Flame spread over PMMA slabs" title:"M6b Spread predictor and growth" title:"M7 Droplet flame goes out" title:"M7 Droplet burning rate" title:"M7 Cool flame" title:"Flame simulation" text:"Use it for" | Drivers read "not computed" where the file has none (M6b) |
| 23-cv | Model card: CV model and optical flow | #/models | CV model and optical flow | pending data | title:"CV model and optical flow" | |
| 24 | Saffire replay | #/detect | Replay an orbital fire | done | title:"Replay an orbital fire" text:"Time after ignition, s" | Home links to it with a fold-aware figure link |
| 25 | India angle, with Telugu and Hindi summaries | #/overview | Why this matters for India's own crew and station | done | title:"Why this matters for India's own crew and station" text:"తెలుగు" text:"हिन्दी" text:"Draft translation, not yet checked by a native speaker" | `reviewed:false` until a native speaker checks it (Q7) |
| 26 | What-if runs (Monte Carlo) | #/predict | What if the fire starts somewhere else? | done | title:"What if the fire starts somewhere else?" text:"4,000 simulated fires" | |
| 27 | CV flame size and position | #/locate, #/assess | Camera reading now; Load from camera | pending data | title:"Camera reading now" title:"Load from camera"@assess text:"Try an example camera reading"@assess | The example button reads `data/cv_example.json` (status `demo`) |
| 28 | Optical-flow smoke sensor | #/locate | Optical-flow smoke track | pending data | title:"Optical-flow smoke track" | "Smoke flow at the dome" shows on Assess only when `cv_latest.json` carries the proposed field |
| 29 | Growth simulation | #/assess | Burning area over time | done | title:"Burning area over time" title:"What is calibrated, extrapolated and assumed" | |
| 30 | Flame lab at 0 g, Moon, Mars and 1 g, behind a model-only switch | #/flame | Flame simulator; How fast flame crosses a solid; Where a flame can survive | done | text:"Show Moon and Mars (model only)" | made_check presses the switch and checks that the gravity note appears only then |
| 31 | Risk assessment | #/assess | Risk: the parts and the rule that fired | done | title:"Risk: the parts and the rule that fired" text:"Rules are a team choice, to be approved" | |

## 4. Ideas from other teams (plan v2 §5)

| ID | Item | Page | Figure | Status | Check | Notes |
|---|---|---|---|---|---|---|
| X-1 | AstraFlame: trained models with honest error ranges | #/predict | Droplet flame goes out (FLEX); M6b spread predictor: score and calibration box | done | title:"Droplet flame goes out (FLEX)" title:"M6b spread predictor: score and calibration box" | Features 9, 10 and 13 |
| X-2 | AstraFlame: habitat map at 34 % O₂ | #/flame | Where a flame can survive | done | title:"Where a flame can survive" | B6 |
| X-3 | AstraFlame: recommender for the next experiment | #/predict | Next experiment worth running | done | title:"Next experiment worth running" | Feature 14 |
| X-4 | AstraFlame: which inputs drove each prediction | #/models, #/predict | Model cards | done | text:"Drivers" text:"not computed" | Feature 23 |
| X-5 | AstraFlame ESP32 rig ("Beat": our rig also locates and responds) | #/locate | Bench rig: camera; Planned, not built | pending data | title:"Bench rig: camera" title:"Planned, not built" | The rig's response is shown only as the optional mist trial and the planned closed loop, so the site makes no claim that the rig responds |
| X-6 | SPICA: coverage verdicts | #/predict | What NASA has not tested | done | text:"Solid fuels (BASS-II): tested at" | From `gaps.json` `verdicts` |
| X-7 | SPICA: 3D glovebox view | none | none | scrapped | | Plan v2 verdict: Skip |
| X-8 | FlameAtlas: evidence cards with confidence and gap flags | #/respond | Response evidence for this fire | done | title:"Response evidence for this fire" text:"How much to trust it" | Features 18 and 20, plus the credibility strips |
| X-9 | FlameAtlas: flammability map | #/flame | Where a flame can survive | done | title:"Where a flame can survive" | B6 |
| X-10 | Faruk042: smoke-detector digital twin | #/detect, #/predict | Blind Spot: who alarms first?; What if the fire starts somewhere else? | done | title:"Blind Spot: who alarms first?" title:"What if the fire starts somewhere else?"@predict | Features 1 and 6 |
| X-11 | Faruk042: Monte Carlo what-if fires | #/predict | What if the fire starts somewhere else? | done | title:"What if the fire starts somewhere else?" | Feature 26 |
| X-12 | samuelakosa: hidden-risk zone | #/flame | Where a flame can survive | done | text:"Hidden-risk band (model)" | B6 |
| X-13 | samuelakosa: offline app with on-device Q&A | none | none | scrapped | | Plan v2 verdict: Skip (the saved answers cover reliability) |
| X-14 | AFAQ: pipeline over the whole PSI archive | none | none | scrapped | | Plan v2 verdict: Skip |
| X-15 | AFAQ: automated tests, "take a slice" | #/evidence | Checks | done | title:"Checks" | Feature 22 |
| X-16 | Fire-X: 3D-printed sensor enclosure | none | none | scrapped | | Plan v2 verdict: Skip |
| X-17 | Several: compare and network views | #/explorer | Find and rank | done | text:"Compare" | Comparison only. Plan v2 maps this to B4, and no network view was built |

## 5. Models and "Where the two meet" (plan v2 §6)

| ID | Item | Page | Figure | Status | Check | Notes |
|---|---|---|---|---|---|---|
| M-cv | CV model, depth model and fire-detection model (dome) | #/models, #/locate | CV model and optical flow | pending data | title:"CV model and optical flow" | |
| M-of | Optical-flow smoke reading (dome) | #/locate | Optical-flow smoke track | pending data | title:"Optical-flow smoke track" | |
| M-mist | Mist trial (dome, optional) | #/respond | Bench mist trial | pending data | title:"Bench mist trial" | |
| M3 | Smoke drift and what-if runs | #/models, #/predict | M3 Smoke drift | done | title:"M3 Smoke drift" title:"Where the smoke goes"@predict | Grid model (engine/) and LBM (models/m3-drift) |
| M4 | Detection latency (Saffire-III) | #/models, #/detect | M4 Alarm timing | done | title:"M4 Alarm timing" title:"Blind Spot: who alarms first?"@detect | |
| M5 | Smoke miss risk (SAME, SAME-R) | #/models, #/predict | M5 Smoke miss | done | title:"M5 Smoke miss" title:"Will the detector miss this smoke?"@predict | The card states that it failed its pass rule |
| M6 | Flame spread (BASS-II) | #/models, #/predict | M6 Flame spread over PMMA slabs | done | title:"M6 Flame spread over PMMA slabs" text:"3.5-fold"@predict | Leads with its findings and keeps the R² visible (C9) |
| M6b | Spread predictor and growth simulation | #/models, #/predict, #/assess | M6b Spread predictor and growth | done | title:"M6b Spread predictor and growth" title:"M6b spread predictor: score and calibration box"@predict | Read from its own files, not from models.json (C9) |
| M7 | Extinction, burning rate and cool flames (FLEX, CFI-G) | #/models, #/respond | M7 Droplet flame goes out; M7 Droplet burning rate; M7 Cool flame | done | title:"M7 Droplet flame goes out" title:"M7 Droplet burning rate" title:"M7 Cool flame" | |
| M-sim | Flame simulation | #/models, #/flame | Flame simulation | done | title:"Flame simulation" title:"Every check on the flame model"@flame | |
| M-meet | "Where the two meet": the bench result beside NASA's, never merged | #/respond | Reading the comparison | pending data | title:"Reading the comparison" text:"never merged" | Waits on the mist trial |
| M-results | "Results so far" table | #/models | Model cards | done | title:"Model cards" | Every number is read from the files and never copied from the plan. Disagreements with the plan go to site/REPORT.md (P5-C hand-back) |
| M-traps | Trap: no single "fire risk score" without a published formula | #/assess | Risk: the parts and the rule that fired | done | title:"Risk: the parts and the rule that fired" text:"every rule" | Shows the parts, the rule that fired and every rule evaluated |

## 6. The assistant (plan v2 §7)

| ID | Item | Page | Figure | Status | Check | Notes |
|---|---|---|---|---|---|---|
| A-1 | Library: NASA reports and PSI pages split into passages | #/ask | none | planned | | `data/kb.json` exists and is read only by the optional live mode (phase 8, H4) |
| A-2 | Rule: every number comes from a lookup; otherwise "no NASA evidence" | #/ask | Answer | done | text:"Numbers from" text:"no NASA evidence" | |
| A-3 | Scorecard of test questions | #/ask | Assistant scorecard | done | title:"Assistant scorecard" | |
| A-4 | Claude Haiku for live answers | #/ask | none | planned | | Phase 8. It happens only if the team gives a Worker URL (H4) |
| A-5 | API key kept in a Cloudflare Worker, never in the page | #/ask | How the assistant is kept honest | planned | text:"No language model writes answers at run time" | `worker/` is untouched. `assistant_config.endpoint` is null, so no call is made |
| A-6 | Never fails on stage: saved static answers | #/ask | Questions; Answer | done | title:"Questions" text:"No language model writes answers at run time" | |

## 7. Claims we must not make (plan v2 §10; AGENTS.md)

The wording grep below checks these on the rendered text of every route. Each row's evidence is the page's own disclaimer, or the phrase being absent everywhere.

| ID | Item | Page | Figure | Status | Check | Notes |
|---|---|---|---|---|---|---|
| N-1 | The rig does not detect or fight microgravity fires | #/locate | What this does and does not show | done | text:"it does not detect or fight fires in orbit" | |
| N-2 | No prediction for Moon or Mars gravity outside the Flame lab's model-only switch | #/flame | Flame simulator | done | text:"Show Moon and Mars (model only)" | The grep covers values outside #/flame, and values on #/flame before the switch is pressed |
| N-3 | Mist does not "work in space" because of a bench result | #/locate | What this does and does not show | done | text:"does not reproduce a microgravity flame" absent:"works in space" | |
| N-4 | No model certifies a material or atmosphere as safe | #/predict | Will it spread, and how fast? | done | text:"Nothing here says a material or atmosphere is safe." | Every safe or certif hit is listed in the wording grep |
| N-5 | No CV size or position accuracy we have not measured | #/locate | Depth: distance from the sensor | done | text:"no accuracy is shown until it is measured" | |
| N-6 | Station detectors do not "fail in general"; the weakness is very fine smoke from specific materials | #/earth | Smoke detectors | done | text:"very fine smoke from specific materials" | |
| N-7 | No "first ever" | every page | none | done | absent:"first ever" absent:"first-ever" | |

## 8. Spec Part C items (`site_rebuild_prompt.md`)

| ID | Item | Page | Figure | Status | Check | Notes |
|---|---|---|---|---|---|---|
| C1 | Growth simulation port plus a Node test | #/assess | Burning area over time | done | title:"Burning area over time" | `node tests/growth.test.mjs` is P2's acceptance (H2). The lead reruns it in phase 7 |
| C2 | Assess page: inputs, camera load, presets, live outputs, `model` stamp | #/assess | Flame now, fuel and cabin; Load from camera; Will it spread here?; Burning area over time; What is calibrated, extrapolated and assumed | done | title:"Flame now, fuel and cabin" title:"Load from camera" title:"Will it spread here?" title:"What is calibrated, extrapolated and assumed" text:"Values outside the calibration box are allowed and flagged." | Droplet input, the "not supported" text, the paste box and the URL round trip are P3-B's acceptance (keyboard run: P7-D) |
| C3 | Risk assessment with team rules | #/assess | Risk: the parts and the rule that fired | done | title:"Risk: the parts and the rule that fired" text:"Rules are a team choice, to be approved" text:"different fire" | The alarm markers say they come from a different fire, for scale (REBUILD_PLAN §7 item 12) |
| C4 | Response evidence card driven by the Assess store | #/respond | Response evidence for this fire | done | title:"Response evidence for this fire" text:"A summary of evidence, not a flight procedure" | |
| C5 | Bench rig rebuilt as a camera, with no thermopile panels | #/locate | Bench rig: camera | done | title:"Bench rig: camera" title:"What this does and does not show" absent:"thermopile" | The results are pending data (MVP-2, 27, 28) |
| C6 | Ion wind scrapped everywhere; E-FIELD kept as NASA context; mist optional | #/respond | NASA: flames in an electric field; Bench mist trial | done | absent:"ion wind" title:"NASA: flames in an electric field" text:"Bench mist trial: not completed." | |
| C7-e45 | Checks: E4 and E5 filled from the models' result files, with the source shown | #/evidence | Checks | done | text:"Pass: M6b held-out MAE" text:"Pass: AUC" | Display overlay in js/overlays.js. `evidence.json` is not edited |
| C7-scrap | Checks: E1, E2 and E8 shown as "Scrapped (see plan v2)"; the banner does not count scrapped files | #/evidence | Checks; Where each number comes from | planned | text:"Proposed for scrapping with the old bench rig" shell:"still to come"@evidence | Waits on the human (Q1: `SCRAPPED.approved` stays false). Until then the rows read "proposed for scrapping" and the banner uses the pre-approval wording |
| C7-cv | Checks: pending rows for the CV checks (owner Mukund) | #/evidence | Checks | done | text:"CV1" text:"CV2" text:"CV3" text:"OF1" | |
| C8 | Home pipeline strip; no Home text promising ion wind or the thermopile locator | #/overview | From camera to risk | done | title:"From camera to risk" | |
| C9 | Every models/ folder appears in a rendered "Made by" | every page | every figure | done | text:"models/m6b-predictor"@assess | The per-folder result is generated below |

<!-- made_check:start -->
Generated by `node site/tools/made_check.mjs --write` on 2026-11-15T09:53:14.368Z (15 routes, 97 figure cards, every fold opened).

### C9: every models/ folder in a rendered "Made by"

| Folder | Result | Rendered "Made by" blocks that name it | Also on Model cards |
|---|---|---|---|
| `models/flame-sim` | pass | #/flame "Flame simulator"; #/flame "Droplet burning rate vs NASA FLEX"; #/flame "How fast flame crosses a solid"; #/flame "Where a flame can survive"; #/flame "A fire growing across a sample"; #/flame "Every check on the flame model" and 2 more | #/models "Flame simulation" |
| `models/m3-drift` | pass | #/assess "Risk: the parts and the rule that fired"; #/predict "Second opinion: a cabin with racks"; #/predict "What if the fire starts somewhere else? (cabin with racks)"; #/evidence "Simulation checks" | #/models "M3 Smoke drift" |
| `models/m4-latency` | pass | #/detect "Replay an orbital fire"; #/detect "Would a "fast rise" alarm be quicker?"; #/detect "Does the alarm rule change the answer?"; #/detect "Blind Spot: who alarms first?"; #/assess "Burning area over time"; #/assess "Risk: the parts and the rule that fired" and 1 more | #/models "M4 Alarm timing" |
| `models/m5-smoke-miss` | pass | #/detect "Smoke the detector misses"; #/predict "Will the detector miss this smoke?"; #/evidence "Can you trust this?"; #/earth "Smoke detectors" | #/models "M5 Smoke miss" |
| `models/m6-spread` | pass | #/predict "M6b spread predictor: score and calibration box"; #/predict "Flame spread over PMMA slabs (BASS-II)"; #/evidence "Can you trust this?" | #/models "M6 Flame spread over PMMA slabs" |
| `models/m6b-predictor` | pass | #/assess "Flame now, fuel and cabin"; #/assess "Will it spread here?"; #/assess "Burning area over time"; #/assess "What is calibrated, extrapolated and assumed"; #/assess "Risk: the parts and the rule that fired"; #/predict "Will it spread, and how fast?" and 6 more | #/models "M6b Spread predictor and growth" |
| `models/m7-extinction` | pass | #/predict "Droplet flame goes out (FLEX)"; #/predict "Droplet burning rate (FLEX)"; #/predict "Burns on invisibly after the flame goes out (CFI)"; #/respond "Response evidence for this fire"; #/respond "When does a droplet flame go out?"; #/respond "Looks out, still burning: cool flames" and 3 more | #/models "M7 Droplet flame goes out"; #/models "M7 Droplet burning rate"; #/models "M7 Cool flame" |

### Charted figures with no "Made by" entry: 0

None. (#/models has `provenance:false` and is skipped, as §2.3 sets.)

### Wording grep (rendered text, labels and every Ask answer)

- Ion wind or thermopile: no hits.
- safe / certif / first ever: 17 hits, none affirmative.

| Page | Where | Hit | Sentence | Verdict |
|---|---|---|---|---|
| #/assess | What is calibrated, extrapolated and assumed | safe | Says nothing about whether a material or atmosphere is safe. | allowed: negation |
| #/predict | Will it spread, and how fast? | safe | 'spreads' only means no such case is near; it is not a claim that the fuel is flammable or that anything is safe. | allowed: negation |
| #/predict | Will it spread, and how fast? | safe | Nothing here says a material or atmosphere is safe. | allowed: negation |
| #/predict | Droplet flame goes out (FLEX) | safe | A low chance of extinction does not make an atmosphere safe, and nothing here applies to Moon or Mars gravity. | allowed: negation |
| #/predict | Will the detector miss this smoke? | certification | A test bench result in orbit, not a detector certification. | allowed: negation |
| #/predict | Flame spread over PMMA slabs (BASS-II) | safe | Microgravity only: nothing here applies to Moon or Mars gravity, and a slow spread rate does not make a material or atmosphere safe. | allowed: negation |
| #/ask | page text | safe | It refuses questions the data cannot answer, such as Moon or Mars predictions or whether something is "safe". | allowed: negation |
| #/ask | Assistant scorecard | safe | is a high oxygen cabin safe	refuse	refuse	Pass | allowed: Ask scorecard question |
| #/ask | Answer | safe | Matched to: Is a 34% oxygen cabin safe? | allowed: Ask question (refusal test) |
| #/ask | Answer | safe | We do not say whether any atmosphere or material is safe. | allowed: negation |
| #/models | M5 Smoke miss | certification | A test bench result in orbit, not a detector certification. | allowed: negation |
| #/models | M6 Flame spread over PMMA slabs | safe | Microgravity only: nothing here applies to Moon or Mars gravity, and a slow spread rate does not make a material or atmosphere safe. | allowed: negation |
| #/models | M6b Spread predictor and growth | safe | Values outside the marked range, other materials, other pressures, Moon or Mars, or calling a material safe. | allowed: "Not for" scope list |
| #/models | M6b Spread predictor and growth | safe | 'spreads' only means no such case is near; it is not a claim that the fuel is flammable or that anything is safe. | allowed: negation |
| #/models | M6b Spread predictor and growth | safe | Nothing here says a material or atmosphere is safe. | allowed: negation |
| #/models | M7 Droplet flame goes out | safe | Other fuels, sprays or pools, Moon or Mars gravity, or deciding that any cabin air is safe. | allowed: "Not for" scope list |
| #/models | M7 Droplet flame goes out | safe | A low chance of extinction does not make an atmosphere safe, and nothing here applies to Moon or Mars gravity. | allowed: negation |

- Moon or Mars value outside #/flame, or on #/flame before the switch is pressed (0.16 g, 0.38 g, the gravity_note text, a number next to Moon or Mars): no hits.
- Flame lab switch "Show Moon and Mars (model only)": off by default, gravity note shown not before the switch; after one press aria-pressed=true and the note is shown.

### Plan coverage evidence: 117 rows (84 done, 18 pending data, 5 planned, 10 scrapped); 111 with evidence checked, 0 failed

Every row's evidence is looked for in this crawl; a done row needs at least one check, and its figure titles must also appear in site/REACH.md's reached list.

No failures.

### Console errors: 0; stray null/undefined/NaN in card text: 0


### Figure cards with no status stamp: 0


### Issues: 0

None.
<!-- made_check:end -->

<!-- ranges_check:start -->
Generated by `node site/tools/ranges_check.mjs --write` on 2026-11-15T09:53:14.368Z. Data pass: 41 predictions in the registry; rendered pass: 27 model figures.

### Predictions shown without lo/hi: 17 of 37

| Prediction | File and field | Values | Without lo/hi | Shown on | Owner of the fix |
|---|---|---|---|---|---|
| Will the detector miss this smoke?: each held-out prediction | `data/models.json` models[id=smoke-miss].points[].pred → lo, hi | 16 | **16** (e.g. LAM-1: Lampwick, 0 cm/s, mass median 1493 nm) | #/predict "Will the detector miss this smoke?"; #/models "M5 Smoke miss" | models/m5-smoke-miss/build.py → data/models.json |
| Pressure at 50% cool-flame chance (the 3.22 atm marker) | `data/m7_explorer.json` cool_flame.pressure_at_half_atm | 1 | **1** (e.g. 3.22) | #/respond "Looks out, still burning: cool flames" | models/m7-extinction/build.py → data/m7_explorer.json |
| M6 finding "de Ris over-predicts about N-fold" (1 / median observed ÷ predicted) | `models/m6-spread/results.json` de_ris.median_obs_over_pred | 1 | **1** (e.g. 0.2849) | #/predict "Flame spread over PMMA slabs (BASS-II)"; #/models "M6 Flame spread over PMMA slabs" | models/m6-spread/build.py |
| Cabin what-if: share of fires caught within 60 s | `data/whatif.json` layouts[].caught_60 → caught_60_range | 4 | **4** (e.g. Ceiling, mid-cabin (Earth habit)) | #/predict "What if the fire starts somewhere else?"; #/assess "Risk: the parts and the rule that fired" | engine/drift.py → data/whatif.json |
| Cabin what-if: share of fires caught within 300 s | `data/whatif.json` layouts[].caught_300 → caught_300_range | 4 | **4** (e.g. Ceiling, mid-cabin (Earth habit)) | #/predict "What if the fire starts somewhere else?"; #/assess "Risk: the parts and the rule that fired" | engine/drift.py → data/whatif.json |
| Cabin what-if: median alarm time per layout | `data/whatif.json` layouts[].median_s | 4 | **4** (e.g. Ceiling, mid-cabin (Earth habit)) | #/predict "What if the fire starts somewhere else?" | engine/drift.py → data/whatif.json |
| Racks cabin (LBM) what-if: share caught by smoke release rate | `data/drift_whatif.json` by_rate[].best_caught_180, hero_caught_180 | 4 | **4** (e.g. 0.016666666666666666 mg/s) | #/predict "What if the fire starts somewhere else? (cabin with racks)" | models/m3-drift/build.py → data/drift_whatif.json |
| Where the smoke goes: model alarm time at each detector | `data/drift.json` detectors[].alarm_s | 2 | **2** (e.g. Ceiling, mid-cabin (Earth habit)) | #/predict "Where the smoke goes"; #/predict "Walk around the smoke (3D)" | engine/drift.py → data/drift.json |
| Second opinion: a cabin with racks: model alarm time at each detector | `data/drift_lbm.json` detectors[].alarm_s | 4 | **4** (e.g. Ceiling gap, mid-cabin) | #/predict "Second opinion: a cabin with racks" | models/m3-drift/build.py → data/drift_lbm.json |
| Flame sim: model droplet burning rate K beside each FLEX burn | `data/flame_static.json` flex_comparison[].K_model_mm2_s | 261 | **261** (e.g. 20CAL08) | #/flame "Droplet burning rate vs NASA FLEX" | models/flame-sim/build.py |
| Flame sim: flame temperature, shape, tilt and rise speed per case | `data/flame_static.json` flames[].{T_flame_K, aspect, tilt_deg_from_vertical, U_buoy_m_s} | 320 | **320** (e.g. methane 0 g) | #/flame "Flame simulator" | models/flame-sim/build.py |
| Flame sim: spread rate curves against airflow | `data/flame_spread.json` rates[].rate_mm_s[] | 48 | **48** (e.g. PMMA 0.1 mm 0 g) | #/flame "How fast flame crosses a solid" | models/flame-sim/build.py |
| Flame sim: model spread rate beside each BASS-II point | `data/flame_spread.json` bass_ii_comparison[].model_mm_s | 41 | **41** (e.g. M1) | #/flame "How fast flame crosses a solid" | models/flame-sim/build.py |
| Flame sim: lowest O₂ that burns on each survival map | `data/flame_spread.json` flammability_maps[].min_O2 | 8 | **8** (e.g. PMMA 100 um, two-sided 0 g 101.3 kPa) | #/flame "Where a flame can survive" | models/flame-sim/build.py |
| Flame sim: spread rate of each growing-fire case | `data/flame_spread.json` fronts[].spread_mm_s | 3 | **3** (e.g. PMMA 0.1 mm, 0 g, 21% O2, 101.3 kPa, 0.10 m/s opposed flow, sample 20 x 2 cm) | #/flame "A fire growing across a sample" | models/flame-sim/build.py |
| Share of smoke mass finer than the detector limit (our lognormal calculation) | `data/smoke_sizes.json` materials[].mass_below[thr].{unaged,aged} | 15 | **15** (e.g. Kapton) | #/detect "Smoke the detector misses" | models/m5-smoke-miss/build.py → data/smoke_sizes.json |
| "Can you trust this?" score per model | `data/trust.json` rows[].score → range | 8 | **3** (e.g. Will it spread, and how fast? (M6b); Where does the smoke go?; Would a fast-rise alarm be quicker?) | #/evidence "Can you trust this?" | scripts/build_trust.py → data/trust.json |
| Droplet flame goes out (FLEX): held-out AUC | `data/models.json` models[id=m7-extinction].score → score_range | 1 | 0 | #/predict "Droplet flame goes out (FLEX)"; #/models "M7 Droplet flame goes out" | - |
| Droplet flame goes out (FLEX): each held-out prediction | `data/models.json` models[id=m7-extinction].points[].pred → lo, hi | 260 | 0 | #/predict "Droplet flame goes out (FLEX)"; #/models "M7 Droplet flame goes out" | - |
| Droplet burning rate (FLEX): held-out MAE (mm²/s, lower is better) | `data/models.json` models[id=m7-burning-rate].score → score_range | 1 | 0 | #/predict "Droplet burning rate (FLEX)"; #/models "M7 Droplet burning rate" | - |
| Droplet burning rate (FLEX): each held-out prediction | `data/models.json` models[id=m7-burning-rate].points[].pred → lo, hi | 256 | 0 | #/predict "Droplet burning rate (FLEX)"; #/models "M7 Droplet burning rate" | - |
| Burns on invisibly after the flame goes out (CFI): held-out AUC | `data/models.json` models[id=m7-cool-flame].score → score_range | 1 | 0 | #/predict "Burns on invisibly after the flame goes out (CFI)"; #/models "M7 Cool flame" | - |
| Burns on invisibly after the flame goes out (CFI): each held-out prediction | `data/models.json` models[id=m7-cool-flame].points[].pred → lo, hi | 117 | 0 | #/predict "Burns on invisibly after the flame goes out (CFI)"; #/models "M7 Cool flame" | - |
| Will the detector miss this smoke?: held-out AUC | `data/models.json` models[id=smoke-miss].score → score_range | 1 | 0 | #/predict "Will the detector miss this smoke?"; #/models "M5 Smoke miss" | - |
| Flame spread over PMMA slabs (BASS-II): held-out R² (held-out sessions, spread rate in mm/s) | `data/models.json` models[id=m6].score → score_range | 1 | 0 | #/predict "Flame spread over PMMA slabs (BASS-II)"; #/models "M6 Flame spread over PMMA slabs" | - |
| Flame spread over PMMA slabs (BASS-II): each held-out prediction | `data/models.json` models[id=m6].points[].pred → lo, hi | 39 | 0 | #/predict "Flame spread over PMMA slabs (BASS-II)"; #/models "M6 Flame spread over PMMA slabs" | - |
| O₂ at 50% extinction chance, per fuel, pressure and added gas | `data/m7_explorer.json` extinction.table[].o2_half → o2_half_range | 12 | 0 | #/respond "When does a droplet flame go out?"; #/respond "NASA: which gas puts a droplet flame out"; #/respond "Response evidence for this fire" | - |
| M7 extinction: headline AUC | `data/m7_explorer.json` extinction.headline.auc_median → auc_session_bootstrap_95 | 1 | 0 | #/respond "When does a droplet flame go out?" | - |
| M7 cool flame: headline AUC | `data/m7_explorer.json` cool_flame.headline.auc_median → auc_session_bootstrap_95 | 1 | 0 | #/respond "Looks out, still burning: cool flames" | - |
| M6b spread rate on the O₂ × airflow grid | `data/spread_predictor.json` cases[].rate_mm_s[i][j] → lo[i][j], hi[i][j] | 3147 | 0 | #/predict "Will it spread, and how fast?"; #/predict "Spread rate against airflow: M6b vs de Ris" | - |
| M6b held-out MAE, raw de Ris and one-constant baseline | `models/m6b-predictor/results.json` opposed.mae_mm_s.{kept,B1_raw_de_ris,B2_one_constant} → mae_range_95 | 3 | 0 | #/predict "M6b spread predictor: score and calibration box"; #/evidence "Checks"; #/models "M6b Spread predictor and growth" | - |
| M6b predictions for the independent Saffire-II and film points | `models/m6b-predictor/results.json` independent.saffire2[].pred_mm_s, independent.film.pred_mm_s → lo, hi | 4 | 0 | #/predict "M6b spread predictor: score and calibration box" | - |
| Growth examples: max area, time to max, end time (and Assess, which runs the same code) | `data/growth_examples.json` examples[].summary.{lo,mid,hi} | 3 | 0 | #/predict "How big does it get, and when does it stop?"; #/assess "Burning area over time" | - |
| Cabin what-if: share of fires caught within 120 s | `data/whatif.json` layouts[].caught_120 → caught_120_range | 4 | 0 | #/predict "What if the fire starts somewhere else?"; #/assess "Risk: the parts and the rule that fired" | - |
| Racks cabin (LBM) what-if: share caught within 60 s | `data/drift_whatif.json` layouts[].caught_60 → caught_60_range | 3 | 0 | #/predict "What if the fire starts somewhere else? (cabin with racks)"; #/assess "Risk: the parts and the rule that fired" | - |
| Racks cabin (LBM) what-if: share caught within 180 s | `data/drift_whatif.json` layouts[].caught_180 → caught_180_range | 3 | 0 | #/predict "What if the fire starts somewhere else? (cabin with racks)"; #/assess "Risk: the parts and the rule that fired" | - |
| Smoke model peak time for the held-out puff | `data/drift_calibration.json` pulse.model_peak_s_range | 1 | 0 | #/predict "Checked against a real spacecraft fire" | - |

Baselines shown beside a score with no range of their own (a comparison, not a prediction; information only): Droplet flame goes out (FLEX): baseline (Best single input (oxygen)) (no range); Droplet burning rate (FLEX): baseline (d-squared law (one constant per fuel)) (no range); Burns on invisibly after the flame goes out (CFI): baseline (Best single input (pressure)) (no range); Flame spread over PMMA slabs (BASS-II): baseline (de Ris) (no range).

### Rendered model figures with no visible range: 9 of 27

A text heuristic, so read it by hand: a figure counts as showing a range when its own text (not its "Made by" block) has a [lo–hi] pair, "range of N", ±N, lo and hi columns, a lo–hi band or the slow, middle and fast runs (lo, mid, hi).

| Page | Figure | Made-by kind | Range seen |
|---|---|---|---|
| #/detect | Smoke the detector misses | Published NASA measurements + our calculation | **no** (owner: models/m5-smoke-miss/build.py → data/smoke_sizes.json (the file has no range: materials[].mass_below[thr].{unaged,aged})) |
| #/assess | Will it spread here? | Physics formula + calibration, run in your browser | exempt: a categorical verdict (spreads / near observed extinction / observed no-spread) with its matched NASA cases and the calibration-box table; the rates and areas with their ranges are on "Burning area over time" |
| #/assess | Burning area over time | Physics model run forward in time, in your browser | yes: "slow, middle and fast" |
| #/predict | Where the smoke goes | Physics model, tuned on one burn, not validated | **no** (owner: engine/drift.py → data/drift.json (the file has no range: detectors[].alarm_s)) |
| #/predict | What if the fire starts somewhere else? | Physics model, many runs | yes: "41 to 49% across" |
| #/predict | Walk around the smoke (3D) | Physics model, drawn in 3D | **no** (owner: engine/drift.py → data/drift.json (the file has no range: detectors[].alarm_s)) |
| #/predict | What actually decides if a fire is caught? | Physics model, many runs | yes: "1%–49%" |
| #/predict | Second opinion: a cabin with racks | Independent physics model, not trained | **no** (owner: models/m3-drift/build.py → data/drift_lbm.json (the file has no range: detectors[].alarm_s)) |
| #/predict | What if the fire starts somewhere else? (cabin with racks) | Independent physics model, many runs | yes: "low end SAME PSI-102; high" |
| #/predict | Will it spread, and how fast? | Physics formula + calibration (passed its pass rules) | yes: "[0.04–0.29]" |
| #/predict | How big does it get, and when does it stop? | Physics model run forward in time | yes: "Slow run (low rates) Middle run Fast run" |
| #/predict | M6b spread predictor: score and calibration box | Physics formula + calibration (passed its pass rules) | yes: "[0.015–0.023]" |
| #/predict | Spread rate against airflow: M6b vs de Ris | Physics formula + calibration, run in your browser | yes: "band: slow" |
| #/predict | Droplet flame goes out (FLEX) | Trained model | yes: "(0-1)" |
| #/predict | Droplet burning rate (FLEX) | Physics formula + trained correction | yes: "LOW	HIGH" |
| #/predict | Burns on invisibly after the flame goes out (CFI) | Trained model | yes: "(0-1)" |
| #/predict | Will the detector miss this smoke? | Trained model (failed its pass rule) | yes: "[0.53, 0.94]" |
| #/predict | Flame spread over PMMA slabs (BASS-II) | Physics formula + one fitted constant (missed its target) | yes: "LOW	HIGH" |
| #/respond | Response evidence for this fire | Summary of NASA data and model outputs for the fire on Assess | yes: "95% range" |
| #/respond | When does a droplet flame go out? | Trained model | yes: "(0.84–0.95)" |
| #/respond | Looks out, still burning: cool flames | NASA data + trained model | yes: "(0.70–0.92)" |
| #/flame | Flame simulator | Physics model, not trained | **no** (owner: models/flame-sim/build.py (the file has no range: flames[].{T_flame_K, aspect, tilt_deg_from_vertical, U_buoy_m_s})) |
| #/flame | Droplet burning rate vs NASA FLEX | Physics formula vs NASA data, not trained | **no** (owner: models/flame-sim/build.py (the file has no range: flex_comparison[].K_model_mm2_s)) |
| #/flame | How fast flame crosses a solid | Physics formula, not trained | **no** (owner: models/flame-sim/build.py (the file has no range: bass_ii_comparison[].model_mm_s)) |
| #/flame | Where a flame can survive | Physics formula, not trained | **no** (owner: models/flame-sim/build.py (the file has no range: flammability_maps[].min_O2)) |
| #/flame | A fire growing across a sample | Physics formula, not trained | **no** (owner: models/flame-sim/build.py (the file has no range: fronts[].spread_mm_s)) |
| #/locate | Camera reading now | Camera model output (pending) | yes: "[0.25, 2.5]" |

Of the 9 figures with no visible range, 0 are owned by a site module (the data has a range the figure does not show) and 9 by the script that writes the file (the file has no range to show; the site may not edit model outputs).

### Issues: 26

- Ranges: Will the detector miss this smoke?: each held-out prediction: 16 of 16 shown without lo/hi (models[id=smoke-miss].points[].pred → lo, hi; owner: models/m5-smoke-miss/build.py → data/models.json; shown on #/predict "Will the detector miss this smoke?", #/models "M5 Smoke miss")
- Ranges: Pressure at 50% cool-flame chance (the 3.22 atm marker): 1 of 1 shown without lo/hi (cool_flame.pressure_at_half_atm; owner: models/m7-extinction/build.py → data/m7_explorer.json; shown on #/respond "Looks out, still burning: cool flames")
- Ranges: M6 finding "de Ris over-predicts about N-fold" (1 / median observed ÷ predicted): 1 of 1 shown without lo/hi (de_ris.median_obs_over_pred; owner: models/m6-spread/build.py; shown on #/predict "Flame spread over PMMA slabs (BASS-II)", #/models "M6 Flame spread over PMMA slabs")
- Ranges: Cabin what-if: share of fires caught within 60 s: 4 of 4 shown without lo/hi (layouts[].caught_60 → caught_60_range; owner: engine/drift.py → data/whatif.json; shown on #/predict "What if the fire starts somewhere else?", #/assess "Risk: the parts and the rule that fired")
- Ranges: Cabin what-if: share of fires caught within 300 s: 4 of 4 shown without lo/hi (layouts[].caught_300 → caught_300_range; owner: engine/drift.py → data/whatif.json; shown on #/predict "What if the fire starts somewhere else?", #/assess "Risk: the parts and the rule that fired")
- Ranges: Cabin what-if: median alarm time per layout: 4 of 4 shown without lo/hi (layouts[].median_s; owner: engine/drift.py → data/whatif.json; shown on #/predict "What if the fire starts somewhere else?")
- Ranges: Racks cabin (LBM) what-if: share caught by smoke release rate: 4 of 4 shown without lo/hi (by_rate[].best_caught_180, hero_caught_180; owner: models/m3-drift/build.py → data/drift_whatif.json; shown on #/predict "What if the fire starts somewhere else? (cabin with racks)")
- Ranges: Where the smoke goes: model alarm time at each detector: 2 of 2 shown without lo/hi (detectors[].alarm_s; owner: engine/drift.py → data/drift.json; shown on #/predict "Where the smoke goes", #/predict "Walk around the smoke (3D)")
- Ranges: Second opinion: a cabin with racks: model alarm time at each detector: 4 of 4 shown without lo/hi (detectors[].alarm_s; owner: models/m3-drift/build.py → data/drift_lbm.json; shown on #/predict "Second opinion: a cabin with racks")
- Ranges: Flame sim: model droplet burning rate K beside each FLEX burn: 261 of 261 shown without lo/hi (flex_comparison[].K_model_mm2_s; owner: models/flame-sim/build.py; shown on #/flame "Droplet burning rate vs NASA FLEX")
- Ranges: Flame sim: flame temperature, shape, tilt and rise speed per case: 320 of 320 shown without lo/hi (flames[].{T_flame_K, aspect, tilt_deg_from_vertical, U_buoy_m_s}; owner: models/flame-sim/build.py; shown on #/flame "Flame simulator")
- Ranges: Flame sim: spread rate curves against airflow: 48 of 48 shown without lo/hi (rates[].rate_mm_s[]; owner: models/flame-sim/build.py; shown on #/flame "How fast flame crosses a solid")
- Ranges: Flame sim: model spread rate beside each BASS-II point: 41 of 41 shown without lo/hi (bass_ii_comparison[].model_mm_s; owner: models/flame-sim/build.py; shown on #/flame "How fast flame crosses a solid")
- Ranges: Flame sim: lowest O₂ that burns on each survival map: 8 of 8 shown without lo/hi (flammability_maps[].min_O2; owner: models/flame-sim/build.py; shown on #/flame "Where a flame can survive")
- Ranges: Flame sim: spread rate of each growing-fire case: 3 of 3 shown without lo/hi (fronts[].spread_mm_s; owner: models/flame-sim/build.py; shown on #/flame "A fire growing across a sample")
- Ranges: Share of smoke mass finer than the detector limit (our lognormal calculation): 15 of 15 shown without lo/hi (materials[].mass_below[thr].{unaged,aged}; owner: models/m5-smoke-miss/build.py → data/smoke_sizes.json; shown on #/detect "Smoke the detector misses")
- Ranges: "Can you trust this?" score per model: 3 of 8 shown without lo/hi (rows[].score → range; owner: scripts/build_trust.py → data/trust.json; shown on #/evidence "Can you trust this?")
- Ranges: model figure "Smoke the detector misses" on #/detect shows no range in its text or tables (owner: models/m5-smoke-miss/build.py → data/smoke_sizes.json (the file has no range: materials[].mass_below[thr].{unaged,aged}))
- Ranges: model figure "Where the smoke goes" on #/predict shows no range in its text or tables (owner: engine/drift.py → data/drift.json (the file has no range: detectors[].alarm_s))
- Ranges: model figure "Walk around the smoke (3D)" on #/predict shows no range in its text or tables (owner: engine/drift.py → data/drift.json (the file has no range: detectors[].alarm_s))
- Ranges: model figure "Second opinion: a cabin with racks" on #/predict shows no range in its text or tables (owner: models/m3-drift/build.py → data/drift_lbm.json (the file has no range: detectors[].alarm_s))
- Ranges: model figure "Flame simulator" on #/flame shows no range in its text or tables (owner: models/flame-sim/build.py (the file has no range: flames[].{T_flame_K, aspect, tilt_deg_from_vertical, U_buoy_m_s}))
- Ranges: model figure "Droplet burning rate vs NASA FLEX" on #/flame shows no range in its text or tables (owner: models/flame-sim/build.py (the file has no range: flex_comparison[].K_model_mm2_s))
- Ranges: model figure "How fast flame crosses a solid" on #/flame shows no range in its text or tables (owner: models/flame-sim/build.py (the file has no range: bass_ii_comparison[].model_mm_s))
- Ranges: model figure "Where a flame can survive" on #/flame shows no range in its text or tables (owner: models/flame-sim/build.py (the file has no range: flammability_maps[].min_O2))
- Ranges: model figure "A fire growing across a sample" on #/flame shows no range in its text or tables (owner: models/flame-sim/build.py (the file has no range: fronts[].spread_mm_s))
<!-- ranges_check:end -->

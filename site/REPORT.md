# Site v2 rebuild report

Branch `feat/site-v2`, from `main` at f1a9df7, 2026-11-15. Nothing has been pushed or merged; `main` is still the live fallback.

| Commit | Phase |
|---|---|
| 3af03c9 | 1+2: the shell, charts, glossary, provenance, overlays, the Design kit, and the growth port with its test |
| ff9ac99 | 3: Assess, the risk rules, the response evidence card and Home (with the pipeline strip) |
| 3dc15f0 | 4: Find it, Predict it, Put it out and Checks |
| e00454c | 5: Flame lab, NASA experiments, Model cards, Ask, Sources, History, Bench rig, On Earth, Telugu and Hindi, and the data steward |
| 3a194b5 | 6: hero flame, banners and background, and the ticking clock |
| e591d4c | 7: parity, reachability, accessibility and coverage tools, and the fixes |

The plan is `site/REBUILD_PLAN.md`. Decisions are in `site/DECISIONS.md` and the new data shapes in `site/CONTRACT_PROPOSAL.md`.

## Results (re-run by the lead after phase 7)

| Check | Result | Source |
|---|---|---|
| Growth port test | **8/8 pass**: `node tests/growth.test.mjs`. All 36 summary numbers and 9 stop reasons in `growth_examples.json` match to 4 significant figures. The step-1 rates match in all 546 cells × 8 cases. 2 to 11 ms per call, so no Web Worker is needed. | tests/growth.test.mjs |
| Page scripts parse (CI globs) | All `js/*.js` and `js/pages/*.js` pass `node --check` | |
| Data rules | `check_data.py`: OK, 36 data files. `sha256sum -c` on SHA256SUMS passes. | data/ |
| Parity with the old site | **0 failures**. Figures: 64 present, 9 renamed, 1 replaced, 2 dropped. Controls: 152 present. Links: 77. Shell controls: 28. | site/PARITY.md |
| Reachability (Home, visible links, menus and folds only) | 96 of 96 figure titles and 15 of 15 pages reached at 1280 and 390 px. 0 bad links, 0 console or HTTP errors. | site/REACH.md |
| axe-core, every page, Day and Night, folds open | **0 serious or critical violations across 30 scans**. This is after fixing 24 serious nodes: the Night `--crit` contrast at 3.85:1 and 2 scrollable regions on Assess. | site/A11Y.md |
| Keyboard | No traps and no invisible focus stops. Glossary words now have a visible focus ring. | site/tools/keyboard.mjs |
| Coverage: Made-by, C9, wording grep | 0 issues. Every charted figure has a Made-by entry, and every `models/` folder appears in one. No ion wind or thermopile text. No affirmative "safe", "certified" or "first ever". No Moon or Mars values outside the Flame lab switch. | site/tools/made_check.mjs |
| Plan v2 coverage | 117 items: **84 done, 18 pending data, 5 planned, 10 scrapped, 0 missing** | site/PLAN_COVERAGE.md |
| Layout at 320 px | No sideways scroll at A, A+ or A++ (Bench rig re-measured after its fix) | site/tools/shots.mjs |
| Screenshots | 60 PNGs in `site/shots/`: every page at 1440 and 390 px, Day and Night (48 MB, not committed) | site/shots/ |

## What changed, by page

- **Shell.** New menu order with Assess straight after Find it. NASA experiments is now in the top menu. A More menu holds Model cards, On Earth, Bench rig, Sources and the Design kit.
  - Every page header now shows an "On this page" index. `?fig=N` and `?fig=slug` open the fold and scroll to the figure.
  - There is one polite live region.
  - The banner leaves out scrapped files only once `SCRAPPED.approved` is set (it is not set yet).
- **Home.** The pipeline strip (camera → growth simulation → risk and response). The alarm finding comes from `saffire_latency.json`. The India card has an English / తెలుగు / हिन्दी switch.
- **Assess** (new). The growth simulation runs live on the visitor's inputs: lo, mid and hi area curves, max size, time to max and why it stopped.
  - The calibrated, extrapolated and assumed lists are always visible, and inputs outside the calibration box are flagged.
  - Risk level rules come from `data/risk_rules.json`, marked "a team choice, to be approved".
  - Load from camera takes JSON. Presets come from `growth_examples.json`.
  - The state is mirrored to the URL.
- **Find it.** The replay, the gas chart, rate of rise (shown failing its rule), Blind Spot, the smoke miss chart and the DAFT chart. It links to the detector-placement figure on Predict.
- **Predict it.** All six drift figures and the 3D cabin.
  - The M6b spread chart: the M6b line and band beside de Ris.
  - Model cards, the gap map and the "next experiment" card (team rule).
- **Put it out.** The response evidence card follows the Assess inputs. The suppressant comparison quotes the source's "not a controlled comparison".
  - The extinction and cool-flame figures.
  - The E-FIELD panel is reworded as NASA context only.
  - Mist trial: "not completed".
- **Flame lab.** All seven figures. A "Show Moon and Mars (model only)" switch is off by default; when on, those cases are drawn dashed with `gravity_note`. The hidden-risk band sits on the survival map.
- **NASA experiments.** Expandable rows per investigation. The tested O₂ and pressure come from `gaps.json`, with "Not in our table yet" where the data has nothing. There is a Group by hardware toggle, with its mapping rule shown.
- **Model cards** (new page). 10 sections, each read from `models.json`, `spread_predictor.json` and every `models/*/results.json`.
- **Checks.** The E4 and E5 overlay, with the source file named. E1, E2 and E8 show "Scrapped (see plan v2)". Pending rows for the CV checks.
- **Ask.** The same matcher and scorecard. The ion-wind gold question is hidden, with a footnote. The optional live mode (`llm.js`, `worker/`) is unchanged.
- **Bench rig.** Rebuilt as "Bench rig: camera", with pending states for the CV and optical-flow results. The closed loop is listed as planned. No thermopile panels.
- **On Earth** (new). Three cards from `data/earth_apps.json`.
- **Sources.** A site map generated at run time.
- **History** and the **Design kit.** Kept.
- **Dropped.** The thermopile locator, ion-wind trials and text, and the unused `js/flame.js` (no page imported it).

## Where the files disagree with plan v2's "Results so far" table

The pages show the file values. The plan table should be corrected:

1. **M4:** the plan says "All pass".
   - E3 (reproduce a published alarm time) was not run.
   - L5 is reported only.
   - The rate-of-rise extension failed its pre-written rule (`rate_of_rise.json` `result.passed=false`).
2. **M5:** M5-lognormal also fails (9 of 10 rows within 10%), not only the AUC.
3. **Flame sim:** S2-standoff is also "not run: no data".
4. **M3 LBM:** D-dome is "not run", as well as the Re 400 fail.
5. **M7 burning rate:** the headline metric is MAE 0.0516 [0.0434–0.0617] against d-squared 0.0791. The plan's R² 0.67 is a secondary score.

## Open: for the team to decide or supply

- **Q1, the scrapped list.** `SCRAPPED.approved` is still false in `js/overlays.js`. Set it to true once the team agrees on dome_locator, dome_sensor_count, the response_trials ion part, and E1/E2/E8. The banner then stops counting them as "still to come".
- **Ranges.** 17 of 37 predictions have no lo/hi in their data files, so 9 model figures show no range: the drift figures, "Smoke the detector misses", the cabin with racks, and five Flame lab figures. Only the model owners can add these; the site does not invent them.
- **Pending data** (18 items). These need files from the team: `cv_latest.json` (CV model), the optical-flow track, the mist trial, and the CV detection rate and size error (Mukund).
- **Telugu and Hindi** are drafts (`reviewed:false`) until a native speaker checks them. The wording grep covers English only.
- **Indic fonts.** They load from Google Fonts. With fonts blocked or offline, a machine without Indic system fonts shows empty boxes.
- **`site/shots/` (48 MB)** is not committed. Add it to `.gitignore` or delete it.

## Check by hand before submission

- A real screen-reader pass (NVDA or VoiceOver) on Home, Assess and Find it.
- These states, which no tool drove:
  - each Ask answer;
  - the Assess droplet preset;
  - the Moon/Mars switch at 390 px;
  - Calm mode and flash checks at sizes and themes other than 1440 px Night.
- The "Aa Read your way" button floats over text on phones; it is smaller now, but still covers some text.
- Read-aloud (`speechSynthesis`), which headless Chromium cannot test.
- The Find it replay radiometer trace after its 7 s alarm. It was adjusted in phase 7; compare it with the old site.

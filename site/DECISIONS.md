# Site v2 decisions

Every decision taken while building the site rebuild on `feat/site-v2`, grouped by phase and work package. The plan is `site/REBUILD_PLAN.md`; package names (P1-A, P2…) are from its §4. Each phase's lead appends here in the same commit as the phase.

## Human decisions in force (open questions Q1 to Q10, plan §6)

The lead took the plan's defaults to keep moving. None of them is final until the human confirms it.

| # | Question | In force |
|---|---|---|
| Q1 | Scrapped list | `SCRAPPED.approved` stays `false` in `js/overlays.js`: the human has not approved it yet. The banner uses the pre-approval wording "3 data files are still to come…" without main's "mostly from our bench rig". E1, E2, E8 and D-dome keep their file state and carry `proposedScrap: true`. |
| Q2 | M6b trust dots | Main's values kept (3·3·3·3·2 with main's "why" text), labelled "Draft: ratings still to be confirmed by the team." |
| Q3 | Folds | Spec values: predict `keep` 1, evidence 1, models 99 (no fold). The tour and `?fig=` links open folds. |
| Q4 | Ion wind in Ask | Plan default: all 22 items stay in the matcher (score stays 93 %); the ion-wind gold question is hidden from the table but scored, with a footnote; the ion-wind sentence is stripped from the E-FIELD answer at display time. |
| Q5 | `cv_example` demo | Counts in the banner ("…labelled “Demo data”…"). |
| Q6 | Growth fixtures | The 9 reference vectors (plus the droplet pointer and the unsupported-material error) are copied byte for byte to `tests/fixtures/growth_vectors.json`. |
| Q7 | Telugu and Hindi | Plan default; no native speaker yet, so `reviewed:false`. |
| Q8 | E-FIELD panel | Kept as NASA context. |
| Q9 | SHA256SUMS | Regenerated with `scripts/hash_data.py` by the data steward when data files are added (phase 3 on). Phase 1+2 changed no data file, so it was not regenerated. |
| Q10 | Assess bounds | Bounds other than airflow and O₂ are derived from the data files, as §3.5 says, with the derivation shown on the page (P3-B). |

## Phase 1+2 (commit "Site v2 phase 1+2", 15 Nov 2026)

### P1-A shell

- `lib.loadPath`: a file that loads but has no top-level `status` (every `models/*/results.json` except flame-sim and m3-drift) is returned without a status rather than set to `missing`, because §2.1's "same semantics" (`status ||= 'missing'`) would make every `results.json` read as missing. A failed fetch or parse still returns `{status:'missing'}`. `load()` keeps `status ||= 'missing'`.
- The router sets `#view[data-page]` inside the swap, not at step 1, so new page CSS never restyles the outgoing page during the transition.
- The router does not focus `#view` on the very first load, so the first Tab reaches the skip link. Every later route focuses `#view`, or reveals `?fig=`.
- On `vo:rerender` the router uses no view transition; open `<details>` and the focused control in `#view` are restored by index, then `scrollY`.
- `statusBanner(manifest, SCRAPPED, MANIFEST_WHAT?)` returns the text (pure) and `renderBanner(el, …)` fills `#demo-banner`. The optional third argument names optional files. Main's last sentence is kept verbatim when only missing files are counted. With demo files it reads "Every affected panel is labelled “Demo data”." or "…“Demo data” or “No data yet”.", because a demo panel is not labelled "No data yet".
- Figure numbering: every top-level `.card` with its own h2 (not nested in another card) gets `fig-N`, `data-fignum` and `data-fig`, including text-only cards, and the CSS shows "Figure N" on all of them, so the label always matches `?fig=N` and "On this page". Anchors and the TOC run only on `head:true` pages (Home and History have none). The TOC sits between `.phead` and "The short answer".
- Pass 9 (Made-by) skips cards marked `data-made="none"`; used only for the Design kit's specimen tables (Colour and contrast, Chart series), which are not data figures.
- Page layout: `.page` is a full-bleed CSS grid (gutter columns `minmax(var(--gutter),1fr)`). `.phead` and any `.bleed` child span the full width with no `100vw`, so there is no scrollbar-width sideways scroll. Children get `margin-bottom: 20px`.
- Theme tokens in `css/tokens.css` match any element with `data-theme`, not only `<html>`; the Design kit uses this to measure Day and Night at once from the live CSS. A no-JS fallback follows `prefers-color-scheme`.
- New stamp styles (plan, team, scrapped) for both themes. Scrapped uses a dashed border so it is not told apart by colour alone. STATUS titles for model, plan, team and scrapped are new wording; the other titles are main's verbatim.
- Static stubs: `gl_hero` returns `{el, ok:false, setG}`, a static SVG with `role=img`, main's aria-label and a visible "Illustration, not data" label. `gl_banner` returns a static aria-hidden SVG plus the same label. `bg.js` is a no-op. `clock.js` shows the static final state with main's lanes and aria-label; its caption drops "played at 10× speed" because nothing plays yet. The "+13 s" track tail is main's display constant.
- Page stubs: one `plan` card each, "Being rebuilt in phase N" with the owning package. The Home stub also shows the static clock and the tour button, so tour stop 1 has a target.
- `index.html` footer links: NASA experiments, Model cards, On Earth, Bench rig, Sources, Design kit (main's list plus On Earth, matching the More menu). A single `#live` polite region was added and `#view` has `tabindex=-1`. The menu button got `type=button` and `aria-controls`.
- Design kit: the separate "Design kit · v1" kicker is dropped (pageHead gives "More / Design kit"). Principle texts reworded where main's are no longer true (no "FIG. 01" or corner ticks; stamps list all statuses). Colour is now "Colour and contrast", with both themes and verdicts at A/A+/A++ (16/18/20 px), bold ≥ 18.66 px counting as large. Chart series shows dash, shape and 3:1 graphics contrast. Type adds Libre Caslon Text and Special Elite. Components gives all 9 stamps, a working seg control (`lib.seg`, switches the theme), a glossary word and a lamp reading 7 s from `saffire_latency` (main's "41 s" dropped). "Built for every reader" rewritten for the post-D5 site. The primary/secondary demo buttons link to `#/detect` and `#/evidence` instead of the dead `#/design`.
- Extra exports beyond §2 (additive, no frozen signature changed): router `renderPage(id,{detached,params})` for the P5-E site map, plus `currentRoute` (also exported as `current`); passes `figLink`, `figureCards`, `firstSentenceEnd`; site `TOP`, `MORE`, `pageById`, `docTitle`, `kicker`; store `reshapeFlame` (the §2.8 area-slider rule), `QUERY_KEYS`, `DEFAULT_PRESET`, `initialised`; status `renderBanner`; tour `STOPS`; lib `seg`/`numField` elements carry `.set(v)` (and `numField.get()`).
- `store.initFromURL` returns without marking itself started when examples are missing or empty, so a later call with loaded examples still initialises. A query that changes any field sets `flame.source` to `'sliders'`, and `preset` to `null` unless `pre` matches.
- `prefs.js` dock rows use visible labels tied to the button groups through `aria-labelledby` (main used aria-label only). The panel is labelled by its h2. Read-aloud text and behaviour are main's, minus the stale "FIG." strip.
- Old `js/` and `css/` files deleted with `rm` (staged by the lead): css/app.css, freefall.css, v2.css; js/banner.js, cabin3d.js, detect_ui.js, drift_ui.js, flame.js, flame_sim.js, gaps_ui.js, hero.js, llm.js, mission.js, respond_ui.js, spread_ui.js, summaries.js, theme.js, trust.js, verify_ui.js. `js/llm.js`, `js/mission.js` and `js/flame_sim.js` come back in phases 3 and 5 as the plan says.

### P1-B charts

- `C`, `SERIES`, `SCREEN`, `THEMES` and `setChartTheme` are verbatim from main. `DASH` and `SHAPES` follow §2.2.
- SVG grid, axis, text, crosshair and mark outlines are drawn through CSS classes that use the theme tokens (`.ch-grid{stroke:var(--grid)}` etc.). The token values equal main's `THEMES`, so colours are unchanged, and charts recolour the moment `data-theme` changes, even before `vo:rerender` redraws them. `charts.js` also syncs `C` to `html[data-theme]` on `vo:prefs`, `vo:rerender` and a MutationObserver.
- `lineChart` hover and keys snap to the nearest x over all series. A series with no data at that x shows "n/a" rather than its end value (main showed the nearest point even outside the series range).
- `lineChart` extends the default x domain to include the markers (the growth curve's alarm markers stay on the plot); `xDom` overrides this. Lines and bands are clipped to the plot area. A null y breaks the line, and an isolated point is drawn as a dot.
- Marker, reference and row-name labels use ink colour, ticks use mute (main made every label mute). Labels near the right edge flip to `text-anchor: end`.
- Tooltip and table share one number format: integers as is, otherwise 4 significant figures, |v| ≥ 10000 rounded. `fmtX`/`fmtY` override it in both places.
- The tooltip x header uses the unit after the last ", " in `xLabel` ("Time since ignition, s" gives "s"); without one it shows the label in brackets.
- `bars`: `label` on a value is the tooltip HTML. Value labels are drawn above bars when there are 24 bars or fewer. Keys that repeat across groups get solid, hatch, dots or cross fills plus a legend. `xMarkers.at` is a fractional group index (0 = centre of the first group). Long group names wrap to at most 3 lines. Single-value groups (FLEX) give the table columns Group | value | Detail(key).
- `scatter`: `group` assigns SERIES colour plus SHAPES shape per group and an automatic legend. `columns` is `[[header, p => value]]` (or `[{header, value}]`). `errorBars` draws lo–hi whiskers. Keyboard order is by x, then y.
- Compatible extensions beyond §2.2, all optional: a `legend` flag on lineChart, scatter and bars; keyNav opts `cols` (↑/↓ move a whole row), `onMove`, `onClear`; keyNav returns `{show, clear, index}`; `numbers(caption, headers, rows, note?)` takes an optional 4th note line. Keys are ←/→/↑/↓, Home/End and PageUp/PageDown (±10). The tooltip is not shown on focus, only on the first key press.
- keyNav sets `tabindex=0`, `role=img` (when the element has none) and `data-keynav`, and an aria-label ending "Use the arrow keys to read values, or open “Show the numbers”." An Element anchor gets class `.kfocus` while read.
- `numbers()`: the first cell of each row is a `<th>`, numeric cells get class `num`. The table sits in `div.scroll` so passes.js labels it as a region. An empty header becomes sr text "Item" (§2.1).
- Charts return `div.chart-wrap` (svg + optional legend + `details.numbers`), not a bare svg. Callers pass `title` and use `.querySelector('svg.chart')` if they need the svg.

### P1-C content

- Q1 gating: E1, E2 and E8 become state `scrapped` only when `SCRAPPED.approved` is true (§2.6 states it unconditionally; the SCRAPPED comment and spec C7 require the approval). Until then they keep the file's state (`pending`) and carry `proposedScrap: true`. `evidenceRows` and `manifestRow` take an `approved` option so H3 can preview the approved view.
- Q2: `CRED.m6b` keeps main's ratings and "why", with `draft: true`; the strip prints "Draft: ratings still to be confirmed by the team." Null factor values render as "not rated" with a matching aria-label.
- Q4: `askAnswer()` runs every answer through `scrubIonWind` (only efield changes) and returns `showMatched=false` for the `ionwind` refusal. `hideGoldRow()` hides the ion-wind gold question, which stays scored. `kbPassage()` scrubs title and text before llm.js sends a passage.
- Q7: the glossary skips any scope whose `lang` is not English, so te/hi text is never annotated.
- Q8: `efieldText() = scrubIonWind(ef.finding)`; `MANIFEST_WHAT.efield` reads "shown as NASA context".
- The MADE literal is kept verbatim (40 entries). The `models` field is merged from a separate `MODELS` map after the literal. Smoke-drift figures from `engine/` list no `models/` folder, because `engine/` is not one.
- Main's MADE text types in "200 refits" and "30 fixed questions" (§0 rule 2). The literal is unchanged, but `provenance()` swaps each number at display time for the count read from `data/m7_explorer.json` (`extinction.note`) and `data/assistant_gold.json` (`items.length`). If a file is missing, the number is dropped ("repeated refits", "Fixed questions") and the dd gets `data-unbacked`.
- The 23 new MADE entries contain no numbers of their own, only PSI/DOI ids and file paths; they are drafts for the team to check.
- Four new glossary definitions (CV model, optical flow, de Ris, calibration box) are one-line drafts, marked "team to check", with no numbers. "de Ris" avoids naming the person or a year.
- `provenance()` does not log the "no Made by entry" warning itself; passes.js pass 9 does (§2.5). It reads the title from `card[data-title]` first, so a glossary button in an h2 cannot break the lookup.
- `registerMade()` stores entries in a separate exported `REGISTERED` map, which `madeFor()` also searches, and refuses to override an existing MADE title.
- E4 is formatted with `toPrecision(3)` keeping trailing zeros (0.0200). overlays.js does not import lib.js, so it stays DOM-free and importable in Node. E4 passes when kept MAE < raw de Ris MAE ("no claim if it does not beat it"). E5 prints the models.json values unrounded, as §2.6 writes it, and passes when the score and both range ends are finite.
- Glossary: the popup and its listeners are created on the first `annotate()` or `show()`, not at import. The SKIP list adds `.numbers` and `.toc`.
- Extra exports beyond §2.6/§2.7 (additive): overlays `manifestRow`, `sentences`, `simCheckState`, `E4_SOURCE`, `E5_SOURCE`; provenance `REGISTERED`. CV_PENDING rows also carry ref "Dome camera, held-out frames", limit "To be written in RULES.md before testing" and `result: null`.
- The P1-C acceptance line "`scrubIonWind(efield.finding)` contains no 'ion'" cannot pass literally: NASA's own sentence "It measured ion current" stays, and words such as "objectives" contain the letters. The check used is `/\bion[- ]wind\b/i`.

### P2 growth

- `spreadRates(fuel, conditions, C)` follows the frozen shape. PMMA concurrent is `null` in the thin regime. Fabric opposed is an object with lo/mid/hi `null`, `in_domain:false`, `calibration:'none'`, because the interface does not mark opposed as nullable. Values are unrounded mm/s. Additive fields: `tau_mm` (PMMA) and `area_density_mg_cm2` (fabric).
- As in growth.py, a droplet flame returns the pointer before the material is checked. For every surface flame the material check throws before any grid work. `spreadRates` throws the same full message ("… (PMMA, SIBAL, cotton)"), so the "not supported" UI can rely on one string.
- `sig(x, n)` reproduces Python `f'{x:.{n}g}'` exactly, including round-half-even on exact binary ties. Plain `Number(x.toPrecision(n))` differs from Python on ties such as 2.0625 → 2.062, so the plan's toPrecision note was refined. Exported for pages to reuse.
- `runGrowth` uses one shared module Worker whenever the browser can start one, rather than switching at 200 ms. Measured calls are 2–37 ms for the examples and vectors and 94–148 ms for 40 × 100 cm fuels, but visitor inputs can be bigger. If the Worker is missing or fails to load, `runGrowth` falls back to synchronous runs and re-runs queued jobs synchronously. Rejections carry the same Error message as `simulateGrowth`.
- Additive exports: growth.js `sig`, `LIMITS`, `areaCurve`, `growthCost` (an upper-bound work estimate); growth_run.js `growthMode()` → `'worker'|'sync'` and `stopGrowth()` for `ctx.onLeave` (terminates the worker, rejects waiting runs with an `AbortError`). `opts.internals:true` attaches a non-enumerable `_internals` for tests.
- Defaults ported from growth.py: `thickness_mm || 0`; `sides_burning` defaults to 2 only when undefined (explicit `null` means one-sided, as in Python); pressure 1.0; direction 0; `frame_time_s || 0`; `flame_type 'surface'`. Sides is coerced with `Number()`, so a form string "2" behaves like 2 (a deliberate robustness change; Python mishandles a string).
- Constants come only from `data/spread_predictor.json` `constants`. The only numbers typed in are growth.py's own algorithm literals (default dx `min(0.25, L/200, W/4)`, 301 samples, 1e-9 tolerances, BIG 1e150, the 1e100 cut-off, 32/28 in the O₂ mass fraction), each cited in a source comment at the top of `js/growth.js`. Labels, limits and the droplet note are verbatim growth.py literals.
- Known and reported, not failed: `pmma_slab_opposed` `area_cm2.mid[101]` is 1.115 cm² in the port and 1.122 cm² in the file; the sample lands on a burnout step and the port uses the 6 s.f. JSON constants. `t_abs_s` is emitted at 8 s.f. (as growth.py does) while the file stores 6 s.f.

### Lead (integration of phase 1+2)

- Glossary (request from P1-A): terms written with a capital letter (SAME, PSI, AUC, FLEX, PMMA, BASS-II, Saffire, kPa, R², CV model, de Ris) now match case-sensitively, so the English word "same" is no longer taken for the SAME experiment. All-lowercase terms still match with a capital first letter. The TERMS text is unchanged.
- One live region (P1-B issue, spec D5.9): `#tip` was `role=status`, a second live region. It is now `aria-hidden="true"`, and `charts.keyNav` sends the plain text of each key step to the single `#live` region through `lib.announce()`. Pointer hover does not announce.
- `details.numbers` spacing (P1-B request): components.css keeps the shared look (top margin and dashed rule); charts.css now sets only the bottom margin.
- `.cred .cred-draft` and `.cred li b.cred-none` rules added to components.css (P1-C request), using the `--ink`, `--ink2` and `--mono` tokens.
- MADE "Walk around the smoke (3D)" `files` now names `js/fig_cabin3d.js` (the file named in plan §1, built in phase 4) instead of the deleted `js/cabin3d.js`. This is the second allowed change to the verbatim MADE literal.
- Deferred, not applied: the MADE text for "Where a flame can survive" does not mention the hidden-risk band (B6). P5-A explains the band in the card's sub; changing the MADE text waits for the team.
- Recorded for later phases: the "safe" grep allowlist (P7-E) must include the growth.py limits literal in `js/growth.js` ("Says nothing about whether a material or atmosphere is safe."), which also appears in `data/growth_examples.json`.
- CI note for the human (outside the site's files): on Node v22 plain `node --check file.js` exits 0 on an ES-module file with a syntax error (checked: `export const a = { b: 'it's' };` passes). `node --input-type=module --check < file.js` catches it. The lead ran both on every file this phase. Adding `node tests/growth.test.mjs` to CI is also suggested. `.github/` belongs to neither the site nor the agents.

## Phases 3 to 6 (commits "Site v2 phase 3" to "Site v2 phase 6", 15 Nov 2026)

Human decisions Q1 to Q10 above stayed in force unchanged through these phases. Every package recorded them in its hand-back; only the ones that touched a package's files are repeated below.

### P3-A core + data steward (js/assess_core.js, data/risk_rules.json, data/cv_example.json, manifest, SHA256SUMS)

- `risk_rules.json` holds 6 rules plus a default (Elevated). R0: no growth run, level null. R1 High: still growing at the slowest smoke alarm (compares `summary.hi.t_max_s` plus the frame time with `smoke_s[1]`). R2 Elevated: spreads and peaks before that alarm. R3 Elevated: near observed extinction but still grows. R4 Low: NASA observed no spread. R5 Low: does not grow beyond the start. No rule uses a fixed threshold number; every test compares two computed values or checks a category (`kind`, `verdict_code`). The detection shares are shown as parts, but no rule reads them, because they do not depend on the visitor's inputs. R1 and R2 reasons carry the Saffire-III "different fire, shown for scale only" caveat (§7 item 12). `approved:false`.
- `riskLevel`: the first matching rule in file order fires. If a rule needs a missing value, the chain stops and the default (Elevated) fires naming the missing value, so a missing file never yields Low. Every rule is still evaluated and listed with matched true/false/null and fired.
- `loadAssessData` fetches `cv_latest.json` only when the manifest lists it (or the manifest itself is missing), otherwise `{status:'missing'}`. This is the closest compatible form of the frozen `cv = load('cv_latest')`.
- `computeAssessment` returns the frozen fields plus extras: `inputs`, `regime`, `errors`, `gap` (nearestProbe at O₂ and pressure × 101.325 kPa), `parts`, `status:'model'`, and detection `n_burns/burns/source/missing/note` plus layout alarm thresholds and run counts. Extra exports: `detectionFrom`, `riskParts`, `LEVELS`, `share`. Cited constants: 101.325 kPa per atm (standard atmosphere); the build_gaps.py probe window (3 O₂ points, 10 kPa); the 1e-9 box tolerance from growth.js/predictor.py.
- Input checks use only `spread_predictor.constants.*.domain` for the active regime (PMMA thin or thick, plus the thick-PMMA downwind bound; the fabric concurrent box including area density). No typed slider bounds (those are P3-B's).
- `cv_example.json` is a value-for-value copy of growth example 1's flame state (`sibal_concurrent_panel`) with `coordinates:"fuel"`, `confidence:null`, `droplet:null`, status `demo` (Q5: counts in the banner).
- Manifest written with `json.dumps(m, indent=1, ensure_ascii=False)`, no trailing newline; only the two lines appended. SHA256SUMS regenerated last with `scripts/hash_data.py` (Q9).

### P3-B Assess page (js/fig_assess.js, js/pages/assess.js, css/p-assess.css)

- Q10: slider bounds the spec does not give are derived from the data and printed under each slider. Pressure, width, length and thickness use the min/max over `spread_predictor.constants.*.domain`, the growth_examples inputs and `gaps.probes` kPa ÷ 101.325; thickness also counts τ and 2τ (τ = thickness ÷ 2 when both sides burn). Bounds are rounded outward to 4 s.f., and the page says so. Airflow and O₂ use the spread_predictor grid (it spans the spec's 0–50 cm/s and 15–35 %); the spec values are the fallback only when the file is missing. Area, x and y are bounded by the fuel's own W×L. A linked value outside the range widens the slider and is labelled, never clamped. The smallest area is one slider step (0.1 cm²); direction runs 0–359° (geometry, not data).
- Added `verdictCard(result, data)` for "Will it spread here?" (§2.12 listed no function for it). Cards are built once and refreshed with `card.update(result[, state])`; `inputsCard` also has `.sync(state)`, `cameraCard` has `.apply(obj, source, label)`. Other §2.12 signatures kept.
- If a visit's link carries no Assess query keys and `cv_latest.json` exists, the latest camera reading is applied once on mount; otherwise the URL or preset wins.
- The short answer shows "Running the growth model…" until the first run, then `computeAssessment`'s sentences. On mount the page calls `store.set({})` so the address bar always holds a working link. Runs are coalesced (only the newest result shows); `ctx.onLeave` unsubscribes and calls `stopGrowth()`.
- The live region announces only when the verdict label or the risk level changes, never on first render or per slider step; camera load or reject announces once per action.
- Curve x axis is "Time after ignition, s" (`t_abs_s`); the stats give times after the flame reading (`t_max_s`, `t_end_s`), and the text says so.
- The phrase "or a certified rating" was removed from the risk banner.

### P3-C response card (js/fig_response.js, css/fx-response.css)

- The card-level stamp is `model` (a summary computed for the visitor's fire). Each line carries its own file's stamp: flex_suppression real, m7_explorer model, spread_predictor model, gaps real, risk_rules team; each matched NASA case keeps its own stamp.
- M7 column wording: "the model gives more/less than a 50% chance of going out" instead of "flames mostly go out/keep burning" (a 50 % point says no more than that).
- The gaps window ("within 3 O₂ points, 10 kPa") is read from `nearestProbe().window` (source build_gaps.py). 1 atm = 101.325 kPa kept as a cited constant.
- Atmosphere chips write only `o2_vol_pct` and `pressure_atm` to the shared store, so Assess shows the same cabin afterwards; the page says so.
- For a surface fire the FLEX and M7 lines are context, flagged "Gap: droplet data, context only". The M7 table uses the nearest tabulated pressure and flags a non-match outside 0.7–1 atm.
- Urgency shows "Rules are a team choice, to be approved." while `risk_rules.approved` is false, with the fired rule's reason verbatim.

### P3-D Home (js/pages/overview.js, js/mission.js, js/facts.js, css/p-overview.css)

- Question 03 reworded with no ion wind: "…when a droplet flame goes out. Bench mist trial: not completed."
- `facts.js` computes the gas sentence even when saffire_latency is missing (main dropped it); a missing file gives the D1.4 "not available yet" sentence. Extra exports `loadDetectFacts()` and `missingSentence(what, file)`; the frozen `detectFacts(lat, gas)` is unchanged.
- The mission check's "nearby" window (3 O₂ points, 10 kPa) is carried from main as named constants: a team choice with no citation, stated on screen.
- "From camera to risk" is stamped team; each step stamps its own source file from the manifest (cv_latest, spread_predictor, risk_rules).
- "How to read this site" says "Only the first three are results" (real, dome, model), because the dome stamp joined the legend. The "scrapped" legend row appears only when `SCRAPPED.approved` is true (Q1).
- A stray "null" from `replaceChildren(…, null, …)` in mission.js was fixed with `add()`.

### P4-A Find it (js/fig_detect.js, js/pages/detect.js, css/p-detect.css)

- Keep 2 (Replay and Gas visible, 5 folded). With no `?event=` the replay opens on Sample 1, as main does; changing the event now writes `?event=<key>` back (main read it but never wrote it), except when detached.
- Gas card axis ends come from the file (largest value or limit + 8 %); main typed 460 ppm and 4 mmHg.
- Smoke-miss empty state: main's example size (47 nm) replaced with a placeholder.
- Display constants carried from main with comments: replay length about 14 s per event, lane clamp −0.5 to 2, Blind Spot y cap 2, dot-plot domain 20–3000 nm, the 5 SD site rule highlighted in the sensitivity table.

### P4-B Predict: smoke (js/fig_drift.js, js/fig_cabin3d.js, css/fx-drift.css)

- Concentrations in summaries, tooltips and tables are decoded from the file's own `scale` string (value = 255·log10(1+99c/scale_max)/2); a different stated scale shows no concentration rather than a guess.
- The detector value in the table is the smoke in the detector's grid cell; alarm times include the file's `detector_delay_s` (the table note says so).
- `ISS_ALARM = 10 mg/m³` carried from main with its source (NTRS 20170002629), used only when whatif.json has no `alarm_hi_mg_m3` (it has one, so the file value shows).
- The LBM what-if "2 mg/s upper release rate is assumed" line is built from the largest `by_rate` value, and only when `varied.release_mg_s` says "high end assumed".
- 3D view: 15° turn and 0.15 rad tilt per step (team choice); Shift+Arrow turns, plain arrows read values; Turn/Tilt/Reset buttons added. In Calm the ray-march dither is still and Play stops at the last frame. Up to 4 detector lights from the file (main hard-coded 2). `robustCard(w)` always returns a card (empty state without a robustness block).
- Empty-state schema text says "seconds per position; a missed position left empty" instead of "seconds or null".
- Data observation for the M3 owner (not changed): in data/drift.json every grid cell is at or above 1 mg/m³ from the earliest frame checked (30 s), so the summary often says "covers 100% of the section".

### P4-C Predict: spread, models, gaps + page (js/fig_spread.js, js/fig_models.js, js/fig_gaps.js, js/pages/predict.js, css/p-predict.css)

- Block order follows §3.6 rows 1–19 with keep 1. The robustness card is drawn when `whatif.robustness` exists, or as an empty state when whatif.json is missing; it is left out only when the file is present without that block.
- Gap map: main's axes (0–90 % O₂, 40–600 kPa log) kept, widened only for a point outside them. Fuel kinds by shape as well as colour (droplets circle, gas flames square, solids triangle, reported burns diamond); probes dashed. Arrow-key order: probes, reported burns, then all tested points; text summary and table from the same values.
- Next experiment: ascending by the sum of counts, ties in file order; the "3 O₂ points and 10 kPa" neighbourhood parsed from the file's verdict text.
- Short answer: main's three sentences; the run count prints as 4,000; the 1 mg/m³ level read from `whatif.alarm_mg_m3`.
- The models.json missing-state schema uses "…" placeholders instead of main's example numbers. Moon and Mars card: main's text, stamp team, no values, no link to the Flame lab switch, no MADE entry (text only).

### P4-D Put it out (js/fig_respond.js, js/pages/respond.js, css/p-respond.css)

- Q4/Q8: E-FIELD text goes through `overlays.efieldText()`, with an explicit "Shown as NASA context only" line. Keep 2 (coverage and response evidence visible, 6 folded).
- Card 7 is titled "Bench mist trial" (the MADE key), replacing "Bench trials: ion wind and fine mist". It always says "Bench mist trial: not completed." without dome data, plus "This trial is optional." from `SCRAPPED.optional`.
- "200 refits" on the extinction card is read from the m7_explorer note text. `AIR = 0.21` carried from main with a source comment.
- Coverage card links are Find it, Put it out, Flame lab and Assess (figLink, opening folds), an Assess link added for solids, and DOIs per investigation from investigations.json: `coverageCard(gaps, inv)` (noted in §2.12). `mistRows(tr)` is exported for reuse.
- The page skips `loadAssessData` on detached renders. `readingCard` is text-only, stamped team, no MADE entry.

### P4-E Checks (js/fig_checks.js, js/pages/evidence.js, css/p-evidence.css)

- Q1: E1, E2, E8, D-dome and the dome_locator/dome_sensor_count manifest rows stay visible with their own state plus "Proposed for scrapping with the old bench rig (see plan v2); waiting for the team's approval." The short answer counts them as "proposed" inside "still to run". `approved:true` switches them to the scrapped stamp (tested by a route override).
- Q2: the M6b trust dots keep main's values (3·3·3·3·2) with a "draft" tag.
- E4 and E5 are filled at display time from models/m6b-predictor/results.json and data/models.json and name their source path; a missing source keeps evidence.json's state and says so. Camera rows CV1–CV3 and OF1 come from `overlays.CV_PENDING`.
- The permutation paragraph is built from permutation.json and the models.json score range; a missing models.json drops the range clause with a note.
- (The P4-E hand-back reached the integrator truncated after Q2; any further P4-E decisions are in the header comments of js/fig_checks.js and js/pages/evidence.js.)

### Phases 5 and 6 (P5-A to P5-G, P5-S, P6-A to P6-C)

The hand-backs for these packages were not relayed to the integrator of this run, so their decisions are not repeated here; each module's header comment states its own (js/flame_sim.js, js/fig_flame.js, js/pages/flame.js, js/pages/explorer.js, js/fig_modelcards.js, js/pages/models.js, js/ask_match.js, js/llm.js, js/pages/ask.js, js/pages/about.js, js/pages/memory.js, js/pages/locate.js, js/fig_bench.js, js/pages/earth.js, js/i18n.js, js/gl_hero.js, js/gl_banner.js, js/bg.js, js/clock.js). Facts the integrator checked: data/earth_apps.json (status team, 3 cards) and data/i18n.json (status team, `reviewed:false`, Q7) exist with manifest lines; `check_data.py` reports OK: 36 and SHA256SUMS lists 37 files (P5-S, Q9). The lead should append the P5/P6 decision lists here from those hand-backs.

### Lead (integration of phases 3 to 6)

- `lib.load(name)` no longer fetches a data file that data/manifest.json marks `missing` or does not list (requests from P3-A, P3-B, P3-C, P4-D). It returns `{status:'missing'}` as before, so the frozen behaviour is unchanged, but the expected 404s for response_trials.json and cv_latest.json no longer reach the console. If the manifest itself is missing, every file is fetched as before. This follows AGENTS.md rule 5 (a data file and its manifest line land in the same commit); a new file with no manifest line will read as "No data yet" until its line is added.
- `overlays.MANIFEST_WHAT.assistant_config` = "AI assistant switch: a Worker URL, or none (saved answers only)" (request from P4-E), so the Checks data-file index prints no bare "null". The manifest is unchanged.
- §2.12 now records `coverageCard(gaps, inv?)` and `mistRows(tr)` (request from P4-D).
- Phase 7 "safe" grep allowlist (requests from P3-B and P4-C): add the data-file negations "Says nothing about whether a material or atmosphere is safe." (growth_examples.json and the growth.py limits literal in js/growth.js), models.json "does not make an atmosphere safe", and spread_predictor.json `verdict_meaning` "…or that anything is safe".
- Browser checks in these phases ran with WebGL off (`--disable-webgl --disable-3d-apis`) and a thermal pause between page loads (user caps: CPU 92 °C, GPU 85 °C). A first run with software WebGL put the CPU at 91 °C and was stopped. WebGL-on rendering was checked by P4-B (3D cabin) in its own run.
- Commit grouping: phase 3 = ff9ac99, phase 4 = 3dc15f0, phase 5 = e00454c, phase 6 = the commit that adds this line. `js/pages/overview.js` and `css/p-overview.css` (P3-D) went into the phase 5 commit, because P5-G edited overview.js to import `js/i18n.js` and a phase 3 commit of it would not load; phases 3 and 4 keep the Home stub. `js/pages/respond.js` (P3-C, then P4-D) is in phase 4. The phase 3 commit carries a manifest with only the risk_rules and cv_example lines and a SHA256SUMS for those 35 files (checked: `sha256sum -c` and `check_data.py` OK: 34 on that tree); phase 5 adds earth_apps and i18n (OK: 36, 37 sums). The integration edits to js/lib.js are in phase 3, js/overlays.js and REBUILD_PLAN §2.12 in phase 4, and DECISIONS, CONTRACT_PROPOSAL, AI_LOG and REFERENCES in phase 6.

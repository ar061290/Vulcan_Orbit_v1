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

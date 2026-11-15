# Vulcan Orbit site rebuild plan (branch feat/site-v2)

Status: **draft for the human to check (checkpoint 1)**. Nothing is built yet.

Inputs read:
- the spec (`site_rebuild_prompt.md`) and plan v2 (`Vulcan_Orbit_Plan_v2.md`). Both are in the session scratchpad; the spec's `../Vulcan_Orbit_Plan_v2.md` path does not exist.
- six inventories in `scratchpad/inventory/`: `shell.md`, `pages_home_history_find_explorer.md`, `pages_predict_models_checks.md`, `pages_respond_flame_ask.md`, `data.md` and `models.md`, plus `growth_reference_vectors.json`.

The old code is the reference for wording, numbers and behaviour: `/home/karthikeya/vo-old`, a worktree of `main` at f1a9df7, byte-identical to where this branch starts.

Where the spec and the code on main disagree, this plan follows the code, except for items the spec marks DROP or REPLACE. Conflicts that need a person are in section 6.

Tags used below:
- **KEEP**: port as is.
- **EXT**: keep and extend.
- **NEW**: new work.
- **REPL**: replace with something else.
- **DROP**: remove.
- **[NIS]**: present on main but not listed in the spec. These are kept unless they concern ion wind or the thermopiles.

---

## 0. Rules every build agent follows

1. **Files.**
   - Write only the files your work package lists. No two packages in the same phase share a file.
   - Never edit `data/` (only the data steward package adds the 4 allowed files and their manifest lines), `models/`, `engine/`, `datasets/`, `scripts/`, `CONTRACT.md`, `worker/`, `.github/`, `tests/site_audit.mjs` or `README.md`.
   - `AI_LOG.md`, `REFERENCES.md`, `site/DECISIONS.md` and `site/CONTRACT_PROPOSAL.md` are written by the **lead only**. Put your decisions under a `DECISIONS:` heading in your hand-back report.
   - Agents never commit. The lead commits once per phase on `feat/site-v2` and never pushes or merges.
2. **Numbers.** Every number on screen comes from one of three places:
   - `data/*.json` or `models/*/results.json`, read at run time;
   - `js/growth.js`, run on the visitor's inputs;
   - a constant already in the old code that cites its source. Carry it over with a `// source: …` comment.

   Hard-coded numbers that main types in must become data reads. Known cases:
   - "94%": read from the `drift_whatif` check `X-agree`.
   - p ≈ 0.04, 0.44 and "16 tests": read from `permutation.json` and `models.json`.
   - "11%" in the survival-map caveat: read `min_O2` for the chosen map.
   - 20 mg/m³ in the 3D shader: read `scale_max_mg_m3`.
   - "alarm at 41 s" in the design kit: DROP, or read 7 s from `saffire_latency`.
   - "200 refits" and "30 fixed questions": read from the file text or the item counts.
3. **Placement.** Every module goes in `js/*.js` or `js/pages/*.js`.
   - CI runs `node --check` on exactly these two globs. Subfolders are never checked, and an empty glob fails CI.
   - Test and crawl tools go in `tests/` or `site/tools/`.
4. **Panels.**
   - Every card gets a status stamp. A text-only card uses the status of the file it reads, otherwise `team`.
   - A missing file renders `empty(...)` and never a blank panel. Main silently drops 9 cards in this case; fix all of them.
5. **DOM.** Do not call `el.append(null)`. Main's prototype patch that dropped nulls is gone, and phase 7 greps the rendered text for a stray "null". Use `h()` or `add()`, which filter `null`, `false` and `undefined`.
6. **Detached rendering.** A page's `render(root, ctx)` must also work on a detached root (`ctx.detached === true`), because the Sources site map renders pages off-screen to collect figure titles. Start WebGL, timers, workers and `requestAnimationFrame` only in `ctx.onMount`, and stop them in `ctx.onLeave`.
   - When `ctx.detached` is true, a page must not call `setParams`, `store.set`, `announce`, `history.*`, `focus()` or `document.title`, and must not start a growth run. Card titles must be rendered before any async computation, so the site map sees them.
   - Every figure function that animates or starts a timer, worker or WebGL context takes `ctx` as its **last argument** and registers its own start and stop through `ctx.onMount` and `ctx.onLeave`. The §2.11 and §2.12 signatures include it.
7. **Wording.** Never write "safe", "certified" or "first ever", and add no NASA logos or images of people.
   - Moon and Mars values appear **only** in the Flame lab, behind the "Show Moon and Mars (model only)" switch.
   - Remove every ion-wind and thermopile-locator mention. The text filter is in `js/overlays.js` (§2.6).
8. **Tests and checks.** Each package's acceptance checks run with `python -m http.server 8000` from the repo root, plus `for f in js/*.js js/pages/*.js; do node --check "$f"; done`.
9. **CSS.** index.html links every CSS file in §1, so every page's CSS is loaded on every route.
   - A rule in `css/p-<id>.css` is scoped under `#view[data-page="<id>"]`. The router sets `data-page`.
   - A figure used on more than one page uses unscoped classes with its module prefix: `.mist-` and `.resp-` (fig_respond and fig_response, also used on Bench rig), and `.drift-` and `.cab3d-` (fx-drift.css).
   - A package that owns no CSS file must not add CSS anywhere. It returns the rules under a `CSS:` heading in its hand-back, and the lead appends them.

---

## 1. File layout

```
index.html                     root; relative URLs only (GitHub Pages sub-path /Vulcan_Orbit_v1/)
css/
  tokens.css                   Day/Night tokens, --fs 16/18/20, Calm kill-switch, fonts vars
  base.css                     reset, type scale, layout, grid g2/g3/g4, header/nav/More, footer, banner, skip link, focus ring
  components.css               card + "Figure N" counter, badge (8 statuses + scrapped), chip/seg, btn, numfield, stat, legend,
                               table/.scroll, details.more/.fold/.madeby/.numbers, .cred, .short, .toc, .phead, .empty, .tip, .gloss,
                               dock, tour, .status pills, .lvl
  charts.css                   svg.chart, keyboard focus mark, chart-wrap, numbers table
  fx-gl.css  fx-hero.css  fx-clock.css  fx-response.css  fx-drift.css   shared figure modules (fx-hero: P6-A; fx-drift: P4-B)
  p-overview.css p-memory.css p-detect.css p-assess.css p-predict.css p-respond.css p-flame.css
  p-explorer.css p-evidence.css p-ask.css p-models.css p-earth.css p-locate.css p-about.css p-design.css
                               one per page; created EMPTY in phase 1 so index.html never changes again
js/
  app.js        entry           lib.js        DOM/data helpers      charts.js    SVG charts + keyboard + tables
  site.js       page registry   router.js     hash router           passes.js    post-render passes, figure anchors
  prefs.js      dock + prefs    status.js     status banner         overlays.js  ONE display-overlay module
  glossary.js   terms           provenance.js MADE/CRED/FACTORS     store.js     Assess store + URL mirror
  growth.js     M6b port (pure) growth_run.js worker/sync runner    growth_worker.js  module worker
  assess_core.js  assessment + risk (pure, async)
  i18n.js       te/hi strings   mission.js    Home mission check    tour.js      Judge mode tour
  facts.js      shared computed sentences + their number vars (Home short answer, Find it short answer, i18n)
  ask_match.js  matcher (verbatim)              llm.js       optional live mode (verbatim copy of main)
  gl_hero.js  gl_banner.js  bg.js  clock.js     illustrations (static stubs in phase 1, real in phase 6)
  fig_detect.js fig_drift.js fig_cabin3d.js fig_spread.js fig_models.js fig_gaps.js
  fig_respond.js fig_response.js fig_assess.js fig_flame.js flame_sim.js fig_checks.js fig_modelcards.js fig_bench.js
  pages/overview.js memory.js detect.js assess.js predict.js respond.js flame.js explorer.js evidence.js
        ask.js models.js earth.js locate.js about.js design.js
tests/growth.test.mjs          plain Node, no framework (tests/site_audit.mjs stays untouched)
site/  REBUILD_PLAN.md DECISIONS.md CONTRACT_PROPOSAL.md PARITY.md PLAN_COVERAGE.md A11Y.md REPORT.md shots/
       tools/ parity.mjs reach.mjs shots.mjs axe.mjs keyboard.mjs made_check.mjs ranges_check.mjs (phase 7)
data/  risk_rules.json cv_example.json earth_apps.json i18n.json   (+ manifest lines + SHA256SUMS; see §5)
```

**Phase 1 deletes the whole old `js/` and `css/`.** This includes the dead `js/flame.js` (grep confirms nothing imports it) and the unloaded `css/v2.css`. The old files stay readable in `/home/karthikeya/vo-old`.

`js/llm.js` comes back as a verbatim copy in phase 5. `worker/` is untouched.

---

## 2. Modules and frozen interfaces

These signatures are **frozen at the start of phase 1**. Changing one needs the lead, who updates this section.

### 2.1 `js/lib.js`

```js
h(tag, attrs = {}, ...kids) → Element
  // attrs: class, style (string|object), html (innerHTML, only for strings the old code already set as HTML), on<Event>,
  // aria-*/data-* (booleans → "true"/"false"), value true → empty attribute, null/false skipped.
  // kids flattened; null/false/undefined dropped; numbers/strings → text nodes.
add(parent, ...kids) → parent                      // same kid filtering as h
load(name) → Promise<object>                       // fetch(`data/${name}.json`,{cache:'no-cache'}), one cached promise per name;
                                                   // non-ok/parse error → {status:'missing'}; result.status ||= 'missing'
loadPath(relPath) → Promise<object>                // same semantics for any relative path, e.g. 'models/m6b-predictor/results.json'
isMissing(d) → boolean                             // !d || d.status === 'missing'
STATUS: {real, dome, model, reported, demo, plan, team, missing, scrapped} → {label, title}
  // labels: real 'NASA data', dome 'Dome data', model 'Model output', reported 'Reported, unverified', demo 'Demo data',
  //         plan 'Plan, not built', team 'Team choice', missing 'No data yet', scrapped 'Scrapped (see plan v2)'
  // titles: main's verbatim where they exist; new ones for model/plan/team/scrapped
badge(status) → span.badge.<cls>                   // cls 'real' for real|dome|model ("result" style), else status
card(title, status, sub, ...body) → section.card[data-title]  // h2 = title text node + badge(status); sub: string|Node → div.sub
empty(title, file, why, schema) → div.empty        // "Drop in data/<file>.json and this panel fills itself. Expected shape:"
fmt(v, d = 1) → string                             // 'n/a' for null/NaN; toLocaleString('en',{maximumFractionDigits:d})
sig(v, n = 3) → string                             // String(Number(v.toPrecision(n))); 'n/a' if non-finite
pct(x, d = 0) → string                             // `${(100*x).toFixed(d)}%`
rng(lo, hi, f = fmt, sep = '–') → string
page(title, lead, ...body) → div.page              // h1 + p.lead + body
tip(target, html); untip()                         // target: PointerEvent | Element | {x,y} (client px); #tip role=status
params() → object                                  // query after the hash route: '#/predict?o2=30&flow=10' → {o2:'30', flow:'10'}
setParams(obj, {merge = true} = {})                // history.replaceState, no hashchange; null/'' removes a key
seg({label, options: [[value, text]], value, onChange, id}) → div.seg-row
  // visible <span id> label + role=group aria-labelledby; <button type=button aria-pressed>; replaces the 3 duplicated chips()
numField({id, label, unit, min, max, step, value, onInput}) → div.numfield
  // visible label "Label (unit)", range + number kept in sync, "min … · max …" readout, aria-valuetext "<v> <unit>"
stat(label, value, small?) → div.statbox
legend(items: [{label, color, mark: 'dot'|'square'|'line'|'dash'|'hatch'|'diamond'}]) → div.legend
table(headers, rows, {caption, cls} = {}) → div.scroll > table   // '' header → <span class=sr>Item</span>
fold(summary, ...body) → details.fold
announce(msg)                                      // the ONE polite live region #live; skips a repeat of the last message
calm() → boolean                                   // html[data-motion] === 'calm'
slug(title) → string                               // lowercase, [^a-z0-9]+ → '-', trimmed
```

### 2.2 `js/charts.js` (SVG, no dependencies, one y-axis, quiet grid)

```js
C, SERIES /*[s1 blue, s2 orange, s3 green, s4 amber] fixed order*/, SCREEN, DASH = ['', '6 4', '2 3', '8 3 2 3'],
SHAPES = ['circle','square','triangle','diamond'], setChartTheme('day'|'night')   // values verbatim from main (shell.md §4)

lineChart({title, series: [{name, color?, dash?, points: [[x,y]], band?: [[x,lo,hi]], dots?, near?}],
           xLabel, yLabel, markers = [{x, label, color, dy}], xDom?, yDom?, xLog = false, unit = '', fmtX?, fmtY?, table = true})
scatter({title, points: [{x, y, label, color?, shape?, x2?, y2?, lo?, hi?, group?}], xLabel, yLabel,
         diagonal = false, square = false, xDom?, yDom?, errorBars = false, columns?, table = true})
dotRows({title, rows: [{name, value, text, label, lo?, hi?}], xDom, xLabel, refs = [{x, label, color}],
         shadeBelow?, color?, colorFn?, shapeFn?, table = true})
bars({title, groups: [{name, values: [{key, value, color?, label?}]}], yLabel, unit = '', yMax?,
      xMarkers = [{at /* fractional group index */, label}], table = true})
  → every chart returns div.chart-wrap > svg.chart[role=img][tabindex=0][aria-label] + details.numbers
    aria-label = `${title}. Use the arrow keys to read values, or open "Show the numbers".`
keyNav(el, items: [{html, anchor: Element | (() => ({x, y}))}], {label})   // for canvases and custom SVG:
    // one tab stop; ←/→/↑/↓/Home/End move and call tip(anchor, html); Escape and blur call untip()
numbers(caption, headers, rows) → details.numbers  // summary "Show the numbers"; a table built from the same data
```

- Series are never told apart by colour alone. Each series gets `DASH[i]` for lines, `SHAPES[i]` for scatter, or a direct label.
- `lineChart` hover snaps to the nearest x over **all** series, not only `series[0]` as main does.
- Charts recolour on `vo:rerender`.
- Custom SVGs and canvases that cannot use the four chart types must call `keyNav` and `numbers` themselves. These are the gas bars, extinction rows, cool-flame bars, spread heatmap, gap map, growth curve, drift, flammability map and the flame simulator. The list also includes the replay canvas, both blind-spot maps (whatif and LBM), the LBM drift map, the 3D smoke cabin and the hidden-risk band.
  - Every canvas also gets a one-paragraph text summary built from the same values (D5.6).
  - The 3D cabin's table may be the current frame's detector values, the same table the 2D drift card uses.

### 2.3 `js/site.js`: the page registry (frozen; the router and passes read it)

```js
export const PAGES = [  // order = top menu; menu:'more' → the "More" menu (also footer)
 {id:'overview', label:'Home',            head:false, doc:'Vulcan Orbit'},
 {id:'memory',   label:'History',         head:false, doc:'Sixty years of fire · Vulcan Orbit'},
 {id:'detect',   label:'Find it',         title:'Where is the fire?',        visual:'smoke', keep:2},
 {id:'assess',   label:'Assess',          title:'How bad will it get?',      visual:'flame', keep:6 /* nothing folds: C2 says the lists stay visible beside the curve */},
 {id:'predict',  label:'Predict it',      title:'What will it do?',          visual:'flame', keep:1},
 {id:'respond',  label:'Put it out',      title:'What puts it out?',         visual:'flame', keep:2},
 {id:'flame',    label:'Flame lab',       title:'A flame without gravity',   visual:'flame', keep:1},
 {id:'explorer', label:'NASA experiments',title:'The NASA experiments',      visual:'earth', keep:1},
 {id:'evidence', label:'Checks',          title:'How we checked it',         visual:'earth', keep:1},
 {id:'ask',      label:'Ask',             title:'Ask a question',            visual:'earth', keep:1},
 {id:'models',   label:'Model cards',     title:'Model cards',               visual:'earth', keep:99, menu:'more', provenance:false},
 {id:'earth',    label:'On Earth',        title:'What does this mean on Earth?', visual:'earth', keep:3, menu:'more'},
 {id:'locate',   label:'Bench rig',       title:'Our bench rig',             visual:'smoke', keep:1, menu:'more', kicker:'Bench rig: camera'},
 {id:'about',    label:'Sources',         title:'Sources and credits',       visual:'earth', keep:2, menu:'more'},
 {id:'design',   label:'Design kit',      title:null /* keeps own h1 "Freefall" */, visual:'earth', keep:3, menu:'more'},
];  // doc title default `${label} · Vulcan Orbit`; kicker `${NN} / ${label}` over top pages, `More / ${kicker||label}` otherwise
```

- Route ids are unchanged from main. They are part of the data: `crosscheck.json` sources link to `#…` routes, and old share links such as `?atm=` and `?event=` must keep working.
- The `keep` values are the spec's D1.5 numbers. Main uses predict 3 and evidence 3; see open question Q3.
  - Assess is 6, so nothing on it folds. The spec says "pick a value", and C2 needs the curve, the three lists and the risk panel always visible.
  - On Earth is 3 and Model cards is 99, both new choices.
  - Bench rig is 1, as in the spec. Its first figure is "Bench rig: camera".
- The tour and `revealFigure` open folds, so a figure inside a fold is still reachable.

### 2.4 `js/router.js` and the page-module contract

```js
// js/pages/<id>.js
export default async function render(root, ctx) { … }   // append content to root; may await data
export async function short(ctx) { return ['…','…','…'] | null }   // optional: "The short answer" (replaces summaries.js)
   // a sentence whose file is missing is replaced by `<what> is not available yet (data/<file>.json missing).` (D1.4), never dropped silently.
   // overview.js and memory.js export no short(): Home renders its own short answer (with the language switch) from js/facts.js.
// ctx = { id, page /*registry row*/, params, detached:boolean, store /*js/store.js*/,
//         onMount(fn) /*after swap into #view*/, onLeave(fn) /*on next route: stop timers, rAF, workers, speech, subscriptions*/ }
```

The router exports `start()`, `go(id, params)` and `current() → {id, params}`.

`route()` runs these steps in order:
1. Parse the hash. An unknown id goes to `overview`. Set `#view[data-page=<id>]`, used to scope CSS (§0 rule 9).
2. Run the old route's `onLeave` callbacks, then `untip()`, `stopReading()`, close the menu (set `aria-expanded="false"`, fixing main's bug) and set `aria-current`.
3. `import('./pages/${id}.js')`, then `render(h('div'), ctx)`.
4. `runPasses` (§2.5).
5. Set `document.title`.
6. Swap the view inside `startViewTransition`, unless Calm.
7. Run the `onMount` callbacks.
8. If `params.fig` is set, call `revealFigure(params.fig)`. Otherwise call `#view.focus({preventScroll:true})` and `scrollTo(0,0)`.

If a page throws, show an error card ("This page failed to load" plus the stack). On `vo:rerender`, re-render and restore `scrollY`.

The nav has:
- the top items;
- a `More` disclosure button (`aria-expanded`, Escape closes it) listing the `menu:'more'` pages;
- the `Judge mode` button [NIS];
- the mobile `Menu` button.

### 2.5 `js/passes.js`: post-render passes and figure anchors

```js
runPasses(root, page, ctx, mod)          // fixed order:
  // 1 stagger: .card --i = min(index,10)
  // 2 provenance(root)                   unless page.provenance === false
  // 3 pageHead                           unless page.head === false: header.phead = [visual el, kicker, h1(page.title), lead]
  //                                      visual: page.visual==='flame' ? hero({g:0}).el : banner(page.visual); detached → static
  // 4 short answer                       lines = await mod.short?.(ctx) (try/catch) → section.short "The short answer"
  // 5 simplify                           .sub > 150 chars → first sentence (abbreviation-safe: et al., e.g., i.e., vs., decimals)
  //                                      + rest in "How this was made"; footnote-only <p><small> → "Notes and sources";
  //                                      blocks after page.keep → details.more "Show N more figures" + small
  //                                      "Methods, checks and extra views for people who want the detail"; toggle → resize event
  // 6 anchors + "On this page"           every top-level figure card (incl. folded) gets id fig-N, data-fignum=N, data-fig=slug(title);
  //                                      the visible "Figure N" label is CSS content:"Figure " attr(data-fignum), NOT a CSS counter
  //                                      (a counter skips cards in closed <details>, so the label would disagree with ?fig=N);
  //                                      nav.toc after the lead lists ALL of them; link href `#/${id}?fig=N`, click → revealFigure
  // 7 annotate(root)                     glossary; skips [lang]:not([lang=en]) scopes
  // 8 a11y                               .scroll tabindex=0 role=region aria-label "Table k: <figure title>"; empty th sr text;
  //                                      warn on canvas/svg without role/label
  // 9 console.warn for a charted card with no MADE entry
revealFigure(ref: number|string|Element, {focus = true} = {}) → boolean
  // opens every ancestor <details>, dispatches 'resize', scrollIntoView (smooth unless calm), focuses the card (tabindex=-1)
figLink(pageId, title) → `#/${pageId}?fig=${slug(title)}`     // fig= accepts N or slug; code should link by slug
figureCards(root) → Element[]
```

### 2.6 `js/overlays.js`: the ONE display-overlay module (written fully in phase 1)

Everything that changes how data looks without changing the data lives here, so `DECISIONS.md` can point at one file.

```js
export const SCRAPPED = {
  approved: false,                 // HUMAN CHECKPOINT (Q1): status.js/evidence use the lists only when true
  files: ['dome_locator', 'dome_sensor_count'],      // thermopile locator
  optional: ['response_trials'],   // ion-wind part scrapped, mist optional: banner says "optional", not "still to come"
  checks: ['E1', 'E2', 'E8'],      // shown as STATUS.scrapped, rows kept
  simChecks: ['D-dome'],           // drift_whatif dome heat check (thermopile/thermistor rig)
};
export const MANIFEST_WHAT = {     // display text for manifest rows whose `what` mentions ion wind
  response_trials: 'Bench mist trial, before and after (optional)',
  efield: 'NASA ACME E-FIELD Flames test days (PSI-22), shown as NASA context',
};  // "Where each number comes from": rows for SCRAPPED.files keep their manifest `what` but show badge('scrapped') instead of
    // 'No data yet' (when approved; before that, 'missing'), so nothing scrapped reads as "still to come".
export function scrubIonWind(text) → string     // drops sentences matching /\bion[- ]wind\b/i
export function efieldText(ef) → string         // scrubIonWind(ef.finding)
export function evidenceRows(evidence, {m6bResults, models}) → rows
  // E4: `Pass: M6b held-out MAE ${sig(kept)} mm/s [${lo}–${hi}] vs de Ris ${sig(B1)} mm/s [${lo}–${hi}]`
  //     ← models/m6b-predictor/results.json opposed.mae_mm_s / mae_range_95; row.overlay = that path
  // E5: `Pass: AUC ${score} [${lo}–${hi}]` ← data/models.json id m7-extinction score/score_range
  // E1/E2/E8 → state 'scrapped'; appends CV_PENDING
export const CV_PENDING = [
  {id:'CV1', what:'Fire detection rate on held-out frames',              owner:'Mukund', state:'pending'},
  {id:'CV2', what:'Flame size and position error on held-out frames',    owner:'Mukund', state:'pending'},
  {id:'OF1', what:'Optical-flow smoke track checked against the camera', owner:'Mukund', state:'pending'},
  {id:'CV3', what:'Distance from the sensor (depth model) error on held-out frames', owner:'Mukund', state:'pending'},
];  // CV3: plan v2 §2.1 lists the depth model and "distance from the sensor" as dome outputs, and §10 forbids any accuracy we have not measured  // ref 'Dome camera, held-out frames'; limit 'To be written in RULES.md before testing'; no numbers
export function askAnswer(item) → {a, showMatched}   // efield: scrubIonWind(a); ionwind: showMatched=false
export const hideGoldRow = g => /\bion[- ]wind\b/i.test(g.q)   // scored, not listed (Q4)
export function kbPassage(p) → p                     // scrubIonWind on text before llm.js sends it
```

### 2.7 `js/provenance.js` and `js/glossary.js`

```js
// provenance.js
export const PSI = { flex, cfi, saffire, bassRep, same, efield, air }      // verbatim (shell.md §14)
export const MADE = { '<exact figure title>': {kind, how, inputs?, check?, files, cred?, models?: ['models/<folder>', …]} }
export const FACTORS = [['ver','Verification',q], ['val','Validation',q], ['inp','Input pedigree',q], ['unc','Uncertainty',q], ['rob','Robustness',q]]
export const CRED = { <key>: {ver, val, inp, unc, rob /* 0-4 | null = "not rated" */, why, draft?: true} }
export function provenance(root)                 // details.madeby after .sub (or h2); cred strip; dl Method/Inputs/NASA data/Files
export function madeFor(title) → entry | null    // exact, then norm() (strip trailing " (FLEX|CFI|SAME|BASS-II)")
export function registerMade(title, entry)       // escape hatch for a later package; the lead folds these into MADE in phase 7
// glossary.js
export const TERMS = { …24 verbatim incl. 'R²', + 'CV model', 'optical flow', 'de Ris', 'calibration box' }
export function annotate(root); export function define(key) → string
```

- All 40 MADE entries from main are copied verbatim.
- The `models` field is new. Phase 7's C9 check uses it to confirm that every `models/` folder appears on a rendered page.
- The "How big does it get…" entry is reworded from "stepped over a fuel grid" to "front computed from exact arrival times on a fuel grid" (models.md §5.1).
- MADE entries for every **new** figure title in §3 are written in phase 1 by P1-C, so the titles in §3 are frozen.
- CRED is copied verbatim, including the m6 and m6b entries; see Q2.
- The 4 new glossary definitions are one-line drafts, marked "team to check" in DECISIONS.

### 2.8 `js/store.js`: the shared Assess store (in memory, mirrored to the URL query)

```js
// AssessInputs = {
//   preset: string|null,                       // growth_examples example id
//   flame: {flame_type:'surface'|'droplet', frame_time_s, area_cm2, centroid_cm:[x,y], bbox_cm:[x0,y0,x1,y1],
//           droplet:{diameter_mm}|null, confidence:number|null, source:'sliders'|'preset'|'camera'|'example'},
//   fuel: {material, width_cm, length_cm, thickness_mm, sides_burning:1|2, area_density_mg_cm2?},
//   conditions: {flow_cm_s, flow_direction_deg, o2_vol_pct, pressure_atm} }
get() → AssessInputs (deep copy)            set(patch, {url = true} = {})   // shallow-merges each group; notifies
subscribe(fn) → unsubscribe                 fromPreset(example) → AssessInputs   // example.inputs + preset id
initFromURL(params, examples)               // once per page load: query → state, else preset 'sibal_concurrent_panel'
applyFlameState(obj, source) → {ok, errors:[string]}
   // validates the CONTRACT_PROPOSAL flame-state shape (coordinates === 'fuel', finite numbers, flame_type enum);
   // never fills partially
toQuery(state) → string                     fromQuery(params) → Partial<AssessInputs>
// query keys: pre ft(s|d) a x y bb(x0,y0,x1,y1) dd t0 m w l th sd ad u dir o2 p
```

- **Area slider rule.** Moving area or position keeps the current bbox aspect ratio, from the preset or camera, and rescales the box to the new area. With no box, it uses a circle (a = b = √(area/π)).
- This shape assumption is shown on Assess in the "assumed" list.
- `set()` mirrors to the URL only when the current route is `assess` or `respond`. Links from Assess to Put it out carry `?${toQuery()}`.

### 2.9 Growth port: `js/growth.js`, `js/growth_run.js`, `js/growth_worker.js`

```js
// growth.js (pure, no DOM, importable by Node)
simulateGrowth(flameState, fuel, conditions, C, opts = {}) → Output | DropletPointer
   // opts.dxCm: number | [dx, dy] (default min(0.25, L/200, W/4)); opts.nSamples default 301
   // throws Error(`material '${m}' is not modelled (PMMA, SIBAL, cotton)`) before anything else
// Output (GROWTH_API.md + code's extra notes:[]):
//  {status:'model', flame_type:'surface', units:{time:'s',area:'cm2',rate:'mm/s',length:'cm'},
//   verdict:{code, label, by_direction:{opposed, concurrent}, matched_cases:[{case_id,status,level,outcome,flow_direction}]},
//   rates_mm_s:{lo|mid|hi:{opposed, concurrent, cross_flow}}, burnout_s:{lo,mid,hi},
//   grid:{dx_cm, dy_cm, nx, ny, initial_area_cm2}, t_s:[], t_abs_s:[], area_cm2:{lo:[],mid:[],hi:[]},
//   summary:{lo|mid|hi:{max_area_cm2, t_max_s, t_end_s, area_consumed_cm2, stop_reason}},
//   calibrated:[], extrapolated:[], assumed:[], notes:[], limits:'…'}
// DropletPointer = growth.py droplet_pointer() text verbatim (models.md §3.5), incl. frame_time_s, values:null
spreadRates(fuel, conditions, C) → {regime, raw_de_ris_mm_s, opposed:{lo,mid,hi,in_domain,calibration}, concurrent:{…}|null}
verdict(fuel, conditions, C) → {code, label, by_direction, matched_cases}
dropletPointer(flameState); VERDICTS = ['spreads','near observed extinction','observed no-spread']
// growth_run.js
runGrowth({flameState, fuel, conditions, C, opts}) → Promise<Output>   // module Worker if available, else sync;
                                                                        // rejects with the same Error message
```

- Port every point in models.md §3.4 **exactly**:
  - the defaults;
  - inclusive boxes with a ±1e-9 tolerance;
  - a strict `thin > thick`;
  - the order of the `u == 0` override;
  - the fallback cell found by searchsorted;
  - `1e150` as BIG;
  - upper-bound binary search;
  - the first argmax;
  - `Number(x.toPrecision(n))` rounding (4 s.f. for rates, burnout, areas and summary; 6 for dx, dy and t_s; 8 for t_abs_s);
  - the verbatim label strings.
- Constants come only from `data/spread_predictor.json` → `constants`.

### 2.10 `js/assess_core.js`: assessment and risk (pure, async; used by Assess, the response card and short answers)

```js
loadAssessData() → Promise<{sp, examples, lat, whatif, dw, rules, gaps, m7, flex, cv}>   // cv = load('cv_latest')
computeAssessment(inputs, data) → Promise<{
  kind: 'growth'|'droplet'|'unsupported'|'invalid', growth?, pointer?, error?,
  boxes: [{field, value, lo, hi, inside}],   // the inputs checked against the calibration box of the active regime/material
  detection: { radiometer_s, smoke_s:[min,max], obscuration:'never'|number,          // saffire_latency (burns with a radiometer alarm)
               cabin: {layout, caught_60, caught_120, caught_300, range120},        // whatif layouts
               lbm:   {layout, caught_60, caught_180, range60, range180} },         // drift_whatif best layout (name it, never merge)
  risk: { level:'Low'|'Elevated'|'High', fired:{id, reason}, evaluated:[{id, level, matched, reason, values}], approved:boolean },
  sentences: [string] }>                     // Assess short answer
riskLevel(parts, rules) → risk               // first matching rule in file order; default from rules.default
nearestProbe(gaps, o2, kpa) → probe
```

Rules (`data/risk_rules.json`, status `team`):
- Compare computed values with each other where possible. An example: "the hi-run fire is still growing at the slowest cabin smoke-detector alarm" compares `summary.hi.t_max_s` with `smoke_s[1]`.
- A threshold number is used only when there is no alternative. It is then labelled as a team choice in the rule's `reason`.
- The panel shows "Rules are a team choice, to be approved" until `approved: true`.

### 2.11 Other shared modules

| Module | Exports | Notes |
|---|---|---|
| `prefs.js` | `prefs.get/set(k)` (keys theme, size, terms, motion, lang; `vo.` prefix, try/catch), `applyPrefs()`, `dock()`, `stopReading()` | The dock and read-aloud are verbatim from main's theme.js. `vo:rerender` fires on theme and motion changes; `vo:prefs` fires on any change. |
| `status.js` | `statusBanner(manifest, SCRAPPED)` | Counts `demo` and `missing`, minus scrapped files (only when approved), with `optional` files listed separately. Drops main's "mostly from our bench rig". |
| `i18n.js` | `loadI18n()`, `t(key, vars, lang)`, `langSwitch({scope, onChange})`, `draftNote(reviewed)` | English, తెలుగు and हिन्दी buttons with `aria-pressed`. Sets `lang` on the scope. Number values are passed in from the same computed values as the English text. |
| `mission.js` | `coverageLine(gaps)`, `missionCheck(gaps)` | Verbatim [NIS]. Keeps `?atm=`, written back with `setParams`. Changes from main: the `mc-body` loses its own `aria-live`, and a chip change calls `announce()` (D5.9: one live region). The "See the full map of what NASA has tested →" link uses `figLink('predict','What NASA has not tested')`, because the map sits in a fold. |
| `tour.js` | `startTour()`, `tourButton()` | The 5 stops' text verbatim [NIS]. Targets are `[page, target, title, text]`. `target` is a figure slug, revealed with `revealFigure`, which fixes the fold bug, or `{sel}`, a CSS selector. Stop 1 is `{sel:'.tick'}` on Home, which has no figure anchors. Stops 2 to 5 are the slugs of "Replay an orbital fire", "The alarm can come after the gas", "Will it spread, and how fast?" and "Can you trust this?". The tour returns focus on close. |
| `facts.js` | `detectFacts(lat, gas) → {vars:{n_fires, rad_s, smoke_min_s, smoke_max_s, obs_never, co_over, co_tests}, en:[string]}` | Written by P3-D. The one place the three detect sentences are computed (shell.md §8). Used by Home (P3-D), `detect.js` `short()` (P4-A) and the te/hi templates (P5-G), so all three languages and both pages print the same numbers. Missing file → `vars` has `null`s and `en` says the file is missing. |
| `ask_match.js` | `STOP`, `words`, `MIN_SCORE`, `match(q, items)` | Verbatim (inventory pages_respond_flame_ask.md §3). Do not merge with llm.js's stopwords. |
| `llm.js` | `retrieve`, `unbacked`, `askAI` | Verbatim copy of main. Off while `assistant_config.endpoint` is null. |
| `gl_hero.js` | `hero({g, fit, ctx}) → {el, ok, setG(v, now)}` (starts in `ctx.onMount`, stops in `ctx.onLeave`; static when `ctx.detached`) | Phase 1 stub: static SVG plus the fallback sentence. Phase 6: the WebGL 2 shader from main, keyboard turn (←/→), Calm re-checked every frame, the label "Illustration, not data". |
| `gl_banner.js` | `banner('earth'\|'smoke', ctx) → el` | As above. |
| `bg.js` | `startBackground()`, `stopBackground()` | Clears the canvas when Calm is on (fixes main's frozen last frame). |
| `clock.js` | `ticking(lat, {dark, ctx}) → figure.tick` | Phase 1: static final state. Phase 6: 10× playback, Play/Pause/Replay, no autoplay in Calm. The `.tick` selector is kept. |

### 2.12 Figure modules (each figure is a function returning `section.card`; every title is a MADE key)

| Module | Exports |
|---|---|
| fig_detect.js | `replayCard(lat, params, ctx)`, `gasCard(gas)`, `rateCard(ror)`, `sensitivityCard(sens)`, `blindSpotCard(lat)`, `smokeMissCard(smoke)`, `daftCard(daft)` |
| fig_drift.js | `driftCard(d, {title, sub}, ctx)`, `whatifCard(w)`, `calibrationCard(c)`, `robustCard(w)`, `lbmWhatifCard(dw, lx, ly)`, `lbmAgreement(dw) → string\|null` (parsed from the X-agree check text) |
| fig_cabin3d.js | `cabin3dCard(d, ctx)` (WebGL started in `ctx.onMount`) |
| fig_spread.js | `spreadCard(sp, opts)`, `growthCard(examples)`, `m6bCard(sp, res)`, `m6bSpreadChartCard(sp, opts)` |
| fig_models.js | `modelCard(entry)` (the stamp is `entry.status`, fixing main's bug), `m6Card(entry, m6res)` (findings first) |
| fig_gaps.js | `gapCard(g)`, `nextExperimentCard(g)`, `moonMarsCard()` |
| fig_respond.js | `coverageCard(gaps, inv?)` (optional `investigations.json` for DOIs; added in phase 4), `extinctionCard(m7)`, `coolFlameCard(m7)`, `flexCard(flex, m7)`, `efieldCard(ef)`, `mistTrialCard(tr)`, `readingCard()`; also `mistRows(tr)` (phase 4, reused by On Earth) |
| fig_response.js | `responseEvidenceCard(data, store, ctx)` (C4) |
| fig_assess.js | `inputsCard(store, data, ctx)`, `cameraCard(store, data)`, `outputsCard(result)`, `listsCard(result)`, `riskCard(result, rules)` |
| flame_sim.js | `flameSimCard(fs, gaps, ctx, {showMM})` |
| fig_flame.js | `flexKCard(fs)`, `spreadCurvesCard(sp, {showMM})`, `survivalMapCard(sp, {showMM})`, `frontsCard(sp)`, `flameChecksCard(fs, sp)`, `flameLimitsCard(fs, sp, {showMM})`, `moonMarsSwitch(onChange)` |
| fig_checks.js | `trustCard(t)`, `crosscheckCard(c)`, `permutationCard(p, models)`, `checksCard(rows)`, `simChecksCard(fs, sp, dw)`, `manifestCard(m)`, `knownLimitsCard()` |
| fig_modelcards.js | `modelSection(spec, data)`, `MODEL_SECTIONS` (10 rows; see §3.10) |
| fig_bench.js | `benchExplainCard()`, `cvLatestCard(cv)`, `pendingCard(kind)`, `doesNotShowCard()`, `plannedCard()` |

---

## 3. Feature map (old → new; every spec Part C item and every plan v2 item)

A figure title in quotes is the exact `h2` text and its MADE key. A title with no note is unchanged from main.

### 3.1 Shell and shared

| Old feature | New home | Action |
|---|---|---|
| Skip link, header brand SVG, tagline, `#tip`, meta/title/description, fonts (5 families) | index.html | KEEP verbatim. NEW: the single polite live region `<div id="live" class="sr" aria-live="polite">` that `announce()` writes to; `#view` gets `tabindex="-1"` |
| Menu button `aria-expanded` | router.js | KEEP; reset it on every route (fixes a bug) |
| Nav from PAGES, `aria-current` | router.js + site.js | EXT: Assess after Find it; NASA experiments in the top bar; "More" menu (Model cards, On Earth, Bench rig, Sources, Design kit) |
| Judge mode button and tour (5 stops) [NIS] | router.js, tour.js | KEEP; opens folds through `revealFigure` |
| Status banner (an IIFE in app.js) | status.js + overlays.SCRAPPED | REPL wording; no scrapped files counted (C7, Q1) |
| Footer (mark, line, accessibility sentence, links incl. Model cards [NIS]) | index.html | EXT: adds On Earth; the footer links match the More menu |
| Router: dynamic import, unknown → Home, title, view transition, error card, focus, `vo:rerender` | router.js | KEEP |
| Post-render passes (stagger, provenance, pageHead, short answer, simplify, glossary, a11y) | passes.js | KEEP, plus "On this page" (the list main built but never added), `?fig=`, abbreviation-safe sub split (fixes the "Urban et al." cut) |
| summaries.js short answers | `short()` in each page module | REPL, same sentences. Reworded: respond line 3 ends "Bench mist trial: not completed."; the evidence line counts scrapped rows separately |
| Null-dropping DOM prototype patch [NIS] | `h()`/`add()` filtering | DROP: global monkey-patching; the phase 7 crawl checks for stray "null" |
| `params()` URL state [NIS] | lib `params`/`setParams` | KEEP: `?event=`, `?atm=`, `?fuel=&o2=&flow=`, plus new `?fig=` and the Assess keys |
| lib h/load/badge/card/empty/fmt/page/tip | lib.js | EXT: badges and styles for all 8 statuses plus scrapped (main lacked plan and team) |
| charts (4 types, palettes, SCREEN, Day/Night) | charts.js | EXT: keyboard nav, "Show the numbers", dashes and shapes |
| Read your way dock (theme, size, terms, motion, read aloud, `vo.` storage) | prefs.js | KEEP verbatim; `calm()` is now used |
| Glossary (24 terms incl. R² [NIS]) | glossary.js | EXT: + CV model, optical flow, de Ris, calibration box; no ion-wind terms |
| Provenance MADE (40), PSI, FACTORS, CRED (incl. m6, m6b [NIS]) | provenance.js | EXT: new entries for every NEW title below, plus the `models` field |
| "Can you trust this?" (trust.js) [NIS] | fig_checks.trustCard | KEEP (Checks; tour stop 5) |
| Hero, banners, background, clock | gl_hero, gl_banner, bg, clock | KEEP. Phase 6 adds the fallback sentence, the label "Illustration, not data" and Pause |
| `js/flame.js` particle lab (dead) | — | DROP (grep-verified, spec D4) |
| `css/v2.css` (never loaded) | — | DROP |
| app.css + freefall.css tokens, components | tokens/base/components.css | KEEP: values verbatim (shell.md §15) |
| optional live AI (llm.js + worker/) [NIS] | llm.js, pages/ask.js | KEEP: the existing optional mode; worker/ untouched; plan section 7 |

### 3.2 Home `#/overview` (pages/overview.js, mission.js, clock.js, gl_hero.js, i18n.js)

| Old | New | Action |
|---|---|---|
| Hero: kicker, h1 "In orbit, fire doesn't rise. *It hides.*", lead, CTAs "Start with the fire", "Take the 1-minute tour" [NIS], "How we checked it" | overview | KEEP |
| Porthole figure (ring, 72 ticks, text path, In orbit/On Earth toggle, caption) | overview + gl_hero | KEEP; the WebGL fallback sentence stays |
| — | "From camera to risk" pipeline strip: camera → growth simulation → risk and response; one sentence each; links `#/locate`, `#/assess`, `#/assess?fig=risk…`, `#/respond` | NEW (C8, plan §1) |
| "The finding": computed headline, obscuration line, ICES-2024-365 sentence, clock, links | overview + clock | KEEP. "Replay the real sensor data" becomes `figLink('detect','Replay an orbital fire')`. The headline numbers come from `facts.detectFacts().vars` |
| — | Home short answer (the 3 detect sentences, computed) with the English/తెలుగు/हिन्दी switch | NEW (#25). The sentences and their numbers come from `facts.detectFacts()` (§2.11), so Find it's short answer and the te/hi strings use the same values. P3-D ships English only; P5-G adds the switch. |
| The three questions 01/02/03 with stamps | overview | KEEP, with 03 reworded (no ion wind). The stamps become flex_suppression, m7_explorer and "Bench mist trial (optional)" ← response_trials |
| — | Links to Assess and Flame lab next to the three questions | NEW (D5.5) |
| Coverage line ("6 of 9", computed) and "Mission check: is there NASA data for your cabin air?" [NIS] | mission.js | KEEP; `?atm=` |
| "How to read this site" (stamp legend) | overview | EXT: legend adds plan, team and dome |
| India card ("Why this matters for India's own crew and station"), facts, not found, checked | overview | EXT: `d.levels` legend shown (it was unused); language switch (#25) |
| Dead code: `fine`, `stage`, `kf`, unused loads | — | DROP |

### 3.3 History `#/memory` (pages/memory.js, clock.js)

Port every element verbatim: reel header, plaques (KIND map), clock block "In a sealed cabin, fire is measured in seconds.", dedication, the foot line "We show no photographs of accidents and quote no last words." (KEEP). A missing file now shows the standard `empty()`.

### 3.4 Find it `#/detect` (fig_detect.js, pages/detect.js)

The block order follows spec D3, with `keep` 2. The tour stops 2 and 3 are the first two figures.

| # | Figure title | Action |
|---|---|---|
| 1 | "Replay an orbital fire" (#24) | KEEP: `?event=` default Sample 1. NEW: the slider label "Time after ignition, s" with a seconds value, Play/Pause, a lane-value table fold, footnote wording "stated on the Blind Spot panel" |
| 2 | "The alarm can come after the gas" | KEEP: the SVG aria-label includes "crew limits"; adds a text marker "over limit" (not colour alone) and `numbers()` |
| 3 | 'Would a "fast rise" alarm be quicker?' | KEEP: the failed-rule text is shown |
| 4 | "Does the alarm rule change the answer?" [NIS] | KEEP: values shown as in the file (0.5 s offset noted in DECISIONS) |
| 5 | "Blind Spot: who alarms first?" (#1) | KEEP (CAP 2, ±resolution, looser threshold, gap sentence, verbatim footnote) |
| 6 | "Smoke the detector misses" (#2) | KEEP (chips 300/500/1000, default 500); fixes the sub cut; shape plus colour |
| 7 | "Dust or smoke? Checking the counter first" (#7) | KEEP; NEW MADE entry |
| — | A link under 6: "Where should detectors go? See the what-if runs" → `figLink('predict','What if the fire starts somewhere else?')` | NEW (#6) |

### 3.5 Assess `#/assess` (NEW; fig_assess.js, assess_core.js, store.js, growth_run.js, pages/assess.js; stamp `model`)

| Figure title | Content | Plan item |
|---|---|---|
| "Flame now, fuel and cabin" | Flame: area (cm²), x and y (cm), surface or droplet. Fuel: PMMA, SIBAL or cotton ("not supported" for anything else), W, L (cm), thickness (mm), sides. Cabin: airflow 0–50 cm/s with its direction, O₂ 15–35 %, pressure in atm. Each slider has a number field, units and min/max. Preset select from growth_examples. **Slider bounds the spec does not give** (pressure, width, length, thickness, area, x, y) are never typed in. Pressure, width, length and thickness span the smallest and largest values found in `spread_predictor.constants.*.domain`, the growth_examples inputs, and `gaps.probes` kPa ÷ 101.325. Area, x and y are bounded by the fuel's own W × L. The derivation is printed under the slider and listed in DECISIONS. Values outside the calibration box stay allowed and are flagged. | C2, B6 |
| "Load from camera" | JSON file input plus a paste box → `applyFlameState`, with errors listed. On load, `cv_latest`, or "Camera model not connected yet: using the sliders". The "Try an example camera reading" button uses `cv_example` (stamped demo). Shows "Smoke flow at the dome" if cv_latest carries the proposed field (information only). | C2, #27, #28 |
| "Will it spread here?" | The verdict label, the matched NASA cases (case id, status stamp, outcome, `record_as_written`), out-of-box flags per field | C2 |
| "Burning area over time" | lineChart of lo, mid and hi (dashes plus a band) with markers for the radiometer alarm (7 s) and the smoke detector (92–127 s); stats for max area [lo–hi], time to max, end time and stop reason. The x axis is `t_abs_s`. The marker label must say these are times after ignition on NASA's Saffire-III burns, a different fire, shown for scale and not as a prediction for this one. The risk rules that compare growth times with alarm times carry the same caveat in their `reason`. | C2, #29 |
| "What is calibrated, extrapolated and assumed" | The three lists from the output, always visible beside the curve (not folded), plus the bbox-shape assumption | C2 |
| "Risk: the parts and the rule that fired" | Max size and range, time to max, detection (radiometer, smoke detector, whatif and LBM shares, named), fuel and verdict; level Low/Elevated/High; the rule that fired and why; every rule evaluated; banner "Rules are a team choice, to be approved"; stamp `team` | C3, #31 |

- One `announce()` per change of verdict or level.
- Droplet input shows the M7 pointer text and no number.
- A "Take this to Put it out" link carries the query.
- `short()` gives the computed sentences.
- `keep` 6, so nothing folds.
- Both `assess.js` and `respond.js` call `store.initFromURL(ctx.params, examples)`. It is idempotent: it runs once per page load, whichever page is opened first.

### 3.6 Predict it `#/predict` (fig_drift, fig_cabin3d, fig_spread, fig_models, fig_gaps, pages/predict.js)

Order: 1 grid [drift + whatif] (visible), then the rest folded. The tour stop 4 targets `.sp-grid` in "Will it spread, and how fast?" and opens the fold.

| # | Figure title | Action |
|---|---|---|
| 1 | "Where the smoke goes" (#8) | KEEP; Play/Pause with `type=button` and `aria-pressed`; text summary plus a table of detector values for the current frame; never autoplays |
| 2 | "What if the fire starts somewhere else?" (#6, #26) | KEEP; empty state if the file is missing; the blind-spot map gets `keyNav` |
| 3 | "Walk around the smoke (3D)" [NIS] | KEEP; reads `scale_max_mg_m3`; keyboard rotate; WebGL fallback; Calm |
| 4 | "Checked against a real spacecraft fire" | KEEP; the fail stays shown |
| 5 | "What actually decides if a fire is caught?" | KEEP (rendered when `whatif.robustness` exists; it no longer depends on drift_calibration) |
| 6 | "Second opinion: a cabin with racks" | KEEP; "94%" read from `lbmAgreement(dw)` |
| 7 | "What if the fire starts somewhere else? (cabin with racks)" | KEEP |
| 8 | "Will it spread, and how fast?" [NIS] (#9) | KEEP: `?fuel=&o2=&flow=`; the sliders announce % and cm/s; the verdict labels come from `verdict_codes`; keyNav on the heatmap |
| 9 | "How big does it get, and when does it stop?" [NIS] | KEEP; adds a legend, `numbers()` and a link "Run your own on Assess" |
| 10 | "M6b spread predictor: score and calibration box" | NEW (C9). Shows MAE 0.020 [0.015–0.023] against de Ris 0.163 [0.104–0.228] and the B2 M6 baseline, from `models/m6b-predictor/results.json`. Also: coverage 87 %, the independent Saffire-II and film points (results.json `independent`), the verdict boxes (`constants.verdict.cases` table), the calibration-box table, drivers "not computed", and the Decision 15 disclosure. Not added to models.json. |
| 11 | "Spread rate against airflow: M6b vs de Ris" | NEW (#9): `spreadRates()` swept over 0–50 cm/s at a chosen O₂ and fuel; M6b mid line plus lo–hi band, raw de Ris dashed, out-of-box points hollow |
| 12–16 | Model cards from models.json: "Droplet flame goes out (FLEX)", "Droplet burning rate (FLEX)", "Burns on invisibly after the flame goes out (CFI)", "Will the detector miss this smoke?", "Flame spread over PMMA slabs (BASS-II)" | KEEP. The stamp is the entry's own status. Point ranges are shown as error bars. M5's card states its pass-rule failure. M6 leads with findings: "de Ris over-predicts about 3.5-fold" (1/`de_ris.median_obs_over_pred` from models/m6-spread/results.json) and "NASA recorded no-spread cases" (`no_spread_cases` counts), keeps the R², and links to the M6b card. |
| 17 | "What NASA has not tested" (#14) | KEEP; keyNav plus a points/probes table |
| 18 | "Next experiment worth running" | NEW (#14, AstraFlame): probes ranked by the sum of `counts`, the rule shown, the top probe turned into a sentence with its `verdicts` text (matched with `startsWith`); stamp `team` ("team rule") |
| 19 | "Moon and Mars" (#12) | KEEP text; stamp `team` |

### 3.7 Put it out `#/respond` (fig_respond.js, fig_response.js, pages/respond.js)

| # | Figure title | Action |
|---|---|---|
| 1 | "What does the evidence cover for this fire?" | KEEP. Link labels become Find it, Put it out and Flame lab with `figLink`; adds an Assess link for solids; group labels fixed |
| 2 | "Response evidence for this fire" | NEW (C4, #18, FlameAtlas). Reads the store: FLEX shares and the M7 50 % O₂ points; flames going out at low airflow (M6b verdict and matched cases); untested (nearest `gaps` probe, with a gap flag when n = 0); urgency (the C3 level). Each line has a stamp. "A summary of evidence, not a flight procedure." Atmosphere chips (B6). |
| 3 | "When does a droplet flame go out?" (#10) | KEEP; adds keyNav and a table |
| 4 | "Looks out, still burning: cool flames" (#11) | EXT: draws the 50 % pressure marker (3.22 atm) as `xMarkers` (the code never drew it); AUC shown with its range |
| 5 | "NASA: which gas puts a droplet flame out" (#17) | EXT. FLEX shares ("None" relabelled "nitrogen only, no added suppressant"), "N of M tests", beside the M7 50 % O₂ point for each added gas. The source's "not a controlled comparison" sentence is quoted visibly, not folded. |
| 6 | "NASA: flames in an electric field" | KEEP as NASA context only: `efieldText()`, `quotes.objective`, `totals`, humanised headers and units. Listed in DECISIONS for keep or cut. |
| 7 | "Bench mist trial" (#16) | REPL "Bench trials: ion wind and fine mist". Shows "Bench mist trial: not completed" unless `response_trials` is status `dome`; then mist rows only, bars plus table. The new schema has no ion-wind or thermopile text. |
| 8 | "Reading the comparison" ("Where the two meet") | KEEP; reworded for the mist trial; the two sources are shown side by side and never merged |

### 3.8 Flame lab `#/flame` (flame_sim.js, fig_flame.js, pages/flame.js)

- **"Show Moon and Mars (model only)" switch.** NEW (#30, C10). It is a single `aria-pressed` toggle, off by default, that drives figures 1, 3 and 4.
  - Moon and Mars cases are drawn dashed or hatched, with `gravity_note` printed beside them and a "model only" stamp.
  - This is the only place on the site where Moon or Mars values appear.
  - The short answer line and the Limits line are reworded to match.

| # | Figure title | Action |
|---|---|---|
| 1 | "Flame simulator" | KEEP: all rendering constants verbatim; 6 stats; "Inside/Outside NASA's data" note [NIS], reworded to "test conditions". NEW: Pause, Calm (renders one frame), a text summary and a stats table |
| 2 | "Droplet burning rate vs NASA FLEX" | KEEP: tune vs held-out shown by shape; the "which wins" sentence computed |
| 3 | "How fast flame crosses a solid" | KEEP; nulls shown as gaps, not 0 |
| 4 | "Where a flame can survive" (B6, FlameAtlas) | EXT: a theme-aware canvas; vent band 0.077–0.203 m/s with the `// source: NTRS 20150009509 p.10` comment; 21 % and 34 % lines; keyNav; a min-O₂ table. NEW hidden-risk band (samuelakosa): cells where `burning[O2=0.21]==0 && burning[O2=0.34]==1`, each contiguous run drawn (usually 2 segments), labelled "model". If a run is empty, nothing is drawn and the reason is logged. |
| 5 | "A fire growing across a sample" | KEEP |
| 6 | "Every check on the flame model" (#22) | KEEP |
| 7 | "Limits" | KEEP; the Moon/Mars line is reworded to match the switch |

### 3.9 NASA experiments `#/explorer` (pages/explorer.js; in the top menu) — "Find and rank"

| Plan item | Action |
|---|---|
| B1 search and filters | KEEP: search over name, measured, fuel and facility; focus chips. The card sub is `inv.source` (main read `inv.note`, which does not exist) |
| B2 mission ranking (5 missions) | KEEP: the disclosure line stays, plus a note that this is relevance weighting, not a prediction |
| B3 attributes | NEW: each row has an expand `<button aria-expanded>` showing focus, fuel, facility, measured, rows, tags, PSI link and DOI link. It adds the tested O₂ and pressure range from `gaps.tested`, matched **by PSI id**, because the names differ (DECISIONS). The other fields show "Not in our table yet" for goals, sample shape and variables; that gap list goes in DECISIONS for the data owner. |
| B4 side by side | KEEP: selection by a `<button aria-pressed>` per row (keyboard), at most 2 |
| B5 "Group by hardware" | NEW toggle. The prefix rule maps every facility to Combustion Integrated Rack (ACME, MDCA), Microgravity Science Glovebox (incl. the SPICE flow duct), Cygnus or ISS cabin; all 17 map. The rule is shown on the page. |

### 3.10 Model cards `#/models` (fig_modelcards.js, pages/models.js) [NIS on main, EXT per #23]

The page has one section per model: M3 smoke drift (grid model in engine/ and the LBM in models/m3-drift), M4 alarm timing (with the rate-of-rise extension), M5, M6, M6b, M7 extinction, M7 burning rate, M7 cool flame, Flame simulation, and CV model and optical flow (pending, `empty`).

Each section shows:
- question, data, method, how it was tested, score with its range, baseline, drivers ("not computed" for M6b), limits;
- pass-rule results;
- main's SCOPE "Use it for / Not for" text, verbatim;
- the luck p-values from trust.json;
- the trust strip.

Sources are `data/models.json`, `data/trust.json`, `data/spread_predictor.json` and every `models/*/results.json` through `loadPath`. Numbers are never copied from the plan; disagreements with the plan's "Results so far" go to REPORT (the known ones are models.md §1).

Fixes and notes:
- The kicker and title read "Model cards", fixing main's "Design kit".
- A missing trust.json no longer crashes the page.
- `provenance:false` avoids duplicate Made-by blocks.
- Footer: "Format after Mitchell et al. (2019)…" (KEEP).

### 3.11 Checks `#/evidence` (fig_checks.js, pages/evidence.js)

Order: "Checks" (visible, `keep` 1), then "Can you trust this?" [NIS], "NASA says / we get" [NIS], "Could the scores be luck?" [NIS] (its paragraph is computed), "Simulation checks" (D-dome shown as scrapped), "Where each number comes from" (MANIFEST_WHAT overrides plus each file's badge, including the 4 new files) and "Known limits" (the bench line is reworded for the camera rig; "line of sight" becomes "a camera seeing a flame is not a guarantee of detection").

"Checks" goes through `evidenceRows()`:
- E4 and E5 filled with their source path shown;
- E1, E2 and E8 shown as "Scrapped (see plan v2)" and not hidden;
- CV1, CV2 and OF1 as pending rows (owner Mukund).

This covers #22 and AFAQ's "a slice of tests".

Short answer: "We wrote down N checks… P passed, F failed, T are still to run, and S were scrapped with the old bench rig (see plan v2). Failures stay on the page. That is the point."

### 3.12 Ask `#/ask` (ask_match.js, llm.js, pages/ask.js)

Port these unchanged:
- "Questions" (#20): buttons for answer items only, search, Ask;
- "Answer": stamp, "Matched to", answer, "Numbers from", sources;
- "Assistant scorecard" (#21): live through the same matcher, so 93 % stays;
- "How the assistant is kept honest";
- the optional live mode (plan §7, phase 8).

Changes:
- **NEW:** the answer panel uses `announce()`.
- **NEW:** keep all 22 items in the matcher. Show the `efield` answer through `askAnswer()`, with the ion-wind sentence removed. The `ionwind` refusal shows its refusal text with no "Matched to" line. The gold question about ion wind is scored but not listed, with a footnote saying so (Q4).
- **EXT:** the line "No language model writes answers at run time" stays true while the endpoint is null. If the endpoint is set, it switches to the live-mode sentence, as main's footnote already does.

### 3.13 Bench rig `#/locate` (fig_bench.js, pages/locate.js) — REPL per C5

| Figure title | Content |
|---|---|
| "Bench rig: camera" | A plain-words explanation of the CV model (fire detection, flame size and position, depth or distance) and the optical-flow smoke sensor (#27, #28) |
| "Camera reading now" | Shows `cv_latest` when it exists; otherwise a pending empty state. Shows the dome outputs plan v2 §2.1 names (fuel source, flame size or volume, distance from the sensor) only if the file carries them; each absent field reads "Not in the camera file yet". Their proposed optional field names go in CONTRACT_PROPOSAL with the flame state. |
| "Depth: distance from the sensor" | Pending empty state (CV3, owner Mukund). No accuracy figure until measured (plan v2 §10) |
| "CV detection rate and size error" | Pending empty state (owner Mukund) |
| "Optical-flow smoke track" | Pending empty state |
| "What this does and does not show" | KEEP, reworded: runs at Earth gravity; does not reproduce a microgravity flame |
| "Planned, not built" | Closed loop (#19), status `plan`, never shown as a result |
| "Bench mist trial" | Imported from fig_respond (#16) |

The old "Where the locator put the source" and "More sensors, less error" are DROPPED (C5, plan v2 features 3, 4 and 5 removed).

### 3.14 Sources `#/about`, On Earth `#/earth`, Design kit `#/design`

- **Sources (B10).**
  - "NASA data used" is KEEP, generated from `investigations.json` psi and doi, so it adds PSI-47, 39, 159, 22, 10 and 26 and fixes the PSI-102 and PSI-99 DOIs. The M6b sources come from `spread_predictor.sources`.
  - "NASA papers we checked numbers against" is KEEP, plus Meyer et al. 2018.
  - "Use of AI tools" is KEEP, with "Team to edit before submission" and one line on the optional live mode.
  - "Not NASA" is KEEP.
  - "Site map" is NEW (D5.4). It renders every page detached and lists each page and figure title as a `figLink`; built at idle, with "Building site map…".
- **On Earth (B9).** Three cards from `data/earth_apps.json` (status `team`):
  - "Water mist": FLEX suppression, plus the mist trial (not completed). The India Gaganyaan water-mist fact is **not** used here. It is about a spacecraft, not an Earth use, and is rated "news only". It stays on the Home India card.
  - "Smoke detectors": SAME fine smoke and DAFT;
  - "Materials and firefighter gear": the spread and survival maps.

  Numbers appear only as `{file, path}` references resolved at run time. With no reference, there is no number.
- **Design kit.** KEEP:
  - principles;
  - live colour tokens with WCAG ratios, now measured at all 3 text sizes;
  - chart series;
  - type scale, now with the History fonts. The mono sample "0.746 [0.44, 1.00]" is hard-coded on main; it becomes a read of `models.json` `smoke-miss` score and score_range;
  - components: stamps for all 9 states, the seg control, a glossary word, a sensor lamp showing "alarm at 7 s" from saffire_latency;
  - "Built for every reader", rewritten so every claim is true after D5.

### 3.15 Plan v2 items not covered by the pages above

| Item | Home |
|---|---|
| #13 Ranges on everything | A rule. `site/tools/ranges_check.mjs` lists every prediction shown without lo and hi. Known: the smoke-miss points have no lo/hi. |
| #23 drivers (AstraFlame) | Model cards and the Predict model cards |
| AstraFlame "five models with error ranges" → #9, #10, #13; "34 % habitat map" → B6 | Predict, Respond, Flame lab |
| SPICA coverage verdicts → #14 | The `gaps.verdicts` list on Predict. "3D glovebox": SKIP per plan |
| FlameAtlas evidence cards → #18, #20; flammability map → B6 | Respond and Flame lab |
| Faruk042 digital twin → #1, #6; Monte Carlo → #26 | Find it and Predict |
| samuelakosa hidden-risk zone → B6 | Flame lab; offline Q&A: SKIP per plan |
| AFAQ archive pipeline | SKIP per plan; the "slice of tests" is on Checks |
| Fire-X enclosure | SKIP per plan |
| "Several": compare and network views → B4 | Explorer |
| Plan §7: library and passages | `kb.json` (live mode only) |
| Plan §7: "numbers only from lookups" | Ask: trace plus `unbacked()` |
| Plan §7: scorecard → #21 | Ask |
| Plan §7: Haiku model and Worker key | Phase 8, ask first |
| Plan §7: "never fails on stage" | The static cache is the default |
| Plan items 3, 4, 5 and 15 | Removed in plan v2; PLAN_COVERAGE marks them "scrapped" |
| AstraFlame ESP32 rig ("Beat": our rig also locates and responds) | Bench rig: the camera and optical-flow explainer (#27, #28). Response is shown only as the optional mist trial and the closed loop under "Planned, not built" (#19), so there is no claim that the rig responds |
| Plan v2 §2.1 dome outputs (fuel source, flame volume, distance from the sensor); depth and fire-detection models | Bench rig "Camera reading now" and the pending CV1, CV2 and CV3 rows on Checks |
| Plan v2 §2.4 MVP finish line (CV size and position; one response trial measured) | Bench rig and the Bench mist trial card: pending data |
| Plan v2 §2.3 "Ultrasound aimed at the flame: park this" | SKIP per plan; no site text |
| Plan v2 §6 "Where the two meet" | Put it out "Reading the comparison" (pending the mist trial) |

---

## 4. Phases and work packages

Each phase ends with a deployable site. Pages not yet rebuilt are stubs that show one `plan` card, "Being rebuilt in phase N". `main` stays the live fallback. The lead runs the smoke check (every route, no console error, `node --check`), merges the `DECISIONS:` notes from each hand-back, then commits `Phase N: …`.

### Human checkpoints

| # | When | What the lead shows | Blocks |
|---|---|---|---|
| H1 | Now | This plan | Everything |
| H2 | End of phase 2 | `node tests/growth.test.mjs` output | Phase 3 (Assess) |
| H3 | End of phase 1 | The `SCRAPPED` lists and the banner text with `approved:true` (Q1) | Flipping `approved` |
| H4 | Before phase 8 | Whether the team has a Worker URL; live mode is optional | Phase 8 |

The existing worker and llm.js mode is kept as is. Phase 8 only wires its UI and config; `worker/` is never rewritten unless the human asks.

### Phase 1: skeleton and design system (P1-A, P1-B and P1-C in parallel, against §2; P2 runs alongside)

| Package | Owner | Creates or writes | Depends on | Acceptance |
|---|---|---|---|---|
| P1-A shell | agent `shell` | index.html (incl. `#live`, links to every CSS file in §1); css/tokens, base, components.css; **empty** css/p-*.css (15) and fx-*.css (5); js/app.js, site.js, router.js, passes.js, lib.js, prefs.js, status.js, store.js, tour.js, gl_hero.js and gl_banner.js (static stubs), bg.js (no-op), clock.js (static); js/pages/*.js stubs for all 15 ids; js/pages/design.js (full, last); deletes the old js/ and css/ | §2 contracts; integrates P1-B and P1-C at the end | Every route renders with no console error. More menu, the menu's `aria-expanded` reset, skip link, dock (all 5 rows; persists; Escape returns focus), banner text, `?fig=N` and `?fig=slug` open the fold and scroll, "On this page" includes folded figures, `vo:rerender` keeps the scroll, no horizontal scroll at 320 px, CI globs non-empty, design kit contrast table renders in both themes |
| P1-B charts | agent `charts` | js/charts.js, css/charts.css | §2.2 | A scratch harness (not in the repo) renders all 4 types from real data files (blind spot, smoke rows, FLEX bars, M7 scatter). Tab reaches each chart; the arrows move the tooltip; Escape closes it; "Show the numbers" matches the marks; Day/Night recolour; dash and shape per series |
| P1-C content | agent `content` | js/glossary.js, js/provenance.js, js/overlays.js | §2.6, §2.7, §3 titles | The 24 terms and 40 MADE entries plus PSI, FACTORS and CRED are byte-identical to main (diff the literal text), except the one reworded "How big does it get…" `how` (§2.7). Any CRED change from Q2 also counts. There is a MADE entry for every NEW title in §3, and each `models` field covers all 7 folders. Node check: `scrubIonWind(efield.finding)` contains no "ion"; `evidenceRows()` gives E4 and E5 text equal to the file values |

### Phase 2: growth port and test (P2 starts on day one, in parallel with phase 1; no DOM)

| Package | Creates | Acceptance |
|---|---|---|
| P2 growth (agent `growth`) | js/growth.js, js/growth_run.js, js/growth_worker.js, tests/growth.test.mjs | `node tests/growth.test.mjs` exits 0 and prints PASS for each check below. |

What the test checks:
1. For 3 examples × lo/mid/hi: `max_area_cm2`, `t_max_s`, `t_end_s` and `area_consumed_cm2` equal to 4 s.f., and `stop_reason` equal.
2. `verdict`, `rates_mm_s`, `burnout_s`, `grid`, `calibrated`, `extrapolated` and `assumed` exactly equal.
3. `t_s` to a relative 1e-5; `area_cm2` within one cell's area. The known index-101 step is reported, not failed.
4. Step-1 `spreadRates` over all 8 `spread_predictor` cases × 546 cells within a relative 5e-4, with verdict, in_domain, calibration and regime equal.
5. The droplet pointer text, and the unsupported-material error text.
6. The milliseconds per call. If a call takes over about 200 ms, `runGrowth` uses the worker.

The 9 extra vectors in `scratchpad/inventory/growth_reference_vectors.json` are run from the scratchpad path if present. Copying them into `tests/` needs the human's OK (Q6).

After P2, the lead shows the output to the human (H2).

### Phase 3: Assess, risk, response card, then Home (starts after H2; packages in parallel against §2.8–2.10)

| Package | Creates | Depends on | Acceptance |
|---|---|---|---|
| P3-A core + data steward | js/assess_core.js; data/risk_rules.json; data/cv_example.json (example 1's flame state; `confidence:null`, `droplet:null`, `coordinates:"fuel"`, status `demo`); data/manifest.json and data/SHA256SUMS.txt (§5) | P2 | In Node, `computeAssessment` runs on the 3 presets. The risk result names the rule that fired and evaluates every rule. Detection values equal the files. check_data reports OK: 34; `sha256sum -c` passes; the CI rebuild step leaves `git diff -- data/` clean |
| P3-B Assess page | js/fig_assess.js, js/pages/assess.js, css/p-assess.css | P3-A API, store, charts | The 3 presets give the growth_examples summary numbers on screen. An out-of-box field shows a flag. Droplet input shows the pointer and no number. "not supported" works. The paste box rejects a bad shape and lists the errors. The example button is stamped demo; cv_latest missing shows the "not connected" text. The URL round-trips: open the link in a new tab and the state matches. There is one announcement per verdict or level change. A keyboard-only assessment can be run. |
| P3-C response card | js/fig_response.js, css/fx-response.css; mounts it in the js/pages/respond.js stub (this package owns that file in phase 3 only) | P3-A, store | The card follows the store when opened from an Assess link. Every line has a stamp and a gap flag. The disclaimer is shown. |
| P3-D Home | js/pages/overview.js, js/mission.js, js/facts.js, css/p-overview.css | lib, gl_hero stub, clock stub | Every §3.2 row is present with main's text (03 reworded). `detectFacts()` reproduces main's summaries.js detect lines exactly ("…within 7 s… 92 to 127 s", "3 of 5 tests"). The mission check uses `announce()` and has no second live region. The pipeline strip links work. "6 of 9" is computed. `?atm=` round-trips. The tour button starts the tour. There is no "ion" or "thermopile" in the page text. |

### Phase 4: data pages (parallel)

| Package | Creates | Acceptance (in addition to parity with the §3 rows) |
|---|---|---|
| P4-A Find it | js/fig_detect.js, js/pages/detect.js, css/p-detect.css | `short()` imports `facts.detectFacts()` and does not compute the sentences itself (js/facts.js stays P3-D's file). `?event=wire\|s2\|s1`. Tour stops 2 and 3 resolve. Every chart has keyNav and a table. The link to the Predict what-if figure opens its fold. |
| P4-B Predict: smoke | js/fig_drift.js, js/fig_cabin3d.js, css/fx-drift.css | The 94 % is read from the file. Players pause, never autoplay, and stop in onLeave. The 3D view has a fallback with WebGL off. |
| P4-C Predict: spread, models, gaps + page | js/fig_spread.js, js/fig_models.js, js/fig_gaps.js, js/pages/predict.js, css/p-predict.css | The M6b card numbers equal results.json. The #9 chart's M6b mid equals the spread_predictor grid at grid points. "Next experiment" gives 34 % O₂ at 70.3 kPa (9 tests). Model stamps are per entry. `?fuel=&o2=&flow=` works. |
| P4-D Put it out | js/fig_respond.js, js/pages/respond.js (taken over from P3-C), css/p-respond.css | The response card is mounted. The cool-flame 50 % marker is drawn. The FLEX "not a controlled comparison" quote is visible. The E-FIELD text has no ion-wind sentence. The mist card follows the C6 rule. |
| P4-E Checks | js/fig_checks.js, js/pages/evidence.js, css/p-evidence.css | E4 and E5 show their source path. E1, E2 and E8 are scrapped and visible. The CV rows are pending. Every Simulation-check count equals the files. The permutation paragraph is computed. Tour stop 5 (`table.trust`) resolves. |

The spec lists #9, the next-experiment card and #17 in phase 5. They are moved into P4-C and P4-D because they live in those packages' files, which avoids two packages editing one file.

### Phase 5: remaining pages (parallel; P5-G starts last, P5-S runs after F and G)

| Package | Creates | Acceptance |
|---|---|---|
| P5-A Flame lab | js/flame_sim.js, js/fig_flame.js, js/pages/flame.js, css/p-flame.css | The Moon/Mars switch is off by default and dashed or hatched when on, with `gravity_note` printed. No Moon or Mars **value** appears anywhere else on the site: no `0.16 g` or `0.38 g` case, no `gravity_note` text and no number tied to Moon or Mars (phase 7 grep). The words still appear legitimately elsewhere: the Predict bounds card, the Ask refusals and scorecard, the explorer's lunar-base and Mars-base mission ranking, the mission-check "none for Moon or Mars gravity", and the models.json limits. The hidden-risk band at 0 g and 101.3 kPa covers 0.00434–0.00966 and 0.405–1.347 m/s. The simulator pauses and goes still in Calm. |
| P5-B NASA experiments | js/pages/explorer.js, css/p-explorer.css | B3 rows expand by keyboard. The 5 gaps-matched investigations show their ranges and the other 12 show "Not in our table yet". B5 grouping covers all 17. |
| P5-C Model cards | js/fig_modelcards.js, js/pages/models.js, css/p-models.css | 10 sections. The numbers equal the source files. The page works with trust.json missing. Disagreements with the plan table are listed in the hand-back. |
| P5-D Ask | js/ask_match.js, js/llm.js (verbatim copy), js/pages/ask.js, css/p-ask.css | The scorecard shows 21/23, 7/7 and 93 %. No "ion wind" is rendered. The live-mode footnote follows `assistant_config`. |
| P5-E Sources, History, Bench rig | js/pages/about.js, memory.js, locate.js, js/fig_bench.js, css/p-about.css, p-memory.css, p-locate.css | The site map lists every page and figure and the links resolve. The DOIs come from investigations.json. The bench rig has no thermopile text. |
| P5-F On Earth | js/pages/earth.js, data/earth_apps.json, css/p-earth.css | Every number is a resolved `{file, path}` reference; with none, there is no number. |
| P5-G Telugu and Hindi (last) | js/i18n.js, data/i18n.json (`status:"team"`, `reviewed:false`), edits js/pages/overview.js (owned by this package in phase 5) | `lang` attributes are set. "Draft translation, not yet checked by a native speaker" is shown. The numbers come from the same computed values (change a data value and all 3 languages change). |
| P5-S data steward | data/manifest.json, data/SHA256SUMS.txt | Same checks as P3-A, plus OK: 36 |

### Phase 6: illustrations (parallel; static fallbacks are already in place)

| Package | Creates | Acceptance |
|---|---|---|
| P6-A | js/gl_hero.js, css/fx-hero.css | The shader from main; `setG` morph; arrow keys turn; Calm re-checked live; the fallback sentence; "Illustration, not data" |
| P6-B | js/gl_banner.js, js/bg.js, css/fx-gl.css | Earth and smoke banners; the LED pulse stays under 3 flashes/s; background off and cleared in Calm |
| P6-C | js/clock.js, css/fx-clock.css | 10×; Play/Pause/Replay; no autoplay in Calm; same aria-label |

### Phase 7: parity and checks (P7-A to P7-E in parallel, then fix packages by file owner, then the lead)

Serve the old and new sites together:

```
(cd /home/karthikeya/vo-old && python -m http.server 8001) & python -m http.server 8000
```

Playwright browsers are in `~/.cache/ms-playwright`; confirm `npx playwright` resolves, or install it in a scratch folder. axe-core goes in a scratch folder (`npm i axe-core`) and is injected; it is never a site dependency.

| Package | Creates | Output |
|---|---|---|
| P7-A parity | site/tools/parity.mjs | site/PARITY.md: every old figure title, control and stamp → present, or DROP/REPL with its reason (from §3) |
| P7-B screenshots | site/tools/shots.mjs | site/shots/{page}-{1440\|390}-{day\|night}.png. Calm stops all motion. Run with `--disable-gpu --disable-webgl` to check fallbacks. Overflow and console-error list. D5.11 checks: no sideways scroll outside `.scroll` regions at 320 px and at 200 % zoom (1280 px at deviceScaleFactor 2, or CSS zoom), for all 3 text sizes; a frame sample confirms nothing flashes more than 3 times a second (D5.10) |
| P7-C reachability | site/tools/reach.mjs | Starts at Home and follows only visible links, menu items and folds. Must reach every PARITY title; failures listed |
| P7-D a11y | site/tools/axe.mjs, site/tools/keyboard.mjs | axe on every page × 2 themes; serious and critical issues fixed by their owners; the rest in site/A11Y.md. The keyboard-only run: dock → theme → fold → chart value → an Assess run |
| P7-E coverage | site/tools/made_check.mjs, site/tools/ranges_check.mjs | site/PLAN_COVERAGE.md (every plan item: done / pending data / planned / scrapped). C9: every models/ folder appears in a rendered Made-by. The list of predictions with no range. The wording grep (rules below this table) |
| Lead | site/REPORT.md | Per-page changes; parity, reach, coverage and axe results; shot paths; growth test rerun; decisions; the by-hand list (NVDA or VoiceOver pass); registerMade entries folded back into MADE |

P7-E wording grep, run on the rendered text of every route:
- No `/ion[- ]wind/i` and no "thermopile".
- Every `/\bsafe\b|\bcertif|first ever/i` hit is listed with its source. "safety" does not match.
  - Allowed: negations quoted from data files ("does not make an atmosphere safe", "not a detector certification"), the Ask refusal text and scorecard question ("is a high oxygen cabin safe"), and the Flame lab "not a safety rating" line.
  - Any affirmative use is a failure.
- Moon and Mars: the value check from P5-A's acceptance, outside #/flame only.
- Any hit not on the allowed list is a failure.

### Phase 8: optional live assistant (ask first, H4)

This only happens if the team gives a Worker URL. The steps:
1. The data owner sets `assistant_config.endpoint`. That is a data edit, outside the site, unless the human allows it.
2. Ask adds an "Ask anything (live)" toggle on top of the existing llm.js flow.
3. Passages go through `kbPassage()`.
4. The static answers and the scorecard stay the default and the fallback.

The worker stays as it is: `worker/` is not rewritten.

---

## 5. Data-file housekeeping

The spec explicitly allows adding `data/risk_rules.json`, `data/cv_example.json`, `data/earth_apps.json` and `data/i18n.json`, and adding their manifest lines. Only the steward packages (P3-A, P5-S) touch `data/manifest.json` and `data/SHA256SUMS.txt`.

### Steps

1. Write each file as a JSON **object** with a top-level `status` (`team`, `demo`, `team`, `team`). Add `units` where numbers have units. `i18n` also carries `reviewed: false`.
2. Append one entry per file to `manifest.files`. Its `status` must equal the file's:

   | name | status | owner | what |
   |---|---|---|---|
   | risk_rules | team | Team | Assess risk rules (team choice, to be approved) |
   | cv_example | demo | Dashboard | Example camera reading for the Assess button: a copy of growth example 1's flame state |
   | earth_apps | team | Team | On Earth cards linking site findings to Earth uses |
   | i18n | team | Team | Telugu and Hindi strings for the Home short answer and India card (draft until reviewed) |

3. **Serialise exactly as `scripts/build_crosscheck.py` does**, or CI goes red:

   ```python
   import json, pathlib
   p = pathlib.Path('data/manifest.json'); m = json.loads(p.read_text())
   m['files'].append({...})
   p.write_text(json.dumps(m, indent=1, ensure_ascii=False))   # indent=1, no trailing newline, keys in existing order
   ```

4. Run `python scripts/check_data.py`. Expect `OK: 34 …` after P3-A and `OK: 36 …` after P5-S.
5. Run `python scripts/hash_data.py` **last**, because SHA256SUMS includes manifest.json. Expect 35, then 37 files. Then run `cd data && sha256sum -c --quiet SHA256SUMS.txt`.
6. Replay the CI rebuild locally:

   ```
   python scripts/build_crosscheck.py && python scripts/build_trust.py && python scripts/build_kb.py && python scripts/build_memory.py && git diff --exit-code -- data/
   ```

   Then run `for f in js/*.js js/pages/*.js; do node --check "$f"; done`.

   This is a **check, not a build**. If `git diff -- data/` shows any change other than the steward's own files, manifest.json and SHA256SUMS.txt, the steward restores the changed files with `git checkout -- data/<file>`. It never commits regenerated model or script outputs, and it stops and reports. Changes to `crosscheck.json`, `trust.json`, `kb.json` and `memory.json` belong to their owners.
7. The lead adds the matching entries in the same phase commit:
   - `REFERENCES.md`: the sources behind any `reported` text in earth_apps;
   - `AI_LOG.md`;
   - `site/DECISIONS.md`;
   - `site/CONTRACT_PROPOSAL.md`: the shapes of the 4 files, `cv_latest.json` (the CV owner's file, which must also get a manifest line when added), the optional dome-output fields from plan v2 §2.1 (`fuel_source`, `flame_volume_cm3`, `distance_from_sensor_cm`, each with its unit and nullable), the proposed `smoke_flow` field (`{speed_mm_s, direction_deg, frame_time_s, status}`, information only), and a `scrapped` manifest status, which also needs a `check_data.py` change. The site may not make that change.

### Constraints

- **No other existing manifest line or data file is edited.** Ion-wind wording in existing `what` texts, efield, assistant_cache and kb is hidden at display time by overlays.js.
- `cv_example` is `demo`, so the banner counts it as "1 data file holds placeholder numbers" (Q5). AGENTS rule 2 forbids shipping `demo` to `main` without the person's OK. This branch is never pushed by agents.

---

## 6. Open questions for the human (real decisions only)

- **Q1. Scrapped list (C7, H3).**
  - OK to set `SCRAPPED.approved = true` with `files` dome_locator and dome_sensor_count, `optional` response_trials (shown as "Bench mist trial: optional, not completed", not "still to come") and checks E1, E2, E8 and D-dome?
  - With it on and Q5 at its default, the banner reads "1 data file holds placeholder numbers…".
  - Until then the banner says "3 data files are still to come", without the old "mostly from our bench rig".
- **Q2. M6b trust dots.** main already rates M6b 3·3·3·3·2 with "why" text. The spec says to show M6b as "draft, team to rate", with no dots.
  - Default: keep main's values, labelled "draft".
  - Alternative: blank them.
- **Q3. Folds.**
  - Spec: predict 1, evidence 1.
  - main: predict 3, evidence 3, models with no fold.
  - Default: the spec values, with the tour and the `?fig=` links opening folds. On Find it, the plan's core features #1 and #2 stay folded under `keep` 2. Say if you want them visible first.
- **Q4. Ion wind in Ask.**
  - Default: keep all 22 items in the matcher, so the score stays 93 %. Remove the ion-wind sentence from the E-FIELD answer, and hide the gold question "can ion wind extinguish a fire in space" from the table but keep it scored, with a footnote.
  - Alternative: drop it from the scorecard. The score then becomes 90 % or less.
- **Q5. `cv_example` status `demo`** counts in the banner.
  - Default: count it, which is honest; the Assess button is stamped Demo.
  - Alternative: exclude it from the banner.
- **Q6. Growth test fixtures.** May the 9 extra reference vectors be copied into `tests/fixtures/growth_vectors.json`? Otherwise the test reads them from the scratchpad only when present.
- **Q7. Telugu and Hindi.**
  - Agent-drafted strings would be AI text, marked draft.
  - The India fact texts carry years inside English prose. Default: translate the Home short answer and the India card's title, link and labels, and keep the fact texts in English with `lang="en"`.
  - Is a native speaker available to set `reviewed: true`?
- **Q8. E-FIELD panel.** Keep it as NASA context (default), or cut it?
- **Q9. `data/SHA256SUMS.txt`.** The spec allows only the 4 new files and their manifest lines in `data/`. CI's "Fingerprints match" step fails unless SHA256SUMS is regenerated, because it covers manifest.json.
  - Default: regenerate it with the existing `scripts/hash_data.py`, which edits no script, and record this in DECISIONS.
  - Alternative: leave it stale and accept a red CI on this branch.
- **Q10. Assess slider bounds.** The spec gives airflow (0–50 cm/s) and O₂ (15–35 %) only. Default: derive the other bounds from the data files as §3.5 describes. Say if the team wants fixed ranges instead; those would be team choices stamped `team`.

Known risks:
- `vo-old` tracks `main`, not `combined/all-models`. That is fine because main contains the merged models.
- The site map renders every page detached, which loads about 4 MB of JSON on Sources at idle.
- The Assess growth on large fuels may need the worker. P2 measures this.

---

## 7. Critic changes

The completeness pass changed these items, checked against the spec, plan v2, the inventories and the code on main.

### Files and parallel ownership

1. **New CSS files.** Two packages had no CSS file of their own:
   - P4-B (drift and 3D) now owns the new `css/fx-drift.css`;
   - P6-A (hero) now owns the new `css/fx-hero.css`, so it no longer competes with P6-B for `fx-gl.css`.

   P1-A creates both empty in phase 1 (now 5 fx files), so index.html never changes. §0 rule 9 is new: page CSS is scoped under `#view[data-page]`, cross-page figures use prefixed unscoped classes, and a package with no CSS file returns its rules to the lead.
2. **New `js/facts.js`, owned by P3-D.** It is the one place the detect sentences and their numbers are computed. Before, Home (P3-D), Find it's `short()` (P4-A) and the te/hi templates (P5-G) would each have computed the same numbers separately. P4-A imports it.

### Interfaces that were missing

3. **Lifecycle.** Animated figures now take `ctx`: `replayCard`, `driftCard`, `hero`, `banner` and `ticking`. In detached site-map rendering, a page must not call `setParams`, `store.set`, `announce`, `history`, `focus` or `document.title`, and must not start a growth run (§0 rule 6).
4. **Figure numbers.** The "Figure N" label now comes from `data-fignum`, not a CSS counter. Main's counter skips cards inside closed folds, so `?fig=N` and "On this page" would have disagreed with the label.
5. **Router and index.html.** The router sets `#view[data-page]`. index.html gains the single `#live` region.
6. **Short answers.** `short()` says when its file is missing instead of dropping the sentence (D1.4). Home and History export no `short()`.
7. **Tour targets.** A target is a figure slug or `{sel}`. Stop 1 (`.tick` on Home, which has no figure anchors) could not be expressed before. The stops are listed.
8. **Store start-up.** Both Assess and Put it out call `store.initFromURL`, which is idempotent, so a direct link to Put it out works.

### Rule fixes

9. **Moon and Mars grep.** P5-A's acceptance said Moon and Mars "strings appear nowhere else", and P7-E grepped for any Moon or Mars mention. Both would fail on legitimate text: the Predict bounds card, the Ask refusals, the B2 lunar-base and Mars-base ranking, the mission-check sub and the models.json limits. Both now check for Moon or Mars **values** only.
10. **"safe" grep.** A plain grep would hit the tagline "Fire safety…" and the data files' own negations. It now uses word boundaries with an explicit allowed list; any affirmative use fails. The rules moved out of a table cell to below the P7 table.
11. **No invented slider ranges.** Assess bounds the spec does not give (pressure, W, L, thickness, area, x, y) are now derived from the data files, and the derivation is shown on the page (new Q10).
12. **Alarm markers.** The Saffire-III alarm markers on the growth curve, and the risk rules that use them, must say they are times after ignition on a different fire, shown for scale only.
13. **On Earth.** The India Gaganyaan water-mist fact is removed from "Water mist". It is spacecraft hardware rated "news only", not an Earth use.
14. **Design kit.** The hard-coded mono sample "0.746 [0.44, 1.00]" becomes a read from models.json.
15. **CI rebuild.** Replaying the CI rebuild is now a check only: any regenerated file outside the steward's own is restored, not committed. Regenerating SHA256SUMS.txt is outside the spec's four-file exception, so it is now open question Q9.

### Coverage gaps

16. **Folds.**
    - Assess had `keep:3`, which would have folded the growth curve, the three lists and the risk panel. C2 says the lists stay visible, so it is now 6 (nothing folds).
    - Bench rig `keep` went from 2 to 1 to match spec D1.5, which the plan said it followed.
17. **Plan v2 §2.1 dome outputs.** Fuel source, flame volume and distance from the sensor (the depth model) had no home.
    - "Camera reading now" now shows them when `cv_latest` carries them.
    - There is a new pending card "Depth: distance from the sensor" and a CV3 pending row on Checks.
    - The optional fields are proposed in CONTRACT_PROPOSAL.
18. **Plan items with no row.** §3.15 gains rows for: the AstraFlame ESP32 rig ("Beat"), plan v2 §2.1 outputs, the §2.4 MVP finish line, the parked ultrasound idea and "Where the two meet".
19. **Live region.** The mission check's own `aria-live` is removed in favour of `announce()` (D5.9).
20. **Fold-aware links.** The mission-check "full map" link and the Home "Replay the real sensor data" link now use `figLink`, so they open the fold that holds their figure.
21. **Canvases.** The replay canvas, both blind-spot maps, the LBM map, the 3D cabin and the hidden-risk band are added to the canvases that need `keyNav`, a numbers table and a text summary (D5.6).
22. **Scrapped manifest rows.** On "Where each number comes from", the dome_locator and dome_sensor_count rows show the `scrapped` badge once approved, so they do not read as "still to come".
23. **Phase 7 checks.** P7-B gains the D5.11 checks (320 px, 200 % zoom, all 3 text sizes) and the D5.10 3-flashes-per-second check, which were missing.
24. **P1-C acceptance.** "Byte-identical MADE" now excepts the one reworded "How big does it get…" entry the plan itself requires.

### Checked and found sound

- No two packages in the same phase write the same file after these changes.
- Every [NIS] feature on main has a home:
  - tour and Judge mode;
  - mission check;
  - "Can you trust this?", crosscheck, permutation and latency sensitivity;
  - the 3D cabin, the spread explorer and the growth card;
  - the Model cards page;
  - the live-AI mode and the `R²` term.
- `docs/demo` (video and slides) is not linked from main, so the site needs no home for it.
- The `check_data` and `hash_data` counts (OK 34 then 36; 35 then 37 files) match the scripts.

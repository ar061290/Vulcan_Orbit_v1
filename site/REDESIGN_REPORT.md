# Site v3 redesign report ("Ember on ink")

Branch `feat/site-v3-design`, from `main` at 7c39a62 (PR #9). Not pushed or merged. Brief: the team's `site_redesign_prompt.md`. Decisions: `site/DECISIONS.md`, section "Site v3". Inspiration: `site/inspo/` with `NOTES.md`.

The redesign changes how the site looks and how pages are laid out. No data file, model, `CONTRACT.md`, `js/growth.js`, the Ask matcher or how a number is computed changed. The only JavaScript changes are in markup, layout, the app shell and the effects.

## What changed

| Area | Before (v2) | After (v3) |
|---|---|---|
| Look | Cream paper (Day) or navy (Night), Bricolage Grotesque, rounded cards with shadows and corner ticks, "FIGURE N" headers | Dark-first space ink with flame orange as the only accent and oxygen blue second; cool light Day. Archivo display face; Atkinson Hyperlegible body (kept); IBM Plex Mono numbers. Flat panels, 1 px lines, radius 4–6 px, no shadows except popovers. Six type sizes, 4 px spacing scale |
| Shell | Top menu with a "More" dropdown, full-width salmon status banner, floating "Read your way" button | Left sidebar in four groups (a drawer on phones), slim top bar with page title, a **data status pill** ("3 files pending", list in a popover, `cv_example.json` not counted), and "Read your way" in the bar with a new **Effects On/Off** row |
| Page header | Full illustrated WebGL band on every page | Compact: group / page, the question as h1, one-line lead. "The short answer" is a 3-point strip; "On this page" is a sticky right rail (dropdown on phones) |
| Figures | "Made by" box on each figure | A small "How this was made" button that opens an inline panel with the credibility strip inside |
| Home | Hero porthole + stacked cards | A 7-section story: scroll-linked WebGL flame hook with the alarm-gap stat pinned in a corner, giant-numeral finding over the ember noise, drift loop, live camera → growth → risk demo, trust counts with PSI chips, India card and the 34 % oxygen gap, explore tiles |
| Assess | Stacked cards | A three-column app screen (inputs · chart and big stat tiles · sticky risk rail); extrapolated inputs flagged amber on the input; a sticky risk/area mini bar on phones |
| Other pages | Stacked cards | The same content in a figure grid, dense tables that stack on phones, big numbers where the page has them |
| Design kit | "Freefall" | "Ember on ink", drawn from the live tokens with measured contrast |
| Effects | Drifting motes | Night stars, crosshair cursor, Home fire trail, ember noise, star-warp transition, gravity motes (all written from scratch; ideas credited in `REFERENCES.md`) |

## Check results

| Check | Result |
|---|---|
| `node tests/growth.test.mjs` | 8/8 passed |
| Assess numbers vs main (example loaded, all folds open) | Identical: stats, verdict, level, rule fired, parts, lists, short answer, every table and card title |
| axe-core, every page, Day and Night (`site/tools/axe.mjs`) | 0 serious/critical after one fix (Put it out response tables were not focusable scroll regions; `js/fig_response.js`). Status pill, Read your way and the phone drawer: 0 violations |
| Contrast with effects running (pixel scan behind text, pointer moving) | Fire trail and ember noise: pass. Night star cores under glyphs failed (down to 1.0–1.3:1) → fixed with a page-colour halo on text that sits straight on the page (`css/fx-effects.css`). Cursor hairlines dimmed. Design kit: every token pair passes AA after Day `--good` was darkened (4.39 → 5.78:1) |
| Keyboard (`site/tools/keyboard.mjs` + manual pass) | Skip link first; every sidebar link; phone drawer opens with focus inside, Escape returns focus to Menu, closed drawer not tabbable; pill and Read your way open/close with focus return (now also close when focus leaves); every chart reads values with the arrow keys; Assess mini bar covers none of 129 focus stops; 0 stops without a focus ring |
| Calm motion and reduced motion | Pass on all 15 pages: no animation-frame loops, animations or timers; stars a still frame; custom cursor off, normal cursor back |
| Effects Off | Pass: effects still, cursor off; Motion untouched (the hero flame follows Motion) |
| No WebGL | Pass: all 15 pages load with no errors and show still fallbacks |
| Flashing (`shots.mjs flash`) | 0 findings on 15 pages |
| Frame rate (Home, 4× CPU throttle) | 49 fps at 1440 and 53 at 390 (56 / 61 unthrottled), after capping the hero ray-marcher at ~90k pixels. Before the cap: 12 fps. Old site: 38–43 at 1440. Assess: 53 fps with effects on |
| Plan coverage (`made_check` + `ranges_check`) | 81 of 84 "done" rows pass. The 3 that fail (MVP-8, 30, N-2) look for the Moon/Mars switch, which the audit merge already on main removed, so main fails them too. No range regressions |
| Reachability (`reach.mjs`) | 15/15 pages, none over 2 clicks; 100 of 103 titles. The 3 unreached are the old Design kit intro cards, replaced on purpose. 0 broken figure links |
| Parity (`parity.mjs`, old main vs v3; `site/PARITY_V3.md`) | Figures 85 present, links 354 of 354, stamps 85 same / 0 changed. The tool lists 50 "failures", all from intended renames: 42 are "Made by …" summaries that now read "How this was made" (the kind is still on the same line) or the note fold renamed "Read the rest of the note"; 4 are the old Design kit intro cards and h1; 2 are the Pause/Play buttons of the page-header illustration bands that the brief removed; 2 are the shell "More" (now the sidebar) and "Judge mode" (now "Judge mode: 1-minute tour"). No figure, number or link went missing |

## Self-check: where it still looks generic

Compared with the inspiration images, from the polish pass on the app pages:
1. The short answer is three equal columns, close to the "three identical cards" pattern. Changed: numbers muted, columns ruled rather than boxed. It is still a candidate for an asymmetric layout.
2. Every figure uses the same panel template. Changed: one accent per screen (orange only for the current page and the main action), Assess and Checks moved to app layouts, Model cards to spec sheets.
3. The sidebar's group labels read like a stock admin dashboard. Changed: ember band in the sidebar header (Night), the current page marked with a 2 px flame edge. Still worth a look by the team.

## To check by hand

- Chart text in the small SVG charts is about 8 px on a 390 px phone (Find it gas bars, Assess axes). The charts scale with their `viewBox`, so this needs a chart-code change (`js/charts.js`), which was not attempted under the freeze.
- The Day-theme Home screenshot at 390 px is older than the final Home build. Re-shoot it before relying on it.
- The 3D smoke figure on Predict it shows black in headless Chrome without a GPU; in a normal browser it draws.
- Full-page screenshots of tall pages can repeat sticky parts. The `site/shots/compare/*_after.png` files are stitched from viewport captures instead.
- `PLAN_COVERAGE` row C7-scrap (planned) looks for "still to come" in the shell. The pill popover heading keeps that wording.
- The "Judge mode" and "1-minute tour" were the same action in v2, so they are one sidebar button, "Judge mode: 1-minute tour".
- First visits now open in Night (dark first). v2 followed the system theme.

## Screenshots

`site/shots/compare/<page>-<1440|390>_before.png` (main) and `..._after.png` (v3, Night). `site/shots/` is git-ignored, as in v2, so they stay local.

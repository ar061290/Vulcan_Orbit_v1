# Vulcan Orbit

Fire safety for worlds without "up". NASA Space Apps Challenge 2026, challenge: **Flame in Freefall**.

Vulcan Orbit turns NASA's microgravity combustion experiments into three answers: where is the fire (detect and locate), what will it do next (predict), and what puts it out (respond). A bench rig with heat sensors tests the same questions on real hardware.

## Run it

It is a static site with no build step.

```
python -m http.server 8000      # then open http://localhost:8000
```

Deploy: GitHub repo Settings -> Pages -> Deploy from branch -> `main`, folder `/ (root)`.

## How it is organised

```
index.html, css/app.css     shell and theme
js/app.js                   router
js/lib.js, js/charts.js     helpers and SVG charts (no dependencies)
js/pages/*.js               one file per page
data/*.json                 every number on the site; see CONTRACT.md
```

Each panel reads one file in `data/`. If the file is missing, the panel shows which file it is waiting for and the shape it expects. See [CONTRACT.md](CONTRACT.md).

## Data status

Some files still hold demo or unverified numbers. The banner on the site counts them and the Evidence page lists them. **Nothing marked demo is a result.**

## Team decisions (team to write)

- Why we chose detection as the centre of the project:
- Why these mission weights:
- What we cut and why:

## NASA data

NASA Physical Sciences Informatics (psi.nasa.gov): Saffire-I/II/III, SAME, SAME-R, DAFT, BASS, BASS-II, FLEX, FLEX-2, SPICE, SLICE, ACME (E-FIELD Flames, CFI-G, Flame Design, BRE). NASA Technical Reports Server for supporting papers.

## References and credits

Ideas learned from other public Space Apps 2026 projects (no code reused): AstraFlame (Team Agnishikha), SPICA, FlameAtlas, Faruk042, samuelakosaonyejekwe, AFAQ, Fire-X.

## Use of AI tools

The concept and feature choices are the team's. AI coding assistants (Claude) helped write code, tidy data and draft text. Numbers come from datasets and models the team ran and checked. Team to finalise this statement before submission.

Not endorsed by NASA.

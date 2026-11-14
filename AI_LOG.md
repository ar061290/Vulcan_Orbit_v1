# AI use log

One line per session: date, agent, feature, what it wrote.

| Date | Agent | Feature | What it wrote |
|---|---|---|---|
| 2026-11-14 | Claude (Claude Code CLI; Fable 5.2 and Opus 5.5 model IDs reported during the session) | flame-sim, M3 LBM drift (branch feat/sims) | All code and docs in `models/flame-sim/` and `models/m3-drift/`, `models/CONTRACT_PROPOSAL.md`; output files `data/flame_static.json`, `data/flame_spread.json`, `data/drift_lbm.json`, `data/drift_whatif.json`; their lines in `data/manifest.json`; `REFERENCES.md`, this log, pinned `requirements.txt`; saved the person's pasted rules as `AGENTS.md`/`CLAUDE.md`. Research subagents looked up and quoted the property values and papers listed in `REFERENCES.md`; each value was read from a fetched source, and unverified items are flagged in the REPORTs. Did not touch `engine/`, `js/`, `CONTRACT.md`, `data/drift.json` or `data/whatif.json`. |
| 2026-11-14 | Claude (claude.ai, Opus 5.5) | site UI for the sims (branch ui-sims) | `js/flame_sim.js`, `js/pages/flame.js` (new Flame page: interactive flame simulator from `data/flame_static.json`, FLEX droplet scatter, spread chart, flammability map, fronts, all flame checks); LBM cabin and what-if cards in `js/drift_ui.js` and `js/pages/predict.js`; simulation checks on `js/pages/evidence.js`; Flame nav entry and link in `js/app.js`, `js/pages/overview.js`. Earlier the same day: `engine/` drift model, calibration and its site panels (PR #2). No data files changed. |

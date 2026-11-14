# AI use log

One line per session: date, agent, feature, what it wrote.

| Date | Agent | Feature | What it wrote |
|---|---|---|---|
| 2026-11-14 | Claude (Claude Code CLI; Fable 5.2 and Opus 5.5 model IDs reported during the session) | flame-sim, M3 LBM drift (branch feat/sims) | All code and docs in `models/flame-sim/` and `models/m3-drift/`, `models/CONTRACT_PROPOSAL.md`; output files `data/flame_static.json`, `data/flame_spread.json`, `data/drift_lbm.json`, `data/drift_whatif.json`; their lines in `data/manifest.json`; `REFERENCES.md`, this log, pinned `requirements.txt`; saved the person's pasted rules as `AGENTS.md`/`CLAUDE.md`. Research subagents looked up and quoted the property values and papers listed in `REFERENCES.md`; each value was read from a fetched source, and unverified items are flagged in the REPORTs. Did not touch `engine/`, `js/`, `CONTRACT.md`, `data/drift.json` or `data/whatif.json`. |
| 2026-11-14 | Claude (claude.ai, Opus 5.5) | M4 detection latency (branch feat/m4-latency) | `models/m4-latency/` (RULES.md committed first, build.py, README.md, results.json); `data/saffire_latency.json` (real Saffire-III data, replaces the demo file); its manifest line; checks in `data/evidence.json`; Detect page tweaks in `js/pages/detect.js` (display cap, ± timing, threshold note); REFERENCES.md entries. |

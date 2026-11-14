AGENTS.md: rules for every coding agent on Vulcan Orbit

Read this file, CONTRACT.md and docs/plan.md (the Vulcan Orbit plan) before writing any code. If anything here conflicts with a person's instruction in chat, stop and ask.

The project in three lines

Vulcan Orbit is our NASA Space Apps 2026 entry for Flame in Freefall. It turns NASA's microgravity combustion data into three answers: where is the fire (locate), what will it do (predict), what puts it out (respond). A bench rig ("the dome") tests the same questions at Earth gravity. The site is static: every number on it comes from one JSON file in data/.

How we work: one person, one feature
Each person drives one agent on one feature at a time. The first seven features are the seven models listed below.
Your feature owns: its folder models/<feature-id>/, its output file(s) in data/ named in its card, and its line in data/manifest.json. Do not edit anything else.
If you need a change outside your files (a page in js/pages/, CONTRACT.md, another feature's output), stop and tell your person. They agree it with the team.
Branch per feature: feat/<feature-id>. Before starting work each time: git pull --rebase origin main. Open a pull request when the feature's "done means" is met. Only the lead merges to main.
Hard rules
Never invent a number. Every value comes from a file in datasets/, a measurement on the dome, or a model you ran. If you have no data, write null and say why. Do not "fill in typical values".
Every output file carries a status from CONTRACT.md: real, dome, model, reported, demo, plan or team. Use reported for any number taken from a paper or another team that we have not checked ourselves. Never ship demo in a pull request to main unless the person says so.
Units go in the file ("units": "cm", "unit": "mm/s"). Never assume a unit; read it from the dataset's documentation and quote where you found it.
Match CONTRACT.md exactly. Validate your JSON against the shape before you commit. If the shape cannot hold what you need, stop and ask; do not change the contract yourself.
Update data/manifest.json in the same commit as your output file.
Cite everything. Every dataset (PSI id and DOI from datasets/psi/MANIFEST.csv), paper, library and idea from another team goes into REFERENCES.md in the same commit.
Log your AI use. Append one line per session to AI_LOG.md: date, agent, feature, what you wrote. The team must disclose which agent wrote what.
Secrets never enter the repo. No API keys, tokens or passwords in code, config, notebooks or commit messages. The assistant's key lives only in the Cloudflare Worker's settings.
No work dated before Sat 14 Nov 2026, 09:00 IST may be added. Do not import code from outside this repo except installed libraries.
Show, then continue. After each step, print the numbers (or a chart) and stop for your person to check them before moving on.
Modelling rules (all seven models)
Small data. Every NASA table here has roughly 13 to 270 rows. No deep networks. Prefer physics formulas, linear or logistic models, small trees, or Gaussian processes.
Grouped validation. Hold out whole burns, tests or sessions, never random rows from the same burn. Report the split you used.
Always a baseline. Compare against the textbook formula or a trivial predictor, and report both scores side by side.
Ranges on everything. Every prediction gets a low and high (lo, hi), from cross-validation spread, bootstrap or the model's own uncertainty.
Write the pass rule first. Before training, add the metric and the target you expect to models/<feature-id>/RULES.md and commit it. Do not change it after seeing results; report misses honestly.
Drivers. Report which inputs drove predictions (drivers: [{name, share}] in models.json), using permutation importance or coefficients.
Reproducible. One command rebuilds the output: python models/<feature-id>/build.py writes the file(s) in data/. Fix random seeds. Pin library versions in requirements.txt.
Stack: Python 3.11+, numpy, pandas, scipy, scikit-learn, matplotlib for checks. Add anything else only after asking.
Claims we never make
That the dome detects or fights microgravity fires. It tests Earth-gravity assumptions on a bench.
Any prediction for Moon or Mars gravity. NASA's archive has no partial-gravity data; show microgravity and Earth results as bounds only.
That ion wind or mist "works in space" because it worked on our bench.
That a model certifies a material or atmosphere as safe.
An accuracy figure we have not measured.
That station smoke detectors fail in general. The documented weakness is very fine smoke from specific materials.
"First ever". Say "not found in the public projects we reviewed".
Safety (the team is under 18)

Agents write code only; people handle hardware. If a task touches the rig, the code must default to off: heaters and high-voltage outputs start disabled, need an explicit command to enable, and switch off on any error, lost connection or timeout. Never write code that drives high voltage without a hard timeout. Mention to your person that ion wind needs an adult present.

The seven models

Find each model's NASA files through datasets/psi/MANIFEST.csv and datasets/README.md. Confirm the PSI id and column meanings from the documentation files before using them, and quote what you found.

M1. Source locator (dome)
Question: where is the heat source in 3D?
Data: dome readings from the thermopile arrays, with the source at 25 known grid positions. Until the rig logs data, build and test on simulated readings labelled model.
Method: physics model (inverse-square fall-off, solved by least squares) versus a small neural net. Report both.
Output: data/dome_locator.json (true vs predicted points), data/dome_sensor_count.json (mean error for 2 to 6 sensors).
Done means: mean and worst error in cm on the grid, both methods, and the error-vs-sensor-count curve, all from real dome data with status: "dome".
M2. Response trials: ion wind and fine mist (dome)
Question: what changed when each response was applied?
Data: dome sensor readings before and after each trial, repeated at least 3 times.
Method: before/after difference with its spread across repeats. No model fitting needed.
Output: data/response_trials.json. For the comparison with NASA's electric-field flame work, data/efield.json (status real or reported).
Done means: each trial measured by the dome's own sensors, not judged by eye. Wording says what NASA's E-FIELD Flames studied (electric fields changing flame shape and soot), not that NASA validated extinguishing.
M3. Smoke drift and what-if runs (model)
Question: with no buoyancy, where does smoke go, and how often would a detector catch it in time?
Data: ventilation speeds of roughly 0.05 to 0.2 m/s (cite the source), a simple cabin grid, detector positions.
Method: advection-diffusion on a 2D grid. Then a few hundred runs with varied start point and airflow; report the share of fires caught within a set time.
Output: data/drift.json, status: "model".
Done means: an animation-ready frame list for one cabin layout, plus the what-if share with its range. Labelled a model, not validated fluid dynamics.
M4. Detection latency (NASA Saffire-III)
Question: for each real orbital burn, when would each sensor type have alarmed?
Data: Saffire-III telemetry (radiometers, smoke obscuration and scatter channels).
Method: per channel, baseline from pre-ignition data, alarm when the signal crosses a stated threshold; report time from ignition to alarm per channel, per burn.
Output: data/saffire_latency.json, status: "real".
Done means: every burn reported individually (few burns, so no averages that hide them), thresholds stated with their source.
M5. Smoke miss risk (NASA SAME, SAME-R)
Question: will the station's detector see this material's smoke?
Data: SAME and SAME-R smoke particle sizes by material and condition.
Method: classify each case as below or above the detector's sensitive size; logistic model on material and conditions. Do not regress size directly (a competitor reached only R² 0.43).
Output: data/smoke_sizes.json and an entry in data/models.json.
Done means: classification score with a range under grouped validation, the detector threshold cited, and the list of materials most likely to be missed.
M6. Flame spread (NASA BASS-II)
Question: how fast does flame spread over a solid at this airflow and oxygen level?
Data: BASS-II spread rates over PMMA and other solids versus flow and O2.
Method: physics baseline (de Ris-type spread scaling) plus a learned correction.
Output: an entry in data/models.json with baseline name and score.
Done means: score with range under grouped validation, baseline beside it, observed-vs-predicted points, drivers. Expect about R² 0.6; do not promise more.
M7. Extinction and cool flames (NASA FLEX, CFI-G)
Question: will a droplet flame go out, and when could it keep burning invisibly as a cool flame?
Data: FLEX droplet tests (extinction, burning rate, CO2 and helium dilution), CFI-G where usable.
Method: logistic or Gaussian-process classifier for extinction; d-squared law as the burning-rate baseline; a simple rule or classifier for the cool-flame region.
Output: an entry in data/models.json; suppressant summary in data/flex_suppression.json.
Done means: AUC with range under grouped validation (expect about 0.8 to 0.87), baseline beside it, and the conditions where cool flames appear.
Definition of done (every feature)
Output file(s) match CONTRACT.md, carry the right status, and load on the site with no "waiting for file" banner.
models/<feature-id>/RULES.md (written before training), build.py, README.md (data, method, score, limits) and requirements.txt exist.
data/manifest.json, REFERENCES.md and AI_LOG.md updated.
A short summary for your person: the headline number, its range, the baseline, and one sentence on its limits.

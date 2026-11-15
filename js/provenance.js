// "Made by" for every figure: what produced it (trained model, physics formula, or straight NASA data),
// what went in, what NASA data it was checked against, and the exact files to reproduce it.
// Keyed by the figure's exact title (the h2 text without its stamp).
// PSI, FLAME, the first 40 MADE entries, FACTORS and CRED are copied verbatim from main (js/provenance.js @ f1a9df7), with
// three changes, each listed in site/DECISIONS.md: PSI is exported (§2.7); the "How big does it get..." method is reworded
// from "stepped over a fuel grid" (the code uses exact arrival times, models/m6b-predictor README Decision 12); and CRED.m6b
// keeps main's ratings but is marked draft (Q2). New figure entries follow the verbatim block.
// Importable in Node: nothing touches the DOM until provenance() runs.
export const PSI = {
  flex: 'NASA FLEX, PSI-69, doi:10.60555/mbq8-0451',
  cfi: 'NASA CFI, PSI-39, doi:10.60555/m6pj-a914',
  saffire: 'NASA Saffire-III, PSI-100, doi:10.60555/040q-4h36',
  bassRep: 'NASA BASS-II summary report, NTRS 20210011385 (Olson et al. 2021)',
  same: 'Urban et al. 2012, AIAA 2012-3536 (NASA SAME-2 flight), NTRS 20130000422',
  efield: 'NASA ACME E-FIELD Flames, PSI-22, doi:10.60555/se5a-8c73',
  air: 'ISS aisle airflow 4.6-12.2 m/min, NTRS 20150009509 p.10',
};
const FLAME = { script: 'models/flame-sim/build.py', rules: 'models/flame-sim/RULES.md, REPORT.md' };
export const MADE = {
  'Flame simulator': { cred: 'flame', kind: 'Physics model, not trained', how: 'Cantera 3.2.0 chemistry for flame temperature; d-squared law for droplets; flame-shape correlations. Not fitted to NASA data, except a few lumped constants named in models/flame-sim/README.md.', inputs: 'Fuel, gravity (0 or 1 g), oxygen 21 or 34%, pressure 101.3 or 70.3 kPa, airflow 0-0.2 m/s; fuel fed as a 5 cm³/s gas jet or a 3 mm droplet.', check: `${PSI.flex}; ${PSI.bassRep}`, files: `data/flame_static.json ← ${FLAME.script}` },
  'Droplet burning rate vs NASA FLEX': { cred: 'flame', kind: 'Physics formula vs NASA data, not trained', how: 'The textbook d-squared law predicts how fast each droplet shrinks; each dot is a real FLEX burn.', inputs: 'Fuel, oxygen, pressure and diluent of each NASA burn; fuel properties from models/flame-sim/properties.json (each with its source).', check: PSI.flex, files: `data/flame_static.json ← ${FLAME.script}` },
  'How fast flame crosses a solid': { cred: 'flame', kind: 'Physics formula, not trained', how: 'de Ris flame-spread formulas over acrylic (PMMA), with low-flow and blow-off limits; the two limits use calibration points from the BASS-II report, Table 2.1.', inputs: 'Sheet thickness, airflow, oxygen, pressure.', check: `${PSI.bassRep}, Table 5.1`, files: `data/flame_spread.json ← ${FLAME.script}` },
  'Where a flame can survive': { cred: 'flame', kind: 'Physics formula, not trained', how: 'Same spread model, swept over airflow and oxygen; the edges are where the formula says the flame quenches or blows off.', inputs: 'Thin acrylic, airflow, oxygen.', check: `${PSI.bassRep}, Table 2.1`, files: `data/flame_spread.json ← ${FLAME.script}` },
  'A fire growing across a sample': { cred: 'flame', kind: 'Physics formula, not trained', how: 'The spread rate from the de Ris model, stepped forward in time across a 20 cm sheet.', inputs: '21% oxygen, 0.10 m/s opposed airflow, orbit.', check: PSI.bassRep, files: `data/flame_spread.json ← ${FLAME.script}` },
  'Every check on the flame model': { kind: 'Checks', how: 'Each line compares a model output with a NASA number or a published correlation, against a pass limit written before the check ran.', check: `${PSI.flex}; ${PSI.bassRep}`, files: `${FLAME.rules} ← ${FLAME.script}` },
  'Find and rank': { kind: 'NASA catalogue + our scoring rule', how: 'Investigations from NASA\'s PSI archive; the relevance score is the sum of topic weights written by the team (shown on the panel).', check: 'PSI ids and DOIs from datasets/psi/MANIFEST.csv', files: 'data/investigations.json, data/ranking_weights.json' },
  'Replay an orbital fire': { cred: 'latency', kind: 'NASA data, no model', how: 'Raw Saffire-III sensor readings. An alarm is when a signal rises 5 standard deviations above its own pre-ignition level (3 SD as the low end). That threshold is our choice; NASA published no alarm times.', inputs: 'Flame radiometer, smoke scatter and obscuration channels.', check: PSI.saffire, files: 'data/saffire_latency.json ← models/m4-latency/build.py' },
  'Blind Spot: who alarms first?': { cred: 'latency', kind: 'NASA data, no model', how: 'Same readings and alarm rule as the replay (ours, not the Cygnus detector\'s own setting); time from ignition to alarm for each sensor in each event, no averaging.', check: PSI.saffire, files: 'data/saffire_latency.json ← models/m4-latency/build.py' },
  'Flame spread over PMMA slabs (BASS-II)': { cred: 'm6', kind: 'Physics formula + one fitted constant (missed its target)', how: 'de Ris thermal spread formula times one constant fitted on NASA data; simpler corrections kept by a rule written before training.', inputs: 'Airflow, oxygen, slab thickness and width, one- or two-sided burning.', check: `${PSI.bassRep}, Table 5.1: 39 spread rates from 18 tests in 7 sessions; whole sessions held out. R² -0.68 (target 0.6).`, files: 'data/models.json ← models/m6-spread/build.py' },
  'Will it spread, and how fast?': { cred: 'm6b', kind: 'Physics formula + calibration (passed its pass rules)', how: 'Calibrated de Ris for opposed flow and a scaling law for concurrent flow over fabric; a verdict from nearby NASA no-spread cases; each cell flagged inside or outside the calibration box.', inputs: 'Fuel, flow direction, airflow 0-50 cm/s, oxygen 15-35%, 1 atm.', check: `${PSI.bassRep}; NASA Saffire-II, PSI-99 (doi:10.60555/2chp-m469). Held-out sessions: error 0.020 mm/s; range coverage 87%.`, files: 'data/spread_predictor.json ← models/m6b-predictor/build.py (rules: models/m6b-predictor/RULES.md)' },
  'How big does it get, and when does it stop?': { cred: 'm6b', kind: 'Physics model run forward in time', how: 'The spread predictor\'s front computed from exact arrival times on a fuel grid, until burnout, the fuel edge or a NASA no-spread condition; slow, middle and fast runs.', check: 'Growth checks G1-G5 in models/m6b-predictor/REPORT.md (all pass)', files: 'data/growth_examples.json ← models/m6b-predictor/growth.py' },
  'The alarm can come after the gas': { kind: 'Published NASA measurements, no model', how: 'Cabin gas rise, heat release and alarm time for five large burns, copied from the paper\'s Table 2; limits as the paper cites them.', check: 'Urban et al., ICES-2024-365 (Saffire VI), NTRS 20240002981', files: 'data/saffire_gas.json' },
  'Would a "fast rise" alarm be quicker?': { kind: 'NASA data, no model (failed its pass rule)', how: 'Rise rate over 30 s on the raw smoke detector signal; alarm when it beats the pre-event mean + 5 SD. Pass rule (earlier in 2 of 3 events, no false alarms) committed before running.', check: PSI.saffire, files: 'data/rate_of_rise.json ← models/m4-latency/rate_of_rise.py (rule: models/m4-latency/RULES.md)' },
  'Smoke the detector misses': { kind: 'Published NASA measurements + our calculation', how: 'Average particle size and spread per material are NASA\'s (Table 1). The share of smoke mass below each detector limit is our lognormal calculation from them.', check: `${PSI.same}; detector misses (over half of Kapton and two thirds of Teflon tests): Meyer et al., Fire Safety Journal 98:74-81 (2018), doi:10.1016/j.firesaf.2018.04.004`, files: 'data/smoke_sizes.json ← models/m5-smoke-miss/build.py' },
  'Where the smoke goes': { cred: 'drift', kind: 'Physics model, tuned on one burn, not validated', how: 'Smoke carried by the cabin airflow and spreading out (advection-diffusion on a 2D grid, no buoyancy). Four settings were tuned to the real Saffire-III smoke readings: how fast the air clears smoke, how fast it mixes, where it enters, and the detector delay. It fits the burn it was tuned on (R² 0.90) but gets a smoke puff it was not tuned on wrong (shape R² 0.05, peak about 18 s off), so it is a screening model, not a validated one.', inputs: `Cabin 4 m × 2 m, airflow 0.1 m/s (${PSI.air}), smoke 1 mg/s.`, check: PSI.saffire, files: 'data/drift.json ← engine/drift.py' },
  'Walk around the smoke (3D)': { cred: 'drift', kind: 'Physics model, drawn in 3D', how: 'The 2D smoke-drift frames ray-marched through a 4 × 2 × 2 m box in WebGL; the smoke is the same at every depth because the model is 2D.', check: PSI.saffire, files: 'data/drift.json ← engine/drift.py; drawing: js/fig_cabin3d.js' },
  'Checked against a real spacecraft fire': { kind: 'Check of the smoke model', how: 'Tuned on one Saffire-III burn, then tested on events it was not tuned on. The held-out smoke puff fails and stays shown.', check: PSI.saffire, files: 'data/drift_calibration.json ← engine/calibrate.py' },
  'What actually decides if a fire is caught?': { cred: 'drift', kind: 'Physics model, many runs', how: 'The smoke model run thousands of times with random fire position, airflow and smoke rate; counts how many reach the alarm level at the detector in time.', inputs: `Airflow 0.077-0.203 m/s (${PSI.air}); alarm 1 mg/m³ (ICES-2024-365) and 10 mg/m³ (NTRS 20170002629).`, check: PSI.saffire, files: 'data/whatif.json ← engine/drift.py' },
  'What if the fire starts somewhere else?': { cred: 'drift', kind: 'Physics model, many runs', how: '4,000 runs of the smoke model with random fire position, airflow and smoke release. Ranges: resampling the runs, and the spread across settings the flight data cannot tell apart.', inputs: `Airflow 0.077-0.203 m/s (${PSI.air}); alarm levels 1 and 10 mg/m³.`, check: PSI.saffire, files: 'data/whatif.json ← engine/drift.py' },
  'Second opinion: a cabin with racks': { kind: 'Independent physics model, not trained', how: 'A different air-flow method (lattice Boltzmann) in a module cross-section with racks, used to see whether the simple model\'s answers hold.', inputs: '4.2 × 2.2 m section, airflow 0.1 m/s, no buoyancy.', check: 'Compared with the simple smoke model, not directly with NASA data', files: 'data/drift_lbm.json ← models/m3-drift/build.py' },
  'What if the fire starts somewhere else? (cabin with racks)': { kind: 'Independent physics model, many runs', how: '524 runs of the lattice Boltzmann cabin model: 131 fire positions on a 0.25 m grid at several airflows.', check: 'Compared with the simple smoke model, not directly with NASA data', files: 'data/drift_whatif.json ← models/m3-drift/build.py' },
  'Droplet flame goes out': { cred: 'ext', kind: 'Trained model', how: 'Classifier chosen inside each training split from the candidates in models/m7-extinction/README.md (logistic regressions on raw inputs and on physics features); learns from NASA burns whether the flame went out before the fuel was used up.', inputs: 'Methanol and n-heptane droplets, 0.69-3.05 atm, 12-34% oxygen, up to 70% CO₂ or 45% helium added.', check: `${PSI.flex}: 260 burns; whole test days held out (5-fold, 20 repeats). AUC 0.90. Also scored holding out whole atmospheres (47 groups of the same pressure and gas mix), so repeated identical conditions cannot inflate it: AUC 0.90 [0.84, 0.95].`, files: 'data/models.json ← models/m7-extinction/build.py' },
  'Droplet burning rate': { cred: 'rate', kind: 'Physics formula + trained correction', how: 'The d-squared law (one scale factor per fuel) multiplied by a learned correction predicts how fast a droplet shrinks.', check: `${PSI.flex}: 256 burns, whole test days held out. Mean error 0.052 mm²/s.`, files: 'data/models.json ← models/m7-extinction/build.py' },
  'Burns on invisibly after the flame goes out': { cred: 'cool', kind: 'Trained model', how: 'Logistic regression: does a cool flame keep burning after the visible flame goes out?', inputs: 'Pressure, oxygen, helium, droplet size, fuel blend, support fibre.', check: `${PSI.cfi}: 117 burns, whole test days held out. AUC 0.82.`, files: 'data/models.json ← models/m7-extinction/build.py' },
  'Will the detector miss this smoke?': { cred: 'miss', kind: 'Trained model (failed its pass rule)', how: 'Logistic regression on material and air velocity: is most of the smoke mass under 500 nm?', check: `${PSI.same}: 16 flight tests, leave one test out. AUC 0.746 [0.44, 1.00]; target was 0.75.`, files: 'data/models.json ← models/m5-smoke-miss/build.py' },
  'What NASA has not tested': { kind: 'NASA data, no model', how: 'Every oxygen and pressure combination listed in five NASA experiment tables, plotted against cabin atmospheres we care about.', check: 'PSI-69 FLEX, PSI-39 CFI, PSI-25 BASS-II, PSI-159 CFI-G, PSI-10 Flame Design', files: 'data/gaps.json ← scripts/build_gaps.py' },
  'What does the evidence cover for this fire?': { kind: 'NASA data, no model', how: 'Counts the NASA tests run near the atmosphere you pick, from the same five tables.', check: 'PSI-69, PSI-39, PSI-25, PSI-159, PSI-10', files: 'data/gaps.json ← scripts/build_gaps.py' },
  'When does a droplet flame go out?': { cred: 'ext', kind: 'Trained model', how: 'The FLEX extinction model above: the oxygen level where it gives a 50% chance of the flame going out, with a range from 200 refits.', check: `${PSI.flex}: 260 burns, whole test days held out: AUC 0.90 (0.84-0.95); whole atmospheres held out: AUC 0.90 (0.84-0.95). Below published oxygen limits (about 15% heptane, 12% methanol) it gives near-certain extinction, as it should.`, files: 'data/m7_explorer.json ← scripts/build_m7_explorer.py ← models/m7-extinction' },
  'Looks out, still burning: cool flames': { cred: 'cool', kind: 'NASA data + trained model', how: 'Bars are counted straight from NASA burns; the 50% pressure line comes from the cool-flame model.', check: `${PSI.cfi}; CFI-G final report, PSI-159`, files: 'data/m7_explorer.json ← scripts/build_m7_explorer.py' },
  'NASA: flames in an electric field': { kind: 'NASA data, no model', how: 'Test days, fuels and flames ignited, copied from NASA\'s experiment table; objectives quoted from NASA\'s description.', check: PSI.efield, files: 'data/efield.json ← scripts/build_efield.py' },
  'NASA: which gas puts a droplet flame out': { kind: 'NASA data, no model', how: 'Counts of burns that ended in extinction, by added gas. NASA chose near-limit cases on purpose.', check: PSI.flex, files: 'data/flex_suppression.json ← models/m7-extinction/build.py' },
  'Can you trust this?': { kind: 'Summary of every model', how: 'Each row copies the score, range, baseline and pass result from that model\'s own output file.', files: 'data/trust.json ← scripts/build_trust.py' },
  'NASA says / we get': { kind: 'Published NASA values next to ours', how: 'Each row quotes a NASA paper or record and puts the site\'s own number beside it, read from our data files by script.', files: 'data/crosscheck.json ← scripts/build_crosscheck.py' },
  'Could the scores be luck?': { kind: 'Statistical check', how: 'Label-permutation tests: the yes/no labels are shuffled and the same grouped validation rerun 1,000-2,000 times.', files: 'data/permutation.json ← scripts/permutation_tests.py' },
  'Does the alarm rule change the answer?': { cred: 'latency', kind: 'NASA data, no model', how: 'The M4 alarm rule rerun with 3, 4, 5 and 6 standard deviations.', check: PSI.saffire, files: 'data/latency_sensitivity.json ← models/m4-latency/sensitivity.py' },
  'Checks': { kind: 'Checks', how: 'Every check with its pass limit, written before the check ran.', files: 'data/evidence.json ← engine/evidence.py' },
  'Simulation checks': { kind: 'Checks', how: 'Results of the flame and smoke model checks against NASA data and published formulas.', files: 'models/*/RULES.md, data/flame_static.json, data/drift_calibration.json' },
  'Where each number comes from': { kind: 'Index', how: 'One row per data file, with its status and owner.', files: 'data/manifest.json' },
  'Assistant scorecard': { kind: 'Test of the assistant', how: 'No AI model: answers are written ahead from the data files and matched by keywords. 30 fixed questions, run live.', files: 'data/assistant_gold.json, data/assistant_cache.json ← scripts/build_assistant.py' },
  // ---- New figure titles in the rebuild (site/REBUILD_PLAN.md §3). Drafts by the content package, team to check.
  // They carry no numbers of their own: every number on these figures is read from the files named here at run time.
  // Find it
  'Dust or smoke? Checking the counter first': { kind: 'NASA records, no model', how: 'NASA\'s DAFT sessions, which tested in orbit, with test dust instead of smoke, whether the particle counter SAME relied on works without gravity. The objective is quoted from NASA; session, hardware and sampling place are copied from NASA\'s experiment table.', check: 'NASA DAFT / DAFT-2, PSI-47, doi:10.60555/ztgj-d202', files: 'data/daft.json ← scripts/build_daft.py' },
  // Home
  'From camera to risk': { kind: 'Map of the site, no model', how: 'The three steps the site runs for one fire: the camera reading (pending until the camera model is connected), the growth simulation on the Assess page, and the risk level and response evidence. Each step links to the page that computes it.', files: 'data/cv_latest.json (when the camera owner adds it), data/spread_predictor.json, data/risk_rules.json' },
  // Assess
  'Flame now, fuel and cabin': { cred: 'm6b', kind: 'Your inputs, checked against the calibration box', how: 'The flame, fuel and cabin you set, or a worked example. Each value is checked against the range of NASA conditions the spread predictor was calibrated on; values outside it stay allowed and are flagged. Slider limits the brief does not give are taken from the data files, and the page prints where each one came from.', inputs: 'Flame area and position; fuel (PMMA, SIBAL fabric or cotton), size, thickness and sides burning; airflow and its direction, oxygen, pressure.', check: `${PSI.bassRep}; NASA Saffire-II, PSI-99 (doi:10.60555/2chp-m469)`, files: 'data/growth_examples.json (presets), data/spread_predictor.json (calibration box) ← models/m6b-predictor/build.py' },
  'Load from camera': { kind: 'Camera reading, model pending', how: 'A flame state (area, position and box on the fuel) read from the camera model\'s file, or pasted or loaded as JSON in the shape proposed in models/m6b-predictor/CONTRACT_PROPOSAL.md. It is checked field by field and never filled in partly. The example button loads a demo copy of one worked example\'s flame, not a camera measurement.', check: 'Not checked against NASA data: the camera model has no held-out score yet', files: 'data/cv_latest.json (when the camera owner adds it); data/cv_example.json (demo)' },
  'Will it spread here?': { cred: 'm6b', kind: 'Physics formula + calibration, run in your browser', how: 'The spread predictor\'s verdict for your fuel, airflow and oxygen: spreads, near observed extinction, or observed no-spread, decided from the NASA cases that saw a flame go out or fail to spread nearby. The matched cases are listed with how NASA recorded them.', check: `${PSI.bassRep}; NASA Saffire-II, PSI-99 (doi:10.60555/2chp-m469)`, files: 'data/spread_predictor.json (constants.verdict) ← models/m6b-predictor/build.py; run by js/growth.js, a port of models/m6b-predictor/growth.py' },
  'Burning area over time': { cred: 'm6b', kind: 'Physics model run forward in time, in your browser', how: 'The spread predictor\'s front computed from exact arrival times on a fuel grid, then burnout behind it, for slow, middle and fast spread rates. The alarm marks are times after ignition on NASA\'s Saffire-III burns, a different fire, shown for scale and not as a prediction for this one.', inputs: 'The inputs on this page.', check: `Growth checks G1-G5 in models/m6b-predictor/REPORT.md; the port is tested against data/growth_examples.json by tests/growth.test.mjs. Alarm marks: ${PSI.saffire}`, files: 'js/growth.js ← models/m6b-predictor/growth.py; constants data/spread_predictor.json; alarm marks data/saffire_latency.json ← models/m4-latency/build.py' },
  'What is calibrated, extrapolated and assumed': { cred: 'm6b', kind: 'Limits of this run', how: 'The three lists the growth simulation returns for these inputs: what sits inside NASA-calibrated ranges, what is stretched beyond them, and what is assumed, including the shape of the starting flame when no camera box is given.', files: 'js/growth.js ← models/m6b-predictor/growth.py; data/spread_predictor.json' },
  'Risk: the parts and the rule that fired': { kind: 'Team rules on model outputs and NASA data (rules not yet approved)', how: 'The parts are shown first: largest burning area and its range, time to the largest area, when each sensor alarmed on NASA\'s Saffire-III burns (a different fire, for scale), the share of fires the smoke models caught in time, the fuel and the spread verdict. Written rules, checked in file order, turn the parts into Low, Elevated or High; the first rule that matches fires, and every rule is listed with its result. The rules are a team choice, to be approved.', check: `Alarm times: ${PSI.saffire}; detection shares: smoke-drift model runs, not NASA data`, files: 'data/risk_rules.json; data/saffire_latency.json ← models/m4-latency/build.py; data/whatif.json ← engine/drift.py; data/drift_whatif.json ← models/m3-drift/build.py; growth from js/growth.js' },
  // Predict it
  'M6b spread predictor: score and calibration box': { cred: 'm6b', kind: 'Physics formula + calibration (passed its pass rules)', how: 'Calibrated de Ris for opposed flow and a scaling law for concurrent flow over fabric, scored on whole BASS-II sessions it was not fitted on, beside the raw de Ris formula and the one-constant M6 fit. Also shows the independent Saffire-II and film points, the verdict boxes and the calibration box. Drivers were not computed.', check: `${PSI.bassRep}; NASA Saffire-II, PSI-99 (doi:10.60555/2chp-m469)`, files: 'models/m6b-predictor/results.json, data/spread_predictor.json ← models/m6b-predictor/build.py (rules: models/m6b-predictor/RULES.md)' },
  'Spread rate against airflow: M6b vs de Ris': { cred: 'm6b', kind: 'Physics formula + calibration, run in your browser', how: 'The spread predictor\'s first step (spread rates only, no growth) swept across airflow at the oxygen and fuel you choose: the calibrated middle line with its slow-to-fast band, beside the raw de Ris formula. Points outside the calibration box are drawn hollow.', check: `${PSI.bassRep}; NASA Saffire-II, PSI-99 (doi:10.60555/2chp-m469)`, files: 'js/growth.js (spreadRates) ← models/m6b-predictor/predictor.py; constants data/spread_predictor.json' },
  'Next experiment worth running': { kind: 'NASA data + a team ranking rule', how: 'The cabin atmospheres on the gap map ranked by how few NASA tests sit near each one (the sum of its test counts). The least-tested one is turned into a sentence with its coverage verdict. The ranking rule is the team\'s, shown on the panel.', check: 'PSI-69 FLEX, PSI-39 CFI, PSI-25 BASS-II, PSI-159 CFI-G, PSI-10 Flame Design', files: 'data/gaps.json ← scripts/build_gaps.py' },
  // Put it out
  'Response evidence for this fire': { kind: 'Summary of NASA data and model outputs for the fire on Assess', how: 'For the fire set on Assess: which added gases put FLEX droplet flames out and the extinction model\'s 50% oxygen point for each; whether nearby NASA solid-fuel cases saw the flame go out at low airflow; the nearest atmosphere NASA has not tested; and the urgency from the risk rules. Each line keeps its own stamp. A summary of evidence, not a flight procedure.', check: `${PSI.flex}; ${PSI.bassRep}; NASA Saffire-II, PSI-99 (doi:10.60555/2chp-m469)`, files: 'data/flex_suppression.json, data/m7_explorer.json ← models/m7-extinction; data/spread_predictor.json ← models/m6b-predictor/build.py; data/gaps.json; data/risk_rules.json' },
  'Bench mist trial': { kind: 'Bench measurement (optional, not completed)', how: 'Dome sensor readings before and after a fine-mist trial, repeated, with the spread across repeats. Drawn only once data/response_trials.json holds measured dome data; until then the panel says the trial is not completed. Earth gravity only: it says nothing about mist in orbit.', files: 'data/response_trials.json (not yet measured)' },
  // Bench rig
  'Bench rig: camera': { kind: 'Description of the rig, no result', how: 'How the camera rig is meant to work: a computer-vision model that finds the flame, its size and position and its distance from the sensor, and an optical-flow sensor that follows the smoke. It runs at Earth gravity.', files: 'data/cv_latest.json (when the camera owner adds it)' },
  'Camera reading now': { kind: 'Camera model output (pending)', how: 'The latest flame state from the camera model, shown as the file gives it. Fields the file does not carry read "Not in the camera file yet".', check: 'No held-out score yet', files: 'data/cv_latest.json (when the camera owner adds it)' },
  'Depth: distance from the sensor': { kind: 'Check not run yet', how: 'Error of the depth model\'s distance from the sensor on held-out camera frames. The pass rule goes in RULES.md before testing; no accuracy is shown until it is measured.', files: 'None yet (owner Mukund)' },
  'CV detection rate and size error': { kind: 'Check not run yet', how: 'Fire detection rate, and flame size and position error, on held-out camera frames. The pass rule goes in RULES.md before testing; no score is shown until it is measured.', files: 'None yet (owner Mukund)' },
  'Optical-flow smoke track': { kind: 'Check not run yet', how: 'The optical-flow smoke track checked against the camera frames. No result is shown until it is measured.', files: 'None yet (owner Mukund)' },
  'Planned, not built': { kind: 'Plan, not a result', how: 'Ideas the team has written down but not built, such as a closed loop in which the rig\'s own reading of where the fire is steers the mist nozzle to it. Nothing here has been measured.', files: 'Plan v2 (team document)' },
  // Sources and On Earth
  'Site map': { kind: 'Index of the site', how: 'Every page is drawn off-screen and its figure titles are listed, each linking straight to its figure.', files: 'js/site.js (page list)' },
  'Water mist': { kind: 'Link from a site finding to an Earth use (team text)', how: 'What NASA\'s FLEX droplet tests show about which added gases put a flame out, beside our bench mist trial (not completed). Any number is read from the site\'s data files at run time; with no file reference there is no number.', check: PSI.flex, files: 'data/earth_apps.json; data/flex_suppression.json; data/response_trials.json' },
  'Smoke detectors': { kind: 'Link from a site finding to an Earth use (team text)', how: 'What NASA\'s SAME smoke-size measurements and the DAFT counter check show about smoke that detectors can miss. Any number is read from the site\'s data files at run time; with no file reference there is no number.', check: `${PSI.same}; NASA DAFT / DAFT-2, PSI-47, doi:10.60555/ztgj-d202`, files: 'data/earth_apps.json; data/smoke_sizes.json; data/daft.json' },
  'Materials and firefighter gear': { kind: 'Link from a site finding to an Earth use (team text)', how: 'What the flame-spread predictor and the survival map show about how fast flame crosses a material and where it can keep burning. Any number is read from the site\'s data files at run time; with no file reference there is no number.', check: PSI.bassRep, files: 'data/earth_apps.json; data/spread_predictor.json; data/flame_spread.json' },
};
// Credibility strip, after NASA-STD-7009A (each factor 0-4, rated separately, never one overall score).
// Self-assessed by the team from the checks on the Checks page; draft, reviewed before submission.
export const FACTORS = [['ver', 'Verification', 'Is the code doing the maths right? (numerical and unit checks)'], ['val', 'Validation', 'Does it match NASA data it was not tuned on?'],
  ['inp', 'Input pedigree', 'How trustworthy are the inputs?'], ['unc', 'Uncertainty', 'Are ranges given and honest?'], ['rob', 'Robustness', 'Do the answers hold when settings or methods change?']];
export const CRED = {
  flame: { ver: 2, val: 1, inp: 3, unc: 1, rob: 1, why: 'Chemistry checks pass; against NASA it is mixed (flame height 2.2-2.8× off, thick acrylic spread 3× off).' },
  drift: { ver: 3, val: 1, inp: 2, unc: 2, rob: 2, why: 'Numerical checks pass; fits the burn it was tuned on but not the held-out puff; one detector, one vehicle.' },
  latency: { ver: 3, val: 0, inp: 4, unc: 2, rob: 2, why: 'Raw NASA telemetry and passing checks, but NASA published no alarm times to compare against.' },
  ext: { ver: 2, val: 3, inp: 3, unc: 3, rob: 3, why: 'AUC 0.90 on held-out test days and on held-out atmospheres; bootstrap ranges.' },
  cool: { ver: 2, val: 2, inp: 3, unc: 3, rob: 2, why: 'AUC 0.82, but its range overlaps a pressure-only rule (0.78).' },
  rate: { ver: 2, val: 2, inp: 3, unc: 2, rob: 2, why: 'Held-out test days; one learned correction on top of the textbook law.' },
  m6: { ver: 2, val: 1, inp: 3, unc: 2, rob: 1, why: 'Held-out NASA sessions: R² -0.68 against a 0.6 target (missed); mean error 0.033 mm/s vs 0.163 for the textbook formula.' },
  m6b: { ver: 3, val: 3, inp: 3, unc: 3, rob: 2, why: 'Held-out sessions: error 0.020 mm/s, ranges hold 87% of real results; two independent Saffire-II rates fall inside its ranges. Only 39 slab points.', draft: true }, // Q2: main's ratings kept, shown as draft
  miss: { ver: 2, val: 1, inp: 2, unc: 3, rob: 1, why: 'Failed its pass rule; 16 tests read off published figures; range spans chance.' },
};

// Which models/ folder produced each figure (used by the phase 7 C9 check: every folder must appear on a rendered page).
// Kept apart from the MADE literal so the entries copied from main stay byte-identical; merged into MADE[title].models below.
// The smoke-drift grid model lives in engine/, not models/, so its figures list no folder.
const FS = ['models/flame-sim'], M3 = ['models/m3-drift'], M4 = ['models/m4-latency'], M5 = ['models/m5-smoke-miss'],
  M6 = ['models/m6-spread'], M6B = ['models/m6b-predictor'], M7 = ['models/m7-extinction'];
const MODELS = {
  'Flame simulator': FS, 'Droplet burning rate vs NASA FLEX': FS, 'How fast flame crosses a solid': FS, 'Where a flame can survive': FS,
  'A fire growing across a sample': FS, 'Every check on the flame model': FS,
  'Replay an orbital fire': M4, 'Blind Spot: who alarms first?': M4, 'Would a "fast rise" alarm be quicker?': M4, 'Does the alarm rule change the answer?': M4,
  'Flame spread over PMMA slabs (BASS-II)': M6,
  'Will it spread, and how fast?': M6B, 'How big does it get, and when does it stop?': M6B,
  'Smoke the detector misses': M5, 'Will the detector miss this smoke?': M5,
  'Second opinion: a cabin with racks': M3, 'What if the fire starts somewhere else? (cabin with racks)': M3,
  'Droplet flame goes out': M7, 'Droplet burning rate': M7, 'Burns on invisibly after the flame goes out': M7,
  'When does a droplet flame go out?': M7, 'Looks out, still burning: cool flames': M7, 'NASA: which gas puts a droplet flame out': M7,
  'Can you trust this?': [...M7, ...M5, ...M6, ...M6B, ...M4], // trust.json rows: m7 ×3, smoke-miss, m6, m6b, drift (engine/), rate (M4)
  'Simulation checks': [...FS, ...M3],                          // flame_static + flame_spread checks, drift_whatif checks
  'Will it spread here?': M6B, 'Flame now, fuel and cabin': M6B, 'What is calibrated, extrapolated and assumed': M6B,
  'Burning area over time': [...M6B, ...M4],
  'Risk: the parts and the rule that fired': [...M6B, ...M4, ...M3],
  'M6b spread predictor: score and calibration box': [...M6B, ...M6], // the B2 one-constant baseline is M6's fit
  'Spread rate against airflow: M6b vs de Ris': M6B,
  'Response evidence for this fire': [...M7, ...M6B],
  'Water mist': M7, 'Smoke detectors': M5, 'Materials and firefighter gear': [...M6B, ...FS],
};
for (const [t, m] of Object.entries(MODELS)) {
  if (MADE[t]) MADE[t].models = m;
  else console.warn('provenance.js: MODELS names a title with no MADE entry:', t);
}

// Two counts typed into main's MADE text are also in the data files (REBUILD_PLAN §0 rule 2). At display time the typed
// number is replaced by the count read from the file; if the file is missing, the number is dropped rather than shown unbacked.
// The MADE literal itself is left as main wrote it.
const LIVE = [
  { title: 'When does a droplet flame go out?', field: 'how', file: 'm7_explorer', rx: /\b\d[\d,]* refits\b/,
    value: d => /(\d[\d,]*)\s+session-bootstrap refits/.exec(d?.extinction?.note || '')?.[1], text: n => n == null ? 'repeated refits' : `${n} refits` },
  { title: 'Assistant scorecard', field: 'how', file: 'assistant_gold', rx: /\b\d+ fixed questions\b/,
    value: d => Array.isArray(d?.items) ? d.items.length : null, text: n => n == null ? 'Fixed questions' : `${n} fixed questions` },
];

// Figures added by a later package (escape hatch, §2.7). The lead folds these into MADE in phase 7.
export const REGISTERED = {};
/** Register a "Made by" entry for a figure title that MADE does not have yet. Never overrides MADE. */
export function registerMade(title, entry) {
  if (!title || !entry) return;
  if (MADE[title]) { console.warn('registerMade: MADE already has an entry for', title); return; }
  REGISTERED[title] = entry;
}

const norm = t => t.replace(/\s*\((FLEX|CFI|SAME|BASS-II)\)\s*$/, '').trim();
/** The "Made by" entry for a figure title: exact match, then without a trailing (FLEX|CFI|SAME|BASS-II); else null. */
export function madeFor(title) {
  if (!title) return null;
  const t = String(title).trim();
  return MADE[t] || REGISTERED[t] || MADE[norm(t)] || REGISTERED[norm(t)] || null;
}

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const dotsFor = n => n == null ? null : `${'●'.repeat(n)}${'○'.repeat(4 - n)}`;
function credStrip(c) {
  const strip = el('div', 'cred');
  const cap = el('p', 'cred-cap', 'How much to trust it (0-4 per factor, after NASA-STD-7009A; self-assessed by the team)');
  if (c.draft) { cap.append(' '); cap.append(el('strong', 'cred-draft', 'Draft: ratings still to be confirmed by the team.')); }
  strip.append(cap);
  const ul = el('ul');
  for (const [k, name, q] of FACTORS) {
    const v = c[k], li = el('li');
    li.title = q;
    li.setAttribute('aria-label', v == null ? `${name}: not rated. ${q}` : `${name}: ${v} of 4. ${q}`);
    li.append(el('span', null, name));
    if (v == null) li.append(el('b', 'cred-none', 'not rated'));
    else { const b = el('b', null, dotsFor(v)); b.setAttribute('aria-hidden', 'true'); li.append(b); }
    ul.append(li);
  }
  strip.append(ul, el('p', 'cred-why', c.why));
  return strip;
}
function liveRefine(m, title, dds) {
  const specs = LIVE.filter(s => s.title === title && dds[s.field]);
  if (!specs.length || typeof fetch === 'undefined') return;
  import('./lib.js').then(({ load }) => Promise.all(specs.map(async s => {
    const d = await load(s.file);
    const n = d && d.status !== 'missing' ? s.value(d) : null;
    const dd = dds[s.field]; dd.textContent = dd.textContent.replace(s.rx, s.text(n ?? null));
    if (n == null) dd.dataset.unbacked = s.file;
  }))).catch(e => console.warn('provenance.js: could not read a count for', title, e));
}

/** Add a "Made by" block under every figure on the page (works on a detached root). */
export function provenance(root) {
  if (!root?.querySelectorAll) return;
  root.querySelectorAll('.card').forEach(c => {
    if (c.querySelector(':scope > details.madeby')) return;
    const t = (c.dataset.title || c.querySelector(':scope > h2')?.childNodes[0]?.textContent || '').trim(); if (!t) return;
    const key = MADE[t] || REGISTERED[t] ? t : norm(t);
    const m = madeFor(t);
    if (!m) return; // the missing-entry warning is passes.js pass 9 (REBUILD_PLAN §2.5), so it is not logged twice
    const dds = {};
    const dl = el('dl', 'made');
    const folders = (m.models || []).filter(f => !String(m.files || '').includes(f));
    for (const [field, label, v] of [['how', 'Method', m.how], ['inputs', 'Inputs', m.inputs], ['check', 'NASA data', m.check], ['files', 'Files', m.files],
      ['models', 'Model folder', folders.join(', ')]]) {
      if (!v) continue;
      const dd = el('dd', null, v); dds[field] = dd;
      dl.append(el('dt', null, label), dd);
    }
    const box = el('details', 'madeby');
    if (m.models?.length) box.dataset.models = m.models.join(' ');
    const sm = el('summary'); sm.append(el('span', null, 'Made by'), ' ' + m.kind);
    if (m.check) sm.append(el('small', null, ' · ' + m.check.split(/[;:]|, doi/)[0]));
    box.append(sm);
    if (m.cred && CRED[m.cred]) box.append(credStrip(CRED[m.cred]));
    box.append(dl);
    const sub = c.querySelector(':scope > .sub'); (sub || c.querySelector(':scope > h2')).after(box);
    liveRefine(m, key, dds);
  });
}

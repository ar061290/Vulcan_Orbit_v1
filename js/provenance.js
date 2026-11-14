// "Made by" for every figure: what produced it (trained model, physics formula, or straight NASA data),
// what went in, what NASA data it was checked against, and the exact files to reproduce it.
// Keyed by the figure's title. A figure with a chart but no entry here shows a warning in the console (and in the audit).
const PSI = {
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
  'The alarm can come after the gas': { kind: 'Published NASA measurements, no model', how: 'Cabin gas rise, heat release and alarm time for five large burns, copied from the paper\'s Table 2; limits as the paper cites them.', check: 'Urban et al., ICES-2024-365 (Saffire VI), NTRS 20240002981', files: 'data/saffire_gas.json' },
  'Would a "fast rise" alarm be quicker?': { kind: 'NASA data, no model (failed its pass rule)', how: 'Rise rate over 30 s on the raw smoke detector signal; alarm when it beats the pre-event mean + 5 SD. Pass rule (earlier in 2 of 3 events, no false alarms) committed before running.', check: PSI.saffire, files: 'data/rate_of_rise.json ← models/m4-latency/rate_of_rise.py (rule: models/m4-latency/RULES.md)' },
  'Smoke the detector misses': { kind: 'Published NASA measurements + our calculation', how: 'Average particle size and spread per material are NASA\'s (Table 1). The share of smoke mass below each detector limit is our lognormal calculation from them.', check: PSI.same, files: 'data/smoke_sizes.json ← models/m5-smoke-miss/build.py' },
  'Where the smoke goes': { cred: 'drift', kind: 'Physics model, tuned on one burn, not validated', how: 'Smoke carried by the cabin airflow and spreading out (advection-diffusion on a 2D grid, no buoyancy). Four settings were tuned to the real Saffire-III smoke readings: how fast the air clears smoke, how fast it mixes, where it enters, and the detector delay. It fits the burn it was tuned on (R² 0.90) but gets a smoke puff it was not tuned on wrong (shape R² 0.05, peak about 18 s off), so it is a screening model, not a validated one.', inputs: `Cabin 4 m × 2 m, airflow 0.1 m/s (${PSI.air}), smoke 1 mg/s.`, check: PSI.saffire, files: 'data/drift.json ← engine/drift.py' },
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
  'Checks': { kind: 'Checks', how: 'Every check with its pass limit, written before the check ran.', files: 'data/evidence.json ← engine/evidence.py' },
  'Simulation checks': { kind: 'Checks', how: 'Results of the flame and smoke model checks against NASA data and published formulas.', files: 'models/*/RULES.md, data/flame_static.json, data/drift_calibration.json' },
  'Where each number comes from': { kind: 'Index', how: 'One row per data file, with its status and owner.', files: 'data/manifest.json' },
  'Assistant scorecard': { kind: 'Test of the assistant', how: 'No AI model: answers are written ahead from the data files and matched by keywords. 30 fixed questions, run live.', files: 'data/assistant_gold.json, data/assistant_cache.json ← scripts/build_assistant.py' },
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
  miss: { ver: 2, val: 1, inp: 2, unc: 3, rob: 1, why: 'Failed its pass rule; 16 tests read off published figures; range spans chance.' },
};
const norm = t => t.replace(/\s*\((FLEX|CFI|SAME|BASS-II)\)\s*$/, '').trim();
/** Add a "Made by" block under every figure on the page. */
export function provenance(root) {
  root.querySelectorAll('.card').forEach(c => {
    const t = c.querySelector(':scope > h2')?.childNodes[0]?.textContent?.trim(); if (!t) return;
    const m = MADE[t] || MADE[norm(t)];
    if (!m) { if (c.querySelector('svg.chart, canvas, table')) console.warn('No "Made by" entry for figure:', t); return; }
    const row = (k, v) => v ? [document.createElement('dt'), document.createElement('dd')].map((e, i) => (e.textContent = i ? v : k, e)) : [];
    const dl = document.createElement('dl'); dl.className = 'made';
    [...row('Method', m.how), ...row('Inputs', m.inputs), ...row('NASA data', m.check), ...row('Files', m.files)].forEach(e => dl.append(e));
    const box = document.createElement('details'); box.className = 'madeby';
    const sm = document.createElement('summary'), lab = document.createElement('span'); lab.textContent = 'Made by'; sm.append(lab, ' ' + m.kind);
    if (m.check) { const src = document.createElement('small'); src.textContent = ' · ' + m.check.split(/[;:]|, doi/)[0]; sm.append(src); }
    box.append(sm);
    if (m.cred && CRED[m.cred]) {
      const c = CRED[m.cred], strip = document.createElement('div'); strip.className = 'cred';
      const cap = document.createElement('p'); cap.className = 'cred-cap'; cap.textContent = 'How much to trust it (0-4 per factor, after NASA-STD-7009A; self-assessed by the team)'; strip.append(cap);
      const ul = document.createElement('ul');
      for (const [k, name, q] of FACTORS) { const li = document.createElement('li'); li.title = q; li.setAttribute('aria-label', `${name}: ${c[k]} of 4. ${q}`);
        li.innerHTML = `<span>${name}</span><b aria-hidden="true">${'●'.repeat(c[k])}${'○'.repeat(4 - c[k])}</b>`; ul.append(li); }
      const why = document.createElement('p'); why.className = 'cred-why'; why.textContent = c.why;
      strip.append(ul, why); box.append(strip);
    }
    box.append(dl);
    const sub = c.querySelector(':scope > .sub'); (sub || c.querySelector(':scope > h2')).after(box);
  });
}

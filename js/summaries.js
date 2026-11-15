// "The short answer" for each page: three plain sentences built from the data files, so the numbers can never
// disagree with the figures below them. If a file is missing, its sentence says so instead of guessing.
import { load } from './lib.js';
const pct = (x, d = 0) => `${(100 * x).toFixed(d)}%`;
const ok = d => d && d.status !== 'missing';
export const KEEP = { flame: 1, detect: 2, predict: 3, respond: 2, evidence: 1, explorer: 1, locate: 1, ask: 1, about: 2, design: 3 };
export async function summary(id) {
  if (id === 'detect') {
    const [lat, gas] = await Promise.all([load('saffire_latency'), load('saffire_gas')]);
    const out = [];
    if (ok(lat)) {
      const burns = lat.burns.filter(b => b.channels.some(c => /radiometer/i.test(c.name) && c.alarm_s != null));
      const rad = burns.map(b => b.channels.find(c => /radiometer/i.test(c.name)).alarm_s), sc = burns.map(b => b.channels.find(c => /scatter/i.test(c.name))?.alarm_s).filter(v => v != null);
      if (burns.length && sc.length) out.push(`In the ${burns.length} real fires NASA lit in orbit, a flame light sensor would have noticed within ${Math.max(...rad)} s (using our alarm thresholds). The smoke detector took ${Math.min(...sc)} to ${Math.max(...sc)} s.`);
      const obs = lat.burns.every(b => b.channels.find(c => /obscuration/i.test(c.name))?.alarm_s == null);
      if (obs) out.push('The second kind of smoke detector, which looks for dimmed light, never alarmed at all.');
      if (ok(gas)) { const n = gas.tests.filter(t => t.co_rise > gas.limits.co_smac_24h_ppm).length;
        out.push(`That matters: in NASA's later Saffire fires, carbon monoxide passed the 24-hour crew limit in ${n} of ${gas.tests.length} tests, and a smoke monitor reached its alarm level only after much of the gas was out.`); }
    }
    return out.length ? out : null;
  }
  if (id === 'predict') {
    const w = await load('whatif'); if (!ok(w)) return null;
    const c = w.layouts[0];
    return [`With nothing to make it rise, smoke goes where the fans push it, not to the ceiling.`,
      `In ${w.runs ?? 'our'} simulated cabin fires, a ceiling detector at the station's alarm level caught only ${pct(c.caught_120_at_10mg, 1)} within 2 minutes.`,
      `A far more sensitive alarm level (1 mg/m³) would catch about ${pct(c.caught_120)}. Where you put the detector matters less than how sensitive it is.`];
  }
  if (id === 'respond') {
    const [x, f, e] = await Promise.all([load('m7_explorer'), load('flex_suppression'), load('efield')]);
    const out = [];
    if (ok(f)) { const g = Object.fromEntries(f.groups.map(r => [r.gas.split(' ')[0], r])); if (g.CO2 && g.He) out.push(`In NASA's droplet tests, flames went out in ${pct(g.CO2.extinguished / g.CO2.tests)} of burns with added carbon dioxide and ${pct(g.He.extinguished / g.He.tests)} with added helium. NASA chose hard cases on purpose, so these are not a fair contest between the gases.`); }
    if (ok(x)) out.push(`Our model predicts whether a droplet flame goes out from oxygen, pressure and added gas. It ranks the cases right ${Math.round(x.extinction.headline.auc_median * 10)} times in 10 on test sessions it never saw.`);
    if (ok(e)) out.push('NASA\'s electric-field flame tests studied how fields change a flame\'s shape and soot, not how to put fires out. Our own bench trials are not done yet.');
    return out.length ? out : null;
  }
  if (id === 'flame') return ['Pick a fuel and switch gravity off: the tall yellow flame becomes a small, dim, blue sphere.', 'This is a simplified physics model. It matches some NASA measurements and misses others; every check is listed below the simulator.', 'NASA has no fire data at Moon or Mars gravity, so those settings come from the model alone.'];
  if (id === 'evidence') {
    const e = await load('evidence'); if (!ok(e)) return null;
    const r = e.checks.map(c => String(c.result || '')), pass = r.filter(s => s.startsWith('Pass')).length, fail = r.filter(s => s.startsWith('Fail')).length, todo = r.length - pass - fail;
    return [`We wrote down ${r.length} checks, each with its pass limit set before running it.`, `${pass} passed, ${fail} failed, and ${todo} are still to run (mostly bench-rig tests).`, 'Failures stay on the page. That is the point.'];
  }
  if (id === 'explorer') return ['These are the NASA space-station fire experiments we used, with links to the original data.',];
  if (id === 'ask') return ['Ask a question in plain words. Answers come only from this site\'s data files, with sources.', 'It refuses questions the data cannot answer, such as Moon or Mars predictions or whether something is "safe".'];
  return null;
}

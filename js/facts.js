// Shared computed sentences and the numbers inside them (site/REBUILD_PLAN.md §2.11, §7 item 2).
// This is the ONE place the three "Find it" sentences are computed. Home (overview.js), Find it's short() (detect.js)
// and the Telugu/Hindi templates (i18n.js) all read `vars` from here, so every page and every language prints the
// same numbers. Sentences are main's js/summaries.js `detect` lines, verbatim.
// Every number comes from data/saffire_latency.json (our stated alarm rule; NASA published none) and
// data/saffire_gas.json (ICES-2024-365, status reported). Nothing is typed in.
import { load, isMissing } from './lib.js';

const RAD = /radiometer/i, SCATTER = /scatter/i, OBSCURATION = /obscuration/i;
const chan = (b, re) => (Array.isArray(b?.channels) ? b.channels.find(c => re.test(c.name)) : undefined);
/** D1.4: a sentence whose file is missing says so instead of being dropped. */
export const missingSentence = (what, file) => `${what} is not available yet (data/${file}.json missing).`;

/** Detection facts from the Saffire-III alarm-timing file and the Saffire IV-VI gas file.
 *  vars: n_fires (burns where a flame radiometer alarmed), rad_s (latest radiometer alarm, s), smoke_min_s and
 *  smoke_max_s (scatter-channel alarm range over those burns, s), obs_never (true when no burn's obscuration channel
 *  alarmed), co_over (gas tests whose CO rise passed the 24-hour crew limit), co_tests (gas tests).
 *  en: the English sentences. A missing file gives nulls in vars and a "not available yet" sentence in en. */
export function detectFacts(lat, gas) {
  const vars = { n_fires: null, rad_s: null, smoke_min_s: null, smoke_max_s: null, obs_never: null, co_over: null, co_tests: null };
  const en = [];
  const latOk = !isMissing(lat) && Array.isArray(lat.burns);
  const gasOk = !isMissing(gas) && Array.isArray(gas.tests) && gas.limits?.co_smac_24h_ppm != null;
  if (latOk) {
    const burns = lat.burns.filter(b => chan(b, RAD)?.alarm_s != null);
    const rad = burns.map(b => chan(b, RAD).alarm_s);
    const sc = burns.map(b => chan(b, SCATTER)?.alarm_s).filter(v => v != null);
    vars.n_fires = burns.length;
    vars.rad_s = rad.length ? Math.max(...rad) : null;
    vars.smoke_min_s = sc.length ? Math.min(...sc) : null;
    vars.smoke_max_s = sc.length ? Math.max(...sc) : null;
    vars.obs_never = lat.burns.every(b => chan(b, OBSCURATION)?.alarm_s == null);
    if (burns.length && sc.length) en.push(`In the ${vars.n_fires} real fires NASA lit in orbit, a flame light sensor would have noticed within ${vars.rad_s} s (using our alarm thresholds). The smoke detector took ${vars.smoke_min_s} to ${vars.smoke_max_s} s.`);
    if (vars.obs_never) en.push('The second kind of smoke detector, which looks for dimmed light, never alarmed at all.');
  } else {
    en.push(missingSentence('Alarm timing on NASA\'s orbital fires', 'saffire_latency'));
  }
  if (gasOk) {
    vars.co_tests = gas.tests.length;
    vars.co_over = gas.tests.filter(t => t.co_rise > gas.limits.co_smac_24h_ppm).length;
    // main's wording, which follows the alarm-timing sentence ("That matters: …")
    en.push(`That matters: in NASA's later Saffire fires, carbon monoxide passed the 24-hour crew limit in ${vars.co_over} of ${vars.co_tests} tests, and a smoke monitor reached its alarm level only after much of the gas was out.`);
  } else {
    en.push(missingSentence('Cabin gas timing from NASA\'s later Saffire fires', 'saffire_gas'));
  }
  return { vars, en };
}

/** Convenience: load both files and compute. Same result as detectFacts(await load(…), await load(…)). */
export async function loadDetectFacts() {
  const [lat, gas] = await Promise.all([load('saffire_latency'), load('saffire_gas')]);
  return { ...detectFacts(lat, gas), lat, gas };
}

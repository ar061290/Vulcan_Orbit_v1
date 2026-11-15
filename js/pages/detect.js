// #/detect "Find it": where is the fire? Block order follows spec D3 with keep 2 (site.js), so the replay and the gas
// card show first (tour stops 2 and 3) and the rest sit under "Show N more figures". Every card renders even when its
// file is missing (an empty state, never a dropped card). Figures: js/fig_detect.js.
import { h, load, page, params as urlParams } from '../lib.js';
import { detectFacts } from '../facts.js';
import { replayCard, gasCard, rateCard, sensitivityCard, blindSpotCard, smokeMissCard, daftCard } from '../fig_detect.js';

const LEAD = 'A fire you find late is a bigger fire. These panels use NASA\'s orbital burns and smoke measurements to show which sensors see a fire first and which smoke slips past.';

export default async function render(root, ctx = {}) {
  const [lat, smoke, daft, gas, ror, sens] = await Promise.all(
    ['saffire_latency', 'smoke_sizes', 'daft', 'saffire_gas', 'rate_of_rise', 'latency_sensitivity'].map(load));
  const q = ctx.params || (ctx.detached ? {} : urlParams());
  root.append(page('Where is the fire?', LEAD,
    replayCard(lat, q, ctx),
    gasCard(gas),
    rateCard(ror),
    sensitivityCard(sens),
    h('div', { class: 'grid g2' }, blindSpotCard(lat), smokeMissCard(smoke)),
    daftCard(daft)));
}

/** "The short answer": the three detect sentences, computed once in js/facts.js (shared with Home and te/hi). */
export async function short() {
  const [lat, gas] = await Promise.all([load('saffire_latency'), load('saffire_gas')]);
  const f = await detectFacts(lat, gas);
  return f && Array.isArray(f.en) && f.en.length ? f.en : null;
}

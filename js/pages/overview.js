// PHASE 1 STUB for #/overview (Home). Package P3-D rebuilds this page in phase 3 (site/REBUILD_PLAN.md §4).
// The static clock is shown so the tour's first stop (.tick) has a target until then.
import { h, load, page, card } from '../lib.js';
import { ticking } from '../clock.js';
import { tourButton } from '../tour.js';

export default async function render(root, ctx) {
  const lat = await load('saffire_latency');
  root.append(page('Vulcan Orbit', 'This page is being rebuilt. The live site on main is unchanged.',
    card('Being rebuilt in phase 3', 'plan', 'Package P3-D rebuilds this page. Nothing on it is a result yet.',
      h('div', { class: 'row' }, tourButton())),
    ticking(lat, { ctx })));
}

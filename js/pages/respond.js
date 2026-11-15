// PHASE 1 STUB for #/respond. Package P3-C/P4-D rebuilds this page in phase 3 (site/REBUILD_PLAN.md §4).
import { page, card } from '../lib.js';

export default async function render(root, ctx) {
  root.append(page('Put it out', 'This page is being rebuilt. The live site on main is unchanged.',
    card('Being rebuilt in phase 3', 'plan', 'Package P3-C/P4-D rebuilds this page. Nothing on it is a result yet.')));
}

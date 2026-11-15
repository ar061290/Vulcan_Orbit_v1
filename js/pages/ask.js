// PHASE 1 STUB for #/ask. Package P5-D rebuilds this page in phase 5 (site/REBUILD_PLAN.md §4).
import { page, card } from '../lib.js';

export default async function render(root, ctx) {
  root.append(page('Ask', 'This page is being rebuilt. The live site on main is unchanged.',
    card('Being rebuilt in phase 5', 'plan', 'Package P5-D rebuilds this page. Nothing on it is a result yet.')));
}

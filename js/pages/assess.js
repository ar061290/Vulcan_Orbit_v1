// PHASE 1 STUB for #/assess. Package P3-B rebuilds this page in phase 3 (site/REBUILD_PLAN.md §4).
import { page, card } from '../lib.js';

export default async function render(root, ctx) {
  root.append(page('Assess', 'This page is being rebuilt. The live site on main is unchanged.',
    card('Being rebuilt in phase 3', 'plan', 'Package P3-B rebuilds this page. Nothing on it is a result yet.')));
}

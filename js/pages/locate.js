// PHASE 1 STUB for #/locate. Package P5-E rebuilds this page in phase 5 (site/REBUILD_PLAN.md §4).
import { page, card } from '../lib.js';

export default async function render(root, ctx) {
  root.append(page('Bench rig', 'This page is being rebuilt. The live site on main is unchanged.',
    card('Being rebuilt in phase 5', 'plan', 'Package P5-E rebuilds this page. Nothing on it is a result yet.')));
}

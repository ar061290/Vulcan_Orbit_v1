// The page registry. Order = top menu; menu:'more' pages sit in the "Full project" menu (and the footer).
// Demo split (15 Nov 2026): the top menu is the demo path, Home -> 01 Detect -> 02 Simulate -> 03 Respond (+ Ask);
// everything else (story, checks, model cards, data, sources) stays reachable under "Full project".
// Frozen: site/REBUILD_PLAN.md §2.3. The router, the passes, the tour and the site map read it.
// keep = how many blocks a page shows before "Show N more figures" (spec D1.5; Assess 6 so nothing folds).
export const PAGES = [
  { id: 'overview', label: 'Home', head: false, doc: 'Vulcan Orbit' },
  { id: 'memory', label: 'History', head: false, doc: 'Sixty years of fire · Vulcan Orbit', menu: 'more' },
  { id: 'detect', label: '01 Detect', title: 'Where is the fire?', visual: 'smoke', keep: 2 },
  { id: 'assess', label: '02 Simulate', title: 'How bad will it get?', visual: 'flame', keep: 6 /* nothing folds: C2 says the lists stay visible beside the curve */ },
  { id: 'predict', label: 'Smoke drift', title: 'What will it do?', visual: 'flame', keep: 1, menu: 'more' },
  { id: 'respond', label: '03 Respond', title: 'What puts it out?', visual: 'flame', keep: 2 },
  { id: 'flame', label: 'Flame lab', title: 'A flame without gravity', visual: 'flame', keep: 1, menu: 'more' },
  { id: 'explorer', label: 'NASA experiments', title: 'The NASA experiments', visual: 'earth', keep: 1, menu: 'more' },
  { id: 'evidence', label: 'Checks', title: 'How we checked it', visual: 'earth', keep: 1, menu: 'more' },
  { id: 'ask', label: 'Ask', title: 'Ask a question', visual: 'earth', keep: 1 },
  { id: 'models', label: 'Model cards', title: 'Model cards', visual: 'earth', keep: 99, menu: 'more', provenance: false },
  { id: 'earth', label: 'On Earth', title: 'What does this mean on Earth?', visual: 'earth', keep: 3, menu: 'more' },
  { id: 'locate', label: 'Bench rig', title: 'Our bench rig', visual: 'smoke', keep: 1, menu: 'more', kicker: 'Bench rig: camera' },
  { id: 'about', label: 'Sources', title: 'Sources and credits', visual: 'earth', keep: 2, menu: 'more' },
  { id: 'design', label: 'Design kit', title: null /* keeps own h1 "Freefall" */, visual: 'earth', keep: 3, menu: 'more' },
];
export const TOP = PAGES.filter(p => p.menu !== 'more');
export const MORE = PAGES.filter(p => p.menu === 'more');
export const pageById = id => PAGES.find(p => p.id === id) || null;
export const docTitle = p => p.doc || `${p.label} · Vulcan Orbit`;
/** "NN / Label" over top pages (Home = 00), "More / <kicker or label>" otherwise. */
export function kicker(p) {
  const n = TOP.indexOf(p);
  return n >= 0 ? `${String(n).padStart(2, '0')} / ${p.label}` : `More / ${p.kicker || p.label}`;
}

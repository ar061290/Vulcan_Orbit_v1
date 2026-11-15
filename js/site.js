// The page registry. Order = top menu; menu:'more' pages sit in the "More" menu (and the footer).
// Frozen: site/REBUILD_PLAN.md §2.3. The router, the passes, the tour and the site map read it.
// keep = how many blocks a page shows before "Show N more figures" (spec D1.5; Assess 6 so nothing folds).
export const PAGES = [
  { id: 'overview', label: 'Home', head: false, doc: 'Vulcan Orbit' },
  { id: 'memory', label: 'History', head: false, doc: 'Sixty years of fire · Vulcan Orbit' },
  { id: 'detect', label: 'Find it', title: 'Where is the fire?', visual: 'smoke', keep: 2 },
  { id: 'assess', label: 'Assess', title: 'How bad will it get?', visual: 'flame', keep: 6 /* nothing folds: C2 says the lists stay visible beside the curve */ },
  { id: 'predict', label: 'Predict it', title: 'What will it do?', visual: 'flame', keep: 1 },
  { id: 'respond', label: 'Put it out', title: 'What puts it out?', visual: 'flame', keep: 2 },
  { id: 'flame', label: 'Flame lab', title: 'A flame without gravity', visual: 'flame', keep: 1 },
  { id: 'explorer', label: 'NASA experiments', title: 'The NASA experiments', visual: 'earth', keep: 1 },
  { id: 'evidence', label: 'Checks', title: 'How we checked it', visual: 'earth', keep: 1 },
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
// v3 app shell: the sidebar groups (site/DECISIONS.md, v3). Every page except Home is in exactly one group; Home is the brand link.
export const GROUPS = [
  ['Pipeline', ['assess', 'detect', 'predict', 'respond']],
  ['Science', ['flame', 'explorer', 'models']],
  ['Trust', ['evidence', 'ask', 'about']],
  ['More', ['earth', 'locate', 'memory', 'design']],
];
export const groupOf = id => GROUPS.find(([, ids]) => ids.includes(id))?.[0] || null;

// Hash router and the navigation (site/REBUILD_PLAN.md §2.4).
// Each page is js/pages/<id>.js exporting `default async function render(root, ctx)` and optionally `short(ctx)`.
// ctx = { id, page, params, detached, store, onMount(fn), onLeave(fn) }.
import { h, untip } from './lib.js';
import { GROUPS, pageById, docTitle } from './site.js';
import { runPasses, revealFigure } from './passes.js';
import { stopReading } from './prefs.js';
import { startTour } from './tour.js';
import * as store from './store.js';

const $ = id => document.getElementById(id);
let cur = { id: null, params: {} }, leaving = [], token = 0;

const parse = () => {
  const [path, q] = location.hash.replace(/^#\/?/, '').split('?');
  const id = pageById(path) ? path : 'overview';
  return { id, params: Object.fromEntries(new URLSearchParams(q || '')) };
};
const calmNow = () => document.documentElement.dataset.motion === 'calm';

function makeCtx(id, params, detached) {
  const mounts = [], leaves = [];
  return {
    ctx: { id, page: pageById(id), params, detached, store, onMount: fn => { if (typeof fn === 'function') mounts.push(fn); }, onLeave: fn => { if (typeof fn === 'function') leaves.push(fn); } },
    mounts, leaves,
  };
}
const runAll = (fns, what) => fns.splice(0).forEach(fn => { try { fn(); } catch (e) { console.error(`${what} callback failed`, e); } });

/** Render a page into a new div and run every pass. Used by the router and, detached, by the Sources site map. */
export async function renderPage(id, { detached = true, params = {} } = {}) {
  const page = pageById(id); if (!page) throw new Error(`Unknown page: ${id}`);
  const { ctx, mounts, leaves } = makeCtx(id, params, detached);
  const mod = await import(`./pages/${id}.js`);
  const root = h('div');
  await mod.default(root, ctx);
  await runPasses(root, page, ctx, mod);
  return { root, page, ctx, mounts, leaves, dispose: () => runAll(leaves, 'onLeave') };
}

function errorCard(e) {
  return h('div', {}, h('div', { class: 'page' }, h('div', { class: 'empty' }, h('h3', {}, 'This page failed to load'), h('pre', {}, String(e?.stack || e)))));
}

function closeMenus() { setDrawer(false, { restore: false }); }
function markCurrent(id) {
  document.querySelectorAll('#nav a[data-id]').forEach(a => (a.dataset.id === id ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
  // v3: Home is the story (no sidebar, see-through bar); every other page is the app
  const p = pageById(id), html = document.documentElement;
  html.dataset.mode = id === 'overview' ? 'story' : 'app';
  const t = $('bar-title'); if (t) t.textContent = id === 'overview' ? '' : (p?.label || '');
}

const FOCUSABLE = 'a[href], button, input, select, textarea, summary, [tabindex]';
let firstRoute = true;
async function route({ rerender = false } = {}) {
  const my = ++token, { id, params } = parse(), view = $('view'), y = scrollY;
  // on a re-render (theme or motion change) keep open folds and the focused control
  const keep = rerender && view.dataset.page === id ? {
    open: [...view.querySelectorAll('details')].map(d => d.open),
    focus: view.contains(document.activeElement) ? [...view.querySelectorAll(FOCUSABLE)].indexOf(document.activeElement) : -1,
  } : null;
  // 2 leave the old page
  runAll(leaving, 'onLeave'); untip(); stopReading(); closeMenus(); markCurrent(id);
  const page = pageById(id);
  let out, failed = null;
  try { out = await renderPage(id, { detached: false, params }); }
  catch (e) { console.error(e); failed = e; }
  if (my !== token) { out?.dispose(); return false; }          // a newer route started meanwhile
  // 5 title
  document.title = docTitle(page);
  // 6 swap (view transition unless Calm)
  const root = failed ? errorCard(failed) : out.root;
  let swapped = false;
  const swap = () => { if (swapped) return; swapped = true; view.dataset.page = id; view.replaceChildren(...root.childNodes); };
  if (document.startViewTransition && !calmNow() && !rerender) { try { await document.startViewTransition(swap).updateCallbackDone; } catch { /* transition skipped */ } }
  swap();
  cur = { id, params };
  if (out) { leaving = out.leaves; runAll(out.mounts, 'onMount'); }
  // 8 focus or reveal
  const initial = firstRoute; firstRoute = false;
  if (rerender) {
    if (keep) {
      const ds = [...view.querySelectorAll('details')];
      if (ds.length === keep.open.length) ds.forEach((d, i) => { if (keep.open[i] && !d.open) d.open = true; });
      if (keep.focus >= 0) view.querySelectorAll(FOCUSABLE)[keep.focus]?.focus({ preventScroll: true });
    }
    scrollTo(0, y);
  }
  else if (params.fig && revealFigure(params.fig)) { /* revealed */ }
  else { if (!initial) view.focus({ preventScroll: true }); scrollTo(0, 0); }   // first load: leave focus at the top so Tab reaches the skip link
  return true;
}

export const go = (id, p = {}) => {
  const q = new URLSearchParams(p).toString();
  location.hash = `#/${id}${q ? '?' + q : ''}`;
};
export const currentRoute = () => ({ ...cur, params: { ...cur.params } });
export { currentRoute as current };

// ---------- navigation: the v3 sidebar (a drawer on phones) ----------
const narrow = () => matchMedia('(max-width: 1023px)').matches;
let drawerOpen = false;
function setDrawer(open, { restore = true } = {}) {
  const nav = $('nav'), menu = document.querySelector('.menu'); if (!nav) return;
  drawerOpen = !!open && narrow();
  nav.classList.toggle('open', drawerOpen); document.documentElement.classList.toggle('drawer-open', drawerOpen);
  menu?.setAttribute('aria-expanded', String(drawerOpen));
  menu?.setAttribute('aria-label', drawerOpen ? 'Close navigation' : 'Open navigation');
  if (drawerOpen) (nav.querySelector('[aria-current=page]') || nav.querySelector('a'))?.focus();
  else if (restore && nav.contains(document.activeElement)) menu?.focus();
}
function buildNav() {
  const nav = $('nav'), menu = document.querySelector('.menu');
  const link = p => h('a', { href: `#/${p.id}`, 'data-id': p.id }, h('span', {}, p.label));
  const groups = GROUPS.map(([name, ids], gi) => h('div', { class: 'side-g' },
    h('p', { class: 'side-h', id: `side-h-${gi}` }, name),
    h('ul', { 'aria-labelledby': `side-h-${gi}` }, ids.map(pageById).filter(Boolean).map(p => h('li', {}, link(p))))));
  nav.replaceChildren(
    h('div', { class: 'side-fx', 'aria-hidden': 'true' }),
    ...groups,
    h('div', { class: 'side-foot' },
      h('button', { type: 'button', class: 'judge', onclick: () => { closeMenus(); startTour(); }, title: 'A 1-minute guided tour of the key results' }, 'Judge mode: 1-minute tour'),
      h('a', { class: 'side-home', href: '#/overview' }, 'Back to the story')));
  // the one effect allowed in the app: a thin ember band in the sidebar header (js/fx/noise.js; nothing if it fails)
  import('./fx/noise.js').then(m => m.noiseField(nav.querySelector('.side-fx'), { strength: 0.8 })).catch(e => console.warn('sidebar band not started', e));
  const top = document.querySelector('.top');      // the sticky header's height, so revealed figures are not hidden under it
  if (top && 'ResizeObserver' in window) new ResizeObserver(() => document.documentElement.style.setProperty('--top-h', `${Math.round(top.getBoundingClientRect().height)}px`)).observe(top);
  menu?.addEventListener('click', () => setDrawer(!drawerOpen));
  nav.addEventListener('click', e => { if (e.target.closest('a')) setDrawer(false, { restore: false }); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && drawerOpen) { e.stopPropagation(); setDrawer(false); } });
  // focus stays inside the open drawer (Tab from the last link returns to the Menu button)
  nav.addEventListener('focusout', e => { if (drawerOpen && e.relatedTarget && !nav.contains(e.relatedTarget) && e.relatedTarget !== menu) setDrawer(false, { restore: false }); });
  addEventListener('resize', () => { if (drawerOpen && !narrow()) setDrawer(false, { restore: false }); });
  document.addEventListener('click', e => { if (drawerOpen && !nav.contains(e.target) && !menu.contains(e.target)) setDrawer(false, { restore: false }); });
}

let startedRouter = false;
export function start() {
  if (startedRouter) return; startedRouter = true;
  buildNav();
  addEventListener('hashchange', () => route());
  addEventListener('vo:rerender', () => route({ rerender: true }));
  return route();
}

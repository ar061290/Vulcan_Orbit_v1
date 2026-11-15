// Entry point: apply the reader's preferences, build the dock and the navigation, start the router,
// then fill the data status pill (v3; replaces the full-width banner) from data/manifest.json.
import { applyPrefs, dock } from './prefs.js';
import { load, badge } from './lib.js';
import { start } from './router.js';
import { renderPill } from './status.js';
import { SCRAPPED, MANIFEST_WHAT } from './overlays.js';
import { initField } from './field.js';
import { initEngine, loader } from './engine.js';

applyPrefs();
dock();
// UI lock: the one WebGL field replaces the 2D mote background (js/bg.js is kept but no longer started)
const fieldUp = new Promise(r => requestAnimationFrame(() => r(initField())));
const fonts = document.fonts?.ready || Promise.resolve();
const routed = Promise.resolve(start());
initEngine();
loader([fonts, fieldUp, routed]);

// v3 crosshair cursor: loaded on its own after first paint, so a failure there never stops the site. It switches
// itself on only for a fine, hovering pointer with Effects On and Motion Full (js/fx/cursor.js). Phones never fetch it.
// v3 stars.js and warp.js are not used: the field already draws the stars and its camera move is the page transition.
const fine = (() => { try { return matchMedia('(pointer:fine) and (hover:hover)').matches; } catch { return false; } })();
const later = fn => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 1500 }) : setTimeout(fn, 300));
if (fine) later(() => import('./fx/cursor.js').then(m => m.startCursor()).catch(e => console.warn('cursor effect not started', e)));

// the data status pill and its popover
const pill = document.querySelector('.pill'), pop = document.getElementById('demo-banner');
if (pill && pop) {
  const setPop = open => { pop.hidden = !open; pill.setAttribute('aria-expanded', String(open)); };
  pill.addEventListener('click', () => setPop(pop.hidden));
  addEventListener('keydown', e => { if (e.key === 'Escape' && !pop.hidden) { setPop(false); pill.focus(); } });
  document.addEventListener('click', e => { if (!pop.hidden && !e.target.closest('.pill-wrap')) setPop(false); });
  pill.closest('.pill-wrap')?.addEventListener('focusout', e => { if (e.relatedTarget && !e.currentTarget.contains(e.relatedTarget)) setPop(false); });
  addEventListener('hashchange', () => setPop(false));
}
load('manifest').then(m => renderPill(pill, pop, m, SCRAPPED, MANIFEST_WHAT, badge)).catch(e => console.error(e));

// v3 'scrolled' top bar, adopted only as far as contrast allows: the bar keeps its solid panel at all times (its text
// sits over the live field), and on Home the bottom rule appears once the page scrolls (css/shell-merge.css)
const topBar = document.querySelector('.top');
let sTick = 0;
const onScroll = () => { if (sTick) return; sTick = requestAnimationFrame(() => { sTick = 0; topBar?.classList.toggle('scrolled', scrollY > 24); }); };
addEventListener('scroll', onScroll, { passive: true }); onScroll();

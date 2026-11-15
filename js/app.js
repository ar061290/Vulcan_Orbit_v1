// Entry point: apply the reader's preferences, build the dock and the navigation, start the router,
// then fill the data status pill from data/manifest.json.
import { applyPrefs, dock } from './prefs.js';
import { load, badge } from './lib.js';
import { start } from './router.js';
import { renderPill } from './status.js';
import { SCRAPPED, MANIFEST_WHAT } from './overlays.js';

applyPrefs();
dock();
// signature effects (v3): loaded on their own, so a failure there never stops the site
import('./fx/stars.js').then(m => m.startStars()).catch(e => console.warn('stars effect not started', e));
import('./fx/cursor.js').then(m => m.startCursor()).catch(e => console.warn('cursor effect not started', e));
start();
// the data status pill (v3; replaces the full-width banner)
const pill = document.querySelector('.pill'), pop = document.getElementById('demo-banner');
const setPop = open => { pop.hidden = !open; pill.setAttribute('aria-expanded', String(open)); };
pill?.addEventListener('click', () => setPop(pop.hidden));
addEventListener('keydown', e => { if (e.key === 'Escape' && pop && !pop.hidden) { setPop(false); pill.focus(); } });
document.addEventListener('click', e => { if (pop && !pop.hidden && !e.target.closest('.pill-wrap')) setPop(false); });
load('manifest').then(m => renderPill(pill, pop, m, SCRAPPED, MANIFEST_WHAT, badge)).catch(e => console.error(e));
// story mode: the see-through top bar gets its background once the page scrolls
const topBar = document.querySelector('.top');
const onScroll = () => topBar?.classList.toggle('scrolled', scrollY > 24);
addEventListener('scroll', onScroll, { passive: true }); onScroll();

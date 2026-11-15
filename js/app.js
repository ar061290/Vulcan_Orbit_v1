// Entry point: apply the reader's preferences, build the dock and the navigation, start the router,
// then fill the project status banner from data/manifest.json.
import { applyPrefs, dock } from './prefs.js';
import { load } from './lib.js';
import { start } from './router.js';
import { renderBanner } from './status.js';
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
load('manifest').then(m => renderBanner(document.getElementById('demo-banner'), m, SCRAPPED, MANIFEST_WHAT)).catch(e => console.error(e));

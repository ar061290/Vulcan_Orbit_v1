// Entry point: apply the reader's preferences, build the dock and the navigation, start the router,
// then fill the project status banner from data/manifest.json.
import { applyPrefs, dock } from './prefs.js';
import { load } from './lib.js';
import { start } from './router.js';
import { renderBanner } from './status.js';
import { SCRAPPED, MANIFEST_WHAT } from './overlays.js';
import { startBackground } from './bg.js';

applyPrefs();
dock();
startBackground();
start();
load('manifest').then(m => renderBanner(document.getElementById('demo-banner'), m, SCRAPPED, MANIFEST_WHAT)).catch(e => console.error(e));

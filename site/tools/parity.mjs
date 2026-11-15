#!/usr/bin/env node
// P7-A parity crawl: old site (main) vs new site (feat/site-v2).
// For every route it collects the figure cards (h2 title, status stamps, fold state, what was drawn), the other headings,
// and every control (button, input, select, textarea, summary, link inside a figure), plus the shell (nav, dock, footer).
// Each old item is then classed PRESENT / MOVED / REPL / DROP / FAILURE using the §3 rows of site/REBUILD_PLAN.md
// (the tables below quote the row), and site/PARITY.md is written.
//
// Usage (repo root):  node site/tools/parity.mjs [--old-root ../vo-old] [--new-root .] [--old URL] [--new URL]
//                                             [--out site/PARITY.md] [--json FILE]
//   Without --old/--new it starts `python3 -m http.server` for each root on a free port (8100-8199) and stops it at the end.
//   playwright-core is NOT a repo dependency: it is imported from node_modules if resolvable, else from $PW_DIR
//   (a folder holding node_modules/playwright-core). The browser is $CHROME, else the newest
//   ~/.cache/ms-playwright/chromium_headless_shell-*, else Playwright's default.
//   One browser, one page at a time, reduced motion (Calm) on both sites so no animation loops run during the crawl.
//   If the headless shell cannot find its system libraries (libnspr4 etc.), point LD_LIBRARY_PATH at a folder holding them.
//   On this machine all browser runs go through the shared lock:  bash <scratchpad>/browser_lock.sh node site/tools/parity.mjs
// Exit code: 0 when there are no FAILURE rows, 1 otherwise, 2 on a crash.
import { spawn } from 'node:child_process';
import { existsSync, readdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { pathToFileURL } from 'node:url';

// ---------------------------------------------------------------- arguments
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const REPO = resolve(new URL('../..', import.meta.url).pathname);
const OLD_ROOT = resolve(arg('--old-root', join(REPO, '..', 'vo-old')));
const NEW_ROOT = resolve(arg('--new-root', REPO));
const OUT = resolve(arg('--out', join(REPO, 'site', 'PARITY.md')));
const JSON_OUT = arg('--json', null);

// ---------------------------------------------------------------- routes
const OLD_ROUTES = ['overview', 'memory', 'detect', 'predict', 'respond', 'flame', 'evidence', 'ask', 'explorer', 'locate', 'about', 'models', 'design'];
const NEW_ROUTES = ['overview', 'memory', 'detect', 'assess', 'predict', 'respond', 'flame', 'explorer', 'evidence', 'ask', 'models', 'earth', 'locate', 'about', 'design'];
// URL-state links main supports (§3.1 "params() URL state: KEEP"); crawled on both sites for errors and titles only
const VARIANTS = ['detect?event=wire', 'detect?event=s2', 'predict?o2=30&flow=10', 'overview?atm=air'];

// Interaction states: figures that only appear after a click (crawled on both sites, merged into the route's figure set).
// Old main: "Click two rows to compare them" (row onclick); new: a Compare <button aria-pressed> per row (§3.9 B4).
const STATES = [
  { route: 'explorer', name: 'two investigations picked',
    old: async page => { const rows = page.locator('#view tbody tr'); await rows.nth(0).click(); await page.waitForTimeout(150); await page.locator('#view tbody tr').nth(1).click(); },
    new: async page => { await page.locator('#view button.xp-pick').nth(0).click(); await page.waitForTimeout(150); await page.locator('#view button.xp-pick').nth(1).click(); } },
];

// Which new file renders each route's figures (for the owner column of a FAILURE). Title-level overrides in OWNER_TITLE.
const OWNER_ROUTE = {
  overview: 'js/pages/overview.js (P3-D), js/mission.js', memory: 'js/pages/memory.js (P5-E)',
  detect: 'js/fig_detect.js, js/pages/detect.js (P4-A)', assess: 'js/fig_assess.js, js/pages/assess.js (P3-B)',
  predict: 'js/pages/predict.js (P4-C)', respond: 'js/fig_respond.js, js/pages/respond.js (P4-D)',
  flame: 'js/fig_flame.js, js/flame_sim.js, js/pages/flame.js (P5-A)', explorer: 'js/pages/explorer.js (P5-B)',
  evidence: 'js/fig_checks.js, js/pages/evidence.js (P4-E)', ask: 'js/pages/ask.js (P5-D)',
  models: 'js/fig_modelcards.js, js/pages/models.js (P5-C)', earth: 'js/pages/earth.js (P5-F)',
  locate: 'js/fig_bench.js, js/pages/locate.js (P5-E)', about: 'js/pages/about.js (P5-E)', design: 'js/pages/design.js (P1-A)',
  shell: 'index.html, js/router.js, js/prefs.js, js/status.js (P1-A)',
};
const OWNER_TITLE = {
  'Where the smoke goes': 'js/fig_drift.js (P4-B)', 'What if the fire starts somewhere else?': 'js/fig_drift.js (P4-B)',
  'Checked against a real spacecraft fire': 'js/fig_drift.js (P4-B)', 'What actually decides if a fire is caught?': 'js/fig_drift.js (P4-B)',
  'Second opinion: a cabin with racks': 'js/fig_drift.js (P4-B)', 'What if the fire starts somewhere else? (cabin with racks)': 'js/fig_drift.js (P4-B)',
  'Walk around the smoke (3D)': 'js/fig_cabin3d.js (P4-B)', 'Will it spread, and how fast?': 'js/fig_spread.js (P4-C)',
  'How big does it get, and when does it stop?': 'js/fig_spread.js (P4-C)', 'What NASA has not tested': 'js/fig_gaps.js (P4-C)',
  'Moon and Mars': 'js/fig_gaps.js (P4-C)', 'Can you trust this?': 'js/fig_checks.js (P4-E)',
};

// ---------------------------------------------------------------- DROP / REPL rules (quoted from REBUILD_PLAN.md §3 and §7)
// Figures: old title → { act, to?, why }. `to` is the new title (searched on every route).
// RENAMED: the same figure under a new title (content present, not a failure; listed for the lead). Keys may be 'route|title'.
const FIG_RULES = {
  'models|Where does the smoke go?': { act: 'RENAMED', to: 'M3 Smoke drift', why: '§3.10: one section per model, named by model (M3 smoke drift ...); the question moves to the card sub' },
  'models|Would a fast-rise alarm be quicker?': { act: 'RENAMED', to: 'M4 Alarm timing', why: '§3.10: "M4 alarm timing (with the rate-of-rise extension)" section' },
  'models|Will the detector miss this smoke?': { act: 'RENAMED', to: 'M5 Smoke miss', why: '§3.10: M5 section' },
  'models|How fast does flame cross an acrylic slab? (M6)': { act: 'RENAMED', to: 'M6 Flame spread over PMMA slabs', why: '§3.10: M6 section' },
  'models|Will it spread, and how fast? (M6b)': { act: 'RENAMED', to: 'M6b Spread predictor and growth', why: '§3.10: M6b section' },
  'models|Will a droplet flame go out?': { act: 'RENAMED', to: 'M7 Droplet flame goes out', why: '§3.10: "M7 extinction" section' },
  'models|How fast does a droplet burn?': { act: 'RENAMED', to: 'M7 Droplet burning rate', why: '§3.10: "M7 burning rate" section' },
  'models|Does a cool flame keep burning?': { act: 'RENAMED', to: 'M7 Cool flame', why: '§3.10: "M7 cool flame" section' },
  'design|Colour · Day theme': { act: 'RENAMED', to: 'Colour and contrast', why: '§3.14 Design kit: "live colour tokens with WCAG ratios, now measured at all 3 text sizes" (both themes in one card; the old title followed the current theme)' },
  'design|Colour · Night theme': { act: 'RENAMED', to: 'Colour and contrast', why: '§3.14 Design kit (as above)' },
  'Where the locator put the source': { act: 'DROP', why: '§3.13: "The old ... are DROPPED (C5, plan v2 features 3, 4 and 5 removed)" (thermopile locator scrapped)' },
  'More sensors, less error': { act: 'DROP', why: '§3.13: DROPPED with the thermopile locator (C5, plan v2 features 3, 4, 5)' },
  'Bench trials: ion wind and fine mist': { act: 'REPL', to: 'Bench mist trial', why: '§3.7 row 7: REPL "Bench trials: ion wind and fine mist" → "Bench mist trial" (no ion-wind or thermopile text)' },
};
// Headings outside figure cards (hero, story, plaques, empty-state h3s) that §3 drops or rewords.
const HEAD_RULES = {};
// Controls: route → [{ match: RegExp on the normalised label, act, to?, why }]
const CTRL_RULES = {
  detect: [
    { match: /^time$/, card: /^replay an orbital fire$/, act: 'REPL', to: 'Time after ignition, s', why: '§3.4 row 1: NEW slider label "Time after ignition, s" with a seconds value' },
  ],
  models: [
    { match: /^made by /, act: 'DROP', why: '§3.10: "`provenance:false` avoids duplicate Made-by blocks" (main attached one Made-by to the M5 card only, through its MADE title key; each new section carries its own method, data and files)' },
  ],
  '*': [
    { match: /^show \d+ more figures?/, act: 'REPL', to: 'Show N more figures', why: '§2.3/§2.5: fold count follows the new `keep` values (D1.5) and the new figure set; checked as "show N more figures"' },
  ],
};

// ---------------------------------------------------------------- helpers
const norm = s => String(s ?? '').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/‑|–|—/g, '-').replace(/\s+/g, ' ').trim();
const key = s => norm(s).toLowerCase();
const loose = s => key(s).replace(/^[\u25b6\u25b8\u23f8\u275a\u23f5\u21bb\u27f2\s]+/u, '').replace(/\s*\([^)]*\)\s*$/, '').replace(/\d+([.,]\d+)?/g, '#');
const esc = s => norm(s).replace(/\|/g, '\\|');
const uniq = a => [...new Set(a)];

function freePort(lo = 8100, hi = 8199) {
  const tryP = p => new Promise(res => { const s = createServer(); s.once('error', () => res(false)); s.listen(p, '127.0.0.1', () => s.close(() => res(true))); });
  return (async () => { for (let p = lo; p <= hi; p++) if (await tryP(p)) return p; throw new Error('no free port in 8100-8199'); })();
}
const servers = [];
async function serve(root) {
  const port = await freePort();
  const p = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1', '--directory', root], { stdio: 'ignore' });
  servers.push(p);
  for (let i = 0; i < 50; i++) {   // wait until it answers
    try { const r = await fetch(`http://127.0.0.1:${port}/index.html`); if (r.ok) return `http://127.0.0.1:${port}/`; } catch { /* not up yet */ }
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error(`server for ${root} did not start`);
}
function stopServers() { for (const p of servers) { try { p.kill('SIGTERM'); } catch { /* gone */ } } }
process.on('exit', stopServers);
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { stopServers(); process.exit(130); });

async function loadPlaywright() {
  for (const m of ['playwright-core', 'playwright']) { try { return await import(m); } catch { /* try next */ } }
  const dir = process.env.PW_DIR;
  if (dir) for (const m of ['playwright-core', 'playwright']) {
    const f = join(dir, 'node_modules', m, 'index.mjs');
    if (existsSync(f)) return import(pathToFileURL(f).href);
  }
  throw new Error('playwright-core not found: install it in a scratch folder and set PW_DIR to that folder (never add it to the repo)');
}
function chromePath() {
  if (process.env.CHROME) return process.env.CHROME;
  const base = join(homedir(), '.cache', 'ms-playwright');
  if (!existsSync(base)) return undefined;
  const dirs = readdirSync(base).filter(d => d.startsWith('chromium_headless_shell-')).sort().reverse();
  for (const d of dirs) { const f = join(base, d, 'chrome-headless-shell-linux64', 'chrome-headless-shell'); if (existsSync(f)) return f; }
  return undefined;
}

// ---------------------------------------------------------------- in-page extraction
// Runs inside the page. Records fold state first, then opens every <details> and records what is drawn.
function extract() {
  const view = document.getElementById('view');
  const txt = n => (n?.textContent || '').replace(/\s+/g, ' ').trim();
  const titleOf = h => { if (!h) return ''; const c = h.cloneNode(true); c.querySelectorAll('.badge, .sr, .fignum').forEach(x => x.remove()); return txt(c); };
  const topCards = el => [...el.querySelectorAll('section.card')];
  const foldedBefore = new Map(topCards(view).map(c => [c, !!c.closest('details:not([open])')]));
  view.querySelectorAll('details').forEach(d => { d.open = true; });
  const label = el => {
    const a = el.getAttribute('aria-label'); if (a) return a;
    const lb = el.getAttribute('aria-labelledby'); if (lb) { const t = lb.split(/\s+/).map(id => txt(document.getElementById(id))).join(' ').trim(); if (t) return t; }
    if (el.labels?.length) { const c = el.labels[0].cloneNode(true); c.querySelectorAll('select, input, textarea').forEach(x => x.remove()); const t = txt(c); if (t) return t; }
    if (el.tagName === 'SELECT') return '(select)';
    if (el.tagName === 'INPUT') return el.placeholder || el.title || el.name || `(${el.type} input)`;
    return txt(el) || el.title || '(unlabelled)';
  };
  const kind = el => el.tagName === 'INPUT' ? `input:${el.type}` : el.tagName.toLowerCase();
  const cardTitle = el => { const c = el.closest('section.card'); return c ? titleOf(c.querySelector(':scope > h2') || c.querySelector('h2')) : null; };
  const CTRL = 'button, input, select, textarea, summary, [role=button]:not(button), [role=switch], [role=slider]';
  const controls = [...view.querySelectorAll(CTRL)].filter(el => !el.matches('.term, .term *')).map(el => ({ kind: kind(el), label: label(el), card: cardTitle(el), pressed: el.getAttribute('aria-pressed'), expanded: el.getAttribute('aria-expanded') }));
  const links = [...view.querySelectorAll('a[href]')].map(a => ({ label: txt(a) || a.getAttribute('aria-label') || '', href: a.getAttribute('href'), card: cardTitle(a) }));
  const cards = topCards(view).map(c => {
    const h2 = c.querySelector(':scope > h2') || c.querySelector('h2');
    const t = txt(c);
    const tc = c.cloneNode(true); tc.querySelectorAll('pre, code, .empty pre').forEach(x => x.remove());
    const t2 = txt(tc);
    return {
      title: titleOf(h2), stamps: [...(h2?.querySelectorAll('.badge') || [])].map(txt), inner: uniq([...c.querySelectorAll('.badge')].map(txt)),
      nested: !!c.parentElement?.closest('section.card'), folded: foldedBefore.get(c) || false,
      svg: c.querySelectorAll('svg.chart, svg[role=img]').length, canvas: c.querySelectorAll('canvas').length, table: c.querySelectorAll('table').length,
      empty: c.querySelector('.empty h3') ? txt(c.querySelector('.empty h3')) : null, len: t.length,
      strayNull: /(^|[\s(:>])null([\s).,;<]|$)/.test(t2) || /\bundefined\b|\bNaN\b|\[object Object\]/.test(t2),
      sub: txt(c.querySelector(':scope > .sub')).slice(0, 300),
      fignum: c.dataset.fignum || null, id: c.id || null,
    };
  });
  function uniq(a) { return [...new Set(a)]; }
  const heads = [...view.querySelectorAll('h1, h2, h3')].filter(h => !(h.tagName === 'H2' && h.parentElement?.matches('section.card'))).map(h => ({ tag: h.tagName.toLowerCase(), text: titleOf(h), card: cardTitle(h) })).filter(h => h.text);
  const badges = [...view.querySelectorAll('.badge')].map(txt);
  const vc = view.cloneNode(true); vc.querySelectorAll('pre, code').forEach(x => x.remove());
  const viewText = txt(vc);
  return { cards, heads, controls, links, badges, len: viewText.length, title: document.title,
    strayNull: (viewText.match(/.{0,40}(?:\bnull\b|\bundefined\b|\bNaN\b|\[object Object\]).{0,40}/g) || []).slice(0, 8) };
}
function extractShell() {
  const txt = n => (n?.textContent || '').replace(/\s+/g, ' ').trim();
  const view = document.getElementById('view');
  const out = [];
  document.querySelectorAll('button, a[href], input, select, summary').forEach(el => {
    if (view.contains(el)) return;
    const region = el.closest('header') ? 'header' : el.closest('footer') ? 'footer' : el.closest('.dock, [class*=dock]') ? 'dock' : el.closest('#nav') ? 'nav' : 'body';
    out.push({ region, kind: el.tagName.toLowerCase(), label: el.getAttribute('aria-label') || txt(el) || el.title || '', href: el.getAttribute('href') });
  });
  const banner = document.querySelector('.statusbar, .status-banner, #status, .banner:not(.banner-gl)');
  return { controls: out, banner: banner ? txt(banner).slice(0, 400) : null, skip: !!document.querySelector('a.skip, a[href="#view"]'), live: document.querySelectorAll('[aria-live]').length };
}

async function settle(page, isNew, id, budget = 15000) {
  const t0 = Date.now();
  if (isNew) { try { await page.waitForFunction(i => document.getElementById('view')?.dataset.page === i, id, { timeout: budget }); } catch { /* reported as blank */ } }
  let last = -1, same = 0;
  while (Date.now() - t0 < budget) {
    const n = await page.evaluate(() => { const v = document.getElementById('view'); const busy = /Building site map|Loading/.test(v?.textContent || '') ? 1 : 0; return (v?.innerHTML.length || 0) * 2 + busy; });
    if (n === last && !(n & 1)) { if (++same >= 3) return; } else same = 0;
    last = n; await page.waitForTimeout(350);
  }
}

async function crawl(browser, base, routes, isNew) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce', colorScheme: 'light' });
  await ctx.addInitScript(() => { try { localStorage.setItem('vo.motion', 'calm'); } catch { /* blocked */ } });
  const page = await ctx.newPage();
  const errors = []; let route = '(load)';
  page.on('console', m => { if (m.type() === 'error') errors.push({ route, text: m.text().slice(0, 300) }); });
  page.on('pageerror', e => errors.push({ route, text: 'pageerror: ' + String(e.message).slice(0, 300) }));
  page.on('requestfailed', r => { if (!/favicon/.test(r.url())) errors.push({ route, text: 'request failed: ' + r.url().replace(base, '') }); });
  page.on('response', r => { if (r.status() >= 400 && !/favicon/.test(r.url())) errors.push({ route, text: `HTTP ${r.status()}: ${r.url().replace(base, '')}` }); });
  const out = {};
  await page.goto(base + 'index.html#/overview', { waitUntil: 'load' });
  await settle(page, isNew, 'overview');
  const shell = await page.evaluate(extractShell);
  for (const r of [...routes, ...VARIANTS]) {
    route = r; const id = r.split('?')[0];
    await page.evaluate(h => { location.hash = h; }, '#/' + r);
    await settle(page, isNew, id);
    await page.waitForTimeout(150);
    out[r] = await page.evaluate(extract);
    await settle(page, false, id, 3000);   // opening folds may lazily render
    if (!VARIANTS.includes(r)) {
      const again = await page.evaluate(extract);
      if (again.cards.length > out[r].cards.length || again.controls.length > out[r].controls.length) { again.cards.forEach((c, i) => { c.folded = out[r].cards[i]?.folded ?? c.folded; }); out[r] = again; }
    }
  }
  const states = [];
  for (const st of STATES) {
    route = `${st.route} (${st.name})`;
    await page.evaluate(() => { location.hash = '#/overview'; }); await settle(page, isNew, 'overview', 5000);
    await page.evaluate(h => { location.hash = h; }, '#/' + st.route);
    await settle(page, isNew, st.route);
    let ok = true;
    try { await (isNew ? st.new : st.old)(page); } catch (e) { ok = false; errors.push({ route, text: `state action failed: ${String(e.message).split('\n')[0].slice(0, 200)}` }); }
    await settle(page, false, st.route, 4000);
    const got = await page.evaluate(extract);
    const base = out[st.route], have = new Set(base.cards.map(c => c.title.toLowerCase()));
    const added = got.cards.filter(c => c.title && !have.has(c.title.toLowerCase()));
    const inAdded = x => x.card && added.some(c => c.title === x.card);
    base.cards.push(...added.map(c => ({ ...c, state: st.name })));
    base.controls.push(...got.controls.filter(inAdded)); base.links.push(...got.links.filter(inAdded));
    base.heads.push(...got.heads.filter(inAdded));
    states.push({ route: st.route, name: st.name, ok, added: added.map(c => c.title) });
  }
  await ctx.close();
  return { pages: out, shell, errors, states };
}

// ---------------------------------------------------------------- comparison
function compare(O, N) {
  const rows = { figs: [], heads: [], ctrls: [], links: [], stamps: [], pageStamps: [], shell: [], newOnly: [], render: [] };
  const newIndex = new Map();           // key(title) → [{route, card}]
  for (const r of NEW_ROUTES) for (const c of N.pages[r].cards) { if (!c.title) continue; const k = key(c.title); if (!newIndex.has(k)) newIndex.set(k, []); newIndex.get(k).push({ route: r, card: c }); }
  const findNew = (title, route) => { const hits = newIndex.get(key(title)) || []; return hits.find(x => x.route === route) || hits[0] || null; };
  const owner = (title, route) => OWNER_TITLE[norm(title)] || OWNER_ROUTE[route] || '?';
  const usedNew = new Set();

  // figures and their stamps
  for (const r of OLD_ROUTES) {
    const seen = new Map();
    for (const c of O.pages[r].cards) {
      if (!c.title) continue;
      const n = (seen.get(key(c.title)) || 0) + 1; seen.set(key(c.title), n);
      if (n > 1) continue;              // repeated titles (e.g. nested) counted once
      const rule = FIG_RULES[`${r}|${norm(c.title)}`] || FIG_RULES[norm(c.title)];
      let hit = rule?.act === 'RENAMED' ? null : findNew(c.title, r), act, note = '';
      if (hit) { act = hit.route === r ? 'PRESENT' : 'MOVED'; if (hit.route !== r) note = `now on #/${hit.route}`; }
      else if (rule?.act === 'RENAMED') {
        hit = findNew(rule.to, r); act = hit ? 'RENAMED' : 'FAILURE';
        note = `→ "${rule.to}"${hit && hit.route !== r ? ` on #/${hit.route}` : ''}. ${rule.why}${hit ? (key(hit.card.sub).includes(key(c.title).replace(/\s*\(m\d+b?\)$/, '')) ? '; the old title text is the new card sub' : '') : ' — new title NOT FOUND'}`;
      }
      else if (rule?.act === 'REPL') { hit = rule.to ? findNew(rule.to, r) : null; act = 'REPL'; note = `${rule.why}${hit ? ` — new "${rule.to}" on #/${hit.route}` : ` — new "${rule.to}" NOT FOUND`}`; if (rule.to && !hit) act = 'FAILURE'; }
      else if (rule?.act === 'DROP') { act = 'DROP'; note = rule.why; }
      else act = 'FAILURE';
      if (hit) usedNew.add(hit.route + '|' + key(hit.card.title));
      rows.figs.push({ route: r, title: c.title, nested: c.nested, oldStamp: c.stamps.join(', '), newStamp: hit ? hit.card.stamps.join(', ') : '', newFolded: hit?.card.folded, act, note, owner: act === 'FAILURE' ? owner(c.title, r) : '' });
      if (hit) {
        const os = c.stamps.map(key).sort().join(','), ns = hit.card.stamps.map(key).sort().join(',');
        if (!hit.card.stamps.length) rows.stamps.push({ route: hit.route, title: c.title, old: c.stamps.join(', ') || '(none)', now: '(none)', act: 'FAILURE', owner: owner(c.title, hit.route) });
        else if (os !== ns) rows.stamps.push({ route: hit.route, title: c.title, old: c.stamps.join(', ') || '(none)', now: hit.card.stamps.join(', '), act: c.stamps.length ? 'CHANGED' : 'ADDED',
          note: STAMP_NOTES[`${r}|${norm(c.title)}`] || STAMP_NOTES[r] || (c.stamps.length ? '' : '§0 rule 4: every card gets a status stamp (a text-only card uses its file\'s status, otherwise `team`)') });
      }
    }
  }
  // figures that exist only in the new site
  for (const r of NEW_ROUTES) for (const c of N.pages[r].cards) if (c.title && !usedNew.has(r + '|' + key(c.title)) && !rows.newOnly.some(x => x.route === r && key(x.title) === key(c.title))) rows.newOnly.push({ route: r, title: c.title, stamp: c.stamps.join(', '), folded: c.folded, nested: c.nested });

  // headings outside figure titles (hero, story, plaques, empty states, sub-heads)
  for (const r of OLD_ROUTES) {
    const newHeads = new Set(NEW_ROUTES.flatMap(nr => [...N.pages[nr].heads.map(h => key(h.text)), ...N.pages[nr].cards.map(c => key(c.title))]));
    const newLoose = new Set([...newHeads].map(loose));
    for (const hd of uniq(O.pages[r].heads.map(h => JSON.stringify([h.tag, h.text, h.card])))) {
      const [tag, text, cardT] = JSON.parse(hd);
      const fr = FIG_RULES[`${r}|${norm(cardT)}`] || FIG_RULES[norm(cardT)];
      if (fr && ['DROP', 'REPL'].includes(fr.act) && !newHeads.has(key(text))) { rows.heads.push({ route: r, tag, text, card: cardT, act: fr.act, note: `inside ${fr.act === 'DROP' ? 'dropped' : 'replaced'} figure "${cardT}" (${fr.why.split(':')[0]})` }); continue; }
      const rule = HEAD_RULES[norm(text)];
      const act = newHeads.has(key(text)) ? 'PRESENT' : newLoose.has(loose(text)) ? 'PRESENT' : rule ? rule.act : 'FAILURE';
      rows.heads.push({ route: r, tag, text, card: cardT, act, note: act === 'PRESENT' && !newHeads.has(key(text)) ? 'matched with numbers ignored' : rule?.why || '', owner: act === 'FAILURE' ? owner(cardT || text, r) : '' });
    }
  }

  // controls (per route; a control that moved with its figure is searched on the figure's new route too)
  for (const r of OLD_ROUTES) {
    const pool = (nr) => (N.pages[nr]?.controls || []);
    const figMoves = new Map(rows.figs.filter(f => f.route === r && f.note.startsWith('now on #/')).map(f => [key(f.title), f.note.slice(9)]));
    const seen = new Map();
    for (const c of O.pages[r].controls) {
      const k = `${c.kind}|${key(c.label)}`; const n = (seen.get(k) || 0) + 1; seen.set(k, n);
      const target = c.card && figMoves.get(key(c.card)) || r;
      const cands = [...pool(target), ...(target !== r ? pool(r) : [])];
      const sameKind = x => x.kind === c.kind || (/^input:(checkbox|radio)$/.test(c.kind) && x.kind === 'button') || (c.kind === 'button' && /^input:(checkbox|radio)$/.test(x.kind));
      const exactN = cands.filter(x => key(x.label) === key(c.label)).length;
      const looseN = cands.filter(x => loose(x.label) === loose(c.label)).length;
      const kindN = cands.filter(x => key(x.label) === key(c.label) && sameKind(x)).length;
      if (n > 1) { continue; }   // count each distinct control once; multiplicity checked below
      const oldCount = O.pages[r].controls.filter(x => `${x.kind}|${key(x.label)}` === k).length;
      const fig = c.card ? rows.figs.find(f => f.route === r && key(f.title) === key(c.card)) : null;
      let act, note = '';
      const rule = [...(CTRL_RULES[r] || []), ...CTRL_RULES['*']].find(x => x.match.test(key(c.label)) && (!x.card || x.card.test(key(c.card || ''))));
      if (fig && (fig.act === 'DROP')) { act = 'DROP'; note = `inside dropped figure "${c.card}"`; }
      else if (exactN) { act = kindN ? 'PRESENT' : 'PRESENT'; if (!kindN) note = `now a ${cands.find(x => key(x.label) === key(c.label)).kind}`; if (exactN < oldCount) note += `${note ? '; ' : ''}old has ${oldCount}, new has ${exactN}`; if (target !== r) note += `${note ? '; ' : ''}moved with its figure to #/${target}`; }
      else if (looseN) { act = 'PRESENT'; note = 'matched with numbers ignored'; }
      else if (rule) { act = rule.act; note = rule.why; }
      else if (fig?.act === 'REPL') { act = 'REPL'; note = `inside replaced figure "${c.card}" (${fig.note.split(' — ')[0]})`; }
      else {
        // same figure, same kind, one such control on each side: the control is there under another accessible name
        const newCard = fig && ['PRESENT', 'MOVED', 'RENAMED'].includes(fig.act) ? (fig.act === 'RENAMED' ? fig.note.match(/^→ "(.*?)"/)?.[1] : c.card) : null;
        const oldSame = O.pages[r].controls.filter(x => x.card === c.card && x.kind === c.kind);
        const newSame = newCard ? cands.filter(x => key(x.card || '') === key(newCard) && x.kind === c.kind) : [];
        if (oldSame.length === 1 && newSame.length === 1) { act = 'RENAMED'; note = `accessible name now "${newSame[0].label}"`; }
        else act = 'FAILURE';
      }
      rows.ctrls.push({ route: r, kind: c.kind, label: c.label, card: c.card, count: oldCount, act, note, owner: act === 'FAILURE' ? owner(c.card || '', r) : '' });
    }
  }

  // links inside pages (label match on the same route, or on the route a figure moved to; href changes are noted)
  for (const r of OLD_ROUTES) {
    const done = new Set();
    for (const l of O.pages[r].links) {
      const k = key(l.label) + '|' + l.href; if (done.has(k) || !l.label) continue; done.add(k);
      const fig = l.card ? rows.figs.find(f => f.route === r && key(f.title) === key(l.card)) : null;
      const routes = uniq([r, fig?.note.startsWith('now on #/') ? fig.note.slice(9) : r]);
      const pool = routes.flatMap(nr => N.pages[nr]?.links || []);
      const base = u => String(u || '').split('?')[0], noParen = t => key(t).replace(/\s*\([^)]*\)\s*$/, '');
      const newCard = fig?.act === 'RENAMED' ? fig.note.match(/^→ "(.*?)"/)?.[1] : l.card;
      const sameCard = x => key(x.card || '') === key(newCard || '');
      const squash = t => key(t).replace(/\s+/g, '');   // textContent of block links joins child text with or without spaces
      const hit = pool.find(x => key(x.label) === key(l.label))
        || pool.find(x => squash(x.label) === squash(l.label) && base(x.href) === base(l.href))
        || pool.find(x => x.href === l.href && sameCard(x))
        || pool.find(x => noParen(x.label) === noParen(l.label))
        || (l.href.startsWith('#/') ? pool.find(x => base(x.href) === base(l.href) && sameCard(x) && (l.card || loose(x.label).slice(0, 8) === loose(l.label).slice(0, 8))) : null)
        || pool.find(x => loose(x.label) === loose(l.label) && base(x.href) === base(l.href));
      const rule = (LINK_RULES[r] || []).find(x => x.match.test(key(l.label)));
      // a REPL link rule names what replaces the old link; the replacement must be found, or the row is a FAILURE
      const repl = !hit && rule?.find ? rule.find(pool, l) : null;
      let act = hit ? 'PRESENT' : rule ? (rule.find && !repl ? 'FAILURE' : rule.act) : fig && ['DROP', 'REPL'].includes(fig.act) ? fig.act : 'FAILURE';
      let note = hit ? (hit.href !== l.href ? `href now ${hit.href}` : key(hit.label) !== key(l.label) ? `now "${hit.label}"` : '') : rule ? rule.why : fig && ['DROP', 'REPL'].includes(fig.act) ? `inside ${fig.act === 'DROP' ? 'dropped' : 'replaced'} figure "${fig.title}"` : '';
      if (repl) note += ` — now "${repl.label}" → ${repl.href}`;
      else if (rule?.find && !hit) note += ' — replacement NOT FOUND';
      rows.links.push({ route: r, label: l.label, href: l.href, card: l.card, act, note, owner: act === 'FAILURE' ? (OWNER_TITLE[norm(l.card || '')] || OWNER_ROUTE[r]) : '' });
    }
  }

  // stamp labels per page (also catches stamps outside figure cards, e.g. the Home three questions)
  for (const r of OLD_ROUTES) {
    const cnt = a => a.reduce((m, x) => m.set(x, (m.get(x) || 0) + 1), new Map());
    const o = cnt(O.pages[r].badges), nn = cnt(N.pages[r]?.badges || []);
    const gone = rows.figs.filter(f => f.route === r && ['DROP', 'REPL'].includes(f.act));
    for (const [label, k] of o) {
      const now = nn.get(label) || 0;
      let act = now ? 'PRESENT' : 'FAILURE', note = '';
      const raw = { team: 'Team choice', plan: 'Plan, not built', scrapped: 'Scrapped (see plan v2)' }[label];   // main printed the raw word for statuses its LABEL table lacked
      if (!now && raw && nn.get(raw)) { act = 'PRESENT'; note = `now labelled "${raw}" (§3.1 lib: badges for all 8 statuses)`; }
      else if (!now && gone.some(f => f.oldStamp.split(', ').includes(label))) { act = 'DROP'; note = `only on ${gone.filter(f => f.oldStamp.split(', ').includes(label)).map(f => `"${f.title}" (${f.act})`).join(', ')}`; }
      rows.pageStamps.push({ route: r, label, old: k, now, act, note, owner: act === 'FAILURE' ? OWNER_ROUTE[r] : '' });
    }
  }

  // shell controls
  const newShell = N.shell.controls;
  for (const c of uniq(O.shell.controls.map(x => JSON.stringify([x.region, x.kind, x.label, x.href])))) {
    const [region, kind, label, href] = JSON.parse(c);
    if (!label) continue;
    const hit = newShell.find(x => x.region === region && key(x.label) === key(label)) || newShell.find(x => key(x.label) === key(label)) || (href && href.startsWith('#/') ? newShell.find(x => x.href === href) : null);
    const rule = SHELL_RULES.find(x => x.match.test(key(label)));
    const act = hit ? 'PRESENT' : rule ? rule.act : 'FAILURE';
    rows.shell.push({ region, kind, label, href, act, note: hit ? (key(hit.label) !== key(label) ? `now "${hit.label}"` : hit.region !== region ? `now in ${hit.region}` : '') : rule?.why || '', owner: act === 'FAILURE' ? OWNER_ROUTE.shell : '' });
  }

  // rendering checks on the new site (every figure has a stamp, draws something, no stray null; console errors)
  for (const r of [...NEW_ROUTES, ...VARIANTS]) {
    const p = N.pages[r];
    if (!p.cards.length && !p.heads.length) rows.render.push({ route: r, what: 'page rendered nothing', act: 'FAILURE', owner: OWNER_ROUTE[r.split('?')[0]] });
    for (const c of p.cards) {
      if (c.nested) continue;
      if (!c.stamps.length) rows.render.push({ route: r, what: `figure "${c.title}" has no status stamp`, act: 'FAILURE', owner: OWNER_TITLE[norm(c.title)] || OWNER_ROUTE[r.split('?')[0]] });
      if (!c.svg && !c.canvas && !c.table && !c.empty && c.len < 60) rows.render.push({ route: r, what: `figure "${c.title}" looks blank (${c.len} chars, no chart/table/empty state)`, act: 'FAILURE', owner: OWNER_ROUTE[r.split('?')[0]] });
      if (c.strayNull) rows.render.push({ route: r, what: `figure "${c.title}" shows null/undefined/NaN text`, act: 'FAILURE', owner: OWNER_TITLE[norm(c.title)] || OWNER_ROUTE[r.split('?')[0]] });
    }
    for (const s of p.strayNull) if (!p.cards.some(c => c.strayNull)) rows.render.push({ route: r, what: `stray text: "…${s}…"`, act: 'FAILURE', owner: OWNER_ROUTE[r.split('?')[0]] });
  }
  for (const e of N.errors) rows.render.push({ route: e.route, what: `console: ${e.text}`, act: 'FAILURE', owner: OWNER_ROUTE[String(e.route).split('?')[0]] || OWNER_ROUTE.shell });
  for (const r of VARIANTS) {   // URL state: the variant must render the same figure set as the plain route
    const base = r.split('?')[0], a = new Set(N.pages[base].cards.map(c => key(c.title))), b = new Set(N.pages[r].cards.map(c => key(c.title)));
    const lost = [...a].filter(x => !b.has(x));
    if (lost.length) rows.render.push({ route: r, what: `figures missing with this query: ${lost.join('; ')}`, act: 'FAILURE', owner: OWNER_ROUTE[base] });
  }
  return rows;
}
const LINK_RULES = {
  overview: [
    { match: /^03 · respond/, act: 'REPL', why: '§3.2 row "The three questions 01/02/03 with stamps": KEEP, "with 03 reworded (no ion wind). The stamps become flex_suppression, m7_explorer and \"Bench mist trial (optional)\" ← response_trials"',
      find: (pool, l) => pool.find(x => /^03 · respond/.test(key(x.label)) && x.href === l.href && !/ion wind/i.test(x.label)) },
  ],
  respond: [
    { match: /^flame page$/, act: 'REPL', why: '§3.7 row 1: "Link labels become Find it, Put it out and Flame lab with `figLink`"',
      find: pool => pool.find(x => key(x.label) === 'flame lab' && x.href.startsWith('#/flame') && key(x.card || '') === key('What does the evidence cover for this fire?')) },
    { match: /^detect page$/, act: 'REPL', why: '§3.7 row 1: "Link labels become Find it, Put it out and Flame lab with `figLink`"',
      find: pool => pool.find(x => key(x.label) === 'find it' && x.href.startsWith('#/detect') && key(x.card || '') === key('What does the evidence cover for this fire?')) },
  ],
};
const STAMP_NOTES = {
  predict: '§2.12 fig_models.modelCard: "the stamp is `entry.status`, fixing main\'s bug" (main stamped every entry with the file status)',
  models: '§3.10 / §2.12: each section is stamped from its own models.json entry or file status',
  'predict|Moon and Mars': '§3.6 row 19: "KEEP text; stamp `team`"',
  'ask|Assistant scorecard': '§3.1 lib: main had no label for `team` (showed the raw word); now "Team choice"',
};
const SHELL_RULES = [
  { match: /^menu$/, act: 'PRESENT', why: '' },
];

// ---------------------------------------------------------------- report
function report(O, N, rows, meta) {
  const L = [];
  const count = (arr, a) => arr.filter(x => x.act === a).length;
  const fails = [...rows.figs, ...rows.heads, ...rows.ctrls, ...rows.links, ...rows.stamps, ...rows.pageStamps, ...rows.shell, ...rows.render].filter(x => x.act === 'FAILURE');
  L.push('# Parity: old site (main) vs new site (feat/site-v2)', '');
  L.push(`Generated by \`node site/tools/parity.mjs\` on ${meta.date}. Old: \`${meta.oldRoot}\` (${meta.oldUrl}); new: \`${meta.newRoot}\` (${meta.newUrl}).`);
  L.push('Both sites were crawled in headless Chromium at 1280 px with reduced motion (Calm), every `<details>` opened before reading, so folded figures count.', '');
  L.push('Classes: **PRESENT** (same title on the same route), **MOVED** (same title, other route), **RENAMED** (the same figure or control under a new title or accessible name; not a failure, listed for review), **REPL** / **DROP** (the §3 row of `site/REBUILD_PLAN.md` that allows it is quoted), **FAILURE** (old item missing in new and not DROP/REPL). Stamps: **CHANGED** (different stamp), **ADDED** (old had none).', '');
  L.push('## Summary', '');
  L.push('| What | PRESENT | MOVED | RENAMED | REPL | DROP | FAILURE |', '|---|---|---|---|---|---|---|');
  for (const [name, arr] of [['Figures (card titles)', rows.figs], ['Other headings', rows.heads], ['Controls in pages', rows.ctrls], ['Links in pages', rows.links], ['Shell controls', rows.shell]])
    L.push(`| ${name} | ${count(arr, 'PRESENT')} | ${count(arr, 'MOVED')} | ${count(arr, 'RENAMED')} | ${count(arr, 'REPL')} | ${count(arr, 'DROP')} | ${count(arr, 'FAILURE')} |`);
  L.push(`| Stamps on matched figures | ${rows.figs.filter(f => ['PRESENT', 'MOVED', 'RENAMED'].includes(f.act)).length - rows.stamps.length} same | | | ${count(rows.stamps, 'CHANGED')} changed, ${count(rows.stamps, 'ADDED')} added | | ${count(rows.stamps, 'FAILURE')} |`);
  L.push(`| Stamp labels per page | ${count(rows.pageStamps, 'PRESENT')} | | | | ${count(rows.pageStamps, 'DROP')} | ${count(rows.pageStamps, 'FAILURE')} |`);
  L.push(`| New-site render checks (stamp, blank, null text, console, URL state) | | | | | | ${count(rows.render, 'FAILURE')} |`, '');
  L.push(`Old site: ${OLD_ROUTES.length} routes, ${rows.figs.length} distinct figure titles. New site: ${NEW_ROUTES.length} routes, ${NEW_ROUTES.reduce((s, r) => s + N.pages[r].cards.filter(c => !c.nested).length, 0)} top-level figures (${rows.newOnly.length} titles new). Console errors: old ${O.errors.length}, new ${N.errors.length}.`, '');
  L.push(`**FAILURES: ${fails.length}.**`, '');
  if (fails.length) {
    L.push('## Failures (owner file)', '', '| Route | Kind | Item | Owner |', '|---|---|---|---|');
    for (const f of rows.figs.filter(x => x.act === 'FAILURE')) L.push(`| #/${f.route} | figure | "${esc(f.title)}" (${f.oldStamp || 'no stamp'}) ${f.note ? esc(f.note) : ''} | ${f.owner} |`);
    for (const f of rows.heads.filter(x => x.act === 'FAILURE')) L.push(`| #/${f.route} | ${f.tag} | "${esc(f.text)}"${f.card ? ` in "${esc(f.card)}"` : ''} | ${f.owner} |`);
    for (const f of rows.ctrls.filter(x => x.act === 'FAILURE')) L.push(`| #/${f.route} | ${f.kind} | "${esc(f.label)}"${f.card ? ` in "${esc(f.card)}"` : ''}${f.count > 1 ? ` (×${f.count})` : ''} | ${f.owner} |`);
    for (const f of rows.links.filter(x => x.act === 'FAILURE')) L.push(`| #/${f.route} | link | "${esc(f.label)}" → ${esc(f.href)}${f.card ? ` in "${esc(f.card)}"` : ''} | ${f.owner} |`);
    for (const f of rows.stamps.filter(x => x.act === 'FAILURE')) L.push(`| #/${f.route} | stamp | "${esc(f.title)}": old ${f.old}, new none | ${f.owner} |`);
    for (const f of rows.shell.filter(x => x.act === 'FAILURE')) L.push(`| shell (${f.region}) | ${f.kind} | "${esc(f.label)}" | ${f.owner} |`);
    for (const f of rows.pageStamps.filter(x => x.act === 'FAILURE')) L.push(`| #/${f.route} | stamp label | "${esc(f.label)}" shown ${f.old}× on the old page, 0× on the new | ${f.owner} |`);
    for (const f of rows.render.filter(x => x.act === 'FAILURE')) L.push(`| #/${f.route} | render | ${esc(f.what)} | ${f.owner} |`);
    L.push('');
  }
  const ren = [...rows.figs, ...rows.ctrls].filter(x => x.act === 'RENAMED');
  if (ren.length) {
    L.push('## Renamed (present under a new name; for review, not failures)', '', '| Route | Kind | Old name | New / reason |', '|---|---|---|---|');
    for (const x of ren) L.push(`| #/${x.route} | ${x.kind || 'figure'} | "${esc(x.title || x.label)}"${x.card ? ` in "${esc(x.card)}"` : ''} | ${esc(x.note)} |`);
    L.push('');
  }
  L.push('## Figures by old route', '');
  for (const r of OLD_ROUTES) {
    const fs = rows.figs.filter(f => f.route === r);
    L.push(`### #/${r} (${fs.length})`, '', '| Old figure | Old stamp | Result | New stamp | Folded in new | Note |', '|---|---|---|---|---|---|');
    for (const f of fs) L.push(`| ${f.nested ? '↳ ' : ''}${esc(f.title)} | ${f.oldStamp || '—'} | **${f.act}** | ${f.newStamp || '—'} | ${f.newFolded == null ? '' : f.newFolded ? 'yes' : 'no'} | ${esc(f.note)}${f.owner ? ` Owner: ${f.owner}` : ''} |`);
    L.push('');
  }
  L.push('## Figures only in the new site', '', '| Route | Figure | Stamp | Folded |', '|---|---|---|---|');
  for (const f of rows.newOnly) L.push(`| #/${f.route} | ${f.nested ? '↳ ' : ''}${esc(f.title)} | ${f.stamp || '—'} | ${f.folded ? 'yes' : 'no'} |`);
  L.push('');
  L.push('## Stamp changes on matched figures', '', 'Listed for review; a CHANGED stamp is not a failure by itself (the new site stamps from each file or entry, and every card now carries one, §0 rule 4). A missing stamp is.', '');
  L.push('| Route | Figure | Old | New | Result | Reason |', '|---|---|---|---|---|---|');
  for (const s of rows.stamps) L.push(`| #/${s.route} | ${esc(s.title)} | ${s.old} | ${s.now} | ${s.act} | ${esc(s.note || '')} |`);
  L.push('', '### Stamp labels per page', '', 'Every `.badge` on the page (figure titles, the three questions, legends, empty states), counted by label. A label the old page showed that the new page never shows is a FAILURE unless a dropped or replaced figure explains it.', '');
  L.push('| Route | Stamp label | Old count | New count | Result | Note |', '|---|---|---|---|---|---|');
  for (const s of rows.pageStamps) L.push(`| #/${s.route} | ${esc(s.label)} | ${s.old} | ${s.now} | ${s.act} | ${esc(s.note || '')} |`);
  L.push('');
  L.push('## Other headings (outside figure titles)', '', '| Route | Tag | Heading | Inside figure | Result | Note |', '|---|---|---|---|---|---|');
  for (const hd of rows.heads) L.push(`| #/${hd.route} | ${hd.tag} | ${esc(hd.text)} | ${esc(hd.card || '')} | **${hd.act}** | ${esc(hd.note)}${hd.owner ? ` Owner: ${hd.owner}` : ''} |`);
  L.push('');
  L.push('## Controls by old route', '', 'Each distinct control (kind + accessible name) on the old page; glossary term buttons are excluded. "×N" is how many the old page had.', '');
  for (const r of OLD_ROUTES) {
    const cs = rows.ctrls.filter(c => c.route === r);
    L.push(`### #/${r} (${cs.length})`, '', '| Control | In figure | Result | Note |', '|---|---|---|---|');
    for (const c of cs) L.push(`| ${c.kind} "${esc(c.label)}"${c.count > 1 ? ` ×${c.count}` : ''} | ${esc(c.card || '')} | **${c.act}** | ${esc(c.note)}${c.owner ? ` Owner: ${c.owner}` : ''} |`);
    L.push('');
  }
  L.push('## Links in pages', '', 'Each distinct link (text + href) on the old page, matched by text on the new page (or on the route its figure moved to).', '', '| Route | Link | In figure | Result | Note |', '|---|---|---|---|---|');
  for (const l of rows.links) L.push(`| #/${l.route} | "${esc(l.label)}" → ${esc(l.href)} | ${esc(l.card || '')} | **${l.act}** | ${esc(l.note)}${l.owner ? ` Owner: ${l.owner}` : ''} |`);
  L.push('');
  L.push('## Shell (header, nav, dock, footer)', '', `Old banner: ${O.shell.banner ? `"${esc(O.shell.banner)}"` : 'not found'}. New banner: ${N.shell.banner ? `"${esc(N.shell.banner)}"` : 'not found'} (§3.1: REPL wording, C7, Q1).`, `Skip link old/new: ${O.shell.skip}/${N.shell.skip}. aria-live regions old/new: ${O.shell.live}/${N.shell.live}.`, '');
  L.push('| Region | Control | Result | Note |', '|---|---|---|---|');
  for (const s of rows.shell) L.push(`| ${s.region} | ${s.kind} "${esc(s.label)}"${s.href ? ` → ${s.href}` : ''} | **${s.act}** | ${esc(s.note)} |`);
  L.push('');
  L.push('## New-site render checks', '', 'Every route and URL-state variant: each top-level figure has a stamp, draws something (chart, canvas, table, empty state or text), shows no "null"/"undefined"/"NaN"; no console error, failed request or HTTP error; a query keeps the figure set.', '');
  if (!rows.render.length) L.push('All passed.');
  else { L.push('| Route | Problem | Owner |', '|---|---|---|'); for (const r of rows.render) L.push(`| #/${r.route} | ${esc(r.what)} | ${r.owner || ''} |`); }
  L.push('', '### Interaction states', '', 'Figures that appear only after a click, crawled on both sites and counted with the route above.', '', '| Route | State | Old: figures added | New: figures added |', '|---|---|---|---|');
  for (const st of STATES) { const o = (O.states || []).find(x => x.name === st.name), n = (N.states || []).find(x => x.name === st.name);
    const f = x => !x ? 'not run' : !x.ok ? 'action failed' : x.added.length ? x.added.map(esc).join('; ') : '(none)';
    L.push(`| #/${st.route} | ${st.name} | ${f(o)} | ${f(n)} |`); }
  L.push('', '### Routes crawled', '', '| Route | Old figures | New figures | New controls |', '|---|---|---|---|');
  for (const r of uniq([...NEW_ROUTES, ...OLD_ROUTES, ...VARIANTS])) L.push(`| #/${r} | ${O.pages[r] ? O.pages[r].cards.length : '—'} | ${N.pages[r] ? N.pages[r].cards.length : '—'} | ${N.pages[r] ? N.pages[r].controls.length : '—'} |`);
  if (O.errors.length) { L.push('', '### Old-site console errors (for reference, not failures)', ''); for (const e of O.errors) L.push(`- #/${e.route}: ${esc(e.text)}`); }
  L.push('');
  return { md: L.join('\n'), fails };
}

// ---------------------------------------------------------------- main
try {
  const oldUrl = arg('--old', null) || await serve(OLD_ROOT);
  const newUrl = arg('--new', null) || await serve(NEW_ROOT);
  const pw = await loadPlaywright();
  const browser = await pw.chromium.launch({ executablePath: chromePath(), args: ['--disable-gpu'] });
  let O, N;
  try {
    O = await crawl(browser, oldUrl, OLD_ROUTES, false);
    N = await crawl(browser, newUrl, NEW_ROUTES, true);
  } finally { await browser.close(); }
  const rows = compare(O, N);
  const { md, fails } = report(O, N, rows, { date: new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC', oldRoot: OLD_ROOT, newRoot: NEW_ROOT, oldUrl, newUrl });
  writeFileSync(OUT, md);
  if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify({ old: O, new: N, rows }, null, 1));
  console.log(`parity: ${rows.figs.length} old figures, ${fails.length} FAILURE rows → ${OUT}`);
  for (const f of fails.slice(0, 60)) console.log('  FAIL', f.route ? '#/' + f.route : f.region, '|', f.title || f.text || f.label || f.what, '|', f.owner || '');
  stopServers();
  process.exit(fails.length ? 1 : 0);
} catch (e) {
  console.error(e); stopServers(); process.exit(2);
}

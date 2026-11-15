#!/usr/bin/env node
// Reachability crawl (site/REBUILD_PLAN.md §4 phase 7, package P7-C; spec Part D5 "Reachable").
//
// Starts at Home and follows only what a visitor can see and press: visible links, the top menu, the "More" menu,
// the mobile "Menu" button and folds (<details>). It never types a URL except the site root. Every route is reached
// by replaying, from a fresh load of Home, the clicks that first found it (cheapest path first).
//
// Targets: every figure title site/PARITY.md marks PRESENT or MOVED, plus its "Figures only in the new site" table,
// plus (always) every figure card each route renders in its DOM at its default parameters, folded or not. Anything
// not reached is a failure, listed with the js/ file(s) that hold the title.
// D5.1: every page must also be within 2 clicks of Home using the header menu alone (top menu, More, mobile Menu).
//
// Usage (serve the repo root first, e.g. `python3 -m http.server 8000`):
//   node site/tools/reach.mjs [--base http://127.0.0.1:8000/] [--viewport 1280x900,390x844] [--parity site/PARITY.md]
//                             [--out site/REACH.md] [--json path.json] [--max-variants 3]
// Playwright is not a site dependency. Install `playwright-core` (or `playwright`) in a scratch folder and point
// PW_MODULE at that package folder, e.g. PW_MODULE=/scratch/node_modules/playwright-core. CHROME may name the
// browser binary; otherwise the newest ~/.cache/ms-playwright/chromium_headless_shell-* is used.
// Exit code 0 when every viewport passes, 1 otherwise.
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { homedir } from 'node:os';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const BASE = arg('--base', 'http://127.0.0.1:8000/').replace(/\/?$/, '/');
const VIEWPORTS = arg('--viewport', '1280x900,390x844').split(',').map(v => v.split('x').map(Number));
const PARITY = resolve(REPO, arg('--parity', 'site/PARITY.md'));
const OUT = resolve(REPO, arg('--out', 'site/REACH.md'));
const JSON_OUT = arg('--json', null);
const MAX_VARIANTS = Number(arg('--max-variants', '3'));
const MAX_MENU = 2;   // spec D5.1: every page reachable from the top menu within 2 clicks
const { PAGES } = await import(pathToFileURL(join(REPO, 'js', 'site.js')).href);

// ---------- playwright (outside the repo) ----------
async function loadChromium() {
  const tries = [];
  if (process.env.PW_MODULE) tries.push(() => createRequire(join(resolve(process.env.PW_MODULE), 'package.json'))(resolve(process.env.PW_MODULE)));
  tries.push(() => import('playwright-core'), () => import('playwright'));
  for (const t of tries) { try { const m = await t(); const c = m.chromium || m.default?.chromium; if (c) return c; } catch { /* next */ } }
  throw new Error('playwright-core not found: install it in a scratch folder and set PW_MODULE to its package folder');
}
function chromePath() {
  if (process.env.CHROME) return process.env.CHROME;
  const root = join(homedir(), '.cache', 'ms-playwright');
  if (!existsSync(root)) return undefined;
  const dirs = readdirSync(root).filter(d => /^chromium_headless_shell-\d+$/.test(d)).sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));
  for (const d of dirs) { const p = join(root, d, 'chrome-headless-shell-linux64', 'chrome-headless-shell'); if (existsSync(p)) return p; }
  return undefined;
}

// ---------- targets from PARITY.md (format written by site/tools/parity.mjs) ----------
const clean = s => s.trim().replace(/<[^>]+>/g, '').replace(/\\\|/g, '|').replace(/[`*]/g, '').replace(/^↳\s*/, '').replace(/^"(.*)"$/, '$1').replace(/\s+/g, ' ').trim();
function parityTargets(file) {
  const out = { file: null, titles: [], failures: [], interactive: [], note: '' };
  if (!existsSync(file)) { out.note = `${relative(REPO, file)} not found`; return out; }
  out.file = file;
  let head = null, section = '';
  const cells = l => l.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map(clean);
  for (const l of readFileSync(file, 'utf8').split('\n')) {
    if (/^#{1,6}\s/.test(l)) { section = clean(l.replace(/^#+\s*/, '')); head = null; continue; }
    if (!/^\s*\|/.test(l)) { head = null; continue; }
    if (/^\s*\|[\s:|-]+\|\s*$/.test(l)) continue;                       // separator row
    const c = cells(l);
    if (!head) { head = c.map(x => x.toLowerCase()); continue; }
    // "Interaction states": figures parity.mjs found only after pressing a control (not a fold or a link); this crawl
    // presses no such control, so they are listed separately and count as reached when their page is reached
    if (/interaction states/i.test(section)) {
      const ni = head.findIndex(x => /^new\b.*figures/.test(x)), ri2 = head.findIndex(x => /^route$/.test(x)), si2 = head.findIndex(x => /^state$/.test(x));
      if (ni >= 0) for (const t of c[ni].split(/\s*;\s*|\s*,\s*(?=[A-Z])/).filter(x => x && !/^(—|-|none)$/i.test(x)))
        out.interactive.push({ title: t, page: (c[ri2] || '').match(/#\/([\w-]+)/)?.[1] || '', state: si2 >= 0 ? c[si2] : '' });
      continue;
    }
    const ti = head.findIndex(x => /^(old figure|figure|figure title|title)$/.test(x));
    if (ti < 0) continue;
    const title = c[ti]; if (!title || /^(—|-|n\/a)$/i.test(title)) continue;
    const ri = head.findIndex(x => /^(route|page)$/.test(x));
    const page = (ri >= 0 ? c[ri] : section).match(/#\/([\w-]+)/)?.[1] || '';
    if (/only in the new site/i.test(section)) { out.titles.push({ title, page }); continue; }
    const si = head.findIndex(x => /^(result|status)$/.test(x));
    if (si < 0 || /^stamps?\b/i.test(section)) continue;
    const st = c[si].toUpperCase();
    if (/\b(PRESENT|MOVED)\b/.test(st)) out.titles.push({ title, page });
    else if (/\bFAILURE\b/.test(st)) out.failures.push({ title, page });
  }
  if (!out.titles.length) out.note = `${relative(REPO, file)} has no figure table with PRESENT or MOVED rows`;
  return out;
}

// ---------- which js file holds a title ----------
function owners(title) {
  const files = [];
  for (const dir of ['js', 'js/pages']) for (const f of readdirSync(join(REPO, dir)).filter(f => f.endsWith('.js'))) {
    if (readFileSync(join(REPO, dir, f), 'utf8').includes(title)) files.push(`${dir}/${f}`);
  }
  const fig = files.filter(f => !/^js\/(provenance|glossary|overlays)\.js$/.test(f));
  return fig.length ? fig : files;
}

// ---------- helpers injected into every page ----------
const INIT = () => {
  try { localStorage.setItem('vo.motion', 'calm'); } catch { /* storage blocked */ }
  window.__hc = 0; addEventListener('hashchange', () => { window.__hc++; });
  const vis = el => !!el && el.isConnected && (el.checkVisibility ? el.checkVisibility({ checkVisibilityCSS: true }) : el.offsetParent !== null) && (() => { const r = el.getBoundingClientRect(); return r.width > 0 || r.height > 0; })();
  const titleOf = c => c.dataset.title || c.querySelector(':scope > h2')?.childNodes[0]?.textContent?.trim() || '';
  const cards = () => [...document.querySelectorAll('#view .card')].filter(c => c.querySelector(':scope > h2'));
  const hiddenBy = n => n.hidden || getComputedStyle(n).display === 'none' || getComputedStyle(n).visibility === 'hidden';
  // The clicks a visitor needs to make `el` visible (outermost first), or null when nothing they can press shows it.
  function unhide(el) {
    const steps = [], nav = document.getElementById('nav');
    const menuBtn = document.querySelector('.top .menu'), moreBtn = document.querySelector('.more-btn');
    const chain = []; for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) chain.push(n);
    // v3: the closed phone drawer is visibility:hidden, which its links inherit; once the Menu click is counted,
    // only display/hidden can still hide something inside it
    let inDrawer = false;
    const hid = n => inDrawer ? (n.hidden || getComputedStyle(n).display === 'none') : hiddenBy(n);
    for (const n of chain.reverse()) {
      if (n.tagName === 'DETAILS' && !n.open && el.closest('summary')?.parentElement !== n) {
        const s = n.querySelector(':scope > summary'); if (!s) return null; steps.push({ kind: 'fold', el: s });
      } else if (n.id === 'more-list' && n.hidden) { if (!moreBtn) return null; steps.push({ kind: 'More', el: moreBtn });
      } else if (n === nav && hiddenBy(nav)) { if (!menuBtn || !vis(menuBtn) || getComputedStyle(nav).display === 'none') return null; steps.push({ kind: 'Menu', el: menuBtn }); inDrawer = true;   // v3: on Home (story mode) the sidebar and Menu are not shown at all
      } else if (hid(n)) return null;
    }
    return hid(el) ? null : steps;
  }
  window.__reach = { vis, titleOf, cards, unhide };
};

const routeOf = href => {
  const m = /^#\/?([^?]*)(?:\?(.*))?$/.exec(href); if (!m) return null;
  const q = new URLSearchParams(m[2] || ''); const fig = q.get('fig'); q.delete('fig'); q.sort();
  return { id: m[1] || 'overview', query: q.toString(), fig };
};
const keyOf = r => r.id + (r.query ? '?' + r.query : '');
const slug = t => String(t).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// ---------- one crawl at one viewport ----------
async function crawl(browser, VW, VH) {
  const R = { viewport: `${VW}x${VH}`, nodes: [], skipped: [], figLinks: [], menu: {}, shell: { overview: 0 } };
  let ctxB = null, p = null, logs = [];
  async function fresh() {
    if (ctxB) await ctxB.close();
    ctxB = await browser.newContext({ viewport: { width: VW, height: VH }, reducedMotion: 'reduce' });
    await ctxB.addInitScript(INIT);
    p = await ctxB.newPage(); logs = [];
    p.on('console', m => { if (m.type() === 'error') logs.push('console.error: ' + m.text().slice(0, 300)); });
    p.on('pageerror', e => logs.push('pageerror: ' + String(e.message).slice(0, 300)));
    p.on('response', r => { if (r.status() >= 400 && !/favicon/.test(r.url())) logs.push(`http ${r.status()}: ${r.url().replace(BASE, '')}`); });
  }
  async function settled(id) {
    await p.waitForFunction(i => { const v = document.getElementById('view'); return v?.dataset.page === i && v.firstElementChild && !v.firstElementChild.dataset.reachOld; }, id, { timeout: 20000 });
    // content built at idle (the Sources site map) is finished before links are read
    await p.waitForFunction(() => !/Building site map/.test(document.getElementById('view').innerText), null, { timeout: 30000 }).catch(() => {});
    await p.waitForTimeout(350);
  }
  const press = async el => { await el.scrollIntoViewIfNeeded().catch(() => {}); await el.click({ timeout: 5000 }); await p.waitForTimeout(120); };
  // Make the cheapest anchor with this href visible (open folds or menus by clicking them), then click it.
  async function follow(href, wantId) {
    const pick = await p.evaluateHandle(h => {
      let best = null;
      for (const a of document.querySelectorAll('a[href]')) {
        if (a.getAttribute('href') !== h) continue;
        const s = window.__reach.vis(a) ? [] : window.__reach.unhide(a); if (!s) continue;
        if (!best || s.length < best.s.length) best = { a, s };
      }
      return best ? [best.a, ...best.s.map(x => x.el)] : [];
    }, href);
    const els = [...(await pick.getProperties()).values()].map(v => v.asElement()).filter(Boolean);
    if (!els.length) throw new Error(`no visible way to press a link to ${href}`);
    const [a, ...steps] = els;
    for (const s of steps) await press(s);
    if (!(await a.evaluate(el => window.__reach.vis(el)))) throw new Error(`link to ${href} stayed hidden after ${steps.length} clicks`);
    await p.evaluate(() => { window.__hc = 0; const f = document.getElementById('view').firstElementChild; if (f) f.dataset.reachOld = '1'; });
    await press(a);
    if (await p.evaluate(() => window.__hc > 0)) await settled(wantId);
    else await p.evaluate(() => { const f = document.getElementById('view').firstElementChild; if (f) delete f.dataset.reachOld; });
  }

  const start = { key: 'overview', id: 'overview', query: '', path: [], depth: 0, from: '(start: site root)' };
  const queue = [start], seen = new Map([['overview', start]]), variants = new Map([['overview', 1]]);
  while (queue.length) {
    queue.sort((a, b) => a.depth - b.depth);           // cheapest first, so each route keeps its cheapest path
    const node = queue.shift(); node.done = true;
    const rec = { key: node.key, id: node.id, query: node.query, depth: node.depth, path: node.path.map(s => s.href), from: node.from, visible: [], folded: [], hidden: [], dom: [], top: [], toc: { n: 0, bad: [] }, errors: [], ok: true };
    R.nodes.push(rec);
    try {
      await fresh();
      await p.goto(BASE, { waitUntil: 'domcontentloaded' });
      await settled('overview');
      for (const s of node.path) await follow(s.href, s.id);
      const here = await p.evaluate(() => document.getElementById('view').dataset.page);
      if (here !== node.id) throw new Error(`ended on #/${here}, expected #/${node.id}`);
      // 0 every route link a visitor can reach from here, read on arrival (opening a fold or a menu counts as a click)
      const links = await p.evaluate(() => [...document.querySelectorAll('a[href^="#/"]')].map(a => {
        const s = window.__reach.vis(a) ? [] : window.__reach.unhide(a);
        return { href: a.getAttribute('href'), cost: s ? s.length : null, kinds: s ? s.map(x => x.kind) : null, text: a.textContent.trim().replace(/\s+/g, ' ').slice(0, 80),
          inMenu: !!(a.closest('header.top') || a.closest('#nav')), inMap: /^Site map/.test(a.closest('.card')?.querySelector(':scope > h2')?.textContent || '') };
      }));
      rec.links = links.length;
      rec.unreachableLinks = links.filter(l => l.cost === null).map(l => `${l.text} (${l.href})`);
      for (const l of links) {
        if (l.cost === null) continue;
        const r = routeOf(l.href); if (!r) continue;
        // header-menu clicks (D5.1), v3 shell: the header and the sidebar (#nav) are the menu. Home is a story with a
        // minimal header (brand, "Open the app"), so a page counts as k menu clicks when a chain of k header/sidebar
        // links from Home reaches it. The mobile Menu toggle opens the menu itself, so it is not counted (as in v2).
        const sd = R.shell[node.key];
        if (sd !== undefined && l.inMenu && !r.query) {
          const c = sd + l.kinds.filter(k => k !== 'Menu').length + 1;
          if (!(R.menu[r.id] <= c)) R.menu[r.id] = c;
          if (!(R.shell[r.id] <= c)) R.shell[r.id] = c;
        }
        if (r.fig) R.figLinks.push({ from: node.key, href: l.href, id: r.id, query: r.query, fig: r.fig, text: l.text });
        const key = keyOf(r), depth = node.depth + l.cost + 1;
        const from = `#/${node.key}: "${l.text}"${l.kinds.length ? ` after ${l.kinds.join(' + ')}` : ''}${l.inMap ? ' (site map)' : ''}`;
        const old = seen.get(key);
        if (old !== undefined) { if (old && !old.done && depth < old.depth) Object.assign(old, { path: [...node.path, { href: l.href, id: r.id }], depth, from }); continue; }
        const nv = variants.get(r.id) || 0;
        if (r.query && nv >= MAX_VARIANTS) { R.skipped.push(`${key} (from #/${node.key})`); seen.set(key, null); continue; }
        variants.set(r.id, nv + 1);
        const nn = { key, id: r.id, query: r.query, path: [...node.path, { href: l.href, id: r.id }], depth, from };
        seen.set(key, nn); queue.push(nn);
      }
      // 1 figure titles visible on arrival
      rec.visible = await p.evaluate(() => window.__reach.cards().filter(window.__reach.vis).map(window.__reach.titleOf));
      // 2 open the folds that hold figures, one real click at a time, until no closed one is visible
      for (let i = 0; i < 80; i++) {
        const el = (await p.evaluateHandle(() => [...document.querySelectorAll('#view details:not([open])')]
          .find(d => d.querySelector('.card > h2') && window.__reach.vis(d.querySelector(':scope > summary')))?.querySelector(':scope > summary') || null)).asElement();
        if (!el) break;
        await press(el);
      }
      const after = await p.evaluate(() => window.__reach.cards().map(c => ({ t: window.__reach.titleOf(c), v: window.__reach.vis(c), top: !c.parentElement?.closest('.card') })));
      rec.dom = after.map(x => x.t);
      rec.top = after.filter(x => x.top).map(x => x.t);
      rec.folded = after.filter(x => x.v && !rec.visible.includes(x.t)).map(x => x.t);
      rec.hidden = after.filter(x => !x.v).map(x => x.t);
      // 3 "On this page" links resolve to a figure on this page
      rec.toc = await p.evaluate(() => {
        const links = [...document.querySelectorAll('#view nav.toc a')], bad = [];
        for (const a of links) {
          const f = new URLSearchParams(a.getAttribute('href').split('?')[1] || '').get('fig') || '';
          if (!document.querySelector(`#view [data-fignum="${CSS.escape(f)}"]`) && !document.querySelector(`#view [data-fig="${CSS.escape(f)}"]`)) bad.push(a.textContent);
        }
        return { n: links.length, bad };
      });
    } catch (e) { rec.ok = false; rec.errors.push(String(e.message || e).split('\n')[0]); }
    rec.errors.push(...logs);
    process.stderr.write(`reach ${R.viewport}: #/${node.key} (${node.depth} clicks): ${rec.visible.length} visible + ${rec.folded.length} by fold, ${rec.hidden.length} hidden${rec.ok ? '' : ' FAILED: ' + rec.errors[0]}\n`);
  }
  if (ctxB) await ctxB.close();
  return R;
}

// ---------- run ----------
const chromium = await loadChromium();
const browser = await chromium.launch({ executablePath: chromePath(), args: ['--disable-gpu', '--mute-audio'] });
const started = new Date().toISOString();
const runs = [];
try { for (const [w, hgt] of VIEWPORTS) runs.push(await crawl(browser, w, hgt)); }
finally { await browser.close(); }

// ---------- results ----------
const norm = s => String(s).toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();
const par = parityTargets(PARITY);
const targets = par.titles.map(x => ({ ...x, src: 'PARITY.md' }));
const tset = new Set(targets.map(x => norm(x.title)));
for (const run of runs) for (const n of run.nodes) if (!n.query) for (const t of n.dom) if (t && !tset.has(norm(t))) { tset.add(norm(t)); targets.push({ title: t, page: n.id, src: 'DOM' }); }
const pageOf = (run, id) => run.nodes.find(n => n.id === id && !n.query) || run.nodes.find(n => n.id === id);
for (const run of runs) {
  run.reached = new Map();
  for (const n of run.nodes) {
    for (const t of n.visible) if (!run.reached.has(norm(t))) run.reached.set(norm(t), { t, page: n.key, how: n.depth ? `on arrival, ${n.depth} click${n.depth > 1 ? 's' : ''}` : 'on Home' });
    for (const t of n.folded) if (!run.reached.has(norm(t))) run.reached.set(norm(t), { t, page: n.key, how: `${n.depth} click${n.depth === 1 ? '' : 's'} + opening its fold` });
  }
  run.behind = [];
  for (const x of par.interactive) {
    const n = pageOf(run, x.page);
    if (!run.reached.has(norm(x.title)) && n && n.ok) { run.reached.set(norm(x.title), { t: x.title, page: n.key, how: `${n.depth} click${n.depth === 1 ? '' : 's'} + "${x.state}" (a control on the page; driven by parity.mjs)` }); run.behind.push(x); }
  }
  run.misses = targets.filter(x => !run.reached.has(norm(x.title))).map(x => ({ ...x, owners: owners(x.title) }));
  run.pageMiss = PAGES.filter(pg => !run.nodes.some(n => n.id === pg.id && n.ok)).map(pg => pg.id);
  run.menuDeep = PAGES.filter(pg => pg.id !== 'overview' && !(run.menu[pg.id] <= MAX_MENU)).map(pg => `${pg.id} (${run.menu[pg.id] ?? 'not in the header menu'})`);
  const bad = [];
  for (const f of run.figLinks) {
    const n = run.nodes.find(x => x.key === keyOf(f)) || pageOf(run, f.id);
    if (!n || !n.ok) { bad.push({ ...f, why: 'target route not crawled' }); continue; }
    const ok = /^\d+$/.test(f.fig) ? Number(f.fig) >= 1 && Number(f.fig) <= n.top.length : n.top.some(t => slug(t) === f.fig);
    if (!ok) bad.push({ ...f, why: 'no figure with that number or slug on the target page' });
  }
  run.badFig = [...new Map(bad.map(b => [b.href + ' ' + b.from, b])).values()];
  run.tocBad = run.nodes.flatMap(n => n.toc.bad.map(t => `#/${n.key}: ${t}`));
  run.errs = run.nodes.filter(n => n.errors.length).map(n => `#/${n.key}: ${n.errors.join('; ')}`);
  run.pass = !run.misses.length && !run.pageMiss.length && !run.menuDeep.length && !run.badFig.length && !run.tocBad.length && run.nodes.every(n => n.ok);
}
const pass = runs.every(r => r.pass);

const esc = s => String(s).replace(/\|/g, '\\|');
const md = [];
md.push('# Reachability crawl', '');
md.push(`Generated by \`site/tools/reach.mjs\` (package P7-C) on ${started.slice(0, 16).replace('T', ' ')} UTC, against the repo served at ${BASE}, Calm motion, viewports ${runs.map(r => r.viewport).join(' and ')}.`, '');
md.push('The crawl starts at Home and follows only visible links, the top bar, the sidebar (v3; a drawer behind the Menu button on phones) and folds. It types no URL except the site root: each route is reached by replaying, from a fresh load of Home, the cheapest chain of clicks that found it. A click count includes opening a fold or a menu. On each page it records the figure titles visible on arrival, then opens every fold that holds a figure by clicking its summary and records what became visible.', '');
md.push(`Targets (${targets.length}): ${par.titles.length ? `${par.titles.length} figure titles that \`site/PARITY.md\` marks PRESENT or MOVED or lists as new-site-only, plus` : `\`site/PARITY.md\` gave no targets (${par.note}), so only`} every figure title each route renders in its DOM at its default parameters (${targets.filter(t => t.src === 'DOM').length}${par.titles.length ? ' not already in PARITY.md' : ''}).`, '');
md.push('Pass rule: every target title reached, every page reached, every page within 2 clicks of Home using the header and sidebar alone (spec D5.1; v3 Home shows only a minimal header, so "Open the app" is click 1 and a sidebar link click 2; on a phone the Menu button that opens the sidebar drawer is not counted), every figure link and "On this page" link resolves, no route fails to load.', '');
md.push('## Result', '', '| Viewport | Result | Titles reached | Pages reached | Pages over 2 menu clicks | Figure links that do not resolve | "On this page" links that do not resolve | Routes with console or HTTP errors |', '|---|---|---|---|---|---|---|---|');
for (const r of runs) md.push(`| ${r.viewport} | **${r.pass ? 'PASS' : 'FAIL'}** | ${targets.length - r.misses.length} of ${targets.length} | ${PAGES.length - r.pageMiss.length} of ${PAGES.length} | ${r.menuDeep.length ? esc(r.menuDeep.join(', ')) : 0} | ${r.badFig.length} of ${r.figLinks.length} | ${r.tocBad.length} | ${r.errs.length} |`);
md.push('', '## Unreachable figure titles (failures)', '');
const allMiss = new Map();
for (const r of runs) for (const m of r.misses) { const k = norm(m.title); if (!allMiss.has(k)) allMiss.set(k, { ...m, vps: [] }); allMiss.get(k).vps.push(r.viewport); }
if (allMiss.size) { md.push('| Title | Expected on | Target source | Missed at | Owning file(s) |', '|---|---|---|---|---|'); for (const m of allMiss.values()) md.push(`| ${esc(m.title)} | #/${m.page} | ${m.src} | ${m.vps.join(', ')} | ${m.owners.join(', ') || 'title not found in js/'} |`); }
else md.push('None.');
if (par.interactive.length) {
  md.push('', '## Behind a control on a reached page', '', 'These figures appear only after pressing a control that is not a fold or a link (site/PARITY.md "Interaction states"). This crawl does not press such controls; parity.mjs drives them and found each one. They count as reached when their page is reached.', '', '| Title | Page | Control state | Page reached at |', '|---|---|---|---|');
  for (const x of par.interactive) md.push(`| ${esc(x.title)} | #/${x.page} | ${esc(x.state)} | ${runs.filter(r => r.behind.some(b => norm(b.title) === norm(x.title))).map(r => r.viewport).join(', ') || 'not reached'} |`);
}
if (par.failures.length) { md.push('', `PARITY.md also lists ${par.failures.length} old figure(s) as FAILURE (missing from the new site). They are parity failures, not reach targets, and are owned in PARITY.md:`, ''); for (const f of par.failures) md.push(`- ${f.title} (#/${f.page})`); }
for (const r of runs) {
  md.push('', `## Pages at ${r.viewport}`, '', '| Page | Header-menu clicks | Cheapest clicks from Home | First reached from | Figures on arrival | Figures behind a fold | Not visible after opening folds | Errors |', '|---|---|---|---|---|---|---|---|');
  for (const pg of PAGES) {
    const n = pageOf(r, pg.id);
    if (!n) { md.push(`| ${pg.label} (#/${pg.id}) | ${r.menu[pg.id] ?? '—'} | not reached | | | | | |`); continue; }
    md.push(`| ${pg.label} (#/${pg.id}) | ${pg.id === 'overview' ? 0 : r.menu[pg.id] ?? 'not in menu'} | ${n.depth} | ${esc(n.from)} | ${n.visible.length} | ${n.folded.length} | ${n.hidden.length ? esc(n.hidden.join('; ')) : 0} | ${n.errors.length ? esc(n.errors.join('; ')) : 'none'} |`);
  }
  const extra = r.nodes.filter(n => n.query);
  if (extra.length) { md.push('', 'Routes with parameters, found as links on the site and crawled too:', ''); for (const n of extra) md.push(`- \`#/${n.key}\`: ${n.depth} clicks, from ${n.from}; ${n.dom.length} figures${n.ok ? '' : `; FAILED: ${n.errors[0]}`}${n.ok && n.errors.length ? `; errors: ${n.errors.join('; ')}` : ''}`); }
  if (r.skipped.length) md.push('', `Parameter variants not crawled (cap ${MAX_VARIANTS} per page): ${[...new Set(r.skipped)].slice(0, 30).map(s => `\`#/${s}\``).join(', ')}.`);
  if (r.badFig.length) { md.push('', `Figure links that do not resolve at ${r.viewport}:`, ''); for (const b of r.badFig) md.push(`- on \`#/${b.from}\`: "${esc(b.text)}" → \`${b.href}\` (${b.why})`); }
  if (r.tocBad.length) { md.push('', `"On this page" links that do not resolve at ${r.viewport}:`, ''); for (const s of r.tocBad) md.push(`- ${s}`); }
}
const hiddenOnly = [...new Set(runs.flatMap(r => r.nodes.flatMap(n => n.hidden.filter(t => !r.reached.has(norm(t))).map(t => `${t} (#/${n.key}, ${r.viewport})`))))];
if (hiddenOnly.length) { md.push('', '## In the DOM but never visible to the crawl', '', 'These cards exist on a page but stayed hidden after every fold was opened (tabs, switches or controls the crawl does not press).', ''); for (const s of hiddenOnly) md.push(`- ${s}`); }
const deadLinks = [...new Set(runs.flatMap(r => r.nodes.flatMap(n => (n.unreachableLinks || []).map(l => `#/${n.key}: ${l}`))))];
if (deadLinks.length) { md.push('', '## Route links that no fold or menu reveals', '', 'Links in the DOM inside something the crawl cannot open. Not counted as failures; listed so their owners can check them.', ''); for (const s of deadLinks.slice(0, 60)) md.push(`- ${esc(s)}`); }
md.push('', `## Every title reached at ${runs[0].viewport}, and how`, '', '| Title | Page | How |', '|---|---|---|');
for (const v of [...runs[0].reached.values()].sort((a, b) => a.page.localeCompare(b.page))) md.push(`| ${esc(v.t)} | #/${v.page} | ${v.how} |`);
md.push('');
writeFileSync(OUT, md.join('\n'));
if (JSON_OUT) writeFileSync(resolve(JSON_OUT), JSON.stringify({ base: BASE, started, targets, parity: { file: par.file, note: par.note, failures: par.failures }, runs: runs.map(r => ({ ...r, reached: [...r.reached.values()] })), pass }, null, 1));
for (const r of runs) {
  console.log(`reach ${r.viewport}: ${r.pass ? 'PASS' : 'FAIL'}: ${targets.length - r.misses.length}/${targets.length} titles, ${PAGES.length - r.pageMiss.length}/${PAGES.length} pages, ${r.menuDeep.length} over ${MAX_MENU} menu clicks, ${r.badFig.length}/${r.figLinks.length} bad figure links, ${r.tocBad.length} bad toc links, ${r.errs.length} routes with errors`);
  for (const m of r.misses) console.log(`  MISS: ${m.title} [#/${m.page}] -> ${m.owners.join(', ') || '?'}`);
  for (const e of r.errs) console.log(`  ERR: ${e}`);
}
console.log(`wrote ${relative(REPO, OUT)}`);
process.exit(pass ? 0 : 1);

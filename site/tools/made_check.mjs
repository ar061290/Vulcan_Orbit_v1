#!/usr/bin/env node
// Phase 7 coverage check P7-E (site/REBUILD_PLAN.md §4 P7-E, §7 items 9 and 10; spec C9, C10).
// One headless Chromium run over every route in js/site.js. Per route it opens every fold, then records each
// figure card (title, stamp, its "Made by" block and that block's model folders), the rendered text, and console
// warnings. From that it reports:
//   1. Made-by: every charted figure has a "Made by" entry (passes.js pass 9 logs the same thing as a warning).
//   2. C9: every folder in models/ appears in at least one rendered "Made by" block (data-models or its Files text).
//   3. Wording grep (rules under the P7 table): no ion wind or thermopile anywhere; every safe/certif/first-ever hit
//      listed with its source and judged allowed (a negation, or a question on Ask) or a failure; no Moon or Mars value
//      outside #/flame. Ask answers are read by clicking every saved question and typing every test-set question.
//   4. Plan coverage: every "done" row of site/PLAN_COVERAGE.md has its evidence on its page (title:"…" / text:"…").
// Every failure names the file that owns the fix (figure module, page module or data file).
//
// Usage (from the repo root; needs the playwright or playwright-core package somewhere outside the repo):
//   PW_DIR=/path/with/node_modules node site/tools/made_check.mjs [--base URL] [--out crawl.json] [--write]
//   --base   an already running server (default: start python3 -m http.server on a free port 8100-8199, kill it after)
//   --out    where the crawl and the results go as JSON (default: $TMPDIR/vo_made_check.json); ranges_check.mjs --from reads it
//   --write  replace the generated sections of site/PLAN_COVERAGE.md (between <!-- made_check:… --> markers)
// Exit code 1 if anything failed. Never edits data/, models/ or any page file.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const COVERAGE = path.join(ROOT, 'site/PLAN_COVERAGE.md');

// ---------- shared helpers (ranges_check.mjs imports these) ----------
export function argv(name, def = null) {
  const i = process.argv.indexOf(name);
  if (i < 0) return def;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
}

async function loadPlaywright() {
  const dirs = [process.env.PW_DIR, process.cwd(), ROOT].filter(Boolean);
  for (const d of dirs) for (const name of ['playwright', 'playwright-core']) {
    try { return createRequire(path.join(path.resolve(d), 'x.js'))(name); } catch { /* next */ }
  }
  for (const name of ['playwright', 'playwright-core']) { try { return await import(name); } catch { /* next */ } }
  throw new Error('playwright not found: install it in a scratch folder and set PW_DIR to that folder (never in the repo)');
}

function chromiumPath() {
  const base = path.join(os.homedir(), '.cache/ms-playwright');
  try {
    for (const d of fs.readdirSync(base).sort().reverse()) {
      if (d.startsWith('chromium_headless_shell')) { const p = path.join(base, d, 'chrome-headless-shell-linux64/chrome-headless-shell'); if (fs.existsSync(p)) return p; }
      if (d.startsWith('chromium-')) { const p = path.join(base, d, 'chrome-linux/chrome'); if (fs.existsSync(p)) return p; }
    }
  } catch { /* none */ }
  return undefined;
}

const portFree = p => new Promise(res => { const s = net.createServer().once('error', () => res(false)).once('listening', () => s.close(() => res(true))).listen(p, '127.0.0.1'); });

export async function startServer() {
  for (let p = 8100; p <= 8199; p++) {
    if (!(await portFree(p))) continue;
    const proc = spawn('python3', ['-m', 'http.server', String(p), '--bind', '127.0.0.1', '--directory', ROOT], { stdio: 'ignore' });
    for (let i = 0; i < 50; i++) {
      await new Promise(r => setTimeout(r, 100));
      try { const r = await fetch(`http://127.0.0.1:${p}/index.html`); if (r.ok) return { base: `http://127.0.0.1:${p}/`, stop: () => proc.kill('SIGTERM') }; } catch { /* not yet */ }
    }
    proc.kill('SIGTERM');
  }
  throw new Error('no free port in 8100-8199');
}

export async function pageIds() {
  const { PAGES } = await import(pathToFileURL(path.join(ROOT, 'js/site.js')).href);
  return PAGES.map(p => ({ id: p.id, provenance: p.provenance !== false }));
}

// Which js file draws a figure: the file that holds its exact title as a string literal (figure modules first).
let SRC = null;
export function ownerOf(title, route) {
  if (!SRC) {
    SRC = [];
    for (const dir of ['js', 'js/pages']) for (const f of fs.readdirSync(path.join(ROOT, dir))) if (f.endsWith('.js')) SRC.push([`${dir}/${f}`, fs.readFileSync(path.join(ROOT, dir, f), 'utf8')]);
  }
  const page = `js/pages/${route}.js`;
  if (!title) return page;
  const esc = title.replace(/\\/g, '\\\\');
  const lits = [`'${esc.replace(/'/g, "\\'")}'`, `"${esc.replace(/"/g, '\\"')}"`, `\`${esc}\``];
  const skip = /js\/(provenance|tour|glossary|passes|site|overlays|i18n)\.js$/;
  const hits = SRC.filter(([f, s]) => !skip.test(f) && lits.some(l => s.includes(l))).map(([f]) => f);
  const pageSrc = SRC.find(([f]) => f === page)?.[1] || '';
  const imported = new Set([...pageSrc.matchAll(/from\s+'\.\.\/([a-z_0-9]+\.js)'/g)].map(m => `js/${m[1]}`));
  const fig = f => /\/(fig_|flame_sim|mission|clock)/.test(f);
  return hits.find(f => fig(f) && imported.has(f)) || hits.find(f => f === page) || hits.find(fig) || hits[0] || page;
}

// ---------- the browser crawl ----------
const SETTLE = { about: 9000, assess: 3500, flame: 3000, predict: 3000, ask: 2000 };

async function crawlRoute(browser, base, route, sels = []) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const console_ = [];
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) console_.push(`${m.type()}: ${m.text()}`); });
  page.on('pageerror', e => console_.push(`pageerror: ${e.message}`));
  page.on('requestfailed', r => { const u = r.url(); if (!/fonts\.(googleapis|gstatic)/.test(u)) console_.push(`requestfailed: ${u}`); });
  await page.goto(`${base}index.html#/${route}`, { waitUntil: 'load' });
  await page.waitForFunction(id => document.querySelector(`#view[data-page="${id}"]`)?.querySelector('.card, h1'), route, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(SETTLE[route] || 1500);
  // open every fold, repeatedly (opening one can render more)
  for (let i = 0; i < 6; i++) {
    const n = await page.evaluate(() => { let k = 0; document.querySelectorAll('#view details:not([open])').forEach(d => { d.open = true; k++; }); return k; });
    if (!n) break;
    await page.waitForTimeout(300);
  }
  // expand every disclosure button in the page (e.g. the NASA experiments attribute rows, B3), once
  // one at a time through the live DOM: a click may re-render the list, which would detach the other buttons
  for (let i = 0; i < 60; i++) {
    const b = await page.$('#view button[aria-expanded="false"]:visible');
    if (!b) break;
    await b.click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(40);
    const still = await b.evaluate(x => x.isConnected && x.getAttribute('aria-expanded') === 'false').catch(() => false);
    if (still) break;   // it does not toggle: stop rather than loop on it
  }
  await page.waitForTimeout(300);
  for (let i = 0; i < 3; i++) {
    const n = await page.evaluate(() => { let k = 0; document.querySelectorAll('#view details:not([open])').forEach(d => { d.open = true; k++; }); return k; });
    if (!n) break;
    await page.waitForTimeout(200);
  }
  const selCounts = await page.evaluate(list => {
    const v = document.getElementById('view'), out = {};
    for (const s of list) { try { out[s] = v.querySelectorAll(s).length + (v.matches(s) ? 1 : 0); } catch { out[s] = -1; } }   // -1: invalid selector
    return out;
  }, sels);
  const askAnswers = route === 'ask' ? await readAsk(page) : [];
  const info = await page.evaluate(() => {
    const v = document.getElementById('view');
    const titleOf = c => (c.dataset.title || c.querySelector(':scope > h2')?.childNodes[0]?.textContent || '').trim();
    const attrText = el => [...el.querySelectorAll('[aria-label],[title],[alt]')].map(e => [e.getAttribute('aria-label'), e.getAttribute('title'), e.getAttribute('alt')].filter(Boolean).join(' ')).join('\n');
    const cards = [...v.querySelectorAll('.card')].map(c => {
      const mb = c.querySelector(':scope > details.madeby');
      let files = '';
      if (mb) mb.querySelectorAll('dt').forEach(dt => { if (/Files|Model folder/.test(dt.textContent)) files += ' ' + (dt.nextElementSibling?.textContent || ''); });
      return {
        title: titleOf(c), fignum: c.dataset.fignum || null, nested: !!c.parentElement?.closest('.card'),
        stamp: c.querySelector(':scope > h2 .badge, .badge')?.textContent?.trim() || null,
        made: mb ? (mb.querySelector('summary')?.textContent || '').replace(/^Made by\s*/, '').trim() : null,
        madeModels: mb?.dataset.models || '', madeFiles: files.trim(), cardModels: c.dataset.models || '',
        madeText: mb ? mb.innerText : '',
        madeOptOut: c.dataset.made === 'none',
        strayNodes: (() => {   // text nodes that print null/undefined/NaN, except inside printed JSON (<pre>/<code>, "key":null)
          const out = [], w = document.createTreeWalker(c, NodeFilter.SHOW_TEXT);
          for (let n = w.nextNode(); n; n = w.nextNode()) {
            const t = n.nodeValue; const m = t.match(/(^|[^\w"'])(null|undefined|NaN|\[object Object\])(?![\w"'])/);
            if (!m || n.parentElement?.closest('pre, code, script, style')) continue;
            if (/"[\w$]+"\s*:\s*(null|NaN)/.test(t)) continue;
            const p = []; for (let e = n.parentElement; e && e !== c && p.length < 5; e = e.parentElement) p.unshift(e.tagName.toLowerCase() + (e.classList.length ? '.' + [...e.classList].join('.') : ''));
            const prev = n.parentElement?.previousElementSibling?.textContent?.trim().slice(-60) || '';
            out.push({ token: m[2], path: p.join(' > '), context: `${prev ? '…' + prev + ' | ' : ''}${t.trim().slice(0, 100)}` });
          }
          return out;
        })(),
        hidden: c.offsetParent === null && getComputedStyle(c).position !== 'fixed',
        charted: !!c.querySelector('svg.chart, canvas, table'),
        text: c.innerText, attrs: attrText(c),
        tables: [...c.querySelectorAll('table')].map(t => ({
          caption: t.caption?.textContent || t.closest('details')?.querySelector('summary')?.textContent || '',
          head: [...t.querySelectorAll('thead th, tr:first-child th')].map(th => th.innerText.trim()),
          rows: [...t.querySelectorAll('tbody tr')].slice(0, 400).map(tr => [...tr.cells].map(td => td.innerText.trim())),
        })),
      };
    });
    // the shell outside #view: header (top menu and the More menu, whose items are in the DOM while closed), banner, footer
    const shell = ['header.top', '#demo-banner', 'footer.foot'].map(q => document.querySelector(q)?.textContent || '').join('\n');
    return { title: document.title, h1: [...v.querySelectorAll('h1')].map(x => x.innerText.trim()), text: v.innerText, attrs: attrText(v), cards, banner: document.getElementById('demo-banner')?.innerText || '', shell };
  });
  // Flame lab: turn the "Show Moon and Mars (model only)" switch on and check the gravity note appears only then (C10 #30)
  let moonSwitch = null;
  if (route === 'flame') {
    const sw = page.locator('#view button', { hasText: 'Show Moon and Mars (model only)' }).first();
    if (await sw.count()) {
      let note = 'nasa data exists only at 0 g and 1 g';
      try { note = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/flame_static.json'), 'utf8')).gravity_note.slice(0, 36).toLowerCase(); } catch { /* default */ }
      const before = (await page.locator('#view').innerText()).toLowerCase().includes(note);
      await sw.click(); await page.waitForTimeout(800);
      const pressed = await sw.getAttribute('aria-pressed');
      await page.evaluate(() => document.querySelectorAll('#view details:not([open])').forEach(d => { d.open = true; }));
      const after = (await page.locator('#view').innerText()).toLowerCase().includes(note);
      moonSwitch = { found: true, pressed, noteBefore: before, noteAfter: after };
    } else moonSwitch = { found: false };
  }
  let madeKeys = null;
  if (route === 'overview') {
    madeKeys = await page.evaluate(async () => { const p = await import('./js/provenance.js'); return { made: Object.keys(p.MADE), registered: Object.keys(p.REGISTERED || {}) }; }).catch(e => ({ error: String(e) }));
  }
  await page.close();
  return { route, ...info, sels: selCounts, askAnswers, console: console_, madeKeys, moonSwitch };
}

// Ask: every saved question button, then every test-set question typed in (incl. the one hidden from the table, Q4).
async function readAsk(page) {
  const out = [];
  const n = await page.locator('#view .qlist button.q').count();
  for (let i = 0; i < n; i++) {
    const b = page.locator('#view .qlist button.q').nth(i);
    const q = (await b.innerText()).trim();
    await b.click();
    await page.waitForTimeout(60);
    out.push({ q, via: 'button', text: await page.locator('#view .answer').first().innerText().catch(() => '') });
  }
  let gold = [];
  try { gold = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/assistant_gold.json'), 'utf8')).items || []; } catch { /* missing: Ask shows its empty state */ }
  const box = page.locator('#ask-q');
  if (await box.count()) for (const g of gold) {
    await box.fill(g.q);
    await page.locator('#view .ask-box button').first().click();
    await page.waitForTimeout(60);
    out.push({ q: g.q, via: 'typed (test set)', text: await page.locator('#view .answer').first().innerText().catch(() => '') });
  }
  return out;
}

export async function crawl({ base } = {}) {
  const pw = await loadPlaywright();
  const chromium = pw.chromium || pw.default?.chromium;
  let server = null;
  if (!base) { server = await startServer(); base = server.base; }
  const exe = chromiumPath();
  // WSL without system Chromium libraries: a user-level copy in ~/.local/chromium-libs is added to LD_LIBRARY_PATH if present.
  const libs = path.join(os.homedir(), '.local/chromium-libs/root/usr/lib/x86_64-linux-gnu');
  const env = fs.existsSync(libs) ? { ...process.env, LD_LIBRARY_PATH: [libs, process.env.LD_LIBRARY_PATH].filter(Boolean).join(':') } : process.env;
  const browser = await chromium.launch({ executablePath: exe, env, args: ['--disable-gpu'] });
  const routes = [];
  const selsFor = id => [...new Set((coverageRows() || []).flatMap(r => r.ev.filter(e => e.kind === 'sel' && e.route === id).map(e => e.value)))];
  try {
    for (const { id, provenance } of await pageIds()) {
      const r = await crawlRoute(browser, base, id, selsFor(id));
      r.provenance = provenance;
      routes.push(r);
      process.stderr.write(`crawled #/${id}: ${r.cards.length} cards, ${r.console.length} console messages\n`);
    }
  } finally {
    await browser.close().catch(() => {});
    server?.stop();
  }
  return { at: new Date().toISOString(), base, routes };
}

// ---------- checks ----------
function sentenceAround(text, idx, len) {
  const flat = text.replace(/\s*\n\s*/g, ' ¶ ');
  // recompute the index on the flattened text
  const before = text.slice(0, idx).replace(/\s*\n\s*/g, ' ¶ ').length;
  const s = Math.max(flat.lastIndexOf('. ', before) + 1, flat.lastIndexOf(' ¶ ', before) + 2, flat.lastIndexOf('? ', before) + 1, 0);
  const ends = ['. ', ' ¶ ', '? '].map(t => flat.indexOf(t, before + len)).filter(x => x >= 0);
  const e = ends.length ? Math.min(...ends) + 1 : flat.length;
  return flat.slice(s, e).trim();
}

const NEG = /\b(not|never|no|nothing|none|cannot|can't|can not|doesn't|does not|isn't|is not|aren't|are not|nor|without|neither|won't|will not|unable|whether)\b/i;
// a scope list: "Not for: … calling a material safe" (main's SCOPE text, kept verbatim on the model cards)
const NOT_FOR = /(^|¶\s*)(Not for|Do not use (it )?for|Never use (it )?for)\b:?\s*(¶\s*)?[^¶]*$/i;

function scan(text, re) {
  const out = []; let m; const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  while ((m = g.exec(text))) { out.push({ idx: m.index, hit: m[0] }); if (!m[0]) g.lastIndex++; }
  return out;
}

function cardFor(r, snippet) {
  const hit = r.cards.filter(c => !c.nested && (c.text + '\n' + c.attrs).replace(/\s+/g, ' ').includes(snippet.replace(/\s*¶\s*/g, ' ').replace(/\s+/g, ' ').slice(0, 80)));
  return hit[0]?.title || null;
}

function wordingChecks(crawlData) {
  const ION = /\bion[- ]wind\b|thermopile/i;
  const SAFE = /\bsafe\b|\bcertif\w*|\bfirst[- ]ever\b/i;
  let gravityNotes = [];
  for (const f of ['flame_static', 'flame_spread']) {
    try { const s = fs.readFileSync(path.join(ROOT, `data/${f}.json`), 'utf8'); gravityNotes.push(...[...s.matchAll(/"gravity_note":\s*"([^"]+)"/g)].map(m => m[1])); } catch { /* missing */ }
  }
  gravityNotes = [...new Set(gravityNotes)];
  const MOONMARS = [
    /\b0\.16\s*g\b/i, /\b0\.38\s*g\b/i, /\b1\.62\s*m\/s/i, /\b3\.7[1-2]?\s*m\/s/i, /\b1\/6\s*g\b/i,
    /\b(Moon|Mars|lunar|martian)\b[^\S\n]*[:(=]?[^\S\n]*-?\d/i,           // a number right after Moon/Mars
    /\d[\d.]*\s*(g|m\/s²?|%|mm\/s|cm\/s|K|s)\s+(on|for|at)\s+(the\s+)?(Moon|Mars)\b/i, // a value said to be for Moon/Mars
    /model only, not validated; lies between/i,
  ];
  const ion = [], safe = [], mm = [];
  let GOLD = [];
  try { GOLD = (JSON.parse(fs.readFileSync(path.join(ROOT, 'data/assistant_gold.json'), 'utf8')).items || []).map(g => g.q.toLowerCase().replace(/[?.!]+$/, '').trim()).filter(Boolean); } catch { /* none */ }
  for (const r of crawlData.routes) {
    const sources = [['page text', r.text], ['labels', r.attrs], ...r.askAnswers.map(a => [`Ask answer to "${a.q}" (${a.via})`, a.text])];
    for (const [src, text] of sources) {
      if (!text) continue;
      for (const h of scan(text, ION)) {
        const s = sentenceAround(text, h.idx, h.hit.length);
        ion.push({ route: r.route, source: src, figure: src === 'page text' || src === 'labels' ? cardFor(r, s) : 'Answer', hit: h.hit, sentence: s, verdict: 'FAIL' });
      }
      for (const h of scan(text, SAFE)) {
        const s = sentenceAround(text, h.idx, h.hit.length);
        const pre = s.slice(0, Math.max(0, s.toLowerCase().indexOf(h.hit.toLowerCase())));
        let verdict = 'FAIL', why = 'affirmative use';
        const back = text.slice(Math.max(0, h.idx - 400), h.idx).replace(/\s*\n\s*/g, ' ¶ ');
        const lastTwo = back.split(' ¶ ').slice(-3).join(' ¶ ');
        if (NEG.test(pre.slice(-90))) { verdict = 'allowed'; why = 'negation'; }
        else if (NOT_FOR.test(lastTwo)) { verdict = 'allowed'; why = '"Not for" scope list'; }
        else if (r.route === 'ask' && GOLD.some(q => s.toLowerCase().includes(q))) { verdict = 'allowed'; why = 'Ask scorecard question'; }
        else if (r.route === 'ask' && /\?/.test(s)) { verdict = 'allowed'; why = 'Ask question (refusal test)'; }
        else if (r.route === 'ask' && /^Ask answer/.test(src) && /refus|no NASA evidence|can't|cannot|not able/i.test(text)) { verdict = 'allowed'; why = 'Ask refusal text'; }
        safe.push({ route: r.route, source: src, figure: src.startsWith('Ask answer') ? 'Answer' : cardFor(r, s), hit: h.hit, sentence: s, verdict, why });
      }
      // outside #/flame: never. On #/flame: not while the "Show Moon and Mars (model only)" switch is off (the crawl
      // reads the page text before it presses the switch).
      {
        const pats = [...MOONMARS, ...gravityNotes.map(n => new RegExp(n.slice(0, 40).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'))];
        for (const re of pats) for (const h of scan(text, re)) {
          const s = sentenceAround(text, h.idx, h.hit.length);
          mm.push({ route: r.route, source: src, figure: src.startsWith('Ask answer') ? 'Answer' : cardFor(r, s), hit: h.hit, sentence: s, verdict: 'FAIL', switchOff: r.route === 'flame' });
        }
      }
    }
  }
  const dedupe = a => { const seen = new Set(); return a.filter(x => { const k = `${x.route}|${x.source}|${x.hit}|${x.sentence}`; if (seen.has(k)) return false; seen.add(k); return true; }); };
  return { ion: dedupe(ion), safe: dedupe(safe), moonMars: dedupe(mm), gravityNotes };
}

function madeChecks(crawlData) {
  const folders = fs.readdirSync(path.join(ROOT, 'models'), { withFileTypes: true }).filter(d => d.isDirectory() && !d.name.startsWith('.') && !d.name.startsWith('__')).map(d => d.name).sort();
  const noMade = [], figures = [], seenTitles = new Map();
  for (const r of crawlData.routes) {
    for (const c of r.cards) {
      if (c.nested) continue;
      figures.push({ route: r.route, title: c.title, fignum: c.fignum, stamp: c.stamp, made: c.made, models: c.madeModels });
      if (!seenTitles.has(c.title)) seenTitles.set(c.title, []);
      seenTitles.get(c.title).push(r.route);
      if (r.provenance && c.charted && !c.made && !c.madeOptOut) noMade.push({ route: r.route, title: c.title, owner: 'js/provenance.js (MADE entry) or ' + ownerOf(c.title, r.route) });
    }
  }
  const c9 = folders.map(f => {
    const key = `models/${f}`;
    const inMade = [], inFiles = [], inCards = [];
    for (const r of crawlData.routes) for (const c of r.cards) {
      if (c.madeModels.split(/\s+/).includes(key)) inMade.push(`#/${r.route} "${c.title}"`);
      else if (c.madeFiles.includes(key + '/') || c.madeFiles.includes(key + ' ') || c.madeFiles.endsWith(key)) inFiles.push(`#/${r.route} "${c.title}"`);
      if (c.cardModels.split(/\s+/).includes(key)) inCards.push(`#/${r.route} "${c.title}"`);
    }
    return { folder: key, pass: inMade.length + inFiles.length > 0, madeBy: [...new Set(inMade)], filesText: [...new Set(inFiles)], modelCards: [...new Set(inCards)] };
  });
  const keys = crawlData.routes.find(r => r.madeKeys)?.madeKeys || {};
  const orphan = (keys.made || []).filter(k => !seenTitles.has(k) && ![...seenTitles.keys()].some(t => t.replace(/\s*\((FLEX|CFI|SAME|BASS-II)\)\s*$/, '') === k));
  const warn = [];
  for (const r of crawlData.routes) for (const m of r.console) if (/No "Made by" entry/.test(m)) warn.push({ route: r.route, msg: m });
  return { folders, c9, noMade, orphanMade: orphan, madeWarnings: warn, figureCount: figures.length, figures };
}

// Plan coverage rows in PLAN_COVERAGE.md: "| ID | Item | Page | Figure | Status | Check | Notes |" (hand-written part,
// above the generated sections). Check cells hold evidence tokens: title:"…" (a figure card or h1 title on the page),
// text:"…" (a phrase in the rendered text, labels or Ask answers), sel:"…" (a CSS selector that must match inside
// #view, or #view itself), shell:"…" (a phrase in the header, More menu, banner or footer) or absent:"…" (a phrase that
// must appear on no route, in any text, label or Ask answer), each optionally followed by @route when it is not the
// first route in the Page cell.
export const STATUSES = ['done', 'pending data', 'planned', 'scrapped'];
export function coverageRows() {
  let md = '';
  try { md = fs.readFileSync(COVERAGE, 'utf8'); } catch { return null; }
  const body = md.split(/<!-- (made_check|ranges_check):start -->/)[0];
  const rows = [];
  for (const line of body.split('\n')) {
    if (!line.startsWith('|')) continue;
    const cells = line.replace(/\\\|/g, '\u0000').split('|').slice(1, -1).map(s => s.replace(/\u0000/g, '|').trim());
    if (cells.length < 7 || /^:?-+:?$/.test(cells[0]) || cells[0] === 'ID') continue;
    const [id, item, pageCell, figure, status, check] = cells;
    const routes = [...pageCell.matchAll(/#\/([a-z]+)/g)].map(m => m[1]);
    const ev = [...check.matchAll(/(title|text|sel|shell|absent):"([^"]+)"(?:@([a-z]+))?/g)].map(m => ({ kind: m[1], value: m[2], route: m[3] || routes[0] || null }));
    rows.push({ id, item, figure, status: status.replace(/\*/g, '').trim().toLowerCase(), routes, ev });
  }
  return rows;
}

// Titles the reachability crawl (site/tools/reach.mjs, P7-C) reached, from site/REACH.md's "Every title reached" table.
function reachedTitles() {
  let md = '';
  try { md = fs.readFileSync(path.join(ROOT, 'site/REACH.md'), 'utf8'); } catch { return null; }
  const out = new Set();
  let on = false;
  for (const line of md.split('\n')) {
    if (/^## /.test(line)) on = /^## Every title reached/.test(line);
    if (!on || !line.startsWith('| ') || line.startsWith('| Title') ) continue;
    const c = line.split('|').slice(1, -1).map(s => s.trim());
    const pg = c[1]?.match(/#\/([a-z]+)/)?.[1];
    if (c[0] && pg) out.add(`${pg}|${c[0].replace(/\\\|/g, '|')}`);
  }
  return out.size ? out : null;
}

function coverageChecks(crawlData) {
  const rows = coverageRows();
  if (!rows) return { rows: [], missing: true };
  const reached = reachedTitles();
  const norm = s => s.replace(/\s+/g, ' ').toLowerCase();
  const res = rows.map(row => {
    const done = row.status === 'done';
    const results = row.ev.map(e => {
      if (e.kind === 'absent') {
        const where = crawlData.routes.filter(x => norm([x.text, x.attrs, x.shell || '', ...x.askAnswers.map(a => a.text)].join('\n')).includes(norm(e.value))).map(x => x.route);
        return { ...e, route: 'all', found: !where.length, why: where.length ? `found on ${where.map(w => '#/' + w).join(', ')}` : null };
      }
      const r = crawlData.routes.find(x => x.route === e.route);
      if (!r) return { ...e, found: false, why: 'route not crawled' };
      let found = false;
      if (e.kind === 'title') found = r.cards.some(c => c.title === e.value) || r.h1.includes(e.value);
      else if (e.kind === 'sel') found = (r.sels?.[e.value] || 0) > 0;
      else if (e.kind === 'shell') found = norm(r.shell || '').includes(norm(e.value));
      else found = norm([r.text, r.attrs, ...r.askAnswers.map(a => a.text)].join('\n')).includes(norm(e.value));
      // a done figure must also be reachable by clicking from Home (spec C10 last line); REACH.md is P7-C's output
      const unreached = done && e.kind === 'title' && found && reached && !r.h1.includes(e.value) && !reached.has(`${e.route}|${e.value}`);
      return { ...e, found, unreached };
    });
    let why = null;
    if (!STATUSES.includes(row.status)) why = `status "${row.status}" is not one of ${STATUSES.join(', ')}`;
    else if (done && !row.ev.length) why = 'no evidence check written';
    else if (results.some(x => !x.found)) why = 'evidence not found: ' + results.filter(x => !x.found).map(x => `${x.kind}:"${x.value}"@${x.route}${x.why ? ` (${x.why})` : ''}`).join(', ');
    else if (results.some(x => x.unreached)) why = 'not reached by the reachability crawl (site/REACH.md): ' + results.filter(x => x.unreached).map(x => `"${x.value}"@${x.route}`).join(', ');
    return { id: row.id, item: row.item, status: row.status, results, fail: !!why, why };
  });
  const counts = Object.fromEntries(STATUSES.map(s => [s, res.filter(r => r.status === s).length]));
  return { rows: res, counts, reachChecked: !!reached };
}

export function runChecks(crawlData) {
  const made = madeChecks(crawlData);
  const wording = wordingChecks(crawlData);
  const coverage = coverageChecks(crawlData);
  const consoleErrors = crawlData.routes.flatMap(r => r.console.filter(m => /^(error|pageerror|requestfailed)/.test(m)).map(m => ({ route: r.route, msg: m })));
  const stray = [];
  for (const r of crawlData.routes) for (const c of r.cards) {
    if (c.nested) continue;
    for (const sn of c.strayNodes || []) stray.push({ route: r.route, title: c.title, token: sn.token, owner: ownerOf(c.title, r.route), sentence: sn.context, path: sn.path });
  }
  const issues = [];
  for (const f of made.c9) if (!f.pass) issues.push(`C9: ${f.folder} appears in no rendered "Made by" block (owner: js/provenance.js MADE models field)`);
  for (const n of made.noMade) issues.push(`Made-by: charted figure "${n.title}" on #/${n.route} has no "Made by" entry (owner: ${n.owner})`);
  for (const w of wording.ion) issues.push(`Wording: "${w.hit}" on #/${w.route} in ${w.figure ? `"${w.figure}"` : w.source} (owner: ${ownerOf(w.figure, w.route)}): ${w.sentence}`);
  for (const w of wording.safe.filter(x => x.verdict === 'FAIL')) issues.push(`Wording: affirmative "${w.hit}" on #/${w.route} in ${w.figure ? `"${w.figure}"` : w.source} (owner: ${ownerOf(w.figure, w.route)}): ${w.sentence}`);
  for (const w of wording.moonMars) issues.push(`Moon/Mars value ${w.switchOff ? 'on #/flame with the model-only switch off' : 'outside #/flame'}: "${w.hit}" on #/${w.route} in ${w.figure ? `"${w.figure}"` : w.source} (owner: ${ownerOf(w.figure, w.route)}): ${w.sentence}`);
  for (const r of coverage.rows.filter(x => x.fail)) issues.push(`Coverage: ${r.id} "${r.item}" (${r.status}): ${r.why} (owner: ${[...new Set(r.results.filter(x => !x.found || x.unreached).map(x => x.kind === 'title' ? ownerOf(x.value, x.route) : `js/pages/${x.route}.js`))].join(', ') || 'site/PLAN_COVERAGE.md'})`);
  if (coverage.missing) issues.push('Coverage: site/PLAN_COVERAGE.md not found (owner: P7-E)');
  const ms = crawlData.routes.find(r => r.route === 'flame')?.moonSwitch;
  if (ms && (!ms.found || ms.noteBefore || !ms.noteAfter)) issues.push(`Moon/Mars switch on #/flame: ${!ms.found ? 'not found' : ms.noteBefore ? 'gravity note visible while the switch is off' : 'gravity note not shown after switching on'} (owner: js/fig_flame.js)`);
  for (const e of consoleErrors) issues.push(`Console on #/${e.route}: ${e.msg.slice(0, 200)} (owner: ${ownerOf(null, e.route)})`);
  for (const s of stray) issues.push(`Stray "${s.token}" in "${s.title}" on #/${s.route} (owner: ${s.owner}; element ${s.path}): ${s.sentence.slice(0, 160)}`);
  const noStamp = crawlData.routes.flatMap(r => r.cards.filter(c => !c.nested && !c.stamp).map(c => ({ route: r.route, title: c.title, owner: ownerOf(c.title, r.route) })));
  for (const n of noStamp) issues.push(`Stamp: figure "${n.title}" on #/${n.route} has no status stamp (owner: ${n.owner})`);
  return { made, wording, coverage, consoleErrors, stray, noStamp, issues };
}

// ---------- report ----------
const esc = s => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
export function replaceSection(md, name, body) {
  const a = `<!-- ${name}:start -->`, b = `<!-- ${name}:end -->`;
  const i = md.indexOf(a), j = md.indexOf(b);
  const block = `${a}\n${body.trim()}\n${b}`;
  return i >= 0 && j > i ? md.slice(0, i) + block + md.slice(j + b.length) : md.trimEnd() + '\n\n' + block + '\n';
}

function markdown(res, crawlData) {
  const L = [];
  L.push(`Generated by \`node site/tools/made_check.mjs --write\` on ${crawlData.at} (${crawlData.routes.length} routes, ${res.made.figureCount} figure cards, every fold opened).`, '');
  L.push('### C9: every models/ folder in a rendered "Made by"', '', '| Folder | Result | Rendered "Made by" blocks that name it | Also on Model cards |', '|---|---|---|---|');
  for (const f of res.made.c9) L.push(`| \`${f.folder}\` | ${f.pass ? 'pass' : '**FAIL**'} | ${esc([...f.madeBy, ...f.filesText.map(x => x + ' (Files text)')].slice(0, 6).join('; ')) || 'none'}${f.madeBy.length > 6 ? ` and ${f.madeBy.length - 6} more` : ''} | ${f.modelCards.length ? esc(f.modelCards.join('; ')) : '-'} |`);
  L.push('', `### Charted figures with no "Made by" entry: ${res.made.noMade.length}`, '');
  if (res.made.noMade.length) { L.push('| Page | Figure | Owner |', '|---|---|---|'); res.made.noMade.forEach(n => L.push(`| #/${n.route} | ${esc(n.title)} | ${esc(n.owner)} |`)); }
  else L.push('None. (#/models has `provenance:false` and is skipped, as §2.3 sets.)');
  if (res.made.orphanMade.length) L.push('', `MADE entries whose title no route rendered (information only): ${res.made.orphanMade.map(t => `"${esc(t)}"`).join(', ')}.`);
  L.push('', '### Wording grep (rendered text, labels and every Ask answer)', '');
  L.push(`- Ion wind or thermopile: ${res.wording.ion.length ? `**${res.wording.ion.length} FAIL**` : 'no hits'}.`);
  res.wording.ion.forEach(w => L.push(`  - #/${w.route}, ${esc(w.figure || w.source)}: "${esc(w.sentence)}"`));
  const sf = res.wording.safe.filter(x => x.verdict === 'FAIL');
  L.push(`- safe / certif / first ever: ${res.wording.safe.length} hits, ${sf.length ? `**${sf.length} FAIL**` : 'none affirmative'}.`);
  if (res.wording.safe.length) {
    L.push('', '| Page | Where | Hit | Sentence | Verdict |', '|---|---|---|---|---|');
    res.wording.safe.forEach(w => L.push(`| #/${w.route} | ${esc(w.figure || w.source)} | ${esc(w.hit)} | ${esc(w.sentence.slice(0, 220))} | ${w.verdict === 'FAIL' ? '**FAIL**' : 'allowed: ' + w.why} |`));
    L.push('');
  }
  L.push(`- Moon or Mars value outside #/flame, or on #/flame before the switch is pressed (0.16 g, 0.38 g, the gravity_note text, a number next to Moon or Mars): ${res.wording.moonMars.length ? `**${res.wording.moonMars.length} FAIL**` : 'no hits'}.`);
  res.wording.moonMars.forEach(w => L.push(`  - #/${w.route}${w.switchOff ? ' (switch off)' : ''}, ${esc(w.figure || w.source)}: "${esc(w.hit)}" in "${esc(w.sentence.slice(0, 200))}"`));
  const ms = crawlData.routes.find(r => r.route === 'flame')?.moonSwitch;
  L.push(`- Flame lab switch "Show Moon and Mars (model only)": ${!ms ? 'not checked' : !ms.found ? '**not found**' : `off by default, gravity note shown ${ms.noteBefore ? '**before**' : 'not before'} the switch; after one press aria-pressed=${ms.pressed} and the note is ${ms.noteAfter ? 'shown' : '**not shown**'}`}.`);
  const cc = res.coverage.counts || {};
  L.push('', `### Plan coverage evidence: ${res.coverage.rows.length} rows (${STATUSES.map(s => `${cc[s] || 0} ${s}`).join(', ')}); ${res.coverage.rows.filter(r => r.ev?.length || r.results?.length).length} with evidence checked, ${res.coverage.rows.filter(r => r.fail).length} failed`, '',
    `Every row's evidence is looked for in this crawl; a done row needs at least one check, and its figure titles must also appear in site/REACH.md's reached list${res.coverage.reachChecked ? '' : ' (site/REACH.md not found or empty, so reachability was not cross-checked)'}.`, '');
  res.coverage.rows.filter(r => r.fail).forEach(r => L.push(`- **${esc(r.id)}** ${esc(r.item)}: ${esc(r.why)}`));
  if (!res.coverage.rows.some(r => r.fail)) L.push('No failures.');
  L.push('', `### Console errors: ${res.consoleErrors.length}; stray null/undefined/NaN in card text: ${res.stray.length}`, '');
  res.consoleErrors.forEach(e => L.push(`- #/${e.route}: ${esc(e.msg.slice(0, 200))}`));
  res.stray.forEach(s => L.push(`- #/${s.route} "${esc(s.title)}" (${s.owner}), element \`${esc(s.path)}\`: "${esc(s.sentence.slice(0, 160))}"`));
  L.push('', `### Figure cards with no status stamp: ${res.noStamp.length}`, '');
  res.noStamp.forEach(n => L.push(`- #/${n.route} "${esc(n.title)}" (${n.owner})`));
  L.push('', `### Issues: ${res.issues.length}`, '');
  res.issues.forEach(i => L.push(`- ${esc(i)}`));
  if (!res.issues.length) L.push('None.');
  return L.join('\n');
}

async function main() {
  const out = argv('--out') || path.join(os.tmpdir(), 'vo_made_check.json');
  const from = argv('--from');
  const crawlData = from ? JSON.parse(fs.readFileSync(from, 'utf8')).crawl : await crawl({ base: argv('--base') || null });
  const res = runChecks(crawlData);
  fs.writeFileSync(out, JSON.stringify({ crawl: crawlData, results: { ...res, made: { ...res.made, figures: undefined } } }, null, 1));
  const md = markdown(res, crawlData);
  if (argv('--write')) {
    let cur = ''; try { cur = fs.readFileSync(COVERAGE, 'utf8'); } catch { /* new */ }
    fs.writeFileSync(COVERAGE, replaceSection(cur, 'made_check', md));
  }
  process.stdout.write(md + '\n');
  process.stderr.write(`crawl and results: ${out}\n`);
  process.exitCode = res.issues.length ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) main().catch(e => { console.error(e); process.exit(2); });

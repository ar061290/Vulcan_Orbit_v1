#!/usr/bin/env node
// P7-D accessibility scan (site/REBUILD_PLAN.md §4 phase 7, spec Part E7 "Accessibility scan").
// Runs axe-core on every page in js/site.js, in Day and Night, with every <details> fold opened so folded figures and
// "Show the numbers" tables are scanned too. The "Read your way" dock panel is scanned once per theme (on Home).
// Every serious or critical violation is listed with its selector and the file that most likely owns it.
//
// axe-core and playwright-core are test tools, never site dependencies: install them in a scratch folder
//   (npm i axe-core playwright-core) and point at it:
//   PW_DIR=<folder holding node_modules/playwright-core>  AXE_JS=<path to axe-core/axe.min.js>
//   node site/tools/axe.mjs --serve 8100 --json out.json [--md out.md] [--routes detect,assess] [--themes day,night]
// --serve N starts `python3 -m http.server N` from the repo root and stops it at the end; --base URL uses a running server.
// External requests (Google Fonts) are blocked so runs are repeatable offline; contrast is computed on fallback fonts.
// Motion is set to Calm so stagger and view-transition animations cannot catch text mid-fade.
// Exit code: 0 when no serious/critical violation was found, 1 otherwise, 2 on a tool error.
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const arg = (name, dflt = null) => { const i = process.argv.indexOf('--' + name); return i > 0 && i + 1 < process.argv.length ? process.argv[i + 1] : dflt; };

async function loadPlaywright() {
  const dir = process.env.PW_DIR;
  if (dir) { const req = createRequire(path.join(path.resolve(dir), 'noop.js')); return import(pathToFileURL(req.resolve('playwright-core')).href); }
  try { return await import('playwright-core'); } catch { return import('playwright'); }
}
function chromePath() {
  if (process.env.CHROME) return process.env.CHROME;
  const base = path.join(os.homedir(), '.cache', 'ms-playwright');
  const hs = fs.existsSync(base) ? fs.readdirSync(base).filter(d => d.startsWith('chromium_headless_shell-')).sort().reverse() : [];
  for (const d of hs) { const p = path.join(base, d, 'chrome-headless-shell-linux64', 'chrome-headless-shell'); if (fs.existsSync(p)) return p; }
  return undefined;   // let Playwright find its own
}
function launchEnv() {
  const libs = path.join(os.homedir(), '.local', 'chromium-libs', 'root', 'usr', 'lib', 'x86_64-linux-gnu');
  const env = { ...process.env };
  if (fs.existsSync(libs)) env.LD_LIBRARY_PATH = libs + (env.LD_LIBRARY_PATH ? ':' + env.LD_LIBRARY_PATH : '');
  return env;
}
async function serve(port) {
  const p = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: REPO, stdio: 'ignore' });
  for (let i = 0; i < 50; i++) {
    try { const r = await fetch(`http://127.0.0.1:${port}/index.html`); if (r.ok) return p; } catch { /* not up yet */ }
    await new Promise(r => setTimeout(r, 100));
  }
  p.kill(); throw new Error(`http.server on ${port} did not start`);
}

// ---------- owner index: which repo file creates or styles a class / id ----------
function walk(dir, ext) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p, ext)); else if (e.name.endsWith(ext)) out.push(p);
  }
  return out;
}
function buildIndex() {
  const js = new Map(), css = new Map(), ids = new Map();
  const put = (m, k, f) => { if (!k || /[${}]/.test(k)) return; if (!m.has(k)) m.set(k, new Set()); m.get(k).add(f); };
  const rel = f => path.relative(REPO, f);
  const jsFiles = [...walk(path.join(REPO, 'js'), '.js'), path.join(REPO, 'index.html')];
  for (const f of jsFiles) {
    const t = fs.readFileSync(f, 'utf8'), r = rel(f);
    // class: '…', class="…", className = '…', classList.add/toggle('…'), cls('…')
    for (const m of t.matchAll(/(?:\bclass(?:Name)?\s*[:=]\s*|classList\.(?:add|toggle|remove)\(\s*)([`'"])([^`'"]*)\1/g))
      for (const tok of m[2].split(/\s+/)) put(js, tok, r);
    for (const m of t.matchAll(/`([^`]*)`/g)) {          // template literals: `as-body ${cls}` → as-body
      if (!/class/.test(t.slice(Math.max(0, m.index - 12), m.index))) continue;
      for (const tok of m[1].replace(/\$\{[^}]*\}/g, ' ').split(/\s+/)) put(js, tok, r);
    }
    for (const m of t.matchAll(/\bid\s*[:=]\s*([`'"])([\w-]+)\1/g)) put(ids, m[2], r);
  }
  for (const f of walk(path.join(REPO, 'css'), '.css')) {
    const t = fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ''), r = rel(f);
    for (const m of t.matchAll(/([^{}]+)\{/g)) for (const c of m[1].matchAll(/\.([A-Za-z_][\w-]*)/g)) put(css, c[1], r);
  }
  return { js, css, ids };
}

/** Pick the owning JS and CSS files for one node from its ancestor chain [{tag,id,cls:[]},…] (nearest first). */
function ownerOf(chain, route, IDX) {
  let js = null, why = null;
  for (const a of chain) {
    if (a.id && IDX.ids.get(a.id)?.size === 1) { js = [...IDX.ids.get(a.id)][0]; why = `#${a.id}`; break; }
    const hit = a.cls.find(c => IDX.js.get(c)?.size === 1);
    if (hit) { js = [...IDX.js.get(hit)][0]; why = `.${hit}`; break; }
  }
  const outside = chain.find(a => a.id === 'view') ? null
    : chain.find(a => a.cls.includes('top')) ? 'js/router.js (header/nav), index.html'
    : chain.find(a => a.cls.includes('dock')) ? 'js/prefs.js'
    : chain.find(a => a.id === 'demo-banner') ? 'js/status.js'
    : chain.find(a => a.cls.includes('foot')) ? 'index.html' : null;
  if (!js) { js = outside || `js/pages/${route}.js`; why = outside ? 'outside #view' : 'page module (no unique class)'; }
  const cssSet = new Set();
  // page CSS is scoped under #view[data-page] (plan §0 rule 9), so only this route's p-<id>.css can apply
  for (const a of chain.slice(0, 3)) for (const c of a.cls) for (const f of IDX.css.get(c) || [])
    if (!/^css\/p-/.test(f) || f === `css/p-${route}.css`) cssSet.add(f);
  return { js, why, css: [...cssSet].slice(0, 4) };
}

// ---------- in-page helpers ----------
async function settle(page, id) {
  await page.waitForFunction(i => document.getElementById('view')?.dataset.page === i && document.querySelector('#view > *'), id, { timeout: 20000 });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), null, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(300);
}
async function openFolds(page) {
  for (let pass = 0; pass < 4; pass++) {
    const n = await page.evaluate(() => { let k = 0; document.querySelectorAll('#view details:not([open])').forEach(d => { d.open = true; k++; }); return k; });
    if (!n) break;
    await page.evaluate(() => dispatchEvent(new Event('resize')));
    await page.waitForTimeout(250);
  }
}
const CHAIN_FN = `(sel) => { const el = document.querySelector(sel); const out = [];
  for (let e = el; e && e !== document.documentElement; e = e.parentElement)
    out.push({ tag: e.tagName.toLowerCase(), id: e.id || null, cls: [...(e.classList || [])] });
  return out; }`;

async function scan(page, axeSrc, include) {
  await page.addScriptTag({ content: axeSrc });
  return page.evaluate(async inc => {
    const res = await window.axe.run(inc ? { include: [[inc]] } : document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] },
      resultTypes: ['violations'],
    });
    return res.violations.map(v => ({ id: v.id, impact: v.impact, help: v.help, helpUrl: v.helpUrl, tags: v.tags,
      nodes: v.nodes.map(n => ({ target: n.target.flat().join(' '), html: n.html.slice(0, 220), summary: (n.failureSummary || '').replace(/\s+/g, ' ').slice(0, 400), impact: n.impact })) }));
  }, include || null);
}

async function main() {
  const AXE = process.env.AXE_JS || arg('axe');
  if (!AXE || !fs.existsSync(AXE)) { console.error('Set AXE_JS (or --axe) to axe-core/axe.min.js from a scratch install (npm i axe-core).'); process.exit(2); }
  const axeSrc = fs.readFileSync(AXE, 'utf8');
  const axeVer = (axeSrc.match(/axe v([\d.]+)/) || [])[1] || 'unknown';
  const { PAGES } = await import(pathToFileURL(path.join(REPO, 'js', 'site.js')).href);
  const routes = (arg('routes') || PAGES.map(p => p.id).join(',')).split(',').filter(Boolean);
  const themes = (arg('themes') || 'day,night').split(',');
  const port = arg('serve'); let srv = null;
  const base = port ? `http://127.0.0.1:${port}/` : (arg('base') || 'http://127.0.0.1:8000/');
  const IDX = buildIndex();
  const pw = await loadPlaywright(); const chromium = pw.chromium || pw.default?.chromium;
  let browser = null;
  const results = [];
  const cleanup = async () => { try { await browser?.close(); } catch {} ; try { srv?.kill(); } catch {} };
  process.on('SIGINT', async () => { await cleanup(); process.exit(2); });
  try {
    if (port) srv = await serve(port);
    browser = await chromium.launch({ executablePath: chromePath(), env: launchEnv(), args: ['--disable-gpu'] });
    const host = new URL(base).host;
    for (const theme of themes) {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
      await ctx.addInitScript(t => { try { localStorage.setItem('vo.theme', t); localStorage.setItem('vo.motion', 'calm'); } catch {} }, theme);
      await ctx.route('**/*', r => (new URL(r.request().url()).host === host ? r.continue() : r.abort()));
      for (const id of routes) {
        const page = await ctx.newPage(); const errors = [];
        page.on('pageerror', e => errors.push(e.message));
        page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED|net::/.test(m.text())) errors.push(m.text()); });
        const t0 = Date.now();
        let violations = [], note = null;
        try {
          await page.goto(`${base}index.html#/${id}`, { waitUntil: 'load' });
          await settle(page, id);
          await openFolds(page);
          violations = await scan(page, axeSrc);
          if (id === 'overview') {   // the dock panel, opened the way a visitor opens it
            await page.click('.dock-toggle'); await page.waitForTimeout(150);
            const dv = await scan(page, axeSrc, '.dock');
            for (const v of dv) { v.scope = 'dock'; violations.push(v); }
            await page.keyboard.press('Escape');
          }
        } catch (e) { note = `scan failed: ${e.message.split('\n')[0]}`; }
        for (const v of violations) for (const n of v.nodes) {
          let chain = [];
          try { chain = await page.evaluate(`(${CHAIN_FN})(${JSON.stringify(n.target)})`); } catch { /* selector inside shadow/iframe */ }
          n.owner = ownerOf(chain, id, IDX);
        }
        results.push({ route: id, theme, ms: Date.now() - t0, errors, note, violations });
        const sc = violations.filter(v => v.impact === 'serious' || v.impact === 'critical');
        console.log(`${id.padEnd(9)} ${theme.padEnd(5)} ${String(violations.length).padStart(2)} rules violated, ${sc.length} serious/critical${note ? ' | ' + note : ''}${errors.length ? ` | ${errors.length} console error(s)` : ''}`);
        await page.close();
      }
      await ctx.close();
    }
  } finally { await cleanup(); }

  // ---------- summary ----------
  const rows = [];
  for (const r of results) for (const v of r.violations) for (const n of v.nodes)
    rows.push({ route: r.route, theme: r.theme, rule: v.id, impact: n.impact || v.impact, help: v.help, target: n.target, html: n.html, summary: n.summary, owner: n.owner, scope: v.scope || 'page' });
  const key = x => `${x.rule}|${x.target}|${x.owner.js}`;
  const grouped = new Map();
  for (const x of rows) { const k = key(x); if (!grouped.has(k)) grouped.set(k, { ...x, where: [] }); grouped.get(k).where.push(`${x.route}/${x.theme}`); }
  const all = [...grouped.values()];
  const ser = all.filter(x => x.impact === 'serious' || x.impact === 'critical');
  const out = { tool: 'site/tools/axe.mjs', axe: axeVer, base, when: new Date().toISOString(), routes, themes,
    folds: 'all <details> opened before the scan', motion: 'calm', externalRequests: 'blocked', results, issues: all };
  const jf = arg('json'); if (jf) fs.writeFileSync(jf, JSON.stringify(out, null, 1));
  const mf = arg('md');
  if (mf) {
    const esc = s => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
    const line = x => `| ${x.impact} | \`${x.rule}\` | \`${esc(x.target)}\` | ${esc(x.owner.js)}${x.owner.css.length ? ' · ' + x.owner.css.join(', ') : ''} | ${esc(x.where.join(', '))} |`;
    const md = [`Generated by site/tools/axe.mjs (axe-core ${axeVer}) at ${out.when}; ${routes.length} routes × ${themes.join('/')}; folds opened.`, '',
      '| Impact | Rule | Selector | Owning file (best guess) | Where |', '|---|---|---|---|---|',
      ...all.sort((a, b) => ['critical', 'serious', 'moderate', 'minor'].indexOf(a.impact) - ['critical', 'serious', 'moderate', 'minor'].indexOf(b.impact) || a.rule.localeCompare(b.rule)).map(line)];
    fs.writeFileSync(mf, md.join('\n') + '\n');
  }
  console.log(`\n${all.length} distinct violating nodes (${ser.length} serious/critical) across ${results.length} scans.`);
  for (const x of ser) console.log(`  [${x.impact}] ${x.rule}: ${x.target}  → ${x.owner.js} (${x.owner.why})  @ ${x.where.slice(0, 4).join(', ')}${x.where.length > 4 ? ` +${x.where.length - 4}` : ''}`);
  const consoleErr = results.filter(r => r.errors.length || r.note);
  for (const r of consoleErr) console.log(`  ${r.route}/${r.theme}: ${r.note || ''} ${r.errors.slice(0, 3).join(' | ')}`);
  process.exit(ser.length ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(2); });

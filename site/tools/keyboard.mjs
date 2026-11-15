#!/usr/bin/env node
// P7-D keyboard-only run (site/REBUILD_PLAN.md §4 phase 7; spec Part E7 "Keyboard-only run" and "Keyboard pass").
// Part 1, the scripted journey, uses only Tab, Shift+Tab, Enter and the arrow keys (Escape only where the spec asks that
// Escape closes the dock, the More menu and tooltips):
//   skip link first → More menu (Escape closes, focus back) → dock: open, change the theme, Escape returns focus →
//   menu link to Predict it → open a "Show N more figures" fold → read a chart value with the arrows (Escape hides it) →
//   menu link to Assess → change the worked example with the arrow keys → the assessment reruns and is announced once →
//   nudge the oxygen slider with the arrows → read a value on "Burning area over time".
// Part 2, the tab sweep: on every route, Tab from the top of #view until focus leaves it, recording each stop that has
//   no visible focus indicator, is invisible (zero size or off-screen after scrolling), or traps focus.
//
//   PW_DIR=<folder holding node_modules/playwright-core> node site/tools/keyboard.mjs --serve 8101 [--json out.json]
//   [--sweep 0] (skip part 2)   [--routes a,b] (part 2 routes)   [--base URL] (use a running server instead of --serve)
// Exit code: 0 when every journey step passed, 1 otherwise, 2 on a tool error. Sweep findings are reported, not failed.
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
  return undefined;
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

// ---------- focus helpers (run in the page) ----------
const DESCRIBE = `(() => { const e = document.activeElement; if (!e || e === document.body) return null;
  const cs = getComputedStyle(e), r = e.getBoundingClientRect();
  const ring = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || (cs.boxShadow && cs.boxShadow !== 'none');
  const name = (e.getAttribute('aria-label') || e.textContent || e.value || '').replace(/\\s+/g, ' ').trim().slice(0, 60);
  let sel = e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.classList.length ? '.' + [...e.classList].slice(0, 3).join('.') : '');
  const card = e.closest('section.card'); const fig = card?.dataset.fig || null;
  return { sel, name, ring, w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top), left: Math.round(r.left),
    vw: innerWidth, vh: innerHeight, inView: !!e.closest('#view'), fig, tag: e.tagName.toLowerCase(),
    role: e.getAttribute('role'), v: e.dataset?.v || null, id: e.id || null, dataId: e.dataset?.id || null }; })()`;

async function settle(page, id) {
  await page.waitForFunction(i => document.getElementById('view')?.dataset.page === i && document.querySelector('#view > *'), id, { timeout: 20000 });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), null, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(250);
}
/** Press `key` until `test(focused)` is true; returns {ok, presses, el}. */
async function tabTo(page, test, { key = 'Tab', max = 400 } = {}) {
  for (let i = 1; i <= max; i++) {
    await page.keyboard.press(key);
    const el = await page.evaluate(DESCRIBE);
    if (el && test(el)) return { ok: true, presses: i, el };
  }
  return { ok: false, presses: max, el: await page.evaluate(DESCRIBE) };
}

async function main() {
  const pw = await loadPlaywright(); const chromium = pw.chromium || pw.default?.chromium;
  const { PAGES } = await import(pathToFileURL(path.join(REPO, 'js', 'site.js')).href);
  const port = arg('serve'); let srv = null, browser = null;
  const base = port ? `http://127.0.0.1:${port}/` : (arg('base') || 'http://127.0.0.1:8000/');
  const steps = [], sweep = [], errors = [];
  const step = (name, ok, detail) => { steps.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };
  const cleanup = async () => { try { await browser?.close(); } catch {} ; try { srv?.kill(); } catch {} };
  process.on('SIGINT', async () => { await cleanup(); process.exit(2); });
  try {
    if (port) srv = await serve(port);
    browser = await chromium.launch({ executablePath: chromePath(), env: launchEnv(), args: ['--disable-gpu'] });
    const host = new URL(base).host;
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.addInitScript(() => { try { localStorage.setItem('vo.theme', 'day'); localStorage.setItem('vo.motion', 'calm'); } catch {} });
    await ctx.route('**/*', r => (new URL(r.request().url()).host === host ? r.continue() : r.abort()));
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
    page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED|net::/.test(m.text())) errors.push(`console: ${m.text()}`); });
    const live = () => page.evaluate(() => document.getElementById('live')?.textContent || '');
    const tipState = () => page.evaluate(() => { const t = document.getElementById('tip'); return t && !t.hidden ? t.textContent.replace(/\s+/g, ' ').trim() : null; });

    // ======== Part 1: the journey ========
    await page.goto(`${base}index.html#/overview`, { waitUntil: 'load' }); await settle(page, 'overview');
    await page.keyboard.press('Tab');
    const first = await page.evaluate(DESCRIBE);
    step('First Tab lands on the skip link', first && /\bskip\b/.test(first.sel), first ? `${first.sel} "${first.name}"` : 'nothing focused');

    // More menu
    let r = await tabTo(page, e => /more-btn/.test(e.sel), { max: 40 });
    if (r.ok) {
      await page.keyboard.press('Enter');
      const open = await page.evaluate(() => document.querySelector('.more-btn')?.getAttribute('aria-expanded'));
      await page.keyboard.press('Tab');
      const inList = await page.evaluate(DESCRIBE);
      await page.keyboard.press('Escape');
      const after = await page.evaluate(() => ({ exp: document.querySelector('.more-btn')?.getAttribute('aria-expanded'), back: document.activeElement?.classList.contains('more-btn') }));
      step('More menu: Enter opens it (aria-expanded), Tab enters it, Escape closes it and returns focus', open === 'true' && inList?.dataId && after.exp === 'false' && after.back,
        `${r.presses} Tabs; expanded=${open}; next stop ${inList?.sel} "${inList?.name}"; after Escape expanded=${after.exp}, focus back=${after.back}`);
    } else step('More menu reachable by Tab', false, `not reached in ${r.presses} Tabs`);

    // Dock: from the top again, Tab forwards to the toggle (it sits after the footer)
    await page.reload({ waitUntil: 'load' }); await settle(page, 'overview');
    r = await tabTo(page, e => /dock-toggle/.test(e.sel), { max: 600 });
    let viaShift = null;
    if (!r.ok) {
      await page.reload({ waitUntil: 'load' }); await settle(page, 'overview');
      viaShift = await tabTo(page, e => /dock-toggle/.test(e.sel), { key: 'Shift+Tab', max: 20 });
    }
    step('Dock toggle reachable by Tab', r.ok || viaShift?.ok, r.ok ? `${r.presses} Tabs from the top of Home (Shift+Tab from the top reaches it faster)` : `Tab: not in ${r.presses}; Shift+Tab: ${viaShift?.ok ? viaShift.presses : 'no'}`);
    if (r.ok || viaShift?.ok) {
      await page.keyboard.press('Enter');
      const d = await page.evaluate(() => ({ exp: document.querySelector('.dock-toggle')?.getAttribute('aria-expanded'), hidden: document.getElementById('dock-panel')?.hidden, focusIn: !!document.activeElement?.closest('#dock-panel') }));
      step('Dock: Enter opens the panel and moves focus into it', d.exp === 'true' && d.hidden === false && d.focusIn, JSON.stringify(d));
      const before = await page.evaluate(() => document.documentElement.dataset.theme);
      const want = before === 'day' ? 'night' : 'day';
      const t = await tabTo(page, e => e.v === want, { max: 6 });
      if (t.ok) await page.keyboard.press('Enter');
      await page.waitForTimeout(400);
      const th = await page.evaluate(w => ({ theme: document.documentElement.dataset.theme, pressed: document.querySelector(`#dock-panel [data-v="${w}"]`)?.getAttribute('aria-pressed'), focusIn: !!document.activeElement?.closest('#dock-panel'), ls: (() => { try { return localStorage.getItem('vo.theme'); } catch { return null; } })() }), want);
      step(`Dock: Tab to "${want === 'night' ? 'Night' : 'Day'}" and Enter changes the theme`, t.ok && th.theme === want && th.pressed === 'true', `${before} → ${th.theme}; aria-pressed=${th.pressed}; stored=${th.ls}; focus kept in dock=${th.focusIn}`);
      await page.keyboard.press('Escape');
      const esc = await page.evaluate(() => ({ hidden: document.getElementById('dock-panel')?.hidden, back: document.activeElement?.classList.contains('dock-toggle') }));
      step('Dock: Escape closes it and returns focus to the toggle', esc.hidden && esc.back, JSON.stringify(esc));
    }

    // Menu link to Predict it, then a fold
    await page.reload({ waitUntil: 'load' }); await settle(page, 'overview');
    r = await tabTo(page, e => e.dataId === 'predict', { max: 40 });
    if (r.ok) { await page.keyboard.press('Enter'); await settle(page, 'predict'); }
    step('Menu: Tab to "Predict it" and Enter opens the page', r.ok && (await page.evaluate(() => document.getElementById('view').dataset.page)) === 'predict', `${r.presses} Tabs`);
    const fold = await tabTo(page, e => e.tag === 'summary' && e.inView && /\bmore\b|Show \d+ more/.test(e.name + ' ' + e.sel), { max: 300 });
    let foldOk = false;
    if (fold.ok) {
      const isMore = await page.evaluate(() => document.activeElement.parentElement.classList.contains('more'));
      await page.keyboard.press('Enter'); await page.waitForTimeout(300);
      foldOk = await page.evaluate(() => document.activeElement.parentElement?.open === true);
      step('Fold: Tab to "Show N more figures" and Enter opens it', foldOk && isMore, `${fold.presses} Tabs; "${fold.el.name}"`);
    } else step('Fold: "Show N more figures" reachable by Tab', false, `not reached in ${fold.presses} Tabs`);

    // Chart value
    const chart = await tabTo(page, e => e.inView && (e.tag === 'svg' || e.tag === 'canvas' || e.role === 'img'), { max: 300 });
    if (chart.ok) {
      await page.keyboard.press('ArrowRight'); await page.waitForTimeout(120);
      const v1 = await tipState();
      await page.keyboard.press('ArrowRight'); await page.waitForTimeout(120);
      const v2 = await tipState();
      await page.keyboard.press('Escape'); await page.waitForTimeout(80);
      const v3 = await tipState();
      step('Chart: Tab reaches it, the arrows read values, Escape hides the tooltip', v1 && v2 && v3 === null,
        `${chart.presses} Tabs to "${chart.el.fig || chart.el.name}"; first "${(v1 || '').slice(0, 70)}"; next "${(v2 || '').slice(0, 70)}"; changed=${v1 !== v2}; after Escape ${v3 === null ? 'hidden' : 'still shown'}`);
    } else step('Chart reachable by Tab', false, `not reached in ${chart.presses} Tabs`);

    // Assess run
    await page.goto(`${base}index.html#/overview`, { waitUntil: 'load' }); await page.reload({ waitUntil: 'load' }); await settle(page, 'overview');
    r = await tabTo(page, e => e.dataId === 'assess', { max: 40 });
    if (r.ok) { await page.keyboard.press('Enter'); await settle(page, 'assess'); }
    step('Menu: Tab to "Assess" and Enter opens the page', r.ok && (await page.evaluate(() => document.getElementById('view').dataset.page)) === 'assess', `${r.presses} Tabs`);
    const read = () => page.evaluate(() => ({
      preset: document.getElementById('as-preset')?.value || null,
      verdict: document.querySelector('.as-verdict')?.textContent.replace(/\s+/g, ' ').trim() || null,
      stats: [...document.querySelectorAll('#view .statbox')].slice(0, 4).map(s => s.textContent.replace(/\s+/g, ' ').trim()).join(' | '),
      hash: location.hash }));
    const s0 = await read();
    const sel = await tabTo(page, e => e.id === 'as-preset', { max: 120 });
    if (sel.ok) {
      const nOpts = await page.evaluate(() => document.getElementById('as-preset').options.length);
      await page.keyboard.press('ArrowDown'); await page.waitForTimeout(200);
      let s1 = await read();
      if (s1.preset === s0.preset && nOpts > 1) { await page.keyboard.press('ArrowUp'); await page.waitForTimeout(200); s1 = await read(); }
      await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), null, { timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(400);
      s1 = await read(); const said = await live();
      step('Assess: the arrow keys on "Start from a worked example" change the preset and the assessment reruns', s1.preset !== s0.preset && s1.stats !== s0.stats,
        `${sel.presses} Tabs; preset ${s0.preset} → ${s1.preset}; verdict "${s1.verdict}"; stats "${s1.stats.slice(0, 140)}"`);
      step('Assess: the result is announced in the one polite live region', !!said && (await page.evaluate(() => document.querySelectorAll('[aria-live]').length)) === 1, `#live: "${said}"`);
      // oxygen slider
      const o2 = await tabTo(page, e => e.tag === 'input' && /o2|oxygen/i.test((e.id || '') + e.name), { max: 80 });
      if (o2.ok) {
        const before = await page.evaluate(() => [document.activeElement.value, document.activeElement.type]);
        for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight');
        await page.waitForTimeout(300);
        await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), null, { timeout: 30000 }).catch(() => {});
        await page.waitForTimeout(400);
        const after = await page.evaluate(() => document.activeElement.value);
        const s2 = await read();
        step('Assess: the oxygen slider moves with the arrow keys and the URL follows', after !== before[0] && s2.hash !== s1.hash,
          `${o2.el.sel} (${before[1]}) ${before[0]} → ${after}; hash changed=${s2.hash !== s1.hash}`);
      } else step('Assess: oxygen control reachable by Tab', false, `not reached in ${o2.presses} Tabs`);
      // value on the growth curve
      const curve = await tabTo(page, e => e.inView && (e.tag === 'svg' || e.role === 'img') && /burning-area/.test(e.fig || ''), { max: 200 });
      if (curve.ok) {
        await page.keyboard.press('ArrowRight'); await page.waitForTimeout(120);
        const v = await tipState(); await page.keyboard.press('Escape');
        step('Assess: "Burning area over time" value read with the arrows', !!v, `${curve.presses} Tabs; "${(v || '').slice(0, 90)}"`);
      } else step('Assess: "Burning area over time" chart reachable by Tab', false, `not reached in ${curve.presses} Tabs`);
    } else step('Assess: "Start from a worked example" reachable by Tab', false, `not reached in ${sel.presses} Tabs`);

    // ======== Part 2: tab sweep on every route ========
    if (arg('sweep') !== '0') {
      const routes = (arg('routes') || PAGES.map(p => p.id).join(',')).split(',').filter(Boolean);
      for (const id of routes) {
        await page.goto(`${base}index.html#/${id}`, { waitUntil: 'load' }); await page.reload({ waitUntil: 'load' }); await settle(page, id);
        await page.evaluate(() => { document.getElementById('view').focus(); });
        const res = { route: id, stops: 0, noRing: [], invisible: [], trap: null, left: false };
        let prev = null, same = 0;
        for (let i = 0; i < 700; i++) {
          await page.keyboard.press('Tab');
          const e = await page.evaluate(DESCRIBE);
          if (!e || !e.inView) { res.left = true; break; }
          res.stops++;
          const key = `${e.sel}|${e.name}|${e.top}`;
          if (key === prev) { if (++same >= 3) { res.trap = e.sel; break; } } else same = 0;
          prev = key;
          if (!e.ring) res.noRing.push(`${e.sel} "${e.name}"`);
          if (e.w === 0 || e.h === 0 || e.top < -5 || e.top > e.vh || e.left < -5 || e.left > e.vw) res.invisible.push(`${e.sel} "${e.name}" (${e.w}×${e.h} at ${e.left},${e.top})`);
        }
        const u = a => [...new Set(a)];
        res.noRing = u(res.noRing); res.invisible = u(res.invisible);
        sweep.push(res);
        console.log(`sweep ${id.padEnd(9)} ${String(res.stops).padStart(3)} stops${res.left ? '' : ' (did not leave #view)'}; no focus ring: ${res.noRing.length}; invisible: ${res.invisible.length}${res.trap ? '; TRAP at ' + res.trap : ''}`);
        for (const x of res.noRing.slice(0, 5)) console.log(`      no ring: ${x}`);
        for (const x of res.invisible.slice(0, 5)) console.log(`      invisible: ${x}`);
      }
    }
    await ctx.close();
  } finally { await cleanup(); }

  const failed = steps.filter(s => !s.ok);
  if (errors.length) { console.log(`\n${errors.length} console error(s):`); for (const e of [...new Set(errors)].slice(0, 10)) console.log('  ' + e); }
  console.log(`\nJourney: ${steps.length - failed.length}/${steps.length} steps passed.`);
  const jf = arg('json');
  if (jf) fs.writeFileSync(jf, JSON.stringify({ tool: 'site/tools/keyboard.mjs', base, when: new Date().toISOString(), steps, sweep, errors: [...new Set(errors)] }, null, 1));
  process.exit(failed.length ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(2); });

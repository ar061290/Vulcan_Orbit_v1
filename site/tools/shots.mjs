#!/usr/bin/env node
// site/tools/shots.mjs: phase 7 screenshots and visual checks (package P7-B, site/REBUILD_PLAN.md §4 and §7 item 23).
//
// What it does, in one run (each part can be picked with --only):
//   shots   every page at 1440 px and 390 px wide, Day and Night, full page, into site/shots/{page}-{1440|390}-{day|night}.png;
//           on each one: console errors and warnings, failed requests, sideways scroll, elements spilling out of the page
//           or out of their card, broken charts (empty or NaN marks, zero-size canvases), stray "NaN"/"undefined"/"null"
//           text, cards without a status stamp, "This page failed to load".
//   layout  spec D5.11: no sideways scroll outside `.scroll` regions at 320 px and at 200 % zoom, for all 3 text sizes.
//           200 % zoom of a 1280 px window is emulated as a 640 CSS px viewport at deviceScaleFactor 2 (the layout a browser
//           gives at 200 %). Every <details> on the page is opened first, so folded figures are checked too.
//   calm    Calm motion stops all motion: running CSS/Web animations, requestAnimationFrame loops, short setInterval
//           timers, and two pixel captures 1.2 s apart (top of page and every canvas/clock) must be identical.
//   flash   spec D5.10: with motion Full and every player started, frames are sampled from the screen and checked
//           against the WCAG 2.2 general flash rule (more than 3 flashes in any 1 s, on any ~150 px tile).
//   nogl    Chromium launched with --disable-gpu --disable-webgl: WebGL 2 must be unavailable, every illustration must
//           show its fallback sentence, and no page may log an error.
//
// Usage (from the repo root; playwright-core is NOT a repo dependency, point --pw at a folder that has it installed):
//   node site/tools/shots.mjs --pw <dir-with-node_modules> [--base http://127.0.0.1:8123/] [--only shots,layout,calm,flash,nogl]
//        [--pages overview,assess] [--out site/shots] [--report out.json] [--nogl-out dir] [--exe chromium-binary]
//        [--thermals thermals.csv]
// If chrome-headless-shell fails with "libnspr4.so: cannot open shared object file", export LD_LIBRARY_PATH to a folder
// holding the NSS/NSPR libraries before running (on the team machine: ~/.local/chromium-libs/root/usr/lib/x86_64-linux-gnu).
// With no --base it serves the repo itself (python3 -m http.server on a free port 8100-8199) and stops it on exit.
// --thermals: a CSV with columns cpu_package_c and gpu_c (newest row last); the run pauses between pages while CPU >= 92 °C
// or GPU >= 85 °C and resumes once CPU < 87 °C and GPU < 80 °C (the owner's caps). Exit code 0 = every check passed.

import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import zlib from 'node:zlib';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const argv = process.argv.slice(2);
const opt = {};
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (!a.startsWith('--')) continue;
  const k = a.slice(2), v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
  opt[k] = v;
}
const ONLY = new Set((opt.only || 'shots,layout,calm,flash,nogl').split(','));
const OUT = path.resolve(ROOT, opt.out || 'site/shots');
const CPU_CAP = 92, GPU_CAP = 85, CPU_OK = 87, GPU_OK = 80;     // owner's caps, °C
const wait = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log(...a);

// ---------- pages: read from the frozen registry (js/site.js), without importing it ----------
const PAGE_IDS = [...fs.readFileSync(path.join(ROOT, 'js/site.js'), 'utf8').matchAll(/\{\s*id:\s*'([a-z0-9-]+)'/g)].map(m => m[1]);
const PAGES = opt.pages ? opt.pages.split(',').filter(p => PAGE_IDS.includes(p)) : PAGE_IDS;

// ---------- Playwright (outside the repo) ----------
function loadPlaywright() {
  const dirs = [opt.pw, process.env.PLAYWRIGHT_DIR, process.cwd(), ROOT].filter(Boolean);
  for (const d of dirs) for (const name of ['playwright-core', 'playwright']) {
    try { return createRequire(path.join(path.resolve(d), 'noop.js'))(name); } catch { /* try the next */ }
  }
  throw new Error('playwright-core not found: pass --pw <folder whose node_modules has playwright-core> (never a repo dependency)');
}
function findChromium() {
  if (opt.exe) return opt.exe;
  const base = path.join(os.homedir(), '.cache/ms-playwright');
  let names = [];
  try { names = fs.readdirSync(base).sort().reverse(); } catch { return undefined; }
  for (const n of names) {
    for (const rel of ['chrome-headless-shell-linux64/chrome-headless-shell', 'chrome-linux/chrome', 'chrome-linux64/chrome']) {
      const p = path.join(base, n, rel);
      if (n.startsWith('chromium') && fs.existsSync(p)) return p;
    }
  }
  return undefined;
}

// ---------- local server ----------
let server = null;
const portFree = port => new Promise(res => {
  const s = net.createServer(); s.once('error', () => res(false));
  s.listen(port, '127.0.0.1', () => s.close(() => res(true)));
});
async function serve() {
  for (let port = 8100; port <= 8199; port++) {
    if (!(await portFree(port))) continue;
    server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
    const base = `http://127.0.0.1:${port}/`;
    for (let i = 0; i < 50; i++) {
      try { const r = await fetch(base + 'index.html'); if (r.ok) return base; } catch { /* not up yet */ }
      await wait(100);
    }
    stopServer(); throw new Error(`http.server did not start on ${port}`);
  }
  throw new Error('no free port in 8100-8199');
}
function stopServer() { if (server && server.exitCode === null) { try { server.kill('SIGTERM'); } catch { /* gone */ } } server = null; }
process.on('exit', stopServer);
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { stopServer(); process.exit(130); });

// ---------- thermal guard ----------
function readTemps() {
  if (!opt.thermals) return null;
  try {
    const lines = fs.readFileSync(opt.thermals, 'utf8').trim().split('\n');
    const head = lines[0].split(','), last = lines[lines.length - 1].split(',');
    const at = k => { const i = head.indexOf(k); return i < 0 ? NaN : parseFloat(last[i]); };
    const t = Date.parse(last[0]);
    if (Number.isFinite(t) && Date.now() - t > 60000) return null;   // stale log: no reading
    return { cpu: at('cpu_package_c'), gpu: at('gpu_c') };
  } catch { return null; }
}
let thermalPauses = 0;
async function thermalGuard() {
  let t = readTemps();
  if (!t || !((t.cpu >= CPU_CAP) || (t.gpu >= GPU_CAP))) return;
  thermalPauses++;
  log(`  thermal pause: CPU ${t.cpu} °C, GPU ${t.gpu} °C (caps ${CPU_CAP}/${GPU_CAP})`);
  for (let i = 0; i < 120; i++) {                 // at most 10 minutes
    await wait(5000); t = readTemps();
    if (!t || (t.cpu < CPU_OK && t.gpu < GPU_OK)) { log(`  resumed: CPU ${t?.cpu} °C, GPU ${t?.gpu} °C`); return; }
  }
  log('  still hot after 10 min, continuing slowly');
}

// ---------- PNG decode (no dependencies; Chromium writes 8-bit RGB/RGBA, not interlaced) ----------
function decodePNG(buf) {
  let p = 8, w = 0, hgt = 0, ct = 0, bd = 0; const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8), data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); hgt = data.readUInt32BE(4); bd = data[8]; ct = data[9]; if (data[12]) throw new Error('interlaced PNG'); }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  if (bd !== 8 || (ct !== 6 && ct !== 2)) throw new Error(`unsupported PNG (bit depth ${bd}, colour type ${ct})`);
  const bpp = ct === 6 ? 4 : 3, stride = w * bpp, raw = zlib.inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(hgt * stride);
  for (let y = 0; y < hgt; y++) {
    const f = raw[y * (stride + 1)], src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)), row = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[row + x - bpp] : 0, b = y ? out[row - stride + x] : 0, c = (x >= bpp && y) ? out[row - stride + x - bpp] : 0;
      let v = src[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); }
      out[row + x] = v & 255;
    }
  }
  return { w, h: hgt, bpp, px: out };
}
const LIN = Float64Array.from({ length: 256 }, (_, i) => { const c = i / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
function tileLuminance(img, tile) {          // mean relative luminance per tile (WCAG 2.2 definition)
  const nx = Math.max(1, Math.floor(img.w / tile)), ny = Math.max(1, Math.floor(img.h / tile)), L = new Float64Array(nx * ny), n = new Float64Array(nx * ny);
  for (let y = 0; y < ny * tile; y++) for (let x = 0; x < nx * tile; x++) {
    const i = (y * img.w + x) * img.bpp, k = Math.floor(y / tile) * nx + Math.floor(x / tile);
    L[k] += 0.2126 * LIN[img.px[i]] + 0.7152 * LIN[img.px[i + 1]] + 0.0722 * LIN[img.px[i + 2]]; n[k]++;
  }
  return { nx, ny, L: L.map((v, k) => v / n[k]) };
}
// WCAG general flash: a flash is a pair of opposing changes of >= 0.10 relative luminance where the darker state is < 0.80.
function maxFlashesPerSecond(series, times) {
  const tr = []; let dir = 0, peak = series[0];
  for (let i = 1; i < series.length; i++) {
    const v = series[i];
    if (dir === 0) { if (Math.abs(v - peak) >= 0.1 && Math.min(v, peak) < 0.8) { dir = Math.sign(v - peak); tr.push(times[i]); } peak = dir ? v : peak; }
    else if (dir === 1) { if (v > peak) peak = v; else if (peak - v >= 0.1 && v < 0.8) { tr.push(times[i]); dir = -1; peak = v; } }
    else { if (v < peak) peak = v; else if (v - peak >= 0.1 && peak < 0.8) { tr.push(times[i]); dir = 1; peak = v; } }
  }
  let best = 0;
  for (let i = 0, j = 0; i < tr.length; i++) { while (tr[i] - tr[j] > 1000) j++; best = Math.max(best, i - j + 1); }
  return Math.floor(best / 2);
}

// ---------- in-page instrumentation (runs before the site's own scripts) ----------
function instrument(prefs) {
  try { for (const [k, v] of Object.entries(prefs)) localStorage.setItem('vo.' + k, v); } catch { /* blocked storage */ }
  const vo = window.__vo = { raf: 0, rafBy: {}, intervals: new Map(), gl: 0, samples: null, nk: 0 };
  // flash check: right after each animation callback has drawn, copy every on-screen canvas into a tiny 2D canvas
  // (one 4×4 block per ~150 CSS px tile) and keep the mean relative luminance of each tile. Reading in the same task as
  // the draw is what makes WebGL canvases (preserveDrawingBuffer false) readable.
  const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const sample = () => {
    const now = performance.now();
    for (const c of document.querySelectorAll('canvas')) {
      const r = c.getBoundingClientRect();
      if (r.width < 20 || r.height < 20 || c.hidden || r.bottom < 0 || r.top > innerHeight || !c.width || !c.height) continue;
      const key = c.__voKey || (c.__voKey = `${c.id ? '#' + c.id : ''}${c.className ? '.' + String(c.className).split(' ').join('.') : ''} in "${c.closest('.card')?.dataset.title || c.parentElement?.className || ''}" #${++vo.nk}`);
      const s = vo.samples[key] || (vo.samples[key] = { t: [], L: [], css: [Math.round(r.width), Math.round(r.height)], last: -99 });
      if (now - s.last < 8) continue;
      s.last = now;
      const nx = Math.max(1, Math.round(r.width / 150)), ny = Math.max(1, Math.round(r.height / 150));
      const off = vo.off || (vo.off = document.createElement('canvas')); off.width = nx * 4; off.height = ny * 4;
      const g = off.getContext('2d', { willReadFrequently: true }); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      // A WebGL canvas with preserveDrawingBuffer false reads back fully transparent once its frame has been presented
      // (for example when another module's animation callback runs before this canvas's own one in the next frame).
      // Such a read is not a frame the visitor sees, so it is skipped; any other read is composited over the page
      // background, as the screen shows it.
      g.clearRect(0, 0, off.width, off.height);
      try { g.drawImage(c, 0, 0, off.width, off.height); } catch { continue; }
      const d = g.getImageData(0, 0, off.width, off.height).data, L = new Array(nx * ny).fill(0);
      let alpha = 0; for (let i = 3; i < d.length; i += 4) alpha += d[i];
      if (!alpha) { vo.skipped = (vo.skipped || 0) + 1; continue; }
      const bg = vo.bg || (vo.bg = (getComputedStyle(document.body).backgroundColor.match(/[\d.]+/g) || [0, 0, 0]).slice(0, 3).map(Number));
      for (let y = 0; y < ny * 4; y++) for (let x = 0; x < nx * 4; x++) {
        const i = (y * off.width + x) * 4, a = d[i + 3] / 255, ch = k => lin(d[i + k] * a + bg[k] * (1 - a));
        L[(y >> 2) * nx + (x >> 2)] += (0.2126 * ch(0) + 0.7152 * ch(1) + 0.0722 * ch(2)) / 16;
      }
      s.t.push(now); s.L.push(L);
    }
  };
  const after = fn => function (...a) { try { return fn.apply(this, a); } finally { if (vo.samples) { try { sample(); } catch { /* never break the page */ } } } };
  const who = () => { const s = (new Error().stack || '').split('\n').slice(3).find(l => /\/js\//.test(l)) || ''; const m = s.match(/\/(js\/[^?:)]+)(?:\?[^:]*)?:(\d+)/); return m ? `${m[1]}:${m[2]}` : 'unknown'; };
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = cb => { vo.raf++; const w = who(); vo.rafBy[w] = (vo.rafBy[w] || 0) + 1; return raf(typeof cb === 'function' ? after(cb) : cb); };
  const si = window.setInterval.bind(window), ci = window.clearInterval.bind(window);
  window.setInterval = (fn, ms, ...a) => { const id = si(typeof fn === 'function' ? after(fn) : fn, ms, ...a); vo.intervals.set(id, { ms: ms || 0, by: who() }); return id; };
  window.clearInterval = id => { vo.intervals.delete(id); return ci(id); };
  const gc = HTMLCanvasElement.prototype.getContext;
  // WebGL contexts are asked to keep their drawing buffer, so the flash sampler always reads the frame on screen
  // (the picture is unchanged; without it a read after the frame is presented comes back blank and is skipped).
  HTMLCanvasElement.prototype.getContext = function (k, o) { if (/webgl/.test(k)) o = { ...(o || {}), preserveDrawingBuffer: true }; const c = gc.call(this, k, o); if (c && /webgl/.test(k)) vo.gl++; return c; };
}

// ---------- browser helpers ----------
let PW, EXE, BASE;
async function launch(args = []) { return PW.chromium.launch({ executablePath: EXE, args }); }
async function newPage(browser, { width, height = 900, dsf = 1, theme = 'day', size = '0', motion = 'full' }) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dsf, colorScheme: theme === 'night' ? 'dark' : 'light',
    reducedMotion: motion === 'calm' ? 'reduce' : 'no-preference' });
  await ctx.addInitScript(instrument, { theme, size, motion, terms: 'on', lang: 'en' });
  const page = await ctx.newPage();
  const S = { page, ctx, logs: [], inflight: 0, lastNet: Date.now() };
  const external = u => !u.startsWith(BASE);
  const ENV = /GL Driver Message|fallback to software WebGL|--enable-unsafe-swiftshader/;   // the headless GPU stack, not the site
  page.on('console', m => { const t = m.type(); if (t === 'error' || t === 'warning') S.logs.push({ kind: ENV.test(m.text()) ? 'env' : t, text: m.text().slice(0, 400), at: m.location()?.url?.replace(BASE, '') || '' }); });
  page.on('pageerror', e => S.logs.push({ kind: 'pageerror', text: String(e.stack || e.message).slice(0, 600) }));
  page.on('request', () => { S.inflight++; S.lastNet = Date.now(); });
  const done = () => { S.inflight = Math.max(0, S.inflight - 1); S.lastNet = Date.now(); };
  page.on('requestfinished', done);
  page.on('requestfailed', r => { done(); S.logs.push({ kind: external(r.url()) ? 'external-failed' : 'request-failed', text: `${r.url()} ${r.failure()?.errorText || ''}` }); });
  page.on('response', r => { if (r.status() >= 400) S.logs.push({ kind: external(r.url()) ? 'external-http' : 'http', text: `${r.status()} ${r.url().replace(BASE, '')}` }); });
  return S;
}
let nav = 0;
async function visit(S, id) {
  S.logs.length = 0;
  await S.page.goto(`${BASE}index.html?v=${++nav}#/${id}`, { waitUntil: 'load', timeout: 30000 });
  try { await S.page.waitForSelector(`#view[data-page="${id}"]`, { timeout: 25000 }); }
  catch { S.logs.push({ kind: 'timeout', text: `#view[data-page=${id}] not set within 25 s` }); }
  const t0 = Date.now();
  while (Date.now() - t0 < 15000 && (S.inflight > 0 || Date.now() - S.lastNet < 600)) await wait(100);
  try { await S.page.evaluate(() => document.fonts?.ready); } catch { /* fine */ }
  await wait(500);
}
async function openAllFolds(S) {
  await S.page.evaluate(() => { document.querySelectorAll('#view details').forEach(d => { d.open = true; }); dispatchEvent(new Event('resize')); });
  const t0 = Date.now();
  await wait(300);
  while (Date.now() - t0 < 8000 && (S.inflight > 0 || Date.now() - S.lastNet < 400)) await wait(100);
  await wait(400);
}

// Everything checked on a rendered page, in the page.
function inspectPage() {
  const vw = document.documentElement.clientWidth, se = document.scrollingElement;
  const desc = el => {
    let s = el.tagName.toLowerCase(); if (el.id) s += '#' + el.id;
    const c = [...el.classList].slice(0, 3).join('.'); if (c) s += '.' + c;
    const card = el.closest('.card'); const fig = card?.dataset.fignum ? `Figure ${card.dataset.fignum} "${card.dataset.title || ''}"` : (card ? `card "${card.dataset.title || ''}"` : '');
    const txt = (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60);
    return `${s}${fig ? ' in ' + fig : ''}${txt ? ` ("${txt}")` : ''}`;
  };
  const visible = el => { const r = el.getBoundingClientRect(); if (r.width <= 1 || r.height <= 1) return null; const cs = getComputedStyle(el); return cs.visibility === 'hidden' ? null : r; };
  // an element is "contained" when an ancestor below the boundary scrolls or clips sideways
  const containedBy = (el, stop) => {
    for (let a = el.parentElement; a && a !== stop && a !== document.body; a = a.parentElement) {
      const ox = getComputedStyle(a).overflowX; if (ox !== 'visible') return a;
    }
    return null;
  };
  const pageSpill = [], cardSpill = [];
  const all = document.body.querySelectorAll('*');
  for (const el of all) {
    if (el.closest('#tip, .sr, [hidden], svg') && el.tagName.toLowerCase() !== 'svg') continue;
    const r = visible(el); if (!r) continue;
    if (getComputedStyle(el).position === 'fixed') continue;
    if ((r.right > vw + 1 || r.left < -1) && !containedBy(el, null)) {
      const p = el.parentElement, pr = p && visible(p);
      if (!(pr && (pr.right > vw + 1 || pr.left < -1) && !containedBy(p, null))) pageSpill.push(`${desc(el)}: x ${Math.round(r.left)}–${Math.round(r.right)} px, viewport ${vw}`);
    }
    const card = el.parentElement?.closest('.card');
    const cr = card?.getBoundingClientRect();
    if (card && (r.right > cr.right + 2 || r.left < cr.left - 2) && !containedBy(el, card)) {
      {
        const p = el.parentElement, pr = p && p !== card && visible(p);
        const parentSpills = pr && (pr.right > cr.right + 2 || pr.left < cr.left - 2) && !containedBy(p, card);
        if (!parentSpills) cardSpill.push(`${desc(el)}: ${Math.round(Math.max(r.right - cr.right, cr.left - r.left))} px past the card edge`);
      }
    }
  }
  // text that runs out of its own box (a long unbreakable word: a path, a URL, a file name) has no element rect
  // past the edge, so text nodes are measured too
  const tw = document.createTreeWalker(document.getElementById('view') || document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = tw.nextNode());) {
    const p = n.parentElement; if (!p || !n.textContent.trim() || p.closest('#tip, .sr, [hidden], svg') || !visible(p)) continue;
    const rg = document.createRange(); rg.selectNodeContents(n);
    const rs = [...rg.getClientRects()]; if (!rs.length) continue;
    const right = Math.max(...rs.map(q => q.right)), left = Math.min(...rs.map(q => q.left));
    const word = (n.textContent.match(/\S{16,}/g) || []).sort((a, b) => b.length - a.length)[0];
    if ((right > vw + 1 || left < -1) && !containedBy(n, null)) pageSpill.push(`text in ${desc(p)}${word ? ` (long word "${word.slice(0, 50)}")` : ''}: x ${Math.round(left)}–${Math.round(right)} px, viewport ${vw}`);
    const card = p.closest('.card'), cr = card?.getBoundingClientRect();
    if (card && (right > cr.right + 2 || left < cr.left - 2) && !containedBy(n, card)) cardSpill.push(`text in ${desc(p)}${word ? ` (long word "${word.slice(0, 50)}")` : ''}: ${Math.round(Math.max(right - cr.right, cr.left - left))} px past the card edge`);
  }
  // scroll regions that are not .scroll (the spec allows sideways scroll only in table regions)
  const otherScroll = [...document.querySelectorAll('#view *')].filter(el => {
    if (el.classList.contains('scroll')) return false;
    const ox = getComputedStyle(el).overflowX; return (ox === 'auto' || ox === 'scroll') && el.scrollWidth > el.clientWidth + 1 && visible(el);
  }).map(el => `${desc(el)}: scrolls ${el.scrollWidth - el.clientWidth} px sideways`);
  // charts
  const broken = [];
  const inClosedFold = el => { for (let d = el.closest('details'); d; d = d.parentElement?.closest('details')) if (!d.open && !el.closest('summary')) return true; return false; };
  document.querySelectorAll('#view svg.chart').forEach(s => {
    if (inClosedFold(s)) return;
    const r = s.getBoundingClientRect(), marks = s.querySelectorAll('path,circle,rect,line,polyline,polygon,text').length;
    if (r.width < 2 || r.height < 2) broken.push(`${desc(s)}: zero size (${Math.round(r.width)}×${Math.round(r.height)})`);
    if (!marks) broken.push(`${desc(s)}: no marks`);
    const bad = [...s.querySelectorAll('*')].find(e => [...e.attributes].some(a => /NaN|Infinity|undefined/.test(a.value)));
    if (bad) broken.push(`${desc(s)}: attribute with NaN/Infinity/undefined on <${bad.tagName.toLowerCase()}>`);
  });
  document.querySelectorAll('#view canvas').forEach(c => {
    if (inClosedFold(c) || c.hidden || c.closest('[hidden]')) return;
    const r = c.getBoundingClientRect();
    if (!c.width || !c.height || r.width < 2 || r.height < 2) broken.push(`${desc(c)}: canvas has zero size (${c.width}×${c.height}, css ${Math.round(r.width)}×${Math.round(r.height)})`);
  });
  document.querySelectorAll('#view .chart-wrap').forEach(w => { if (!w.querySelector('svg, canvas') && !inClosedFold(w)) broken.push(`${desc(w)}: chart-wrap with no svg/canvas`); });
  const text = document.getElementById('view')?.innerText || '';
  const stray = [...text.matchAll(/(.{0,40})\b(NaN|undefined|null|\[object Object\])\b(.{0,40})/g)].slice(0, 10).map(m => m[0].replace(/\s+/g, ' ').trim());
  const cards = [...document.querySelectorAll('#view section.card')];
  const noStamp = cards.filter(c => !c.querySelector(':scope > h2 .badge, :scope > header .badge, .badge')).map(c => c.dataset.title || desc(c));
  return {
    vw, scrollWidth: se.scrollWidth, sideways: Math.max(0, se.scrollWidth - vw), height: se.scrollHeight,
    pageSpill: pageSpill.slice(0, 15), cardSpill: cardSpill.slice(0, 15), otherScroll: otherScroll.slice(0, 10), broken, stray,
    cards: cards.length, empties: document.querySelectorAll('#view .empty').length, noStamp,
    failed: /This page failed to load/.test(text), title: document.title,
  };
}

const R = { base: '', started: new Date().toISOString(), shots: [], layout: [], calm: [], flash: [], nogl: [], problems: [] };
const problem = (part, pageId, where, what) => R.problems.push({ part, page: pageId, where, what });
const SITE_LOG = l => ['error', 'pageerror', 'http', 'request-failed', 'timeout'].includes(l.kind);
function reportLogs(part, id, where, logs) {
  for (const l of logs) {
    if (SITE_LOG(l)) problem(part, id, where, `${l.kind}: ${l.text}${l.at ? ' @ ' + l.at : ''}`);
  }
}
function reportInspect(part, id, where, ins) {
  if (ins.failed) problem(part, id, where, 'page shows "This page failed to load"');
  if (ins.sideways) problem(part, id, where, `sideways scroll ${ins.sideways} px (scrollWidth ${ins.scrollWidth}, viewport ${ins.vw})`);
  ins.pageSpill.forEach(s => problem(part, id, where, 'spills out of the page: ' + s));
  ins.cardSpill.forEach(s => problem(part, id, where, 'spills out of its card: ' + s));
  ins.otherScroll.forEach(s => problem(part, id, where, 'sideways scroll region that is not .scroll: ' + s));
  ins.broken.forEach(s => problem(part, id, where, 'broken chart: ' + s));
  ins.stray.forEach(s => problem(part, id, where, `stray text: "${s}"`));
  ins.noStamp.forEach(s => problem(part, id, where, `card without a status stamp: ${s}`));
}

// ---------- parts ----------
async function partShots(browser) {
  fs.mkdirSync(OUT, { recursive: true });
  for (const theme of ['day', 'night']) for (const width of [1440, 390]) {
    const S = await newPage(browser, { width, height: width > 800 ? 900 : 844, theme, motion: 'full' });
    for (const id of PAGES) {
      await thermalGuard();
      const where = `${width} px ${theme}`;
      await visit(S, id);
      const ins = await S.page.evaluate(inspectPage);
      const file = path.join(OUT, `${id}-${width}-${theme}.png`);
      let shotErr = null;
      try { await S.page.screenshot({ path: file, fullPage: true, animations: 'disabled', caret: 'hide', timeout: 60000 }); }
      catch (e) { shotErr = String(e.message).split('\n')[0]; problem('shots', id, where, 'screenshot failed: ' + shotErr); }
      reportLogs('shots', id, where, S.logs); reportInspect('shots', id, where, ins);
      const warnings = S.logs.filter(l => l.kind === 'warning').map(l => l.text);
      R.shots.push({ page: id, width, theme, file: path.relative(ROOT, file), height: ins.height, cards: ins.cards, empties: ins.empties,
        errors: S.logs.filter(SITE_LOG).length, warnings, external: S.logs.filter(l => l.kind.startsWith('external')).length, shotErr });
      log(`shots  ${id.padEnd(9)} ${String(width).padStart(4)} ${theme.padEnd(5)} h=${ins.height} cards=${ins.cards} empty=${ins.empties} err=${S.logs.filter(SITE_LOG).length} warn=${warnings.length} sideways=${ins.sideways}`);
    }
    await S.ctx.close();
  }
}

async function partLayout(browser) {
  const configs = [{ name: '320 px', width: 320, height: 800, dsf: 1 }, { name: '200% zoom (640 CSS px @2x)', width: 640, height: 450, dsf: 2 }];
  for (const c of configs) for (const size of ['0', '1', '2']) {
    const S = await newPage(browser, { width: c.width, height: c.height, dsf: c.dsf, theme: 'day', size, motion: 'calm' });
    for (const id of PAGES) {
      await thermalGuard();
      const where = `${c.name}, text size ${['A', 'A+', 'A++'][+size]}, folds open`;
      await visit(S, id); await openAllFolds(S);
      const ins = await S.page.evaluate(inspectPage);
      const issues = [ins.sideways ? `sideways ${ins.sideways} px` : '', ins.pageSpill.length ? `${ins.pageSpill.length} spill` : '',
        ins.otherScroll.length ? `${ins.otherScroll.length} non-.scroll scrollers` : ''].filter(Boolean);
      // layout part reports page-level problems only (card spills at narrow widths are reported by the shots part too)
      if (ins.sideways) problem('layout', id, where, `sideways scroll ${ins.sideways} px (scrollWidth ${ins.scrollWidth}, viewport ${ins.vw})`);
      ins.pageSpill.forEach(s => problem('layout', id, where, 'spills out of the page: ' + s));
      ins.otherScroll.forEach(s => problem('layout', id, where, 'sideways scroll region that is not .scroll: ' + s));
      ins.cardSpill.forEach(s => problem('layout', id, where, 'spills out of its card: ' + s));
      reportLogs('layout', id, where, S.logs);
      R.layout.push({ page: id, config: c.name, size, sideways: ins.sideways, pageSpill: ins.pageSpill.length, cardSpill: ins.cardSpill.length, otherScroll: ins.otherScroll.length });
      log(`layout ${id.padEnd(9)} ${c.name.padEnd(27)} size ${size}  ${issues.join(', ') || 'ok'}${ins.cardSpill.length ? ` (card spill ${ins.cardSpill.length})` : ''}`);
    }
    await S.ctx.close();
  }
}

// viewport scroll positions to sample: the top of the page plus every canvas and clock, centred
async function motionSpots(page) {
  return page.evaluate(() => {
    const els = [...document.querySelectorAll('#view canvas, #view .tick, #view .phead svg')].filter(e => !e.closest('[hidden]') && !(e.closest('details') && !e.closest('details').open) && e.getBoundingClientRect().height > 2);
    const ys = [0], H = innerHeight;
    for (const e of els) { const r = e.getBoundingClientRect(); const y = Math.max(0, Math.round(r.top + scrollY + r.height / 2 - H / 2)); if (ys.every(v => Math.abs(v - y) > H * 0.5)) ys.push(y); }
    return ys.slice(0, 8);
  });
}
async function viewportPNG(S, cdp, scale) {
  const vp = S.page.viewportSize();
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true,
    clip: { x: await S.page.evaluate(() => scrollX), y: await S.page.evaluate(() => scrollY), width: vp.width, height: vp.height, scale } });
  return Buffer.from(data, 'base64');
}

async function partCalm(browser) {
  const S = await newPage(browser, { width: 1440, height: 900, theme: 'night', motion: 'calm' });
  const cdp = await S.ctx.newCDPSession(S.page);
  for (const id of PAGES) {
    await thermalGuard();
    const where = 'Calm, 1440 px night';
    await visit(S, id);
    await S.page.evaluate(() => { window.__vo.raf = 0; window.__vo.rafBy = {}; });
    await wait(1500);
    const st = await S.page.evaluate(() => ({
      motion: document.documentElement.dataset.motion, raf: window.__vo.raf, rafBy: window.__vo.rafBy,
      anims: document.getAnimations().filter(a => a.playState === 'running').map(a => `${a.animationName || a.transitionProperty || a.constructor.name} on ${a.effect?.target?.tagName?.toLowerCase()}.${[...(a.effect?.target?.classList || [])].join('.')}`).slice(0, 10),
      intervals: [...window.__vo.intervals.values()].filter(v => v.ms < 1000).map(v => `${v.ms} ms from ${v.by}`),
      bg: (() => { const c = document.getElementById('bg'); return c ? { hidden: c.hidden || getComputedStyle(c).display === 'none' } : null; })(),
    }));
    const moved = [];
    for (const y of await motionSpots(S.page)) {
      await S.page.evaluate(v => scrollTo(0, v), y); await wait(400);
      const a = await viewportPNG(S, cdp, 0.5); await wait(1200); const b = await viewportPNG(S, cdp, 0.5);
      if (!a.equals(b)) {
        const A = decodePNG(a), B = decodePNG(b); let diff = 0;
        for (let i = 0; i < A.px.length; i += A.bpp) if (Math.abs(A.px[i] - B.px[i]) + Math.abs(A.px[i + 1] - B.px[i + 1]) + Math.abs(A.px[i + 2] - B.px[i + 2]) > 6) diff++;
        if (diff > 4) moved.push(`scrollY ${y}: ${diff} of ${A.w * A.h} sampled pixels changed in 1.2 s`);
      }
    }
    if (st.motion !== 'calm') problem('calm', id, where, `html[data-motion] is "${st.motion}", not "calm"`);
    if (st.raf > 3) problem('calm', id, where, `requestAnimationFrame called ${st.raf} times in 1.5 s: ${Object.entries(st.rafBy).map(([k, v]) => `${k} ×${v}`).join(', ')}`);
    st.anims.forEach(a => problem('calm', id, where, 'running animation: ' + a));
    st.intervals.forEach(a => problem('calm', id, where, 'short setInterval still active: ' + a));
    if (st.bg && !st.bg.hidden) problem('calm', id, where, 'background canvas #bg is shown in Calm');
    moved.forEach(m => problem('calm', id, where, 'pixels moved: ' + m));
    reportLogs('calm', id, where, S.logs);
    R.calm.push({ page: id, raf: st.raf, anims: st.anims.length, intervals: st.intervals.length, moved: moved.length });
    log(`calm   ${id.padEnd(9)} raf=${st.raf} anims=${st.anims.length} intervals=${st.intervals.length} moved=${moved.length}`);
  }
  await S.ctx.close();
}

async function partFlash(browser) {
  const S = await newPage(browser, { width: 1440, height: 900, theme: 'night', motion: 'full' });
  const cdp = await S.ctx.newCDPSession(S.page);
  const SCALE = 0.25, TILE = Math.round(150 * SCALE);    // ~150 CSS px tiles, near the WCAG small-area limit (25 % of 341×256)
  for (const id of PAGES) {
    await thermalGuard();
    await visit(S, id);
    const started = await S.page.evaluate(() => {
      const b = [...document.querySelectorAll('#view button')].filter(x => /^(▶\s*)?Play( from 0 s)?$/.test(x.textContent.trim()) && !x.closest('[hidden]') && !(x.closest('details') && !x.closest('details').open));
      b.forEach(x => x.click()); return b.map(x => x.closest('.card')?.dataset.title || x.className);
    });
    const spots = await motionSpots(S.page), regions = [], canvases = [];
    for (const y of spots) {
      await S.page.evaluate(v => scrollTo(0, v), y); await wait(300);
      // 1) canvases, sampled in the page on every frame they draw (no screenshots meanwhile, so the page runs at its own pace)
      await S.page.evaluate(() => { window.__vo.samples = {}; window.__vo.bg = null; window.__vo.skipped = 0; });
      await wait(2500);
      const { cs, skipped } = await S.page.evaluate(() => { const s = window.__vo.samples; window.__vo.samples = null; return { cs: s, skipped: window.__vo.skipped || 0 }; });
      for (const [key, s] of Object.entries(cs)) {
        if (s.t.length < 3) continue;
        const fps = (s.t.length - 1) / ((s.t[s.t.length - 1] - s.t[0]) / 1000 || 1);
        let worst = 0, tile = null;
        for (let k = 0; k < s.L[0].length; k++) { const f = maxFlashesPerSecond(s.L.map(v => v[k]), s.t); if (f > worst) { worst = f; tile = k; } }
        const prev = canvases.find(c => c.canvas === key);
        if (!prev || prev.maxFlashes < worst) { if (prev) canvases.splice(canvases.indexOf(prev), 1); canvases.push({ canvas: key, frames: s.t.length, fps: +fps.toFixed(1), maxFlashes: worst, css: s.css }); }
        if (worst > 3) problem('flash', id, `motion Full, 1440 px night, scrollY ${y}`, `canvas ${key}: ${worst} flashes in 1 s on tile ${tile}`);
      }
      // 2) the whole viewport from screen captures (CSS and SVG motion as well as canvases)
      const frames = [], times = [], t0 = Date.now();
      while (Date.now() - t0 < 2500) { const buf = await viewportPNG(S, cdp, SCALE); times.push(Date.now() - t0); frames.push(tileLuminance(decodePNG(buf), TILE)); }
      const fps = frames.length / ((times[times.length - 1] - times[0]) / 1000 || 1);
      let worst = 0, at = null;
      const { nx, ny } = frames[0];
      for (let k = 0; k < nx * ny; k++) {
        const f = maxFlashesPerSecond(frames.map(fr => fr.L[k] ?? 0), times);
        if (f > worst) { worst = f; at = { col: k % nx, row: Math.floor(k / nx) }; }
      }
      regions.push({ scrollY: y, frames: frames.length, fps: +fps.toFixed(1), maxFlashes: worst, tile: at, clearedCanvasReadsSkipped: skipped });
      if (worst > 3) problem('flash', id, `motion Full, 1440 px night, scrollY ${y}`, `${worst} flashes in 1 s on the ${TILE / SCALE} px tile at column ${at.col}, row ${at.row} of the viewport`);
    }
    reportLogs('flash', id, 'motion Full, 1440 px night, players started', S.logs);
    R.flash.push({ page: id, players: started, regions, canvases });
    log(`flash  ${id.padEnd(9)} players=${started.length} screen ` + regions.map(r => `y${r.scrollY}:${r.maxFlashes}@${r.fps}fps`).join(' ') + ` (cleared GL reads skipped: ${regions.reduce((a, r) => a + r.clearedCanvasReadsSkipped, 0)})`
      + ' | canvases ' + (canvases.map(c => `${c.maxFlashes}@${c.fps}fps ${c.css.join('×')}`).join(', ') || 'none drawing'));
  }
  await S.ctx.close();
}

async function partNoGL() {
  const browser = await launch(['--disable-gpu', '--disable-webgl']);
  const dir = opt['nogl-out'] ? path.resolve(opt['nogl-out']) : null;
  if (dir) fs.mkdirSync(dir, { recursive: true });
  try {
    const S = await newPage(browser, { width: 1440, height: 900, theme: 'day', motion: 'full' });
    for (const id of PAGES) {
      await thermalGuard();
      const where = '--disable-gpu --disable-webgl, 1440 px day';
      await visit(S, id);
      const st = await S.page.evaluate(() => {
        const gl2 = (() => { try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; } })();
        const ill = [...document.querySelectorAll('#view .phead > *:first-child, #view .banner-gl, #view .hero-gl, #view .cab3d')]
          .filter((e, i, a) => a.indexOf(e) === i);
        // the fallback sentences (gl_hero, gl_banner, fig_cabin3d; Home prints the hero's in its own caption) all name WebGL
        const fb = [...(document.getElementById('view')?.innerText || '').matchAll(/[^.\n]*\bWebGL\b[^.\n]*\.?/g)].map(m => m[0].trim().slice(0, 120));
        const wrappers = document.querySelectorAll('#view .hero-gl, #view .banner-gl, #view .cab3d').length;
        const liveGL = [...document.querySelectorAll('#view canvas')].filter(c => !c.hidden && !c.closest('[hidden]') && c.getBoundingClientRect().height > 2 && c.dataset.kind !== '2d').length;
        return { gl2, illustrations: ill.length, wrappers, fallbacks: fb, glContexts: window.__vo.gl, liveCanvases: liveGL,
          phead: !!document.querySelector('#view .phead'), pheadSvg: !!document.querySelector('#view .phead svg') };
      });
      const ins = await S.page.evaluate(inspectPage);
      if (st.gl2) problem('nogl', id, where, 'WebGL 2 is still available with these flags');
      if ((st.phead || st.wrappers) && !st.fallbacks.length) problem('nogl', id, where, `${st.wrappers} WebGL illustration(s) but no fallback sentence on the page`);
      if (st.phead && !st.pheadSvg) problem('nogl', id, where, 'page header has no static drawing');
      reportLogs('nogl', id, where, S.logs);
      ins.broken.forEach(s => problem('nogl', id, where, 'broken chart: ' + s));
      if (ins.failed) problem('nogl', id, where, 'page shows "This page failed to load"');
      if (dir) await S.page.screenshot({ path: path.join(dir, `${id}-nogl.png`), animations: 'disabled' });
      R.nogl.push({ page: id, ...st, errors: S.logs.filter(SITE_LOG).length });
      log(`nogl   ${id.padEnd(9)} webgl2=${st.gl2} fallbacks=${st.fallbacks.length} err=${S.logs.filter(SITE_LOG).length}`);
    }
    await S.ctx.close();
  } finally { await browser.close(); }
}

// ---------- main ----------
async function main() {
  PW = loadPlaywright(); EXE = findChromium();
  BASE = opt.base ? (opt.base.endsWith('/') ? opt.base : opt.base + '/') : await serve();
  R.base = BASE; R.pages = PAGES; R.executable = EXE || '(playwright default)';
  log(`Vulcan Orbit shots: ${PAGES.length} pages at ${BASE}; parts: ${[...ONLY].join(', ')}`);
  const parts = ['shots', 'layout', 'calm', 'flash'].filter(p => ONLY.has(p));
  if (parts.length) {
    const browser = await launch(['--enable-unsafe-swiftshader']);   // WebGL 2 on through SwiftShader (no GPU in headless)
    try {
      for (const p of parts) { await ({ shots: partShots, layout: partLayout, calm: partCalm, flash: partFlash })[p](browser); }
    } finally { await browser.close(); }
  }
  if (ONLY.has('nogl')) await partNoGL();
  R.finished = new Date().toISOString(); R.thermalPauses = thermalPauses;
  const byPart = {};
  for (const p of R.problems) byPart[p.part] = (byPart[p.part] || 0) + 1;
  R.summary = byPart;
  if (opt.report) fs.writeFileSync(path.resolve(opt.report), JSON.stringify(R, null, 1));
  log(`\nProblems: ${R.problems.length} ${JSON.stringify(byPart)}${thermalPauses ? `; thermal pauses ${thermalPauses}` : ''}`);
  // print each distinct problem once, with the places it was seen
  const seen = new Map();
  for (const p of R.problems) { const k = `${p.part} | ${p.page} | ${p.what}`; if (!seen.has(k)) seen.set(k, []); seen.get(k).push(p.where); }
  for (const [k, w] of seen) log(`- ${k}  [${[...new Set(w)].join('; ')}]`);
  stopServer();
  return R.problems.length ? 1 : 0;
}

main().then(code => process.exit(code), e => { console.error(e); stopServer(); process.exit(2); });

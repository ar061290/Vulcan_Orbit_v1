// Home (#/overview), v3: a story a judge can follow in about 30 seconds of scrolling (site/DECISIONS.md, v3 Home).
// Seven sections, each with its own layout: 1 the hook (WebGL flame, turned by scroll), 2 the finding (giant numerals and the
// ticking clock), 3 why it happens (smoke drift loop + gravity illustration), 4 our answer (camera → growth → risk, live),
// 5 why you can trust it, 6 why it matters here (India card, the exploration-cabin gap, mission check), 7 explore.
// Every number is read from data/*.json at run time through the same functions the other pages use:
//  - alarm times: facts.detectFacts (saffire_latency, saffire_gas) and clock.ticking;
//  - drift: data/drift.json frames; catch share: data/whatif.json layouts[1] ("At the air return"), caught_120, as Predict it;
//  - the live demo: data/cv_example.json + growth_examples preset → assess_core.computeAssessment (the Assess code path),
//    risk from data/risk_rules.json through riskLevel; number format sig(v, 4) as on Assess;
//  - checks: overlays.evidenceRows + fig_checks.checkCounts (as Checks' short answer); models meeting their rule: trust.json;
//  - NASA datasets: data/investigations.json (name + PSI id + DOI, as Sources);
//  - cabin gap: data/gaps.json probes (as mission.js).
// Kept from v2 (site/PARITY.md, site/PLAN_COVERAGE.md): the In orbit / On Earth toggle, the 1-minute tour, "Start with the
// fire", "How we checked it", the three questions with their stamps, the short answer with its English/తెలుగు/हिन्दी switch,
// the stamp legend ("How to read this site"), the pipeline steps' stamps and links ("From camera to risk"), the mission
// check, the coverage line and the India card. The ticking clock keeps class .tick (tour stop 1).
// Effects (js/fx/*) are loaded on their own with dynamic import, so a failure there never stops the page.
import { h, add, load, loadPath, badge, card, empty, isMissing, calm, sig, fmt, pct, announce } from '../lib.js';
import { loadI18n, langSwitch, draftNote, shortLines, tr, currentLang } from '../i18n.js';
import { annotate } from '../glossary.js';
import { hero } from '../gl_hero.js';
import { ticking } from '../clock.js';
import { tourButton } from '../tour.js';
import { missionCheck, coverageLine } from '../mission.js';
import { detectFacts } from '../facts.js';
import { figLink } from '../passes.js';
import { pageById, GROUPS } from '../site.js';
import { SCRAPPED, evidenceRows, E4_SOURCE } from '../overlays.js';
import { loadAssessData, computeAssessment } from '../assess_core.js';
import { stopGrowth } from '../growth_run.js';
import { checkCounts } from '../fig_checks.js';
import { driftOK, decoder, driftSummary } from '../fig_drift.js';
import { lineChart, SERIES, DASH } from '../charts.js';
import * as store from '../store.js';

const n4 = v => sig(v, 4);                       // the Assess number format (js/fig_assess.js n4)
const isNum = v => typeof v === 'number' && Number.isFinite(v);
const fxImport = (path, fn) => import(path).then(fn).catch(e => console.warn(`${path}: effect not started`, e));

/** A real link that plays the star journey first (plain left clicks only; Calm/effects off navigate at once). */
function warpLink(attrs, ...kids) {
  const a = h('a', attrs, ...kids);
  a.addEventListener('click', e => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const href = a.getAttribute('href'); if (!href) return;
    e.preventDefault();
    import('../fx/warp.js').then(m => m.warpTo(href)).catch(() => { location.hash = href; });
  });
  return a;
}

export default async function render(root, ctx = {}) {
  const [man, india, lat, gas, gaps, i18n, drift, whatif, inv, trust] = await Promise.all([
    load('manifest'), load('india'), load('saffire_latency'), load('saffire_gas'), load('gaps'), loadI18n(),
    load('drift'), load('whatif'), load('investigations'), load('trust')]);
  const st = n => (Array.isArray(man.files) ? man.files : []).find(f => f.name === n)?.status || 'missing';
  const facts = detectFacts(lat, gas);
  const H = hero({ g: 0, fit: 'center', ctx });

  const sections = [
    hookSection(H, facts, lat),
    findingSection(facts, lat, gas, ctx),
    whySection(drift, whatif, ctx),
    answerSection(st, ctx),
    await trustSection(trust, inv),
    hereSection(india, gaps, i18n, ctx),
    exploreSection(st, facts, lat, gas, i18n, ctx),
  ];
  // the fire trail lives in a viewport-sized layer that sticks while the story scrolls (not a canvas as tall as the page)
  const fxLayer = h('div', { class: 'home-fx', 'aria-hidden': 'true' });
  const pg = h('div', { class: 'page home' }, fxLayer, sections);
  root.append(pg);

  if (ctx.detached || typeof ctx.onMount !== 'function') return;
  const offs = [];
  ctx.onMount(() => {
    // gentle reveal: each section fades up once as it enters; Calm (or no observer) shows everything at once
    if ('IntersectionObserver' in window && !calm()) {
      pg.classList.add('rv');
      const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -10% 0px' });
      pg.querySelectorAll('.hs').forEach(x => io.observe(x));
      offs.push(() => io.disconnect());
    }
    offs.push(scrollLink(pg, H));
    // effects: the fire trail under the whole story, the ember noise behind the finding and the closing call to action
    const fx = [];
    fxImport('../fx/fluid.js', m => fx.push(m.fluidTrail(fxLayer)));
    // the finding keeps its glow low (small text over it); the closing band, with one large line, may glow more
    pg.querySelectorAll('.hs-noise').forEach(x => fxImport('../fx/noise.js', m => fx.push(m.noiseField(x, { strength: x.classList.contains('fd') ? .55 : .85 }))));
    const gravHost = pg.querySelector('.why-grav');
    if (gravHost) fxImport('../fx/gravity.js', m => { const f = m.gravityPoints(); fx.push({ destroy: () => f.remove() }); gravHost.replaceChildren(f); });
    offs.push(() => fx.forEach(f => { try { f.destroy?.(); } catch (e) { console.error(e); } }));
  });
  ctx.onLeave?.(() => { offs.splice(0).forEach(f => { try { f(); } catch (e) { console.error(e); } }); });
}

// ---------- scroll link: the flame drifts and turns as the hero scrolls away (never takes over the wheel) ----------
function scrollLink(pg, H) {
  const hk = pg.querySelector('.hk'), fl = pg.querySelector('.hk-flame'), bar = document.querySelector('.top');
  let raf = 0;
  const apply = () => {
    raf = 0;
    const hh = hk?.offsetHeight || innerHeight, f = Math.max(0, Math.min(1, scrollY / hh));
    bar?.classList.toggle('scrolled', scrollY > hh - 80);
    // reveal backstop: anything already scrolled into view is shown, even if the observer missed it
    if (pg.classList.contains('rv')) pg.querySelectorAll(':scope > .hs:not(.in)').forEach(x => { if (x.getBoundingClientRect().top < innerHeight * .95) x.classList.add('in'); });
    if (calm() || !fl) { if (fl) fl.style.transform = ''; H.setScroll?.(0); return; }
    fl.style.transform = `translate3d(${(-f * 18).toFixed(2)}%, ${(f * 22).toFixed(2)}%, 0) scale(${(1 - f * .22).toFixed(3)}) rotate(${(f * -8).toFixed(2)}deg)`;
    H.setScroll?.(f);
  };
  const on = () => { if (!raf) raf = requestAnimationFrame(apply); };
  addEventListener('scroll', on, { passive: true }); addEventListener('resize', on); addEventListener('vo:prefs', on);
  apply();
  return () => {
    removeEventListener('scroll', on); removeEventListener('resize', on); removeEventListener('vo:prefs', on);
    if (raf) cancelAnimationFrame(raf); bar?.classList.remove('scrolled');
  };
}

// ---------- 1 the hook ----------
function hookSection(H, facts, lat) {
  const v = facts.vars, gb = [];
  const gBtn = (val, label) => {
    const b = h('button', { type: 'button', 'aria-pressed': String(val === 0), onclick: () => { H.setG(val); gb.forEach(x => x.setAttribute('aria-pressed', String(x === b))); } }, label);
    gb.push(b); return b;
  };
  const gap = v.rad_s != null && v.smoke_min_s != null
    ? h('div', { class: 'hk-stat' },
      h('p', { class: 'hk-stat-n' }, h('b', {}, `${v.rad_s} s`), h('span', {}, ` vs ${v.smoke_min_s}–${v.smoke_max_s} s`)),
      h('p', { class: 'hk-stat-l' }, 'Flame light sensor vs cabin smoke detector, NASA Saffire-III ', badge(lat.status)))
    : h('div', { class: 'hk-stat' }, h('p', { class: 'hk-stat-l' }, 'Alarm times: ', badge('missing'), ' data/saffire_latency.json'));
  return h('section', { class: 'hs hk', 'aria-labelledby': 'hero-title' },
    h('div', { class: 'hk-flame' }, H.el),
    h('div', { class: 'hk-copy' },
      h('p', { class: 'kicker' }, 'NASA Space Apps 2026 · Flame in Freefall'),
      h('h1', { id: 'hero-title', class: 'hk-h' }, 'In orbit, fire doesn\'t rise. ', h('span', { class: 'lit' }, 'It hides.')),
      h('p', { class: 'hk-lead' }, 'Without gravity, flames turn into dim blue balls and smoke drifts wherever the fans push it. We used NASA\'s own space-station fire experiments to answer three questions: where is the fire, what will it do, and what puts it out.'),
      h('div', { class: 'hk-cta' }, warpLink({ class: 'btn primary', href: '#/detect' }, 'Start with the fire'), tourButton(), h('a', { class: 'btn', href: '#/evidence' }, 'How we checked it')),
      h('div', { class: 'hk-g', role: 'group', 'aria-label': 'Gravity in the illustration' }, gBtn(0, 'In orbit'), gBtn(1, 'On Earth')),
      h('p', { class: 'hk-note' }, H.ok ? 'Same droplet, same fuel. Only gravity changes.' : 'This illustration needs WebGL 2; the rest of the site works without it.')),
    gap);
}

// ---------- 2 the finding ----------
function findingSection(facts, lat, gas, ctx) {
  const v = facts.vars;
  if (isMissing(lat) || v.rad_s == null || v.smoke_min_s == null) {
    return h('section', { class: 'hs fd', 'aria-labelledby': 'story-h' },
      h('div', { class: 'fd-in' }, h('p', { class: 'kicker' }, 'The finding'),
        h('h2', { id: 'story-h' }, 'The finding', ' ', badge('missing')),
        empty('The finding', 'saffire_latency', 'Alarm timing on NASA\'s orbital fires is not available yet, so the headline cannot be computed.')));
  }
  return h('section', { class: 'hs fd hs-noise', 'data-theme': 'night', 'aria-labelledby': 'story-h' },
    h('div', { class: 'fd-in' },
      h('p', { class: 'kicker' }, '01 · The finding'),
      h('div', { class: 'fd-nums', 'aria-hidden': 'true' },
        h('div', { class: 'fd-n fd-rad' }, h('b', {}, String(v.rad_s)), h('span', {}, 's'), h('small', {}, 'flame light sensor')),
        h('div', { class: 'fd-vs' }, 'vs'),
        h('div', { class: 'fd-n fd-smoke' }, h('b', {}, `${v.smoke_min_s}–${v.smoke_max_s}`), h('span', {}, 's'), h('small', {}, 'cabin smoke detector'))),
      h('h2', { id: 'story-h', class: 'fd-h' }, `In NASA's Saffire-III burns, a flame light sensor crossed our alarm rule within ${v.rad_s} seconds. The cabin smoke detector took ${v.smoke_min_s} to ${v.smoke_max_s} seconds.`),
      v.obs_never ? h('p', { class: 'fd-never' }, 'The detector\'s second channel never rose past its alarm level.') : null,
      ticking(lat, { ctx }),
      h('p', { class: 'story-stamps' }, badge(lat.status), ' Saffire-III alarm timing', v.obs_never ? [' · ', badge(isMissing(gas) ? 'reported' : gas.status), ' Saffire VI gas (ICES-2024-365)'] : null),
      v.obs_never ? h('details', { class: 'fold fd-more' }, h('summary', {}, 'How the alarm times were set'),
        h('p', {}, 'Alarm times use our own stated rule, because NASA published none. The flame sensor updates only every 5 s and sits in the flow duct; the smoke detector is in the cabin, which still held smoke from the earlier test, so its time depends a lot on the rule. Its second channel never rose past its alarm level. In NASA\'s later Saffire VI test, much of the hazardous gas had already been released by the time a smoke monitor reached its alarm level (ICES-2024-365).')) : null,
      h('p', { class: 'story-links' }, h('a', { href: figLink('detect', 'Replay an orbital fire') }, 'Replay the real sensor data'), h('a', { href: '#/memory' }, 'Why seconds matter: sixty years of fire'))));
}

// ---------- 3 why it happens: a small looping drift map from data/drift.json ----------
const RAMP = [[12, 15, 21], [16, 52, 104], [44, 104, 196], [116, 169, 255], [214, 230, 255]];
const ramp = x => { x = Math.max(0, Math.min(1, x)) * (RAMP.length - 1); const i = Math.min(RAMP.length - 2, Math.floor(x)), f = x - i; return RAMP[i].map((a, k) => Math.round(a + (RAMP[i + 1][k] - a) * f)); };
function driftLoop(d, ctx) {
  if (!driftOK(d)) return empty('Waiting for the drift simulation', 'drift', 'A grid of smoke concentration per time step.');
  const n = d.frames.length, W = 480, Hh = Math.round(W * d.ly_m / d.lx_m);
  const still = Math.floor(n * 0.12);   // driftCard's opening frame (main: 12 %)
  const cv = h('canvas', { width: W, height: Hh, class: 'why-cv', role: 'img', 'aria-label': `Smoke drift model, animated: ${driftSummary(d, still)}` });
  const g = cv.getContext('2d'), off = document.createElement('canvas'); off.width = d.nx; off.height = d.ny;
  const og = off.getContext('2d'), img = og?.createImageData(d.nx, d.ny);
  const X = x => x / d.lx_m * W, Y = y => Hh - y / d.ly_m * Hh;
  const t = h('output', { class: 'why-t' }, '');
  let k = still, raf = 0, last = 0, acc = 0, paused = false, vis = true;
  const draw = () => {
    if (!g || !img) return;
    const fr = d.frames[k];
    for (let p = 0; p < fr.length; p++) { const c = ramp(fr[p] / 255); img.data.set([c[0], c[1], c[2], 255], p * 4); }
    og.putImageData(img, 0, 0); g.imageSmoothingEnabled = true; g.drawImage(off, 0, 0, W, Hh);
    g.strokeStyle = 'rgba(236,239,244,.28)'; g.lineWidth = 1;
    for (const [x, y, u, v] of d.arrows || []) { const x0 = X(x), y0 = Y(y); g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + u * 90, y0 - v * 90); g.stroke(); }
    g.fillStyle = '#ff6b2c'; g.beginPath(); g.arc(X(d.fire[0]), Y(d.fire[1]), 5, 0, 6.283); g.fill();
    for (const det of d.detectors) {
      const on = det.alarm_s != null && k * (d.frame_dt_s ?? 0) >= det.alarm_s;
      g.beginPath(); g.arc(Math.min(W - 8, Math.max(8, X(det.x))), Math.min(Hh - 8, Math.max(8, Y(det.y))), 6, 0, 6.283);
      g.fillStyle = on ? '#f0b429' : 'rgba(0,0,0,.6)'; g.fill(); g.strokeStyle = '#eceff4'; g.lineWidth = 1.5; g.stroke();
    }
    t.textContent = `${fmt(k * (d.frame_dt_s ?? 0), 0)} s after the fire starts`;
  };
  const moving = () => !paused && !calm() && vis && !document.hidden;
  const step = now => {
    raf = 0; if (!moving()) { last = 0; return; }
    acc += last ? now - last : 0; last = now;
    if (acc > 140) { acc = 0; k = (k + 1) % n; draw(); }
    raf = requestAnimationFrame(step);
  };
  const kick = () => { if (!raf && moving()) raf = requestAnimationFrame(step); };
  const btn = h('button', { type: 'button', class: 'chip why-pause', 'aria-pressed': 'false' }, 'Pause');
  const sync = () => { const s = paused || calm(); btn.textContent = s ? 'Play' : 'Pause'; btn.setAttribute('aria-pressed', String(s)); };
  btn.addEventListener('click', () => { paused = !(paused || calm()) ; if (!paused && calm()) paused = false; sync(); kick(); });
  draw(); sync();
  if (ctx && typeof ctx.onMount === 'function' && !ctx.detached) {
    let io = null;
    const onP = () => { if (calm()) { k = still; draw(); } sync(); kick(); };
    ctx.onMount(() => {
      if ('IntersectionObserver' in window) { io = new IntersectionObserver(([e]) => { vis = e.isIntersecting; kick(); }); io.observe(cv); }
      addEventListener('vo:prefs', onP); document.addEventListener('visibilitychange', kick); kick();
    });
    ctx.onLeave?.(() => { io?.disconnect(); removeEventListener('vo:prefs', onP); document.removeEventListener('visibilitychange', kick); if (raf) cancelAnimationFrame(raf); raf = 0; });
  }
  return h('figure', { class: 'why-fig' }, h('div', { class: 'why-stage' }, cv),
    h('figcaption', {}, h('span', { class: 'why-legend' }, h('i', { class: 'f' }), 'fire', h('i', { class: 'd' }), 'detector (amber: alarm)'), t, btn,
      h('span', {}, badge(d.status), ' 2D model, data/drift.json · ', h('a', { href: figLink('predict', 'Where the smoke goes') }, 'Open the full drift map'))));
}
function whySection(drift, w, ctx) {
  const L = !isMissing(w) && Array.isArray(w.layouts) ? w.layouts[Math.min(1, w.layouts.length - 1)] : null;   // whatifCard's default: "At the air return"
  const share = L && isNum(L.caught_120) ? `${Math.round(L.caught_120 * 100)}%` : null;
  return h('section', { class: 'hs why', 'aria-labelledby': 'why-h' },
    h('div', { class: 'why-text' },
      h('p', { class: 'kicker' }, '02 · Why it happens'),
      h('h2', { id: 'why-h' }, 'Smoke goes where the fans push it.'),
      share
        ? h('p', {}, `With nothing to make it rise, smoke never reaches the ceiling on its own. In ${fmt(w.runs, 0)} simulated cabin fires, a detector at the air return caught `, h('b', { class: 'why-share' }, share), ` within 2 minutes. `, badge(w.status))
        : h('p', {}, 'With nothing to make it rise, smoke never reaches the ceiling on its own. ', 'The share of simulated fires a detector catches is not available yet (data/whatif.json missing).')),
    h('div', { class: 'why-vis' }, driftLoop(drift, ctx)),
    h('div', { class: 'why-grav' }));
}

// ---------- 4 our answer: camera → growth → risk, live ----------
function answerSection(st, ctx) {
  const cv = st('cv_latest'), sp = st('spread_predictor'), rules = st('risk_rules');
  const out = h('div', { class: 'ans-out', 'aria-live': 'off' },
    h('p', { class: 'ans-idle' }, 'Press the button to run the growth model in your browser on the example reading.'));
  const lvl = h('div', { class: 'ans-risk' }, h('p', { class: 'ans-k' }, 'Risk level'), h('p', { class: 'ans-level' }, '—'),
    h('p', { class: 'ans-why' }, badge('team'), ' Team choice, to be approved'));
  const open = warpLink({ class: 'btn primary ans-open', href: '#/assess' }, 'Open the full assessment');
  const btn = h('button', { type: 'button', class: 'btn ans-load' }, 'Load example camera reading');
  let busy = false;
  btn.addEventListener('click', async () => {
    if (busy) return; busy = true; btn.setAttribute('aria-busy', 'true');
    out.replaceChildren(h('p', { class: 'ans-idle' }, 'Running the growth model…'));
    try {
      const [ex, data] = await Promise.all([load('cv_example'), loadAssessData()]);
      if (isMissing(ex)) { out.replaceChildren(empty('No example camera reading yet', 'cv_example', 'The example button needs this demo file.')); return; }
      const list = Array.isArray(data.examples?.examples) ? data.examples.examples : [];
      const base = list.find(e => e.id === store.DEFAULT_PRESET) || list[0];
      if (!base) { out.replaceChildren(empty('No worked examples yet', 'growth_examples', 'The demo needs the worked examples for the fuel and cabin.')); return; }
      // the Assess path: the default preset for fuel and cabin, the flame from the example reading (checked as Assess checks it)
      store.set(store.fromPreset(base), { url: false });
      const r0 = store.applyFlameState(ex, 'example');
      if (!r0.ok) { out.replaceChildren(h('p', {}, `The example reading was not used: ${r0.errors.join(' ')}`)); return; }
      const inputs = store.get();
      const res = await computeAssessment(inputs, data);
      showResult(res, inputs, data);
    } catch (e) {
      if (e?.name === 'AbortError') return;
      console.error(e); out.replaceChildren(h('p', {}, `The growth model could not run: ${e?.message || e}`));
    } finally { busy = false; btn.removeAttribute('aria-busy'); }
  });
  function showResult(r, inputs, data) {
    const q = store.toQuery(inputs); open.setAttribute('href', `#/assess${q ? '?' + q : ''}`);
    const risk = r.risk || {};
    lvl.querySelector('.ans-level').textContent = risk.level || 'none given';
    lvl.dataset.level = risk.level || '';
    lvl.querySelector('.ans-why').replaceChildren(badge(isMissing(data.rules) ? 'missing' : (data.rules.status || 'team')), risk.approved ? ' Team rule' : ' Team choice, to be approved',
      risk.fired ? h('span', { class: 'ans-rule' }, ` · Rule ${risk.fired.id}${risk.fired.label ? ` (${risk.fired.label})` : ''}`) : null);
    if (r.kind !== 'growth' || !r.growth) { out.replaceChildren(h('p', {}, (r.sentences || []).join(' ') || 'No growth curve for these inputs.')); return; }
    const g = r.growth, t = g.t_abs_s || g.t_s || [], A = g.area_cm2 || {}, sm = g.summary || {}, mid = sm.mid || {};
    const pts = k => t.map((x, i) => [x, isNum(A[k]?.[i]) ? A[k][i] : null]);
    const band = t.map((x, i) => [x, Math.min(A.lo?.[i], A.hi?.[i]), Math.max(A.lo?.[i], A.hi?.[i])]);
    const chart = lineChart({ title: 'Burning area over time, worked example', xLabel: 'Time after ignition, s', yLabel: 'Burning area, cm²', unit: ' cm²',
      series: [
        { name: 'Slow run (lo)', points: pts('lo'), color: SERIES[0], dash: DASH[1] },
        { name: 'Middle run (mid)', points: pts('mid'), band, color: SERIES[1], dash: '' },
        { name: 'Fast run (hi)', points: pts('hi'), color: SERIES[3], dash: DASH[3] }] });
    out.replaceChildren(
      h('div', { class: 'ans-tiles' },
        h('div', {}, h('b', {}, n4(mid.max_area_cm2)), h('span', {}, 'cm²'), h('small', {}, 'largest burning area (mid)')),
        h('div', {}, h('b', {}, n4(mid.t_max_s)), h('span', {}, 's'), h('small', {}, 'time to the largest area (mid)')),
        h('div', {}, h('b', {}, n4(mid.t_end_s)), h('span', {}, 's'), h('small', {}, 'the fire stops (mid)'))),
      chart,
      h('p', { class: 'ans-src' }, badge('demo'), ' Example camera reading (data/cv_example.json) · ', badge(r.status || 'model'), ' Growth model (M6b)'));
    announce(`Worked example: largest burning area ${n4(mid.max_area_cm2)} square centimetres; risk level ${risk.level || 'none given'}.`);
  }
  if (ctx?.onLeave) ctx.onLeave(() => { try { stopGrowth(); } catch { /* nothing running */ } });

  const step = (n, title, text, stamps, links) => h('li', { class: 'pipe-step' },
    h('span', { class: 'pipe-n' }, `Step ${n}`), h('h3', {}, title), h('p', {}, text),
    h('div', { class: 'pipe-stamps' }, stamps.map(([s, label]) => h('span', {}, badge(s), ' ', label))),
    h('p', { class: 'pipe-links' }, links.flatMap(([href, label], i) => [i ? ' · ' : null, h('a', { href }, label)])));
  const pipe = h('section', { class: 'card ans-pipe', 'data-title': 'From camera to risk' },
    h('h2', {}, 'From camera to risk', badge('team')),
    h('ol', { class: 'pipe' },
      step(1, 'Camera', isMissing({ status: cv })
        ? 'A camera on our bench rig will read the flame\'s size and position on the fuel; it is not connected yet, so Assess starts from sliders or a worked example.'
        : 'A camera on our bench rig reads the flame\'s size and position on the fuel.',
      [[cv, 'Camera reading']], [['#/locate', 'Bench rig: camera']]),
      step(2, 'Growth simulation', 'Our spread model, calibrated on NASA flights, grows that flame forward in time: how big it gets, when, and why it stops.',
        [[sp, 'Spread predictor (M6b)']], [['#/assess', `Assess: ${pageById('assess')?.title || 'Assess'}`]]),
      step(3, 'Risk and response', 'Team rules turn the size, the timing and NASA\'s alarm times into a risk level, and Put it out lists what NASA data says about this fire.',
        [[rules, 'Risk rules, to be approved']], [[figLink('assess', 'Risk: the parts and the rule that fired'), 'The rule that fired'], ['#/respond', 'Put it out']])));
  return h('section', { class: 'hs ans', 'aria-labelledby': 'ans-h' },
    h('div', { class: 'ans-head' },
      h('p', { class: 'kicker' }, '03 · Our answer'),
      h('h2', { id: 'ans-h' }, 'Camera → growth → risk'),
      h('p', {}, 'One flame reading goes in; our spread model, calibrated on NASA flights, grows it forward and team rules give a risk level.')),
    h('div', { class: 'ans-app' },
      h('div', { class: 'ans-ctl' }, btn, h('small', {}, badge('demo'), ' A copy of worked example 1\'s flame, not a camera measurement.'), lvl, open),
      out),
    pipe);
}

// ---------- 5 why you can trust it ----------
async function trustSection(trust, inv) {
  let counts = null, evStatus = 'missing';
  try {
    const [ev, models, m6b] = await Promise.all([load('evidence'), load('models'), loadPath(E4_SOURCE)]);
    if (!isMissing(ev)) evStatus = ev.status;
    if (!isMissing(ev)) counts = checkCounts(evidenceRows(ev, { m6bResults: isMissing(m6b) ? null : m6b, models: isMissing(models) ? null : models }));
  } catch (e) { console.error(e); }
  const rows = !isMissing(trust) && Array.isArray(trust.rows) ? trust.rows : null;
  const met = rows ? rows.filter(r => r.passed).length : null;
  const items = !isMissing(inv) && Array.isArray(inv.items) ? inv.items : [];
  const big = (n, label, cls) => h('div', { class: `tr-n ${cls || ''}` }, h('b', {}, n == null ? 'n/a' : String(n)), h('span', {}, label));
  return h('section', { class: 'hs tr', 'aria-labelledby': 'tr-h' },
    h('div', { class: 'tr-head' },
      h('p', { class: 'kicker' }, '04 · Why you can trust it'),
      h('h2', { id: 'tr-h' }, 'Failures stay on the page.'),
      h('p', {}, counts ? `We wrote down ${counts.n} checks, each with its pass limit set before running it.` : 'The list of checks is not available yet (data/evidence.json missing).',
        rows ? ` ${met} of ${rows.length} models met the rule we wrote before running them; the rest are shown as misses.` : ''),
      h('a', { class: 'btn', href: '#/evidence' }, 'See every check')),
    h('div', { class: 'tr-nums' },
      big(counts?.pass, 'checks passed', 'pass'), big(counts?.fail, 'failed, kept on record', 'fail'), big(counts?.todo, 'still to run'),
      h('p', { class: 'tr-src' }, badge(evStatus), ' data/evidence.json · ', badge(isMissing(trust) ? 'missing' : trust.status), ' data/trust.json')),
    h('div', { class: 'tr-data' },
      h('p', { class: 'tr-k' }, `NASA datasets used (${items.length})`, ' ', badge(isMissing(inv) ? 'missing' : inv.status)),
      items.length ? h('ul', { class: 'tr-chips' }, items.map(x => h('li', {}, x.doi
        ? h('a', { href: `https://doi.org/${x.doi}`, target: '_blank', rel: 'noopener' }, h('b', {}, x.name), h('span', {}, x.psi))
        : h('span', {}, h('b', {}, x.name), h('span', {}, x.psi)))))
        : empty('Waiting for the investigation list', 'investigations', 'The NASA investigations the site draws on, each with its PSI id and DOI.')));
}

// ---------- 6 why it matters here ----------
function hereSection(india, gaps, i18n, ctx) {
  const probes = !isMissing(gaps) && Array.isArray(gaps.probes) ? gaps.probes : [];
  const iss = probes[0], p34 = probes.find(p => p.o2 === 34);
  const kind = p34 ? Object.keys(p34.counts || {}).find(k => p34.counts[k] === 0) : null;
  const gap = iss && p34 && kind
    ? h('div', { class: 'here-gap' },
      h('p', { class: 'here-n' }, h('b', {}, String(iss.counts[kind])), h('span', {}, '→'), h('b', { class: 'zero' }, String(p34.counts[kind]))),
      h('p', {}, `NASA microgravity tests on ${kind}: ${iss.counts[kind]} in station air, ${p34.counts[kind]} near ${p34.o2}% oxygen at ${p34.kpa} kPa, an air planned for exploration cabins.`, ' ', badge(gaps.status)))
    : null;
  return h('section', { class: 'hs here', 'aria-labelledby': 'here-h' },
    h('div', { class: 'here-left' },
      h('p', { class: 'kicker' }, '05 · Why it matters here'),
      h('h2', { id: 'here-h' }, 'The next cabins are richer in oxygen than any NASA fire test.'),
      gap,
      isMissing(gaps) ? null : h('p', { class: 'coverage' }, coverageLine(gaps)),
      isMissing(gaps)
        ? card('Mission check: is there NASA data for your cabin air?', 'missing', null,
          empty('Mission check: is there NASA data for your cabin air?', 'gaps', 'The count of NASA tests near each cabin atmosphere is not available yet.'))
        : missionCheck(gaps, { params: ctx.params })),
    h('div', { class: 'here-right' },
      isMissing(india)
        ? card('Why this matters for India\'s own crew and station', 'missing', null,
          empty('Why this matters for India\'s own crew and station', 'india', 'The checked India facts are not available yet.'))
        : indiaCard(india, i18n, ctx)));
}

// ---------- 7 explore ----------
function exploreSection(st, facts, lat, gas, i18n, ctx) {
  const tile = id => { const p = pageById(id); return p ? h('li', {}, h('a', { class: 'ex-tile', href: `#/${id}` }, h('b', {}, p.label), h('span', {}, p.title || ''))) : null; };
  const three = ['detect', 'predict', 'respond'];
  return h('section', { class: 'hs ex', 'aria-labelledby': 'ex-h' },
    h('div', { class: 'ex-top' },
      h('div', {},
        h('p', { class: 'kicker' }, '06 · Explore'),
        h('h2', { id: 'ex-h' }, 'Three questions, one app.'),
        h('p', { class: 'story-map' }, 'The challenge asks teams to summarise, rank and interpret NASA\'s fire data. We do that as three questions:')),
      shortAnswer(facts, lat, gas, i18n, ctx)),
    questions(st),
    h('nav', { class: 'ex-all', 'aria-label': 'Every section' },
      GROUPS.map(([name, ids]) => h('div', { class: 'ex-g' }, h('p', { class: 'ex-gh' }, name),
        h('ul', {}, ids.filter(id => !three.includes(id)).map(tile))))),
    howToRead(),
    h('div', { class: 'ex-cta hs-noise', 'data-theme': 'night' },
      h('p', { class: 'ex-cta-k' }, 'Try it on a fire'),
      h('p', { class: 'ex-cta-h' }, 'Set a flame, a fuel and the cabin air. See how big it gets and when the alarms would come.'),
      warpLink({ class: 'btn primary', href: '#/assess' }, 'Open the full assessment')));
}

// ---------- the Home short answer, in English, తెలుగు or हिन्दी (P5-G) ----------
function shortAnswer(facts, lat, gas, i18n, ctx) {
  const h2 = h('h2', { id: 'short-h-overview' }), ol = h('ol', {});
  const stamps = h('p', { class: 'short-stamps', lang: 'en' });
  const sec = h('section', { class: 'short', id: 'home-short', 'aria-labelledby': 'short-h-overview' });
  const fill = lang => {
    const ttl = tr('short.title', 'The short answer', {}, lang);
    h2.textContent = ttl.text; h2.setAttribute('lang', ttl.lang);
    ol.replaceChildren(...shortLines(facts, lang).map(l => h('li', l.lang === lang ? {} : { lang: l.lang }, l.text)));
    // stamps: where the numbers come from, and (when translated) that the wording is a draft team translation
    stamps.replaceChildren('Numbers from ', badge(isMissing(lat) ? 'missing' : lat.status), ' Saffire-III alarm timing · ',
      badge(isMissing(gas) ? 'missing' : gas.status), ' Saffire gas (ICES-2024-365)',
      ...(lang === 'en' ? [] : [' · Wording ', badge(i18n.status), ' draft translation']));
  };
  const sw = langSwitch({ scope: sec, ctx, id: 'lang-short', onChange: fill });
  fill(currentLang());
  return add(sec, h2, sw, (isMissing(i18n) ? null : draftNote(i18n.reviewed)), ol, stamps);
}


// ---------- the three questions ----------
function questions(st) {
  const q = (n, id, title, text, files) => h('a', { class: 'qn', href: `#/${id}` },
    h('span', { class: 'n' }, n), h('h2', {}, title), h('p', {}, text),
    h('div', { class: 'qn-stamps' }, files.map(([f, label]) => h('span', {}, badge(st(f)), ' ', label))),
    h('span', { class: 'go' }, 'Open section'));
  const mistDone = st('response_trials') === 'dome';   // spec C6: "not completed" unless the file is status dome
  return h('nav', { class: 'qs', 'aria-label': 'The three questions' },
    q('01 · LOCATE', 'detect', 'Where is the fire?', 'Which sensor would have noticed real orbital fires first, how late, and which smoke the station detector cannot see.', [['saffire_latency', 'Saffire alarm timing'], ['smoke_sizes', 'SAME smoke sizes']]),
    q('02 · PREDICT', 'predict', 'What will it do?', 'How fast flame spreads, whether a burning droplet goes out, and where smoke drifts when nothing rises.', [['drift', 'Smoke drift'], ['models', 'Trained models']]),
    q('03 · RESPOND', 'respond', 'What puts it out?', mistDone
      ? 'What NASA found about gases that starve flames and when a droplet flame goes out, next to our own bench mist trial.'
      : 'What NASA found about gases that starve flames and when a droplet flame goes out. Bench mist trial: not completed.',
    [['flex_suppression', 'FLEX suppression'], ['m7_explorer', 'Extinction and cool flames'], ['response_trials', 'Bench mist trial (optional)']]));
}

// ---------- how to read this site ----------
function howToRead() {
  const rows = [
    ['real', 'From a NASA dataset we downloaded and processed ourselves.'],
    ['dome', 'Measured on our own bench rig, at Earth gravity.'],
    ['model', 'Our model, trained and tested on NASA data. Scores show its range.'],
    ['reported', 'Taken from a paper or a news report. Not checked by us against raw data.'],
    ['demo', 'Placeholder numbers so a panel can be tried out. Never a result.'],
    ['plan', 'Planned work. Nothing here is a result.'],
    ['team', 'A choice the team made, such as a rule or a wording. It is not a measurement.'],
    ['missing', 'Not measured yet. The panel says what file will fill it.'],
    SCRAPPED.approved ? ['scrapped', 'Dropped in plan v2. Kept on the page so nothing disappears without a trace.'] : null,
  ].filter(Boolean);
  return h('details', { class: 'more readme-fold' },
    h('summary', {}, h('span', {}, 'How to read this site'), h('small', {}, 'What the coloured stamps on every panel mean')),
    h('p', {}, 'Every panel is stamped with where its numbers come from. Only the first three are results.'),
    h('div', { class: 'readme' }, rows.map(([s, t]) => h('div', {}, badge(s), h('p', {}, t)))),
    h('p', { class: 'readme-foot' }, 'Dotted words have a plain-English meaning: hover, tap or tab to them. The ', h('b', {}, 'Read your way'), ' button changes text size, colours and motion, or reads a page aloud.'));
}

// ---------- India card ----------
// Source level → stamp style (main, verbatim). The levels' own definitions come from india.json `levels`.
const LV = { 'official': 'real', 'official via news': 'reported', 'news only': 'demo' };
function indiaCard(d, i18n, ctx) {
  const facts = Array.isArray(d.facts) ? d.facts : [], notFound = Array.isArray(d.not_found) ? d.not_found : [];
  const levels = Object.entries(d.levels || {});
  const TITLE = 'Why this matters for India\'s own crew and station';
  // One translated piece: an element whose lang is set only when it differs from the card's.
  let L = currentLang();
  const T = (tag, attrs, key, en, vars) => { const r = tr(key, en, vars, L); return h(tag, r.lang === L ? attrs : { ...attrs, lang: r.lang }, r.text); };
  const EN = (tag, attrs, ...kids) => h(tag, { ...attrs, lang: 'en' }, ...kids);   // kept in English on purpose (Q7)
  const lvl = k => T('span', { class: `lvl ${LV[k] || ''}` }, `level.${k}`, k);
  const eyebrow = h('p', { class: 'eyebrow' }), h2 = h('h2', {}), body = h('div', { class: 'india-body' });
  const sec = h('section', { class: 'card india', id: 'india', 'data-title': TITLE });
  const fill = lang => {
    L = lang;
    const open = [...body.querySelectorAll('details')].map(x => x.open);   // keep open folds open across a switch
    const e = tr('india.eyebrow', 'From Hyderabad', {}, L); eyebrow.textContent = e.text;
    if (e.lang !== L) eyebrow.setAttribute('lang', e.lang); else eyebrow.removeAttribute('lang');
    const t = tr('india.title', TITLE, {}, L);
    h2.replaceChildren(h('span', t.lang === L ? {} : { lang: t.lang }, t.text), badge(d.status));
    body.replaceChildren(
      d.link ? T('p', { class: 'india-link' }, 'india.link', d.link) : null,
      h('details', { class: 'fold' }, T('summary', {}, 'india.facts_summary', `The facts we checked, with sources (${facts.length})`, { n: facts.length }),
        L === 'en' ? null : T('p', { class: 'india-en-note' }, 'india.facts_en_note', 'The fact texts stay in English, so each one matches its source word for word.'),
        levels.length ? h('div', { class: 'india-levels' }, T('p', {}, 'india.levels_intro', 'How sure we are of each source:'),
          h('ul', {}, levels.map(([k, txt]) => h('li', {}, lvl(k), ' ', T('span', {}, `level_def.${k}`, txt))))) : null,
        h('div', { class: 'grid g2 india-facts' }, facts.map(f => h('div', { class: 'fact' },
          h('div', { class: 'fact-top' }, EN('b', {}, f.topic), lvl(f.level)),
          EN('p', {}, f.text),
          f.url ? EN('small', {}, h('a', { href: f.url, target: '_blank', rel: 'noopener' }, f.source)) : EN('small', {}, f.source))))),
      h('details', { class: 'fold' }, T('summary', {}, 'india.not_found', 'What we looked for and did not find'), EN('ul', {}, notFound.map(x => h('li', {}, x)))),
      h('p', { class: 'india-checked' }, h('small', {}, T('span', {}, 'india.checked', `Checked ${d.checked}.`, { date: d.checked }), ' ', EN('span', {}, d.source))));
    body.querySelectorAll('details').forEach((x, i) => { if (open[i]) x.open = true; });
    // the glossary pass annotates English text once at render; re-annotate this card after a later switch
    if (sec.isConnected) { try { annotate(wrap); } catch (err) { console.error(err); } }
  };
  const wrap = h('div', { class: 'india-wrap' }, sec);
  const sw = langSwitch({ scope: sec, ctx, id: 'lang-india', onChange: fill });
  fill(L);
  add(sec, eyebrow, h2, sw, (isMissing(i18n) ? null : draftNote(i18n.reviewed)), body);
  return wrap;
}

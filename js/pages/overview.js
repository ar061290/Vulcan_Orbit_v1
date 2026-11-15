// Home (#/overview). Ported from main's js/pages/overview.js (site/REBUILD_PLAN.md §3.2), plus:
//  - the "From camera to risk" pipeline strip (spec C8);
//  - the Home short answer, computed in js/facts.js (the same numbers Find it and the te/hi strings use);
//  - question 03 reworded (no ion wind, spec C6) with the mist trial marked optional;
//  - links to Assess and Flame lab beside the three questions (D5.5);
//  - the stamp legend with dome, demo, plan and team; the India card's source-level legend (d.levels).
// Every number here is read from data/*.json at run time. Home has no page header, no fold and no figure anchors
// (site.js head:false), and exports no short(): it renders its own short answer.
//  - (P5-G) the English/తెలుగు/हिन्दी switch on the short answer and the India card (spec #25). Strings are in
//    data/i18n.json; the numbers are the same facts.detectFacts() vars the English uses (js/i18n.js).
//  - (UI lock) the porthole and its own WebGL context are gone: a pinned ~300vh scroll story drives the shared field
//    (js/field.js) and draws the real Saffire-III Sample 1 traces; every other section is a one-line ledger row.
import { h, add, load, badge, card, empty, isMissing } from '../lib.js';
import { loadI18n, langSwitch, draftNote, shortLines, tr, currentLang } from '../i18n.js';
import { annotate } from '../glossary.js';
import { setField, bindOrbit, fieldOk } from '../field.js';
import { blip } from '../engine.js';
import { ticking } from '../clock.js';
import { tourButton } from '../tour.js';
import { missionCheck, coverageLine } from '../mission.js';
import { detectFacts } from '../facts.js';
import { figLink } from '../passes.js';
import { pageById } from '../site.js';
import { SCRAPPED } from '../overlays.js';

const NS = 'http://www.w3.org/2000/svg';

export default async function render(root, ctx = {}) {
  const [man, india, lat, gas, gaps, i18n] = await Promise.all([load('manifest'), load('india'), load('saffire_latency'), load('saffire_gas'), load('gaps'), loadI18n()]);
  const st = n => (Array.isArray(man.files) ? man.files : []).find(f => f.name === n)?.status || 'missing';
  const facts = detectFacts(lat, gas), v = facts.vars;
  // UI lock: one pinned scroll story on top (the shared field does the drawing), then every other section as a
  // one-line row of a console ledger. The rows hold the existing content unchanged.
  let n = 0;
  const row = (title, hint, kids, { open = false } = {}) => h('details', { class: 'hrow', open },
    h('summary', {},
      h('span', { class: 'hrow-n', 'aria-hidden': 'true' }, String(++n).padStart(2, '0')),
      h('span', { class: 'hrow-t' }, title),
      h('span', { class: 'hrow-hint' }, hint),
      h('span', { class: 'hrow-plus', 'aria-hidden': 'true' })),
    h('div', { class: 'hrow-body' }, kids));
  const findingHint = v.rad_s != null && v.smoke_min_s != null
    ? `Flame sensor ${v.rad_s} s · cabin smoke detector ${v.smoke_min_s}–${v.smoke_max_s} s`
    : 'Alarm timing on NASA\'s orbital fires: not available yet';
  const missionOpen = !!(ctx.params && ctx.params.atm);
  root.append(h('div', { class: 'page home' },
    storySection(lat, ctx),
    h('p', { class: 'hero-lead home-lead' }, 'Without gravity, flames turn into dim blue balls and smoke drifts wherever the fans push it. We used NASA\'s own space-station fire experiments to answer three questions: where is the fire, what will it do, and what puts it out.'),
    h('section', { class: 'ledger', 'aria-labelledby': 'ledger-h' },
      h('h2', { id: 'ledger-h', class: 'ledger-h' }, 'Everything on this page'),
      row('From camera to risk', 'One fire, three steps, each on its own page', pipelineCard(st)),
      row('The finding', findingHint, findingSection(facts, lat, gas, ctx)),
      row('The short answer', 'In English, తెలుగు or हिन्दी', shortAnswer(facts, lat, gas, i18n, ctx)),
      row('The three questions', 'Locate, predict, respond', [
        h('p', { class: 'story-map' }, 'The challenge asks teams to summarise, rank and interpret NASA\'s fire data. We do that as three questions:'),
        questions(st)]),
      row('Also on this site', 'Assess and Flame lab', alsoLinks()),
      row('Mission check', 'Is there NASA data for your cabin air?', [
        isMissing(gaps) ? null : h('p', { class: 'coverage' }, coverageLine(gaps)),
        isMissing(gaps)
          ? card('Mission check: is there NASA data for your cabin air?', 'missing', null,
            empty('Mission check: is there NASA data for your cabin air?', 'gaps', 'The count of NASA tests near each cabin atmosphere is not available yet.'))
          : missionCheck(gaps, { params: ctx.params })], { open: missionOpen }),
      row('How to read this site', 'What the coloured stamps on every panel mean', howToRead()),
      row('Why this matters for India', 'India\'s own crew and station, with checked sources',
        isMissing(india)
          ? card('Why this matters for India\'s own crew and station', 'missing', null,
            empty('Why this matters for India\'s own crew and station', 'india', 'The checked India facts are not available yet.'))
          : indiaCard(india, i18n, ctx)))));
}

// ---------- the pinned scroll story (UI lock) ----------
// Native scroll, no wheel interception: section.story-pin is ~300vh tall and its .story-stick is position:sticky.
// Progress p (0..1) drives the shared field (js/field.js) and the real Saffire-III Sample 1 traces:
//   0-33 %  gravity 1 -> 0 (teardrop to blue sphere), captions "On Earth, fire rises" then "In orbit, nothing rises"
//   33-66 % smoke 0 -> 1, caption "Smoke goes everywhere"
//   66-100 % the field dims and the flight traces draw in (stroke-dashoffset), with labels computed from the data.
// Every caption is real text in the DOM; only opacity changes. Calm / reduced motion / short screens / the detached
// site map: no pinning, all captions stacked, the traces fully drawn, the field set once (g 0, smoke 0).
// The field and the flame are an ILLUSTRATION. The traces are real data (data/saffire_latency.json).
const STILL = () => document.documentElement.dataset.motion === 'calm' || matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const ramp = (x, a, b) => clamp((x - a) / (b - a), 0, 1);
const smooth = x => x * x * (3 - 2 * x);
const fmt = x => String(+(+x).toFixed(1));            // 7.0 -> "7", 72.0 -> "72"
const fin = x => typeof x === 'number' && Number.isFinite(x);
const Y_LO = -0.5, Y_HI = 2;                            // the existing replay's display clamp (Find it): a display choice
const WIN_END = 130;                                    // display window end, s after the igniter switched on: a display choice
const DIM_STORY = 0.55, DIM_AFTER = 0.82;               // field dimming: drawing parameters of the illustration

/** Pull the Sample 1 burn's radiometer and scatter traces and the numbers the labels need. Nothing is typed in. */
function sampleOne(lat) {
  if (isMissing(lat) || !Array.isArray(lat.burns)) return { why: 'data/saffire_latency.json is missing.' };
  const b = lat.burns.find(x => /Sample 1/.test(x?.name || ''));
  if (!b) return { why: 'data/saffire_latency.json has no burn named Sample 1.' };
  const ch = re => (Array.isArray(b.channels) ? b.channels.find(c => re.test(c?.name || '') || re.test(c?.key || '')) : undefined);
  const rad = ch(/radiometer/i), sc = ch(/scatter/i), t = Array.isArray(b.t) ? b.t : [];
  if (!rad || !sc || !t.length || !Array.isArray(rad.values) || !Array.isArray(sc.values)) return { why: 'the Sample 1 burn in data/saffire_latency.json has no radiometer or scatter trace.' };
  const t0 = t.find(fin);
  const range = Array.isArray(sc.alarm_s_range) ? sc.alarm_s_range : [];
  const out = {
    b, rad, sc, t, t0,
    radAt: fin(rad.alarm_s) ? rad.alarm_s : null, radRes: fin(rad.resolution_s) ? rad.resolution_s : null,
    scLo: fin(range[0]) ? range[0] : null, scHi: fin(range[1]) ? range[1] : null,
    psi: (String(lat.source || '').match(/PSI-\d+/) || [null])[0],
    status: lat.status,
    // the alarm level in the traces' own units, read from the file's y_meaning ("... (1.0 = alarm at baseline + 5 SD)")
    alarmTxt: (String(lat.y_meaning || '').match(/(\d+(?:\.\d+)?)\s*=\s*alarm/i) || [])[1] || null,
  };
  out.alarmV = out.alarmTxt != null && fin(+out.alarmTxt) ? +out.alarmTxt : null;
  out.t1 = Math.max(WIN_END, out.scHi != null ? out.scHi + 20 : 0, out.radAt != null ? out.radAt + 20 : 0);
  out.gap = out.radAt != null && out.scLo != null ? out.scLo - out.radAt : null;
  return out;
}

/** The trace panel: SVG paths plus HTML labels. Returns {el, draw(f, still)}; f = sweep 0..1 across the window. */
function tracePanel(d) {
  if (d.why) {
    const el = h('div', { class: 'story-data sd-missing hud' },
      h('p', { class: 'sd-head' }, h('span', {}, 'Flight data')),
      h('p', { class: 'sd-why' }, `The real flight traces cannot be drawn: ${d.why}`));
    return { el, draw: () => {} };
  }
  const W = 600, H = 210, L = 6, R = 6, TOP = 30, BOT = 22;
  const x = t => L + (t - d.t0) / (d.t1 - d.t0) * (W - L - R);
  const y = v => TOP + (Y_HI - clamp(v, Y_LO, Y_HI)) / (Y_HI - Y_LO) * (H - TOP - BOT);
  const pts = vals => {
    const p = [];
    d.t.forEach((t, i) => { if (fin(t) && t >= d.t0 && t <= d.t1 && fin(vals[i])) p.push([x(t), y(vals[i])]); });
    const cum = [0];
    for (let i = 1; i < p.length; i++) cum.push(cum[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]));
    return { p, cum, len: cum[cum.length - 1] || 1, d: p.map(([a, b], i) => `${i ? 'L' : 'M'}${a.toFixed(1)} ${b.toFixed(1)}`).join('') };
  };
  // length fraction of a path drawn up to screen x = X, so both traces sweep in step with time
  const lenAt = (P, X) => {
    const { p, cum, len } = P;
    if (!p.length || X <= p[0][0]) return 0;
    for (let i = 1; i < p.length; i++) if (p[i][0] >= X) { const k = (X - p[i - 1][0]) / ((p[i][0] - p[i - 1][0]) || 1); return (cum[i - 1] + k * (cum[i] - cum[i - 1])) / len; }
    return 1;
  };
  const PR = pts(d.rad.values), PS = pts(d.sc.values);
  const yA = d.alarmV != null ? y(d.alarmV) : null, y0 = y(0), xR = d.radAt != null ? x(d.radAt) : null, xLo = d.scLo != null ? x(d.scLo) : null, xHi = d.scHi != null ? x(d.scHi) : null;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('class', 'sd-svg'); svg.setAttribute('role', 'img');
  svg.setAttribute('focusable', 'false');
  const lbl = [
    `Real NASA Saffire-III flight data${d.psi ? ` (${d.psi})` : ''}, ${d.b.name}, from ${fmt(d.t0)} to ${fmt(d.t1)} seconds after the igniter switched on.`,
    d.radAt != null ? `The flame radiometer crossed our alarm rule by ${fmt(d.radAt)} seconds${d.radRes != null ? ` (it updates every ${fmt(d.radRes)} seconds)` : ''}.` : 'The flame radiometer alarm time is not available.',
    d.scLo != null && d.scHi != null ? `The cabin smoke detector's scatter channel crossed it at ${fmt(d.scLo)} to ${fmt(d.scHi)} seconds, loose to strict alarm rule.` : 'The cabin smoke detector alarm time is not available.',
    d.gap != null ? `That is at least ${fmt(d.gap)} seconds later.` : '',
  ].filter(Boolean).join(' ');
  svg.setAttribute('aria-label', lbl);
  svg.innerHTML = `
    <line class="sd-zero" x1="${L}" x2="${W - R}" y1="${y0}" y2="${y0}"/>
    ${yA != null ? `<line class="sd-alarm" x1="${L}" x2="${W - R}" y1="${yA}" y2="${yA}"/>` : ''}
    ${d.t0 < 0 ? `<line class="sd-ign" x1="${x(0)}" x2="${x(0)}" y1="${TOP}" y2="${H - BOT}"/>` : ''}
    ${xLo != null && xHi != null ? `<rect class="sd-band sd-rev rv-sc" x="${xLo}" y="${TOP}" width="${Math.max(1, xHi - xLo)}" height="${H - TOP - BOT}"/>` : ''}
    ${xR != null ? `<line class="sd-mark-r sd-rev rv-rad" x1="${xR}" x2="${xR}" y1="${TOP}" y2="${H - BOT}"/>` : ''}
    ${xR != null && xLo != null ? `<path class="sd-brk sd-rev rv-sc" d="M${xR} ${TOP - 4}V${TOP - 12}H${xLo}V${TOP - 4}"/>` : ''}
    <path class="sd-trace sd-tr-r" pathLength="1" d="${PR.d}"/>
    <path class="sd-trace sd-tr-s" pathLength="1" d="${PS.d}"/>
    <line class="sd-cur" x1="0" x2="0" y1="${TOP}" y2="${H - BOT}"/>`;
  const trR = svg.querySelector('.sd-tr-r'), trS = svg.querySelector('.sd-tr-s'), cur = svg.querySelector('.sd-cur');
  const pct = (v, of) => `${(v / of * 100).toFixed(2)}%`;
  const src = d.status === 'real' ? 'Real flight data' : `${d.status || 'missing'} data`;
  const k = (cls, rv, text) => h('li', { class: `${cls} sd-rev ${rv}` }, h('i', { 'aria-hidden': 'true' }), h('span', {}, text));
  const readout = h('span', { class: 'sd-t', 'aria-hidden': 'true' }, '');
  const el = h('div', { class: 'story-data hud' },
    h('p', { class: 'sd-head' },
      h('span', { class: 'sd-src' }, `${src}${d.psi ? ` · NASA ${d.psi}` : ''}`),
      h('span', {}, `${d.b.name} · window ${fmt(d.t0)} to ${fmt(d.t1)} s after igniter on (display choice)`)),
    h('div', { class: 'sd-plot' }, svg,
      d.gap != null ? h('span', { class: 'sd-gap sd-rev rv-sc', 'aria-hidden': 'true', style: `left:${pct((xR + xLo) / 2, W)}` }, `At least ${fmt(d.gap)} seconds`) : null,
      yA != null ? h('span', { class: 'sd-alarm-l', 'aria-hidden': 'true', style: `top:${pct(yA, H)}` }, `Alarm rule ${d.alarmTxt}`) : null,
      d.t0 < 0 ? h('span', { class: 'sd-ign-l', 'aria-hidden': 'true', style: `left:${pct(x(0), W)}` }, 'Igniter on') : null,
      readout),
    h('ul', { class: 'sd-key', 'aria-hidden': 'true' },
      k('k-rad', 'rv-rad', d.radAt != null ? `Flame sensor ≤ ${fmt(d.radAt)} s${d.radRes != null ? ` (± ${fmt(d.radRes)}, it updates every ${fmt(d.radRes)} s)` : ''}` : 'Flame sensor: alarm time not available'),
      k('k-sc', 'rv-sc', d.scLo != null && d.scHi != null ? `Cabin smoke detector ${fmt(d.scLo)}–${fmt(d.scHi)} s (loose to strict alarm rule)` : 'Cabin smoke detector: alarm time not available')));
  const revs = [...el.querySelectorAll('.sd-rev')];
  let lastT = -Infinity;
  const draw = (f, still) => {
    const X = L + f * (W - L - R), tNow = d.t0 + f * (d.t1 - d.t0);
    trR.style.strokeDashoffset = String(1 - lenAt(PR, X));
    trS.style.strokeDashoffset = String(1 - lenAt(PS, X));
    cur.setAttribute('x1', X); cur.setAttribute('x2', X);
    cur.style.opacity = still || f <= 0 || f >= 1 ? '0' : '1';
    readout.textContent = still || f <= 0 || f >= 1 ? '' : `T ${fmt(Math.round(tNow))} s`;
    readout.style.left = pct(X, W);
    const on = { 'rv-rad': d.radAt != null && tNow >= d.radAt, 'rv-sc': d.scLo != null && tNow >= d.scLo };
    for (const r of revs) for (const c of Object.keys(on)) if (r.classList.contains(c)) r.classList.toggle('on', still || on[c]);
    // a meaningful event: the sweep crosses an alarm (sound is off unless the visitor turned it on)
    if (!still) {
      if (d.radAt != null && lastT < d.radAt && tNow >= d.radAt) blip(880, .05);
      if (d.scLo != null && lastT < d.scLo && tNow >= d.scLo) blip(560, .06);
    }
    lastT = tNow;
  };
  return { el, draw };
}

const canPin = () => !STILL() && matchMedia('(min-height: 560px)').matches;   // short screens get the stacked story

function storySection(lat, ctx) {
  const d = sampleOne(lat);
  const panel = tracePanel(d);
  const live = !ctx.detached && typeof ctx.onMount === 'function';
  const static0 = !live || !canPin();
  panel.draw(static0 ? 1 : 0, static0);
  const caps = ['On Earth, fire rises', 'In orbit, nothing rises', 'Smoke goes everywhere'].map((t, i) =>
    h('p', { class: `cap cap${i}` }, h('span', { class: 'cap-n', 'aria-hidden': 'true' }, `${String(i + 1).padStart(2, '0')} / 03`), h('span', { class: 'cap-t' }, t)));
  const drag = h('div', { class: 'story-drag', tabindex: '0', role: 'group', 'aria-roledescription': '3D illustration', 'aria-label': 'Illustration: a fuel droplet flame. Drag or use the arrow keys to turn it.' },
    h('span', { class: 'illus-tag' }, 'Illustration'),
    h('span', { class: 'story-hint' }, 'Drag to turn'));
  const railSeg = ['Gravity', 'Smoke', 'Flight data'].map((t, i) => h('span', {}, h('b', {}, String(i + 1).padStart(2, '0')), ` ${t}`, h('i', {})));
  const rail = h('div', { class: 'story-rail', 'aria-hidden': 'true' }, railSeg);
  const pin = h('section', { class: `story-pin bleed${static0 ? ' is-static' : ''}`, 'aria-labelledby': 'hero-title' },
    h('div', { class: 'story-stick' },
      h('div', { class: 'story-in' },
        h('div', { class: 'story-top' },
          h('p', { class: 'kicker' }, 'NASA Space Apps 2026 · Flame in Freefall'),
          h('h1', { id: 'hero-title' }, 'In orbit, fire doesn\'t rise. It hides.'),
          h('div', { class: 'hero-cta' }, h('a', { class: 'btn primary', href: '#/detect' }, 'Start with the fire'), tourButton(), h('a', { class: 'btn', href: '#/evidence' }, 'How we checked it'))),
        drag,
        h('div', { class: 'story-stage' }, caps, panel.el),
        rail)));
  if (!live) return pin;   // site map: static DOM, start nothing

  let raf = 0, unbind = null, pinned = false, topH = 0, sent = '';
  const stick = pin.querySelector('.story-stick');
  const send = v => { const k = JSON.stringify(v); if (k !== sent) { sent = k; setField(v); } };
  const layout = () => (innerWidth > 900 ? { offx: 0.22 * innerWidth / innerHeight } : { offx: 0, dist: 6.2 });
  const measure = () => {
    const top = document.querySelector('.top');
    topH = top && getComputedStyle(top).position === 'sticky' ? top.offsetHeight : 0;
    pin.style.setProperty('--top-h', `${topH}px`);
    pinned = canPin();
    pin.classList.toggle('is-static', !pinned);
    if (!pinned) { caps.forEach(c => { c.style.opacity = ''; c.style.transform = ''; }); panel.el.style.opacity = ''; railSeg.forEach(s => s.style.removeProperty('--f')); panel.draw(1, true); }
  };
  const update = () => {
    raf = 0;
    if (!pin.isConnected) return;
    const r = pin.getBoundingClientRect();
    // after the story: dim the field further so the ledger below reads cleanly
    const after = ramp(innerHeight - r.bottom, 0, innerHeight * 0.6);
    if (!pinned) { send({ g: 0, smoke: 0, dim: DIM_AFTER * after, ...layout() }); return; }
    const p = clamp((topH - r.top) / Math.max(1, r.height - stick.offsetHeight), 0, 1);
    const s1 = ramp(p, 0, 1 / 3), s2 = ramp(p, 1 / 3, 2 / 3), s3 = ramp(p, 2 / 3, 1);
    const op = [1 - ramp(p, 0.13, 0.2), ramp(p, 0.13, 0.2) * (1 - ramp(p, 0.3, 0.36)), ramp(p, 0.3, 0.36) * (1 - ramp(p, 0.63, 0.69))];
    caps.forEach((c, i) => { c.style.opacity = String(op[i]); c.style.transform = `translateY(${((1 - op[i]) * 14).toFixed(1)}px)`; });
    panel.el.style.opacity = String(ramp(p, 0.63, 0.69));
    panel.draw(ramp(p, 0.68, 0.96), false);
    [s1, s2, s3].forEach((f, i) => railSeg[i].style.setProperty('--f', f.toFixed(3)));
    const dim = DIM_STORY * ramp(p, 0.66, 0.8);
    send({ g: 1 - smooth(s1), smoke: smooth(s2), dim: dim + (DIM_AFTER - dim) * after, ...layout() });
  };
  const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
  const onResize = () => { measure(); onScroll(); };
  ctx.onMount(() => {
    measure(); update();
    if (fieldOk()) unbind = bindOrbit(drag);
    else { drag.setAttribute('aria-label', 'Illustration of a fuel droplet flame: not shown, because this browser has no WebGL 2. The rest of the site works without it.'); drag.removeAttribute('tabindex'); pin.classList.add('no-field'); }
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onResize);
  });
  ctx.onLeave(() => {
    removeEventListener('scroll', onScroll); removeEventListener('resize', onResize);
    if (raf) cancelAnimationFrame(raf); raf = 0;
    if (unbind) unbind(); unbind = null;
  });
  return pin;
}

// ---------- C8: from camera to risk ----------
function pipelineCard(st) {
  const cv = st('cv_latest'), sp = st('spread_predictor'), rules = st('risk_rules');
  const step = (n, title, text, stamps, links) => h('li', { class: 'pipe-step' },
    h('span', { class: 'pipe-n' }, `Step ${n}`),
    h('h3', {}, title),
    h('p', {}, text),
    h('div', { class: 'pipe-stamps' }, stamps.map(([s, label]) => h('span', {}, badge(s), ' ', label))),
    h('p', { class: 'pipe-links' }, links.flatMap(([href, label], i) => [i ? ' · ' : null, h('a', { href }, label)])));
  return card('From camera to risk', 'team', 'One fire, three steps. Each step runs on its own page.',
    h('ol', { class: 'pipe' },
      step(1, 'Camera', isMissing({ status: cv })
        ? 'A camera on our bench rig will read the flame\'s size and position on the fuel; it is not connected yet, so Assess starts from sliders or a worked example.'
        : 'A camera on our bench rig reads the flame\'s size and position on the fuel.',
      [[cv, 'Camera reading']], [['#/locate', 'Bench rig: camera']]),
      step(2, 'Growth simulation', 'Our spread model, calibrated on NASA flights, grows that flame forward in time: how big it gets, when, and why it stops.',
        [[sp, 'Spread predictor (M6b)']], [['#/assess', `Assess: ${pageById('assess')?.title || 'Assess'}`]]),
      step(3, 'Risk and response', 'Team rules turn the size, the timing and NASA\'s alarm times into a risk level, and Put it out lists what NASA data says about this fire.',
        [[rules, 'Risk rules, to be approved']], [[figLink('assess', 'Risk: the parts and the rule that fired'), 'The rule that fired'], ['#/respond', 'Put it out']])));
}

// ---------- "The finding" ----------
function findingSection(facts, lat, gas, ctx) {
  const v = facts.vars;
  if (isMissing(lat) || v.rad_s == null || v.smoke_min_s == null) {
    return h('section', { class: 'story', 'aria-labelledby': 'story-h' },
      h('p', { class: 'kicker' }, 'The finding'),
      h('h2', { id: 'story-h' }, 'The finding', ' ', badge('missing')),
      empty('The finding', 'saffire_latency', 'Alarm timing on NASA\'s orbital fires is not available yet, so the headline cannot be computed.'));
  }
  return h('section', { class: 'story', 'aria-labelledby': 'story-h' },
    h('p', { class: 'kicker' }, 'The finding'),
    h('h2', { id: 'story-h' }, `In NASA's Saffire-III burns, a flame light sensor crossed our alarm rule within ${v.rad_s} seconds. The cabin smoke detector took ${v.smoke_min_s} to ${v.smoke_max_s} seconds.`),
    h('p', { class: 'story-stamps' }, badge(lat.status), ' Saffire-III alarm timing', v.obs_never ? [' · ', badge(isMissing(gas) ? 'reported' : gas.status), ' Saffire VI gas (ICES-2024-365)'] : null),
    v.obs_never ? h('p', { class: 'story-sub' }, 'Alarm times use our own stated rule, because NASA published none. The flame sensor updates only every 5 s and sits in the flow duct; the smoke detector is in the cabin, which still held smoke from the earlier test, so its time depends a lot on the rule. Its second channel never rose past its alarm level. In NASA\'s later Saffire VI test, much of the hazardous gas had already been released by the time a smoke monitor reached its alarm level (ICES-2024-365).') : null,
    ticking(lat, { ctx }),
    h('p', { class: 'story-links' }, h('a', { href: figLink('detect', 'Replay an orbital fire') }, 'Replay the real sensor data'), ' · ', h('a', { href: '#/memory' }, 'Why seconds matter: sixty years of fire')));
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
// D5.5: Home links to every main section, including Assess and Flame lab.
function alsoLinks() {
  const link = id => { const p = pageById(id); return p ? h('a', { class: 'also', href: `#/${id}` }, h('b', {}, p.label), ' ', h('span', {}, p.title)) : null; };
  return h('nav', { class: 'qs-also', 'aria-label': 'Also on this site' }, h('span', { class: 'qs-also-h' }, 'Also'), link('assess'), link('flame'));
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
  return [
    h('p', {}, 'Every panel is stamped with where its numbers come from. Only the first three are results.'),
    h('div', { class: 'readme' }, rows.map(([s, t]) => h('div', {}, badge(s), h('p', {}, t)))),
    h('p', { class: 'readme-foot' }, 'Dotted words have a plain-English meaning: hover, tap or tab to them. The ', h('b', {}, 'Read your way'), ' button changes text size, colours and motion, or reads a page aloud.')];
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

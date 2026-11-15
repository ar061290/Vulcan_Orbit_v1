// Model cards (#/models): one section per model, after Mitchell et al. (2019). site/REBUILD_PLAN.md §3.10, package P5-C.
// The sections and their numbers live in js/fig_modelcards.js; this module only loads the files and lays them out.
// Every file is optional: a missing file shows its own "No data yet" state inside the section that needs it, and a
// missing data/trust.json no longer crashes the page (main read tr.rows unguarded).
// The registry row sets provenance:false: each card body already says how it was made, so no second "Made by" block.
import { h, load, loadPath, page, isMissing, announce, setParams } from '../lib.js';
import { MODEL_SECTIONS, modelSection } from '../fig_modelcards.js';
import { draggable } from '../spring.js';
import { revealFigure, figLink } from '../passes.js';

const LEAD = 'One card per model: what it is for, what it is not for, how it was tested, and how well it did, misses included.';
// main's footer, verbatim (js/pages/models.js @ f1a9df7)
const FOOT = 'Format after Mitchell et al., "Model Cards for Model Reporting" (2019). Trust ratings are a self-assessment after NASA-STD-7009A, not a NASA review.';

const RESULTS = {
  m3: 'models/m3-drift/results.json', m4: 'models/m4-latency/results.json', m5: 'models/m5-smoke-miss/results.json',
  m6: 'models/m6-spread/results.json', m6b: 'models/m6b-predictor/results.json', m7: 'models/m7-extinction/results.json',
  fs: 'models/flame-sim/results.json',
};
const FILES = {
  models: 'models', trust: 'trust', perm: 'permutation', sp: 'spread_predictor', whatif: 'whatif', dcal: 'drift_calibration',
  dw: 'drift_whatif', lat: 'saffire_latency', ror: 'rate_of_rise', cv: 'cv_latest', fspread: 'flame_spread',
};

/** Everything the ten sections read, keyed as fig_modelcards.js expects: D.<key> for data/*.json, D.res.<key> for results.json. */
export async function loadModelData() {
  const fk = Object.keys(FILES), rk = Object.keys(RESULTS);
  const [files, res] = await Promise.all([
    Promise.all(fk.map(k => load(FILES[k]))),
    Promise.all(rk.map(k => loadPath(RESULTS[k]))),
  ]);
  const D = { res: {} };
  fk.forEach((k, i) => { D[k] = files[i]; });
  rk.forEach((k, i) => { D.res[k] = res[i]; });
  return D;
}

// ---------- UI lock: the deck (a swipe row of short cards, each flips to its limits) ----------
// Every word and number on a deck card is copied from the full section drawn below it (same files, same formatting),
// so the deck can never disagree with the cards. The full sections stay on the page as the long form.
const reduced = () => document.documentElement.dataset.motion === 'calm' || matchMedia('(prefers-reduced-motion: reduce)').matches;
const pad = n => String(n).padStart(2, '0');
const txt = el => (el?.textContent || '').replace(/\s+/g, ' ').trim();
// the caveat lines that go on the back, in this order, as the full card labels them
const BACK = ['Limits', 'Honest caveat', 'Range note', 'Disclosure', 'Assumption'];

function deckCard(sec, spec, i, n) {
  const hid = `mcd-h-${spec.id}`, bid = `mcd-b-${spec.id}`;
  const badgeEl = sec.querySelector(':scope > h2 .badge')?.cloneNode(true) || null;
  const sub = txt(sec.querySelector(':scope > .sub'));
  const boxes = [...sec.querySelectorAll('.mc-stats .statbox')];
  const isRule = b => /^own pass rules?$/i.test(txt(b.querySelector('.stat-label')));
  const rule = boxes.find(isRule);
  const score = boxes.filter(b => !isRule(b)).slice(0, 2).map(b => b.cloneNode(true));
  const ruleVal = rule ? txt(rule.querySelector('.stat')?.firstChild) : '';
  const ruleState = /^met$/i.test(ruleVal) ? 'pass' : /^missed$/i.test(ruleVal) ? 'fail' : 'other';
  const scope = txt(sec.querySelector('.mc-use p'));
  // back: "Not for", the fail verdict, each caveat line, the README quotes, the pass-rule count
  const notFor = txt(sec.querySelector('.mc-not p'));
  const verdict = sec.querySelector('.mc-verdict')?.cloneNode(true) || null;
  const lines = [];
  sec.querySelectorAll('dl.made.mc').forEach(dl => dl.querySelectorAll(':scope > dt').forEach(dt => {
    const k = txt(dt); if (!BACK.includes(k)) return;
    const dd = dt.nextElementSibling; if (!dd || dd.tagName !== 'DD' || !txt(dd)) return;
    const c = h('dd', {}); dd.childNodes.forEach(x => c.append(x.cloneNode(true)));
    lines.push(h('dt', {}, k), c);
  }));
  const quotes = [...sec.querySelectorAll('.mc-quote')].map(q => q.cloneNode(true));
  const counts = [...sec.querySelectorAll('.mc-checks')].map(c => [txt(c.querySelector(':scope > h3')), txt(c.querySelector('.mc-count'))]).filter(([, v]) => v);
  const empty = !notFor && !verdict && !lines.length && !quotes.length;

  const front = h('div', { class: 'mcd-face mcd-front' },
    h('p', { class: 'mcd-k' }, h('span', {}, `Card ${pad(i + 1)} / ${pad(n)}`), badgeEl),
    h('h3', { id: hid }, spec.title),
    sub ? h('p', { class: 'mcd-q' }, sub) : null,
    score.length ? h('div', { class: 'mcd-stats' }, score) : h('p', { class: 'mcd-none' }, 'No held-out score in its files yet: see the full card.'),
    rule ? h('p', { class: 'mcd-rule', 'data-state': ruleState }, h('span', { class: 'mcd-k' }, 'Own pass rule'), h('b', {}, ruleVal)) : null,
    scope ? h('p', { class: 'mcd-use' }, h('span', { class: 'mcd-k' }, 'Use it for'), scope) : null);
  const back = h('div', { class: 'mcd-face mcd-back', id: bid, inert: true, 'aria-hidden': 'true' },
    h('p', { class: 'mcd-k' }, h('span', {}, `Limits · card ${pad(i + 1)} / ${pad(n)}`)),
    h('p', { class: 'mcd-bt' }, spec.title),
    h('div', { class: 'mcd-scroll', tabindex: '0', role: 'region', 'aria-label': `${spec.title}: limits and caveats` },
      notFor ? h('p', { class: 'mcd-not' }, h('span', { class: 'mcd-k' }, 'Not for'), notFor) : null,
      verdict,
      lines.length ? h('dl', { class: 'mcd-lim' }, lines) : null,
      quotes,
      counts.length ? h('dl', { class: 'mcd-lim mcd-counts' }, counts.flatMap(([k, v]) => [h('dt', {}, k || 'Checks'), h('dd', {}, v)])) : null,
      empty ? h('p', {}, 'This card lists no limits in its files. The full card below shows everything it has.') : null));
  const flip = h('button', { type: 'button', class: 'btn mcd-flip', 'aria-pressed': 'false', 'aria-controls': bid, 'aria-label': `Limits: ${spec.title}` }, 'Limits');
  const full = h('a', { class: 'mcd-full', href: figLink('models', spec.title), 'aria-label': `Full card: ${spec.title}` }, 'Full card');
  full.addEventListener('click', e => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button > 0) return;
    e.preventDefault(); revealFigure(sec); if (sec.dataset.fignum) setParams({ fig: sec.dataset.fignum });
  });
  const el = h('article', { class: 'mcd-card', 'aria-roledescription': 'slide', 'aria-labelledby': hid, 'data-flipped': 'false', 'data-model': spec.id },
    h('div', { class: 'mcd-flipper' }, front, back), h('div', { class: 'mcd-bar' }, flip, full));
  el.flip = (to = el.dataset.flipped !== 'true') => {
    el.dataset.flipped = String(to); flip.setAttribute('aria-pressed', String(to));
    const [show, hide] = to ? [back, front] : [front, back];
    show.inert = false; show.removeAttribute('aria-hidden'); hide.inert = true; hide.setAttribute('aria-hidden', 'true');
  };
  flip.addEventListener('click', () => el.flip());
  return el;
}

function deck(sections, ctx) {
  if (ctx?.detached) return null;              // the Sources site map: the full sections alone, nothing started
  const n = sections.length;
  const cards = sections.map((s, i) => deckCard(s, MODEL_SECTIONS[i], i, n));
  const count = h('span', { class: 'mcd-count', 'aria-hidden': 'true' }, `${pad(1)} / ${pad(n)}`);
  const prev = h('button', { type: 'button', class: 'btn mcd-nav', 'aria-label': 'Previous card' }, h('span', { 'aria-hidden': 'true' }, '←'));
  const next = h('button', { type: 'button', class: 'btn mcd-nav', 'aria-label': 'Next card' }, h('span', { 'aria-hidden': 'true' }, '→'));
  const listBtn = h('button', { type: 'button', class: 'btn mcd-list', 'aria-pressed': 'false' }, 'Show all as a list');
  const track = h('div', { class: 'mcd-track' }, cards);
  const vp = h('div', { class: 'mcd-vp' }, track);
  const root = h('section', { class: 'mcd', 'aria-labelledby': 'mcd-h' },
    h('div', { class: 'mcd-head' },
      h('h2', { id: 'mcd-h' }, 'At a glance'),
      h('p', { class: 'mcd-hint' }, 'Drag or use the arrow keys to move. Tap a card, or press Limits, to turn it over.')),
    h('div', { class: 'mcd-ctl' }, prev, count, next, listBtn),
    h('div', { class: 'mcd-stage', role: 'region', 'aria-roledescription': 'carousel', 'aria-label': 'Model cards deck' }, vp));

  let idx = 0, drag = null, ro = null, list = false, down = null;
  const maxOff = () => Math.max(0, track.scrollWidth - track.clientWidth);
  const offs = () => { const m = maxOff(); return cards.map(c => -Math.min(c.offsetLeft, m)); };
  const nearest = pos => { const o = offs(); let b = 0; o.forEach((v, i) => { if (Math.abs(v - pos) < Math.abs(o[b] - pos) - .5) b = i; }); return b; };
  const sync = () => {
    count.textContent = `${pad(idx + 1)} / ${pad(n)}`;
    prev.setAttribute('aria-disabled', String(list || idx === 0)); next.setAttribute('aria-disabled', String(list || idx === n - 1));
    cards.forEach((c, i) => c.classList.toggle('on', !list && i === idx));
  };
  const go = (i, { focus = false, say = false } = {}) => {
    if (list) return;
    const j = Math.max(0, Math.min(n - 1, i)), moved = j !== idx; idx = j; sync();
    drag?.set(offs()[idx], true);
    if (focus) cards[idx].querySelector('.mcd-flip')?.focus({ preventScroll: true });
    if (say && moved) announce(`Card ${idx + 1} of ${n}: ${MODEL_SECTIONS[idx].title}`);
  };
  const start = () => {
    if (drag || list || ctx?.detached) return;
    drag = draggable(track, {
      axis: 'x', bounds: () => [-maxOff(), 0], snap: offs,
      onMove: x => { track.style.transform = `translate3d(${x}px,0,0)`; },
      onEnd: pos => { const j = nearest(pos); if (j !== idx) { idx = j; sync(); } },
      value: offs()[idx],
    });
    drag.set(offs()[idx], false);
  };
  const stop = () => { drag?.destroy(); drag = null; track.style.transform = ''; };
  prev.addEventListener('click', () => go(idx - 1, { say: true }));
  next.addEventListener('click', () => go(idx + 1, { say: true }));
  listBtn.addEventListener('click', () => {
    list = !list; listBtn.setAttribute('aria-pressed', String(list)); root.classList.toggle('as-list', list);
    if (list) stop(); else start();
    sync(); announce(list ? `Showing all ${n} cards as a list` : 'Showing the deck');
  });
  // buttons and links inside a card never start a drag (pointer capture would swallow their click)
  // (delegated in the capture phase, so glossary buttons added later by passes.js are covered too)
  track.addEventListener('pointerdown', e => { if (e.target.closest?.('a, button, input, select, textarea, summary, [role="button"]')) e.stopPropagation(); }, true);
  // a tap (press and release within 6 px, not on a control) turns the card over
  track.addEventListener('pointerdown', e => { if (e.button > 0) return; const c = e.target.closest?.('.mcd-card'); down = c ? { c, x: e.clientX, y: e.clientY } : null; });
  track.addEventListener('pointerup', e => {
    const d = down; down = null;
    if (d && Math.abs(e.clientX - d.x) < 6 && Math.abs(e.clientY - d.y) < 6 && !getSelection()?.toString()) d.c.flip();
  });
  track.addEventListener('pointercancel', () => { down = null; });
  // arrow keys move one card (registered before draggable() so its own key handler never runs)
  track.addEventListener('keydown', e => {
    const d = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
    if (!d || list) return;
    e.preventDefault(); e.stopImmediatePropagation();
    go(idx + d, { focus: true, say: true });
  });
  track.addEventListener('focusin', e => { const c = e.target.closest?.('.mcd-card'); const i = c ? cards.indexOf(c) : -1; if (i >= 0 && i !== idx) go(i); });
  vp.addEventListener('scroll', () => { if (!list && vp.scrollLeft) vp.scrollLeft = 0; });
  root.classList.toggle('calm', reduced());
  sync();
  ctx?.onMount?.(() => {
    track.classList.add('live'); start();
    if (typeof ResizeObserver === 'function') { ro = new ResizeObserver(() => { if (drag) drag.set(offs()[idx], false); }); ro.observe(vp); }
  });
  ctx?.onLeave?.(() => { stop(); ro?.disconnect(); ro = null; });
  return root;
}

export default async function render(root, ctx) {
  const D = await loadModelData();
  const sections = MODEL_SECTIONS.map(spec => modelSection(spec, D));
  let dk = null;
  try { dk = deck(sections, ctx); } catch (e) { console.error('Model cards deck failed; the full cards are unaffected', e); }
  root.append(page('Model cards', LEAD,
    dk,
    ...sections,
    h('p', { class: 'mc-foot' }, h('small', {}, FOOT))));
}

// "The short answer": how many models met the pass rule they wrote down before testing, read from data/trust.json.
export async function short() {
  const tr = await load('trust');
  const rows = !isMissing(tr) && Array.isArray(tr.rows) ? tr.rows : null;
  if (!rows || !rows.length) return [
    `This page has ${MODEL_SECTIONS.length} model cards; each says what the model is for, what it is not for, and how it was tested.`,
    'The pass-rule summary is not available yet (data/trust.json missing).',
  ];
  const met = rows.filter(r => r.passed === true), missed = rows.filter(r => r.passed === false);
  const names = list => list.map(r => r.name.replace(/\s*\(M\d+b?\)$/, '').replace(/\?$/, '')).join('; ');
  return [
    `Each card says what the model is for, what it is not for, how it was tested, and its score with a range beside a baseline.`,
    `${met.length} of the ${rows.length} rated models and tests met the pass rule written before testing${met.length ? `: ${names(met)}` : ''}.`,
    missed.length ? `${missed.length} missed and stay on the page: ${names(missed)}.` : 'None missed.',
  ];
}

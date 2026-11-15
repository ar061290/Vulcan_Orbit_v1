// #/memory "Sixty years of fire": a museum-style history page, ported element by element from main (REBUILD_PLAN §3.3).
// Lives first, what changed after each, then the data. No page header, no fold, no short answer (site.js head:false).
// Facts: data/memory.json (status reported, each entry with its sources). Clock: data/saffire_latency.json.
// We show no photographs of accidents and quote no last words.
import { h, load, badge, page, card, empty, isMissing, announce } from '../lib.js';
import { ticking } from '../clock.js';
import { draggable } from '../spring.js';

const KIND = { loss: 'In memory', survived: 'Survived', research: 'Research', future: 'Next' };

const plaque = (e, i) => h('article', { class: `plaque ${e.kind}`, 'aria-labelledby': `pl-${i}` },
  h('div', { class: 'plaque-year', 'aria-hidden': 'true' }, e.year),
  h('div', { class: 'plaque-body' },
    h('p', { class: 'plaque-tag' }, `${KIND[e.kind] || e.kind} · ${e.date}`),
    h('h2', { id: `pl-${i}` }, e.title),
    e.where ? h('p', { class: 'plaque-where' }, e.where) : null,
    h('p', {}, e.text),
    Array.isArray(e.quote) ? h('blockquote', {}, `“${e.quote[0]}”`, h('cite', {}, e.quote[1])) : null,
    e.changed ? h('p', { class: 'plaque-changed' }, h('b', {}, 'What changed: '), e.changed) : null,
    e.note ? h('p', { class: 'plaque-note' }, e.note) : null,
    Array.isArray(e.sources) && e.sources.length
      ? h('p', { class: 'plaque-src' }, 'Sources: ', e.sources.flatMap(([t, u], k) => [k ? ' · ' : null, h('a', { href: u, target: '_blank', rel: 'noopener' }, t)]))
      : null));

// ---------- UI lock: the plaques in one row (a carousel), dragged with momentum and snapped plaque to plaque ----------
// Arrow keys and the Earlier / Later buttons move one plaque; Tab reaches every plaque and the row follows focus. The
// row scrolls inside its own overflow:hidden viewport, so the page never scrolls sideways. The year rail is the index.
const pad = n => String(n).padStart(2, '0');
function carousel(items, entries, ctx) {
  const n = items.length;
  items.forEach((p, i) => { p.tabIndex = 0; p.setAttribute('aria-roledescription', 'slide'); p.dataset.i = String(i); });
  const count = h('span', { class: 'mem-count', 'aria-hidden': 'true' }, `${pad(1)} / ${pad(n)}`);
  const prev = h('button', { type: 'button', class: 'mem-nav', 'aria-label': 'Earlier plaque' }, h('span', { 'aria-hidden': 'true' }, '← '), 'Earlier');
  const next = h('button', { type: 'button', class: 'mem-nav', 'aria-label': 'Later plaque' }, 'Later', h('span', { 'aria-hidden': 'true' }, ' →'));
  const years = entries.map((e, i) => h('button', { type: 'button', class: 'mem-yr', 'aria-label': `${e.year}: ${e.title}`, 'data-i': String(i) }, e.year));
  const track = h('div', { class: 'mem-track' }, items);
  const vp = h('div', { class: 'mem-vp' }, track);
  const region = h('section', { class: 'mem-car', 'aria-roledescription': 'carousel', 'aria-label': 'The history, one plaque at a time' },
    h('div', { class: 'mem-bar' }, prev, count, next, h('span', { class: 'mem-hint', 'aria-hidden': 'true' }, 'Drag the row, or use the arrow keys')),
    vp,
    h('nav', { class: 'mem-rail', 'aria-label': 'Jump to a year' }, years));
  if (ctx?.detached) return region;            // the Sources site map: static DOM, nothing started

  let idx = 0, drag = null, ro = null;
  const maxOff = () => Math.max(0, track.scrollWidth - track.clientWidth);
  const offs = () => { const m = maxOff(); return items.map(p => -Math.min(p.offsetLeft, m)); };
  const nearest = pos => { const o = offs(); let b = 0; o.forEach((v, i) => { if (Math.abs(v - pos) < Math.abs(o[b] - pos) - .5) b = i; }); return b; };
  const sync = () => {
    count.textContent = `${pad(idx + 1)} / ${pad(n)}`;
    prev.setAttribute('aria-disabled', String(idx === 0)); next.setAttribute('aria-disabled', String(idx === n - 1));
    years.forEach((b, i) => (i === idx ? b.setAttribute('aria-current', 'true') : b.removeAttribute('aria-current')));
  };
  const go = (i, { focus = false, say = false } = {}) => {
    const j = Math.max(0, Math.min(n - 1, i));
    const moved = j !== idx; idx = j; sync();
    drag?.set(offs()[idx], true);
    if (focus) items[idx].focus({ preventScroll: true });
    if (say && moved) announce(`Plaque ${idx + 1} of ${n}: ${entries[idx].year}, ${entries[idx].title}`);
  };
  prev.addEventListener('click', () => go(idx - 1, { say: true }));
  next.addEventListener('click', () => go(idx + 1, { say: true }));
  years.forEach((b, i) => b.addEventListener('click', () => go(i, { say: true })));
  // links inside a plaque stay links: a press on them never starts a drag (pointer capture would eat their click)
  // (delegated in the capture phase, so glossary buttons added later by passes.js are covered too)
  track.addEventListener('pointerdown', e => { if (e.target.closest?.('a, button, input, select, textarea, summary, [role="button"]')) e.stopPropagation(); }, true);
  // arrow keys: registered before draggable() so its own (track-direction) key handler never runs
  track.addEventListener('keydown', e => {
    const d = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
    if (!d) return;
    e.preventDefault(); e.stopImmediatePropagation();
    go(idx + d, { focus: true, say: true });
  });
  // Tab into a plaque: the row follows focus. The viewport never keeps a native scroll offset of its own.
  track.addEventListener('focusin', e => { const p = e.target.closest?.('.plaque'); const i = p ? items.indexOf(p) : -1; if (i >= 0 && i !== idx) go(i); });
  vp.addEventListener('scroll', () => { if (vp.scrollLeft) vp.scrollLeft = 0; });
  // the soft light over the engraved title follows a mouse pointer only (never touch or pen)
  track.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    const p = e.target.closest?.('.plaque'), t = p?.querySelector('h2'); if (!t) return;
    const r = t.getBoundingClientRect();
    p.style.setProperty('--mx', `${Math.round(e.clientX - r.left)}px`); p.style.setProperty('--my', `${Math.round(e.clientY - r.top)}px`);
    if (!p.classList.contains('lit')) { items.forEach(x => x.classList.remove('lit')); p.classList.add('lit'); }
  });
  track.addEventListener('pointerleave', () => items.forEach(x => x.classList.remove('lit')));
  sync();
  ctx?.onMount?.(() => {
    track.classList.add('live');
    drag = draggable(track, {
      axis: 'x', bounds: () => [-maxOff(), 0], snap: offs,
      onMove: x => { track.style.transform = `translate3d(${x}px,0,0)`; },
      onEnd: pos => { const j = nearest(pos); if (j !== idx) { idx = j; sync(); } },
    });
    if (typeof ResizeObserver === 'function') { ro = new ResizeObserver(() => drag?.set(offs()[idx], false)); ro.observe(vp); }
  });
  ctx?.onLeave?.(() => { drag?.destroy(); drag = null; ro?.disconnect(); ro = null; });
  return region;
}

function clockBlock(lat, ctx) {
  return h('section', { class: 'reel-clock', 'aria-labelledby': 'clk-h' },
    h('p', { class: 'reel-kicker' }, 'What the data says ', badge(isMissing(lat) ? 'missing' : lat.status)),
    h('h2', { id: 'clk-h' }, 'In a sealed cabin, fire is measured in seconds.'),
    isMissing(lat)
      ? empty('Waiting for the alarm timing', 'saffire_latency', 'Alarm timing per sensor for each Saffire-III orbital event, read from NASA telemetry (M4).',
        '{ "status":"real", "burns":[ { "channels":[ { "name":"radiometer ...", "alarm_s":7 } ] } ] }')
      : [h('p', {}, 'On NASA\'s real fire in an empty cargo ship, which sensor would have noticed first? Tap to replay.'),
        ticking(lat, { dark: true, ctx })]);
}

export default async function render(root, ctx) {
  const [m, lat] = await Promise.all([load('memory'), load('saffire_latency')]);
  if (isMissing(m) || !Array.isArray(m.entries)) {
    root.append(page('History', null,
      card('Sixty years of fire', 'missing', null,
        empty('Waiting for the history', 'memory', 'The history entries, each with its year, what happened, what changed because of it, and its sources.',
          '{ "status":"reported", "checked":"YYYY-MM-DD", "source":"...", "framing":"...",\n  "entries":[ { "year":"...", "date":"...", "kind":"loss|survived|research|future", "title":"...", "where":"...",\n    "text":"...", "changed":"...", "sources":[["title","url"]] } ],\n  "dedication":"...", "remembrance":["link text","url"] }'))));
    return;
  }
  const reel = h('section', { class: 'reel', 'aria-labelledby': 'reel-h' },
    h('div', { class: 'reel-frame' },
      h('p', { class: 'reel-kicker' }, 'A short history · Vulcan Orbit'),
      h('h1', { id: 'reel-h' }, 'Sixty years of fire'),
      m.framing ? h('p', { class: 'reel-sub' }, m.framing) : null));
  const items = m.entries.map(plaque);
  const saffire = m.entries.findIndex(e => e.kind === 'research');
  const cut = saffire >= 0 ? saffire + 1 : items.length;     // the clock sits after the first research entry (Saffire)
  const rem = Array.isArray(m.remembrance) ? m.remembrance : null;
  root.append(h('div', { class: 'page retro-page' }, h('div', { class: 'retro bleed' },
    reel,
    h('div', { class: 'retro-inner' },
      h('p', { class: 'retro-intro' }, 'Spacecraft flying today carry lessons learned from the events on this page. We tell them the way NASA does: names first, then what changed because of them.'),
      // live page: every plaque in one row, then the clock. Detached (Sources site map): main's two-column timeline.
      ctx?.detached ? [h('div', { class: 'timeline-plaques' }, items.slice(0, cut)), clockBlock(lat, ctx),
        items.length > cut ? h('div', { class: 'timeline-plaques' }, items.slice(cut)) : null]
        : [carousel(items, m.entries, ctx), clockBlock(lat, ctx)],
      m.dedication || rem ? h('section', { class: 'dedication', 'aria-label': 'Dedication' },
        m.dedication ? h('p', {}, m.dedication) : null,
        rem ? h('p', {}, h('a', { href: rem[1], target: '_blank', rel: 'noopener' }, rem[0])) : null) : null,
      h('p', { class: 'retro-foot' }, badge(m.status), ` History from public sources, checked ${m.checked}. ${m.source} We show no photographs of accidents and quote no last words.`)))));
}

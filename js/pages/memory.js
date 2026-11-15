// #/memory "Sixty years of fire": a museum-style history page, ported element by element from main (REBUILD_PLAN §3.3).
// Lives first, what changed after each, then the data. No page header, no fold, no short answer (site.js head:false).
// Facts: data/memory.json (status reported, each entry with its sources). Clock: data/saffire_latency.json.
// We show no photographs of accidents and quote no last words.
import { h, load, badge, page, card, empty, isMissing } from '../lib.js';
import { ticking } from '../clock.js';

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
      h('div', { class: 'timeline-plaques' }, items.slice(0, cut)),
      clockBlock(lat, ctx),
      items.length > cut ? h('div', { class: 'timeline-plaques' }, items.slice(cut)) : null,
      m.dedication || rem ? h('section', { class: 'dedication', 'aria-label': 'Dedication' },
        m.dedication ? h('p', {}, m.dedication) : null,
        rem ? h('p', {}, h('a', { href: rem[1], target: '_blank', rel: 'noopener' }, rem[0])) : null) : null,
      h('p', { class: 'retro-foot' }, badge(m.status), ` History from public sources, checked ${m.checked}. ${m.source} We show no photographs of accidents and quote no last words.`)))));
}

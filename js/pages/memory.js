// "Sixty years of fire": a museum-style history page. Lives first, what changed after each, then the data.
// Facts: data/memory.json (status reported, each with sources). Clock: data/saffire_latency.json.
import { h, load, badge } from '../lib.js';
import { ticking } from '../clock.js';
const KIND = { loss: 'In memory', survived: 'Survived', research: 'Research', future: 'Next' };
export default async function (root) {
  const [m, lat] = await Promise.all([load('memory'), load('saffire_latency')]);
  if (m.status === 'missing') { root.append(h('div', {}, h('h1', {}, 'History'), h('p', {}, 'Waiting for data/memory.json.'))); return; }
  const reel = h('section', { class: 'reel', 'aria-labelledby': 'reel-h' },
    h('div', { class: 'reel-frame' },
      h('p', { class: 'reel-kicker' }, 'A short history · Vulcan Orbit'),
      h('h1', { id: 'reel-h' }, 'Sixty years of fire'),
      h('p', { class: 'reel-sub' }, m.framing)));
  const card = (e, i) => h('article', { class: `plaque ${e.kind}`, 'aria-labelledby': `pl-${i}` },
    h('div', { class: 'plaque-year', 'aria-hidden': 'true' }, e.year),
    h('div', { class: 'plaque-body' },
      h('p', { class: 'plaque-tag' }, `${KIND[e.kind]} · ${e.date}`),
      h('h2', { id: `pl-${i}` }, e.title),
      h('p', { class: 'plaque-where' }, e.where),
      h('p', {}, e.text),
      e.quote ? h('blockquote', {}, `“${e.quote[0]}”`, h('cite', {}, e.quote[1])) : null,
      h('p', { class: 'plaque-changed' }, h('b', {}, 'What changed: '), e.changed),
      e.note ? h('p', { class: 'plaque-note' }, e.note) : null,
      h('p', { class: 'plaque-src' }, 'Sources: ', ...e.sources.flatMap(([t, u], k) => [k ? ' · ' : '', h('a', { href: u, target: '_blank', rel: 'noopener' }, t)]))));
  const saffire = m.entries.findIndex(e => e.kind === 'research');
  const items = m.entries.map(card);
  const clockBlock = lat.status !== 'missing' ? h('section', { class: 'reel-clock', 'aria-labelledby': 'clk-h' },
    h('p', { class: 'reel-kicker' }, 'What the data says'),
    h('h2', { id: 'clk-h' }, 'In a sealed cabin, fire is measured in seconds.'),
    h('p', {}, 'On NASA\'s real fire in an empty cargo ship, which sensor would have noticed first? Tap to replay.'),
    ticking(lat, { dark: true })) : null;
  root.append(h('div', { class: 'retro' },
    reel,
    h('div', { class: 'retro-inner' },
      h('p', { class: 'retro-intro' }, 'Spacecraft flying today carry lessons learned from the events on this page. We tell them the way NASA does: names first, then what changed because of them.'),
      h('div', { class: 'timeline-plaques' }, ...items.slice(0, saffire + 1)),
      clockBlock,
      h('div', { class: 'timeline-plaques' }, ...items.slice(saffire + 1)),
      h('section', { class: 'dedication', 'aria-label': 'Dedication' },
        h('p', {}, m.dedication),
        h('p', {}, h('a', { href: m.remembrance[1], target: '_blank', rel: 'noopener' }, m.remembrance[0]))),
      h('p', { class: 'retro-foot' }, badge(m.status), ` History from public sources, checked ${m.checked}. ${m.source} We show no photographs of accidents and quote no last words.`))));
}

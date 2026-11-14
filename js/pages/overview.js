import { h, load, page, card, badge, fmt } from '../lib.js';
import { hero } from '../hero.js';
import { replayCard } from '../detect_ui.js';
export default async function (root) {
  const [man, inv, sm, india, lat] = await Promise.all([load('manifest'), load('investigations'), load('smoke_sizes'), load('india'), load('saffire_latency')]);
  const fine = (sm.materials || []).filter(m => m.Dg_nm != null).sort((a, b) => a.Dg_nm - b.Dg_nm)[0];
  const st = n => (man.files || []).find(f => f.name === n)?.status || 'missing';
  const stage = (n, id, title, text, files) => h('a', { class: 'card stage', href: `#/${id}` }, h('div', { class: 'n' }, n), h('h2', {}, title), h('p', {}, text),
    h('div', {}, ...files.map(f => h('div', { style: 'margin-top:6px;font-size:13px;color:var(--ink2)' }, badge(st(f[0])), ' ', f[1]))));
  const n = (inv.items || []).length, det = (inv.items || []).filter(i => i.focus === 'detection').length;
  const H = hero({ g: 0, fit: 'center' });
  const gb = [];
  const gBtn = (v, label) => { const b = h('button', { type: 'button', 'aria-pressed': String(v === 0), onclick: () => { H.setG(v); gb.forEach(x => x.setAttribute('aria-pressed', String(x === b))); } }, label); gb.push(b); return b; };
  const NS = 'http://www.w3.org/2000/svg';
  const ring = document.createElementNS(NS, 'svg'); ring.setAttribute('viewBox', '0 0 600 600'); ring.setAttribute('class', 'ring'); ring.setAttribute('aria-hidden', 'true');
  ring.innerHTML = `<defs><path id="arc" d="M 300 300 m -292 0 a 292 292 0 1 1 584 0 a 292 292 0 1 1 -584 0"/></defs>
    <circle class="c" cx="300" cy="300" r="292"/><circle class="d" cx="300" cy="300" r="276"/>
    ${Array.from({ length: 72 }, (_, i) => { const a = i * 5 * Math.PI / 180, r1 = 292, r2 = i % 6 ? 286 : 280; return `<line x1="${300 + r1 * Math.cos(a)}" y1="${300 + r1 * Math.sin(a)}" x2="${300 + r2 * Math.cos(a)}" y2="${300 + r2 * Math.sin(a)}" stroke="var(--axis)" stroke-width="1"/>`; }).join('')}
    <text><textPath href="#arc" startOffset="3%">VIEWPORT · FUEL DROPLET · NOT TO SCALE · ILLUSTRATION, NOT DATA · DRAG TO TURN ·</textPath></text>`;
  const top = h('section', { class: 'hero2', 'aria-labelledby': 'hero-title' },
    h('div', {},
      h('p', { class: 'kicker' }, 'NASA Space Apps 2026 · Flame in Freefall'),
      h('h1', { id: 'hero-title' }, 'In orbit, fire doesn\'t rise. ', h('span', { class: 'lit' }, 'It hides.')),
      h('p', { class: 'hero-lead' }, 'Without gravity, flames turn into dim blue balls and smoke drifts wherever the fans push it. We used NASA\'s own space-station fire experiments to answer three questions: where is the fire, what will it do, and what puts it out.'),
      h('div', { class: 'hero-cta' }, h('a', { class: 'btn primary', href: '#/detect' }, 'Start with the fire'), h('a', { class: 'btn', href: '#/evidence' }, 'How we checked it'))),
    h('figure', { style: 'margin:0' },
      h('div', { class: 'port' }, ring, h('div', { class: 'glass' }, H.el),
        h('div', { class: 'port-ctl', role: 'group', 'aria-label': 'Gravity in the illustration' }, gBtn(0, 'In orbit'), gBtn(1, 'On Earth'))),
      h('figcaption', { class: 'port-note' }, H.ok ? 'Same droplet, same fuel. Only gravity changes.' : 'This illustration needs WebGL 2; the rest of the site works without it.')));
  const kf = (label, val, unit, status, src) => h('div', {}, h('span', { class: 'lbl' }, label), h('span', { class: 'val' }, val, unit ? h('small', {}, unit) : null), h('span', { class: 'src' }, src), h('span', {}, badge(status)));
  const q = (n, id, title, text, files) => h('a', { class: 'qn', href: `#/${id}` }, h('span', { class: 'n' }, n), h('h2', {}, title), h('p', {}, text),
    h('div', { style: 'display:flex;flex-wrap:wrap;gap:6px;margin-top:4px' }, ...files.map(f => h('span', { style: 'display:inline-flex;gap:6px;align-items:center;font-size:13px;color:var(--ink2)' }, badge(st(f[0])), f[1]))),
    h('span', { class: 'go' }, 'Open section'));
  // The one result to remember, computed from the telemetry file, with the replay right under it.
  let story = null;
  if (lat.status !== 'missing') {
    const fires = lat.burns.filter(b => b.channels.some(c => /radiometer/i.test(c.name) && c.alarm_s != null));
    const rad = Math.max(...fires.map(b => b.channels.find(c => /radiometer/i.test(c.name)).alarm_s));
    const sc = fires.map(b => b.channels.find(c => /scatter/i.test(c.name))?.alarm_s).filter(v => v != null);
    const obsNever = lat.burns.every(b => b.channels.find(c => /obscuration/i.test(c.name))?.alarm_s == null);
    story = h('section', { class: 'story', 'aria-labelledby': 'story-h' },
      h('p', { class: 'kicker' }, 'The finding'),
      h('h2', { id: 'story-h' }, `On NASA's real orbital fires, a flame light sensor noticed in ${rad} seconds. The smoke detector took ${Math.min(...sc)} to ${Math.max(...sc)} seconds.`),
      h('p', { class: 'story-sub' }, obsNever ? 'Alarm times use our own stated rule, because NASA published none. The detector\'s second smoke channel never alarmed at all. In NASA\'s later Saffire VI test, much of the hazardous gas had already been released by the time a smoke monitor reached its alarm level (ICES-2024-365). Replay it yourself:' : 'Replay it yourself:'),
      replayCard(lat),
      h('p', { class: 'story-map' }, 'The challenge asks teams to summarise, rank and interpret NASA\'s fire data. We do that as three questions:'));
  }
  root.append(top, story,
    h('nav', { class: 'qs', 'aria-label': 'The three questions' },
      q('01 · LOCATE', 'detect', 'Where is the fire?', 'Which sensor would have noticed real orbital fires first, how late, and which smoke the station detector cannot see.', [['saffire_latency', 'Saffire alarm timing'], ['smoke_sizes', 'SAME smoke sizes']]),
      q('02 · PREDICT', 'predict', 'What will it do?', 'How fast flame spreads, whether a burning droplet goes out, and where smoke drifts when nothing rises.', [['drift', 'Smoke drift'], ['models', 'Trained models']]),
      q('03 · RESPOND', 'respond', 'What puts it out?', 'What NASA found about gases that starve flames, next to our own bench trials of ion wind and fine mist.', [['flex_suppression', 'FLEX suppression'], ['response_trials', 'Bench trials']])),
    h('details', { class: 'more' }, h('summary', {}, h('span', {}, 'How to read this site'), h('small', {}, 'What the coloured stamps on every panel mean')),
      h('p', {}, 'Every panel is stamped with where its numbers come from. Only the first two are results.'),
      h('div', { class: 'readme' },
        h('div', {}, badge('real'), h('p', {}, 'From a NASA dataset we downloaded and processed ourselves.')),
        h('div', {}, badge('model'), h('p', {}, 'Our model, trained and tested on NASA data. Scores show its range.')),
        h('div', {}, badge('reported'), h('p', {}, 'Taken from a paper or a news report. Not checked by us against raw data.')),
        h('div', {}, badge('missing'), h('p', {}, 'Not measured yet. The panel says what file will fill it.'))),
      h('p', { style: 'margin:12px 0 0' }, 'Dotted words have a plain-English meaning: hover, tap or tab to them. The ', h('b', {}, 'Read your way'), ' button changes text size, colours and motion, or reads a page aloud.')),
    india.status !== 'missing' ? indiaCard(india) : null);
}
function indiaCard(d) {
  const lv = { 'official': 'real', 'official via news': 'reported', 'news only': 'demo' };
  return h('section', { class: 'card india', style: 'margin-top:20px' },
    h('div', { class: 'india-head' }, h('p', { class: 'eyebrow' }, 'From Hyderabad'), h('h2', {}, 'Why this matters for India\'s own crew and station'), badge(d.status)),
    h('p', {}, d.link),
    h('details', { class: 'fold' }, h('summary', {}, `The facts we checked, with sources (${d.facts.length})`), h('div', { class: 'grid g2', style: 'margin-top:10px' }, ...d.facts.map(f => h('div', { class: 'fact' }, h('div', { class: 'fact-top' }, h('b', {}, f.topic), h('span', { class: `lvl ${lv[f.level] || ''}` }, f.level)), h('p', {}, f.text), h('small', {}, h('a', { href: f.url, target: '_blank', rel: 'noopener' }, f.source)))))),
    h('details', { class: 'fold' }, h('summary', {}, 'What we looked for and did not find'), h('ul', {}, ...d.not_found.map(t => h('li', {}, t)))),
    h('p', {}, h('small', {}, `Checked ${d.checked}. ${d.source}`)));
}


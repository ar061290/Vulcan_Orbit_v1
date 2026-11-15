// Design kit: the Freefall design system this site is built from, measured from the live CSS so it cannot drift.
// Both themes are measured at once: a hidden probe element carries data-theme="day" / "night" and the theme tokens
// in css/tokens.css apply to any element with that attribute.
import { h, load, page, card, badge, seg, table, STATUS, isMissing } from '../lib.js';
import * as charts from '../charts.js';
import { prefs } from '../prefs.js';

// WCAG 2.2 relative luminance and contrast ratio
const lum = hex => { const c = hex.replace('#', '').match(/../g).map(x => parseInt(x, 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const toHex = v => {
  v = String(v || '').trim();
  if (v.startsWith('#')) return v.length === 4 ? '#' + [...v.slice(1)].map(c => c + c).join('') : v.slice(0, 7);
  const m = v.match(/\d+(\.\d+)?/g); return m ? '#' + m.slice(0, 3).map(n => Math.round(+n).toString(16).padStart(2, '0')).join('') : null;
};
const THEMES = [['day', 'Day'], ['night', 'Night']];
const TEXT = [['Ink', '--ink'], ['Ink 2', '--ink2'], ['Muted', '--mute'], ['Flame', '--accent'], ['Flame text', '--accent-ink'], ['Oxygen', '--oxy'], ['Good', '--good'], ['Warning', '--warn'], ['Critical', '--crit']];
const FILLS = [['Page', '--page', 'Background'], ['Card', '--surface', 'Figures'], ['Raise', '--raise', 'Wells, controls'], ['Screen', '--screen', 'Live instruments']];
// Text sizes from the "Read your way" panel (css/tokens.css --fs). WCAG "large text" starts at 24 px, or 18.66 px bold.
const SIZES = [['A', 16], ['A+', 18], ['A++', 20]];

/** Read the tokens of one theme from a hidden probe element (works on a detached page too). */
function measure(theme, names) {
  const probe = h('div', { 'data-theme': theme, 'aria-hidden': 'true', style: 'position:absolute;width:0;height:0;overflow:hidden;visibility:hidden' });
  document.body.append(probe);
  const cs = getComputedStyle(probe), out = {};
  for (const n of names) out[n] = toHex(cs.getPropertyValue(n));
  probe.remove();
  return out;
}
const verdict = (r, px) => {
  if (r >= 4.5) return '✓ AA';
  if (r >= 3) return px >= 18.66 ? '✓ bold only' : '✗ large text only';
  return '✗ decoration only';
};

export default async function render(root, ctx) {
  const names = [...TEXT, ...FILLS].map(t => t[1]).concat('--screen-ink');
  const tok = Object.fromEntries(THEMES.map(([t]) => [t, measure(t, names)]));
  const ok = THEMES.every(([t]) => tok[t]['--surface'] && tok[t]['--ink']);
  const [models, lat] = await Promise.all([load('models'), load('saffire_latency')]);

  // ---------- colour and contrast, both themes ----------
  const swatches = theme => h('div', { class: 'swatches' }, [...TEXT, ...FILLS].map(([name, v, use]) => {
    const hex = tok[theme][v] || '#000000';
    return h('div', { class: 'sw' }, h('i', { style: `background:${hex}` }), h('div', {}, h('b', {}, name), h('br'), `${v} ${hex}`, use ? [h('br'), use] : null));
  }));
  const contrastRows = theme => {
    const t = tok[theme], surf = t['--surface'];
    const rows = TEXT.map(([name, v]) => { const r = ratio(t[v], surf); return [name, h('code', {}, `${v} ${t[v]}`), `${r.toFixed(2)}:1`, ...SIZES.map(([, px]) => verdict(r, px))]; });
    const sr = ratio(t['--screen-ink'], t['--screen']);
    rows.push(['Screen ink on Screen', h('code', {}, `--screen-ink ${t['--screen-ink']}`), `${sr.toFixed(2)}:1`, ...SIZES.map(([, px]) => verdict(sr, px))]);
    return rows;
  };
  const colour = card('Colour and contrast', 'team',
    'Measured live from the site\'s own CSS for both themes. Text is checked against the card colour (WCAG 2.2: 4.5:1 for text; 3:1 for large text, which starts at 24 px, or 18.66 px bold). The three text sizes are the ones in "Read your way".',
    ok ? THEMES.map(([t, label]) => h('div', { class: 'dk-theme', 'data-theme': t },
      h('h3', {}, `${label} theme`), swatches(t),
      table(['Colour', 'Token', 'On card', ...SIZES.map(([k, px]) => `${k} (${px} px)`)], contrastRows(t), { caption: `${label} theme: text contrast against the card colour (${tok[t]['--surface']}), at each text size` })))
      : h('p', {}, 'The colour tokens could not be read from the stylesheet (css/tokens.css did not load).'),
    h('p', {}, h('small', {}, 'Verdicts: "✓ AA" passes for all text; "✓ bold only" passes for bold text at that size; "✗ large text only" passes only for text of 24 px or more; "✗ decoration only" is for backgrounds and lines, never for text. Status colours (Good, Warning, Critical) always come with words, never alone.')));
  colour.dataset.made = 'none';

  // ---------- chart series ----------
  const SERIES = charts.SERIES || [], DASH = charts.DASH || [], SHAPES = charts.SHAPES || [];
  const NS = 'http://www.w3.org/2000/svg';
  const sample = (c, i) => {
    const s = document.createElementNS(NS, 'svg'); s.setAttribute('viewBox', '0 0 120 24'); s.setAttribute('width', '120'); s.setAttribute('height', '24'); s.setAttribute('aria-hidden', 'true');
    const l = document.createElementNS(NS, 'line'); Object.entries({ x1: 4, y1: 12, x2: 84, y2: 12, stroke: c, 'stroke-width': 3, 'stroke-dasharray': DASH[i] || '' }).forEach(([k, v]) => l.setAttribute(k, v)); s.append(l);
    const shape = SHAPES[i] || 'circle', m = shape === 'square' ? ['rect', { x: 96, y: 5, width: 14, height: 14 }] : shape === 'triangle' ? ['polygon', { points: '103,4 111,20 95,20' }] : shape === 'diamond' ? ['polygon', { points: '103,3 112,12 103,21 94,12' }] : ['circle', { cx: 103, cy: 12, r: 7 }];
    const e = document.createElementNS(NS, m[0]); Object.entries({ ...m[1], fill: c }).forEach(([k, v]) => e.setAttribute(k, v)); s.append(e);
    return s;
  };
  const series = card('Chart series', 'team', 'Fixed order, never cycled; colour follows the thing, not its rank. Each series also has its own dash and point shape, and charts carry a legend or direct labels, so colour is never the only clue.',
    SERIES.length ? table(['Series', 'Colour', 'Line and point', ...THEMES.map(([t, l]) => `On ${l} card`)],
      SERIES.map((c, i) => [`Series ${i + 1}`, h('span', { class: 'dk-chip' }, h('i', { style: `background:${c}` }), h('code', {}, c)), sample(c, i),
        ...THEMES.map(([t]) => { const r = ratio(toHex(c), tok[t]['--surface'] || '#ffffff'); return `${r.toFixed(2)}:1 ${r >= 3 ? '✓ graphics' : '✗ below 3:1'}`; })]),
      { caption: 'Chart series with their dash, point shape and contrast against the card (WCAG 2.2: 3:1 for graphics)' })
      : h('p', {}, 'The chart module did not load, so its series colours cannot be shown.'));
  series.dataset.made = 'none';

  // ---------- type ----------
  const sm = isMissing(models) ? null : (models.models || []).find(m => m.id === 'smoke-miss');
  const mono = sm && sm.score != null && Array.isArray(sm.score_range)
    ? h('div', { class: 'dk-mono' }, `${sm.score} [${Number(sm.score_range[0]).toFixed(2)}, ${Number(sm.score_range[1]).toFixed(2)}]`)
    : h('div', { class: 'dk-mono' }, 'No data yet');
  const type = card('Type', 'team', 'Three families for the site, two more for the History page, each with one job.',
    h('div', { class: 'typescale' },
      h('div', { class: 'dk-display' }, 'Bricolage Grotesque'),
      h('small', {}, 'Display · headlines and figure titles · 650–800'),
      h('div', { class: 'dk-body' }, 'Atkinson Hyperlegible is the body face. The Braille Institute designed it so letters like I, l and 1 never look alike.'),
      h('small', {}, 'Body · 16 px base, 18 and 20 px in larger text modes · line length about 68 characters'),
      mono,
      h('small', {}, 'IBM Plex Mono · numbers, ranges, labels, figure numbers. ',
        sm ? ['Sample: the smoke-miss model\'s AUC and its range, read from data/models.json ', badge(sm.status || models.status)] : 'Sample: data/models.json is missing, so no number is shown.'),
      h('div', { class: 'dk-caslon' }, 'Libre Caslon Text'),
      h('small', {}, 'History page · titles, plaques and the dedication'),
      h('div', { class: 'dk-elite' }, 'Special Elite'),
      h('small', {}, 'History page · years, tags and captions, like a typewritten archive label')));

  // ---------- components ----------
  const fires = isMissing(lat) || !Array.isArray(lat.burns) ? [] : lat.burns.filter(b => b.channels.some(c => /radiometer/i.test(c.name) && c.alarm_s != null));
  const radAlarm = fires.length ? Math.max(...fires.map(b => b.channels.find(c => /radiometer/i.test(c.name)).alarm_s)) : null;
  const chipRow = h('div', { class: 'row', role: 'group', 'aria-label': 'Example chips' });
  ['Selected', 'Option', 'Option'].forEach((t, i) => chipRow.append(h('button', { type: 'button', class: 'chip', 'aria-pressed': String(i === 0), onclick: e => { chipRow.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', String(c === e.currentTarget))); } }, t)));
  const components = card('Components', 'team', 'The pieces every page is built from. The controls here are real and work.',
    h('div', { class: 'row' }, h('a', { class: 'btn primary', href: '#/detect' }, 'Primary action →'), h('a', { class: 'btn', href: '#/evidence' }, 'Secondary')),
    chipRow,
    h('div', { class: 'row dk-stamps' }, Object.keys(STATUS).map(s => badge(s))),
    seg({ label: 'Light (this one switches the theme)', options: [['day', 'Day'], ['night', 'Night']], value: prefs.get('theme'), onChange: v => prefs.set('theme', v) }),
    h('p', {}, 'A science word such as microgravity is explained where it appears.'),
    h('div', { class: 'lamps' }, h('div', { class: 'lamp on', style: `--c:${SERIES[0] || '#3987e5'}` }, h('i'), h('span', {}, 'Sensor lamp'),
      h('b', {}, radAlarm != null ? `alarm at ${radAlarm} s` : 'alarm time: no data yet'))),
    h('p', {}, h('small', {}, radAlarm != null ? `The lamp shows the flame light sensor's alarm time on NASA's Saffire-III burns, read from data/saffire_latency.json (our stated alarm rule).` : 'data/saffire_latency.json is missing, so the lamp shows no time.')));

  // ---------- built for every reader ----------
  const rules = [
    ['Read your way panel: ', 'Day or Night, three text sizes, science-word explanations on or off, Calm motion, and read-aloud of the current page. Choices stay on this device.'],
    ['Keyboard: ', 'a skip link, a visible focus ring on everything, and Escape closes the panel, the menus and tooltips. Every control is a real button, link or form field with a visible label and its pressed or open state set.'],
    ['Charts: ', 'each chart is one tab stop; the arrow keys step through its values and show the same tooltip as the mouse. "Show the numbers" opens the chart\'s data as a table. Series differ by dash or shape as well as colour.'],
    ['Finding things: ', '"On this page" lists every figure, including the folded ones. A figure link such as #/design?fig=2 opens its fold and scrolls to it. The Sources page has a site map of every page and figure.'],
    ['Screen readers: ', 'one h1 per page, labelled landmarks, charts with role="img" and a label, and one polite live region that announces a verdict or a risk level only when it changes.'],
    ['Motion: ', 'follows the system "reduce motion" setting. Calm turns off page transitions, card animations and the illustrations\' movement. Nothing flashes more than three times a second.'],
    ['Colour and layout: ', 'text contrast is measured above for both themes. Status is shown by words on stamps, not colour alone. Pages work at 320 px wide and at 200% zoom; only tables scroll sideways. Windows high-contrast mode is respected.'],
    ['Still to do by hand: ', 'a full screen-reader pass (NVDA and VoiceOver) and a check of every chart\'s text alternative.'],
  ];
  const built = card('Built for every reader', 'team', 'What the site does, and what we still have to check by hand.',
    h('ul', { class: 'rules' }, rules.map(([b, t]) => h('li', {}, h('b', {}, b), t))));

  root.append(page('Freefall',
    'The design system behind Vulcan Orbit: a field manual for fire in orbit. Paper for reading, dark screens for live instruments, a porthole for the flame, and a stamp on every number saying where it came from. This page is drawn from the same CSS the site uses, so it cannot drift from it.',
    h('div', { class: 'grid g4' },
      card('Paper and screens', 'team', null, h('p', {}, 'Reading happens on calm paper (Day) or the dark side of orbit (Night). Anything live, like a replay or a simulation, sits in a dark screen in both themes.')),
      card('Every figure is numbered', 'team', null, h('p', {}, 'Each figure carries a "Figure N" label. "On this page" and figure links use the same number, so a judge or teammate can point at "figure 7".')),
      card('Stamp the source', 'team', null, h('p', {}, 'Each figure carries one stamp saying where its numbers come from: NASA data, model output, reported, demo, plan, team choice, or no data yet. Nothing unstamped is a result.')),
      card('Plain words first', 'team', null, h('p', {}, 'Headlines say what happened in everyday words. Science words are dotted and explained in place. Numbers come with units and a range.'))),
    colour,
    series,
    h('div', { class: 'grid g2' }, type, components),
    built));
  void ctx;
}

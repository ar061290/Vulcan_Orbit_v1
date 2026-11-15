// Design kit (v3, "Ember on ink"): the design system this site is built from, measured from the live CSS so it cannot drift.
// Both themes are measured at once: a hidden probe element carries data-theme="day" / "night" and the theme tokens
// in css/tokens.css apply to any element with that attribute. Every swatch, size, space and contrast ratio below is read
// from getComputedStyle at render time; nothing is typed in by hand.
import { h, load, page, card, badge, seg, table, numField, stat, STATUS, isMissing } from '../lib.js';
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
const THEMES = [['night', 'Night'], ['day', 'Day']];
// text colours, measured on each surface
const TEXT = [['Ink', '--ink', 'Headlines, body'], ['Ink 2', '--ink-2', 'Secondary text'], ['Muted', '--mute', 'Labels, captions'],
  ['Flame text', '--accent-ink', 'Accent words'], ['Oxygen', '--oxy', 'Links, focus ring'], ['Good', '--good', 'Pass, with a word'],
  ['Warning', '--warn', 'Extrapolated, with a word'], ['Critical', '--crit', 'Fail, with a word']];
const FILLS = [['Background', '--bg', 'The page'], ['Panel', '--panel', 'Figures, popovers'], ['Panel 2', '--panel-2', 'Wells, open panels'],
  ['Line', '--line', 'Borders'], ['Line 2', '--line-2', 'Controls, strong borders'], ['Flame', '--accent', 'One thing per screen']];
const SURF = [['bg', '--bg'], ['panel', '--panel'], ['panel 2', '--panel-2']];
const STAMPS = [['NASA data, dome, model', '--st-real'], ['Reported', '--st-reported'], ['Demo', '--st-demo'], ['No data yet', '--st-missing'], ['Plan', '--st-plan'], ['Team', '--st-team']];
const FIRE = [['Ember', '--ember'], ['Fire', '--fire'], ['Amber', '--amber'], ['Hot', '--hot']];
const TYPE = [['--t1', 'Labels, stamps, figure numbers', 'mono'], ['--t2', 'Secondary text, tables, controls', 'body'], ['--t3', 'Body text', 'body'],
  ['--t4', 'Figure titles, lead', 'display'], ['--t5', 'Page titles, stat tiles', 'display'], ['--t6', 'The huge numbers, the Home headline', 'mono']];
const SPACE = ['--s1', '--s2', '--s3', '--s4', '--s5', '--s6', '--s7', '--s8', '--s9'];
// Text sizes from the "Read your way" panel (css/tokens.css --fs). WCAG "large text" starts at 24 px, or 18.66 px bold.
const SIZES = [['A', 16], ['A+', 18], ['A++', 20]];

/** Read the tokens of one theme from a hidden probe element (works on a detached page too). */
function measure(theme, names, raw = false) {
  const probe = h('div', { 'data-theme': theme, 'aria-hidden': 'true', style: 'position:absolute;width:0;height:0;overflow:hidden;visibility:hidden' });
  document.body.append(probe);
  const cs = getComputedStyle(probe), out = {};
  for (const n of names) { const v = cs.getPropertyValue(n); out[n] = raw ? v.trim() : toHex(v); }
  probe.remove();
  return out;
}
/** A length token resolved to px (rem and clamp() included), measured on a probe. */
function px(token) {
  const probe = h('div', { 'aria-hidden': 'true', style: `position:absolute;visibility:hidden;width:var(${token});height:0` });
  document.body.append(probe); const w = probe.getBoundingClientRect().width; probe.remove();
  return Math.round(w * 10) / 10;
}
const verdict = r => (r >= 4.5 ? '✓ AA' : r >= 3 ? '✗ large text only' : '✗ decoration only');

export default async function render(root, ctx) {
  const names = [...TEXT, ...FILLS, ...STAMPS, ...FIRE].map(t => t[1]).concat('--screen', '--screen-ink', '--accent-on');
  const tok = Object.fromEntries(THEMES.map(([t]) => [t, measure(t, names)]));
  const ok = THEMES.every(([t]) => tok[t]['--panel'] && tok[t]['--ink']);
  const raw = measure('night', ['--display', '--font', '--mono', '--r', '--r2', ...TYPE.map(t => t[0]), ...SPACE], true);
  const [models, lat] = await Promise.all([load('models'), load('saffire_latency')]);

  // ---------- intro: the four rules of the system ----------
  const principle = (title, text) => { const c = card(title, 'team', null, h('p', {}, text)); c.dataset.made = 'none'; return c; };
  const intro = h('div', { class: 'grid g4 dk-intro' },
    principle('Ink first', 'Dark is the main theme: a deep space-ink page with stars behind it. Day is a clean, cool light theme for print and bright rooms. Both pass WCAG AA.'),
    principle('One accent', 'Flame orange marks the single most important thing on a screen: the current page, the main button, the risk level. Everything else is neutral. Oxygen blue is for links and focus.'),
    principle('Stamp the source', 'Each figure carries one stamp saying where its numbers come from: NASA data, model output, reported, demo, plan, team choice, or no data yet. Nothing unstamped is a result.'),
    principle('Real data decorates', 'The flame, the drift map and the big result numbers do the visual work. Flat panels, 1 px lines, corners of 0 to 6 px, and no shadows except on popovers.'));

  // ---------- colour and contrast, both themes ----------
  const swatch = (theme, [name, v, use]) => {
    const hex = tok[theme][v] || '#000000';
    return h('div', { class: 'sw' }, h('i', { style: `background:${hex}` }), h('div', {}, h('b', {}, name), h('br'), h('code', {}, `${v}`), ' ', hex, use ? [h('br'), h('span', {}, use)] : null));
  };
  const contrastRows = theme => {
    const t = tok[theme];
    return TEXT.map(([name, v]) => {
      const rs = SURF.map(([, s]) => ratio(t[v], t[s])), worst = Math.min(...rs);
      return [name, h('code', {}, `${v} ${t[v]}`), ...rs.map(r => h('span', { class: 'num' }, `${r.toFixed(2)}:1`)), verdict(worst)];
    }).concat([(() => { const r = ratio(t['--accent-on'], t['--accent']); return ['Text on flame button', h('code', {}, `--accent-on ${t['--accent-on']}`), h('span', { class: 'num' }, `${r.toFixed(2)}:1 on flame`), '', '', verdict(r)]; })(),
      (() => { const r = ratio(t['--screen-ink'], t['--screen']); return ['Screen ink on screen', h('code', {}, `--screen-ink ${t['--screen-ink']}`), h('span', { class: 'num' }, `${r.toFixed(2)}:1 on screen`), '', '', verdict(r)]; })()]);
  };
  const colour = card('Colour and contrast', 'team',
    'Measured live from the site\'s own CSS for both themes. Every text colour is checked against all three surfaces (WCAG 2.2: 4.5:1 for text; 3:1 for large text, which starts at 24 px, or 18.66 px bold). The verdict uses the worst of the three. Ratios do not change with the A / A+ / A++ text sizes, which only make text larger.',
    ok ? THEMES.map(([t, label]) => h('div', { class: 'dk-theme', 'data-theme': t },
      h('h3', {}, `${label} theme`),
      h('div', { class: 'swatches' }, [...FILLS, ...TEXT].map(s => swatch(t, s))),
      table(['Colour', 'Token', 'On bg', 'On panel', 'On panel 2', 'Verdict'], contrastRows(t), { caption: `${label} theme: text contrast measured against --bg ${tok[t]['--bg']}, --panel ${tok[t]['--panel']} and --panel-2 ${tok[t]['--panel-2']}` })))
      : h('p', {}, 'The colour tokens could not be read from the stylesheet (css/tokens.css did not load).'),
    h('p', {}, h('small', {}, '"✓ AA" passes for all text. "✗ large text only" would pass only for text of 24 px or more; "✗ decoration only" is for backgrounds and lines, never for text. Good, Warning and Critical always come with a word, never alone.')));
  colour.dataset.made = 'none';

  // ---------- status colours and the stamp ----------
  const stamps = card('Status stamps', 'team', 'One style for every stamp: a word in mono capitals, a thin border, and a small coloured square. The word carries the meaning; the colour only helps the eye.',
    h('div', { class: 'row dk-stamps' }, Object.keys(STATUS).map(s => badge(s))),
    ok ? table(['Stamp', 'Token', ...THEMES.map(([, l]) => `${l}`), ...THEMES.map(([, l]) => `On ${l} panel`)],
      STAMPS.map(([name, v]) => [name, h('code', {}, v), ...THEMES.map(([t]) => h('span', { class: 'dk-chip' }, h('i', { style: `background:${tok[t][v]}` }), h('code', {}, tok[t][v]))),
        ...THEMES.map(([t]) => { const r = ratio(tok[t][v], tok[t]['--panel']); return h('span', { class: 'num' }, `${r.toFixed(2)}:1 ${r >= 3 ? '✓' : '✗'}`); })]),
    { caption: 'Stamp square colours, measured against the panel (WCAG 2.2: 3:1 for graphics)' }) : null);
  stamps.dataset.made = 'none';

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
    SERIES.length ? table(['Series', 'Colour', 'Line and point', ...THEMES.map(([, l]) => `On ${l} panel`)],
      SERIES.map((c, i) => [`Series ${i + 1}`, h('span', { class: 'dk-chip' }, h('i', { style: `background:${c}` }), h('code', {}, c)), sample(c, i),
        ...THEMES.map(([t]) => { const r = ratio(toHex(c), tok[t]['--panel'] || '#ffffff'); return h('span', { class: 'num' }, `${r.toFixed(2)}:1 ${r >= 3 ? '✓ graphics' : '✗ below 3:1'}`); })]),
      { caption: 'Chart series with their dash, point shape and contrast against the panel (WCAG 2.2: 3:1 for graphics)' })
      : h('p', {}, 'The chart module did not load, so its series colours cannot be shown.'));
  series.dataset.made = 'none';

  // ---------- type: six sizes, three families ----------
  const fires = isMissing(lat) || !Array.isArray(lat.burns) ? [] : lat.burns.filter(b => b.channels.some(c => /radiometer/i.test(c.name) && c.alarm_s != null));
  const radAlarm = fires.length ? Math.max(...fires.map(b => b.channels.find(c => /radiometer/i.test(c.name)).alarm_s)) : null;
  const sm = isMissing(models) ? null : (models.models || []).find(m => m.id === 'smoke-miss');
  const monoSample = sm && sm.score != null && Array.isArray(sm.score_range)
    ? `${sm.score} [${Number(sm.score_range[0]).toFixed(2)}, ${Number(sm.score_range[1]).toFixed(2)}]` : null;
  const fam = { display: 'dk-f-display', body: 'dk-f-body', mono: 'dk-f-mono' };
  const type = card('Type', 'team', 'Six sizes, no more, in rem so the A / A+ / A++ text sizes scale all of them. Three families, each with one job; two more appear only on the History page.',
    h('div', { class: 'dk-scale' }, TYPE.map(([v, use, f]) => h('div', { class: 'dk-step' },
      h('div', { class: 'dk-step-k' }, h('code', {}, v), h('span', { class: 'num' }, `${px(v)} px`), h('small', {}, use)),
      h('div', { class: `dk-step-s ${fam[f]}`, style: `font-size:var(${v})` }, f === 'mono' ? (v === '--t6' ? (radAlarm != null ? `${radAlarm} s` : 'Aa') : 'Fig. 3 · NASA data') : f === 'display' ? 'Where is the fire?' : 'Smoke drifts wherever the fans push it.')))),
    h('div', { class: 'dk-fams' },
      h('div', {}, h('p', { class: 'dk-f-display dk-fam' }, 'Archivo'), h('small', {}, 'Display: headlines, figure titles, the brand. Its width axis gives the wide headline cut (font-stretch 112–125%). ', h('code', {}, raw['--display'].split(',')[0]))),
      h('div', {}, h('p', { class: 'dk-f-body dk-fam' }, 'Atkinson Hyperlegible'), h('small', {}, 'Body, kept on purpose: the Braille Institute designed it so letters like I, l and 1 never look alike. 16 px base, 18 and 20 px in larger text modes, lines of 60 to 75 characters.')),
      h('div', {}, h('p', { class: 'dk-f-mono dk-fam' }, monoSample || 'No data yet'), h('small', {}, 'IBM Plex Mono: every number, range, label and figure number, with tabular figures so columns line up. ',
        sm ? ['Sample: the smoke-miss model\'s AUC and its range, read from data/models.json ', badge(sm.status || models.status)] : 'Sample: data/models.json is missing, so no number is shown.'))),
    h('p', { class: 'dk-history' }, h('span', { class: 'dk-caslon' }, 'Libre Caslon Text'), ' and ', h('span', { class: 'dk-elite' }, 'Special Elite'), h('small', {}, ' History page only: plaques, years and archive labels.')));
  type.dataset.made = 'none';

  // ---------- spacing and radius ----------
  const space = card('Spacing and radius', 'team', 'One spacing scale on a 4 px base, used for every gap, padding and margin. Corners are 0 to 6 px; nothing is pill-shaped.',
    h('div', { class: 'dk-space' }, SPACE.map(v => { const w = px(v); return h('div', { class: 'dk-sp' }, h('code', {}, v), h('span', { class: 'num' }, `${w} px`), h('i', { style: `width:${w}px` })); })),
    h('div', { class: 'dk-radii' }, [['0', '0'], ['--r', 'var(--r)'], ['--r2', 'var(--r2)']].map(([k, v]) => h('div', { class: 'dk-rad' }, h('i', { style: `border-radius:${v}` }), h('code', {}, k), h('span', { class: 'num' }, k === '0' ? '0 px' : raw[k])))));
  space.dataset.made = 'none';

  // ---------- components ----------
  const chipRow = h('div', { class: 'row', role: 'group', 'aria-label': 'Example chips' });
  ['Selected', 'Option', 'Option'].forEach((t, i) => chipRow.append(h('button', { type: 'button', class: 'chip', 'aria-pressed': String(i === 0), onclick: e => { chipRow.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', String(c === e.currentTarget))); } }, t)));
  // "How this was made": the same markup js/provenance.js builds, with specimen text
  const madeSpec = h('details', { class: 'madeby dk-madeby' },
    h('summary', {}, h('span', { class: 'mb-btn' }, 'How this was made'), h('small', { class: 'mb-kind' }, 'Specimen · the button every data figure carries')),
    h('dl', { class: 'made' }, h('dt', {}, 'Method'), h('dd', {}, 'Opens inline under the figure title: method, inputs, the NASA data it was checked against, the files that rebuild it, and the trust strip.'),
      h('dt', {}, 'Files'), h('dd', {}, h('code', {}, 'js/provenance.js'))));
  const moreSpec = h('details', { class: 'more dk-more' }, h('summary', {}, h('span', {}, 'Show 2 more figures'), h('small', {}, 'The page fold, as every app page uses it')),
    h('p', {}, 'Folded figures still appear in "On this page", and a figure link opens the fold.'));
  const demoTable = table(['Burn', 'Sensor', 'Alarm (s)'],
    fires.slice(0, 4).map(b => { const c = b.channels.find(x => /radiometer/i.test(x.name)); return [b.label || b.id || b.name || 'Burn', c.name, h('span', { class: 'num' }, String(c.alarm_s))]; }),
    { caption: 'A dense app table: numbers right-aligned in tabular figures (radiometer alarm times from data/saffire_latency.json)' });
  demoTable.querySelectorAll('th')[2]?.classList.add('num');
  demoTable.querySelectorAll('tbody td:last-child').forEach(td => td.classList.add('num'));
  const components = card('Components', 'team', 'The pieces every page is built from. The controls here are real and work.',
    h('div', { class: 'row' }, h('a', { class: 'btn primary', href: '#/detect' }, 'Primary action →'), h('a', { class: 'btn', href: '#/evidence' }, 'Secondary')),
    chipRow,
    seg({ label: 'Light (this one switches the theme)', options: [['day', 'Day'], ['night', 'Night']], value: prefs.get('theme'), onChange: v => prefs.set('theme', v) }),
    numField({ id: 'dk-nf', label: 'Example slider', unit: '% O₂', min: 15, max: 40, step: 1, value: 21 }),
    h('div', { class: 'dk-stats' }, stat('Flame sensor alarm', radAlarm != null ? String(radAlarm) : 'n/a', radAlarm != null ? 's' : 'no data yet'), stat('Smoke-miss model AUC', sm && sm.score != null ? String(sm.score) : 'n/a', sm && Array.isArray(sm.score_range) ? `${Number(sm.score_range[0]).toFixed(2)}–${Number(sm.score_range[1]).toFixed(2)}` : 'no data yet')),
    fires.length ? demoTable : h('p', {}, 'data/saffire_latency.json is missing, so the table specimen has no rows.'),
    madeSpec, moreSpec,
    h('p', {}, 'A science word such as microgravity is explained where it appears.'),
    h('div', { class: 'lamps' }, h('div', { class: 'lamp on', style: `--c:${SERIES[0] || '#4d8fe8'}` }, h('i'), h('span', {}, 'Sensor lamp'),
      h('b', {}, radAlarm != null ? `alarm at ${radAlarm} s` : 'alarm time: no data yet'))),
    h('p', {}, h('small', {}, radAlarm != null ? 'The stat tile, table and lamp show the flame light sensor\'s alarm times on NASA\'s Saffire-III burns, read from data/saffire_latency.json (our stated alarm rule). The second tile is the smoke-miss model AUC and range from data/models.json.' : 'data/saffire_latency.json is missing, so the lamp shows no time.')));
  components.dataset.made = 'none';

  // ---------- fire palette and the signature effects ----------
  const fx = [
    ['Background stars', 'Sparse, tiny, slightly warm stars twinkling slowly behind every page in the Night theme. None in Day.', 'A still frame of stars.', 'Canvas 2D; nothing needed.'],
    ['Crosshair cursor', 'A dot with thin full-screen hairlines. Over anything you can press it becomes a flame ring; over text the normal cursor returns; over charts the hairlines are a reading guide.', 'Off: the normal cursor returns.', 'DOM only. Off on touch screens.'],
    ['Fire trail', 'Home story only: the pointer leaves curling ember-to-smoke trails under the text, capped so text keeps AA contrast.', 'Off.', 'Off without WebGL. Off on touch screens and in Day.'],
    ['Fire noise', 'A slow warped ember glow with fine grain and faint scanlines, behind the Home finding and the closing call to action; a thin band in the sidebar head and the Assess risk card at High.', 'One still frame.', 'A still CSS gradient.'],
    ['Star journey', 'About one second of stars streaking toward you when you press "Open the full assessment" or "Start", then the app appears.', 'Skipped: the link opens at once.', 'Skipped.'],
    ['Gravity points', 'Home "Why it happens": motes drift with the cabin air and have no "down" until you turn gravity on. Labelled "Illustration, not data".', 'A still frame; the button still switches it.', 'Canvas 2D; nothing needed.'],
  ];
  const fire = card('Fire palette and effects', 'team', 'The fire palette is only for the illustrations and effects, never for text or data. Effects are decoration: they never cover content, never take a click, never flash, share one animation loop and pause off screen. "Effects: Off" in Read your way stops all of them without changing Motion.',
    ok ? h('div', { class: 'dk-fire' }, FIRE.map(([n, v]) => h('div', { class: 'dk-fire-s' }, h('i', { style: `background:${tok.night[v]}` }), h('b', {}, n), h('code', {}, `${v} ${tok.night[v]}`)))) : null,
    table(['Effect', 'What it does', 'Calm, reduced motion or Effects off', 'No WebGL or touch'], fx, { caption: 'The signature effects and how each one steps back' }));
  fire.dataset.made = 'none';

  // ---------- built for every reader ----------
  const rules = [
    ['Read your way panel: ', 'Day or Night, three text sizes, science-word explanations on or off, Calm motion, Effects on or off, and read-aloud of the current page. Choices stay on this device.'],
    ['Keyboard: ', 'a skip link, a visible focus ring on everything, and Escape closes the panel, the menu drawer, the data status list and tooltips. Every control is a real button, link or form field with a visible label and its pressed or open state set.'],
    ['Charts: ', 'each chart is one tab stop; the arrow keys step through its values and show the same tooltip as the mouse. "Show the numbers" opens the chart\'s data as a table. Series differ by dash or shape as well as colour.'],
    ['Finding things: ', 'the sidebar groups every page into Pipeline, Science, Trust and More. "On this page" lists every figure, including the folded ones; a figure link such as #/design?fig=2 opens its fold and scrolls to it.'],
    ['Screen readers: ', 'one h1 per page, labelled landmarks, charts with role="img" and a label, and one polite live region that announces a verdict or a risk level only when it changes. Effects are aria-hidden.'],
    ['Motion: ', 'follows the system "reduce motion" setting. Calm turns off page transitions, reveals, the illustrations\' movement and every effect. Nothing flashes more than three times a second.'],
    ['Colour and layout: ', 'text contrast is measured above for both themes. Status is shown by words on stamps, not colour alone. Pages work at 320 px wide and at 200% zoom; only tables scroll sideways. Windows high-contrast mode is respected.'],
    ['Still to do by hand: ', 'a full screen-reader pass (NVDA and VoiceOver) and a check of every chart\'s text alternative.'],
  ];
  const built = card('Built for every reader', 'team', 'What the site does, and what we still have to check by hand.',
    h('ul', { class: 'rules' }, rules.map(([b, t]) => h('li', {}, h('b', {}, b), t))));
  built.dataset.made = 'none';

  root.append(page('Ember on ink',
    'The design system behind Vulcan Orbit, version 3: a deep space-ink page, flame orange for the one thing that matters on each screen, and a stamp on every number saying where it came from. This page is drawn from the same CSS the site uses, so it cannot drift from it.',
    intro,
    colour,
    type,
    h('div', { class: 'grid g2 dk-pair' }, space, stamps),
    components,
    series,
    fire,
    built));
  void ctx;
}

// Design kit: the Freefall design system this site is built from, measured from the live CSS so it cannot drift.
// Both themes are measured at once: a hidden probe element carries data-theme="day" / "night" and the theme tokens
// in css/tokens.css apply to any element with that attribute.
// Merged kit (UI lock + site v3): the UI-lock tokens, type scale and motion curves (with their easing dots); from v3
// the contrast table measured on all three surfaces with a worst-case verdict, the status stamps measured live, the
// spacing and radius scale, the extra component specimens, and the cursor and effects section (the crosshair cursor
// states and the Read your way Effects switch). Every swatch, size and ratio is read with getComputedStyle at render
// time; nothing is typed in by hand.
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
const THEMES = [['day', 'Day'], ['night', 'Night']];
const TEXT = [['Ink', '--ink'], ['Ink 2', '--ink2'], ['Muted', '--mute'], ['Flame', '--accent'], ['Flame text', '--accent-ink'], ['Oxygen', '--oxy'], ['Good', '--good'], ['Warning', '--warn'], ['Critical', '--crit']];
// v3: every text colour is measured on all three surfaces; the verdict uses the worst of them
const SURF = [['page', '--page'], ['surface', '--surface'], ['raise', '--raise']];
// UI lock spacing (8 px steps) and corners, read live (v3's "Spacing and radius" figure, on the lock's scale)
const SPACE = ['--sp1', '--sp2', '--sp3', '--sp4', '--sp6', '--sp8'];
const RADII = [['0', null], ['Data', '--r-data'], ['Panel', '--r-panel']];
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
// ---------- UI lock tokens (css/tokens.css): read live, never retyped ----------
const LOCK_COLOURS = [['Page', '--page', 'Background'], ['Surface', '--surface', 'Panels'], ['Line', '--line', 'Rules, panel edges'],
  ['Ink', '--ink', 'Text'], ['Muted', '--mute', 'Labels, captions'], ['Fire', '--fire', 'Earth flames, alarms, one call to action'], ['Orbit', '--orbit', '0 g flames, live data traces']];
const CURVES = [['In', '--ease-in', '--t-in', 'Things arriving: page blocks, words, panels'], ['Move', '--ease-move', '--t-move', 'Things travelling: the camera between tabs, drawings'],
  ['Micro', null, '--t-micro', 'Hover and press feedback (the browser\'s default ease)']];
/** Raw token strings of one theme (custom properties inherit, so :root tokens read through the probe too). */
function raw(theme, names) {
  const probe = h('div', { 'data-theme': theme, 'aria-hidden': 'true', style: 'position:absolute;width:0;height:0;overflow:hidden;visibility:hidden' });
  document.body.append(probe);
  const cs = getComputedStyle(probe), out = {};
  for (const n of names) out[n] = cs.getPropertyValue(n).trim();
  probe.remove();
  return out;
}
/** Computed font size and line height of a specimen styled with `font`, measured on a hidden probe. */
function fontSize(font) {
  const probe = h('div', { 'aria-hidden': 'true', style: `position:absolute;visibility:hidden;white-space:nowrap;font:${font}` }, 'Ag');
  document.body.append(probe);
  const cs = getComputedStyle(probe), out = { size: cs.fontSize, line: cs.lineHeight, family: cs.fontFamily.split(',')[0].replace(/["']/g, '') };
  probe.remove();
  return out;
}
const bez = v => { const m = String(v || '').match(/cubic-bezier\(([^)]+)\)/); const n = m ? m[1].split(',').map(Number) : null; return n && n.length === 4 && n.every(Number.isFinite) ? n : null; };
const SVGNS = 'http://www.w3.org/2000/svg';
function curveSvg(b) {
  const s = document.createElementNS(SVGNS, 'svg'); s.setAttribute('viewBox', '0 0 64 64'); s.setAttribute('aria-hidden', 'true'); s.setAttribute('class', 'dk-curve');
  const p = (d, cls) => { const e = document.createElementNS(SVGNS, 'path'); e.setAttribute('d', d); e.setAttribute('class', cls); s.append(e); };
  p('M2 62H62M2 62V2', 'ax');
  p(`M2 62C${2 + b[0] * 60} ${62 - b[1] * 60} ${2 + b[2] * 60} ${62 - b[3] * 60} 62 2`, 'cv');
  return s;
}

function lockCards(ctx) {
  const night = raw('night', LOCK_COLOURS.map(c => c[1])), day = raw('day', LOCK_COLOURS.map(c => c[1]));
  const okc = LOCK_COLOURS.every(([, v]) => night[v]);
  const colours = card('Mission console colours', 'team', 'The UI-lock palette, read live from css/tokens.css. Night is the default; the Day theme keeps light values under the same names. Fire and orbit are the same in both.',
    okc ? h('div', { class: 'dk-lock-sw' }, LOCK_COLOURS.map(([name, v, use]) => h('div', { class: 'dk-lsw' },
      h('i', { style: `background:${night[v]}`, 'aria-hidden': 'true' }),
      h('b', {}, name), h('code', {}, v),
      h('span', {}, `Night ${night[v]}`), day[v] && day[v] !== night[v] ? h('span', {}, `Day ${day[v]}`) : null,
      h('small', {}, use))))
      : h('p', {}, 'The colour tokens could not be read from the stylesheet (css/tokens.css did not load).'));
  colours.dataset.made = 'none';

  const t = raw('night', ['--display-xl', '--label', '--font', '--display', '--mono']);
  const dx = fontSize('var(--display-xl)'), lb = fontSize('var(--label)'), bd = fontSize(`1rem/1.625 var(--font)`);
  const spec = (cls, sample, name, token, m) => h('div', { class: `dk-spec ${cls}` },
    h('div', { class: 'dk-spec-k' }, h('span', {}, name), h('code', {}, token)),
    h('div', { class: 'dk-spec-s' }, sample),
    h('div', { class: 'dk-spec-m' }, `${m.family} · size ${m.size} · line ${m.line}`));
  const scale = card('Type scale', 'team', 'Three jobs, three faces. Sizes are measured from the live CSS at this screen width (the display size scales with the window).',
    spec('dk-s-display', 'Flame in freefall', 'Display', `--display-xl: ${t['--display-xl'] || 'not set'}`, dx),
    spec('dk-s-label', 'Alarm latency · s', 'Label', `--label: ${t['--label'] || 'not set'}`, lb),
    spec('dk-s-body', 'Without gravity, hot gas does not rise, so a flame becomes a slow blue sphere.', 'Body', '--font, 1rem / 1.625', bd),
    h('p', {}, h('small', {}, 'Labels are always upper case with .14em letter spacing, and always carry their unit.')));
  scale.dataset.made = 'none';

  const m = raw('night', CURVES.flatMap(c => [c[1], c[2]]).filter(Boolean));
  const still = () => document.documentElement.dataset.motion === 'calm' || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rows = CURVES.map(([name, ease, dur, use]) => {
    const e = ease ? m[ease] : 'ease', b = bez(e) || (ease ? null : [.25, .1, .25, 1]);
    return h('div', { class: 'dk-mrow' },
      b ? curveSvg(b) : h('span', { class: 'dk-curve' }),
      h('div', { class: 'dk-mtxt' },
        h('div', { class: 'dk-mk' }, h('b', {}, name), h('code', {}, `${ease ? `${ease}: ${e}` : 'ease'} · ${dur}: ${m[dur] || 'not set'}`)),
        h('div', { class: 'dk-track', 'aria-hidden': 'true', style: `--dk-ease:${ease ? `var(${ease})` : 'ease'};--dk-dur:var(${dur})` }, h('i')),
        h('small', {}, use)));
  });
  const play = h('button', { type: 'button', class: 'btn dk-play' }, 'Play');
  const box = h('div', { class: 'dk-motion' }, rows);
  const run = () => { if (still()) return; box.classList.remove('run'); void box.offsetWidth; box.classList.add('run'); };
  play.addEventListener('click', run);
  const calmNote = h('p', { class: 'dk-calm' }, h('small', {}, 'Calm motion or the system "reduce motion" setting is on, so the dots stay still.'));
  const motion = card('Motion curves', 'team', 'The three curves every animation on the site uses, read from css/tokens.css. Each dot crosses its track on its own curve and duration.',
    box, h('div', { class: 'row' }, play), calmNote);
  motion.dataset.made = 'none';
  if (!ctx.detached) ctx.onMount(() => {
    const st = still();
    calmNote.hidden = !st; play.disabled = st;
    if (!st) requestAnimationFrame(run);
  });
  else calmNote.hidden = true;
  return h('div', { class: 'dk-lock' }, colours, h('div', { class: 'grid g2' }, scale, motion));
}

/** A length token resolved to px (rem and clamp() included), measured on a probe. */
function px(token) {
  const probe = h('div', { 'aria-hidden': 'true', style: `position:absolute;visibility:hidden;width:var(${token});height:0` });
  document.body.append(probe); const w = probe.getBoundingClientRect().width; probe.remove();
  return Math.round(w * 10) / 10;
}
/** The computed text and fill colours of every status stamp, per theme, from a probe holding real badges. */
function stampColours(theme) {
  const probe = h('div', { 'data-theme': theme, 'aria-hidden': 'true', style: 'position:absolute;left:-9999px;top:0;visibility:hidden' },
    Object.keys(STATUS).map(s => badge(s)));
  (document.getElementById('view') || document.body).append(probe);
  const opaque = v => { const m = String(v).match(/[\d.]+/g); return m && (m.length < 4 || Number(m[3]) > 0.5); };
  const surf = toHex(getComputedStyle(probe).getPropertyValue('--surface'));
  const out = {};
  probe.querySelectorAll('.badge').forEach(b => {
    const cs = getComputedStyle(b);
    out[b.dataset.status] = { ink: toHex(cs.color), fill: opaque(cs.backgroundColor) ? toHex(cs.backgroundColor) : surf, own: opaque(cs.backgroundColor) };
  });
  probe.remove();
  return out;
}
const isFine = () => { try { return matchMedia('(pointer:fine) and (hover:hover)').matches; } catch { return false; } };
const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };

/** A dense app table specimen: radiometer alarm times per burn from data/saffire_latency.json, numbers right-aligned. */
function demoTable(fires) {
  const t = table(['Burn', 'Sensor', 'Alarm (s)'],
    fires.slice(0, 4).map(b => { const c = b.channels.find(x => /radiometer/i.test(x.name)); return [b.label || b.id || b.name || 'Burn', c.name, h('span', { class: 'num' }, String(c.alarm_s))]; }),
    { caption: 'A dense app table: numbers right-aligned in tabular figures (radiometer alarm times from data/saffire_latency.json)' });
  t.querySelectorAll('th')[2]?.classList.add('num');
  t.querySelectorAll('tbody td:last-child').forEach(td => td.classList.add('num'));
  return t;
}

const verdict = (r, px) => {
  if (r >= 4.5) return '✓ AA';
  if (r >= 3) return px >= 18.66 ? '✓ bold only' : '✗ large text only';
  return '✗ decoration only';
};

export default async function render(root, ctx) {
  const names = [...TEXT, ...FILLS].map(t => t[1]).concat('--screen-ink', '--accent-on');
  const tok = Object.fromEntries(THEMES.map(([t]) => [t, measure(t, names)]));
  const ok = THEMES.every(([t]) => tok[t]['--surface'] && tok[t]['--ink']);
  const [models, lat] = await Promise.all([load('models'), load('saffire_latency')]);

  // ---------- colour and contrast, both themes ----------
  const swatches = theme => h('div', { class: 'swatches' }, [...TEXT, ...FILLS].map(([name, v, use]) => {
    const hex = tok[theme][v] || '#000000';
    return h('div', { class: 'sw' }, h('i', { style: `background:${hex}` }), h('div', {}, h('b', {}, name), h('br'), `${v} ${hex}`, use ? [h('br'), use] : null));
  }));
  const contrastRows = theme => {
    const t = tok[theme];
    const rows = TEXT.map(([name, v]) => {
      const rs = SURF.map(([, sf]) => ratio(t[v], t[sf])), worst = Math.min(...rs);
      return [name, h('code', {}, `${v} ${t[v]}`), ...rs.map(r => h('span', { class: 'num' }, `${r.toFixed(2)}:1`)), ...SIZES.map(([, px]) => verdict(worst, px))];
    });
    const sr = ratio(t['--screen-ink'], t['--screen']);
    if (t['--accent-on']) { const ar = ratio(t['--accent-on'], t['--accent']); rows.push(['Text on the flame button', h('code', {}, `--accent-on ${t['--accent-on']}`), h('span', { class: 'num' }, `${ar.toFixed(2)}:1 on flame`), '', '', ...SIZES.map(([, px]) => verdict(ar, px))]); }
    rows.push(['Screen ink on Screen', h('code', {}, `--screen-ink ${t['--screen-ink']}`), h('span', { class: 'num' }, `${sr.toFixed(2)}:1 on screen`), '', '', ...SIZES.map(([, px]) => verdict(sr, px))]);
    return rows;
  };
  const colour = card('Colour and contrast', 'team',
    'Measured live from the site\'s own CSS for both themes. Every text colour is checked against all three surfaces, page, surface (cards) and raise (wells), and the verdict uses the worst of the three (WCAG 2.2: 4.5:1 for text; 3:1 for large text, which starts at 24 px, or 18.66 px bold). The three text sizes are the ones in "Read your way".',
    ok ? THEMES.map(([t, label]) => h('div', { class: 'dk-theme', 'data-theme': t },
      h('h3', {}, `${label} theme`), swatches(t),
      table(['Colour', 'Token', 'On page', 'On surface', 'On raise', ...SIZES.map(([k, px]) => `${k} (${px} px), worst`)], contrastRows(t),
        { caption: `${label} theme: text contrast measured against --page ${tok[t]['--page']}, --surface ${tok[t]['--surface']} and --raise ${tok[t]['--raise']}, at each text size` })))
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
    // v3 specimens: a slider with its number field, stat tiles and a dense app table (numbers right-aligned)
    numField({ id: 'dk-nf', label: 'Example slider', unit: '% O₂', min: 15, max: 40, step: 1, value: 21 }),
    h('div', { class: 'dk-stats' }, stat('Flame sensor alarm', radAlarm != null ? String(radAlarm) : 'n/a', radAlarm != null ? 's' : 'no data yet'),
      stat('Smoke-miss model AUC', sm && sm.score != null ? String(sm.score) : 'n/a', sm && Array.isArray(sm.score_range) ? `${Number(sm.score_range[0]).toFixed(2)}–${Number(sm.score_range[1]).toFixed(2)}` : 'no data yet')),
    fires.length ? demoTable(fires) : h('p', {}, 'data/saffire_latency.json is missing, so the table specimen has no rows.'),
    h('p', {}, h('small', {}, radAlarm != null ? `The lamp, the first tile and the table show the flame light sensor's alarm times on NASA's Saffire-III burns, read from data/saffire_latency.json (our stated alarm rule). The second tile is the smoke-miss model AUC and its range from data/models.json.` : 'data/saffire_latency.json is missing, so the lamp shows no time.')));

  // ---------- status stamps, measured live (v3) ----------
  const sc = Object.fromEntries(THEMES.map(([t]) => [t, stampColours(t)]));
  const stamps = card('Status stamps', 'team', 'One style for every stamp: a word in mono capitals with a thin border. The word carries the meaning; the colour only helps the eye. Each stamp\'s text is measured against its own fill (or the surface, when it has none).',
    table(['Stamp', ...THEMES.map(([, l]) => `${l}: text on fill`), ...THEMES.map(([, l]) => `${l} verdict`)],
      Object.keys(STATUS).map(k => [STATUS[k].label || k,
        ...THEMES.map(([t]) => { const c = sc[t][k]; return c ? h('span', { class: 'dk-chip' }, h('i', { style: `background:${c.fill}` }), h('code', {}, `${c.ink} on ${c.fill}`)) : 'n/a'; }),
        ...THEMES.map(([t]) => { const c = sc[t][k]; if (!c) return 'n/a'; const r = ratio(c.ink, c.fill); return h('span', { class: 'num' }, `${r.toFixed(2)}:1 ${r >= 4.5 ? '✓ AA' : '✗ below 4.5:1'}`); })]),
      { caption: 'Status stamp text against its fill, both themes (WCAG 2.2: 4.5:1, stamps are small text)' }));
  stamps.dataset.made = 'none';

  // ---------- spacing and radius (v3 figure, UI-lock scale) ----------
  const rawSp = raw('night', [...SPACE, '--r-data', '--r-panel']);
  const space = card('Spacing and radius', 'team', 'One spacing scale in 8 px steps for every gap, padding and margin, read from css/tokens.css. Two corners: 2 px on data (stamps, chips, inputs, charts) and 14 px on panels.',
    h('div', { class: 'dk-space' }, SPACE.map(v => { const w = px(v); return h('div', { class: 'dk-sp' }, h('code', {}, v), h('span', { class: 'num' }, `${w} px`), h('i', { style: `width:${w}px`, 'aria-hidden': 'true' })); })),
    h('div', { class: 'dk-radii' }, RADII.map(([k, v]) => h('div', { class: 'dk-rad' }, h('i', { style: `border-radius:${v ? `var(${v})` : '0'}`, 'aria-hidden': 'true' }),
      h('code', {}, v || '0'), h('span', { class: 'num' }, v ? (rawSp[v] || 'not set') : '0 px'), h('small', {}, k)))));
  space.dataset.made = 'none';

  // ---------- cursor and effects (v3 effects kept in the merge) ----------
  const why = () => {
    const r = document.documentElement.dataset;
    if (!isFine()) return 'Off on this device: the main pointer is touch or has no hover, so the browser\'s own pointer stays.';
    if (r.effects === 'off') return 'Off: Effects is set to Off in Read your way.';
    if (r.motion === 'calm') return 'Off: Calm motion is on in Read your way.';
    if (reduced()) return 'Off: the system "reduce motion" setting is on.';
    return 'On: move the pointer over the rows below to see each state.';
  };
  const cursorNow = h('p', { class: 'dk-cur-now' }, h('span', { class: 'dk-k' }, 'Cursor here'), ' ', h('span', {}, why()));
  const effSeg = seg({ label: 'Effects (the same switch as in Read your way)', options: [['on', 'On'], ['off', 'Off']], value: prefs.get('effects') || 'on',
    onChange: v => { prefs.set('effects', v); cursorNow.lastChild.textContent = why(); } });
  // Each state has a live sample: a plain box (idle), a box with the chip class (press, as cursor.js reads it), a drag-surface box (drag) and a sentence
  // (text). The rows are divs, not a table, because table cells count as readable text and would always show "text".
  const smp = (cls, text, extra = {}) => h('div', { class: `dk-cur-s ${cls}`, 'aria-hidden': 'true', ...extra }, h('span', {}, text));
  const states = [
    ['Idle', 'A small ink dot with thin full-screen hairlines. It trails the pointer on a quick spring, with no wobble.', smp('dk-cur-idle', 'Point here')],
    ['Press', 'Over a link, button, chip, slider, menu or science word: the dot opens into a ring and a fire-orange outer ring expands. Pressing tightens it.', smp('chip dk-cur-press', 'Point here')],
    ['Drag', 'Over a surface you can drag (the Earth globe, the experiments constellation, dials, tracks): an open ink ring with the hairlines up; pressing closes it to a filled dot.', smp('dk-cur-drag', 'Point here', { 'data-drag': '1' })],
    ['Chart', 'Over a chart: the hairlines brighten into a reading guide and the dot shrinks.', smp('dk-cur-chart', 'Point at any chart')],
    ['Text', 'Over text fields and readable text: the custom cursor hides and the normal text cursor comes back, so selecting text works as usual.', h('p', { class: 'dk-cur-s dk-cur-text', 'aria-hidden': 'true' }, 'Point at this sentence')],
  ];
  const stateList = h('div', { class: 'dk-cur', role: 'list', 'aria-label': 'Crosshair cursor states (fine pointer with hover only)' },
    states.map(([n, d, sample]) => h('div', { class: 'dk-cur-row', role: 'listitem' }, h('b', { class: 'dk-cur-n' }, n), h('p', { class: 'dk-cur-d' }, d), sample)));
  const fxRows = [
    ['Shared field', 'One WebGL scene behind every page (stars, the planet, the flame); each page is a station and the camera move is the page transition.', 'A still frame.', 'The only always-on WebGL context. No WebGL: a still dark backdrop.'],
    ['Crosshair cursor', 'The states above.', 'Off: the normal cursor returns.', 'Page elements only, no WebGL. Off on touch screens.'],
    ['Fire trail', 'Home, "The finding" band, Night theme only: the pointer leaves curling ember-to-smoke trails behind the text.', 'Off.', 'WebGL 2 only while the band is on screen; released after 2 s off screen. Never on touch screens or low-end devices (4 cores or fewer, or 4 GB or less); no trail there.'],
    ['Ember noise', 'A slow warped ember glow with fine grain behind the Home "The finding" band. Illustration.', 'The still glow.', 'WebGL only while on screen; released after 2 s off screen. Never on touch screens; the still glow (a CSS gradient) instead.'],
    ['Gravity points', 'Home "Why it happens": motes drift with the cabin air and have no "down" until you turn gravity on. Labelled "Illustration, not data".', 'A still frame; the button still switches it.', 'Canvas 2D; nothing needed.'],
  ];
  const fx = card('Cursor and effects', 'team', 'Effects are decoration: they never cover content, never take a click, never flash, share one animation loop and pause when the tab is hidden or they are off screen. "Effects: Off" stops all of them without changing Motion; Calm and the system "reduce motion" setting stop them too.',
    cursorNow, effSeg,
    h('h3', {}, 'Cursor states'), stateList,
    h('h3', {}, 'Effects'),
    table(['Effect', 'What it does', 'Calm, reduced motion or Effects off', 'Budget, touch screens and no WebGL'], fxRows, { caption: 'The effects and how each one steps back' }));
  fx.dataset.made = 'none';
  if (!ctx.detached) {
    const upd = () => { cursorNow.lastChild.textContent = why(); effSeg.set(prefs.get('effects') || 'on'); };
    ctx.onMount?.(() => { addEventListener('vo:prefs', upd); upd(); });
    ctx.onLeave?.(() => removeEventListener('vo:prefs', upd));
  }

  // ---------- built for every reader ----------
  const rules = [
    ['Read your way panel: ', 'Day or Night, three text sizes, science-word explanations on or off, Calm motion, Effects on or off, and read-aloud of the current page. Choices stay on this device.'],
    ['Keyboard: ', 'a skip link, a visible focus ring on everything, and Escape closes the panel, the menus and tooltips. Every control is a real button, link or form field with a visible label and its pressed or open state set.'],
    ['Charts: ', 'each chart is one tab stop; the arrow keys step through its values and show the same tooltip as the mouse. "Show the numbers" opens the chart\'s data as a table. Series differ by dash or shape as well as colour.'],
    ['Finding things: ', '"On this page" lists every figure, including the folded ones. A figure link such as #/design?fig=2 opens its fold and scrolls to it. The Sources page has a site map of every page and figure.'],
    ['Screen readers: ', 'one h1 per page, labelled landmarks, charts with role="img" and a label, and one polite live region that announces a verdict or a risk level only when it changes. Effects and the cursor are aria-hidden.'],
    ['Motion: ', 'follows the system "reduce motion" setting. Calm turns off page transitions, card animations, the illustrations\' movement and every effect. Nothing flashes more than three times a second.'],
    ['Touch: ', 'every drag also works with the arrow keys, every tap with Enter or Space; drag surfaces leave vertical page scroll to the page, and main controls are at least 44 px on touch screens.'],
    ['Colour and layout: ', 'text contrast is measured above for both themes. Status is shown by words on stamps, not colour alone. Pages work at 320 px wide and at 200% zoom; only tables scroll sideways. Windows high-contrast mode is respected.'],
    ['Still to do by hand: ', 'a full screen-reader pass (NVDA and VoiceOver) and a check of every chart\'s text alternative.'],
  ];
  const built = card('Built for every reader', 'team', 'What the site does, and what we still have to check by hand.',
    h('ul', { class: 'rules' }, rules.map(([b, t]) => h('li', {}, h('b', {}, b), t))));

  root.append(page('Freefall',
    'The design system behind Vulcan Orbit: a field manual for fire in orbit, run as a mission console. A light page or the dark of orbit for reading, dark screens for live instruments, one shared view of orbit behind every page, the ember effects and crosshair cursor kept from site v3, and a stamp on every number saying where it came from. This page is drawn from the same CSS the site uses, so it cannot drift from it.',
    lockCards(ctx),
    h('div', { class: 'grid g4' },
      card('Paper and screens', 'team', null, h('p', {}, 'Reading happens on a clean light page (Day) or the dark side of orbit (Night, the default). Anything live, like a replay or a simulation, sits in a dark screen in both themes.')),
      card('Every figure is numbered', 'team', null, h('p', {}, 'Each figure carries a "Figure N" label. "On this page" and figure links use the same number, so a judge or teammate can point at "figure 7".')),
      card('Stamp the source', 'team', null, h('p', {}, 'Each figure carries one stamp saying where its numbers come from: NASA data, model output, reported, demo, plan, team choice, or no data yet. Nothing unstamped is a result.')),
      card('Plain words first', 'team', null, h('p', {}, 'Headlines say what happened in everyday words. Science words are dotted and explained in place. Numbers come with units and a range.'))),
    colour,
    h('div', { class: 'grid g2 dk-pair' }, space, stamps),
    series,
    h('div', { class: 'grid g2' }, type, components),
    fx,
    built));
  void ctx;
}

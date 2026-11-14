// Design kit: the Freefall design system this site is built from, rendered from the live CSS tokens.
import { h, card, badge } from '../lib.js';
import { SERIES } from '../charts.js';
const lum = hex => { const c = hex.replace('#', '').match(/../g).map(x => parseInt(x, 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const toHex = v => { v = v.trim(); if (v.startsWith('#')) return v.length === 4 ? '#' + [...v.slice(1)].map(c => c + c).join('') : v; const m = v.match(/\d+/g); return m ? '#' + m.slice(0, 3).map(n => (+n).toString(16).padStart(2, '0')).join('') : '#000000'; };
export default async function (root) {
  const cs = getComputedStyle(document.documentElement), tok = n => toHex(cs.getPropertyValue(n)), page = tok('--page'), surf = tok('--surface');
  const theme = document.documentElement.dataset.theme;
  const sw = (name, v, use, text = true) => { const hex = tok(v), r = ratio(hex, surf);
    return h('div', { class: 'sw' }, h('i', { style: `background:${hex}` }), h('div', {}, h('b', {}, name), h('br'), `${v} ${hex}`, h('br'), text ? `${r.toFixed(1)}:1 on cards ${r >= 4.5 ? '✓ AA text' : r >= 3 ? '✓ large text' : '— decoration only'}` : use)); };
  root.append(h('div', {},
    h('p', { class: 'kicker' }, 'Design kit · v1'),
    h('h1', {}, 'Freefall'),
    h('p', { class: 'lead' }, 'The design system behind Vulcan Orbit: a field manual for fire in orbit. Paper for reading, dark screens for live instruments, a porthole for the flame, and a stamp on every number saying where it came from. This page is drawn from the same CSS the site uses, so it cannot drift from it.'),
    h('div', { class: 'grid g4' },
      card('Paper and screens', null, null, h('p', {}, 'Reading happens on calm paper (Day) or the dark side of orbit (Night). Anything live, like a replay or a simulation, sits in a dark screen in both themes.')),
      card('Every figure is numbered', null, null, h('p', {}, 'Cards are figures: FIG. 01, 02… with corner ticks like a technical drawing, so a judge or teammate can point at "figure 7".')),
      card('Stamp the source', null, null, h('p', {}, 'Each figure carries one stamp: NASA data, model output, reported, or no data yet. Nothing unstamped is a result.')),
      card('Plain words first', null, null, h('p', {}, 'Headlines say what happened in everyday words. Science words are dotted and explained in place. Numbers come with units and a range.'))),
    card(`Colour · ${theme === 'day' ? 'Day' : 'Night'} theme`, null, 'Live values from the current theme; switch theme in "Read your way" to see the other set. Contrast is measured against the card colour (WCAG 2.2: 4.5:1 for text, 3:1 for large text and graphics).',
      h('div', { class: 'swatches' }, sw('Ink', '--ink'), sw('Ink 2', '--ink2'), sw('Muted', '--mute'), sw('Flame', '--accent'), sw('Flame text', '--accent-ink'), sw('Oxygen', '--oxy'),
        sw('Page', '--page', 'Background', false), sw('Card', '--surface', 'Figures', false), sw('Raise', '--raise', 'Wells, controls', false), sw('Screen', '--screen', 'Live instruments', false))),
    card('Chart series', null, 'Fixed order, never cycled; colour follows the thing, not its rank. Every chart also has a legend or direct labels, so colour is never the only clue.',
      h('div', { class: 'swatches' }, ...SERIES.map((c, i) => h('div', { class: 'sw' }, h('i', { style: `background:${c}` }), h('div', {}, h('b', {}, `Series ${i + 1}`), h('br'), c))))),
    h('div', { class: 'grid g2', style: 'margin-top:20px' },
      card('Type', null, 'Three families, each with one job.',
        h('div', { class: 'typescale' },
          h('div', { style: 'font:800 56px/.95 var(--display);letter-spacing:-.05em;color:var(--ink)' }, 'Bricolage Grotesque'),
          h('small', {}, 'Display · headlines and figure titles · 650–800'),
          h('div', { style: 'font:400 20px/1.4 var(--font);color:var(--ink);margin-top:14px' }, 'Atkinson Hyperlegible is the body face. The Braille Institute designed it so letters like I, l and 1 never look alike.'),
          h('small', {}, 'Body · 16 px base, 18 and 20 px in larger text modes · line length about 68 characters'),
          h('div', { style: 'font:600 30px/1.1 var(--mono);color:var(--ink);margin-top:14px' }, '0.746 [0.44, 1.00]'),
          h('small', {}, 'IBM Plex Mono · numbers, ranges, labels, figure numbers'))),
      card('Components', null, 'The pieces every page is built from.',
        h('div', { class: 'row' }, h('a', { class: 'btn primary', href: '#/design' }, 'Primary action →'), h('a', { class: 'btn', href: '#/design' }, 'Secondary')),
        h('div', { class: 'row' }, h('button', { class: 'chip', 'aria-pressed': 'true' }, 'Selected'), h('button', { class: 'chip', 'aria-pressed': 'false' }, 'Option'), h('button', { class: 'chip', 'aria-pressed': 'false' }, 'Option')),
        h('div', { class: 'row' }, badge('real'), badge('model'), badge('reported'), badge('demo'), badge('missing')),
        h('div', { class: 'row' }, h('div', { class: 'seg', style: 'min-width:240px' }, h('button', { 'aria-pressed': 'true' }, 'Day'), h('button', { 'aria-pressed': 'false' }, 'Night'))),
        h('p', {}, 'A science word such as microgravity is explained where it appears.'),
        h('div', { class: 'lamps' }, h('div', { class: 'lamp on', style: '--c:#3987e5' }, h('i'), h('span', {}, 'Sensor lamp'), h('b', {}, 'alarm at 41 s'))))),
    card('Built for every reader', null, 'What the site does, and what we still have to check by hand.',
      h('ul', { class: 'rules' },
        h('li', {}, h('b', {}, 'Read your way panel: '), 'Day or Night, three text sizes, science-word explanations on or off, calm motion, and read-aloud of the current page.'),
        h('li', {}, h('b', {}, 'Keyboard: '), 'skip link, visible focus ring on everything, Escape closes pop-ups, every control is a real button or link.'),
        h('li', {}, h('b', {}, 'Screen readers: '), 'one h1 per page, labelled landmarks and charts (role="img" with a description), live regions only where numbers change.'),
        h('li', {}, h('b', {}, 'Motion: '), 'follows the system "reduce motion" setting, and Calm turns off every animation including the background and the flame.'),
        h('li', {}, h('b', {}, 'Colour: '), 'text meets WCAG AA contrast in both themes (measured above); status is shown by words on stamps, not colour alone; Windows high-contrast mode is respected.'),
        h('li', {}, h('b', {}, 'Still to do by hand: '), 'a full screen-reader pass (NVDA and VoiceOver) and a check of every chart\'s text alternative.'))),
  ));
}

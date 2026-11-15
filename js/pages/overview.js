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
import { h, add, load, badge, card, empty, isMissing } from '../lib.js';
import { loadI18n, langSwitch, draftNote, shortLines, tr, currentLang } from '../i18n.js';
import { annotate } from '../glossary.js';
import { hero } from '../gl_hero.js';
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
  const facts = detectFacts(lat, gas);
  root.append(h('div', { class: 'page home' },
    heroSection(ctx),
    pipelineCard(st),
    findingSection(facts, lat, gas, ctx),
    shortAnswer(facts, lat, gas, i18n, ctx),
    h('p', { class: 'story-map' }, 'The challenge asks teams to summarise, rank and interpret NASA\'s fire data. We do that as three questions:'),
    questions(st),
    alsoLinks(),
    isMissing(gaps) ? null : h('p', { class: 'coverage' }, coverageLine(gaps)),
    isMissing(gaps)
      ? card('Mission check: is there NASA data for your cabin air?', 'missing', null,
        empty('Mission check: is there NASA data for your cabin air?', 'gaps', 'The count of NASA tests near each cabin atmosphere is not available yet.'))
      : missionCheck(gaps, { params: ctx.params }),
    howToRead(),
    isMissing(india)
      ? card('Why this matters for India\'s own crew and station', 'missing', null,
        empty('Why this matters for India\'s own crew and station', 'india', 'The checked India facts are not available yet.'))
      : indiaCard(india, i18n, ctx)));
}

// ---------- hero and porthole ----------
function heroSection(ctx) {
  const H = hero({ g: 0, fit: 'center', ctx });
  const gb = [];
  const gBtn = (v, label) => {
    const b = h('button', { type: 'button', 'aria-pressed': String(v === 0), onclick: () => { H.setG(v); gb.forEach(x => x.setAttribute('aria-pressed', String(x === b))); } }, label);
    gb.push(b); return b;
  };
  const ring = document.createElementNS(NS, 'svg');
  ring.setAttribute('viewBox', '0 0 600 600'); ring.setAttribute('class', 'ring'); ring.setAttribute('aria-hidden', 'true'); ring.setAttribute('focusable', 'false');
  // Decoration (main, verbatim): 72 ticks every 5°, a longer tick every 30°.
  ring.innerHTML = `<defs><path id="arc" d="M 300 300 m -292 0 a 292 292 0 1 1 584 0 a 292 292 0 1 1 -584 0"/></defs>
    <circle class="c" cx="300" cy="300" r="292"/><circle class="d" cx="300" cy="300" r="276"/>
    ${Array.from({ length: 72 }, (_, i) => { const a = i * 5 * Math.PI / 180, r1 = 292, r2 = i % 6 ? 286 : 280; return `<line x1="${300 + r1 * Math.cos(a)}" y1="${300 + r1 * Math.sin(a)}" x2="${300 + r2 * Math.cos(a)}" y2="${300 + r2 * Math.sin(a)}" stroke="var(--axis)" stroke-width="1"/>`; }).join('')}
    <text><textPath href="#arc" startOffset="3%">VIEWPORT · FUEL DROPLET · NOT TO SCALE · ILLUSTRATION, NOT DATA · DRAG TO TURN ·</textPath></text>`;
  return h('section', { class: 'hero2', 'aria-labelledby': 'hero-title' },
    h('div', { class: 'hero-copy' },
      h('p', { class: 'kicker' }, 'NASA Space Apps 2026 · Flame in Freefall'),
      h('h1', { id: 'hero-title' }, 'In orbit, fire doesn\'t rise. ', h('span', { class: 'lit' }, 'It hides.')),
      h('p', { class: 'hero-lead' }, 'Without gravity, flames turn into dim blue balls and smoke drifts wherever the fans push it. We used NASA\'s own space-station fire experiments to answer three questions: where is the fire, what will it do, and what puts it out.'),
      h('div', { class: 'hero-cta' }, h('a', { class: 'btn primary', href: '#/detect' }, 'Start with the fire'), tourButton(), h('a', { class: 'btn', href: '#/evidence' }, 'How we checked it'))),
    h('figure', { class: 'port-fig' },
      h('div', { class: 'port' }, ring, h('div', { class: 'glass' }, H.el),
        h('div', { class: 'port-ctl', role: 'group', 'aria-label': 'Gravity in the illustration' }, gBtn(0, 'In orbit'), gBtn(1, 'On Earth'))),
      h('figcaption', { class: 'port-note' }, H.ok ? 'Same droplet, same fuel. Only gravity changes.' : 'This illustration needs WebGL 2; the rest of the site works without it.')));
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
  return h('details', { class: 'more readme-fold' },
    h('summary', {}, h('span', {}, 'How to read this site'), h('small', {}, 'What the coloured stamps on every panel mean')),
    h('p', {}, 'Every panel is stamped with where its numbers come from. Only the first three are results.'),
    h('div', { class: 'readme' }, rows.map(([s, t]) => h('div', {}, badge(s), h('p', {}, t)))),
    h('p', { class: 'readme-foot' }, 'Dotted words have a plain-English meaning: hover, tap or tab to them. The ', h('b', {}, 'Read your way'), ' button changes text size, colours and motion, or reads a page aloud.'));
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

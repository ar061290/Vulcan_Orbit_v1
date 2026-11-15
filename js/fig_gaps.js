// Evidence gap map, the next experiment worth running, and the Moon and Mars bounds card (Predict it).
// Data: data/gaps.json (status real) ← scripts/build_gaps.py. Ported from main's js/gaps_ui.js (wording kept);
// site/REBUILD_PLAN.md §2.12 and §3.6 rows 17-19. Changes from main: every mark has a shape per fuel kind as well as a
// colour, the map has keyboard access, a text summary and a "Show the numbers" table (D5.6), and the axes widen to fit
// the file if it ever holds a point outside main's range.
import { h, card, empty, isMissing, tip, untip, table } from './lib.js';
import { C, keyNav, numbers } from './charts.js';

const NS = 'http://www.w3.org/2000/svg';
const s = (t, a = {}, txt) => { const e = document.createElementNS(NS, t); for (const k in a) if (a[k] != null) e.setAttribute(k, a[k]); if (txt != null) e.textContent = txt; return e; };
const isF = Number.isFinite;
const note = (...kids) => h('p', {}, h('small', {}, ...kids));
const KINDS = ['solids', 'liquid droplets', 'gas flames'];   // the three `counts` keys in gaps.json probes
const KIND_COLOR = () => ({ solids: C.s2, 'liquid droplets': C.s1, 'gas flames': C.s3 });   // main's colours (gaps_ui.js KIND)
const KIND_SHAPE = { solids: 'triangle', 'liquid droplets': 'circle', 'gas flames': 'square' };
const GAP_SCHEMA = '{ "status":"real", "units":{"o2":"% by volume","kpa":"kPa"},\n  "tested":[{ "inv":"BASS-II (PSI-25)", "kind":"solids", "points":[[o2, kPa], …], "pressure_assumed":true }],\n  "reported":{ "name":"…", "points":[[o2, kPa, "label"], …] },\n  "probes":[{ "atmosphere":"…", "o2":…, "kpa":…, "counts":{"solids":…, "liquid droplets":…, "gas flames":…} }],\n  "verdicts":[{ "text":"…", "source":"…" }], "note":"…", "source":"…" }';
const okGaps = g => !isMissing(g) && Array.isArray(g.tested) && Array.isArray(g.probes);
const missingCard = (title, sub, why) => card(title, 'missing', sub, empty('Waiting for the gap table', 'gaps', why, GAP_SCHEMA));
const total = p => KINDS.reduce((a, k) => a + (isF(p.counts?.[k]) ? p.counts[k] : 0), 0);
const gapKinds = p => KINDS.filter(k => p.counts?.[k] === 0);
/** Probe label on the map (main's SHORT() rules, verbatim). */
const SHORT = a => a.replace(/ \(.*NASA EAWG.*\)/, ' (NASA proposal)').replace(/ at /, ' / ').replace(/ \((10\.2|8\.0) psi[a]?\)/, '').replace('ISS cabin air', 'ISS air');
/** The neighbourhood the counts use, read from the file's own verdict text ("… tests within 3 O2 points and 10 kPa.").
 *  source: scripts/build_gaps.py near(kind, o2, kpa, do2=3, dk=10), which writes that sentence. null if no verdict says it. */
function nearRule(g) {
  for (const v of g.verdicts || []) {
    const m = /within\s+(\d+(?:\.\d+)?)\s+O2 points and\s+(\d+(?:\.\d+)?)\s*kPa/i.exec(String(v.text || ''));
    if (m) return { o2: Number(m[1]), kpa: Number(m[2]) };
  }
  return null;
}

function mark(kind, cx, cy, r, a) {
  if (kind === 'square') return s('rect', { x: cx - r * 0.9, y: cy - r * 0.9, width: r * 1.8, height: r * 1.8, ...a });
  if (kind === 'triangle') return s('path', { d: `M${cx} ${cy - r * 1.15}L${cx + r * 1.05} ${cy + r * 0.8}L${cx - r * 1.05} ${cy + r * 0.8}Z`, ...a });
  if (kind === 'diamond') return s('path', { d: `M${cx} ${cy - r}l${r} ${r}-${r} ${r}-${r}-${r}z`, ...a });
  return s('circle', { cx, cy, r, ...a });
}
function swatch(kind, color, { hollow = false, dash = null, size = 5 } = {}) {
  const sv = s('svg', { viewBox: '0 0 18 18', width: 18, height: 18, 'aria-hidden': 'true', focusable: 'false', class: 'gap-sw' });
  sv.append(mark(kind, 9, 9, size, hollow ? { fill: 'none', stroke: color, 'stroke-width': 2, 'stroke-dasharray': dash } : { fill: color }));
  return sv;
}

// ---------------------------------------------------------------------------------------------------------------------
// "What NASA has not tested" (#14): every oxygen and pressure point in five NASA summary tables, plus the probes.
export function gapCard(g) {
  const title = 'What NASA has not tested';
  const sub = 'Every oxygen and pressure combination in the summary tables of five NASA microgravity combustion experiments. Squares are cabin atmospheres we probe for gaps.';
  if (!okGaps(g)) return missingCard(title, 'Conditions with no data, and the next experiment worth running.', 'Tested ranges per investigation and the gaps the team judges most important.');
  const K = KIND_COLOR(), U = g.units || {}, uO = U.o2 || '% by volume', uP = U.kpa || 'kPa';
  const tested = g.tested.flatMap(t => (t.points || []).filter(p => isF(p[0]) && isF(p[1]) && p[1] > 0).map(([o, p]) => ({ t, o, p })));
  const rep = g.reported && Array.isArray(g.reported.points) ? g.reported.points.filter(p => isF(p[0]) && isF(p[1]) && p[1] > 0) : [];
  const probes = g.probes.filter(p => isF(p.o2) && isF(p.kpa) && p.kpa > 0);
  // axes: main's 0-90 % O2 and 40-600 kPa (log), widened only if the file holds a point outside them
  const allO = [...tested.map(q => q.o), ...rep.map(q => q[0]), ...probes.map(q => q.o2)];
  const allP = [...tested.map(q => q.p), ...rep.map(q => q[1]), ...probes.map(q => q.kpa)];
  const xmax = Math.max(90, Math.ceil(Math.max(0, ...allO) / 10) * 10);
  const lyMin = Math.log10(Math.min(40, Math.min(...allP) * 0.95)), lyMax = Math.log10(Math.max(600, Math.max(...allP) * 1.05));
  const W = 640, H = 360, m = { l: 56, r: 16, t: 14, b: 44 }, iw = W - m.l - m.r, ih = H - m.t - m.b;
  const X = v => m.l + v / xmax * iw, Y = v => m.t + ih - (Math.log10(v) - lyMin) / (lyMax - lyMin) * ih;
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart gap-map' });
  for (let v = 0; v <= xmax; v += 20) svg.append(s('line', { class: 'ch-grid', x1: X(v), x2: X(v), y1: m.t, y2: m.t + ih }), s('text', { x: X(v), y: m.t + ih + 16, 'text-anchor': 'middle' }, `${v}%`));
  for (const v of [50, 100, 200, 500, 1000].filter(v => Math.log10(v) >= lyMin && Math.log10(v) <= lyMax))
    svg.append(s('line', { class: 'ch-grid', x1: m.l, x2: m.l + iw, y1: Y(v), y2: Y(v) }), s('text', { x: m.l - 8, y: Y(v) + 4, 'text-anchor': 'end' }, String(v)));
  svg.append(s('text', { x: m.l + iw / 2, y: H - 6, 'text-anchor': 'middle' }, 'Oxygen, % by volume'));
  svg.append(s('text', { x: 14, y: m.t + ih / 2, 'text-anchor': 'middle', transform: `rotate(-90 14 ${m.t + ih / 2})` }, 'Pressure, kPa (log)'));

  const items = [];   // keyboard order: probes, then the reported burns, then every tested point by investigation
  const hook = (el, html) => { el.addEventListener('pointermove', e => tip(e, html)); el.addEventListener('pointerleave', untip); };
  const testHtml = q => `<b>${q.t.inv}</b><br>${q.t.kind}<br>${q.o}% O₂, ${q.p} kPa${q.t.pressure_assumed ? '<br><span>pressure assumed (not in the table)</span>' : ''}`;
  const tMarks = tested.map(q => {
    const c = mark(KIND_SHAPE[q.t.kind] || 'circle', X(q.o), Y(q.p), 4, { fill: K[q.t.kind] || C.mute, 'fill-opacity': q.t.pressure_assumed ? 0.35 : 0.75, class: 'ch-surf', 'stroke-width': 1 });
    hook(c, testHtml(q)); svg.append(c); return c;
  });
  const repHtml = q => `<b>${g.reported.name}, ${q[2]}</b><br>${q[0]}% O₂, ${q[1]} kPa<br><span>published (reported), not in the PSI tables</span>`;
  const rMarks = rep.map(q => { const d = mark('diamond', X(q[0]), Y(q[1]), 7, { fill: C.s4, class: 'ch-surf', 'stroke-width': 1.5 }); hook(d, repHtml(q)); svg.append(d); return d; });
  const POS = [[16, -16, 'start'], [18, -16, 'start'], [-16, 30, 'end'], [18, 30, 'start']];   // main's label offsets by probe index
  const probeHtml = p => `<b>${p.atmosphere}</b><br>${p.o2}% O₂, ${p.kpa} kPa<br>NASA tests nearby: ${KINDS.map(k => `${k} ${p.counts?.[k] ?? 'n/a'}`).join(', ')}${gapKinds(p).length ? `<br>Gap: no ${gapKinds(p).join(', no ')} tests` : ''}`;
  const pMarks = probes.map((p, k) => {
    const gap = gapKinds(p).length > 0, x = X(p.o2), y = Y(p.kpa), [dx, dy, anchor] = POS[k % POS.length];
    const r = s('rect', { x: x - 9, y: y - 9, width: 18, height: 18, rx: 3, fill: 'transparent', stroke: gap ? C.warn : C.ink, 'stroke-width': 2, 'stroke-dasharray': gap ? '4 2' : null });
    svg.append(r, s('line', { class: 'ch-mute', x1: x + Math.sign(dx) * 9, x2: x + dx * 0.8, y1: y + Math.sign(dy) * 9, y2: y + dy * 0.7 }),
      s('text', { x: x + dx, y: y + dy, 'text-anchor': anchor, class: 'ch-ink gap-lab' }, SHORT(p.atmosphere)));
    hook(r, probeHtml(p)); return r;
  });
  probes.forEach((p, k) => items.push({ html: probeHtml(p), anchor: pMarks[k] }));
  rep.forEach((q, k) => items.push({ html: repHtml(q), anchor: rMarks[k] }));
  tested.forEach((q, k) => items.push({ html: testHtml(q), anchor: tMarks[k] }));
  keyNav(svg, items, { label: 'Oxygen and pressure tested by NASA microgravity combustion experiments, with the probed cabin atmospheres first' });

  // legend: the same shape, colour and outline as the marks
  const lg = (sw, text) => h('span', { class: 'lg-item' }, sw, text);
  const legendEl = h('div', { class: 'legend gap-legend' },
    KINDS.map(k => lg(swatch(KIND_SHAPE[k], K[k]), k)),
    lg(swatch('square', C.ink, { hollow: true, size: 6 }), 'Probed cabin atmosphere'),
    lg(swatch('square', C.warn, { hollow: true, dash: '4 2', size: 6 }), 'Gap for at least one fuel type'),
    rep.length ? lg(swatch('diamond', C.s4, { size: 6 }), 'Saffire IV-VI large burns (reported)') : null,
    tested.some(q => q.t.pressure_assumed) ? h('span', { class: 'lg-item' }, 'Faded marks: pressure assumed (not in the table)') : null);

  // one-paragraph text summary from the same values (D5.6)
  const rng = a => (a.length ? `${Math.min(...a)}–${Math.max(...a)}` : 'n/a');
  const byKind = KINDS.map(k => { const q = tested.filter(x => x.t.kind === k); return q.length ? `${k} ${q.length} (oxygen ${rng(q.map(x => x.o))}%, ${rng(q.map(x => x.p))} kPa)` : null; }).filter(Boolean);
  const assumed = g.tested.filter(t => t.pressure_assumed).map(t => t.inv);
  const summary = [
    `${tested.length} tested conditions from ${g.tested.length} NASA tables, oxygen ${rng(tested.map(q => q.o))}% and pressure ${rng(tested.map(q => q.p))} kPa.`,
    byKind.length ? `By fuel kind: ${byKind.join('; ')}.` : '',
    assumed.length ? `${assumed.join(' and ')} records no pressure, so those tests are placed at cabin pressure (an assumption).` : '',
    probes.length ? `Probed atmospheres and the NASA tests near each: ${probes.map(p => `${p.atmosphere}: ${total(p)}${gapKinds(p).length ? ` (no ${gapKinds(p).join(', no ')})` : ''}`).join('; ')}.` : '',
    rep.length ? `${rep.length} large burns from ${g.reported.name} are drawn as diamonds (reported, not counted).` : '',
  ].filter(Boolean).join(' ');

  const rows = [
    ...probes.map(p => ['Probe: ' + p.atmosphere, 'probe', p.o2, p.kpa, total(p), `${KINDS.map(k => `${k} ${p.counts?.[k] ?? 'n/a'}`).join(', ')}`]),
    ...rep.map(q => [`${g.reported.name}, ${q[2]}`, g.reported.kind || 'solids', q[0], q[1], '—', 'reported, not counted']),
    ...tested.map(q => [q.t.inv, q.t.kind, q.o, q.p, '—', q.t.pressure_assumed ? 'pressure assumed' : '']),
  ];
  return card(title, g.status, sub,
    h('div', { class: 'chart-wrap' }, svg, legendEl,
      numbers('Oxygen and pressure: the probed atmospheres, the reported burns and every tested point', ['Point', 'Kind', `Oxygen (${uO})`, `Pressure (${uP})`, 'NASA tests nearby', 'Note'], rows,
        'For a probe, "NASA tests nearby" is the sum of its counts in data/gaps.json.')),
    h('p', { class: 'gap-sum' }, summary),
    h('ul', { class: 'gap-verdicts' }, (g.verdicts || []).map(v => h('li', {}, v.text, ' ', h('small', {}, v.source)))),
    note(`${g.note || ''} ${g.source || ''}`.trim()));
}

// ---------------------------------------------------------------------------------------------------------------------
// "Next experiment worth running" (#14, AstraFlame): the probes ranked by how few tests cover them. Stamp: team rule.
export function nextExperimentCard(g) {
  const title = 'Next experiment worth running';
  const sub = 'Team rule: the probed cabin atmosphere with the fewest NASA tests near it comes first.';
  if (!okGaps(g) || !g.probes.length) return missingCard(title, sub, 'The ranking reads the probe atmospheres and their test counts from the gap table.');
  const near = nearRule(g);
  const ranked = g.probes.map((p, i) => ({ p, i, n: total(p) })).sort((a, b) => a.n - b.n || a.i - b.i);   // stable: ties keep file order
  const top = ranked[0].p, gaps = gapKinds(top);
  const v = (g.verdicts || []).find(x => String(x.text || '').startsWith(top.atmosphere));
  const counts = KINDS.map(k => `${k} ${top.counts?.[k] ?? 'n/a'}`).join(', ');
  return card(title, 'team', sub,
    h('p', { class: 'nx-rule' }, h('b', {}, 'The rule. '),
      `Rank the cabin atmospheres probed on the gap map by the number of NASA tests near each one: the sum of its counts for ${KINDS.join(', ')}`,
      near ? ` (a test counts when it is within ${near.o2} oxygen points and ${near.kpa} kPa)` : '', ', fewest first. This ranking is the team\'s choice, not NASA\'s.'),
    h('p', { class: 'nx-top' },
      `By this rule the least-tested atmosphere is ${top.atmosphere}, with ${ranked[0].n} NASA test${ranked[0].n === 1 ? '' : 's'} nearby (${counts}).`,
      v ? ` ${v.text}` : '',
      gaps.length ? ` The next experiment worth running is a ${gaps.join(' or ')} test at ${top.o2}% oxygen and ${top.kpa} kPa.`
        : ` The next experiment worth running is more tests at ${top.o2}% oxygen and ${top.kpa} kPa.`),
    table(['Rank', 'Atmosphere', ...KINDS.map(k => `${k[0].toUpperCase()}${k.slice(1)}`), 'Total'],
      ranked.map((r, k) => [String(k + 1), r.p.atmosphere, ...KINDS.map(kk => String(r.p.counts?.[kk] ?? 'n/a')), String(r.n)]),
      { caption: 'NASA tests near each probed atmosphere, fewest first', cls: 'nx-rank' }),
    note('The ranking only counts coverage in NASA\'s published summary tables. It does not judge which atmosphere a spacecraft should use, and a probe is not NASA\'s chosen design. ', v?.source || ''));
}

// ---------------------------------------------------------------------------------------------------------------------
// "Moon and Mars" (#12): text only (main's wording), stamp team. No value is shown here (values live in the Flame lab only).
export function moonMarsCard() {
  return card('Moon and Mars', 'team', null,
    h('p', {}, 'NASA\'s archive holds no combustion data taken at lunar or Martian gravity. We show microgravity and Earth-gravity results as the two ends of the range and do not invent a value in between.'));
}

// Bench rig figures (site/REBUILD_PLAN.md §3.13, spec C5): the dome is now a camera with a computer-vision model and an
// optical-flow smoke sensor, not thermopiles. Every card title is a MADE key in js/provenance.js.
// No number is typed in here: the camera card prints data/cv_latest.json as the file gives it, and the pending cards
// show no score until one is measured (plan v2 §10: no accuracy we have not measured).
import { h, card, empty, isMissing, table } from './lib.js';
import { CV_PENDING } from './overlays.js';
import { figLink } from './passes.js';

const CV_SCHEMA = `{ "status":"model", "frame_time_s":12.4, "flame_type":"surface",
  "area_cm2":2.5, "centroid_cm":[0.25, 2.5], "bbox_cm":[0, 0, 0.5, 5],
  "coordinates":"fuel", "confidence":null, "droplet":null,
  "fuel_source":null, "flame_volume_cm3":null, "distance_from_sensor_cm":null }
(the numbers are layout placeholders from the proposed shape, not data)`;

/** "Bench rig: camera": what the camera rig is meant to do, in plain words. No result. */
export function benchExplainCard() {
  const step = (name, text) => h('li', {}, h('b', {}, name), ' ', text);
  return card('Bench rig: camera', 'team',
    'A camera looks at a small flame on a bench-top dome, and software turns each frame into a reading the rest of the site can use.',
    h('ol', { class: 'bench-steps' },
      step('Fire detection.', 'A model checks each camera frame for a flame at all, so the other steps only run when there is one.'),
      step('Flame size and position.', 'A CV model outlines the flame and reports its area, its centre and a box around it, in centimetres on the fuel.'),
      step('Depth.', 'A depth model estimates the distance from the sensor to the flame, so the outline can be turned into a flame size in three dimensions.'),
      step('Smoke flow.', 'An optical flow sensor compares one frame with the next to see which way, and how fast, the smoke is moving.')),
    h('p', {}, 'The dome is meant to report three things: what is burning (the fuel source), how big the flame is (its volume) and how far it is from the sensor. ',
      'The flame\'s size and position are the starting point of the growth simulation on ',
      h('a', { href: figLink('assess', 'Load from camera') }, 'the Assess page'),
      '. Until the camera model is connected, Assess starts from sliders or a worked example instead.'));
}

const show = v => (Array.isArray(v) ? v.join(', ') : typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v));
const present = v => v !== undefined && v !== null && v !== '';

/** "Camera reading now": data/cv_latest.json as the file gives it; each absent field says so. */
export function cvLatestCard(cv) {
  const title = 'Camera reading now';
  if (isMissing(cv)) {
    return card(title, 'missing', 'The latest flame reading from the camera model, once the camera owner adds it.',
      empty('Camera model not connected yet', 'cv_latest',
        'One object per analysed frame: the flame state the growth simulation reads, plus the dome outputs from plan v2 (fuel source, flame volume, distance from the sensor), each optional. The shape is proposed in site/CONTRACT_PROPOSAL.md.',
        CV_SCHEMA));
  }
  const NOT = h('span', { class: 'bench-absent' }, 'Not in the camera file yet');
  const row = (label, value, unit) => [label, present(value) ? show(value) : NOT.cloneNode(true), present(value) ? unit : ''];
  const flame = [
    row('Frame time', cv.frame_time_s, 's'),
    row('Flame type', cv.flame_type, ''),
    row('Flame area on the fuel', cv.area_cm2, 'cm²'),
    row('Flame centre [x, y]', cv.centroid_cm, 'cm'),
    row('Box around the flame [x0, y0, x1, y1]', cv.bbox_cm, 'cm'),
    row('Coordinates', cv.coordinates, ''),
    row('Model confidence', cv.confidence, '0 to 1'),
    cv.flame_type === 'surface' && cv.droplet == null
      ? ['Droplet diameter', 'Not used for a surface flame', '']
      : row('Droplet diameter', cv.droplet && typeof cv.droplet === 'object' ? cv.droplet.diameter_mm : null, 'mm'),
  ];
  const dome = [
    row('Fuel source', cv.fuel_source, ''),
    row('Flame volume', cv.flame_volume_cm3, 'cm³'),
    row('Distance from the sensor', cv.distance_from_sensor_cm, 'cm'),
  ];
  const sf = cv.smoke_flow && typeof cv.smoke_flow === 'object' ? cv.smoke_flow : null;
  const smoke = [
    row('Smoke speed', sf?.speed_mm_s, 'mm/s'),
    row('Smoke direction (0 = +x on the fuel)', sf?.direction_deg, 'degrees'),
    row('Smoke reading frame time', sf?.frame_time_s, 's'),
    row('Smoke reading status', sf?.status, ''),
  ];
  return card(title, cv.status, 'The latest flame reading from the camera model, printed as the file gives it. It has no held-out score yet.',
    h('h3', {}, 'Flame state (what the growth simulation reads)'),
    table(['Field', 'Value', 'Unit'], flame, { caption: 'Flame state in data/cv_latest.json' }),
    h('h3', {}, 'Dome outputs (information only)'),
    table(['Field', 'Value', 'Unit'], dome, { caption: 'Dome outputs in data/cv_latest.json' }),
    h('h3', {}, 'Smoke flow from the optical flow sensor (information only)'),
    table(['Field', 'Value', 'Unit'], smoke, { caption: 'Smoke flow in data/cv_latest.json' }),
    h('p', {}, h('a', { href: figLink('assess', 'Load from camera') }, 'Use this reading on the Assess page →')));
}

const PENDING = {
  depth: { title: 'Depth: distance from the sensor', ids: ['CV3'],
    sub: 'How far the depth model\'s distance from the sensor is from the true distance, on camera frames it was not trained on.' },
  cv: { title: 'CV detection rate and size error', ids: ['CV1', 'CV2'],
    sub: 'How often the camera finds a flame that is there, and how far its flame size and position are from the truth, on held-out frames.' },
  flow: { title: 'Optical-flow smoke track', ids: ['OF1'],
    sub: 'Whether the optical flow sensor\'s smoke track matches the smoke seen in the camera frames.' },
};
/** A check that has not run yet. kind: 'depth' | 'cv' | 'flow'. The rows come from overlays.CV_PENDING; no numbers. */
export function pendingCard(kind) {
  const p = PENDING[kind];
  if (!p) throw new Error(`pendingCard: unknown kind '${kind}' (depth, cv, flow)`);
  const rows = CV_PENDING.filter(r => p.ids.includes(r.id));
  return card(p.title, 'missing', p.sub,
    h('div', { class: 'empty' },
      h('h3', {}, 'Not measured yet'),
      h('ul', { class: 'bench-pending' }, rows.map(r => h('li', {}, h('b', {}, `${r.id}. `), `${r.what}. Owner: ${r.owner}. Pass rule: ${r.limit}.`))),
      h('p', {}, 'No score is shown until it is measured on held-out camera frames. The same rows are listed on ',
        h('a', { href: figLink('evidence', 'Checks') }, 'the Checks page'), '.')));
}

/** "What this does and does not show": the rig's limits. */
export function doesNotShowCard() {
  return card('What this does and does not show', 'team', null,
    h('p', {}, 'The rig runs at Earth gravity, where hot gas rises and a flame flickers and stands upright. It tests whether a camera can find a small flame on the bench, measure its size, position and distance from the sensor, and whether an optical flow sensor can follow the smoke.'),
    h('p', {}, 'It does not reproduce a microgravity flame, and it does not detect or fight fires in orbit. Any score for the camera models will be a bench score at Earth gravity, measured on held-out frames.'));
}

/** "Planned, not built": the closed loop (plan v2 feature 19). Status plan, never a result. */
export function plannedCard() {
  return card('Planned, not built', 'plan', 'Written down in the plan, not built and not measured.',
    h('ul', {}, h('li', {}, h('b', {}, 'Closed loop. '),
      'The camera\'s reading of where the flame is would steer the mist nozzle to it on its own. It depends on the bench mist trial, which is optional and not completed.')));
}

// ---------- UI lock: the rig as a line drawing (ILLUSTRATION, no numbers) ----------
const SVGNS = 'http://www.w3.org/2000/svg';
const sv = (tag, a = {}, ...kids) => { const e = document.createElementNS(SVGNS, tag); for (const k in a) e.setAttribute(k, a[k]); kids.forEach(k => e.append(k)); return e; };
// Each stroke draws itself in (pathLength 1, stroke-dashoffset 1 → 0, css/ui-locate.css), in this order. The shapes are a
// sketch of the layout described in "Bench rig: camera"; positions and sizes are drawing choices, not dimensions.
const RIG = [
  ['bench', 'M20 292H620M20 300H620M60 300V334M580 300V334'],
  ['dome', 'M200 292A130 130 0 0 1 460 292'],
  ['dome', 'M214 292A116 116 0 0 1 446 292'],
  ['stand', 'M318 292V252H342V292M312 252H348'],
  ['cam', 'M56 172H132V218H56ZM132 182H152V208H132ZM94 218V292M94 258L68 292M94 258L120 292'],
  ['flow', 'M572 292V96H426M380 80H426V108H380Z'],
  ['flame', 'M330 248C314 236 312 216 330 186C348 216 346 236 330 248Z'],
  ['flame', 'M330 244C323 238 322 228 330 214C338 228 337 238 330 244Z'],
];
const RIG_LABELS = [
  ['Camera', 56, 160], ['Dome', 468, 196], ['Flame', 356, 206], ['Flow sensor', 300, 68], ['Bench', 24, 326],
];
/** The bench rig as a line drawing that draws itself in. Static (fully drawn) under Calm / reduced motion. */
export function benchDrawing({ animate = true } = {}) {
  const svg = sv('svg', { viewBox: '0 0 640 340', class: 'rig-svg', role: 'img', focusable: 'false',
    'aria-label': 'Illustration, not data: a line drawing of the bench rig. A camera on a stand and a smoke-flow sensor on an arm look at a small upright flame on a stand inside a clear dome on a bench. No measurement is shown.' });
  RIG.forEach(([part, d], i) => svg.append(sv('path', { d, class: `rig-${part}`, pathLength: '1', style: `--k:${i}` })));
  // sight lines: dashed, so they fade in rather than draw
  svg.append(sv('path', { d: 'M152 195L316 222', class: 'rig-sight' }), sv('path', { d: 'M403 108L340 186', class: 'rig-sight' }));
  RIG_LABELS.forEach(([t, x, y], i) => svg.append(sv('text', { x, y, class: 'rig-label', style: `--k:${i}` }, t.toUpperCase())));
  return h('figure', { class: 'rig hud', 'data-anim': animate ? '' : null },
    h('span', { class: 'rig-tag', 'aria-hidden': 'true' }, 'Illustration'),
    h('span', { class: 'rig-stamp' }, 'Awaiting data'),
    svg,
    h('figcaption', { class: 'sr' }, 'Illustration. No camera, depth or smoke-flow result has been measured yet; the pending checks are listed below.'));
}
/** Start the draw-in when the drawing is on screen (call from onMount). Returns a stop function. */
export function startBenchDrawing(fig) {
  if (!fig?.hasAttribute('data-anim')) return () => {};
  if (!('IntersectionObserver' in window)) { fig.classList.add('go'); return () => {}; }
  const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { fig.classList.add('go'); io.disconnect(); } }, { threshold: .2 });
  io.observe(fig);
  return () => io.disconnect();
}

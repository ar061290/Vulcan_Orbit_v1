// The shared Assess store: one set of inputs (flame now, fuel, cabin) used by Assess, the response card on
// Put it out and the short answers. Kept in memory and mirrored to the URL query on #/assess and #/respond,
// so a link reproduces the same assessment. Frozen interface: site/REBUILD_PLAN.md §2.8.
//
// AssessInputs = {
//   preset: string|null,                       // growth_examples example id
//   flame: {flame_type:'surface'|'droplet', frame_time_s, area_cm2, centroid_cm:[x,y], bbox_cm:[x0,y0,x1,y1]|null,
//           droplet:{diameter_mm}|null, confidence:number|null, source:'sliders'|'preset'|'camera'|'example'},
//   fuel: {material, width_cm, length_cm, thickness_mm, sides_burning:1|2, area_density_mg_cm2?},
//   conditions: {flow_cm_s, flow_direction_deg, o2_vol_pct, pressure_atm} }
// No number is invented here: the starting state is always a growth_examples preset.
import { setParams } from './lib.js';

export const DEFAULT_PRESET = 'sibal_concurrent_panel';
const GROUPS = ['flame', 'fuel', 'conditions'];
const MIRROR_ROUTES = ['assess', 'respond'];
const clone = o => JSON.parse(JSON.stringify(o));
let state = { preset: null, flame: null, fuel: null, conditions: null };
const subs = new Set();
let started = false;

export const get = () => clone(state);
export function subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }
const route = () => (typeof location === 'undefined' ? '' : (location.hash.replace(/^#\//, '').split('?')[0]) || 'overview');   // '' in Node

/** Shallow-merge each group (flame, fuel, conditions); preset is replaced. Notifies subscribers. */
export function set(patch = {}, { url = true } = {}) {
  const next = { ...state };
  if ('preset' in patch) next.preset = patch.preset ?? null;
  for (const g of GROUPS) if (patch[g]) next[g] = { ...(state[g] || {}), ...clone(patch[g]) };
  state = next;
  if (url && MIRROR_ROUTES.includes(route())) setParams(toParams(state));
  const snap = get();
  subs.forEach(fn => { try { fn(snap); } catch (e) { console.error(e); } });
  return snap;
}

const listOf = d => (Array.isArray(d) ? d : (d && Array.isArray(d.examples) ? d.examples : []));
/** A growth_examples example → AssessInputs (its inputs, plus the preset id). */
export function fromPreset(example) {
  const i = example.inputs || {}, fs = i.flame_state || {};
  return {
    preset: example.id ?? null,
    flame: { flame_type: fs.flame_type, frame_time_s: fs.frame_time_s, area_cm2: fs.area_cm2, centroid_cm: fs.centroid_cm ? [...fs.centroid_cm] : null,
      bbox_cm: fs.bbox_cm ? [...fs.bbox_cm] : null, droplet: fs.droplet ?? null, confidence: fs.confidence ?? null, source: 'preset' },
    fuel: clone(i.fuel || {}),
    conditions: clone(i.conditions || {}),
  };
}

// ---------- query mirror ----------
// keys: pre ft(s|d) a x y bb(x0,y0,x1,y1) dd t0 m w l th sd ad u dir o2 p
const NUM = { a: ['flame', 'area_cm2'], t0: ['flame', 'frame_time_s'], w: ['fuel', 'width_cm'], l: ['fuel', 'length_cm'], th: ['fuel', 'thickness_mm'],
  ad: ['fuel', 'area_density_mg_cm2'], u: ['conditions', 'flow_cm_s'], dir: ['conditions', 'flow_direction_deg'], o2: ['conditions', 'o2_vol_pct'], p: ['conditions', 'pressure_atm'] };
export const QUERY_KEYS = ['pre', 'ft', 'a', 'x', 'y', 'bb', 'dd', 't0', 'm', 'w', 'l', 'th', 'sd', 'ad', 'u', 'dir', 'o2', 'p'];
const fin = v => (v == null || v === '' ? null : (Number.isFinite(Number(v)) ? Number(v) : null));
const str = v => (v == null ? null : String(v));

function toParams(s) {
  const f = s.flame || {}, fu = s.fuel || {}, c = s.conditions || {};
  const o = { pre: s.preset, ft: f.flame_type === 'droplet' ? 'd' : f.flame_type === 'surface' ? 's' : null };
  for (const [k, [g, field]] of Object.entries(NUM)) o[k] = str(s[g]?.[field]);
  o.x = str(f.centroid_cm?.[0]); o.y = str(f.centroid_cm?.[1]);
  o.bb = Array.isArray(f.bbox_cm) ? f.bbox_cm.join(',') : null;
  o.dd = str(f.droplet?.diameter_mm);
  o.m = fu.material ?? null; o.sd = str(fu.sides_burning);
  return o;
}
export const toQuery = s => { const q = new URLSearchParams(); for (const [k, v] of Object.entries(toParams(s || state))) if (v != null && v !== '') q.set(k, v); return q.toString(); };

/** Query params → Partial<AssessInputs>. Unknown or non-numeric values are ignored, never guessed. */
export function fromQuery(params = {}) {
  const out = {}, grp = g => (out[g] ||= {});
  if (params.pre) out.preset = String(params.pre);
  if (params.ft === 's' || params.ft === 'd') grp('flame').flame_type = params.ft === 'd' ? 'droplet' : 'surface';
  for (const [k, [g, field]] of Object.entries(NUM)) { const v = fin(params[k]); if (v != null) grp(g)[field] = v; }
  const x = fin(params.x), y = fin(params.y);
  if (x != null && y != null) grp('flame').centroid_cm = [x, y];
  if (params.bb) { const b = String(params.bb).split(',').map(fin); if (b.length === 4 && b.every(v => v != null)) grp('flame').bbox_cm = b; }
  const dd = fin(params.dd); if (dd != null) grp('flame').droplet = { diameter_mm: dd };
  if (params.m) grp('fuel').material = String(params.m);
  const sd = fin(params.sd); if (sd === 1 || sd === 2) grp('fuel').sides_burning = sd;
  return out;
}

/** Once per page load, whichever of Assess or Put it out opens first: query → state, else the default preset. */
export function initFromURL(params = {}, examples) {
  if (started) return get();
  const list = listOf(examples);
  if (!list.length) return get();          // examples not loaded: try again on the next call
  started = true;
  const q = fromQuery(params);
  const base = list.find(e => e.id === q.preset) || list.find(e => e.id === DEFAULT_PRESET) || list[0];
  const s = fromPreset(base);
  const touched = GROUPS.some(g => q[g] && Object.keys(q[g]).length);
  for (const g of GROUPS) if (q[g]) Object.assign(s[g], q[g]);
  if (touched) { s.flame.source = 'sliders'; if (q.preset !== base.id) s.preset = null; }
  state = s;
  return set({}, { url: false });
}
export const initialised = () => started;

// ---------- flame state from a camera file or paste ----------
const isNum = v => typeof v === 'number' && Number.isFinite(v);
const isPair = (a, n) => Array.isArray(a) && a.length === n && a.every(isNum);
/** Validate the CONTRACT_PROPOSAL flame-state shape and apply it to the flame group. Never fills partially. */
export function applyFlameState(obj, source = 'camera') {
  const errors = [];
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { ok: false, errors: ['The file is not a JSON object.'] };
  if (obj.coordinates !== 'fuel') errors.push('"coordinates" must be "fuel" (x along the fuel length, y across its width, in cm).');
  if (obj.flame_type !== 'surface' && obj.flame_type !== 'droplet') errors.push('"flame_type" must be "surface" or "droplet".');
  if (!isNum(obj.frame_time_s)) errors.push('"frame_time_s" must be a number (seconds).');
  if (obj.confidence != null && !(isNum(obj.confidence) && obj.confidence >= 0 && obj.confidence <= 1)) errors.push('"confidence" must be a number from 0 to 1, or null.');
  if (obj.flame_type === 'droplet') {
    if (!obj.droplet || !isNum(obj.droplet.diameter_mm) || obj.droplet.diameter_mm <= 0) errors.push('A droplet flame needs "droplet": {"diameter_mm": number above 0}.');
  } else if (obj.flame_type === 'surface') {
    if (!isNum(obj.area_cm2) || obj.area_cm2 <= 0) errors.push('"area_cm2" must be a number above 0.');
    if (!isPair(obj.centroid_cm, 2)) errors.push('"centroid_cm" must be [x, y], two numbers in cm.');
    if (obj.bbox_cm != null) {
      if (!isPair(obj.bbox_cm, 4)) errors.push('"bbox_cm" must be [x0, y0, x1, y1], four numbers in cm, or null.');
      else if (obj.bbox_cm[0] > obj.bbox_cm[2] || obj.bbox_cm[1] > obj.bbox_cm[3]) errors.push('"bbox_cm" must have x0 ≤ x1 and y0 ≤ y1.');
    }
    if (obj.droplet != null) errors.push('"droplet" must be null for a surface flame.');
  }
  if (errors.length) return { ok: false, errors };
  const flame = { flame_type: obj.flame_type, frame_time_s: obj.frame_time_s, confidence: obj.confidence ?? null, source,
    area_cm2: isNum(obj.area_cm2) ? obj.area_cm2 : null, centroid_cm: isPair(obj.centroid_cm, 2) ? [...obj.centroid_cm] : null,
    bbox_cm: isPair(obj.bbox_cm, 4) ? [...obj.bbox_cm] : null, droplet: obj.flame_type === 'droplet' ? { diameter_mm: obj.droplet.diameter_mm } : null };
  set({ flame });
  return { ok: true, errors: [] };
}

/** Area slider rule (§2.8): moving area or position keeps the current box's aspect ratio and rescales the box to the
 *  new area, centred on the centroid. With no box the flame stays a circle (a = b = √(area/π)) and bbox stays null.
 *  Returns a new flame object; the caller passes it to set({flame}). */
export function reshapeFlame(flame, { area_cm2, centroid_cm } = {}) {
  const f = clone(flame || {});
  if (isNum(area_cm2)) f.area_cm2 = area_cm2;
  if (isPair(centroid_cm, 2)) f.centroid_cm = [...centroid_cm];
  if (isPair(f.bbox_cm, 4) && isNum(f.area_cm2) && isPair(f.centroid_cm, 2)) {
    const [x0, y0, x1, y1] = f.bbox_cm, w = x1 - x0, hgt = y1 - y0;
    const r = w > 0 && hgt > 0 ? w / hgt : 1;
    const nw = Math.sqrt(f.area_cm2 * r), nh = Math.sqrt(f.area_cm2 / r), [cx, cy] = f.centroid_cm;
    f.bbox_cm = [cx - nw / 2, cy - nh / 2, cx + nw / 2, cy + nh / 2];
  }
  f.source = 'sliders';
  return f;
}

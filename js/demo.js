// Vulcan Orbit · the demo page (index.html): 01 detect, 02 locate, 03 smoke (when its clip exists), then simulate + risk.
// No number is typed in here: every value comes from a data file (data/*.json) or from the growth model run on the
// visitor's inputs (js/assess_core.js computeAssessment, the same code the full site uses). Status badges say which.
import { load, isMissing } from './lib.js';
import { loadAssessData, computeAssessment } from './assess_core.js';
import { flowingCursor } from './demo_fluid.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const n = (v, d = 0) => (v == null || !Number.isFinite(+v) ? '—' : (+v).toFixed(d));
const sig = (v, k = 2) => (v == null || !Number.isFinite(+v) ? '—' : Number((+v).toPrecision(k)).toString());
const badge = s => `<span class="badge b-${esc(s || 'missing')}">${esc(s || 'no data yet')}</span>`;
const corners = '<i class="c tl"></i><i class="c tr"></i><i class="c bl"></i><i class="c br"></i>';
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- data ----------
const D = await loadAssessData();
const [lat, example, cvs] = await Promise.all([load('saffire_latency'), load('cv_example'), load('cv_scores')]);
const burn = !isMissing(lat) ? (lat.burns || []).find(b => b.key === 's1') || (lat.burns || [])[0] : null;
const ch = re => burn ? (burn.channels || []).find(c => re.test(`${c.key} ${c.name}`)) : null;
const RAD = ch(/radiometer|rad/i), SCA = ch(/scatter|sca/i), OBS = ch(/obscur|obs/i);
const range = c => (Array.isArray(c?.alarm_s_range) && c.alarm_s_range[0] != null && c.alarm_s_range[0] !== c.alarm_s_range[1]
  ? `${n(c.alarm_s_range[0])}–${n(c.alarm_s_range[1])}` : n(c?.alarm_s));
const gapLow = RAD?.alarm_s != null && SCA ? (SCA.alarm_s_range?.[0] ?? SCA.alarm_s) - RAD.alarm_s : null;

// ---------- hero orb (a CSS illustration; the full site has the WebGL flame) ----------
$('porthole').insertAdjacentHTML('afterbegin', '<div class="orb" aria-hidden="true"></div>');
try { flowingCursor(document.querySelector('.hero')); } catch (e) { console.warn('Flowing cursor off:', e.message); }

// ---------- headline stats ----------
$('stats').innerHTML = burn ? `
  <div class="stat"><p class="lab mono" style="color:var(--fire);margin:0">Flame sensor alarm</p><p class="val" style="margin:0">≤ ${n(RAD?.alarm_s)}<small> s</small></p><p class="sub mono" style="margin:0">updates every ${n(RAD?.resolution_s)} s · ${badge(lat.status)}</p></div>
  <div class="stat"><p class="lab mono" style="color:var(--orbit);margin:0">Smoke detector alarm</p><p class="val" style="margin:0">${range(SCA)}<small> s</small></p><p class="sub mono" style="margin:0">loose to strict rule · ${badge(lat.status)}</p></div>
  <div class="stat"><p class="lab mono" style="margin:0">Head start for the flame sensor</p><p class="val" style="margin:0">≥ ${n(gapLow)}<small> s</small></p><p class="sub mono" style="margin:0">real orbital fire, Saffire-III</p></div>`
  : '<div class="stat">The Saffire-III alarm-time file is missing.</div>';

// ---------- media slots: a team clip in media/clips/ wins; otherwise the stored model output ----------
async function exists(url) { try { const r = await fetch(url, { method: 'HEAD', cache: 'no-store' }); return r.ok; } catch { return false; } }
const vid = (src, label) => `<video src="${src}" autoplay muted loop playsinline preload="metadata" aria-label="${esc(label)}"></video>`;
async function slot(id, clip, fallbackHTML, label) {
  const el = $(id); if (!el) return false;
  if (await exists(`media/clips/${clip}`)) { el.innerHTML = vid(`media/clips/${clip}`, label) + `<figcaption class="mono">${esc(label)} · recorded demo</figcaption>`; return true; }
  if (fallbackHTML) { el.innerHTML = fallbackHTML; return true; }
  return false;
}

// ---------- 01 detect ----------
await slot('detect-media', 'detect.mp4',
  `<img src="media/cv/yolo_val_predictions.jpg" alt="Our YOLO model's boxes and confidence scores on 16 validation photos of fires: campfires, candles, fire pits and a building fire" loading="lazy" width="1200" height="1200">
   <figcaption class="mono">Our model's own detections on validation photos · ${badge(isMissing(cvs) ? 'missing' : cvs.status)}</figcaption>`, 'Flame detection');
$('detect-nums').innerHTML = isMissing(cvs) ? '<p>Scores file missing.</p>' : `
  <div class="big">
    <div class="read" style="--c:var(--fire)"><p class="lab mono" style="margin:0">Precision</p><p class="val" style="margin:0">${n(cvs.precision * 100, 1)}%</p><p class="sub" style="margin:0">boxes it draws that really are fire</p></div>
    <div class="read" style="--c:var(--orbit)"><p class="lab mono" style="margin:0">Recall</p><p class="val" style="margin:0">${n(cvs.recall * 100, 1)}%</p><p class="sub" style="margin:0">fires in the images that it finds</p></div>
    <div class="read"><p class="lab mono" style="margin:0">mAP@50</p><p class="val" style="margin:0">${n(cvs.map50, 2)}</p><p class="sub" style="margin:0">YOLO11s · ${cvs.epoch} epochs · validation split</p></div>
  </div>
  <p class="pending">${esc(cvs.limits[0])}</p>
  <a class="mono small-link" href="media/cv/yolo_pr_curve.png">Precision–recall curve ↗</a>`;

// ---------- 02 locate ----------
await slot('locate-media', 'depth.mp4',
  `<video src="media/cv/depth_model.mp4" autoplay muted loop playsinline preload="metadata" aria-label="Depth model output on the bench: near objects warm, far objects cool"></video>
   <figcaption class="mono">Depth Anything V2 on our bench camera · warm = near, cool = far · ${badge('model')}</figcaption>`, '3D location');
$('locate-text').innerHTML = `
  <ol class="how">
    <li><b>Box</b><span>YOLO gives the flame's box in the frame.</span></li>
    <li><b>Depth</b><span>The depth model reads the distance inside the box, calibrated against a measured point on the bench.</span></li>
    <li><b>3D point</b><span>The camera's geometry turns box centre + distance into a position in metres.</span></li>
    <li><b>Size</b><span>Box size at that distance gives the flame's width and height, and an approximate volume (ellipsoid).</span></li>
  </ol>
  <p class="pending">The volume is a geometric estimate from the box, not a measured combustion volume. Its output feeds the simulation below.</p>`;

// ---------- 03 smoke (shown only when the team's clip exists) ----------
const hasSmoke = await slot('smoke-media', 'smoke.mp4', null, 'Optical smoke sensor');
if (hasSmoke) $('smoke').hidden = false;
else { document.querySelector('[data-needs="smoke"]')?.remove(); $('sim-num').textContent = '03'; $('sim-num2').textContent = '03'; }

// ---------- simulate ----------
const cvReal = !isMissing(D.cv);
const ex = !isMissing(D.examples) ? D.examples.examples || [] : [];
const st = { i: 0, flow: null, o2: null };
const flowSteps = !isMissing(D.sp) ? D.sp.flow_cm_s : [0, 50], o2Steps = !isMissing(D.sp) ? D.sp.o2_vol_pct : [15, 35];
function controls() {
  const short = ['Fabric panel', 'Acrylic slab', 'Low airflow'];
  $('controls').innerHTML = `
    <div class="presets" role="group" aria-label="Fuel">${ex.map((e, i) => `<button type="button" class="chip" data-i="${i}" aria-pressed="${i === st.i}" title="${esc(e.title)}">${esc(short[i] || e.id)}</button>`).join('')}</div>
    <div class="slider"><label class="mono" for="flow">Airflow <b id="flowv"></b></label><input id="flow" type="range" min="${Math.min(...flowSteps)}" max="${Math.max(...flowSteps)}" step="1"></div>
    <div class="slider"><label class="mono" for="o2">Oxygen <b id="o2v"></b></label><input id="o2" type="range" min="${Math.min(...o2Steps)}" max="${Math.max(...o2Steps)}" step="0.5"></div>`;
  $('controls').querySelectorAll('.chip').forEach(b => b.addEventListener('click', () => { st.i = +b.dataset.i; st.flow = st.o2 = null; sync(); run(); }));
  let tmr; const deb = () => { clearTimeout(tmr); tmr = setTimeout(run, 180); };
  $('flow').addEventListener('input', e => { st.flow = +e.target.value; $('flowv').textContent = `${st.flow} cm/s`; deb(); });
  $('o2').addEventListener('input', e => { st.o2 = +e.target.value; $('o2v').textContent = `${st.o2}%`; deb(); });
}
function inputs() {
  const e = ex[st.i]; if (!e) return null;
  const c = { ...e.inputs.conditions }; if (st.flow != null) c.flow_cm_s = st.flow; if (st.o2 != null) c.o2_vol_pct = st.o2;
  const flame = cvReal && D.cv.flame_type === 'surface' && st.i === 0 ? D.cv : e.inputs.flame_state;
  return { flame, fuel: e.inputs.fuel, conditions: c };
}
function sync() {
  const inp = inputs(); if (!inp) return;
  document.querySelectorAll('#controls .chip').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.i === st.i)));
  $('flow').value = inp.conditions.flow_cm_s; $('flowv').textContent = `${inp.conditions.flow_cm_s} cm/s`;
  $('o2').value = inp.conditions.o2_vol_pct; $('o2v').textContent = `${inp.conditions.o2_vol_pct}%`;
}
let runId = 0;
async function run() {
  const id = ++runId, inp = inputs(); if (!inp) return;
  $('simnums').innerHTML = '<p class="mono" style="color:var(--mute);font-size:11px">Running the spread model…</p>';
  let res;
  try { res = await computeAssessment(inp, D); } catch (e) { $('simnums').textContent = `The model could not run: ${e.message}`; return; }
  if (id !== runId) return;
  drawSim(res, inp); drawRisk(res);
}
function drawSim(res, inp) {
  const g = res.growth;
  if (!g) {
    $('curve').innerHTML = `${corners}<p class="ptitle mono"><span>Burning area over time</span>${badge('model')}</p><p>${esc(res.error || (res.sentences || []).join(' ') || 'No result.')}</p>`;
    $('simnums').innerHTML = ''; return;
  }
  const W = 640, H = 260, T = g.t_s, A = g.area_cm2, maxA = Math.max(1e-9, ...A.hi), maxT = Math.max(1e-9, ...T);
  const X = s => s / maxT * W, Y = a => H - a / maxA * H;
  const line = arr => 'M' + T.map((s, i) => `${X(s).toFixed(1)},${Y(arr[i]).toFixed(1)}`).join(' L');
  const band = 'M' + T.map((s, i) => `${X(s).toFixed(1)},${Y(A.hi[i]).toFixed(1)}`).join(' L') + ' L' + T.map((s, i) => `${X(s).toFixed(1)},${Y(A.lo[i]).toFixed(1)}`).reverse().join(' L') + 'Z';
  const ticks = [0, .25, .5, .75, 1].map(f => `<text x="${X(f * maxT)}" y="${H + 18}" text-anchor="middle" font-size="10" fill="#8C8A93">${n(f * maxT)} s</text>`).join('');
  const out = (res.boxes || []).filter(b => !b.inside);
  $('curve').innerHTML = `${corners}
    <p class="ptitle mono"><span>Burning area over time · ${esc(inp.fuel.material)}</span>${badge('model')}</p>
    <svg viewBox="-8 -8 ${W + 16} ${H + 30}" width="100%" role="img" aria-label="Burning area over time: peak ${sig(g.summary.mid.max_area_cm2, 3)} square centimetres in the middle estimate, flame out by ${n(g.summary.mid.t_end_s)} seconds">
      <line x1="0" y1="${H}" x2="${W}" y2="${H}" stroke="rgba(255,255,255,.25)"/>${ticks}
      <path d="${band}" fill="#FF7A3D" fill-opacity=".14"/>
      <path d="${line(A.lo)}" fill="none" stroke="#FF7A3D" stroke-opacity=".45" stroke-width="1.2"/>
      <path d="${line(A.hi)}" fill="none" stroke="#FF7A3D" stroke-opacity=".45" stroke-width="1.2"/>
      <path d="${line(A.mid)}" fill="none" stroke="#FF7A3D" stroke-width="2.6"/>
      <text x="4" y="12" font-size="10" fill="#8C8A93">HIGH ESTIMATE PEAK ${sig(maxA, 3)} CM²</text>
    </svg>
    <div class="legend mono"><span style="--c:#FF7A3D">middle estimate</span><span style="--c:rgba(255,122,61,.35)">low–high range</span></div>
    ${out.length ? `<p class="warn">Outside the conditions NASA tested for this fuel (${esc(out.map(b => b.label || b.name || 'input').join(', '))}): treat as an extrapolation.</p>` : ''}`;
  const r = g.rates_mm_s, s = g.summary, dir = (r.mid.concurrent ?? 0) >= (r.mid.opposed ?? 0) ? 'concurrent' : 'opposed';
  $('simnums').innerHTML = `<div class="big">
    <div class="read" style="--c:var(--fire)"><p class="lab mono" style="margin:0">Fastest spread (${dir === 'concurrent' ? 'with' : 'against'} the air)</p><p class="val" style="margin:0">${sig(r.mid[dir], 2)} <small class="mono" style="font-size:14px;color:var(--mute)">mm/s</small></p><p class="sub" style="margin:0">range ${sig(r.lo[dir], 2)}–${sig(r.hi[dir], 2)}</p></div>
    <div class="read" style="--c:var(--fire)"><p class="lab mono" style="margin:0">Peak burning area</p><p class="val" style="margin:0">${sig(s.mid.max_area_cm2, 3)} <small class="mono" style="font-size:14px;color:var(--mute)">cm²</small></p><p class="sub" style="margin:0">range ${sig(s.lo.max_area_cm2, 3)}–${sig(s.hi.max_area_cm2, 3)}</p></div>
    <div class="read" style="--c:var(--orbit)"><p class="lab mono" style="margin:0">Flame stays alight</p><p class="val" style="margin:0">${n(s.mid.t_end_s)} <small class="mono" style="font-size:14px;color:var(--mute)">s</small></p><p class="sub" style="margin:0">range ${n(s.hi.t_end_s)}–${n(s.lo.t_end_s)} s · ends: ${esc(s.mid.stop_reason)}</p></div>
  </div>`;
}

// ---------- risk ----------
function drawRisk(res) {
  const k = res.risk || {}, lv = k.level || 'Unknown';
  $('risk').innerHTML = `
    <div><p class="ptitle mono"><span>Risk level</span>${badge(k.status || 'team')}</p><p class="level lv-${esc(lv)}" style="margin:0">${esc(lv)}</p></div>
    <div><p style="margin:0;font-size:18px">${esc(k.fired?.reason || '')}</p>
      <ul>${(res.sentences || []).slice(0, 3).map(x => `<li>${esc(x)}</li>`).join('')}</ul>
      <p class="pending" style="margin-top:14px">${k.approved ? 'Rules approved by the team.' : 'Team rules, not yet approved: they combine model output with NASA alarm times and use no hand-typed thresholds.'}</p></div>`;
}

// ---------- motion: rise-in and trace draw on scroll ----------
const rise = [...document.querySelectorAll('.stats, .step>header, .panel, .controls, .end')].filter(el => !el.closest('[hidden]'));
if (!reduce && 'IntersectionObserver' in window) {
  rise.forEach(el => el.classList.add('rise'));
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add('in'); io.unobserve(e.target);
    if (e.target.id === 'scope') e.target.querySelectorAll('path.tr').forEach((p, i) => {
      p.style.transition = `stroke-dashoffset ${1.6 + i * .4}s cubic-bezier(.65,0,.35,1) ${0.2 + i * .25}s`; p.style.strokeDashoffset = '0'; });
  }), { threshold: 0.15 });
  rise.forEach(el => io.observe(el));
} else document.querySelectorAll('#scope path.tr').forEach(p => { p.style.strokeDasharray = ''; p.style.strokeDashoffset = ''; });

controls(); sync(); run();

// click any gallery picture to see it full size; click or Esc to close
document.addEventListener('click', e => {
  const img = e.target.closest('.gallery img, .media img'); if (!img) return;
  const z = document.createElement('div'); z.className = 'zoom'; z.innerHTML = `<img src="${img.src}" alt="${esc(img.alt)}">`;
  const close = () => { z.remove(); removeEventListener('keydown', esc_); }; const esc_ = k => k.key === 'Escape' && close();
  z.addEventListener('click', close); addEventListener('keydown', esc_); document.body.append(z);
});

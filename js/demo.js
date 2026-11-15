// Vulcan Orbit · prototype demo (demo.html). One page: detect -> simulate -> assess -> respond.
// No number is typed in here: every value comes from a data file (data/*.json) or from the growth model run on the
// visitor's inputs (js/assess_core.js computeAssessment, the same code the full site uses). Status badges say which.
import { load, isMissing } from './lib.js';
import { loadAssessData, computeAssessment } from './assess_core.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const n = (v, d = 0) => (v == null || !Number.isFinite(+v) ? '—' : (+v).toFixed(d));
const sig = (v, k = 2) => (v == null || !Number.isFinite(+v) ? '—' : Number((+v).toPrecision(k)).toString());
const badge = s => `<span class="badge b-${esc(s || 'missing')}">${esc(s || 'no data yet')}</span>`;
const corners = '<i class="c tl"></i><i class="c tr"></i><i class="c bl"></i><i class="c br"></i>';
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- data ----------
const D = await loadAssessData();
const [lat, flex, example, models] = await Promise.all([load('saffire_latency'), load('flex_suppression'), load('cv_example'), load('models')]);
const m7 = !isMissing(models) ? (models.models || []).find(m => m.id === 'm7-extinction') : null;
const burn = !isMissing(lat) ? (lat.burns || []).find(b => b.key === 's1') || (lat.burns || [])[0] : null;
const ch = re => burn ? (burn.channels || []).find(c => re.test(`${c.key} ${c.name}`)) : null;
const RAD = ch(/radiometer|rad/i), SCA = ch(/scatter|sca/i), OBS = ch(/obscur|obs/i);
const range = c => (Array.isArray(c?.alarm_s_range) && c.alarm_s_range[0] != null && c.alarm_s_range[0] !== c.alarm_s_range[1]
  ? `${n(c.alarm_s_range[0])}–${n(c.alarm_s_range[1])}` : n(c?.alarm_s));
const gapLow = RAD?.alarm_s != null && SCA ? (SCA.alarm_s_range?.[0] ?? SCA.alarm_s) - RAD.alarm_s : null;

// ---------- hero orb (a CSS illustration; the full site has the WebGL flame) ----------
$('porthole').insertAdjacentHTML('afterbegin', '<div class="orb" aria-hidden="true"></div>');

// ---------- headline stats ----------
$('stats').innerHTML = burn ? `
  <div class="stat"><p class="lab mono" style="color:var(--fire);margin:0">Flame sensor alarm</p><p class="val" style="margin:0">≤ ${n(RAD?.alarm_s)}<small> s</small></p><p class="sub mono" style="margin:0">updates every ${n(RAD?.resolution_s)} s · ${badge(lat.status)}</p></div>
  <div class="stat"><p class="lab mono" style="color:var(--orbit);margin:0">Smoke detector alarm</p><p class="val" style="margin:0">${range(SCA)}<small> s</small></p><p class="sub mono" style="margin:0">loose to strict rule · ${badge(lat.status)}</p></div>
  <div class="stat"><p class="lab mono" style="margin:0">Head start for the flame sensor</p><p class="val" style="margin:0">≥ ${n(gapLow)}<small> s</small></p><p class="sub mono" style="margin:0">real orbital fire, Saffire-III</p></div>`
  : '<div class="stat">The Saffire-III alarm-time file is missing.</div>';

// ---------- 01 detect: camera reading ----------
const cvReal = !isMissing(D.cv);
const cam = cvReal ? D.cv : (!isMissing(example) ? example : null);
const camStatus = cvReal ? D.cv.status : 'demo';
$('camera').innerHTML = `
  <p class="ptitle mono"><span>Camera model reading</span>${badge(camStatus)}</p>
  ${cam ? `<dl class="kv">
    <dt>Flame</dt><dd>${esc(cam.flame_type)} flame${cam.confidence != null ? `, confidence ${sig(cam.confidence, 2)}` : ''}</dd>
    <dt>Size</dt><dd>${sig(cam.area_cm2, 3)} cm² on the fuel</dd>
    <dt>Where</dt><dd>centre at ${sig(cam.centroid_cm?.[0], 3)}, ${sig(cam.centroid_cm?.[1], 3)} cm</dd>
    ${cam.flame_volume_cm3 != null ? `<dt>Volume</dt><dd>${sig(cam.flame_volume_cm3, 3)} cm³ (depth model)</dd>` : ''}
    ${cam.distance_from_sensor_cm != null ? `<dt>Distance</dt><dd>${sig(cam.distance_from_sensor_cm, 3)} cm from the camera</dd>` : ''}
    ${cam.smoke_flow ? `<dt>Smoke</dt><dd>${sig(cam.smoke_flow.speed_mm_s, 3)} mm/s toward ${sig(cam.smoke_flow.direction_deg, 3)}°</dd>` : ''}
  </dl>` : '<p>No camera reading yet.</p>'}
  <p class="pending">${cvReal ? 'Live output of the camera and depth models on the bench prototype.'
    : 'Example reading, shaped exactly like the camera model\'s output, so the next steps can run. The live camera, depth and optical smoke-sensor feeds plug in here.'}</p>`;

// ---------- 01 detect: Saffire-III scope ----------
function scope() {
  if (!burn) { $('scope').insertAdjacentHTML('beforeend', '<p>No Saffire-III file.</p>'); return; }
  const W = 640, H = 230, t = burn.t, tmin = -20, tmax = 130, ymax = 2.35;
  const sym = v => Math.sign(v) * Math.log10(1 + Math.abs(v));
  const X = s => (s - tmin) / (tmax - tmin) * W, Y = v => H - Math.max(-0.05, Math.min(1, sym(v) / ymax)) * H;
  const path = c => c ? 'M' + t.map((s, i) => s <= tmax ? `${X(s).toFixed(1)},${Y(c.values[i]).toFixed(1)}` : null).filter(Boolean).join(' L') : '';
  const grid = [0, 30, 60, 90, 120].map(s => `<line x1="${X(s)}" y1="0" x2="${X(s)}" y2="${H}" stroke="rgba(255,255,255,.06)"/><text x="${X(s)}" y="${H + 18}" text-anchor="middle" font-size="10" fill="#8C8A93">${s} s</text>`).join('');
  const a7 = X(RAD?.alarm_s ?? 7), a2 = X(SCA?.alarm_s_range?.[0] ?? SCA?.alarm_s ?? 0);
  $('scope').insertAdjacentHTML('beforeend', `
    <p class="ptitle mono"><span>Proof from orbit · NASA Saffire-III, burn 1</span>${badge(lat.status)}</p>
    <svg viewBox="-8 -8 ${W + 16} ${H + 30}" width="100%" role="img" aria-label="Saffire-III burn 1: the flame sensor crosses the alarm level within ${n(RAD?.alarm_s)} seconds, the cabin smoke detector at ${range(SCA)} seconds">
      <defs><filter id="gl"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <clipPath id="cp"><rect x="0" y="-8" width="${W}" height="${H + 8}"/></clipPath></defs>
      ${grid}
      <line x1="0" y1="${Y(1)}" x2="${W}" y2="${Y(1)}" stroke="#EDE8DF" stroke-opacity=".5" stroke-dasharray="2 6"/>
      <text x="${W - 4}" y="${Y(1) - 8}" text-anchor="end" font-size="10" fill="#EDE8DF" fill-opacity=".8">ALARM LEVEL</text>
      <line x1="${X(0)}" y1="0" x2="${X(0)}" y2="${H}" stroke="#FF7A3D" stroke-opacity=".5" stroke-dasharray="5 7"/>
      <g clip-path="url(#cp)" fill="none" stroke-linejoin="round">
        <path class="tr" d="${path(OBS)}" stroke="#8C8A93" stroke-width="1.6"/>
        <path class="tr" d="${path(SCA)}" stroke="#7AA2FF" stroke-width="2.4" filter="url(#gl)"/>
        <path class="tr" d="${path(RAD)}" stroke="#FF7A3D" stroke-width="2.4" filter="url(#gl)"/>
      </g>
      <rect x="${a7}" y="18" width="${Math.max(0, a2 - a7)}" height="2" fill="#EDE8DF"/><rect x="${a7}" y="18" width="2" height="10" fill="#EDE8DF"/><rect x="${a2 - 2}" y="18" width="2" height="10" fill="#EDE8DF"/>
      <text x="${(a7 + a2) / 2}" y="10" text-anchor="middle" font-size="13" font-weight="600" fill="#EDE8DF">AT LEAST ${n(gapLow)} S</text>
      <circle cx="${a7}" cy="${Y(1)}" r="5" fill="#FF7A3D"/><circle cx="${a2}" cy="${Y(1)}" r="5" fill="#7AA2FF"/>
    </svg>
    <div class="reads">
      <div class="read" style="--c:var(--fire)"><p class="lab mono" style="margin:0">Flame sensor</p><p class="val" style="margin:0">≤ ${n(RAD?.alarm_s)} s</p><p class="sub" style="margin:0">in the flow duct</p></div>
      <div class="read" style="--c:var(--orbit)"><p class="lab mono" style="margin:0">Smoke detector</p><p class="val" style="margin:0">${range(SCA)} s</p><p class="sub" style="margin:0">in the cabin</p></div>
      <div class="read"><p class="lab mono" style="margin:0">Second channel</p><p class="val" style="margin:0;color:var(--mute)">${OBS?.alarm_s == null ? 'none' : n(OBS.alarm_s) + ' s'}</p><p class="sub" style="margin:0">never reached alarm</p></div>
    </div>`);
  if (!reduce) document.querySelectorAll('#scope path.tr').forEach(p => { const L = p.getTotalLength(); p.style.strokeDasharray = L; p.style.strokeDashoffset = L; p.dataset.len = L; });
}
scope();

// ---------- 02 simulate ----------
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

// ---------- 03 assess ----------
function drawRisk(res) {
  const k = res.risk || {}, lv = k.level || 'Unknown';
  $('risk').innerHTML = `
    <div><p class="ptitle mono"><span>Risk level</span>${badge(k.status || 'team')}</p><p class="level lv-${esc(lv)}" style="margin:0">${esc(lv)}</p></div>
    <div><p style="margin:0;font-size:18px">${esc(k.fired?.reason || '')}</p>
      <ul>${(res.sentences || []).slice(0, 3).map(x => `<li>${esc(x)}</li>`).join('')}</ul>
      <p class="pending" style="margin-top:14px">${k.approved ? 'Rules approved by the team.' : 'Team rules, not yet approved: they combine model output with NASA alarm times and use no hand-typed thresholds.'}</p></div>`;
}

// ---------- 04 respond ----------
if (!isMissing(flex)) {
  const label = g => /none/i.test(g.gas) ? 'No added gas' : g.gas === 'CO2' ? 'With CO₂ added' : g.gas === 'He' ? 'With helium added' : g.gas;
  $('flex').innerHTML = `<p class="ptitle mono"><span>NASA FLEX droplet flames that went out</span>${badge(flex.status)}</p>
    <div class="flexrow">${(flex.groups || []).map(g => { const p = g.extinguished / g.tests;
      return `<div class="read" style="--c:${/CO2/.test(g.gas) ? 'var(--orbit)' : /He/.test(g.gas) ? '#c9a0ff' : 'var(--mute)'}"><p class="lab mono" style="margin:0">${esc(label(g))}</p>
      <p class="val" style="margin:0">${n(p * 100)}%</p><p class="sub" style="margin:0">${g.extinguished} of ${g.tests} burns</p><div class="bar2"><i style="width:${(p * 100).toFixed(1)}%"></i></div></div>`; }).join('')}</div>
    <p class="pending">NASA chose near-limit conditions on purpose, so these shares reflect the test plan, not a controlled comparison of the gases. ${m7 ? `The full project's Respond page has the model that predicts when a droplet flame goes out: ${esc(m7.metric)} ${n(m7.score, 2)} on test sessions it never saw.` : ''}</p>`;
} else $('flex').innerHTML = '<p>The FLEX summary file is missing.</p>';

// ---------- motion: rise-in and trace draw on scroll ----------
const rise = [...document.querySelectorAll('.stats, .step>header, .panel, .controls, .end')];
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

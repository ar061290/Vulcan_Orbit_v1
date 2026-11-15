// Flame page: the reduced-order flame model (models/flame-sim) and every check it was put through.
import { h, load, page, card, empty, fmt, tip, untip } from '../lib.js';
import { scatter, lineChart, C, SERIES } from '../charts.js';
import { flameSim } from '../flame_sim.js';

const GCOL = { '0 g': C.s1, 'Moon 0.16 g': C.s3, 'Mars 0.38 g': C.s4, 'Earth 1 g': C.s2 };
const GNAME = { '0 g': 'Orbit', 'Moon 0.16 g': 'Moon (model only)', 'Mars 0.38 g': 'Mars (model only)', 'Earth 1 g': 'Earth' };

function chips(label, opts, cur, onPick, show = o => o) {
  const wrap = h('div', { class: 'row', style: 'margin-bottom:8px' }, h('label', {}, label));
  for (const o of opts) { const b = h('button', { class: 'chip', 'aria-pressed': String(o === cur), onclick: () => { wrap.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', String(c === b))); onPick(o); } }, show(o)); wrap.append(b); }
  return wrap;
}

function flexCard(fs) {
  const fuels = [['n-heptane', C.s1], ['methanol', C.s2]];
  const pts = fs.flex_comparison.filter(r => r.K_model_mm2_s != null && r.K_meas_mm2_s != null).map(r => {
    const col = (fuels.find(f => f[0] === r.fuel) || [0, C.s3])[1];
    return { x: r.K_meas_mm2_s, y: r.K_model_mm2_s, color: col, label: `<b>FLEX test ${r.id}</b><br>${r.fuel}, ${Math.round(r.X.O2 * 100)}% O2, ${fmt(r.P_kPa, 0)} kPa, ${r.d0_mm} mm droplet<br>measured ${fmt(r.K_meas_mm2_s, 3)} mm²/s, model ${fmt(r.K_model_mm2_s, 3)}<br><span>${r.half === 'tune' ? 'used to tune' : 'held out'}</span>` };
  });
  const S = fs.flex_K_stats;
  const rows = Object.entries(S).map(([f, s]) => h('tr', {}, h('td', {}, h('b', {}, f)), h('td', {}, String(s.n)), h('td', {}, `${fmt(s.held_out_median_abs_err_pct, 0)}%`), h('td', {}, `${fmt(s.baseline_held_out_median_abs_err_pct, 0)}%`),
    h('td', {}, s.held_out_median_abs_err_pct < s.baseline_held_out_median_abs_err_pct ? 'model' : 'constant K')));
  return card('Droplet burning rate vs NASA FLEX', fs.status, 'Each dot is one droplet burned on the space station. The d-squared law predicts how fast it shrinks (K); the dashed line is a perfect match.',
    scatter({ points: pts, diagonal: true, xLabel: 'Measured K, mm²/s', yLabel: 'Model K, mm²/s' }),
    h('div', { class: 'legend' }, ...fuels.map(([f, c]) => h('span', {}, h('i', { style: `background:${c};border-radius:50%` }), f))),
    h('div', { class: 'scroll', style: 'margin-top:8px' }, h('table', {}, h('thead', {}, h('tr', {}, ...['Fuel', 'Tests', 'Error on held-out tests', 'Baseline: one constant K', 'Better'].map(t => h('th', {}, t)))), h('tbody', {}, ...rows))),
    h('p', { style: 'margin-top:8px' }, h('small', {}, 'Held-out tests were never used to tune the model. For n-heptane a single constant burning rate does better than the model; for methanol the model wins. FLEX burned only these two fuels. Source: NASA PSI-69 (FLEX).')));
}

function spreadCard(sp) {
  const fuels = [...new Set(sp.rates.map(r => r.fuel))], st = { fuel: fuels[0], o2: 0.21, p: 101.3 }; const holder = h('div');
  function draw() {
    const rs = sp.rates.filter(r => r.fuel === st.fuel && r.X_O2 === st.o2 && r.P_kPa === st.p);
    const order = ['0 g', 'Earth 1 g'];   // Moon and Mars left out: no NASA data to check them
    const series = order.map(g => rs.find(r => r.gravity === g)).filter(Boolean).map(r => ({ name: GNAME[r.gravity], color: GCOL[r.gravity], points: r.flow_m_s.map((f, i) => [f, r.rate_mm_s[i] ?? 0]) }));
    holder.replaceChildren(series.length ? lineChart({ series, xLabel: 'Opposed airflow, m/s', yLabel: 'Spread rate, mm/s', unit: ' mm/s' }) : h('p', {}, 'No case for this combination.'),
      h('div', { class: 'legend' }, ...series.map(s => h('span', {}, h('i', { style: `background:${s.color}` }), s.name))));
  }
  draw();
  const G = sp.bass_ii_groups; const gr = Object.entries(G).filter(([k]) => k.startsWith('group'));
  return card('How fast flame crosses a solid', sp.status, 'de Ris spread formulas with a low-flow and blow-off correction, over PMMA (acrylic) sheets.',
    chips('Fuel', fuels, st.fuel, v => { st.fuel = v; draw(); }), chips('Oxygen', [0.21, 0.34], st.o2, v => { st.o2 = v; draw(); }, o => `${Math.round(o * 100)}%`), chips('Pressure', [101.3, 70.3], st.p, v => { st.p = v; draw(); }, o => `${o} kPa`),
    holder,
    h('h3', { style: 'margin-top:12px' }, 'Checked against NASA BASS-II (spread on the space station)'),
    h('div', { class: 'scroll' }, h('table', {}, h('thead', {}, h('tr', {}, ...['Sample', 'Burns', 'Model error', 'de Ris alone'].map(t => h('th', {}, t)))),
      h('tbody', {}, ...gr.map(([k, s]) => h('tr', {}, h('td', {}, h('b', {}, k.replace('group: ', ''))), h('td', {}, String(s.n)), h('td', {}, `${fmt(s.median_abs_err_pct, 0)}%`), h('td', {}, `${fmt(s.baseline_median_abs_err_pct, 0)}%`)))))),
    h('p', { style: 'margin-top:8px' }, h('small', {}, 'Thin sheets: within 10% of the two BASS-II burns, but plain de Ris is just as close. Thick slabs: about 3 times too fast, because the formula assumes steady spread and thick slabs in orbit never got there (check S3-spread, failed). BASS-II rates are as reported by NASA, not re-measured by us.')));
}

function mapCard(sp) {
  const st = { g: '0 g', p: 101.3 }; const holder = h('div');
  const W = 640, H = 340, m = { l: 52, r: 14, t: 12, b: 40 }, iw = W - m.l - m.r, ih = H - m.t - m.b;
  function draw() {
    const M = sp.flammability_maps.find(x => x.gravity === st.g && x.P_kPa === st.p); if (!M) return holder.replaceChildren(h('p', {}, 'No map.'));
    const fl = M.flow_m_s, o2 = M.O2, lx = v => Math.log10(v), X = v => m.l + (lx(v) - lx(fl[0])) / (lx(fl[fl.length - 1]) - lx(fl[0])) * iw, Y = v => m.t + ih - (v - o2[0]) / (o2[o2.length - 1] - o2[0]) * ih;
    const cv = h('canvas', { width: W * 2, height: H * 2, style: 'width:100%;height:auto;display:block' }); const c = cv.getContext('2d'); c.scale(2, 2);
    c.fillStyle = 'rgba(57,135,229,.10)'; c.fillRect(X(0.077), m.t, X(0.203) - X(0.077), ih);                 // station ventilation band
    const g = document.createElement('canvas'); g.width = fl.length; g.height = o2.length; const gc = g.getContext('2d'), im = gc.createImageData(fl.length, o2.length);
    for (let j = 0; j < o2.length; j++) for (let i = 0; i < fl.length; i++) if (M.burning[j][i]) { const p = ((o2.length - 1 - j) * fl.length + i) * 4; im.data[p] = 217; im.data[p + 1] = 89; im.data[p + 2] = 38; im.data[p + 3] = 150; }
    gc.putImageData(im, 0, 0); c.imageSmoothingEnabled = false;
    const hx = (X(fl[1]) - X(fl[0])) / 2, hy = (Y(o2[0]) - Y(o2[1])) / 2;            // flows are log-spaced, O2 linear: cells are uniform on screen
    c.drawImage(g, X(fl[0]) - hx, Y(o2[o2.length - 1]) - hy, X(fl[fl.length - 1]) - X(fl[0]) + 2 * hx, Y(o2[0]) - Y(o2[o2.length - 1]) + 2 * hy);
    c.strokeStyle = '#383835'; c.beginPath(); c.moveTo(m.l, m.t + ih); c.lineTo(m.l + iw, m.t + ih); c.moveTo(m.l, m.t); c.lineTo(m.l, m.t + ih); c.stroke();
    c.fillStyle = '#898781'; c.font = '12px system-ui'; c.textAlign = 'center';
    for (const v of [0.001, 0.01, 0.1, 1]) if (v >= fl[0] && v <= fl[fl.length - 1]) c.fillText(v < 0.01 ? '1 mm/s' : v < 0.1 ? '1 cm/s' : v < 1 ? '10 cm/s' : '1 m/s', X(v), m.t + ih + 16);
    c.fillText('Airflow along the sample (log scale)', m.l + iw / 2, H - 4); c.textAlign = 'right';
    for (const v of [0.1, 0.2, 0.3, 0.4]) if (v >= o2[0] && v <= o2[o2.length - 1] + 1e-9) c.fillText(`${Math.round(v * 100)}%`, m.l - 8, Y(v) + 4);
    c.save(); c.translate(14, m.t + ih / 2); c.rotate(-Math.PI / 2); c.textAlign = 'center'; c.fillText('Oxygen', 0, 0); c.restore();
    c.setLineDash([4, 4]); c.strokeStyle = '#c3c2b7'; for (const v of [0.21, 0.34]) { c.beginPath(); c.moveTo(m.l, Y(v)); c.lineTo(m.l + iw, Y(v)); c.stroke(); } c.setLineDash([]);
    c.fillStyle = '#f0efec'; c.textAlign = 'left'; c.fillText('air, 21%', m.l + 6, Y(0.21) - 5); c.fillText('exploration cabin, 34%', m.l + 6, Y(0.34) - 5); c.fillStyle = '#6da7ec'; c.fillText('station airflow', X(0.077) + 4, m.t + 14);
    cv.addEventListener('pointermove', e => { const r = cv.getBoundingClientRect(), px = (e.clientX - r.left) / r.width * W, py = (e.clientY - r.top) / r.height * H;
      const f = 10 ** (lx(fl[0]) + (px - m.l) / iw * (lx(fl[fl.length - 1]) - lx(fl[0]))), o = o2[0] + (m.t + ih - py) / ih * (o2[o2.length - 1] - o2[0]);
      if (px < m.l || px > m.l + iw || py < m.t || py > m.t + ih) return untip();
      const i = fl.reduce((b, v, k) => Math.abs(lx(v) - lx(f)) < Math.abs(lx(fl[b]) - lx(f)) ? k : b, 0), j = o2.reduce((b, v, k) => Math.abs(v - o) < Math.abs(o2[b] - o) ? k : b, 0);
      tip(e, `<b>${M.burning[j][i] ? 'Burns' : 'Goes out'}</b><br>airflow ${fmt(fl[i] * 100, 1)} cm/s, oxygen ${Math.round(o2[j] * 100)}%`); });
    cv.addEventListener('pointerleave', untip);
    holder.replaceChildren(cv, h('div', { class: 'legend' }, h('span', {}, h('i', { style: 'background:rgba(217,89,38,.55)' }), 'Flame survives'), h('span', {}, h('i', { style: 'background:rgba(57,135,229,.25)' }), 'Station ventilation range')),
      h('p', { style: 'margin-top:6px' }, `Lowest oxygen that burns: `, h('b', {}, `${Math.round(M.min_O2 * 100)}%`), ` at about ${fmt(M.min_O2_flow_m_s * 100, 1)} cm/s.`, M.gravity_label === 'validated' ? '' : ' Model only, not validated.'));
  }
  draw();
  return card('Where a flame can survive', 'model', 'Thin acrylic sheet, both sides burning. Too little airflow starves the flame of oxygen; too much blows it off.',
    chips('Gravity', ['0 g', 'Earth 1 g'], st.g, v => { st.g = v; draw(); }, o => GNAME[o]), chips('Pressure', [101.3, 70.3], st.p, v => { st.p = v; draw(); }, o => `${o} kPa`),
    holder, h('p', {}, h('small', {}, 'Limits are set by a Damköhler-number criterion tuned on one BASS-II blow-off and one quench point, so treat the edges as approximate. BASS-II saw spread down to about 16–17% O2; the model\'s 11% minimum in orbit is probably too low.')));
}

function frontCard(sp) {
  const series = sp.fronts.map((f, i) => ({ name: f.case.split(',')[0], color: SERIES[i], points: f.t_s.map((t, k) => [t / 60, f.front_cm[k]]).filter((_, k, a) => k % Math.ceil(a.length / 150) === 0), near: 2 }));
  return card('A fire growing across a sample', sp.status, 'Flame front marching across a 20 cm sheet in orbit, 21% oxygen, 0.10 m/s opposed airflow. This burning area feeds the growing smoke source in the cabin model.',
    lineChart({ series, xLabel: 'Minutes after ignition', yLabel: 'Front position, cm', unit: ' cm' }),
    h('div', { class: 'legend' }, ...series.map(s => h('span', {}, h('i', { style: `background:${s.color}` }), s.name))),
    h('div', { class: 'grid g3', style: 'margin-top:8px' }, ...sp.fronts.map(f => h('div', {}, h('small', {}, f.case.split(',')[0]), h('div', { class: 'stat', style: 'font-size:20px' }, fmt(f.spread_mm_s, 2), h('small', {}, 'mm/s')), h('small', {}, `crosses 20 cm in ${fmt(f.t_burn_s / 60, 1)} min`)))));
}

function checksCard(list) {
  const lab = v => v === true ? ['pass', 'Pass'] : v === false ? ['fail', 'Fail (kept on record)'] : ['pending', 'Not run: no data'];
  return card('Every check on the flame model', 'model', 'Pass limits were committed before any check ran and were not changed after. Failures stay here.',
    h('div', { class: 'scroll' }, h('table', {}, h('thead', {}, h('tr', {}, ...['', 'Result', 'Status'].map(t => h('th', {}, t)))),
      h('tbody', {}, ...list.map(c => { const [s, t] = lab(c.ok); return h('tr', {}, h('td', {}, h('code', {}, c.id)), h('td', {}, c.result), h('td', {}, h('span', { class: `status ${s}` }, t))); })))));
}

export default async function (root) {
  const [fs, sp, gapsD] = await Promise.all([load('flame_static'), load('flame_spread'), load('gaps')]);
  if (fs.status === 'missing') { root.append(page('Flame', '', card('Flame simulator', 'missing', null, empty('Waiting for the flame model', 'flame_static', 'Run python models/flame-sim/build.py', '')))); return; }
  root.append(page('Flame in freefall', 'On Earth a flame is a flickering teardrop because hot gas rises. In orbit nothing rises, so the same flame becomes a sphere fed only by slow diffusion. This page runs our reduced-order flame model and shows every check against NASA data.',
    flameSim(fs, gapsD),
    h('div', { class: 'grid g2', style: 'margin-top:14px' }, flexCard(fs), spreadCard(sp)),
    h('div', { class: 'grid g2', style: 'margin-top:14px' }, mapCard(sp), frontCard(sp)),
    h('div', { style: 'margin-top:14px' }, checksCard([...(fs.checks || []), ...(sp.checks || [])])),
    h('div', { style: 'margin-top:14px' }, card('Limits', null, null, h('ul', { style: 'margin:0;padding-left:18px;color:var(--ink2)' }, ...[...(fs.limits || []), ...(sp.limits || []),
      'Moon and Mars are not shown: NASA has no flame data between 0 g and 1 g, so nothing could check them.', 'No output here says any material or atmosphere is safe.'].map(t => h('li', { style: 'margin-bottom:4px' }, t)))))));
}

// Hero flame illustration. PHASE 1 STUB: a static SVG drawing (no WebGL). Phase 6 (P6-A) replaces this module with
// the WebGL 2 shader from main; the interface stays: hero({g, fit, ctx}) → {el, ok, setG(v, now)}.
// This is an ILLUSTRATION, not data: at 0 g a near-spherical dim blue shell, at 1 g a bright sooty teardrop.
let n = 0;
const NS = 'http://www.w3.org/2000/svg';
const LABEL = 'Illustration: a fuel droplet burning, with gravity switched off (a dim blue sphere) or on (a bright yellow teardrop)';
// Fixed star positions for the drawing (decoration, not data).
const STARS = [[18, 30], [52, 210], [88, 64], [120, 250], [150, 22], [196, 280], [232, 48], [262, 160], [284, 236], [40, 140], [176, 110], [214, 200]];

export function hero({ g = 0, fit, ctx } = {}) {
  const id = `hero${++n}`;
  const svg = `<svg xmlns="${NS}" viewBox="0 0 300 300" preserveAspectRatio="${fit === 'center' ? 'xMidYMid meet' : 'xMaxYMid meet'}" role="img" aria-label="${LABEL}">
  <defs>
    <radialGradient id="${id}b" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#0b1a3a" stop-opacity="0"/><stop offset=".62" stop-color="#1d3f9a" stop-opacity=".25"/><stop offset=".86" stop-color="#5b8cff" stop-opacity=".75"/><stop offset="1" stop-color="#9cc0ff" stop-opacity="0"/></radialGradient>
    <radialGradient id="${id}s" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffb36b" stop-opacity="0"/><stop offset=".7" stop-color="#ff8a3d" stop-opacity=".22"/><stop offset="1" stop-color="#ff8a3d" stop-opacity="0"/></radialGradient>
    <radialGradient id="${id}y" cx="50%" cy="72%" r="65%"><stop offset="0" stop-color="#fff6d8"/><stop offset=".35" stop-color="#ffd166"/><stop offset=".7" stop-color="#ff8a3d" stop-opacity=".85"/><stop offset="1" stop-color="#c2410c" stop-opacity="0"/></radialGradient>
  </defs>
  <g fill="#cfd8ff" opacity=".55">${STARS.map(([x, y], k) => `<circle cx="${x}" cy="${y}" r="${k % 3 ? 0.8 : 1.3}"/>`).join('')}</g>
  <g class="g0"><circle cx="150" cy="150" r="78" fill="url(#${id}b)"/><circle cx="150" cy="150" r="54" fill="url(#${id}s)"/><circle cx="150" cy="150" r="4" fill="#3a3a3a"/></g>
  <g class="g1"><path d="M150 40 C120 95 104 150 112 190 C118 222 134 240 150 240 C166 240 182 222 188 190 C196 150 180 95 150 40 Z" fill="url(#${id}y)"/><path d="M150 205 C140 210 136 226 150 236 C164 226 160 210 150 205 Z" fill="#3b6cff" opacity=".7"/><circle cx="150" cy="222" r="4" fill="#3a3a3a"/></g>
</svg>`;
  const wrap = document.createElement('div');
  wrap.className = 'hero-gl gl-static';
  wrap.innerHTML = svg;
  const note = document.createElement('p'); note.className = 'illus-note'; note.textContent = 'Illustration, not data';
  wrap.append(note);
  const s = wrap.firstElementChild;
  const setG = v => { s.querySelector('.g0').style.display = v >= 0.5 ? 'none' : ''; s.querySelector('.g1').style.display = v >= 0.5 ? '' : 'none'; };
  setG(g);
  void ctx;   // the static stub starts nothing, so there is nothing to register on ctx.onMount / ctx.onLeave
  return { el: wrap, ok: false, setG: (v) => setG(v) };
}

// Page-header illustrations. PHASE 1 STUB: static SVG drawings (no WebGL). Phase 6 (P6-B) replaces this module with
// the WebGL 2 shaders from main; the interface stays: banner('earth'|'smoke', ctx) → element.
//  'earth': the planet's limb seen from orbit.  'smoke': cabin smoke drifting through a detector's light beam.
// Illustrations, not data: the drawing is decorative (aria-hidden) and carries a visible "Illustration, not data" label.
let n = 0;
const NS = 'http://www.w3.org/2000/svg';
const STARS = [[60, 30], [140, 80], [250, 20], [330, 110], [420, 40], [520, 90], [610, 25], [700, 70], [790, 35], [880, 95], [960, 30], [1050, 75], [1130, 20], [1180, 120]];

function earth(id) {
  return `<defs>
    <radialGradient id="${id}e" cx="35%" cy="160%" r="150%"><stop offset=".55" stop-color="#1b4a7a"/><stop offset=".64" stop-color="#2d6aa3"/><stop offset=".66" stop-color="#8fc3ff" stop-opacity=".9"/><stop offset=".7" stop-color="#5b8cff" stop-opacity="0"/></radialGradient>
  </defs>
  <g fill="#dfe6ff" opacity=".6">${STARS.map(([x, y], k) => `<circle cx="${x}" cy="${y}" r="${k % 3 ? 0.9 : 1.5}"/>`).join('')}</g>
  <ellipse cx="420" cy="980" rx="1100" ry="760" fill="url(#${id}e)"/>
  <ellipse cx="420" cy="980" rx="1100" ry="760" fill="none" stroke="#9cc4f6" stroke-opacity=".5" stroke-width="3"/>`;
}
function smoke() {
  const puff = (d, o) => `<path d="${d}" fill="none" stroke="#c9d0dd" stroke-opacity="${o}" stroke-width="34" stroke-linecap="round"/>`;
  return `<rect x="0" y="150" width="1200" height="44" fill="#7aa2ff" opacity=".08"/>
  ${puff('M80 230 C240 170 360 260 520 200 S820 150 980 190', '.10')}
  ${puff('M60 260 C220 230 380 300 560 250 S860 210 1040 240', '.07')}
  ${puff('M120 200 C260 150 420 210 600 170 S900 120 1100 150', '.06')}
  <circle cx="90" cy="250" r="16" fill="#ff8a3d" opacity=".5"/><circle cx="90" cy="250" r="7" fill="#3b6cff" opacity=".8"/>
  <circle cx="1120" cy="172" r="6" fill="#ff4d4d"/>`;
}

export function banner(kind = 'earth', ctx) {
  const id = `ban${++n}`;
  const wrap = document.createElement('div');
  wrap.className = `banner-gl gl-static ${kind === 'smoke' ? 'smoke' : 'earth'}`;
  wrap.innerHTML = `<svg xmlns="${NS}" viewBox="0 0 1200 340" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">${kind === 'smoke' ? smoke() : earth(id)}</svg>`;
  const note = document.createElement('p'); note.className = 'illus-note'; note.textContent = 'Illustration, not data';
  wrap.append(note);
  void ctx;   // static stub: nothing to start or stop
  return wrap;
}

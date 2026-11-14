// Plain-language glossary. After a page renders, the first use of each term in every card becomes a button;
// hover, focus or tap shows a one-line definition. Turn it off from the "Read your way" panel.
// Definitions are written by the team in our own words; they describe, they do not add numbers.
export const TERMS = {
  'microgravity': 'Near-weightlessness, as on a space station in orbit. Hot gas no longer rises, so flames and smoke behave differently.',
  'buoyancy': 'The upward push gravity gives to hot, light gas. It is what makes a flame point up on Earth.',
  'soot': 'Tiny specks of carbon made in a flame. Hot soot glows yellow; cooled soot is smoke.',
  'PMMA': 'Clear acrylic plastic (Plexiglas). NASA burns it as a standard test material.',
  'AUC': 'A score for yes/no predictions: 0.5 is a coin flip, 1.0 is perfect ranking.',
  'R²': 'How much of the spread in the data a model explains: 0 is none, 1 is all of it.',
  'obscuration': 'How much smoke dims a beam of light shining through it. One way detectors sense smoke.',
  'cool flame': 'A faint, much cooler flame that can keep using up fuel after the visible flame has gone out. It is almost invisible.',
  'extinction': 'Here: the flame going out.',
  'Saffire': 'NASA experiments that burned large samples inside empty Cygnus cargo ships after they left the space station.',
  'FLEX': 'NASA\'s Flame Extinguishment Experiment: burning single fuel droplets on the space station.',
  'BASS-II': 'NASA\'s Burning and Suppression of Solids experiment: small solid samples burned on the space station.',
  'SAME': 'NASA\'s Smoke Aerosol Measurement Experiment: it measured the size of smoke particles in orbit.',
  'PSI': 'NASA\'s Physical Sciences Informatics archive, where the experiment data is published for anyone.',
  'd-squared law': 'A textbook rule: a burning droplet\'s diameter, squared, shrinks at a steady rate.',
  'telemetry': 'Sensor readings sent back from a spacecraft.',
  'kPa': 'Kilopascal, a unit of pressure. Air at sea level is about 101 kPa.',
  'latency': 'Delay. Here: the time from ignition until a sensor would raise an alarm.',
  'held-out': 'Data kept aside while a model learns, then used to test it, so the score is honest.',
  'bootstrap': 'Re-running a calculation on many reshuffled copies of the data to see how much the answer could wiggle.',
  'logistic regression': 'A simple model that turns a few inputs into a yes/no probability.',
  'advection': 'Being carried along by moving air.',
  'diffusion flame': 'A flame where fuel and oxygen start apart and mix as they burn, like a candle.',
  'baseline': 'The simple rule or textbook formula a model has to beat to be worth using.',
};
const KEYS = Object.keys(TERMS).sort((a, b) => b.length - a.length);
const RX = new RegExp(`(^|[^\\w-])(${KEYS.map(k => k.replace(/[.*+?^${}()|[\]\\²]/g, m => m === '²' ? '²' : '\\' + m)).join('|')})(?![\\w-])`, 'i');
const SKIP = 'a,button,code,pre,svg,script,style,input,select,textarea,label,.term,.badge,.lvl,th,h1,.hero-gl,.stat,.gloss';
const pop = Object.assign(document.createElement('div'), { className: 'gloss', id: 'gloss', hidden: true });
pop.setAttribute('role', 'tooltip'); document.body.append(pop);
let owner = null;
const show = el => {
  if (document.documentElement.dataset.terms === 'off') return;
  const k = KEYS.find(k => k.toLowerCase() === el.dataset.term.toLowerCase());
  pop.replaceChildren(Object.assign(document.createElement('b'), { textContent: k }), document.createTextNode(TERMS[k]));
  pop.hidden = false; owner = el; el.setAttribute('aria-describedby', 'gloss');
  const r = el.getBoundingClientRect(), w = pop.offsetWidth, hgt = pop.offsetHeight;
  pop.style.left = Math.max(8, Math.min(r.left, innerWidth - w - 8)) + 'px';
  pop.style.top = (r.bottom + hgt + 12 < innerHeight ? r.bottom + 8 : r.top - hgt - 8) + 'px';
};
const hide = () => { pop.hidden = true; owner?.removeAttribute('aria-describedby'); owner = null; };
addEventListener('keydown', e => { if (e.key === 'Escape') hide(); });
addEventListener('scroll', hide, { passive: true });
document.addEventListener('click', e => { const t = e.target.closest?.('.term'); if (t) show(t); else if (!e.target.closest?.('.gloss')) hide(); });

/** Wrap the first use of each term in every card (and in the page lead) of root. */
export function annotate(root) {
  const scopes = [...root.querySelectorAll('.card, .lead, .hero-lead, .qn')];
  for (const scope of scopes) {
    if (scope.parentElement?.closest('.card') && scope.classList.contains('card')) continue;
    const used = new Set();
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, { acceptNode: n => n.parentElement.closest(SKIP) || !n.nodeValue.trim() ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
    const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
    for (let node of nodes) {
      let m;
      while (node && (m = RX.exec(node.nodeValue))) {
        const word = m[2], key = KEYS.find(k => k.toLowerCase() === word.toLowerCase());
        const at = m.index + m[1].length;
        if (used.has(key)) { // skip this occurrence, keep scanning after it
          const rest = node.splitText(at + word.length); node = rest; continue;
        }
        used.add(key);
        const mid = node.splitText(at), rest = mid.splitText(word.length);
        const b = document.createElement('button'); b.type = 'button'; b.className = 'term'; b.dataset.term = key; b.textContent = mid.nodeValue;
        b.addEventListener('mouseenter', () => show(b)); b.addEventListener('mouseleave', hide);
        b.addEventListener('focus', () => show(b)); b.addEventListener('blur', hide);
        mid.replaceWith(b); node = rest;
      }
    }
  }
}

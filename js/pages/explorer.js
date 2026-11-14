import { h, load, page, card, badge } from '../lib.js';
export default async function (root) {
  const [inv, rw] = await Promise.all([load('investigations'), load('ranking_weights')]);
  const items = inv.items || [];
  const state = { q: '', focus: 'all', mission: 'station', pick: [] };
  const score = it => it.tags.reduce((a, t) => a + ((rw.weights?.[state.mission] || {})[t] || 0), 0);
  const out = h('div');
  const draw = () => {
    const w = rw.weights?.[state.mission] || {};
    const rows = items.filter(i => (state.focus === 'all' || i.focus === state.focus) && (i.name + i.measured + i.fuel + i.facility).toLowerCase().includes(state.q.toLowerCase()))
      .map(i => ({ ...i, score: score(i) })).sort((a, b) => b.score - a.score);
    const max = Math.max(1, ...rows.map(r => r.score));
    const tbl = h('table', {}, h('thead', {}, h('tr', {}, ...['Relevance', 'Investigation', 'Focus', 'Fuel', 'What it measured', 'Rows', 'PSI'].map(t => h('th', {}, t)))),
      h('tbody', {}, ...rows.map(r => h('tr', { class: state.pick.includes(r.id) ? 'sel' : '', style: 'cursor:pointer', onclick: () => { state.pick = state.pick.includes(r.id) ? state.pick.filter(x => x !== r.id) : [...state.pick, r.id].slice(-2); draw(); } },
        h('td', {}, h('div', { style: `height:6px;border-radius:3px;background:var(--s1);width:${Math.max(4, r.score / max * 70)}px;margin:6px 0 2px` }), h('small', {}, String(r.score))),
        h('td', {}, h('b', {}, r.name), h('br'), h('small', {}, r.facility)), h('td', {}, r.focus), h('td', {}, r.fuel), h('td', {}, r.measured),
        h('td', { class: 'num' }, r.rows || 'unverified'), h('td', {}, r.psi ? h('a', { href: `https://psi.nasa.gov/physci/repo/data/investigations/${r.psi}`, target: '_blank', rel: 'noopener', onclick: e => e.stopPropagation() }, r.psi) : 'unverified')))));
    const picked = state.pick.map(id => items.find(i => i.id === id));
    const cmp = picked.length === 2 ? card('Side by side', null, 'What the two share and where they differ',
      h('div', { class: 'scroll' }, h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, ''), ...picked.map(p => h('th', {}, p.name)))),
        h('tbody', {}, ...[['Focus', 'focus'], ['Fuel', 'fuel'], ['Facility', 'facility'], ['Measured', 'measured'], ['Rows', 'rows']].map(([l, k]) => h('tr', {}, h('td', {}, l), ...picked.map(p => h('td', {}, p[k] || 'unverified')))),
          h('tr', {}, h('td', {}, 'Shared topics'), h('td', { colspan: 2 }, ...(picked[0].tags.filter(t => picked[1].tags.includes(t)).map(t => h('span', { class: 'tag' }, t)))))))))
      : h('p', { style: 'margin-top:10px' }, h('small', {}, `Click two rows to compare them. ${picked.length} selected.`));
    out.replaceChildren(
      h('div', { class: 'scroll' }, tbl), cmp,
      h('p', { style: 'margin-top:14px' }, h('small', {}, `How relevance is scored for "${rw.missions?.[state.mission]}": each investigation gets the sum of these topic weights: ` + Object.entries(w).map(([k, v]) => `${k} ${v}`).join(', ') + '. Weights are set by the team and are not a NASA rating.')));
  };
  root.append(page('NASA combustion investigations', 'Every experiment we draw on, ranked by how much it tells you about fire safety for the mission you pick.',
    card('Find and rank', inv.status, inv.note,
      h('div', { class: 'row' },
        h('input', { type: 'search', placeholder: 'Search fuels, sensors, facilities', 'aria-label': 'Search investigations', oninput: e => { state.q = e.target.value; draw(); } }),
        h('label', {}, 'Mission ', h('select', { onchange: e => { state.mission = e.target.value; draw(); } }, ...Object.entries(rw.missions || {}).map(([k, v]) => h('option', { value: k }, v)))),
        ...['all', 'flammability', 'detection', 'suppression'].map(f => h('button', { class: 'chip', 'aria-pressed': f === 'all', onclick: e => { state.focus = f; e.target.parentNode.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', c === e.target)); draw(); } }, f === 'all' ? 'All' : f[0].toUpperCase() + f.slice(1)))),
      out)));
  draw();
}

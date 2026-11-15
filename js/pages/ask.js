// Ask the evidence: every answer is pre-written from a data file (scripts/build_assistant.py). Typed questions are
// matched to an answer by keywords; below the threshold the assistant refuses. The scorecard runs the fixed test set
// through this same matcher, so the score shown is the score of what the visitor uses.
import { h, load, page, card } from '../lib.js';
import { askAI, retrieve } from '../llm.js';

const STOP = new Set('a an the is are was were do does did of in on at to for and or what which how why who when where can will would should i we you it this that be by with from about any there their our your me my'.split(' '));
const words = s => s.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter(w => w && !STOP.has(w));
const MIN_SCORE = 2;   // fewer matching keywords than this = no evidence

export function match(q, items) {
  const qs = new Set(words(q)); let best = null, bestScore = 0;
  // stated rule: a question that names a refusal topic (Moon, Mars, safety...) is refused, whatever else it matches
  const hard = items.filter(it => it.kind === 'refusal').find(it => (it.hard || []).some(w => qs.has(w)));
  if (hard) return { item: hard, score: Infinity };
  for (const it of items) {
    const keys = new Set([...(it.keywords || []), ...words(it.q)]);
    let s = 0; for (const w of qs) if (keys.has(w)) s += (it.keywords || []).includes(w) ? 1 : 0.5;
    if (s > bestScore) { bestScore = s; best = it; }
  }
  return bestScore >= MIN_SCORE ? { item: best, score: bestScore } : { item: null, score: bestScore };
}

export default async function (root) {
  const [c, gold, kb, cfg] = await Promise.all([load('assistant_cache'), load('assistant_gold'), load('kb'), load('assistant_config')]);
  const endpoint = cfg && cfg.status !== 'missing' ? cfg.endpoint : null;
  const items = c.items || [];
  const out = h('div', { class: 'answer' }, h('p', { class: 'muted' }, 'Pick a question, or type your own.'));
  const show = (it, asked) => {
    if (!it) { out.replaceChildren(h('span', { class: 'badge missing' }, 'No NASA evidence'), h('p', { class: 'ans', style: 'margin-top:10px' }, `Nothing in our library answers "${asked}". The assistant does not guess.`)); return; }
    out.replaceChildren(it.kind === 'refusal' ? h('span', { class: 'badge missing' }, 'No evidence, so no answer') : h('span', { class: 'badge real' }, 'Answered from sources'),
      asked ? h('p', { style: 'margin:8px 0 0' }, h('small', {}, `Matched to: ${it.q}`)) : null,
      h('p', { class: 'ans', style: 'margin-top:10px' }, it.a),
      it.trace ? h('p', {}, h('small', {}, 'Numbers from: ', h('code', {}, it.trace))) : null,
      h('div', { class: 'src' }, 'Sources: ', ...it.sources.flatMap((s, i) => [i ? '; ' : '', h('a', { href: s.url, target: s.url.startsWith('#') ? null : '_blank', rel: 'noopener' }, s.label)])));
  };
  const input = h('input', { type: 'search', placeholder: 'Ask about fire in orbit, e.g. "where should the smoke detector go?"', style: 'flex:1', 'aria-label': 'Ask a question' });
  const aiOut = h('div', { class: 'ai-out', 'aria-live': 'polite' });
  const aiShow = async q => {
    if (!endpoint || kb.status === 'missing') { aiOut.replaceChildren(); return; }
    const m = match(q, items); if (m.item && m.item.kind === 'refusal') { aiOut.replaceChildren(); return; }   // refusal topics never go to the AI
    aiOut.replaceChildren(h('p', { class: 'muted' }, 'Asking the AI, using only the passages below…'));
    try {
      const r = await askAI(endpoint, q, kb);
      if (r.refused) { aiOut.replaceChildren(h('p', {}, 'No NASA evidence in our library answers this.')); return; }
      const src = h('ol', { class: 'ai-src' }, ...r.passages.map(p => h('li', {}, h('a', { href: p.url || '#', target: (p.url || '').startsWith('#') ? null : '_blank', rel: 'noopener' }, p.title), h('small', {}, ` · ${p.source} · ${p.file}`))));
      aiOut.replaceChildren(h('div', { class: 'ai-head' }, h('span', { class: `badge ${r.bad.length ? 'missing' : 'model'}` }, r.bad.length ? 'Held back' : 'AI answer, numbers checked'), h('small', {}, ` ${r.model || ''}`)),
        r.bad.length ? h('p', {}, `The AI answer used a number not found in our sources (${r.bad.join(', ')}), so it is not shown. The saved answer above is the one to trust.`) : h('p', { class: 'ans' }, r.answer),
        h('p', {}, h('small', {}, 'Passages the AI was allowed to use ([P1] is the first):')), src);
    } catch (e) { aiOut.replaceChildren(h('p', { class: 'muted' }, `${e.message}. The saved answer above still works.`)); }
  };
  const ask = () => { const q = input.value.trim(); if (!q) return; document.querySelectorAll('.q').forEach(b => b.setAttribute('aria-pressed', 'false')); show(match(q, items).item, q); aiShow(q); };
  input.addEventListener('keydown', e => { if (e.key === 'Enter') ask(); });
  const list = items.filter(it => it.kind === 'answer').map(it => { const b = h('button', { class: 'q', 'aria-pressed': 'false' }, it.q); b.addEventListener('click', () => { document.querySelectorAll('.q').forEach(x => x.setAttribute('aria-pressed', String(x === b))); show(it); }); return b; });

  // scorecard: the same matcher on the fixed test set
  let score = null;
  if (gold.status !== 'missing') {
    const rows = gold.items.map(g => { const r = match(g.q, items); const got = r.item ? (r.item.kind === 'refusal' ? 'refuse' : r.item.id) : 'refuse'; return { ...g, got, ok: got === g.expect }; });
    const ans = rows.filter(r => r.expect !== 'refuse'), ref = rows.filter(r => r.expect === 'refuse');
    score = card('Assistant scorecard', 'team', `${gold.items.length} fixed questions with known answers, run live through the matcher above. Written before the score was seen; misses stay listed.`,
      h('div', { class: 'grid g3', style: 'margin-bottom:10px' },
        h('div', {}, h('small', {}, 'Right answer'), h('div', { class: 'stat' }, `${ans.filter(r => r.ok).length}/${ans.length}`)),
        h('div', {}, h('small', {}, 'Correct refusals'), h('div', { class: 'stat' }, `${ref.filter(r => r.ok).length}/${ref.length}`)),
        h('div', {}, h('small', {}, 'Overall'), h('div', { class: 'stat' }, `${Math.round(100 * rows.filter(r => r.ok).length / rows.length)}%`))),
      h('div', { class: 'scroll' }, h('table', {}, h('thead', {}, h('tr', {}, ...['Question', 'Expected', 'Got', ''].map(t => h('th', {}, t)))),
        h('tbody', {}, ...rows.map(r => h('tr', {}, h('td', {}, r.q), h('td', {}, h('code', {}, r.expect)), h('td', {}, h('code', {}, r.got)), h('td', {}, h('span', { class: `status ${r.ok ? 'pass' : 'fail'}` }, r.ok ? 'Pass' : 'Miss'))))))));
  }
  root.append(page('Ask the evidence', 'An assistant that answers only from NASA rows, NASA papers and our own model outputs, shows where each number came from, and says so when there is no evidence.',
    h('div', { class: 'grid g2' },
      card('Questions', c.status, `${list.length} answers, each written from a data file. Type a question or pick one.`, h('div', { class: 'row' }, input, h('button', { class: 'chip', onclick: ask }, 'Ask')), ...list),
      card('Answer', null, null, out, aiOut,
        h('p', {}, h('small', {}, endpoint ? 'Typed questions also get an AI answer (Claude Haiku via our Worker), written only from the passages listed under it; any number not found in them blocks the answer.' : 'AI answers are built but switched off: they turn on when the team deploys the Worker in worker/README.md. Until then every answer is a saved one.')))),
    score ? h('div', { style: 'margin-top:14px' }, score) : null,
    h('div', { style: 'margin-top:14px' }, card('How the assistant is kept honest', null, null, h('ul', { style: 'margin:0;padding-left:18px;color:var(--ink2)' },
      ...['No language model writes answers at run time. Each answer is generated from the data files by scripts/build_assistant.py, so every number traces to a file and field.',
        'A typed question is matched by keywords. If too few match, it replies "No NASA evidence" instead of guessing.',
        'Questions about Moon or Mars gravity, about safety, or about our bench working in space get a refusal on purpose.',
        'The scorecard above runs the fixed test set through the same matcher every time the page loads.'].map(t => h('li', { style: 'margin-bottom:6px' }, t)))))));
}

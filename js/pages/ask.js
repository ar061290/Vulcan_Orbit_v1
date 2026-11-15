// Ask the evidence (#/ask). Every saved answer is pre-written from a data file (scripts/build_assistant.py). Typed
// questions are matched to an answer by keywords (js/ask_match.js, verbatim from main); below the threshold the
// assistant refuses. The scorecard runs the fixed test set through this same matcher, so the score shown is the score
// of what the visitor uses. Ion-wind text is removed at display time only (js/overlays.js, Q4); the cache is unchanged
// and all of its items stay in the matcher, so the score is the file's score.
// The optional live mode (js/llm.js, verbatim from main) is off while data/assistant_config.json has endpoint null.
import { h, add, load, page, card, empty, stat, table, announce, isMissing } from '../lib.js';
import { askAI } from '../llm.js';
import { match } from '../ask_match.js';
import { askAnswer, hideGoldRow, kbPassage } from '../overlays.js';

const CACHE_SHAPE = `{"status": "reported", "items": [{"id": "…", "kind": "answer" | "refusal", "q": "…", "a": "…",
  "keywords": ["…"], "hard": ["…"], "trace": "data/<file>.json <field>", "sources": [{"label": "…", "url": "…"}]}]}`;
const GOLD_SHAPE = `{"status": "team", "items": [{"q": "…", "expect": "<answer id> | refuse"}]}`;

// verbatim from main's footnote and "kept honest" list
const AI_ON = 'Typed questions also get an AI answer (Claude Haiku via our Worker), written only from the passages listed under it; any number not found in them blocks the answer.';
const AI_OFF = 'AI answers are built but switched off: they turn on when the team deploys the Worker in worker/README.md. Until then every answer is a saved one.';
const HONEST_1_OFF = 'No language model writes answers at run time. Each answer is generated from the data files by scripts/build_assistant.py, so every number traces to a file and field.';
const HONEST_1_ON = 'No language model writes the saved answers. Each one is generated from the data files by scripts/build_assistant.py, so every number traces to a file and field. ' + AI_ON;

const LINE_1 = 'Ask a question in plain words. Answers come only from this site\'s data files, with sources.';
const LINE_2 = 'It refuses questions the data cannot answer, such as Moon or Mars predictions or whether something is "safe".';

export async function short() {
  const c = await load('assistant_cache');
  return [isMissing(c) ? 'The saved answers are not available yet (data/assistant_cache.json missing).' : LINE_1, LINE_2];
}

const clear = el => { el.replaceChildren(); return el; };
const stamp = (cls, status, text) => h('span', { class: `badge ${cls}`, 'data-status': status }, text);
const link = (url, label) => {
  const u = String(url || '#'), ext = !u.startsWith('#');
  return h('a', { href: u, target: ext ? '_blank' : null, rel: ext ? 'noopener' : null }, label, ext ? h('span', { class: 'sr' }, ' (opens in a new tab)') : null);
};

export default async function render(root, ctx = {}) {
  const [c, gold, kb, cfg] = await Promise.all([load('assistant_cache'), load('assistant_gold'), load('kb'), load('assistant_config')]);
  const endpoint = !isMissing(cfg) && typeof cfg.endpoint === 'string' && cfg.endpoint.trim() ? cfg.endpoint.trim() : null;
  const haveCache = !isMissing(c) && Array.isArray(c.items);
  const items = haveCache ? c.items : [];
  let alive = true, seq = 0;
  ctx.onLeave?.(() => { alive = false; });
  const say = msg => { if (!ctx.detached && alive) announce(msg); };

  // ---------- the answer panel ----------
  const out = h('div', { class: 'answer' }, h('p', { class: 'muted' }, 'Pick a question, or type your own.'));
  const show = (it, asked) => {
    if (!it) {
      const txt = `Nothing in our library answers "${asked}". The assistant does not guess.`;
      out.replaceChildren(stamp('missing', 'missing', 'No NASA evidence'), h('p', { class: 'ans' }, txt));
      say(`No NASA evidence. ${txt}`);
      return;
    }
    const { a, showMatched } = askAnswer(it);
    const refusal = it.kind === 'refusal';
    const label = refusal ? 'No evidence, so no answer' : 'Answered from sources';
    const matched = asked && showMatched ? `Matched to: ${it.q}` : null;
    const sources = Array.isArray(it.sources) ? it.sources : [];
    // replaceChildren would print a null kid as "null"; add() drops it (REBUILD_PLAN §0 rule 5)
    add(clear(out),
      refusal ? stamp('missing', 'missing', label) : stamp('real', 'reported', label),
      matched ? h('p', { class: 'matched' }, h('small', {}, matched)) : null,
      h('p', { class: 'ans' }, a),
      it.trace ? h('p', {}, h('small', {}, 'Numbers from: ', h('code', {}, it.trace))) : null,
      sources.length ? h('div', { class: 'src' }, 'Sources: ', ...sources.flatMap((s, i) => [i ? '; ' : '', link(s.url, s.label)])) : null);
    say(`${label}. ${matched ? matched + '. ' : ''}${a}`);
  };

  // ---------- optional live AI answer (typed questions only; refusal topics never go to the AI) ----------
  const aiOut = h('div', { class: 'ai-out' });
  const aiShow = async (q, my) => {
    if (!endpoint || isMissing(kb) || !Array.isArray(kb.passages)) { aiOut.replaceChildren(); return; }
    const m = match(q, items); if (m.item && m.item.kind === 'refusal') { aiOut.replaceChildren(); return; }
    aiOut.replaceChildren(h('p', { class: 'muted' }, 'Asking the AI, using only the passages below…'));
    const stale = () => !alive || my !== seq;
    try {
      const r = await askAI(endpoint, q, { ...kb, passages: kb.passages.map(kbPassage) });
      if (stale()) return;
      if (r.refused) { aiOut.replaceChildren(h('p', {}, 'No NASA evidence in our library answers this.')); say('AI answer: No NASA evidence in our library answers this.'); return; }
      const src = h('ol', { class: 'ai-src' }, ...r.passages.map(p => h('li', {}, link(p.url, p.title), h('small', {}, ` · ${p.source} · ${p.file}`))));
      const held = r.bad.length > 0;
      const head = held ? 'Held back' : 'AI answer, numbers checked';
      const body = held ? `The AI answer used a number not found in our sources (${r.bad.join(', ')}), so it is not shown. The saved answer above is the one to trust.` : r.answer;
      aiOut.replaceChildren(h('div', { class: 'ai-head' }, held ? stamp('missing', 'missing', head) : stamp('real', 'model', head), h('small', {}, ` ${r.model || ''}`)),
        h('p', { class: held ? null : 'ans' }, body),
        h('p', {}, h('small', {}, 'Passages the AI was allowed to use ([P1] is the first):')), src);
      say(`${head}. ${body}`);
    } catch (e) {
      if (stale()) return;
      aiOut.replaceChildren(h('p', { class: 'muted' }, `${e.message}. The saved answer above still works.`));
    }
  };

  // ---------- questions: search box, Ask button, one button per saved answer ----------
  const input = h('input', { type: 'search', id: 'ask-q', placeholder: 'Ask about fire in orbit, e.g. "where should the smoke detector go?"', autocomplete: 'off' });
  const answers = items.filter(it => it.kind === 'answer');
  const list = answers.map(it => h('button', { type: 'button', class: 'q', 'aria-pressed': 'false' }, it.q));
  const press = b => list.forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  // v3 layout: on one-column screens the answer sits below the list, so bring it into view once it is filled
  const reveal = () => {
    if (ctx.detached || typeof matchMedia !== 'function' || !matchMedia('(max-width: 1279px)').matches) return;
    const r = out.getBoundingClientRect(); if (r.top < innerHeight - 80 && r.top > 0) return;
    out.closest('.card')?.scrollIntoView({ behavior: document.documentElement.dataset.motion === 'calm' ? 'auto' : 'smooth', block: 'start' });
  };
  list.forEach((b, i) => b.addEventListener('click', () => { seq++; press(b); aiOut.replaceChildren(); show(answers[i]); reveal(); }));
  const ask = () => { const q = input.value.trim(); if (!q) return; const my = ++seq; press(null); show(match(q, items).item, q); aiShow(q, my); };
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); ask(); } });

  const questions = haveCache
    ? card('Questions', c.status, `${list.length} answers, each written from a data file. Type a question or pick one.`,
        h('div', { class: 'ask-box' }, h('label', { for: 'ask-q' }, 'Type a question'),
          h('div', { class: 'row ask-row' }, input, h('button', { type: 'button', class: 'btn primary ask-go', onclick: ask }, 'Ask'))),
        h('p', { class: 'qlist-h', 'aria-hidden': 'true' }, 'Or pick a saved question'),
        h('div', { class: 'qlist', role: 'group', 'aria-label': 'Saved questions' }, list))
    : card('Questions', 'missing', null, empty('No saved answers yet', 'assistant_cache', 'The questions and their pre-written answers come from this file (scripts/build_assistant.py).', CACHE_SHAPE));
  const answer = haveCache
    ? card('Answer', c.status, null, out, aiOut, h('p', {}, h('small', {}, endpoint ? AI_ON : AI_OFF)))
    : card('Answer', 'missing', null, h('p', { class: 'muted' }, 'Answers appear here once data/assistant_cache.json is in place.'));

  // ---------- scorecard: the same matcher on the fixed test set ----------
  let score;
  if (isMissing(gold) || !Array.isArray(gold.items)) {
    score = card('Assistant scorecard', 'missing', null, empty('No test set yet', 'assistant_gold', 'The fixed questions with known answers that the matcher is scored on.', GOLD_SHAPE));
  } else if (!haveCache) {
    score = card('Assistant scorecard', 'missing', null, empty('No saved answers to score', 'assistant_cache', 'The test set is here, but the answers it is scored against are not.', CACHE_SHAPE));
  } else {
    const rows = gold.items.map(g => { const r = match(g.q, items); const got = r.item ? (r.item.kind === 'refusal' ? 'refuse' : r.item.id) : 'refuse'; return { ...g, got, ok: got === g.expect }; });
    const ans = rows.filter(r => r.expect !== 'refuse'), ref = rows.filter(r => r.expect === 'refuse');
    const shown = rows.filter(r => !hideGoldRow(r)), hidden = rows.filter(hideGoldRow);
    const hk = hidden.length, hp = hidden.filter(r => r.ok).length;
    score = card('Assistant scorecard', gold.status, `${gold.items.length} fixed questions with known answers, run live through the matcher above. Written before the score was seen; misses stay listed.`,
      h('div', { class: 'grid g3 ask-stats' },
        stat('Right answer', `${ans.filter(r => r.ok).length}/${ans.length}`),
        stat('Correct refusals', `${ref.filter(r => r.ok).length}/${ref.length}`),
        stat('Overall', `${Math.round(100 * rows.filter(r => r.ok).length / rows.length)}%`)),
      table(['Question', 'Expected', 'Got', ''], shown.map(r => [r.q, h('code', {}, r.expect), h('code', {}, r.got), h('span', { class: `status ${r.ok ? 'pass' : 'fail'}` }, r.ok ? 'Pass' : 'Miss')])),
      hk ? h('p', { class: 'ask-foot' }, `${hk} question${hk > 1 ? 's' : ''} from the test set ${hk > 1 ? 'are' : 'is'} counted in the score above but not listed, because ${hk > 1 ? 'they ask' : 'it asks'} about a bench response the team dropped in plan v2. ${hp} of ${hk} passed.`) : null);
  }

  const honest = card('How the assistant is kept honest', 'team', null, h('ul', { class: 'honest' },
    ...[endpoint ? HONEST_1_ON : HONEST_1_OFF,
      'A typed question is matched by keywords. If too few match, it replies "No NASA evidence" instead of guessing.',
      'Questions about Moon or Mars gravity, about safety, or about our bench working in space get a refusal on purpose.',
      'The scorecard above runs the fixed test set through the same matcher every time the page loads.'].map(t => h('li', {}, t))));

  root.append(page('Ask the evidence', 'An assistant that answers only from NASA rows, NASA papers and our own model outputs, shows where each number came from, and says so when there is no evidence.',
    h('div', { class: 'grid g2 ask-grid' }, questions, answer),
    score,
    honest));
}

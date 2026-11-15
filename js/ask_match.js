// The Ask matcher, copied verbatim from main's js/pages/ask.js (inventory pages_respond_flame_ask.md §3).
// Typed questions are matched to a pre-written answer by keywords; below MIN_SCORE the assistant refuses.
// The scorecard runs the fixed test set through this same function, so its score is the score of what visitors use.
// Do not merge STOP or words() with llm.js: that file has its own stopword list and tokeniser on purpose.

export const STOP = new Set('a an the is are was were do does did of in on at to for and or what which how why who when where can will would should i we you it this that be by with from about any there their our your me my'.split(' '));
export const words = s => s.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter(w => w && !STOP.has(w));
export const MIN_SCORE = 2;   // fewer matching keywords than this = no evidence

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

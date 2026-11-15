// AI answers for the Ask page. Retrieval runs here (BM25 over data/kb.json); the Worker (worker/assistant.js) only
// writes the answer from the passages we send. Before showing it, every number in the answer must appear in those
// passages; if one does not, the answer is held back and the saved answer is shown instead.
const STOP = new Set('a an the is are was were do does did of in on at to for and or what which how why who when where can will would should i we you it this that be by with from about any there their its as if than then so not no'.split(' '));
const tok = s => s.toLowerCase().replace(/[^a-z0-9.%\s-]/g, ' ').split(/\s+/).filter(w => w && !STOP.has(w));
export function retrieve(q, passages, k = 6) {
  const docs = passages.map(p => tok(`${p.title} ${p.title} ${p.text}`)), N = docs.length, avg = docs.reduce((a, d) => a + d.length, 0) / N;
  const df = new Map(); docs.forEach(d => new Set(d).forEach(w => df.set(w, (df.get(w) || 0) + 1)));
  const qs = [...new Set(tok(q))];
  return docs.map((d, i) => {
    const tf = new Map(); d.forEach(w => tf.set(w, (tf.get(w) || 0) + 1));
    let s = 0; for (const w of qs) { const f = tf.get(w); if (!f) continue; const idf = Math.log(1 + (N - df.get(w) + 0.5) / (df.get(w) + 0.5)); s += idf * f * 2.2 / (f + 1.2 * (0.25 + 0.75 * d.length / avg)); }
    return [s, i];
  }).filter(x => x[0] > 0).sort((a, b) => b[0] - a[0]).slice(0, k).map(([s, i]) => ({ ...passages[i], score: s }));
}
const nums = s => (s.match(/-?\d+(?:[.,]\d+)?/g) || []).map(x => x.replace(',', '.'));
/** Numbers in the answer that do not appear in any passage (citation markers like [P2] are ignored). */
export function unbacked(answer, passages) {
  const text = passages.map(p => `${p.title} ${p.text}`).join(' ').replace(/,/g, '');
  return [...new Set(nums(answer.replace(/\[P\d+\]/g, '')))].filter(n => !text.includes(n));
}
export async function askAI(endpoint, q, kb) {
  const ps = retrieve(q, kb.passages);
  if (!ps.length) return { refused: true, passages: [] };
  const r = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question: q, passages: ps.map(({ title, text, source }) => ({ title, text, source })) }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.answer) throw new Error(j.error || 'AI unavailable');
  return { answer: j.answer, passages: ps, bad: unbacked(j.answer, ps), model: j.model };
}

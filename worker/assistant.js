// Cloudflare Worker: the only place the AI key lives. The site sends a question plus the passages it retrieved from
// data/kb.json; the Worker asks Claude to answer ONLY from those passages and to cite them. No key in the repo or page.
// Deploy: see worker/README.md (wrangler secret put ANTHROPIC_API_KEY). Defaults are deliberately small and cheap.
const MODEL = 'claude-haiku-5-5';
const SYSTEM = `You answer questions for Vulcan Orbit, a student project on fire safety in spacecraft built on NASA microgravity combustion data.
Rules, in order:
1. Use ONLY the numbered passages given. Do not use outside knowledge for facts or numbers.
2. Every number you write must appear in a passage, exactly as written there. Never calculate, convert or round a new number.
3. Cite passages as [P1], [P2] after the sentence that uses them.
4. If the passages do not answer the question, reply exactly: "No NASA evidence in our library answers this."
5. Never predict anything for Moon or Mars gravity; NASA has no fire data there. Never say a material, design or atmosphere is "safe".
6. Plain English, at most 120 words. No headings, no lists unless asked.`;
const ok = (body, origin, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': origin, 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type' } });
const hits = new Map();   // per-instance rate limit (best effort; add a Cloudflare rate-limit rule for a hard cap)
export default {
  async fetch(req, env) {
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
    const origin = req.headers.get('origin') || '';
    const allow = allowed.includes(origin) ? origin : (allowed[0] || 'null');
    if (req.method === 'OPTIONS') return ok({}, allow);
    if (req.method !== 'POST' || !allowed.includes(origin)) return ok({ error: 'not allowed' }, allow, 403);
    const ip = req.headers.get('cf-connecting-ip') || 'x', now = Date.now(), w = (hits.get(ip) || []).filter(t => now - t < 60000);
    if (w.length >= Number(env.PER_MINUTE || 6)) return ok({ error: 'Too many questions; try again in a minute.' }, allow, 429);
    hits.set(ip, [...w, now]);
    let q, passages;
    try { ({ question: q, passages } = await req.json()); } catch { return ok({ error: 'bad request' }, allow, 400); }
    if (typeof q !== 'string' || !q.trim() || q.length > 400 || !Array.isArray(passages) || passages.length > 8) return ok({ error: 'bad request' }, allow, 400);
    const ctx = passages.map((p, i) => `[P${i + 1}] ${String(p.title).slice(0, 200)} (source: ${String(p.source).slice(0, 200)})\n${String(p.text).slice(0, 1800)}`).join('\n\n');
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: env.MODEL || MODEL, max_tokens: 400, temperature: 0, system: SYSTEM, messages: [{ role: 'user', content: `Passages:\n${ctx}\n\nQuestion: ${q}` }] }),
    });
    if (!r.ok) return ok({ error: 'The AI service is unavailable; showing saved answers instead.' }, allow, 502);
    const j = await r.json();
    const answer = (j.content || []).filter(c => c.type === 'text').map(c => c.text).join('').trim();
    return ok({ answer, model: j.model }, allow);
  },
};

import { h, load, page, card } from '../lib.js';
export default async function (root) {
  const c = await load('assistant_cache'), items = c.items || [];
  const out = h('div', {}, h('p', {}, 'Pick a question.'));
  const show = (it, btn) => {
    btn.parentNode.querySelectorAll('.q').forEach(b => b.setAttribute('aria-pressed', b === btn));
    out.replaceChildren(it.kind === 'refusal' ? h('span', { class: 'badge missing' }, 'No evidence, so no answer') : h('span', { class: 'badge real' }, 'Answered from sources'),
      h('p', { class: 'ans', style: 'margin-top:10px' }, it.a),
      h('div', { class: 'src' }, 'Sources: ', ...it.sources.flatMap((s, i) => [i ? '; ' : '', h('a', { href: s.url, target: '_blank', rel: 'noopener' }, s.label)])));
  };
  root.append(page('Ask the evidence', 'An assistant that answers only from NASA rows and reports, shows where each number came from, and says so when there is no evidence.',
    h('div', { class: 'grid g2' },
      card('Questions', c.status, 'Saved answers. Live questions switch on when the proxy is deployed.', ...items.map(it => { const b = h('button', { class: 'q', 'aria-pressed': 'false' }, it.q); b.addEventListener('click', () => show(it, b)); return b; }),
        h('div', { class: 'row', style: 'margin-top:10px' }, h('input', { type: 'search', placeholder: 'Live questions: not connected yet', disabled: true, style: 'flex:1', 'aria-label': 'Ask a question' }))),
      card('Answer', null, null, out)),
    h('div', { style: 'margin-top:14px' }, card('How the assistant is kept honest', null, null, h('ul', { style: 'margin:0;padding-left:18px;color:var(--ink2)' },
      ...['It never does arithmetic. Numbers come from a dataset row or a model output, quoted with the source.', 'If nothing in the library supports an answer, it replies "No NASA evidence".', 'It is scored on a fixed set of questions with known answers. The scorecard appears on the Evidence page.'].map(t => h('li', { style: 'margin-bottom:6px' }, t)))))));
}

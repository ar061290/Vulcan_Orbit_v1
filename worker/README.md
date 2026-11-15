# AI assistant Worker (optional)

The site works without this: the Ask page uses saved answers. With it, typed questions get an AI answer written only
from the site's own passages (`data/kb.json`), with citations, and the page checks that every number in the answer
appears in those passages before showing it.

**Who does this:** an adult on the team, with a Cloudflare account and an Anthropic API key. The key never goes in the repo.

1. `npm install -g wrangler` then `wrangler login`
2. In this folder: `wrangler deploy assistant.js --name vulcan-orbit-assistant --compatibility-date 2026-11-01`
3. `wrangler secret put ANTHROPIC_API_KEY --name vulcan-orbit-assistant` (paste the key when asked)
4. Set allowed sites: `wrangler secret put ALLOWED_ORIGINS --name vulcan-orbit-assistant` → e.g. `https://ar061290.github.io`
5. In the Cloudflare dashboard, add a rate-limiting rule and set a monthly spend limit on the Anthropic key.
6. Put the Worker URL in `data/assistant_config.json` → `"endpoint": "https://vulcan-orbit-assistant.<you>.workers.dev"` and push.

Model: `claude-haiku-5-5` (change with a `MODEL` variable). Each question sends at most 6 passages and asks for at most 400 tokens.

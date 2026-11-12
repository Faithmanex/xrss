# xrss

**Public X/Twitter profiles as RSS, Atom and JSON — no API keys, no login, no rate-limit bill.**

X killed free API reads, Nitter is dead, and public RSS bridges keep getting blocked. xrss takes a different route: it reads the posts X already renders into every public profile page, unpacks them, and serves clean feeds.

```
GET /u/elonmusk        → RSS 2.0
GET /u/elonmusk.atom   → Atom 1.0
GET /u/elonmusk.json   → JSON
GET /health            → status
```

## Why

- **Free.** No X API credits, no developer account, no OAuth.
- **Zero dependencies.** Node built-ins only. Nothing to audit, nothing to break.
- **Self-hosted.** Your feeds, your box, your logs.
- **Tiny surface.** Under 500 lines of readable JavaScript.

## Quick start

```bash
git clone https://github.com/Faithmanex/xrss.git
cd xrss
npm start
# → http://localhost:8787/u/elonmusk
```

Or with Docker:

```bash
docker build -t xrss .
docker run -p 8787:8787 xrss
```

CLI, if you just want a file:

```bash
node src/cli.js elonmusk --atom -o elonmusk.atom
```

## API

| Route | Returns |
| --- | --- |
| `GET /u/:handle` | RSS 2.0 (default) |
| `GET /u/:handle.atom` | Atom 1.0 |
| `GET /u/:handle.json` | JSON with profile + items |
| `GET /health` | status plus cache stats |

Query parameters:

- `?limit=N` — newest N posts (max 50)
- `?refresh=1` — bypass the cache for this request

Example:

```bash
curl -s localhost:8787/u/elonmusk.json | jq '.items[0]'
```

```json
{
  "id": "2120102767624880364",
  "url": "https://x.com/elonmusk/status/2120102767624880364",
  "text": "...",
  "createdAt": "2026-11-10T10:34:24.000Z"
}
```

## Configuration

| Env var | Default | Purpose |
| --- | --- | --- |
| `PORT` | `8787` | Listen port |
| `HOST` | `0.0.0.0` | Bind address |
| `XRSS_QUIET` | unset | Set to `1` to silence request logs |

## Library use

```js
import { getProfile } from 'xrss';
import { toRss } from 'xrss/rss';

const profile = await getProfile('elonmusk');
process.stdout.write(toRss(profile));
```

## What it can and cannot do

Works well:

- Latest ~10 posts from any public profile
- Profile name, bio, avatar, follower counts
- Polling on a schedule (pair it with any RSS reader, n8n, or a cron job)

Not supported, by design:

- Search, hashtags, lists, trends
- History beyond the latest page
- Replies, likes, bookmarks, DMs
- Protected or suspended accounts

Expect roughly one HTTP request per profile per cache window (default 2 minutes). Hammer it and x.com will push back with 429s.

## Legal and etiquette

xrss is unofficial and not affiliated with X Corp. It reads the same public HTML a logged-out browser sees. That is still subject to X's Terms of Service, which restrict automated access — run it for personal, low-volume use, keep caching on, and don't republish other people's content at scale. No warranty; use at your own risk.

## Contributing

Bug reports and pull requests are welcome. Run `npm test` before opening a PR. See CONTRIBUTING.md.

## License

MIT © 2026 EchelNet

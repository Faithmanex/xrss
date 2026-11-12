/**
 * xrss — scrape public X/Twitter profile pages into structured posts.
 *
 * No API keys, no cookies, no authentication. X renders the ten most recent
 * posts into the public profile HTML (inside a nested-escaped JSON payload);
 * we unpack that payload and normalise it.
 */

export const HANDLE_RE = /^[A-Za-z0-9_]{1,15}$/;

export const DEFAULTS = {
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  timeoutMs: 15000,
  accept: 'text/html,application/xhtml+xml',
};

export class XrssError extends Error {
  constructor(code, message, status) {
    super(message);
    this.name = 'XrssError';
    this.code = code;
    this.status = status;
  }
}

/** True when the page HTML looks like a missing/suspended/private account. */
function detectUnavailable(html) {
  return (
    /This account doesn.t exist/i.test(html) ||
    /Account suspended/i.test(html) ||
    /"__typename":"UserUnavailable"/.test(html) ||
    /"reason":"suspended"/.test(html)
  );
}

/**
 * X nests the profile payload inside JS string literals, so quotes arrive
 * escaped up to three levels deep. Peel one level at a time until stable.
 */
export function normalizeEscapes(raw) {
  let doc = raw;
  for (let i = 0; i < 8; i += 1) {
    const next = doc.split('\\"').join('"');
    if (next.length === doc.length) return doc;
    doc = next;
  }
  return doc;
}

/** Extract the author block from a normalised page. */
export function parseProfile(raw) {
  const doc = normalizeEscapes(raw);
  const core = doc.match(
    /"core":\{"(?:created_at_ms":\d+,")?name":"((?:[^"\\]|\\.)*)","screen_name":"([A-Za-z0-9_]+)"/
  );
  const bio = doc.match(/"profile_bio":\{"description":"((?:[^"\\]|\\.)*)"/);
  const avatar = doc.match(/"avatar":\{"image_url":"([^"]+)"/);
  const counts = doc.match(
    /"relationship_counts":\{"followers":(\d+),"following":(\d+)\}/
  );
  return {
    name: core ? core[1] : null,
    handle: core ? core[2] : null,
    bio: bio ? bio[1] : null,
    avatar: avatar ? avatar[1] : null,
    followers: counts ? Number(counts[1]) : null,
    following: counts ? Number(counts[2]) : null,
  };
}

/**
 * Parse the posts embedded in a profile page.
 * @returns {Array<{id:string,text:string,createdAt:string,createdAtMs:number,url:string}>}
 */
export function parseTweets(raw, handle) {
  const doc = normalizeEscapes(raw);
  const re =
    /"created_at_ms":(\d+),"display_text_range":\[\d+,\d+\],"full_text":"((?:[^"\\]|\\.)*)"/g;
  const out = [];
  const seen = new Set();
  let match;

  while ((match = re.exec(doc))) {
    const tail = doc.slice(match.index, match.index + 2500);
    const idMatch =
      tail.match(/"edit_tweet_ids":\["(\d+)"\]/) ||
      tail.match(/"rest_id":"(\d{18,20})"/);
    if (!idMatch) continue;

    const id = idMatch[1];
    if (seen.has(id)) continue;

    const text = decodeText(match[2]);
    if (!text) continue;

    seen.add(id);
    out.push({
      id,
      text,
      createdAtMs: Number(match[1]),
      createdAt: new Date(Number(match[1])).toISOString(),
      url: 'https://x.com/' + (handle || 'i') + '/status/' + id,
    });
  }

  return out.sort((a, b) => b.createdAtMs - a.createdAtMs);
}

function decodeText(value) {
  let text = value;
  try {
    text = JSON.parse('"' + value + '"');
  } catch {
    text = value.replace(/\\n/g, '\n').replace(/\\(["\\/])/g, '$1');
  }
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Fetch and parse a public profile.
 * @param {string} handle
 * @param {{fetchImpl?:Function, userAgent?:string, timeoutMs?:number, includeRetweets?:boolean}} [opts]
 */
export async function getProfile(handle, opts = {}) {
  const clean = String(handle || '').replace(/^@/, '').trim();
  if (!HANDLE_RE.test(clean)) {
    throw new XrssError('bad_handle', 'Invalid X handle: ' + handle, 400);
  }

  const fetchImpl = opts.fetchImpl || globalThis.fetch;
  const timeoutMs = opts.timeoutMs || DEFAULTS.timeoutMs;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res;
  try {
    res = await fetchImpl('https://x.com/' + clean, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'user-agent': opts.userAgent || DEFAULTS.userAgent,
        accept: DEFAULTS.accept,
        'accept-language': 'en-US,en;q=0.9',
      },
    });
  } catch (err) {
    throw new XrssError('upstream_unreachable', 'Could not reach x.com: ' + err.message, 502);
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 404 || (res.status >= 400 && res.status !== 429)) {
    throw new XrssError('not_found', 'Profile not found: @' + clean, 404);
  }
  if (res.status === 429) {
    throw new XrssError('rate_limited', 'x.com rate limited the request', 429);
  }

  const html = await res.text();
  if (detectUnavailable(html)) {
    throw new XrssError('unavailable', 'Account unavailable: @' + clean, 404);
  }

  const tweets = parseTweets(html, clean);
  if (!tweets.length && !/"profile_bio"/.test(normalizeEscapes(html))) {
    throw new XrssError('no_data', 'No profile data found for @' + clean, 502);
  }

  const includeRetweets = opts.includeRetweets === true;
  const posts = includeRetweets
    ? tweets
    : tweets.filter((t) => !t.text.startsWith('RT @'));

  return {
    handle: clean,
    profile: parseProfile(html),
    posts,
    fetchedAt: new Date().toISOString(),
    source: 'https://x.com/' + clean,
  };
}

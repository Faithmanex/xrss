/** Zero-dependency HTTP server exposing profiles as feeds. */

import http from 'node:http';
import { getProfile, XrssError } from './scraper.js';
import { toRss, toAtom, toJson } from './feeds.js';
import { createCache } from './cache.js';

const LANDING = `@@LANDING@@`;

export function createServer(options = {}) {
  const fetcher = options.fetcher || ((handle, opts) => getProfile(handle, opts));
  const cache = createCache(options.cacheTtlMs ?? 120000);
  const requestTimeoutMs = options.requestTimeoutMs ?? 15000;

  const server = http.createServer(async (req, res) => {
    const started = Date.now();
    res.setHeader('access-control-allow-origin', '*');
    res.setHeader('access-control-allow-methods', 'GET, OPTIONS');
    res.setHeader('xrss-version', '0.1.0');

    if (req.method === 'OPTIONS') {
      res.writeHead(204).end();
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      sendJson(res, 405, { error: 'method_not_allowed' });
      return;
    }

    const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));

    if (url.pathname === '/' || url.pathname === '') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(LANDING);
      return;
    }

    if (url.pathname === '/health') {
      sendJson(res, 200, { ok: true, uptimeSeconds: Math.round(process.uptime()), cachedFeeds: cache.size });
      return;
    }

    const route = matchRoute(url.pathname);
    if (!route) {
      sendJson(res, 404, { error: 'not_found', hint: 'Try /u/<handle>' });
      return;
    }

    const limitRaw = Number(url.searchParams.get('limit') || 0);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 50) : 0;
    const refresh = url.searchParams.get('refresh') === '1';

    try {
      const startedFetch = Date.now();
      const result = refresh
        ? await withTimeout(fetcher(route.handle), requestTimeoutMs + 500)
        : await withTimeout(cache.get(route.handle.toLowerCase(), () => fetcher(route.handle)), requestTimeoutMs + 500);

      const posts = limit ? result.posts.slice(0, limit) : result.posts;
      const payload = { ...result, posts };
      const selfUrl = url.origin + url.pathname;

      if (route.format === 'json') {
        sendJson(res, 200, toJson(payload), { 'cache-control': 'public, max-age=60' });
      } else if (route.format === 'atom') {
        res.writeHead(200, {
          'content-type': 'application/atom+xml; charset=utf-8',
          'cache-control': 'public, max-age=60',
        });
        res.end(toAtom(payload, { selfUrl }));
      } else {
        res.writeHead(200, {
          'content-type': 'application/rss+xml; charset=utf-8',
          'cache-control': 'public, max-age=60',
        });
        res.end(toRss(payload, { selfUrl }));
      }

      logRequest(req, 200, Date.now() - started, Date.now() - startedFetch, route);
    } catch (err) {
      const status = err instanceof XrssError ? err.status : 500;
      const code = err instanceof XrssError ? err.code : 'internal_error';
      if (status >= 500) console.error('[xrss]', req.url, err);
      sendJson(res, status, { error: code, message: err.message, handle: route.handle });
      logRequest(req, status, Date.now() - started, 0, route);
    }
  });

  return server;
}

function matchRoute(pathname) {
  const m = pathname.match(/^\/u\/([A-Za-z0-9_]{1,15})(?:\.(rss|atom|json))?\/?$/);
  if (!m) return null;
  return { handle: m[1], format: m[2] || 'rss' };
}

function sendJson(res, status, body, extra = {}) {
  const data = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(data),
    ...extra,
  });
  res.end(data);
}

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new XrssError('timeout', 'Upstream request timed out', 504)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function logRequest(req, status, totalMs, fetchMs, route) {
  if (process.env.XRSS_QUIET === '1') return;
  console.log(
    JSON.stringify({
      t: new Date().toISOString(),
      method: req.method,
      path: req.url,
      handle: route.handle,
      format: route.format,
      status,
      ms: totalMs,
      upstreamMs: fetchMs,
    })
  );
}

if (import.meta.url === 'file://' + process.argv[1]) {
  const port = Number(process.env.PORT || 8787);
  const host = process.env.HOST || '0.0.0.0';
  createServer().listen(port, host, () => {
    console.log('[xrss] listening on http://' + host + ':' + port);
  });
}

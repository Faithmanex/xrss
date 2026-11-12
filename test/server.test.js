import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/server.js';

const RESULT = {
  handle: 'example',
  source: 'https://x.com/example',
  profile: { name: 'Example', bio: 'bio' },
  fetchedAt: '2026-01-01T00:00:00.000Z',
  posts: [
    { id: '2', text: 'Newer', url: 'https://x.com/example/status/2', createdAtMs: 1760000600000, createdAt: '2026-01-01T00:01:00.000Z' },
    { id: '1', text: 'Older', url: 'https://x.com/example/status/1', createdAtMs: 1760000000000, createdAt: '2026-01-01T00:00:00.000Z' },
  ],
};

async function withServer(fn, options = {}) {
  let calls = 0;
  const server = createServer({
    fetcher: async () => {
      calls += 1;
      return RESULT;
    },
    ...options,
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try {
    await fn('http://127.0.0.1:' + port, () => calls);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('GET /u/:handle returns RSS', async () => {
  await withServer(async (base) => {
    const res = await fetch(base + '/u/example');
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /application\/rss\+xml/);
    assert.match(await res.text(), /Newer/);
  });
});

test('GET /u/:handle.json returns JSON and honours limit', async () => {
  await withServer(async (base) => {
    const res = await fetch(base + '/u/example.json?limit=1');
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.count, 1);
    assert.equal(body.items[0].id, '2');
  });
});

test('cache serves repeat requests without refetching', async () => {
  await withServer(async (base, calls) => {
    await fetch(base + '/u/example');
    await fetch(base + '/u/example.atom');
    assert.equal(calls(), 1);
    await fetch(base + '/u/example?refresh=1');
    assert.equal(calls(), 2);
  });
});

test('unknown routes return 404 JSON', async () => {
  await withServer(async (base) => {
    const res = await fetch(base + '/nope');
    assert.equal(res.status, 404);
    assert.equal((await res.json()).error, 'not_found');
  });
});

test('health endpoint reports ok', async () => {
  await withServer(async (base) => {
    const res = await fetch(base + '/health');
    assert.equal(res.status, 200);
    assert.equal((await res.json()).ok, true);
  });
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { toRss, toAtom, toJson, escapeXml } from '../src/feeds.js';

const result = {
  handle: 'example',
  source: 'https://x.com/example',
  profile: { name: 'Example & Co', bio: 'a < b' },
  fetchedAt: '2026-01-01T00:00:00.000Z',
  posts: [
    { id: '1', text: 'Tom & Jerry <3', url: 'https://x.com/example/status/1', createdAtMs: 1760000000000, createdAt: '2026-01-01T00:00:00.000Z' },
  ],
};

test('escapeXml covers the five entities', () => {
  assert.equal(escapeXml('&<>"\''), '&amp;&lt;&gt;&quot;&apos;');
});

test('toRss produces valid-looking RSS with escaped content', () => {
  const xml = toRss(result, { selfUrl: 'https://feeds.test/u/example' });
  assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<rss version="2.0"/);
  assert.match(xml, /Tom &amp; Jerry &lt;3/);
  assert.match(xml, /<link>https:\/\/x.com\/example\/status\/1<\/link>/);
  assert.match(xml, /rel="self"/);
});

test('toAtom includes an updated timestamp from the newest post', () => {
  const xml = toAtom(result);
  assert.match(xml, /<feed xmlns="http:\/\/www.w3.org\/2005\/Atom">/);
  assert.match(xml, /<updated>2026-01-01T00:00:00.000Z<\/updated>/);
  assert.match(xml, /<id>tag:x.com,2026:1<\/id>/);
});

test('toJson exposes a stable shape', () => {
  const json = toJson(result);
  assert.equal(json.count, 1);
  assert.deepEqual(json.items[0], {
    id: '1',
    url: 'https://x.com/example/status/1',
    text: 'Tom & Jerry <3',
    createdAt: '2026-01-01T00:00:00.000Z',
  });
});

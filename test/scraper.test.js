import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTweets, parseProfile, normalizeEscapes, getProfile, XrssError } from '../src/scraper.js';
import { makePage } from './helpers.js';

const PAGE = makePage({
  handle: 'example',
  tweets: [
    { id: '1900000000000000001', ms: 1760000000000, text: 'First post' },
    { id: '1900000000000000002', ms: 1760000600000, text: 'Second post with a & and <tags>' },
  ],
});

test('normalizeEscapes peels nested escaping until stable', () => {
  const value = JSON.stringify(JSON.stringify({ hello: 'world' }));
  assert.match(normalizeEscapes(value), /\{"hello":"world"\}/);
});

test('parseProfile reads name, handle and bio', () => {
  const profile = parseProfile(PAGE);
  assert.equal(profile.name, 'Example User');
  assert.equal(profile.handle, 'example');
  assert.equal(profile.bio, 'Hello & welcome');
  assert.equal(profile.followers, 1234);
});

test('parseTweets returns posts newest first with links', () => {
  const posts = parseTweets(PAGE, 'example');
  assert.equal(posts.length, 2);
  assert.equal(posts[0].id, '1900000000000000002');
  assert.equal(posts[0].url, 'https://x.com/example/status/1900000000000000002');
  assert.equal(posts[1].text, 'First post');
});

test('parseTweets handles an empty timeline', () => {
  assert.deepEqual(parseTweets(makePage({ tweets: [] }), 'example'), []);
});

test('getProfile rejects invalid handles before fetching', async () => {
  let called = false;
  const fetchImpl = async () => {
    called = true;
    return { status: 200, text: async () => '' };
  };
  await assert.rejects(
    () => getProfile('bad handle!', { fetchImpl }),
    (err) => err instanceof XrssError && err.code === 'bad_handle'
  );
  assert.equal(called, false);
});

test('getProfile maps 404 to a not_found error', async () => {
  const fetchImpl = async () => ({ status: 404, text: async () => 'nope' });
  await assert.rejects(
    () => getProfile('missing', { fetchImpl }),
    (err) => err.code === 'not_found' && err.status === 404
  );
});

test('getProfile strips retweets by default', async () => {
  const page = makePage({
    tweets: [
      { id: '1900000000000000003', ms: 1760000000000, text: 'RT @someone: original' },
      { id: '1900000000000000004', ms: 1760001000000, text: 'Original thought' },
    ],
  });
  const fetchImpl = async () => ({ status: 200, text: async () => page });
  const result = await getProfile('example', { fetchImpl });
  assert.equal(result.posts.length, 1);
  assert.equal(result.posts[0].text, 'Original thought');
});

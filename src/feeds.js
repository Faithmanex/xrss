/** Feed renderers: RSS 2.0, Atom 1.0, JSON. */

export function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function feedTitle(result) {
  const name = result.profile?.name || '@' + result.handle;
  return name + ' (@' + result.handle + ')';
}

export function toRss(result, options = {}) {
  const self = options.selfUrl || '';
  const items = result.posts
    .map((post) =>
      [
        '    <item>',
        '      <title>' + escapeXml(trimTitle(post.text)) + '</title>',
        '      <description>' + escapeXml(post.text) + '</description>',
        '      <link>' + escapeXml(post.url) + '</link>',
        '      <guid isPermaLink="true">' + escapeXml(post.url) + '</guid>',
        '      <pubDate>' + new Date(post.createdAtMs).toUTCString() + '</pubDate>',
        '    </item>',
      ].join('\n')
    )
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    '    <title>' + escapeXml(feedTitle(result)) + '</title>',
    '    <link>' + escapeXml(result.source) + '</link>',
    '    <description>' + escapeXml(result.profile?.bio || 'Posts from @' + result.handle) + '</description>',
    '    <language>en</language>',
    '    <lastBuildDate>' + new Date(result.fetchedAt).toUTCString() + '</lastBuildDate>',
    self ? '    <atom:link href="' + escapeXml(self) + '" rel="self" type="application/rss+xml"/>' : '',
    items,
    '  </channel>',
    '</rss>',
    '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function toAtom(result, options = {}) {
  const self = options.selfUrl || '';
  const updated = result.posts[0]?.createdAt || result.fetchedAt;
  const entries = result.posts
    .map((post) =>
      [
        '  <entry>',
        '    <title>' + escapeXml(trimTitle(post.text)) + '</title>',
        '    <link rel="alternate" href="' + escapeXml(post.url) + '"/>',
        '    <id>tag:x.com,2026:' + post.id + '</id>',
        '    <updated>' + new Date(post.createdAtMs).toISOString() + '</updated>',
        '    <content type="text">' + escapeXml(post.text) + '</content>',
        '  </entry>',
      ].join('\n')
    )
    .join('\n');

  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<feed xmlns="http://www.w3.org/2005/Atom">',
    '  <title>' + escapeXml(feedTitle(result)) + '</title>',
    '  <subtitle>' + escapeXml(result.profile?.bio || '') + '</subtitle>',
    '  <link rel="alternate" href="' + escapeXml(result.source) + '"/>',
    self ? '  <link rel="self" href="' + escapeXml(self) + '"/>' : '',
    '  <id>tag:x.com,2026:user-' + result.handle + '</id>',
    '  <updated>' + new Date(updated).toISOString() + '</updated>',
    '  <author><name>' + escapeXml(result.profile?.name || result.handle) + '</name></author>',
    entries,
    '</feed>',
    '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function toJson(result) {
  return {
    handle: result.handle,
    profile: result.profile,
    source: result.source,
    fetchedAt: result.fetchedAt,
    count: result.posts.length,
    items: result.posts.map((post) => ({
      id: post.id,
      url: post.url,
      text: post.text,
      createdAt: post.createdAt,
    })),
  };
}

function trimTitle(text) {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > 110 ? flat.slice(0, 107) + '...' : flat;
}

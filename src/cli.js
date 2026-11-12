#!/usr/bin/env node
/** CLI: print a profile as RSS (default), Atom or JSON. */

import { writeFile } from 'node:fs/promises';
import { getProfile } from './scraper.js';
import { toRss, toAtom, toJson } from './feeds.js';

function usage() {
  console.error([
    'Usage: xrss <handle> [options]',
    '',
    'Options:',
    '  --atom            Output Atom instead of RSS',
    '  --json            Output JSON instead of RSS',
    '  --limit <n>       Keep only the newest n posts',
    '  -o, --out <file>  Write to a file instead of stdout',
    '  -h, --help        Show this help',
  ].join('\n'));
}

const args = process.argv.slice(2);
if (!args.length || args.includes('-h') || args.includes('--help')) {
  usage();
  process.exit(args.length ? 0 : 1);
}

let handle = null;
let format = 'rss';
let out = null;
let limit = 0;

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === '--atom') format = 'atom';
  else if (arg === '--json') format = 'json';
  else if (arg === '--limit') limit = Number(args[++i] || 0);
  else if (arg === '-o' || arg === '--out') out = args[++i];
  else if (arg.startsWith('-')) {
    console.error('Unknown option: ' + arg);
    process.exit(1);
  } else if (!handle) handle = arg;
  else {
    console.error('Only one handle at a time.');
    process.exit(1);
  }
}

if (!handle) {
  usage();
  process.exit(1);
}

try {
  const result = await getProfile(handle);
  const posts = limit > 0 ? result.posts.slice(0, limit) : result.posts;
  const payload = { ...result, posts };
  const body =
    format === 'json'
      ? JSON.stringify(toJson(payload), null, 2) + '\n'
      : format === 'atom'
        ? toAtom(payload)
        : toRss(payload);

  if (out) {
    await writeFile(out, body);
    console.error('[xrss] wrote ' + out + ' (' + posts.length + ' posts)');
  } else {
    process.stdout.write(body);
  }
} catch (err) {
  console.error('[xrss] ' + (err.message || err));
  process.exit(1);
}

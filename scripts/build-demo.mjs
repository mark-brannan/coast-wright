#!/usr/bin/env node
// Assembles the GitHub Pages demo into _site/: the static page and its
// vendored coastline from demo/, and the unmodified published library under
// _site/lib/ so a plain static host can serve the same files npm ships.
// Local, offline, no dependencies -- preview with any static server, e.g.
// `python3 -m http.server -d _site`.
//
// The library's smallness is the point, so lib/ has its own budget, measured
// two ways: raw bytes on disk and gzipped bytes over the wire. No minifier is a
// devDependency, so gzip is of the raw source (a minifier would only lower it).
// Both are printed every run so growth is seen and its cost understood; the
// site budget is dominated by the vendored Natural Earth layers, which load on
// demand, so it bounds the repository more than any one visit. The build fails
// rather than ship either heavier than its budget.

import { cp, mkdir, readdir, readFile, rm, stat } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const site = path.join(root, '_site');
const LIB_BUDGET = 100_000;
const LIB_GZIP_BUDGET = 30_000;
const BUDGET = 5_200_000;

await rm(site, { recursive: true, force: true });
await mkdir(path.join(site, 'lib'), { recursive: true });
await cp(path.join(root, 'demo'), site, { recursive: true });
await cp(path.join(root, 'lib'), path.join(site, 'lib'), { recursive: true });

let lib = 0;
let libGzip = 0;
for (const entry of await readdir(path.join(root, 'lib'), { recursive: true })) {
  const file = path.join(root, 'lib', entry);
  const info = await stat(file);
  if (!info.isFile()) continue;
  lib += info.size;
  libGzip += gzipSync(await readFile(file), { level: 9 }).length;
}
console.log(
  `lib/: ${lib} bytes raw of ${LIB_BUDGET}, ${libGzip} bytes gzipped of ${LIB_GZIP_BUDGET}`,
);
if (lib > LIB_BUDGET || libGzip > LIB_GZIP_BUDGET) {
  console.error('lib/ is over its budget');
  process.exit(1);
}

let total = 0;
for (const entry of await readdir(site, { recursive: true })) {
  const info = await stat(path.join(site, entry));
  if (info.isFile()) total += info.size;
}
if (total > BUDGET) {
  console.error(`_site is ${total} bytes, over the ${BUDGET} budget`);
  process.exit(1);
}
console.log(`_site assembled: ${total} bytes of ${BUDGET} budget`);

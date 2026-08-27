#!/usr/bin/env node
// Assembles the GitHub Pages demo into _site/: the static page and its
// vendored coastline from demo/, and the unmodified published library under
// _site/lib/ so a plain static host can serve the same files npm ships.
// Local, offline, no dependencies -- preview with any static server, e.g.
// `python3 -m http.server -d _site`.
//
// The page leans on the library's own smallness, so the build fails rather
// than ship a site heavier than the budget.

import { cp, mkdir, readdir, rm, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = fileURLToPath(new URL('..', import.meta.url))
const site = path.join(root, '_site')
const BUDGET = 160_000

await rm(site, { recursive: true, force: true })
await mkdir(path.join(site, 'lib'), { recursive: true })
await cp(path.join(root, 'demo'), site, { recursive: true })
await cp(path.join(root, 'lib'), path.join(site, 'lib'), { recursive: true })

let total = 0
for (const entry of await readdir(site, { recursive: true })) {
  const info = await stat(path.join(site, entry))
  if (info.isFile()) total += info.size
}
if (total > BUDGET) {
  console.error(`_site is ${total} bytes, over the ${BUDGET} budget`)
  process.exit(1)
}
console.log(`_site assembled: ${total} bytes of ${BUDGET} budget`)

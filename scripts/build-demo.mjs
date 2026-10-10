#!/usr/bin/env node
// Assembles the GitHub Pages demo into _site/: the static page and its
// vendored coastline from demo/, and the unmodified published library under
// _site/lib/ so a plain static host can serve the same files npm ships.
// Local, offline, no dependencies -- preview with any static server, e.g.
// `python3 -m http.server -d _site`.
//
// The library's smallness is the point, so lib/ has its own budget; the site
// budget is dominated by the vendored Natural Earth file. The build fails
// rather than ship either heavier than its budget.

import { cp, mkdir, readdir, rm, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = fileURLToPath(new URL('..', import.meta.url))
const site = path.join(root, '_site')
const LIB_BUDGET = 16_000
const BUDGET = 1_800_000

await rm(site, { recursive: true, force: true })
await mkdir(path.join(site, 'lib'), { recursive: true })
await cp(path.join(root, 'demo'), site, { recursive: true })
await cp(path.join(root, 'lib'), path.join(site, 'lib'), { recursive: true })

let lib = 0
for (const entry of await readdir(path.join(root, 'lib'), { recursive: true })) {
  const info = await stat(path.join(root, 'lib', entry))
  if (info.isFile()) lib += info.size
}
if (lib > LIB_BUDGET) {
  console.error(`lib/ is ${lib} bytes, over the ${LIB_BUDGET} budget`)
  process.exit(1)
}

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

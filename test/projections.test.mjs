// The gallery's contract, pinned: every projection in the menu is drawn by
// the published limn -- same call, no special-case drawing code -- and what
// comes out is a map, not a seam. Chords are measured against the drawn
// extent because a wrap or a rim smear shows up as a stroke comparable to
// the whole map, while honest distortion of the fixture's longest (~16
// degree) segments stays well under that.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { rings, limn } from '../lib/index.js'
import { projections, frame } from '../demo/projections.js'

const require = createRequire(import.meta.url)
const coastline = require('./fixtures/coastline-110m.json')
const coast = rings(coastline)

// The page's coastline is Natural Earth v5.1.2 ne_50m_coastline.geojson,
// byte for byte, and pinned: a stale or edited copy fails instead of quietly
// shipping.
test('the vendored demo coastline is the Natural Earth file', () => {
  const digest = createHash('sha256')
    .update(readFileSync(new URL('../demo/ne_50m_coastline.geojson', import.meta.url)))
    .digest('hex')
  assert.equal(digest, '271f1c4c1908312bac6b29d158ea1356544beafc129f260005300913aa5ea283')
})

// The optional layers are pinned the same way.
const layers = {
  ne_50m_admin_0_boundary_lines_land: '2faac4f6b34386f3d21b6e018cf151f241f00e5c936d44dd17d7d9bfb147fa48',
  ne_50m_rivers_lake_centerlines: 'f286e0ce978fde999ca2d7a78c764be08542e19b63cded52b05c12d5173ccc51',
  ne_50m_lakes: 'd350b75978b26fe839b797c2c529b2fb8f47fb3983c03f4964e36d5df9378a52',
  ne_50m_antarctic_ice_shelves_lines: '549eabb5a2e2913f1dfde976871c0cf2bbc62eea0b24a2a293fa3faa185f830d',
}
for (const [name, sha] of Object.entries(layers)) {
  test(`the vendored ${name} layer is the Natural Earth file`, () => {
    const digest = createHash('sha256')
      .update(readFileSync(new URL(`../demo/${name}.geojson`, import.meta.url)))
      .digest('hex')
    assert.equal(digest, sha)
  })
}

test('the menu is a dozen strong and not all cylinders', () => {
  assert.ok(projections.length >= 12, `${projections.length} projections`)
  assert.equal(new Set(projections.map((p) => p.id)).size, projections.length)
  const bent = projections.filter((p) => p.family !== 'cylindrical')
  assert.ok(bent.length >= 3, `only ${bent.length} non-cylindrical`)
})

// Greenwich flatters everything; Fiji finds wrap bugs, the Antarctic centre
// puts azimuthal equidistant's antipode in the Canadian Arctic, where there
// is plenty of coastline to smear around the rim.
const centres = [
  [0, 0],
  [178, -17],
  [25, -78],
]

for (const spec of projections) {
  for (const [lon0, lat0] of centres) {
    test(`${spec.id} draws a map through limn, centred ${lon0},${lat0}`, () => {
      const { x, y, visible, lonCenter } = frame(spec, lon0, lat0)
      let at = null
      const segments = []
      const ctx = {
        save() {},
        restore() {},
        beginPath() {
          at = null
        },
        stroke() {},
        moveTo(px, py) {
          assert.ok(Number.isFinite(px) && Number.isFinite(py), `non-finite point ${px},${py}`)
          at = [px, py]
        },
        lineTo(px, py) {
          assert.ok(Number.isFinite(px) && Number.isFinite(py), `non-finite point ${px},${py}`)
          if (at) segments.push([at, [px, py]])
          at = [px, py]
        },
      }
      limn(ctx, coast, x, y, { lonCenter, visible })

      assert.ok(segments.length > 500, `only ${segments.length} segments drawn`)
      let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity
      for (const [a, b] of segments) {
        for (const [px, py] of [a, b]) {
          if (px < minx) minx = px
          if (px > maxx) maxx = px
          if (py < miny) miny = py
          if (py > maxy) maxy = py
        }
      }
      const diagonal = Math.hypot(maxx - minx, maxy - miny)
      for (const [a, b] of segments) {
        const chord = Math.hypot(b[0] - a[0], b[1] - a[1])
        assert.ok(
          chord < diagonal / 5,
          `a stroke ${((chord / diagonal) * 100).toFixed(0)}% of the map long -- a seam, not a coastline`
        )
      }
    })
  }
}

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { decodeRing, rings, polygons, limn } from '../lib/index.js'

// Vendored copies of the `coastlines` package's files -- see
// test/fixtures/README.md. Vendored so the tests need no install and no
// network; checked against their own digests below so a stale copy fails.
const require = createRequire(import.meta.url)
const coastline = require('./fixtures/coastline-110m.json')
const land = require('./fixtures/land-110m.json')
const fixtures = require('./fixtures/portolano-fixtures.json')

test('the vendored fixtures are the files they claim to be', () => {
  for (const portolano of [coastline, land]) {
    const digest =
      'sha256:' + createHash('sha256').update(JSON.stringify(portolano.geometry)).digest('hex')
    assert.equal(digest, portolano.digest, portolano.provenance.source.id)
  }
})

/** Enough of a 2D context to record what was drawn. */
function recordingContext() {
  let at = null
  const segments = []
  return {
    segments,
    save() {},
    restore() {},
    beginPath() {
      at = null
    },
    stroke() {},
    moveTo(x, y) {
      at = [x, y]
    },
    lineTo(x, y) {
      if (at) segments.push([at, [x, y]])
      at = [x, y]
    },
  }
}

test('the decoder passes the published fixture vectors', () => {
  for (const vector of fixtures.vectors) {
    assert.deepEqual(decodeRing(vector.encoded, vector.precision), vector.degrees, vector.name)
  }
})

test('decoding a shipped profile reproduces its declared counts', () => {
  const decoded = rings(coastline)
  assert.equal(decoded.length, coastline.counts.rings)
  assert.equal(
    decoded.reduce((total, ring) => total + ring.length, 0),
    coastline.counts.points
  )
})

test('rings are decoded once and the result reused', () => {
  assert.equal(rings(coastline), rings(coastline))
})

test('polygons keep outer rings and holes apart', () => {
  const shapes = polygons(land)
  assert.equal(shapes.length, land.counts.shapes)
  assert.ok(shapes.some((shape) => shape.length > 1), 'at least one shape has a hole')
  for (const shape of shapes) {
    for (const ring of shape) assert.deepEqual(ring[0], ring[ring.length - 1])
  }
  assert.throws(() => polygons(coastline), /needs a "polygons" portolano/)
})

test('a document from a format we do not know is refused, not guessed at', () => {
  assert.throws(() => rings({ format: 'portolano/2' }), /not a portolano\/1/)
  assert.throws(
    () => rings({ format: 'portolano/1', encoding: { order: 'lat,lon' } }),
    /unsupported coordinate order/
  )
})

const width = 800
const project = (lonCenter) => ({
  x: (lon) => {
    let delta = lon - lonCenter
    if (delta > 180) delta -= 360
    if (delta < -180) delta += 360
    return width / 2 + (delta / 180) * (width / 2)
  },
  y: (lat) => 160 - lat,
})

// A window centred on Greenwich meets the seam at the antimeridian; one
// centred near Fiji meets it at Greenwich. Both have to survive it, and the
// second is the case a dateline-only guard gets wrong.
for (const lonCenter of [0, 178, -122.3]) {
  test(`limn joins no two points across the seam at ${lonCenter}`, () => {
    const { x, y } = project(lonCenter)
    const ctx = recordingContext()
    limn(ctx, rings(coastline), x, y, { color: '#fff', lonCenter })

    assert.ok(ctx.segments.length > 1000, `only ${ctx.segments.length} segments drawn`)
    for (const [from, to] of ctx.segments) {
      // Half the canvas is 180 degrees of longitude. Nothing on a quarter
      // degree coastline moves that far in one step; anything that does is
      // the seam being drawn rather than broken.
      assert.ok(Math.abs(to[0] - from[0]) < width / 2, `seam drawn at lonCenter ${lonCenter}`)
    }
  })
}

test('limn projects through the caller functions and nothing else', () => {
  const ctx = recordingContext()
  limn(ctx, [[[0, 0], [10, 0]]], (lon) => lon * 2, (lat) => lat * 3 + 1, {})
  assert.deepEqual(ctx.segments, [[[0, 1], [20, 1]]])
})

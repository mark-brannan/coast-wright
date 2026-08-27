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

// Outside the cylindrical family neither output is computable from one
// coordinate alone, so each function gets the other coordinate too --
// x(lon, lat) and y(lat, lon), first arguments unchanged so a one-argument
// caller never notices.
test('x and y each receive the other coordinate second', () => {
  const calls = []
  limn(
    recordingContext(),
    [[[10, 20], [11, 21]]],
    (lon, lat) => (calls.push(['x', lon, lat]), lon),
    (lat, lon) => (calls.push(['y', lat, lon]), lat),
    {}
  )
  assert.deepEqual(calls, [
    ['x', 10, 20],
    ['y', 20, 10],
    ['x', 11, 21],
    ['y', 21, 11],
  ])
})

// The generalised seam: a projection that does not wrap says which points it
// cannot draw, and a refused point lifts the pen -- the ring must resume at
// the next visible point, never bridge the gap.
test('a refused point lifts the pen rather than bridging the gap', () => {
  const ring = [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]]
  const ctx = recordingContext()
  limn(ctx, [ring], (lon) => lon, (lat) => lat, { visible: (lon) => lon !== 2 })
  assert.deepEqual(ctx.segments, [
    [[0, 0], [1, 0]],
    [[3, 0], [4, 0]],
  ])
})

// Refusal happens before projection. Inside an azimuthal projection's
// antipode mask is exactly where x and y divide by zero, so asking them
// there -- even for a moveTo that never strokes -- is the bug.
test('a refused point is never projected', () => {
  const asked = []
  limn(
    recordingContext(),
    [[[0, 0], [2, 0], [4, 0]]],
    (lon) => (asked.push(['x', lon]), lon),
    (lat) => (asked.push(['y', lat]), lat),
    { visible: (lon) => lon !== 2 }
  )
  assert.deepEqual(asked, [
    ['x', 0], ['y', 0],
    ['x', 4], ['y', 0],
  ])
})

// Orthographic-shaped, with real coastline and a centre in the Pacific: the
// far hemisphere projects mirrored into the same disc as the near one, so
// nothing on it may reach the projection at all. The wrap seam keeps
// applying alongside -- both rules run, neither replaces the other.
test('a hemisphere mask keeps the far side out of the projection entirely', () => {
  const lonCenter = 178
  const lat0 = -17 * (Math.PI / 180)
  const nearSide = (lon, lat) => {
    const λ = ((((lon - lonCenter + 180) % 360) + 360) % 360) - 180
    const φ = lat * (Math.PI / 180)
    return Math.sin(lat0) * Math.sin(φ) + Math.cos(lat0) * Math.cos(φ) * Math.cos(λ * (Math.PI / 180)) > 0
  }
  const { x, y } = project(lonCenter)
  const guarded = (project) => (a, b) => {
    assert.ok(nearSide(...(project === x ? [a, b] : [b, a])), `far-side point projected: ${a},${b}`)
    return project(a)
  }
  const ctx = recordingContext()
  limn(ctx, rings(coastline), guarded(x), guarded(y), { lonCenter, visible: nearSide })
  assert.ok(ctx.segments.length > 500, `only ${ctx.segments.length} segments drawn`)
  for (const [from, to] of ctx.segments) {
    assert.ok(Math.abs(to[0] - from[0]) < width / 2, 'seam drawn despite the mask')
  }
})

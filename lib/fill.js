// Filling. `limn` strokes lines, where a seam only has to lift the pen; a fill
// cannot lift a pen, because a ring cut open no longer encloses anything. So
// a ring that crosses the seam is cut along it and each piece closed on its
// own side, and the map sees two shapes meeting at its edge instead of one
// shape smeared across it.

const EDGE = 180 - 1e-9 // just inside the seam, so no projection has to guess which side ±180 is

/**
 * Traces polygons as one path of closed rings, for the caller to fill or
 * clip: `trace(...); ctx.fill('evenodd')`, or `ctx.save(); trace(...);
 * ctx.clip('evenodd')` to keep a stroke on the land. Starts a new path.
 *
 * `polygons` is `[[outer, ...holes], ...]` of `[lon, lat]` rings, as
 * `geojsonPolygons` returns. Winding is not relied on, so fill even-odd.
 *
 * The seam is the meridian opposite `lonCenter`, as for `limn`. A ring that
 * stays on one side of it is traced exactly as given. A ring that crosses it
 * is cut there and each side traced alone, its lon kept within a hair of
 * the seam. A ring that goes all the way round, as Antarctica does, is
 * closed along the pole on its own side of the equator.
 *
 * There is no `visible` here yet: a globe's horizon needs a polygon clip,
 * not a lifted pen.
 */
export function trace(ctx, polygons, x, y, options = {}) {
  const { lonCenter = 0 } = options
  ctx.beginPath()
  for (const polygon of polygons) {
    for (const ring of polygon) {
      for (const piece of pieces(ring, lonCenter)) {
        for (let i = 0; i < piece.length; i++) {
          const [lon, lat] = piece[i]
          if (i) ctx.lineTo(x(lon, lat), y(lat, lon))
          else ctx.moveTo(x(lon, lat), y(lat, lon))
        }
        ctx.closePath()
      }
    }
  }
}

/** Traces and fills polygons; see `trace` for the seam. Even-odd by default. */
export function fill(ctx, polygons, x, y, options = {}) {
  const { color, alpha = 1, rule = 'evenodd' } = options
  ctx.save()
  if (color) ctx.fillStyle = color
  ctx.globalAlpha = alpha
  trace(ctx, polygons, x, y, options)
  ctx.fill(rule)
  ctx.restore()
}

/** The ring as one or more rings, none crossing the seam. */
function pieces(ring, lonCenter) {
  if (ring.length < 3) return []
  // Unwrap: each point's offset from the centre, taken within 180 of the last.
  const unwrapped = new Array(ring.length)
  let previous = wrap(ring[0][0] - lonCenter)
  let min = previous
  let max = previous
  for (let i = 0; i < ring.length; i++) {
    let delta = wrap(ring[i][0] - lonCenter)
    while (delta - previous > 180) delta -= 360
    while (delta - previous < -180) delta += 360
    unwrapped[i] = [delta, ring[i][1]]
    previous = delta
    if (delta < min) min = delta
    if (delta > max) max = delta
  }
  if (min > -180 && max < 180) return [ring]

  // Round the pole: the ring ends a world away from where it began.
  const last = unwrapped[unwrapped.length - 1]
  if (Math.abs(last[0] - unwrapped[0][0]) > 180) {
    const mean = ring.reduce((sum, point) => sum + point[1], 0) / ring.length
    const pole = mean < 0 ? -90 : 90
    unwrapped.push([last[0], pole], [unwrapped[0][0], pole])
  }

  const out = []
  for (let shift = -360 * Math.ceil((max + 180) / 360); min + shift < 180; shift += 360) {
    if (max + shift <= -180) continue
    const clipped = clipBand(unwrapped.map(([delta, lat]) => [delta + shift, lat]))
    if (clipped.length > 2) out.push(clipped.map(([delta, lat]) => [lonCenter + delta, lat]))
  }
  return out
}

const wrap = (delta) => ((((delta + 180) % 360) + 360) % 360) - 180

/** Sutherland-Hodgman against -EDGE <= delta <= EDGE, lat interpolated linearly. */
function clipBand(ring) {
  let out = ring
  for (const edge of [EDGE, -EDGE]) {
    const inside = (delta) => (edge > 0 ? delta <= edge : delta >= edge)
    const source = out
    out = []
    for (let i = 0; i < source.length; i++) {
      const a = source[(i + source.length - 1) % source.length]
      const b = source[i]
      const cut = () => [edge, a[1] + ((b[1] - a[1]) * (edge - a[0])) / (b[0] - a[0])]
      if (inside(b[0])) {
        if (!inside(a[0])) out.push(cut())
        out.push(b)
      } else if (inside(a[0])) out.push(cut())
    }
    if (!out.length) break
  }
  return out
}

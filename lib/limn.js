// Drawing. Projection-agnostic and seam-aware, which between them are the
// whole reason this is a library rather than a for-loop you write inline.

/**
 * Draws rings through a map's own projection.
 *
 * `x` and `y` are the caller's lon/lat-to-pixel functions, so this makes no
 * assumption about the window, the centre, or the scale -- one caller may be
 * drawing a band around a vessel and another the whole planet, and neither has
 * to tell this function which. Both receive the other coordinate as a second
 * argument -- `x(lon, lat)` and `y(lat, lon)` -- because outside the
 * cylindrical family neither output is computable from one coordinate alone.
 * A projection that never looks at the second argument keeps working as it
 * always has.
 *
 * Two different rules lift the pen, and neither replaces the other:
 *
 * Segments spanning more than half the world are dropped rather than drawn. A
 * ring crossing the antimeridian holds two points a tenth of a degree apart on
 * the ground and 360 apart in the numbers; so does a ring passing behind a
 * window centred anywhere but Greenwich. Either one, joined, lays a line
 * across the entire map -- so the seam is tested against `lonCenter`, the
 * longitude the caller's own projection measures from. For a projection that
 * does not wrap, the rule's only false positives are near-antipodal jumps
 * whose endpoints project close together anyway; the cost is a sub-pixel gap,
 * where the cost of drawing a wrapped segment is a line across the map.
 *
 * `visible` is for the projections whose seam is not a wrap at all: it is
 * asked before each point, and a point it refuses is neither drawn nor even
 * projected -- the pen lifts, and the ring resumes at the next visible point.
 * Orthographic hides the far hemisphere, which otherwise lands mirrored
 * inside the same disc; azimuthal equidistant masks a cap around the
 * antipode, where its arithmetic divides by zero and the coastline smears
 * around the rim. Not projecting refused points is part of the contract:
 * inside the mask is exactly where `x` and `y` cannot be trusted to return
 * numbers.
 */
export function limn(ctx, rings, x, y, options = {}) {
  const { color, alpha = 0.45, width = 1, lonCenter = 0, visible } = options
  const fromCentre = (lon) => {
    let delta = lon - lonCenter
    if (delta > 180) delta -= 360
    if (delta < -180) delta += 360
    return delta
  }
  ctx.save()
  if (color) ctx.strokeStyle = color
  ctx.globalAlpha = alpha
  ctx.lineWidth = width
  ctx.lineJoin = 'round'
  for (const ring of rings) {
    ctx.beginPath()
    let pendown = false
    let previous = 0
    for (let i = 0; i < ring.length; i++) {
      const [lon, lat] = ring[i]
      const delta = fromCentre(lon)
      if (i > 0 && Math.abs(delta - previous) > 180) pendown = false
      previous = delta
      if (visible && !visible(lon, lat)) {
        pendown = false
        continue
      }
      if (pendown) ctx.lineTo(x(lon, lat), y(lat, lon))
      else ctx.moveTo(x(lon, lat), y(lat, lon))
      pendown = true
    }
    ctx.stroke()
  }
  ctx.restore()
}

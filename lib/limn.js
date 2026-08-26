// Drawing. Projection-agnostic and seam-aware, which between them are the
// whole reason this is a library rather than a for-loop you write inline.

/**
 * Draws rings through a map's own projection.
 *
 * `x` and `y` are the caller's lon/lat-to-pixel functions, so this makes no
 * assumption about the window, the centre, or the scale -- one caller may be
 * drawing a band around a vessel and another the whole planet, and neither has
 * to tell this function which.
 *
 * Segments spanning more than half the world are dropped rather than drawn. A
 * ring crossing the antimeridian holds two points a tenth of a degree apart on
 * the ground and 360 apart in the numbers; so does a ring passing behind a
 * window centred anywhere but Greenwich. Either one, joined, lays a line
 * across the entire map -- so the seam is tested against `lonCenter`, the
 * longitude the caller's own projection measures from.
 */
export function limn(ctx, rings, x, y, options = {}) {
  const { color, alpha = 0.45, width = 1, lonCenter = 0 } = options
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
      if (pendown) ctx.lineTo(x(lon), y(lat))
      else ctx.moveTo(x(lon), y(lat))
      pendown = true
    }
    ctx.stroke()
  }
  ctx.restore()
}

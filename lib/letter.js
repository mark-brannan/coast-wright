// Lettering: names set along the coast, read from the sea. Fonts are the
// caller's; this file loads none, so a face that has not arrived yet draws in
// the next family on the list.

const GENERIC = /^(serif|sans-serif|monospace|cursive|fantasy|system-ui|math|emoji|fangsong|ui-[a-z-]+)$/

/**
 * Lays names out without drawing them, and returns the ones that fit.
 *
 * `names` is `[{ text, at, land, fonts, size }, ...]`, earlier names winning
 * where two collide, so sort by importance first. `at` is where the name
 * belongs: a point, `[lon, lat]`, or a stretch of coast, `[[lon, lat], ...]`,
 * or the same as a GeoJSON Point, LineString or MultiLineString geometry.
 *
 * A point's name sits level, centred above it. A coast's name is set along
 * the coast at the middle of its length, on the land side, its letters
 * standing on the shore so that it reads from the sea. `land` says which side
 * of the line, walked in order, the land lies: `'left'` by default, as
 * Natural Earth draws its coastlines, or `'right'`. With `upright`, the
 * default, a name that would read upside down is turned round and hung from
 * the shore instead, still on the land.
 *
 * Only `ctx.measureText` is used, with `ctx.font` set per name; state is restored.
 *
 * Each placed name comes back as `{ text, font, x, y, angle, baseline, box }`:
 * the anchor in pixels, the angle in radians, the baseline's offset from the
 * anchor in the turned frame, and the four corners of the box it claimed.
 */
export function place(ctx, names, x, y, options = {}) {
  const {
    fonts = ['serif'],
    size,
    style = '',
    weight = '',
    gap,
    padding = 2,
    upright = true,
    lonCenter = 0,
    visible,
  } = options
  const settings = { fonts, size, style, weight, gap, padding, upright, lonCenter, visible }
  const placed = []
  ctx.save()
  try {
    for (const name of names) {
      const one = layout(ctx, name, x, y, settings)
      if (one && !placed.some((other) => overlaps(one.box, other.box))) placed.push(one)
    }
  } finally {
    ctx.restore()
  }
  return placed
}

/** One name's place and box, or null. */
function layout(ctx, name, x, y, { fonts, size, style, weight, gap, padding, upright, lonCenter, visible }) {
  const text = String(name.text ?? '')
  if (!text) return null
  const ok = (n) => Number.isFinite(n) && n > 0
  const px = ok(name.size) ? name.size : ok(size) ? size : 12
  const font = [style, weight, `${px}px`, family(name.fonts ?? fonts)].filter(Boolean).join(' ')
  ctx.font = font
  const metrics = ctx.measureText(text)
  const width = metrics.width
  const ascent = metrics.actualBoundingBoxAscent || px * 0.8
  const descent = metrics.actualBoundingBoxDescent || px * 0.2
  const height = ascent + descent
  const offset = gap ?? px * 0.3

  const where = anchor(name.at, width, x, y, lonCenter, visible)
  if (!where) return null
  let angle = 0
  let flipped = false
  if (where.along) {
    // Land's side of the line, on a screen whose y runs down.
    const [dx, dy] = where.along
    const sign = name.land === 'right' ? -1 : 1
    const up = [sign * dy, -sign * dx]
    // Reading direction for someone at sea facing the land.
    angle = Math.atan2(up[0], -up[1])
    if (upright && Math.cos(angle) < -1e-9) {
      angle += Math.PI
      flipped = true
    }
  }
  // In the turned frame, -y is up the letters; the land is up unless flipped.
  const top = flipped ? offset : -offset - height
  const baseline = top + ascent
  const corners = [
    [-width / 2 - padding, top - padding],
    [width / 2 + padding, top - padding],
    [width / 2 + padding, top + height + padding],
    [-width / 2 - padding, top + height + padding],
  ]
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const box = corners.map(([u, v]) => [where.x + u * cos - v * sin, where.y + u * sin + v * cos])
  return { text, font, x: where.x, y: where.y, angle, baseline, box }
}

/**
 * Lays out names with `place` and draws the ones that fit; returns them.
 * Options are `place`'s, plus `color` (fill style) and `alpha` (default 1).
 */
export function letter(ctx, names, x, y, options = {}) {
  const { color, alpha = 1 } = options
  const placed = place(ctx, names, x, y, options)
  ctx.save()
  if (color) ctx.fillStyle = color
  ctx.globalAlpha = alpha
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  for (const name of placed) {
    ctx.save()
    ctx.font = name.font
    ctx.translate(name.x, name.y)
    ctx.rotate(name.angle)
    ctx.fillText(name.text, 0, name.baseline)
    ctx.restore()
  }
  ctx.restore()
  return placed
}

/** A CSS font-family list: every family quoted and escaped, generics bare. */
function family(fonts) {
  const list = Array.isArray(fonts) ? fonts : String(fonts).split(',')
  return list
    .map((f) => String(f).trim())
    .filter(Boolean)
    .map((f) => {
      const q = /^(["'])(.*)\1$/s.exec(f)
      if (!q && GENERIC.test(f)) return f
      const esc = (h) => '\\' + (h < ' ' || h > '~' ? `${h.charCodeAt().toString(16)} ` : h)
      return `"${(q ? q[2] : f).replace(/[\\"\0-\x1f\x7f]/g, esc)}"`
    })
    .join(', ')
}

/**
 * Where a name goes on screen: `{ x, y }` for a point, plus `along`, a unit
 * vector, for a coast. The coast's direction is taken across the name's own
 * width about the middle of the line, so a closed island ring works as well
 * as an open stretch. Null when there is nowhere visible to put it.
 */
function anchor(at, width, x, y, lonCenter, visible) {
  const line = coordinates(at)
  if (!line) return null
  if (typeof line[0] === 'number') {
    const [lon, lat] = line
    if (visible && !visible(lon, lat)) return null
    const point = { x: x(lon, lat), y: y(lat, lon) }
    return Number.isFinite(point.x) && Number.isFinite(point.y) ? point : null
  }

  // The longest stretch that neither crosses the seam nor leaves the view.
  const fromCentre = (lon) => ((((lon - lonCenter + 180) % 360) + 360) % 360) - 180
  let best = []
  let run = []
  let previous = 0
  for (let i = 0; i < line.length; i++) {
    const [lon, lat] = line[i]
    const delta = fromCentre(lon)
    if (i > 0 && Math.abs(delta - previous) > 180) run = []
    previous = delta
    if (visible && !visible(lon, lat)) {
      run = []
      continue
    }
    const px = x(lon, lat)
    const py = y(lat, lon)
    if (!Number.isFinite(px) || !Number.isFinite(py)) {
      run = []
      continue
    }
    run.push([px, py])
    if (run.length > best.length) best = run
  }
  if (best.length < 2) return null

  const lengths = [0]
  for (let i = 1; i < best.length; i++) {
    lengths.push(lengths[i - 1] + Math.hypot(best[i][0] - best[i - 1][0], best[i][1] - best[i - 1][1]))
  }
  const total = lengths[lengths.length - 1]
  if (total === 0) return null
  const pointAt = (s) => {
    const t = Math.max(0, Math.min(total, s))
    let i = 1
    while (i < best.length - 1 && lengths[i] < t) i++
    const span = lengths[i] - lengths[i - 1] || 1
    const k = (t - lengths[i - 1]) / span
    return [
      best[i - 1][0] + (best[i][0] - best[i - 1][0]) * k,
      best[i - 1][1] + (best[i][1] - best[i - 1][1]) * k,
    ]
  }
  const middle = pointAt(total / 2)
  const half = Math.min(width / 2, total / 2)
  let a = pointAt(total / 2 - half)
  let b = pointAt(total / 2 + half)
  if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 1e-6) [a, b] = [best[0], best[best.length - 1]]
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const norm = Math.hypot(dx, dy)
  if (norm < 1e-6) {
    // A ring shorter than its own name has no stretch to letter along: the
    // name sits level above the island instead, as a point's would.
    const xs = best.map(([px]) => px)
    return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: Math.min(...best.map(([, py]) => py)) }
  }
  return { x: middle[0], y: middle[1], along: [dx / norm, dy / norm] }
}

/** `[lon, lat]`, `[[lon, lat], ...]`, or null, from raw pairs or a GeoJSON geometry. */
function coordinates(at) {
  if (!at) return null
  if (Array.isArray(at)) return at.length ? at : null
  switch (at.type) {
    case 'Point':
    case 'LineString':
      return at.coordinates
    case 'MultiLineString':
      return at.coordinates.reduce((a, b) => (b.length > a.length ? b : a), [])
    default:
      throw new TypeError(`coast-wright: cannot letter along a ${at.type}`)
  }
}

/** Separating-axis test for two convex quadrilaterals. */
function overlaps(p, q) {
  for (const poly of [p, q]) {
    for (let i = 0; i < 4; i++) {
      const [x0, y0] = poly[i]
      const [x1, y1] = poly[(i + 1) % 4]
      const along = ([px, py]) => px * (y0 - y1) + py * (x1 - x0)
      const a = p.map(along)
      const b = q.map(along)
      if (Math.max(...a) <= Math.min(...b) || Math.max(...b) <= Math.min(...a)) return false
    }
  }
  return true
}

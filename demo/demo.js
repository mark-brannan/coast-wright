// The page is a normal customer of the library: every line on the map, the
// thumbnails included, is one limn() call, and the only thing that changes
// when the projection does is the arithmetic handed to it.
// scripts/build-demo.mjs assembles ./lib and the Natural Earth layers next to
// this file; nothing here is special-cased per projection.
import { geojsonRings, limn } from './lib/index.js'
import { projections, frame } from './projections.js'

const D = Math.PI / 180
const canvas = document.getElementById('map')
const ctx = canvas.getContext('2d')
const list = document.getElementById('projections')
const layerList = document.getElementById('layers')
const mathEl = document.getElementById('math')
const whereEl = document.getElementById('where')

// Layers, bottom to top. Every one but the graticule is a Natural Earth
// 1:50m file as published; the graticule is generated, so it costs nothing.
const layers = [
  { id: 'graticule', name: 'Graticule', color: '--grat', width: 0.6, alpha: 0.7, on: true },
  { id: 'lakes', name: 'Lakes', color: '--river', width: 0.7, alpha: 0.8, file: 'ne_50m_lakes.geojson' },
  { id: 'rivers', name: 'Rivers', color: '--river', width: 0.7, alpha: 0.7, file: 'ne_50m_rivers_lake_centerlines.geojson' },
  { id: 'ice', name: 'Ice shelves', color: '--ice', width: 0.8, alpha: 0.9, file: 'ne_50m_antarctic_ice_shelves_lines.geojson' },
  { id: 'borders', name: 'Borders', color: '--border', width: 0.8, alpha: 0.8, dash: [3, 2], on: true, file: 'ne_50m_admin_0_boundary_lines_land.geojson' },
  { id: 'coast', name: 'Coastline', color: '--coast', width: 1.1, alpha: 0.95, on: true, file: 'ne_50m_coastline.geojson' },
]

const home = { lon: 0, lat: 20, zoom: 1 }
const view = { ...home }
let spec = projections.find((p) => p.id === 'winkel-tripel')
const ZOOM_MAX = 60

const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()
const wrapLon = (lon) => ((((lon + 180) % 360) + 360) % 360) - 180
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const latMax = (s) => s.fitLat ?? 90

// --- Geometry the page needs and the library deliberately does not have ---

function graticule(step) {
  const top = 90
  const out = []
  for (let lon = -180; lon < 180; lon += step) {
    const line = []
    for (let lat = -top; lat <= top; lat += 2) line.push([lon, lat])
    out.push(line)
  }
  for (let lat = -90 + step; lat < 90; lat += step) {
    const line = []
    for (let lon = -180; lon <= 180; lon += 2) line.push([lon, lat])
    out.push(line)
  }
  return out
}

// The point `d` radians from (lon0, lat0) on bearing θ.
function destination(lon0, lat0, θ, d) {
  const φ0 = lat0 * D
  const φ = Math.asin(Math.sin(φ0) * Math.cos(d) + Math.cos(φ0) * Math.sin(d) * Math.cos(θ))
  const λ = Math.atan2(Math.sin(θ) * Math.sin(d) * Math.cos(φ0), Math.cos(d) - Math.sin(φ0) * Math.sin(φ))
  return [wrapLon(lon0 + λ / D), φ / D]
}

// The edge of the world in map units. A projection that clips (`visible`)
// is clipped to a cap round the centre, found by bisection along each
// bearing; one that does not is bounded by the meridian behind the centre.
function outline(f, lon0, lat0, top) {
  const pts = []
  if (f.visible) {
    for (let b = 0; b < 360; b += 3) {
      let lo = 0
      let hi = Math.PI
      for (let i = 0; i < 18; i++) {
        const mid = (lo + hi) / 2
        const [lon, lat] = destination(lon0, lat0, b * D, mid)
        if (f.visible(lon, lat)) lo = mid
        else hi = mid
      }
      const [lon, lat] = destination(lon0, lat0, b * D, lo)
      pts.push([f.x(lon, lat), f.y(lat, lon)])
    }
    return pts
  }
  const w = lon0 - 179.999
  const e = lon0 + 179.999
  for (let lat = -top; lat <= top; lat += 2) pts.push([f.x(w, lat), f.y(lat, w)])
  for (let lon = w; lon <= e; lon += 2) pts.push([f.x(lon, top), f.y(top, lon)])
  for (let lat = top; lat >= -top; lat -= 2) pts.push([f.x(e, lat), f.y(lat, e)])
  for (let lon = e; lon >= w; lon -= 2) pts.push([f.x(lon, -top), f.y(-top, lon)])
  return pts
}

// Map units to pixels for one canvas. Fitted to the edge of the world, then
// zoomed about the centre; the centre is held inside the world so a zoomed
// cylinder cannot be dragged off its own top.
function project(s, lon0, lat0, zoom, W, H) {
  const f = frame(s, lon0, lat0)
  const edge = outline(f, lon0, lat0, latMax(s))
  let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity
  for (const [X, Y] of edge) {
    minx = Math.min(minx, X); maxx = Math.max(maxx, X)
    miny = Math.min(miny, Y); maxy = Math.max(maxy, Y)
  }
  const k = Math.min(W / (maxx - minx), H / (maxy - miny)) * 0.94 * zoom
  const hold = (t, lo, hi, half) => (hi - lo) / 2 <= half ? (lo + hi) / 2 : clamp(t, lo + half, hi - half)
  const cx = hold(f.x(lon0, lat0), minx, maxx, W / 2 / k)
  const cy = hold(f.y(lat0, lon0), miny, maxy, H / 2 / k)
  const px = (lon, lat) => W / 2 + k * (f.x(lon, lat) - cx)
  const py = (lat, lon) => H / 2 - k * (f.y(lat, lon) - cy)
  const rim = new Path2D()
  edge.forEach(([X, Y], i) => rim[i ? 'lineTo' : 'moveTo'](W / 2 + k * (X - cx), H / 2 - k * (Y - cy)))
  rim.closePath()
  return { f, k, cx, cy, px, py, rim, W, H }
}

function paint(c, p, sources, scale = 1) {
  c.clearRect(0, 0, p.W, p.H)
  c.fillStyle = css('--sea')
  c.fill(p.rim)
  for (const layer of sources) {
    if (!layer.rings) continue
    c.setLineDash(layer.dash ? layer.dash.map((n) => n * scale) : [])
    limn(c, layer.rings, p.px, p.py, {
      color: css(layer.color),
      alpha: layer.alpha,
      width: layer.width * scale,
      lonCenter: p.f.lonCenter,
      visible: p.f.visible,
    })
  }
  c.setLineDash([])
  c.strokeStyle = css('--rim')
  c.lineWidth = 1
  c.stroke(p.rim)
}

// --- The main map ---

let P = null
let W = 0
let H = 0

function size() {
  const dpr = window.devicePixelRatio || 1
  W = canvas.clientWidth
  H = canvas.clientHeight
  canvas.width = Math.round(W * dpr)
  canvas.height = Math.round(H * dpr)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
}

// A cylinder held at its top or bottom edge cannot be centred any further
// north or south; move the centre to where the view actually is, so the
// next drag starts from there instead of from a latitude off-screen.
function settle() {
  view.lon = wrapLon(view.lon)
  view.lat = clamp(view.lat, -latMax(spec), latMax(spec))
  P = project(spec, view.lon, view.lat, view.zoom, W, H)
  if (Math.abs(P.cy - P.f.y(view.lat, view.lon)) > 1e-9) {
    let lo = -latMax(spec)
    let hi = latMax(spec)
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2
      if (P.f.y(mid, view.lon) < P.cy) lo = mid
      else hi = mid
    }
    view.lat = (lo + hi) / 2
  }
}

function draw() {
  if (!W || !H) return
  settle()
  paint(ctx, P, layers)
  const ns = view.lat > -0.05 ? 'N' : 'S'
  const ew = view.lon > -0.05 ? 'E' : 'W'
  whereEl.textContent = `${Math.abs(view.lat).toFixed(1)}°${ns} ${Math.abs(view.lon).toFixed(1)}°${ew} · ×${view.zoom.toFixed(1)}`
}

let queued = false
function schedule() {
  if (queued) return
  queued = true
  requestAnimationFrame(() => {
    queued = false
    draw()
    thumbsLater()
  })
}

// Pixels back to longitude and latitude. There is no inverse projection on
// this page: a coarse search over the forward one finds the neighbourhood
// and Newton's method, on finite differences, finishes the job.
function locate(x, y) {
  if (!ctx.isPointInPath(P.rim, x * (canvas.width / W), y * (canvas.height / H))) return null
  let best = null
  let bestD = Infinity
  const top = latMax(spec)
  for (let lat = -top; lat <= top; lat += 2) {
    for (let lon = -180; lon < 180; lon += 2) {
      if (P.f.visible && !P.f.visible(lon, lat)) continue
      const d = (P.px(lon, lat) - x) ** 2 + (P.py(lat, lon) - y) ** 2
      if (d < bestD) { bestD = d; best = [lon, lat] }
    }
  }
  if (!best) return null
  let [lon, lat] = best
  const h = 1e-3
  for (let i = 0; i < 8; i++) {
    const fx = P.px(lon, lat) - x
    const fy = P.py(lat, lon) - y
    if (fx * fx + fy * fy < 1e-4) break
    const a = (P.px(lon + h, lat) - P.px(lon - h, lat)) / (2 * h)
    const b = (P.px(lon, lat + h) - P.px(lon, lat - h)) / (2 * h)
    const c = (P.py(lat, lon + h) - P.py(lat, lon - h)) / (2 * h)
    const d = (P.py(lat + h, lon) - P.py(lat - h, lon)) / (2 * h)
    const det = a * d - b * c
    if (Math.abs(det) < 1e-12) break
    lon -= (d * fx - b * fy) / det
    lat = clamp(lat - (a * fy - c * fx) / det, -top, top)
  }
  return [wrapLon(lon), lat]
}

// Pan by a pixel offset, in the local frame at the centre where every
// north-up projection is honest. Over a pole, latitude comes down the far
// meridian and the rest of the gesture keeps its direction of travel --
// that is the flip `polarity` carries.
function pan(dx, dy, polarity = 1) {
  const h = 0.25
  const { lon, lat } = view
  let ex = (P.px(lon + h, lat) - P.px(lon - h, lat)) / (2 * h)
  const ey = (P.py(lat + h, lon) - P.py(lat - h, lon)) / (2 * h)
  if (Math.abs(ex) < 0.05 * P.k * D) ex = Math.sign(ex || 1) * 0.05 * P.k * D
  view.lon -= dx / ex
  if (Math.abs(ey) > 1e-9) view.lat -= (polarity * dy) / ey
  if (view.lat > 90 || view.lat < -90) {
    view.lat = (view.lat > 90 ? 180 : -180) - view.lat
    view.lon += 180
    polarity = -polarity
  }
  settle()
  return polarity
}

// Zoom keeping the point under (x, y) where it is.
function zoomAt(factor, x = W / 2, y = H / 2) {
  const before = locate(x, y)
  view.zoom = clamp(view.zoom * factor, 1, ZOOM_MAX)
  settle()
  if (!before) return schedule()
  for (let i = 0; i < 3; i++) {
    const ax = P.px(before[0], before[1])
    const ay = P.py(before[1], before[0])
    if (!Number.isFinite(ax) || Math.hypot(ax - x, ay - y) < 0.5) break
    pan(x - ax, y - ay)
  }
  schedule()
}

let flight = null
function flyTo(lon, lat) {
  cancelAnimationFrame(flight)
  const from = { lon: view.lon, lat: view.lat }
  const dLon = wrapLon(lon - from.lon)
  const t0 = performance.now()
  const step = (now) => {
    const t = Math.min(1, (now - t0) / 450)
    const e = 1 - (1 - t) ** 3
    view.lon = from.lon + dLon * e
    view.lat = from.lat + (lat - from.lat) * e
    draw()
    if (t < 1) flight = requestAnimationFrame(step)
    else thumbsLater()
  }
  flight = requestAnimationFrame(step)
}

// --- Pointer: drag pans, a tap recentres, two fingers pinch ---

const pointers = new Map()
let gesture = null

function local(event) {
  const r = canvas.getBoundingClientRect()
  return { x: event.clientX - r.left, y: event.clientY - r.top }
}

canvas.addEventListener('pointerdown', (event) => {
  canvas.setPointerCapture(event.pointerId)
  pointers.set(event.pointerId, local(event))
  cancelAnimationFrame(flight)
  if (pointers.size === 1) {
    const at = local(event)
    gesture = { start: at, last: at, moved: false, polarity: 1 }
  } else {
    gesture = { pinch: pinchState(), moved: true }
  }
})

function pinchState() {
  const [a, b] = [...pointers.values()]
  return { d: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

canvas.addEventListener('pointermove', (event) => {
  if (!pointers.has(event.pointerId) || !gesture) return
  const at = local(event)
  pointers.set(event.pointerId, at)
  if (gesture.pinch && pointers.size >= 2) {
    const now = pinchState()
    pan(now.x - gesture.pinch.x, now.y - gesture.pinch.y)
    zoomAt(now.d / gesture.pinch.d, now.x, now.y)
    gesture.pinch = now
    return
  }
  if (gesture.pinch) return
  if (!gesture.moved && Math.hypot(at.x - gesture.start.x, at.y - gesture.start.y) < 5) return
  gesture.moved = true
  canvas.classList.add('dragging')
  gesture.polarity = pan(at.x - gesture.last.x, at.y - gesture.last.y, gesture.polarity)
  gesture.last = at
  schedule()
})

function release(event) {
  if (!pointers.delete(event.pointerId)) return
  canvas.classList.remove('dragging')
  if (gesture && !gesture.moved && event.type === 'pointerup') {
    const spot = locate(gesture.start.x, gesture.start.y)
    if (spot) flyTo(...spot)
  }
  gesture = pointers.size ? { pinch: null, moved: true } : null
  thumbsLater()
}
canvas.addEventListener('pointerup', release)
canvas.addEventListener('pointercancel', release)

canvas.addEventListener('wheel', (event) => {
  event.preventDefault()
  const at = local(event)
  const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY
  zoomAt(Math.exp(-delta * 0.002), at.x, at.y)
}, { passive: false })

canvas.addEventListener('keydown', (event) => {
  const step = { ArrowLeft: [40, 0], ArrowRight: [-40, 0], ArrowUp: [0, 40], ArrowDown: [0, -40] }[event.key]
  if (step) {
    event.preventDefault()
    pan(...step)
    schedule()
  } else if (event.key === '+' || event.key === '=') {
    zoomAt(1.5)
  } else if (event.key === '-' || event.key === '_') {
    zoomAt(1 / 1.5)
  }
})

document.getElementById('zoom-in').addEventListener('click', () => zoomAt(1.6))
document.getElementById('zoom-out').addEventListener('click', () => zoomAt(1 / 1.6))
document.getElementById('reset').addEventListener('click', () => {
  view.zoom = home.zoom
  flyTo(home.lon, home.lat)
})

// --- The projection list: each entry previews itself at the current centre ---

const thumbCoast = { rings: null, color: '--coast', width: 0.6, alpha: 0.9 }
const thumbGrat = { rings: graticule(30), color: '--grat', width: 0.5, alpha: 0.8 }
const thumbs = []
const TW = 72
const TH = 44

for (const p of projections) {
  const label = document.createElement('label')
  const input = Object.assign(document.createElement('input'), { type: 'radio', name: 'projection', value: p.id, checked: p === spec })
  const thumb = document.createElement('canvas')
  const dpr = window.devicePixelRatio || 1
  thumb.width = TW * dpr
  thumb.height = TH * dpr
  thumb.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0)
  thumb.setAttribute('aria-hidden', 'true')
  label.append(input, thumb, Object.assign(document.createElement('span'), { textContent: p.name }))
  label.title = p.note
  list.append(label)
  thumbs.push({ p, thumb })
  input.addEventListener('change', () => {
    spec = p
    showMath()
    schedule()
  })
}

function drawThumbs() {
  for (const { p, thumb } of thumbs) {
    const lat = clamp(view.lat, -latMax(p), latMax(p))
    paint(thumb.getContext('2d'), project(p, view.lon, lat, 1, TW, TH), [thumbGrat, thumbCoast], 1)
  }
}

let thumbTimer = 0
function thumbsLater() {
  clearTimeout(thumbTimer)
  thumbTimer = setTimeout(drawThumbs, 120)
}

// --- Layers ---

async function load(layer) {
  if (layer.rings || layer.loading) return layer.loading
  if (layer.id === 'graticule') {
    layer.rings = graticule(15)
    return
  }
  layer.loading = fetch(`./${layer.file}`)
    .then((r) => {
      if (!r.ok) throw new Error(`${r.status} ${r.statusText}`)
      return r.json()
    })
    .then((json) => { if (layer.on) layer.rings = geojsonRings(json) })
    .finally(() => { layer.loading = null })
  return layer.loading
}

for (const layer of [...layers].reverse()) {
  const label = document.createElement('label')
  const input = Object.assign(document.createElement('input'), { type: 'checkbox', checked: Boolean(layer.on) })
  const swatch = Object.assign(document.createElement('span'), { className: layer.dash ? 'swatch dash' : 'swatch' })
  swatch.style.setProperty('--c', `var(${layer.color})`)
  label.append(input, swatch, layer.name)
  layerList.append(label)
  layer.toggle = input
  input.addEventListener('change', async () => {
    layer.on = input.checked
    if (!layer.on) {
      layer.hidden = layer.rings
      layer.rings = null
      return schedule()
    }
    if (layer.hidden) {
      layer.rings = layer.hidden
      return schedule()
    }
    try {
      await load(layer)
    } catch {
      input.checked = layer.on = false
    }
    schedule()
  })
}

// --- The arithmetic, shown verbatim ---

function dedent(source) {
  const lines = source.split('\n')
  const indents = lines.slice(1).filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length)
  const cut = Math.min(...indents)
  return [lines[0], ...lines.slice(1).map((l) => l.slice(cut))].join('\n')
}

function showMath() {
  mathEl.textContent = `// ${spec.name}\n${dedent(spec.make.toString())}`
}

// --- Start ---

new ResizeObserver(() => {
  size()
  schedule()
}).observe(canvas)
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  schedule()
  drawThumbs()
})

showMath()
size()
const coast = layers.find((l) => l.id === 'coast')
await Promise.allSettled(layers.filter((l) => l.on).map(load))
if (coast.on && !coast.rings) {
  whereEl.textContent = "Couldn't load the coastline. Reload to try again."
  throw new Error('ne_50m_coastline.geojson failed to load')
}
thumbCoast.rings = coast.rings.map((ring) => ring.filter((_, i) => i % 6 === 0 || i === ring.length - 1))
draw()
drawThumbs()

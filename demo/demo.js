// The page is a normal customer of the library: one limn() call draws every
// projection in the menu, and the only thing that changes when the menu does
// is the arithmetic handed to it. scripts/build-demo.mjs assembles ./lib and
// the coastline next to this file; nothing here is special-cased per map.
import { rings, limn } from './lib/index.js'
import { projections, frame } from './projections.js'

const canvas = document.getElementById('map')
const ctx = canvas.getContext('2d')
const menu = document.getElementById('projection')
const noteEl = document.getElementById('note')
const mathEl = document.getElementById('math')
const whereEl = document.getElementById('where')

let coast
try {
  const response = await fetch('./coastline-50m.json')
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
  coast = rings(await response.json())
} catch {
  canvas.replaceWith(
    Object.assign(document.createElement('p'), {
      className: 'foot',
      textContent: "Couldn't load the coastline. Reload to try again.",
    })
  )
  throw new Error('coastline-50m.json failed to load')
}

// The boat starts near Fiji: the first paint already straddles the
// antimeridian, which is the seam most maps cannot survive.
const boat = { lon: 178.4, lat: -17.8 }
let spec = projections.find((p) => p.id === 'mercator')

for (const p of projections) {
  menu.append(Object.assign(document.createElement('option'), { value: p.id, textContent: p.name }))
}
menu.value = spec.id

const wrapLon = (lon) => (lon > 180 ? lon - 360 : lon < -180 ? lon + 360 : lon)

// Boat drag works in the local frame at the centre, where every north-up
// projection is honest: finite differences of the real x/y say how many
// pixels a degree is worth right here, so there is no inverse projection
// anywhere on this page.
function nudge(dxPx, dyPx, polarity) {
  const h = 0.25
  const ex = (px(boat.lon + h, boat.lat) - px(boat.lon - h, boat.lat)) / (2 * h)
  const ey = (py(boat.lat + h, boat.lon) - py(boat.lat - h, boat.lon)) / (2 * h)
  if (Math.abs(ex) > 1e-9) boat.lon = wrapLon(boat.lon + dxPx / ex)
  if (Math.abs(ey) > 1e-9) boat.lat += (polarity * dyPx) / ey
  if (spec.fitLat) {
    boat.lat = Math.max(-spec.fitLat, Math.min(spec.fitLat, boat.lat))
  }
  // Over the top: latitude past a pole comes down the far meridian, and the
  // rest of the gesture keeps its direction of travel -- that is the flip
  // the caller's polarity carries.
  if (boat.lat > 90 || boat.lat < -90) {
    boat.lat = (boat.lat > 90 ? 180 : -180) - boat.lat
    boat.lon = wrapLon(boat.lon + 180)
    return -polarity
  }
  return polarity
}

// Pixel transform: frame() gives map units with north up; fit is sampled
// once per projection (and resize) because every bound here is independent
// of where the boat is -- the discs are discs and the cylinders are centred
// before projecting -- and a fit that breathed during a drag would look
// broken even while being right.
let fit = null
let px, py, seam

function refit() {
  const cssWidth = canvas.parentElement.clientWidth
  const f = frame(spec, boat.lon, boat.lat)
  let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity
  const latMax = spec.fitLat ?? 90
  for (let lon = -180; lon <= 180; lon += 4) {
    for (let lat = -latMax; lat <= latMax; lat += 3) {
      if (f.visible && !f.visible(lon, lat)) continue
      const X = f.x(lon, lat)
      const Y = f.y(lat, lon)
      if (X < minx) minx = X
      if (X > maxx) maxx = X
      if (Y < miny) miny = Y
      if (Y > maxy) maxy = Y
    }
  }
  const bw = maxx - minx
  const bh = maxy - miny
  const cssHeight = Math.min(cssWidth * (bh / bw), window.innerHeight * 0.72)
  const s = Math.min((cssWidth * 0.96) / bw, (cssHeight * 0.96) / bh)
  fit = { cssWidth, cssHeight, s, cx: (minx + maxx) / 2, cy: (miny + maxy) / 2 }
  const dpr = window.devicePixelRatio || 1
  canvas.width = Math.round(cssWidth * dpr)
  canvas.height = Math.round(cssHeight * dpr)
  canvas.style.height = `${cssHeight}px`
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
}

function reframe() {
  const f = frame(spec, boat.lon, boat.lat)
  px = (lon, lat) => fit.cssWidth / 2 + fit.s * (f.x(lon, lat) - fit.cx)
  py = (lat, lon) => fit.cssHeight / 2 - fit.s * (f.y(lat, lon) - fit.cy)
  seam = { lonCenter: f.lonCenter, visible: f.visible }
}

const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()

function draw() {
  ctx.clearRect(0, 0, fit.cssWidth, fit.cssHeight)

  // The whole demo is this one call. Only the arithmetic behind px/py/seam
  // changed when the menu did.
  limn(ctx, coast, px, py, {
    color: css('--line'),
    alpha: 0.9,
    width: 1,
    lonCenter: seam.lonCenter,
    visible: seam.visible,
  })

  const bx = px(boat.lon, boat.lat)
  const by = py(boat.lat, boat.lon)
  ctx.save()
  ctx.strokeStyle = css('--mark')
  ctx.globalAlpha = 0.9
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(bx, by, 14, 0, 2 * Math.PI)
  ctx.stroke()
  ctx.font = '18px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('⛵', bx, by - 1)
  ctx.restore()

  const ns = boat.lat >= 0 ? 'N' : 'S'
  const ew = boat.lon >= 0 ? 'E' : 'W'
  whereEl.textContent = `⛵ ${Math.abs(boat.lat).toFixed(1)}°${ns} ${Math.abs(boat.lon).toFixed(1)}°${ew}`
}

let queued = false
function schedule() {
  if (queued) return
  queued = true
  requestAnimationFrame(() => {
    queued = false
    reframe()
    draw()
  })
}

function dedent(source) {
  const lines = source.split('\n')
  const indents = lines.slice(1).filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length)
  const cut = Math.min(...indents)
  return [lines[0], ...lines.slice(1).map((l) => l.slice(cut))].join('\n')
}

function showMath() {
  noteEl.textContent = `${spec.family} — ${spec.note}`
  mathEl.textContent = dedent(spec.make.toString())
}

menu.addEventListener('change', () => {
  spec = projections.find((p) => p.id === menu.value)
  if (spec.fitLat) boat.lat = Math.max(-spec.fitLat, Math.min(spec.fitLat, boat.lat))
  showMath()
  refit()
  schedule()
})

// Only the boat drags; there is deliberately no pan and no zoom, so grabbing
// it is forgiving instead of precise.
let dragging = null
canvas.addEventListener('pointerdown', (event) => {
  const rect = canvas.getBoundingClientRect()
  const dx = event.clientX - rect.left - px(boat.lon, boat.lat)
  const dy = event.clientY - rect.top - py(boat.lat, boat.lon)
  if (Math.hypot(dx, dy) > 36) return
  dragging = { x: event.clientX, y: event.clientY, polarity: 1 }
  canvas.setPointerCapture(event.pointerId)
  canvas.style.cursor = 'grabbing'
})
canvas.addEventListener('pointermove', (event) => {
  if (!dragging) return
  dragging.polarity = nudge(event.clientX - dragging.x, event.clientY - dragging.y, dragging.polarity)
  dragging.x = event.clientX
  dragging.y = event.clientY
  schedule()
})
for (const done of ['pointerup', 'pointercancel']) {
  canvas.addEventListener(done, () => {
    dragging = null
    canvas.style.cursor = ''
  })
}

canvas.setAttribute('tabindex', '0')
canvas.addEventListener('keydown', (event) => {
  const step = { ArrowLeft: [-12, 0], ArrowRight: [12, 0], ArrowUp: [0, -12], ArrowDown: [0, 12] }[event.key]
  if (!step) return
  event.preventDefault()
  nudge(step[0], step[1], 1)
  schedule()
})

window.addEventListener('resize', () => {
  refit()
  schedule()
})
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', schedule)

showMath()
refit()
reframe()
draw()

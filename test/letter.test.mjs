import { test } from 'node:test'
import assert from 'node:assert/strict'
import { place, letter } from '../lib/index.js'

/** Enough of a 2D context to measure and record text: 0.6em per character. */
function textContext() {
  const drawn = []
  const fonts = []
  const ctx = {
    drawn,
    fonts,
    font: '',
    save() {},
    restore() {},
    translate() {},
    rotate() {},
    measureText(text) {
      fonts.push(ctx.font)
      const px = Number(/(\d+(?:\.\d+)?)px/.exec(ctx.font)[1])
      return { width: text.length * px * 0.6 }
    },
    fillText(text) {
      drawn.push(text)
    },
  }
  return ctx
}
// Plate carrée, ten pixels a degree, screen y running down.
const x = (lon) => lon * 10
const y = (lat) => -lat * 10

const ys = (box) => box.map(([, py]) => py)
const xs = (box) => box.map(([px]) => px)
const near = (a, b) => Math.abs(a - b) < 1e-9

test('a coast with the land to the north reads level, standing on the shore', () => {
  const [name] = place(textContext(), [{ text: 'Cádiz', at: [[0, 0], [10, 0]] }], x, y)
  assert.ok(near(name.angle, 0))
  assert.ok(ys(name.box).every((py) => py < name.y), 'the name is on the land, above the coast')
})

test('a coast with the land to the south is never upside down: it hangs on the land', () => {
  const [name] = place(textContext(), [{ text: 'Tanger', at: [[10, 0], [0, 0]] }], x, y)
  assert.ok(near(Math.cos(name.angle), 1), 'level, not turned over')
  assert.ok(ys(name.box).every((py) => py > name.y), 'the name is on the land, below the coast')
})

test('with upright off, the same name reads from the sea, upside down on screen', () => {
  const [name] = place(textContext(), [{ text: 'Tanger', at: [[10, 0], [0, 0]] }], x, y, {
    upright: false,
  })
  assert.ok(near(Math.cos(name.angle), -1))
  assert.ok(ys(name.box).every((py) => py > name.y), 'still on the land')
})

test('a coast running north with the land to the west reads up the page, from the sea', () => {
  const [name] = place(textContext(), [{ text: 'Lisboa', at: [[0, 0], [0, 10]] }], x, y)
  assert.ok(near(name.angle, -Math.PI / 2), 'reads bottom to top, as from the east')
  assert.ok(xs(name.box).every((px) => px < name.x), 'the name is on the land, west of the coast')
})

test('land on the right puts the name on the other side', () => {
  const [name] = place(textContext(), [{ text: 'Lisboa', at: [[0, 0], [0, 10]], land: 'right' }], x, y)
  assert.ok(xs(name.box).every((px) => px > name.x))
})

test('an island ring as Natural Earth winds it keeps its name on the island', () => {
  // Anticlockwise, land on the left; the middle of the ring is the north shore.
  const island = [[5, 0], [10, 0], [10, 10], [0, 10], [0, 0], [5, 0]]
  const [name] = place(textContext(), [{ text: 'Sal', at: island }], x, y)
  for (const [px, py] of name.box) {
    assert.ok(px > x(0) && px < x(10) && py > y(10) && py < y(0), `${px},${py} is inside`)
  }
})

test('a point name sits level above its point', () => {
  const [name] = place(textContext(), [{ text: 'Malta', at: { type: 'Point', coordinates: [14, 36] } }], x, y)
  assert.equal(name.x, 140)
  assert.equal(name.angle, 0)
  assert.ok(ys(name.box).every((py) => py < name.y))
})

test('names that would overlap are dropped, the earlier one kept', () => {
  const names = [
    { text: 'Genova', at: [8.9, 44.4] },
    { text: 'Genoa', at: [9, 44.4] },
    { text: 'Napoli', at: [14.3, 40.8] },
  ]
  const placed = place(textContext(), names, x, y)
  assert.deepEqual(
    placed.map((n) => n.text),
    ['Genova', 'Napoli'],
  )
})

test('names turned along a coast collide by their turned boxes, not their level ones', () => {
  // Two names up a north-running coast, one above the other: level boxes
  // 60px wide would overlap, but turned they are tall and thin and clear.
  const coast = (lat) => ({ text: 'Porto', at: [[0, lat], [0, lat + 1]] })
  const placed = place(textContext(), [coast(0), coast(5)], x, y)
  assert.equal(placed.length, 2)
})

test('the caller names the fonts: one family or several, quoted where needed', () => {
  const ctx = textContext()
  place(
    ctx,
    [
      { text: 'Venezia', at: [12, 45] },
      { text: 'Ragusa', at: [18, 42], fonts: 'IM Fell English' },
    ],
    x,
    y,
    { fonts: ['Cinzel Decorative', 'Georgia', 'serif'], size: 14, style: 'italic' },
  )
  assert.equal(ctx.fonts[0], 'italic 14px "Cinzel Decorative", "Georgia", serif')
  assert.equal(ctx.fonts[1], 'italic 14px "IM Fell English"')
})

test('a coast across the seam is lettered on its longer side; a hidden one not at all', () => {
  const across = [[170, 0], [175, 0], [179, 0], [-179, 0]]
  const [name] = place(textContext(), [{ text: 'Fiji', at: across }], x, y)
  assert.ok(name.x > x(170) && name.x < x(179))
  const hidden = place(textContext(), [{ text: 'Fiji', at: across }], x, y, { visible: () => false })
  assert.equal(hidden.length, 0)
})

test('letter draws exactly the names that fit', () => {
  const ctx = textContext()
  const placed = letter(ctx, [
    { text: 'Genova', at: [8.9, 44.4] },
    { text: 'Genoa', at: [9, 44.4] },
  ], x, y, { color: '#5a3' })
  assert.deepEqual(ctx.drawn, ['Genova'])
  assert.equal(placed.length, 1)
})

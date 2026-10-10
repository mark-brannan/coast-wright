import { test } from 'node:test'
import assert from 'node:assert/strict'
import { geojsonRings } from '../lib/index.js'

const a = [[-10, 50], [-9, 51]]
const b = [[170, -40], [175, -41], [170, -40]]
const c = [[0, 0], [1, 0], [1, 1], [0, 0]]

test('every line-bearing geometry flattens to its rings, in source order', () => {
  const doc = {
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', geometry: { type: 'LineString', coordinates: a } },
      { type: 'Feature', geometry: { type: 'MultiLineString', coordinates: [a, b] } },
      { type: 'Feature', geometry: { type: 'Polygon', coordinates: [b, c] } },
      { type: 'Feature', geometry: { type: 'MultiPolygon', coordinates: [[b], [c]] } },
      { type: 'Feature', geometry: { type: 'Point', coordinates: [5, 5] } },
      { type: 'Feature', geometry: null },
      {
        type: 'Feature',
        geometry: {
          type: 'GeometryCollection',
          geometries: [{ type: 'LineString', coordinates: c }],
        },
      },
    ],
  }
  assert.deepEqual(geojsonRings(doc), [a, a, b, b, c, b, c, c])
})

test('a bare Feature or geometry is read the same as a collection of one', () => {
  const geometry = { type: 'LineString', coordinates: a }
  assert.deepEqual(geojsonRings(geometry), [a])
  assert.deepEqual(geojsonRings({ type: 'Feature', geometry }), [a])
})

test('rings are collected once per document and the result reused', () => {
  const doc = { type: 'LineString', coordinates: a }
  assert.equal(geojsonRings(doc), geojsonRings(doc))
})

test('input that is not GeoJSON is refused by name, not by a stray TypeError', () => {
  for (const bad of [null, undefined, 'coastline', 42, {}, { type: 'FeatureCollection' }]) {
    assert.throws(() => geojsonRings(bad), /GeoJSON|features/)
  }
})

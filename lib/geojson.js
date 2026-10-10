// GeoJSON in, rings out. Natural Earth publishes GeoJSON, and its coordinates
// are already [lon, lat] -- the same rings `limn` strokes -- so drawing it
// needs no decoder, only a walk that flattens every geometry to its lines.

const cache = new WeakMap()

/**
 * Every line chain and polygon ring of a GeoJSON document as [lon, lat]
 * pairs, in source order. Points are skipped: there is nothing to stroke.
 *
 * Kept per document, like `rings`: a map redraws on every resize, and a
 * full-detail coastline is tens of thousands of points.
 */
export function geojsonRings(geojson) {
  const hit = cache.get(geojson)
  if (hit) return hit
  const out = []
  const visit = (geometry) => {
    if (!geometry) return
    switch (geometry.type) {
      case 'LineString':
        out.push(geometry.coordinates)
        break
      case 'MultiLineString':
      case 'Polygon':
        // A loop, not a spread: a spread's argument count has a ceiling,
        // and a full-detail layer can pass it.
        for (const ring of geometry.coordinates) out.push(ring)
        break
      case 'MultiPolygon':
        for (const polygon of geometry.coordinates) {
          for (const ring of polygon) out.push(ring)
        }
        break
      case 'GeometryCollection':
        geometry.geometries.forEach(visit)
        break
    }
  }
  if (geojson.type === 'FeatureCollection') {
    for (const feature of geojson.features) visit(feature.geometry)
  } else if (geojson.type === 'Feature') {
    visit(geojson.geometry)
  } else {
    visit(geojson)
  }
  cache.set(geojson, out)
  return out
}

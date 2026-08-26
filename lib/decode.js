// The portolano decoder. Nine lines of actual work; the rest is the contract.
// Spec: https://github.com/mark-brannan/portolani/blob/main/docs/portolano-format.md

/**
 * One encoded ring to [lon, lat] degrees. `precision` comes from the
 * document's `encoding.precision` -- do not hard-code it, profiles differ.
 */
export function decodeRing(encoded, precision) {
  const scale = Math.pow(10, precision)
  const points = []
  let index = 0
  let lon = 0
  let lat = 0
  while (index < encoded.length) {
    let shift = 0
    let bits = 0
    let byte
    do {
      byte = encoded.charCodeAt(index++) - 63
      bits |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)
    lon += bits & 1 ? ~(bits >> 1) : bits >> 1
    shift = 0
    bits = 0
    do {
      byte = encoded.charCodeAt(index++) - 63
      bits |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)
    lat += bits & 1 ? ~(bits >> 1) : bits >> 1
    points.push([lon / scale, lat / scale])
  }
  return points
}

const cache = new WeakMap()

/**
 * Every ring of a portolano as [lon, lat] pairs, flattened across polygons.
 * This is what you stroke.
 *
 * Decoded once per document and kept: it is the same few thousand points on
 * every redraw, and a map redraws on every resize.
 */
export function rings(portolano) {
  const hit = cache.get(portolano)
  if (hit) return hit
  assertReadable(portolano)
  const { precision } = portolano.encoding
  const encoded =
    portolano.kind === 'polygons' ? portolano.geometry.flat() : portolano.geometry
  const decoded = encoded.map((ring) => decodeRing(ring, precision))
  cache.set(portolano, decoded)
  return decoded
}

/**
 * A polygons portolano as [outerRing, ...holes] per shape. This is what you
 * fill; ring order carries the holes, so fill with the even-odd rule rather
 * than inferring anything from winding, which the format does not specify.
 */
export function polygons(portolano) {
  assertReadable(portolano)
  if (portolano.kind !== 'polygons') {
    throw new Error(`polygons() needs a "polygons" portolano, got "${portolano.kind}"`)
  }
  const { precision } = portolano.encoding
  return portolano.geometry.map((shape) => shape.map((ring) => decodeRing(ring, precision)))
}

function assertReadable(portolano) {
  if (!portolano || portolano.format !== 'portolano/1') {
    throw new Error(`not a portolano/1 document: ${JSON.stringify(portolano?.format)}`)
  }
  if (portolano.encoding?.order !== 'lon,lat') {
    throw new Error(`unsupported coordinate order ${JSON.stringify(portolano.encoding?.order)}`)
  }
}

// The rhumb line: the course a ship holds on one compass bearing, which is
// what a portolan chart's lattice draws. It is a straight line only on
// Mercator; here it is points in [lon, lat], so `limn` draws it through any
// projection, the seam guard included.

const RAD = Math.PI / 180
const LIMIT = 85 // degrees of latitude; a rhumb line spirals into the pole and never arrives

/**
 * A rhumb line from `[lon, lat]` on `bearing` (degrees clockwise from
 * north), `length` degrees of arc long, as `steps + 1` points. Stops at
 * ±85° latitude, where it would otherwise wind round the pole for ever.
 * Longitudes are wrapped to ±180, so the seam guard sees an honest jump.
 */
export function rhumb([lon, lat], bearing, length, steps = 64) {
  const theta = bearing * RAD
  const psi0 = mercator(lat)
  const points = [[lon, lat]]
  for (let i = 1; i <= steps; i++) {
    const d = (length * RAD * i) / steps
    const phi = lat * RAD + d * Math.cos(theta)
    if (Math.abs(phi) > LIMIT * RAD) break
    const dPsi = mercator(phi / RAD) - psi0
    // East-west, the stretch factor is cos(lat); elsewhere it is dPhi / dPsi.
    const q = Math.abs(dPsi) > 1e-12 ? (phi - lat * RAD) / dPsi : Math.cos(lat * RAD)
    const lambda = lon * RAD + (d * Math.sin(theta)) / q
    points.push([wrap(lambda / RAD), phi / RAD])
  }
  return points
}

const mercator = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * RAD) / 2))
const wrap = (lon) => ((((lon + 180) % 360) + 360) % 360) - 180

// The menu. Every entry is two functions and sometimes a predicate; none of
// them get drawing code of their own. The page shows `make` verbatim, so each
// body is written to be read -- textbook symbols, one formula per line.
//
// The contract with the page (not with coast-wright, which sees none of this):
// `make(φ0)` closes over the centre latitude and returns `{ X, Y, visible }`
// working in radians, with λ already measured from the centre longitude and
// wrapped to ±π. X grows east, Y grows north; the page fits the result to the
// canvas. `visible` is where a projection admits what it cannot draw --
// orthographic hides the far hemisphere, azimuthal equidistant masks the
// antipode its arithmetic blows up on. That predicate, passed through to
// `limn`, is the API this demo exists to force; the wrap seam it does not
// replace is limn's own.

const { sin, cos, tan, atan, asin, acos, log, abs, PI } = Math

// The three that forced the interface, first.

export const hard = [
  {
    id: 'orthographic',
    name: 'Orthographic',
    family: 'azimuthal',
    note: 'The globe from far away. Half the world is behind it.',
    make(φ0) {
      const X = (λ, φ) => cos(φ) * sin(λ)
      const Y = (λ, φ) => cos(φ0) * sin(φ) - sin(φ0) * cos(φ) * cos(λ)
      // Behind the globe: the far hemisphere projects onto the same disc
      // as the near one, so it must not be drawn at all.
      const visible = (λ, φ) => sin(φ0) * sin(φ) + cos(φ0) * cos(φ) * cos(λ) > 0
      return { X, Y, visible }
    },
  },
  {
    id: 'azimuthal-equidistant',
    name: 'Azimuthal equidistant',
    family: 'azimuthal',
    note: 'Distance and bearing from the centre are true. The whole world, except the one point behind you.',
    make(φ0) {
      // c is angular distance from the centre; every direction preserves it.
      const c = (λ, φ) => acos(sin(φ0) * sin(φ) + cos(φ0) * cos(φ) * cos(λ))
      const k = (λ, φ) => (c(λ, φ) < 1e-9 ? 1 : c(λ, φ) / sin(c(λ, φ)))
      const X = (λ, φ) => k(λ, φ) * cos(φ) * sin(λ)
      const Y = (λ, φ) => k(λ, φ) * (cos(φ0) * sin(φ) - sin(φ0) * cos(φ) * cos(λ))
      // The antipode maps to the whole rim at once -- k → ∞ -- and coastline
      // near it smears around the edge. Mask a small cap rather than draw it.
      const visible = (λ, φ) => c(λ, φ) < PI - 0.2
      return { X, Y, visible }
    },
  },
  {
    id: 'mollweide',
    name: 'Mollweide',
    family: 'pseudocylindrical',
    note: 'Equal-area oval. θ has no closed form; Newton finds it in a few steps.',
    make() {
      const θ = (φ) => {
        if (abs(φ) > PI / 2 - 1e-9) return φ
        let t = φ
        for (let i = 0; i < 8; i++) {
          t -= (2 * t + sin(2 * t) - PI * sin(φ)) / (2 + 2 * cos(2 * t))
        }
        return t
      }
      const X = (λ, φ) => ((2 * Math.SQRT2) / PI) * λ * cos(θ(φ))
      const Y = (λ, φ) => Math.SQRT2 * sin(θ(φ))
      return { X, Y }
    },
  },
]

// The cylindricals: longitude and latitude project independently, which is
// why they all worked before limn learnt to pass both coordinates. The
// equal-area trio differ only in one number -- the standard parallel.

const cylindricals = [
  {
    id: 'plate-carree',
    name: 'Plate carrée',
    family: 'cylindrical',
    note: 'Longitude across, latitude up, nothing else. The oldest projection still in daily use.',
    make() {
      const X = (λ, φ) => λ
      const Y = (λ, φ) => φ
      return { X, Y }
    },
  },
  {
    id: 'mercator',
    name: 'Mercator',
    family: 'cylindrical',
    note: 'A straight line is a constant compass course. The price: y → ∞ at the poles, so no chart can reach one.',
    fitLat: 85,
    make() {
      const X = (λ, φ) => λ
      const Y = (λ, φ) => log(tan(PI / 4 + φ / 2))
      return { X, Y }
    },
  },
  {
    id: 'miller',
    name: 'Miller',
    family: 'cylindrical',
    note: 'Mercator with the latitude scaled back so the poles fit on the page.',
    make() {
      const X = (λ, φ) => λ
      const Y = (λ, φ) => 1.25 * log(tan(PI / 4 + 0.4 * φ))
      return { X, Y }
    },
  },
  {
    id: 'braun',
    name: 'Braun stereographic',
    family: 'cylindrical',
    note: 'Projected from the equator onto a tangent cylinder.',
    make() {
      const X = (λ, φ) => λ
      const Y = (λ, φ) => 2 * tan(φ / 2)
      return { X, Y }
    },
  },
  {
    id: 'lambert-equal-area',
    name: 'Lambert cylindrical equal-area',
    family: 'cylindrical',
    note: 'Every square kilometre gets equal paper. Standard parallel: the equator.',
    make() {
      const φs = 0
      const X = (λ, φ) => λ * cos(φs)
      const Y = (λ, φ) => sin(φ) / cos(φs)
      return { X, Y }
    },
  },
  {
    id: 'behrmann',
    name: 'Behrmann',
    family: 'cylindrical',
    note: 'Lambert with the standard parallel moved to 30°. Same arithmetic, one number changed.',
    make() {
      const φs = PI / 6
      const X = (λ, φ) => λ * cos(φs)
      const Y = (λ, φ) => sin(φ) / cos(φs)
      return { X, Y }
    },
  },
  {
    id: 'gall-peters',
    name: 'Gall–Peters',
    family: 'cylindrical',
    note: 'The same again at 45°, famous mostly for the argument about it.',
    make() {
      const φs = PI / 4
      const X = (λ, φ) => λ * cos(φs)
      const Y = (λ, φ) => sin(φ) / cos(φs)
      return { X, Y }
    },
  },
]

const pseudocylindricals = [
  {
    id: 'sinusoidal',
    name: 'Sinusoidal',
    family: 'pseudocylindrical',
    note: 'Equal-area, and the parallels keep their true length.',
    make() {
      const X = (λ, φ) => λ * cos(φ)
      const Y = (λ, φ) => φ
      return { X, Y }
    },
  },
  {
    id: 'winkel-tripel',
    name: 'Winkel tripel',
    family: 'pseudocylindrical',
    note: 'The average of two projections. National Geographic’s pick for the world since 1998.',
    make() {
      const φ1 = acos(2 / PI)
      const sinc = (t) => (t < 1e-9 ? 1 : sin(t) / t)
      const α = (λ, φ) => acos(cos(φ) * cos(λ / 2))
      const X = (λ, φ) => (λ * cos(φ1) + (2 * cos(φ) * sin(λ / 2)) / sinc(α(λ, φ))) / 2
      const Y = (λ, φ) => (φ + sin(φ) / sinc(α(λ, φ))) / 2
      return { X, Y }
    },
  },
  {
    id: 'kavrayskiy',
    name: 'Kavrayskiy VII',
    family: 'pseudocylindrical',
    note: 'A compromise the Soviets liked and the West rediscovered.',
    make() {
      const X = (λ, φ) => ((3 * λ) / 2) * Math.sqrt(1 / 3 - (φ / PI) ** 2)
      const Y = (λ, φ) => φ
      return { X, Y }
    },
  },
]

const azimuthals = [
  {
    id: 'stereographic',
    name: 'Stereographic',
    family: 'azimuthal',
    note: 'Projected from the far side of the sphere; angles survive. The far hemisphere flies off the page, so it is cut at 120° out.',
    make(φ0) {
      const k = (λ, φ) => 2 / (1 + sin(φ0) * sin(φ) + cos(φ0) * cos(φ) * cos(λ))
      const X = (λ, φ) => k(λ, φ) * cos(φ) * sin(λ)
      const Y = (λ, φ) => k(λ, φ) * (cos(φ0) * sin(φ) - sin(φ0) * cos(φ) * cos(λ))
      const visible = (λ, φ) => sin(φ0) * sin(φ) + cos(φ0) * cos(φ) * cos(λ) > cos((2 * PI) / 3)
      return { X, Y, visible }
    },
  },
]

const [orthographic, azimuthalEquidistant, mollweide] = hard

export const projections = [
  ...cylindricals,
  ...pseudocylindricals,
  mollweide,
  orthographic,
  azimuthalEquidistant,
  ...azimuthals,
]

const D = Math.PI / 180
const wrapped = (d) => (d > 180 ? d - 360 : d < -180 ? d + 360 : d)

/**
 * A projection centred on (lon0, lat0), shaped for `limn`: degrees in,
 * map units out, Y growing north. The page scales the result to pixels;
 * tests use it as is.
 */
export function frame(spec, lon0, lat0) {
  const { X, Y, visible } = spec.make(lat0 * D)
  return {
    x: (lon, lat) => X(wrapped(lon - lon0) * D, lat * D),
    y: (lat, lon) => Y(wrapped(lon - lon0) * D, lat * D),
    visible: visible && ((lon, lat) => visible(wrapped(lon - lon0) * D, lat * D)),
    lonCenter: lon0,
  }
}

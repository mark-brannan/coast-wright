// Drawing. Projection-agnostic and seam-aware, which between them are the
// whole reason this is a library rather than a for-loop you write inline.

import { runs, pen } from './hand.js';
import { projection, options as given, CENTRAL_MERIDIAN } from './compat.js';

/**
 * Draws rings through a map's own projection.
 *
 * `project([lon, lat])` is the caller's projection, returning `[px, py]`, so
 * this makes no assumption about the window, the centre, or the scale -- one
 * caller may be drawing a band around a vessel and another the whole planet,
 * and neither has to tell this function which. It is d3-geo's shape: a d3
 * projection is a valid argument as it stands.
 *
 * The old pair of callbacks, `x(lon, lat)` and `y(lat, lon)`, in place of
 * `project`, still works and is deprecated.
 *
 * Two different rules lift the pen, and neither replaces the other:
 *
 * Segments spanning more than half the world are dropped rather than drawn. A
 * ring crossing the antimeridian holds two points a tenth of a degree apart on
 * the ground and 360 apart in the numbers; so does a ring passing behind a
 * window centred anywhere but Greenwich. Either one, joined, lays a line
 * across the entire map -- so the seam is tested against `centralMeridian`, the
 * longitude the caller's own projection measures from. For a projection that
 * does not wrap, the rule's only false positives are near-antipodal jumps
 * whose endpoints project close together anyway; the cost is a sub-pixel gap,
 * where the cost of drawing a wrapped segment is a line across the map.
 *
 * `visible` is for the projections whose seam is not a wrap at all: it is
 * asked before each point, and a point it refuses is neither drawn nor even
 * projected -- the pen lifts, and the ring resumes at the next visible point.
 * Orthographic hides the far hemisphere, which otherwise lands mirrored
 * inside the same disc; azimuthal equidistant masks a cap around the
 * antipode, where its arithmetic divides by zero and the coastline smears
 * around the rim. Both are a round cap about the centre, and `withinCap` builds
 * that predicate: `withinCap([lon, lat], 90)` for the globe's near side,
 * `withinCap([lon, lat], 179)` or so for the azimuthal chart. Not projecting refused
 * points is part of the contract:
 * inside the mask is exactly where `project` cannot be trusted to return
 * numbers.
 *
 * Each ring is its own path unless `oneStroke` is set, when all of them are one:
 * a translucent ink then lays down once where rings overlap or meet, instead
 * of darkening at every join -- what a wash or a pieced-together coast wants.
 *
 * `rings` may also be an async iterable of rings, for a provider that hands
 * them over piece by piece as cells are read or fetched. Each ring is drawn as
 * it arrives, by the same per-ring path as an array's, and the call returns a
 * promise that resolves when the iterable ends. Arrays and other sync
 * iterables are drawn in this call and nothing is returned, as always.
 */
export function limn(ctx, rings, a, b, c) {
  const [project, options] = projection(a, b, c);
  const {
    color,
    alpha = 0.45,
    width = 1,
    lineCap,
    oneStroke = false,
    centralMeridian = 0,
    visible,
  } = given(options, { ...CENTRAL_MERIDIAN, cap: 'lineCap' });
  ctx.save();
  if (color) ctx.strokeStyle = color;
  ctx.globalAlpha = alpha;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  if (lineCap) ctx.lineCap = lineCap;
  if (oneStroke) ctx.beginPath();
  const draw = (ring) => {
    if (!oneStroke) ctx.beginPath();
    pen(ctx, runs([ring], project, { centralMeridian, visible }));
    if (!oneStroke) ctx.stroke();
  };
  const finish = () => {
    if (oneStroke) ctx.stroke();
    ctx.restore();
  };
  if (rings != null && typeof rings[Symbol.asyncIterator] === 'function') {
    return (async () => {
      try {
        for await (const ring of rings) draw(ring);
      } finally {
        finish();
      }
    })();
  }
  for (const ring of rings) draw(ring);
  finish();
}

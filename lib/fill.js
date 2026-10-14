// Filling. `limn` strokes lines, where a seam only has to lift the pen; a fill
// cannot lift a pen, because a ring cut open no longer encloses anything. So
// a ring that crosses the seam is cut along it and each piece closed on its
// own side, and the map sees two shapes meeting at its edge instead of one
// shape smeared across it.

const EDGE = 180 - 1e-9; // just inside the seam, so no projection has to guess which side ±180 is

/**
 * Traces polygons as one path of closed rings, for the caller to fill or
 * clip: `trace(...); ctx.fill('evenodd')`, or `ctx.save(); trace(...);
 * ctx.clip('evenodd')` to keep a stroke on the land. Starts a new path.
 *
 * `polygons` is `[[outer, ...holes], ...]` of `[lon, lat]` rings, as
 * `geojsonPolygons` returns. Winding is not relied on, so fill even-odd.
 *
 * The seam is the meridian opposite `lonCenter`, as for `limn`. A ring that
 * stays on one side of it is traced exactly as given. A ring that crosses it
 * is cut there and each side traced alone, its lon kept within a hair of
 * the seam. A ring that goes all the way round, as Antarctica does, is
 * closed along the pole on its own side of the equator.
 *
 * `visible` is `limn`'s predicate, and a refused point is again never
 * projected. A pen cannot lift here, so land is cut where it crosses the
 * horizon and closed along it: an orthographic globe fills its near side
 * only, and land round an azimuthal chart's antipode keeps a hole there.
 * The horizon is found by asking `visible`, so it must refuse one connected
 * region lying across the seam, as a far side or an antipode cap does when
 * `lonCenter` is right. Land wholly round a region off the seam crosses no
 * horizon, and is filled whole.
 */
export function trace(ctx, polygons, x, y, options = {}) {
  const { lonCenter = 0, visible } = options;
  const horizon = visible && lazyHorizon(visible);
  ctx.beginPath();
  for (const polygon of polygons) {
    const shapes = polygon.flatMap((ring) => pieces(ring, lonCenter));
    for (const piece of visible ? clip(shapes, lonCenter, visible, horizon) : shapes) {
      for (let i = 0; i < piece.length; i++) {
        const [lon, lat] = piece[i];
        if (i) ctx.lineTo(x(lon, lat), y(lat, lon));
        else ctx.moveTo(x(lon, lat), y(lat, lon));
      }
      ctx.closePath();
    }
  }
}

/** Traces and fills polygons; see `trace` for the seam. Even-odd by default. */
export function fill(ctx, polygons, x, y, options = {}) {
  const { color, alpha = 1, rule = 'evenodd' } = options;
  ctx.save();
  if (color) ctx.fillStyle = color;
  ctx.globalAlpha = alpha;
  trace(ctx, polygons, x, y, options);
  ctx.fill(rule);
  ctx.restore();
}

/** The ring as one or more rings, none crossing the seam. */
function pieces(ring, lonCenter) {
  if (ring.length < 3) return [];
  // Unwrap: each point's offset from the centre, taken within 180 of the last.
  const unwrapped = new Array(ring.length);
  let previous = wrap(ring[0][0] - lonCenter);
  let min = previous;
  let max = previous;
  for (let i = 0; i < ring.length; i++) {
    let delta = wrap(ring[i][0] - lonCenter);
    while (delta - previous > 180) delta -= 360;
    while (delta - previous < -180) delta += 360;
    unwrapped[i] = [delta, ring[i][1]];
    previous = delta;
    if (delta < min) min = delta;
    if (delta > max) max = delta;
  }
  if (min > -180 && max < 180) return [ring];

  // Round the pole: the ring ends a world away from where it began.
  const last = unwrapped[unwrapped.length - 1];
  if (Math.abs(last[0] - unwrapped[0][0]) > 180) {
    const mean = ring.reduce((sum, point) => sum + point[1], 0) / ring.length;
    const pole = mean < 0 ? -90 : 90;
    unwrapped.push([last[0], pole], [unwrapped[0][0], pole]);
  }

  const out = [];
  for (let shift = -360 * Math.ceil((max + 180) / 360); min + shift < 180; shift += 360) {
    if (max + shift <= -180) continue;
    const clipped = clipBand(unwrapped.map(([delta, lat]) => [delta + shift, lat]));
    if (clipped.length > 2) out.push(clipped.map(([delta, lat]) => [lonCenter + delta, lat]));
  }
  return out;
}

const wrap = (delta) => ((((delta + 180) % 360) + 360) % 360) - 180;

/** Sutherland-Hodgman against -EDGE <= delta <= EDGE, lat interpolated linearly. */
function clipBand(ring) {
  let out = ring;
  for (const edge of [EDGE, -EDGE]) {
    const inside = (delta) => (edge > 0 ? delta <= edge : delta >= edge);
    const source = out;
    out = [];
    for (let i = 0; i < source.length; i++) {
      const a = source[(i + source.length - 1) % source.length];
      const b = source[i];
      const cut = () => [edge, a[1] + ((b[1] - a[1]) * (edge - a[0])) / (b[0] - a[0])];
      if (inside(b[0])) {
        if (!inside(a[0])) out.push(cut());
        out.push(b);
      } else if (inside(a[0])) out.push(cut());
    }
    if (!out.length) break;
  }
  return out;
}

// The horizon. `visible` is all that is known of it, so each crossing is
// found by bisection and the horizon itself by walking along it on the
// sphere, re-bisecting at every step. Points are [offset from lonCenter, lat]
// until they leave `clip`.

const D = Math.PI / 180;
const STEP = 1; // degrees between points along an edge or the horizon
const HALVINGS = 40;

/** The rings of one polygon's pieces, cut at the horizon and closed along it. */
function clip(shapes, lonCenter, visible, horizon) {
  const lonOf = (offset) => wrap(lonCenter + offset);
  const seen = ([offset, lat]) => visible(lonOf(offset), lat);
  const rings = shapes.map((ring) =>
    densify(ring.map(([lon, lat]) => [wrap(lon - lonCenter), lat])),
  );
  const out = [];
  const runs = [];
  for (const ring of rings) {
    const shown = ring.map(seen);
    const n = ring.length;
    const first = shown.findIndex((v, i) => v && !shown[(i + n - 1) % n]);
    if (first < 0) {
      if (shown[0]) out.push(ring);
      continue;
    }
    let run = null;
    for (let k = 0; k < n; k++) {
      const i = (first + k) % n;
      const before = ring[(i + n - 1) % n];
      if (shown[i]) {
        if (!run) run = [crossing(seen, ring[i], before)];
        run.push(ring[i]);
      } else if (run) {
        run.push(crossing(seen, before, ring[i]));
        runs.push(run);
        run = null;
      }
    }
  }
  if (runs.length) {
    const rim = horizon(vec(lonOf(runs[0][0][0]), runs[0][0][1]));
    const local = (v) => {
      const [lon, lat] = lonlat(v);
      return [wrap(lon - lonCenter), lat];
    };
    const toVec = ([offset, lat]) => vec(lonOf(offset), lat);
    out.push(...join(runs, rim, local, (point) => inside(rings, point), toVec));
  }
  return out.map((ring) => ring.map(([offset, lat]) => [lonOf(offset), lat]));
}

/** Joins runs, end to end, along the stretches of horizon that lie in the land. */
function join(runs, rim, local, inLand, toVec) {
  const endsOf = new Map(
    runs.map((run) => [
      run,
      [run[0], run[run.length - 1]].map((point, end) => {
        const v = toVec(point);
        return { run, end, v, at: rim.locate(v) };
      }),
    ]),
  );
  const ends = [...endsOf.values()].flat().sort((a, b) => a.at - b.at);
  // Land and sea alternate along the horizon, so the stretches in land are
  // every other one. Which half is decided by a vote, since a sliver of land
  // narrower than the coast's chords can test either way on its own.
  let vote = 0;
  for (let i = 0; i < ends.length; i++) {
    if (inLand(local(rim.middle(ends[i], ends[(i + 1) % ends.length])))) vote += i % 2 ? -1 : 1;
  }
  for (let i = vote < 0 ? 1 : 0; i < ends.length; i += 2) {
    const a = ends[i];
    const b = ends[(i + 1) % ends.length];
    a.arc = { to: b, way: 1 };
    b.arc = { to: a, way: -1 };
  }
  const used = new Set();
  const loops = [];
  for (const start of runs) {
    if (used.has(start)) continue;
    const loop = [];
    let run = start;
    let from = 0;
    while (run && !used.has(run)) {
      used.add(run);
      loop.push(...(from ? [...run].reverse() : run));
      const leaving = endsOf.get(run)[1 - from];
      if (!leaving.arc) throw new Error('visible: a run left the horizon with no land to follow');
      loop.push(...rim.between(leaving.at, leaving.arc.to.at, leaving.arc.way).map(local));
      run = leaving.arc.to.run;
      from = leaving.arc.to.end;
    }
    loops.push(loop);
  }
  return loops;
}

/** The visible end of the edge from `shown` to `hidden`, by bisection. */
function crossing(seen, shown, hidden) {
  let [a, b] = [shown, hidden];
  for (let i = 0; i < HALVINGS; i++) {
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    if (seen(mid)) a = mid;
    else b = mid;
  }
  return a;
}

/** Even-odd: is the point inside the polygon whose rings these are. */
function inside(rings, [px, py]) {
  let odd = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) odd = !odd;
    }
  }
  return odd;
}

/** No edge longer than STEP, so an edge cannot dip behind the horizon unseen. */
function densify(ring) {
  const out = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const parts = Math.max(
      1,
      Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])) / STEP),
    );
    for (let k = 0; k < parts; k++) {
      out.push([a[0] + ((b[0] - a[0]) * k) / parts, a[1] + ((b[1] - a[1]) * k) / parts]);
    }
  }
  return out;
}

/** The horizon, walked once per `trace` and only if some land crosses it. */
function lazyHorizon(visible) {
  const seen = (v) => visible(...lonlat(v));
  let rim = null;
  return (seed) => (rim ??= walk(seen, seed));
}

/** The horizon as a closed loop of points just on the visible side. */
function walk(seen, start) {
  const step = STEP * D;
  const point = (p, dir, angle) => add(scale(p, Math.cos(angle)), scale(dir, Math.sin(angle)));
  // Which way is visible from the start, by looking round it.
  const [e1, e2] = basis(start);
  let toward = [0, 0, 0];
  for (let k = 0; k < 16; k++) {
    const dir = add(scale(e1, Math.cos((k * Math.PI) / 8)), scale(e2, Math.sin((k * Math.PI) / 8)));
    toward = add(toward, scale(dir, seen(point(start, dir, step)) ? 1 : -1));
  }
  toward = normalize(add(toward, scale(start, -dot(toward, start))));
  const points = [start];
  let p = start;
  let ahead = cross(toward, p);
  for (let n = 0; n < 360 / STEP / 0.05; n++) {
    const q = point(p, ahead, step);
    const across = normalize(add(toward, scale(q, -dot(toward, q))));
    let wide = step;
    while (wide < Math.PI && !(seen(point(q, across, wide)) && !seen(point(q, across, -wide))))
      wide *= 2;
    if (wide >= Math.PI) throw new Error('visible: lost the horizon; it must refuse one region');
    let [lo, hi] = [-wide, wide];
    for (let i = 0; i < HALVINGS; i++) {
      const mid = (lo + hi) / 2;
      if (seen(point(q, across, mid))) hi = mid;
      else lo = mid;
    }
    const next = point(q, across, hi);
    // Head along the chord just walked, so the walk turns with the horizon.
    const chord = add(next, scale(p, -1));
    ahead = normalize(add(chord, scale(next, -dot(chord, next))));
    toward = cross(next, ahead);
    if (dot(toward, across) < 0) toward = scale(toward, -1);
    p = next;
    if (points.length > 2 && Math.acos(Math.min(1, dot(p, start))) < step)
      return horizonLoop(points);
    points.push(p);
  }
  throw new Error('visible: the horizon does not close');
}

/** Positions along a closed loop of points, and the points between two. */
function horizonLoop(points) {
  const m = points.length;
  const ahead = (from, to) => (((to - from) % m) + m) % m;
  const indices = (from, to, way) => {
    const out = [];
    const span = way > 0 ? ahead(from, to) : ahead(to, from);
    for (let j = way > 0 ? Math.floor(from) + 1 : Math.ceil(from) - 1; ; j += way) {
      const k = ((j % m) + m) % m;
      if ((way > 0 ? ahead(from, k) : ahead(k, from)) >= span || out.length > m) return out;
      out.push(k);
    }
  };
  return {
    locate(v) {
      let best = Infinity;
      let at = 0;
      for (let i = 0; i < m; i++) {
        const a = points[i];
        const d = add(points[(i + 1) % m], scale(a, -1));
        const t = Math.max(0, Math.min(1, dot(add(v, scale(a, -1)), d) / dot(d, d)));
        const off = add(add(a, scale(d, t)), scale(v, -1));
        if (dot(off, off) < best) [best, at] = [dot(off, off), i + t];
      }
      return at;
    },
    between: (from, to, way) => indices(from, to, way).map((k) => points[k]),
    /** A point between two crossings, never off the horizon by more than they are. */
    middle(a, b) {
      const inner = indices(a.at, b.at, 1);
      return inner.length ? points[inner[inner.length >> 1]] : normalize(add(a.v, b.v));
    },
  };
}

const vec = (lon, lat) => [
  Math.cos(lat * D) * Math.cos(lon * D),
  Math.cos(lat * D) * Math.sin(lon * D),
  Math.sin(lat * D),
];
const lonlat = ([a, b, c]) => [Math.atan2(b, a) / D, Math.asin(Math.max(-1, Math.min(1, c))) / D];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const normalize = (a) => scale(a, 1 / Math.sqrt(dot(a, a)));
const basis = (p) => {
  const e1 = normalize(cross(p, Math.abs(p[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]));
  return [e1, cross(p, e1)];
};

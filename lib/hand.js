// The hand. A period chart's rivers wiggle, its lakes are lozenges and its
// seas are hatched, and the pen that drew them was the same size everywhere.
// So everything here works in pixels, after projection: a wiggle stays one
// pen wide at every zoom, and a glyph fits the shape as the reader sees it.

import { trace } from './fill.js';

const TAU = 2 * Math.PI;
const GOLDEN = Math.PI * (3 - Math.sqrt(5)); // an irrational step, so no two hatch lines' nudges repeat in a pattern

/**
 * Projects rings into pixel runs, `[[px, py], ...]`, lifting the pen where
 * `limn` does: at a jump of more than 180° of longitude about `lonCenter`
 * (never, for `lonCenter: null`), and at each point `visible(lon, lat)` refuses, which is never projected.
 * See `limn` for why both rules exist. A run may be a single point.
 */
export function runs(rings, x, y, options = {}) {
  const { lonCenter = 0, visible } = options;
  const out = [];
  for (const ring of rings) {
    let run = null;
    let previous = 0;
    for (let i = 0; i < ring.length; i++) {
      const [lon, lat] = ring[i];
      const delta = fromCentre(lon - lonCenter);
      if (lonCenter !== null && i > 0 && Math.abs(delta - previous) > 180) run = null;
      previous = delta;
      if (visible && !visible(lon, lat)) {
        run = null;
        continue;
      }
      if (!run) out.push((run = []));
      run.push([x(lon, lat), y(lat, lon)]);
    }
  }
  return out;
}

/**
 * Adds pixel runs to the current path, without beginning one, for the caller
 * to stroke or fill: a lozenge, a meandered river.
 */
export function pen(ctx, pixelRuns, options = {}) {
  const { close = false } = options;
  for (const run of pixelRuns) {
    run.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    if (close && run.length) ctx.closePath();
  }
}

/**
 * A pixel run made to wiggle: displaced across itself by a sine of arc
 * length, `amplitude` px each way, `wavelength` px from crest to crest,
 * `phase` in radians. The wave fades in and out over half a wavelength at
 * each end, so the run still starts and stops where it did.
 */
export function meander(run, options = {}) {
  const { amplitude = 2, wavelength = 14, phase = 0 } = options;
  const along = resample(run, wavelength / 8);
  if (!along) return run.map(([px, py]) => [px, py]);
  const { points, length } = along;
  const fade = wavelength / 2;
  return points.map(([px, py, s], i) => {
    // The tangent across half a wavelength, so a sharp vertex bends the wave rather than kinking it.
    const [ax, ay] = points[Math.max(0, i - 2)];
    const [bx, by] = points[Math.min(points.length - 1, i + 2)];
    const span = Math.hypot(bx - ax, by - ay) || 1;
    const edge = Math.min(1, Math.min(s, length - s) / fade);
    const offset =
      amplitude * ((1 - Math.cos(Math.PI * edge)) / 2) * Math.sin((TAU * s) / wavelength + phase);
    return [px - ((by - ay) / span) * offset, py + ((bx - ax) / span) * offset];
  });
}

/**
 * A pixel run with every point dropped that lies within `tolerance` px of
 * the line its kept neighbours draw (Douglas-Peucker). Ends are kept. Data
 * drawn small carries bends a wave would only scribble over.
 */
export function simplify(run, tolerance = 1) {
  if (run.length < 3) return run.slice();
  const keep = new Array(run.length).fill(false);
  keep[0] = keep[run.length - 1] = true;
  // A stack, not recursion: a long coast is deeper than the call stack.
  const stack = [[0, run.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop();
    let [far, farthest] = [-1, tolerance];
    for (let i = first + 1; i < last; i++) {
      const d = offLine(run[i], run[first], run[last]);
      if (d > farthest) [far, farthest] = [i, d];
    }
    if (far < 0) continue;
    keep[far] = true;
    stack.push([first, far], [far, last]);
  }
  return run.filter((_, i) => keep[i]);
}

/**
 * The oriented box of a pixel run or ring, `{ cx, cy, angle, length, width }`:
 * its long axis by principal components, the box's centre, and its extent
 * along and across that axis. Weighted by the outline's length rather than
 * its vertices, so a stretch of dense points does not swing the axis. For
 * fitting a glyph -- a lozenge, a mountain, a stand of trees -- to a real
 * shape.
 */
export function footprint(run) {
  const { mx, my, sxx, sxy, syy } = moments(run);
  const angle = Math.atan2(2 * sxy, sxx - syy) / 2;
  const [ux, uy] = [Math.cos(angle), Math.sin(angle)];
  const [u0, u1] = extent(run.map(([px, py]) => (px - mx) * ux + (py - my) * uy));
  const [v0, v1] = extent(run.map(([px, py]) => (py - my) * ux - (px - mx) * uy));
  const [u, v] = [(u0 + u1) / 2, (v0 + v1) / 2];
  return {
    cx: mx + u * ux - v * uy,
    cy: my + u * uy + v * ux,
    angle,
    length: u1 - u0,
    width: v1 - v0,
  };
}

/**
 * A pointed oval on the box `footprint` returns: two circular arcs meeting
 * in points at either end of the long axis, `length` apart, `width` across
 * at the middle. A closed pixel ring of `steps` points and the first again.
 */
export function lozenge({ cx, cy, angle, length, width }, steps = 24) {
  const [a, b] = [length / 2, width / 2];
  const k = (a * a - b * b) / (2 * b); // the arcs' centres sit k across the axis, on the far side
  const radius = b + k;
  const start = Math.atan2(k, a);
  const half = Math.max(2, Math.round(steps / 2));
  const arc = [];
  for (let i = 0; i <= half; i++) {
    const t = start + ((Math.PI - 2 * start) * i) / half;
    arc.push([radius * Math.cos(t), radius * Math.sin(t) - k]);
  }
  const local = [...arc, ...arc.slice(1).map(([u, v]) => [-u, -v])];
  const [cos, sin] = [Math.cos(angle), Math.sin(angle)];
  return local.map(([u, v]) => [cx + u * cos - v * sin, cy + u * sin + v * cos]);
}

/**
 * Hatches polygons: parallel strokes `gap` px apart at `angle` radians,
 * clipped to the polygons as `trace` draws them. With an `amplitude` each
 * stroke meanders, as a period chart's seas do; with a `dash`, a
 * `setLineDash` pattern, it breaks. The context is restored after.
 */
export function hatch(ctx, polygons, x, y, options = {}) {
  const {
    angle = 0,
    gap = 6,
    amplitude = 0,
    wavelength = 14,
    dash,
    color,
    width = 1,
    alpha = 1,
    lonCenter = 0,
  } = options;
  ctx.save();
  const box = [Infinity, Infinity, -Infinity, -Infinity];
  const grow = (px, py) => {
    box[0] = Math.min(box[0], px);
    box[1] = Math.min(box[1], py);
    box[2] = Math.max(box[2], px);
    box[3] = Math.max(box[3], py);
  };
  // Trace through a context that also notes the pixel bounds, so nothing is projected twice.
  trace(
    {
      beginPath: () => ctx.beginPath(),
      closePath: () => ctx.closePath(),
      moveTo: (px, py) => (grow(px, py), ctx.moveTo(px, py)),
      lineTo: (px, py) => (grow(px, py), ctx.lineTo(px, py)),
    },
    polygons,
    x,
    y,
    { lonCenter },
  );
  ctx.clip('evenodd');
  if (box[0] <= box[2]) {
    if (color) ctx.strokeStyle = color;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = width;
    ctx.lineJoin = 'round';
    if (dash) ctx.setLineDash(dash);
    ctx.beginPath();
    pen(
      ctx,
      strokes(box, angle, gap, wavelength).map((line, i) =>
        amplitude > 0 ? meander(line, { amplitude, wavelength, phase: nudge(i) }) : line,
      ),
    );
    ctx.stroke();
  }
  ctx.restore();
}

/** Near in step, so the strokes read as parallel waves, but never ruled-perfect. */
const nudge = (i) => 0.9 * Math.sin(i * GOLDEN);

/** Parallel lines across a pixel box, each reaching past it by a wavelength so its faded ends fall outside. */
function strokes([x0, y0, x1, y1], angle, gap, reach) {
  const [cx, cy] = [(x0 + x1) / 2, (y0 + y1) / 2];
  const r = Math.hypot(x1 - x0, y1 - y0) / 2;
  const [ux, uy] = [Math.cos(angle), Math.sin(angle)];
  const lines = [];
  for (let o = -r; o <= r; o += gap) {
    const [ox, oy] = [cx - uy * o, cy + ux * o];
    lines.push([
      [ox - ux * (r + reach), oy - uy * (r + reach)],
      [ox + ux * (r + reach), oy + uy * (r + reach)],
    ]);
  }
  return lines;
}

/** The run at even steps of about `step` px, each point `[px, py, arcLength]`, or null if it has no length. */
function resample(run, step) {
  const cumulative = [0];
  for (let i = 1; i < run.length; i++) {
    cumulative.push(
      cumulative[i - 1] + Math.hypot(run[i][0] - run[i - 1][0], run[i][1] - run[i - 1][1]),
    );
  }
  const length = cumulative[cumulative.length - 1];
  if (!(length > 0)) return null;
  const n = Math.max(1, Math.ceil(length / step));
  const points = [];
  let j = 1;
  for (let i = 0; i <= n; i++) {
    const s = (length * i) / n;
    while (j < run.length - 1 && cumulative[j] < s) j++;
    const t = (s - cumulative[j - 1]) / (cumulative[j] - cumulative[j - 1] || 1);
    const [a, b] = [run[j - 1], run[j]];
    points.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, s]);
  }
  return { points, length };
}

/** Centroid and second moments of a run's outline, each segment weighted by its length. */
function moments(run) {
  let [total, sumX, sumY] = [0, 0, 0];
  const segments = [];
  for (let i = 1; i < run.length; i++) {
    const [a, b] = [run[i - 1], run[i]];
    const d = [b[0] - a[0], b[1] - a[1]];
    const w = Math.hypot(d[0], d[1]);
    segments.push({ m: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], d, w });
    total += w;
    sumX += (w * (a[0] + b[0])) / 2;
    sumY += (w * (a[1] + b[1])) / 2;
  }
  if (!(total > 0)) return { mx: run[0]?.[0] ?? 0, my: run[0]?.[1] ?? 0, sxx: 0, sxy: 0, syy: 0 };
  const [mx, my] = [sumX / total, sumY / total];
  let [sxx, sxy, syy] = [0, 0, 0];
  for (const { m, d, w } of segments) {
    // A segment's own spread about its midpoint adds d d^T / 12.
    const [ex, ey] = [m[0] - mx, m[1] - my];
    sxx += w * (ex * ex + (d[0] * d[0]) / 12);
    sxy += w * (ex * ey + (d[0] * d[1]) / 12);
    syy += w * (ey * ey + (d[1] * d[1]) / 12);
  }
  return { mx, my, sxx, sxy, syy };
}

/** Distance from a point to the segment a-b. */
function offLine([px, py], [ax, ay], [bx, by]) {
  const [dx, dy] = [bx - ax, by - ay];
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}

// Not Math.min(...values): a long coast would overflow the call stack.
const extent = (values) =>
  values.reduce(
    ([lo, hi], value) => [Math.min(lo, value), Math.max(hi, value)],
    [Infinity, -Infinity],
  );
// One turn either way, not a modulo: a point on the seam keeps its side, +180 or -180, as limn always has.
const fromCentre = (delta) => (delta > 180 ? delta - 360 : delta < -180 ? delta + 360 : delta);

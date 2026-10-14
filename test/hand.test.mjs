import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runs, simplify, meander, footprint, lozenge, hatch } from '../lib/index.js';

const close = (actual, expected, tolerance, message) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: ${actual} is not ${expected}`);

/** Distance from a point to the nearest segment of a polyline. */
function distance([px, py], line) {
  let best = Infinity;
  for (let i = 1; i < line.length; i++) {
    const [[ax, ay], [bx, by]] = [line[i - 1], line[i]];
    const t = Math.max(
      0,
      Math.min(
        1,
        ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2),
      ),
    );
    best = Math.min(best, Math.hypot(px - ax - t * (bx - ax), py - ay - t * (by - ay)));
  }
  return best;
}

test('runs lifts the pen across the seam', () => {
  const ring = [
    [170, 0],
    [179, 1],
    [-179, 2],
    [-170, 3],
  ];
  assert.deepEqual(
    runs(
      [ring],
      (lon) => lon,
      (lat) => lat,
    ),
    [
      [
        [170, 0],
        [179, 1],
      ],
      [
        [-179, 2],
        [-170, 3],
      ],
    ],
  );
  // Centred on the antimeridian, the same ring is all on one side.
  assert.equal(
    runs(
      [ring],
      (lon) => lon,
      (lat) => lat,
      { lonCenter: 180 },
    ).length,
    1,
  );
});

test('runs lifts the pen at a refused point and never projects it', () => {
  const asked = [];
  const out = runs(
    [
      [
        [0, 0],
        [1, 0],
        [2, 0],
        [3, 0],
        [4, 0],
      ],
    ],
    (lon) => (asked.push(lon), lon),
    (lat) => lat,
    { visible: (lon) => lon !== 2 },
  );
  assert.deepEqual(out, [
    [
      [0, 0],
      [1, 0],
    ],
    [
      [3, 0],
      [4, 0],
    ],
  ]);
  assert.deepEqual(asked, [0, 1, 3, 4]);
});

test('simplify drops points within tolerance and keeps the ends and real bends', () => {
  const run = [
    [0, 0],
    [10, 1],
    [20, -1],
    [30, 0],
    [40, 30],
    [50, 0.5],
    [60, 0],
  ];
  const kept = simplify(run, 2);
  assert.deepEqual(kept, [
    [0, 0],
    [30, 0],
    [40, 30],
    [50, 0.5],
    [60, 0],
  ]);
  for (const point of run) assert.ok(distance(point, kept) <= 2, `${point} lost`);
  assert.deepEqual(
    simplify(
      [
        [1, 2],
        [3, 4],
      ],
      5,
    ),
    [
      [1, 2],
      [3, 4],
    ],
  );
});

test('meander keeps its endpoints and stays within its amplitude of the line', () => {
  const line = [
    [10, 20],
    [150, 20],
    [150, 120],
    [260, 160],
  ];
  const amplitude = 3;
  const wiggle = meander(line, { amplitude, wavelength: 14 });
  assert.deepEqual(wiggle[0], line[0]);
  for (const [i, value] of wiggle[wiggle.length - 1].entries())
    close(value, line[line.length - 1][i], 1e-9, 'end');
  for (const point of wiggle)
    assert.ok(distance(point, line) <= amplitude + 1e-9, `${point} strays`);
});

test('meander actually wiggles, reaching near its amplitude mid-run', () => {
  const amplitude = 2.5;
  const wiggle = meander(
    [
      [0, 0],
      [300, 0],
    ],
    { amplitude, wavelength: 14 },
  );
  const middle = wiggle.filter(([px]) => px > 30 && px < 270);
  assert.ok(Math.max(...middle.map(([, py]) => Math.abs(py))) > 0.9 * amplitude, 'too flat');
  assert.ok(
    middle.some(([, py]) => py > 0) && middle.some(([, py]) => py < 0),
    'crosses the line both ways',
  );
});

test('meander of a run with no length is the run', () => {
  assert.deepEqual(meander([[5, 5]]), [[5, 5]]);
  assert.deepEqual(
    meander([
      [5, 5],
      [5, 5],
    ]),
    [
      [5, 5],
      [5, 5],
    ],
  );
});

test('footprint recovers a rotated rectangle', () => {
  const [cx, cy, angle, length, width] = [120, 80, 0.6, 100, 30];
  const corner = (u, v) => [
    cx + u * Math.cos(angle) - v * Math.sin(angle),
    cy + u * Math.sin(angle) + v * Math.cos(angle),
  ];
  const ring = [
    corner(-50, -15),
    corner(50, -15),
    corner(50, 15),
    corner(-50, 15),
    corner(-50, -15),
  ];
  const box = footprint(ring);
  const turn = (((box.angle - angle) % Math.PI) + Math.PI) % Math.PI;
  assert.ok(Math.min(turn, Math.PI - turn) < 1e-9, `angle ${box.angle}`);
  close(box.length, length, 1e-9, 'length');
  close(box.width, width, 1e-9, 'width');
  close(box.cx, cx, 1e-9, 'cx');
  close(box.cy, cy, 1e-9, 'cy');
});

test('lozenge is a closed pointed oval on its box', () => {
  const box = { cx: 40, cy: 60, angle: -0.4, length: 80, width: 30 };
  const ring = lozenge(box);
  for (const [i, value] of ring[0].entries())
    close(value, ring[ring.length - 1][i], 1e-9, 'closed');
  const [ux, uy] = [Math.cos(box.angle), Math.sin(box.angle)];
  const along = ring.map(([px, py]) => (px - box.cx) * ux + (py - box.cy) * uy);
  const across = ring.map(([px, py]) => (py - box.cy) * ux - (px - box.cx) * uy);
  close(Math.max(...along), box.length / 2, 1e-9, 'tip');
  close(Math.min(...along), -box.length / 2, 1e-9, 'other tip');
  close(across[along.indexOf(Math.max(...along))], 0, 1e-9, 'tip on the axis');
  close(across[along.indexOf(Math.min(...along))], 0, 1e-9, 'other tip on the axis');
  close(Math.max(...across.map(Math.abs)), box.width / 2, 1e-9, 'half-width');
  const fitted = footprint(ring);
  close(fitted.length, box.length, 1e-9, 'fits its own box');
});

/** Records path calls and each stroked subpath, in pixels. */
function recordingContext() {
  const calls = [];
  const paths = [];
  let current = [];
  return {
    calls,
    paths,
    save: () => calls.push('save'),
    restore: () => calls.push('restore'),
    beginPath: () => (current = []),
    moveTo: (px, py) => current.push([[px, py]]),
    lineTo: (px, py) => current[current.length - 1].push([px, py]),
    closePath() {},
    clip: (rule) => calls.push(`clip ${rule}`),
    setLineDash: (dash) => calls.push(`dash ${dash}`),
    stroke() {
      calls.push('stroke');
      paths.push(...current);
    },
  };
}
const square = [
  [
    [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [0, 0],
    ],
  ],
];
const x = (lon) => lon * 10;
const y = (lat) => lat * 10;

test('hatch clips to the polygons, then strokes parallel lines across them', () => {
  const ctx = recordingContext();
  hatch(ctx, square, x, y, { angle: 0, gap: 10 });
  assert.deepEqual(ctx.calls, ['save', 'clip evenodd', 'stroke', 'restore']);
  for (const line of ctx.paths) assert.equal(line[0][1], line[line.length - 1][1], 'level');
  const heights = ctx.paths.map((line) => line[0][1]).sort((a, b) => a - b);
  heights.slice(1).forEach((height, i) => close(height - heights[i], 10, 1e-9, 'gap'));
  assert.ok(heights[0] <= 10 && heights[heights.length - 1] >= 90, 'covers the square');
  for (const line of ctx.paths)
    assert.ok(line[0][0] <= 0 && line[line.length - 1][0] >= 100, 'spans the square');
});

test('hatch meanders each line when given an amplitude, and dashes when asked', () => {
  const ctx = recordingContext();
  hatch(ctx, square, x, y, { angle: Math.PI / 2, gap: 5, amplitude: 1.5, dash: [4, 2] });
  assert.ok(ctx.calls.includes('dash 4,2'));
  assert.ok(ctx.paths.length >= 20);
  for (const line of ctx.paths) {
    assert.ok(line.length > 2, 'resampled');
    const across = line.map(([px]) => px);
    assert.ok(Math.max(...across) - Math.min(...across) > 2, 'wiggles across the vertical');
  }
});

test('hatch with nothing to hatch strokes nothing and restores', () => {
  const ctx = recordingContext();
  hatch(ctx, [], x, y);
  assert.deepEqual(ctx.calls, ['save', 'clip evenodd', 'restore']);
});

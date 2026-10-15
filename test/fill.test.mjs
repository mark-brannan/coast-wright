import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { polygons, geojsonPolygons, trace, fill, limn, rhumb, cap } from '../lib/index.js';

const require = createRequire(import.meta.url);
const land = require('./fixtures/land-110m.json');

/** Records each ring as the [lon, lat] pairs handed to x and y. */
function recordingContext() {
  const rings = [];
  const calls = [];
  let ring = null;
  return {
    rings,
    calls,
    save() {},
    restore() {},
    beginPath() {
      calls.push('beginPath');
    },
    moveTo(point) {
      ring = [point];
      rings.push(ring);
    },
    lineTo(point) {
      ring.push(point);
    },
    closePath() {},
    fill() {
      calls.push('fill');
    },
    stroke() {
      calls.push('stroke');
    },
  };
}
// x carries both coordinates through to the recorder; y is unused.
const x = (lon, lat) => [lon, lat];
const y = () => 0;

const delta = (lon, centre) => ((((lon - centre + 180) % 360) + 360) % 360) - 180;
/** Shoelace area in (offset from centre, lat) degrees. */
const area = (ring, centre) => {
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const [a, b] = [ring[i], ring[(i + 1) % ring.length]];
    sum += delta(a[0], centre) * b[1] - delta(b[0], centre) * a[1];
  }
  return Math.abs(sum) / 2;
};
const box = (lon0, lon1, lat0, lat1) => [
  [lon0, lat0],
  [lon1, lat0],
  [lon1, lat1],
  [lon0, lat1],
  [lon0, lat0],
];

test('a ring clear of the seam is traced exactly as given', () => {
  const ctx = recordingContext();
  const ring = box(-10, 10, 40, 50);
  trace(ctx, [[ring]], x, y);
  assert.deepEqual(ctx.rings, [ring]);
});

test('a ring across the seam is cut there, one piece each side, area kept', () => {
  for (const [ring, centre] of [
    [box(170, -170, 0, 10), 0], // across the antimeridian
    [box(-10, 10, 40, 50), 180], // across Greenwich, for a Pacific-centred map
  ]) {
    const ctx = recordingContext();
    trace(ctx, [[ring]], x, y, { lonCenter: centre });
    assert.equal(ctx.rings.length, 2, `centre ${centre}`);
    for (const piece of ctx.rings) {
      const offsets = piece.map(([lon]) => delta(lon, centre));
      assert.ok(Math.max(...offsets) - Math.min(...offsets) < 180, 'no piece spans the map');
    }
    const total = ctx.rings.reduce((sum, piece) => sum + area(piece, centre), 0);
    assert.ok(Math.abs(total - 200) < 1e-6, `area ${total}`);
  }
});

test('a ring round the pole is closed along that pole', () => {
  // Antarctica's shape: all the way round, never back across.
  const ring = [];
  for (let lon = -180; lon <= 180; lon += 30) ring.push([lon, -70]);
  const ctx = recordingContext();
  trace(ctx, [[ring]], x, y, { lonCenter: 45 });
  const total = ctx.rings.reduce((sum, piece) => sum + area(piece, 45), 0);
  assert.ok(Math.abs(total - 360 * 20) < 1e-6, `area ${total}`);
  assert.ok(
    ctx.rings.flat().some(([, lat]) => lat === -90),
    'closed along the south pole',
  );
});

test('the land, filled from any centre, never lays a shape across the map', () => {
  for (const centre of [0, 90, 180, -150]) {
    const ctx = recordingContext();
    fill(ctx, polygons(land), x, y, { lonCenter: centre });
    assert.deepEqual(ctx.calls, ['beginPath', 'fill']);
    for (const piece of ctx.rings) {
      for (let i = 1; i < piece.length; i++) {
        // Along the pole is not across the map: the pole is one point.
        if (Math.abs(piece[i][1]) === 90 && Math.abs(piece[i - 1][1]) === 90) continue;
        const step = Math.abs(delta(piece[i][0], centre) - delta(piece[i - 1][0], centre));
        assert.ok(step < 180, `centre ${centre}: a segment spans ${step}`);
      }
    }
  }
});

/** Even-odd containment, as the canvas fills. */
const within = (rings, [px, py]) => {
  let odd = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [[xi, yi], [xj, yj]] = [ring[i], ring[j]];
      if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) odd = !odd;
    }
  }
  return odd;
};

for (const [lonCenter, lat0] of [
  [178, -17], // the far side holds Africa and Europe, which would otherwise land mirrored inside the same disc
  [-120, 0], // the horizon passes slivers of land too thin to say on their own which side is land
]) {
  test(`on an orthographic globe at ${lonCenter},${lat0}, only the near side is filled and nothing behind is projected`, () => {
    const D = Math.PI / 180;
    const near = cap([lonCenter, lat0], 90);
    const ortho = ([lon, lat]) => [
      Math.cos(lat * D) * Math.sin(delta(lon, lonCenter) * D),
      Math.cos(lat0 * D) * Math.sin(lat * D) -
        Math.sin(lat0 * D) * Math.cos(lat * D) * Math.cos(delta(lon, lonCenter) * D),
    ];
    const guarded = (lon, lat) => {
      assert.ok(near(lon, lat), `far-side point projected: ${lon},${lat}`);
      return [lon, lat];
    };
    const ctx = recordingContext();
    trace(ctx, polygons(land), guarded, y, { lonCenter, visible: near });
    const drawn = ctx.rings.map((ring) => ring.map(ortho));
    const truth = polygons(land).flat();
    let wrong = 0;
    let asked = 0;
    for (let lat = -88; lat <= 88; lat += 2) {
      for (let lon = -179; lon < 180; lon += 2) {
        if (!near(lon, lat)) continue;
        asked++;
        if (within(truth, [lon, lat]) !== within(drawn, ortho([lon, lat]))) wrong++;
      }
    }
    // Only points within a step of the coast or the horizon may disagree.
    assert.ok(wrong / asked < 0.01, `${wrong} of ${asked} near-side points filled wrongly`);
  });
}

test('land round an antipode mask keeps a hole there, across the seam', () => {
  // The mask sits on the seam, as an azimuthal chart's always does.
  const lonCenter = -150;
  const D = Math.PI / 180;
  // Refuses 10° round 30,0: admits everything within 170° of the antipode's antipode.
  const shown = cap([30 - 180, 0], 170);
  const plane = (lon, lat) => {
    assert.ok(shown(lon, lat), `masked point projected: ${lon},${lat}`);
    return [delta(lon, lonCenter), lat];
  };
  const ctx = recordingContext();
  trace(ctx, [[box(15, 45, -20, 20)]], plane, y, { lonCenter, visible: shown });
  const at = (lon, lat) => within(ctx.rings, [delta(lon, lonCenter), lat]);
  for (const [lon, lat] of [
    [27, 0],
    [33, 4],
  ])
    assert.ok(!at(lon, lat), `masked ${lon},${lat} is filled`);
  for (const [lon, lat] of [
    [20, 0],
    [40, 0],
    [29, 15],
    [31, -15],
    [25, 12],
    [36, -12],
  ]) {
    assert.ok(at(lon, lat), `land at ${lon},${lat} left unfilled`);
  }
  for (const piece of ctx.rings) {
    const offsets = piece.map(([offset]) => offset);
    assert.ok(Math.max(...offsets) - Math.min(...offsets) < 180, 'a piece spans the map');
  }
});

test('land that surrounds an antipode mask keeps a hole there', () => {
  const lonCenter = -150;
  const D = Math.PI / 180;
  const shown = (lon, lat) => Math.cos(lat * D) * Math.cos((lon - 30) * D) < Math.cos(10 * D);
  const ctx = recordingContext();
  trace(ctx, [[box(0, 60, -30, 30)]], (lon, lat) => [delta(lon, lonCenter), lat], y, {
    lonCenter,
    visible: shown,
  });
  const at = (lon, lat) => within(ctx.rings, [delta(lon, lonCenter), lat]);
  assert.ok(!at(29, 0), 'the masked centre is filled');
  assert.ok(at(10, 25), 'land clear of the mask is left unfilled');
});

test('geojsonPolygons keeps polygons whole and skips what encloses nothing', () => {
  const geometry = (type, coordinates) => ({ type: 'Feature', geometry: { type, coordinates } });
  const doc = {
    type: 'FeatureCollection',
    features: [
      geometry('Polygon', [box(0, 1, 0, 1), box(0.2, 0.8, 0.2, 0.8)]),
      geometry('MultiPolygon', [[box(2, 3, 0, 1)], [box(4, 5, 0, 1)]]),
      geometry('LineString', [
        [0, 0],
        [1, 1],
      ]),
      geometry('Point', [0, 0]),
    ],
  };
  const shapes = geojsonPolygons(doc);
  assert.deepEqual(
    shapes.map((shape) => shape.length),
    [2, 1, 1],
  );
  assert.equal(geojsonPolygons(doc), shapes);
  assert.throws(() => geojsonPolygons(null), /not a GeoJSON object/);
});

test('limn with oneStroke strokes every ring as one path', () => {
  const ctx = recordingContext();
  limn(ctx, [box(0, 1, 0, 1), box(2, 3, 0, 1)], x, y, { oneStroke: true });
  assert.deepEqual(ctx.calls, ['beginPath', 'stroke']);
  assert.equal(ctx.rings.length, 2);
});

test('a rhumb line holds its bearing', () => {
  const east = rhumb([0, 0], 90, 30, 3);
  assert.deepEqual(
    east.map(([lon, lat]) => [Math.round(lon), Math.round(lat)]),
    [
      [0, 0],
      [10, 0],
      [20, 0],
      [30, 0],
    ],
  );

  const north = rhumb([10, 20], 0, 30, 3);
  for (const [lon] of north) assert.ok(Math.abs(lon - 10) < 1e-9);
  assert.ok(Math.abs(north[3][1] - 50) < 1e-9);

  // On Mercator a rhumb line is straight: every point on one line from the start.
  const merc = ([lon, lat]) => [
    lon,
    (Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * 180) / Math.PI,
  ];
  const [p0, ...rest] = rhumb([-5, 36], 60, 40, 8).map(merc);
  for (const [a, b] of rest) {
    const slope = (b - p0[1]) / (a - p0[0]);
    assert.ok(Math.abs(slope - Math.tan(Math.PI / 6)) < 1e-9, `slope ${slope}`);
  }
});

test('a rhumb line stops short of the pole and wraps at the seam', () => {
  const up = rhumb([0, 80], 10, 30, 30);
  assert.ok(up.length < 31);
  for (const [, lat] of up) assert.ok(lat <= 85);

  const across = rhumb([170, 0], 90, 20, 2);
  assert.ok(Math.abs(across[2][0] - -170) < 1e-9, `wrapped to ${across[2][0]}`);
});

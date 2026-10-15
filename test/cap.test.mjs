import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withinCap } from '../lib/index.js';

test('a cap admits its centre and refuses its antipode', () => {
  const visible = withinCap([10, 0], 90);
  assert.equal(visible(10, 0), true);
  assert.equal(visible(-170, 0), false);
  // Even the widest cap refuses the antipode: strictly within.
  assert.equal(withinCap([10, 20], 180)(-170, -20), false);
  assert.equal(withinCap([10, 20], 180)(-170, -19), true);
});

test('either side of the rim', () => {
  const visible = withinCap([0, 0], 90);
  assert.equal(visible(89, 0), true);
  assert.equal(visible(91, 0), false);
  assert.equal(visible(0, 89), true);
  assert.equal(visible(0, -89), true);
  // Across the seam: 179 is 2° from -179, a long way from 0.
  const seam = withinCap([180, 0], 10);
  assert.equal(seam(-179, 0), true);
  assert.equal(seam(175, 0), true);
  assert.equal(seam(165, 0), false);
});

test('a cap centred off the equator follows great circles, not degrees of longitude', () => {
  // From 60°N, 30° of longitude along the parallel is only ~15° of arc.
  const visible = withinCap([0, 60], 16);
  assert.equal(visible(30, 60), true);
  assert.equal(visible(34, 60), false);
  // Over the pole: 60°N on the far meridian is 60° away.
  assert.equal(visible(180, 60), false);
  assert.equal(withinCap([0, 60], 61)(180, 60), true);
});

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  limn,
  trace,
  fill,
  runs,
  hatch,
  place,
  letter,
  footprint,
  boundingBox,
} from '../lib/index.js';

// The deprecated names must still do what they did, and say so once. Each
// test uses a name no earlier test has, since a warning is once per process.
let warnings;
let warn;
beforeEach(() => {
  warnings = [];
  warn = console.warn;
  console.warn = (message) => warnings.push(message);
});
afterEach(() => {
  console.warn = warn;
});

const ring = [
  [0, 0],
  [10, 0],
  [10, 10],
  [0, 10],
  [0, 0],
];
const line = [
  [170, 0],
  [179, 1],
  [-179, 2],
  [-170, 3],
];

function path() {
  const calls = [];
  const record =
    (name) =>
    (...args) =>
      calls.push([name, ...args]);
  return {
    calls,
    save() {},
    restore() {},
    beginPath: record('beginPath'),
    closePath: record('closePath'),
    moveTo: record('moveTo'),
    lineTo: record('lineTo'),
    stroke: record('stroke'),
    fill: record('fill'),
    clip: record('clip'),
    setLineDash() {},
    translate: record('translate'),
    rotate: record('rotate'),
    fillText: record('fillText'),
    measureText: (text) => ({ width: text.length * 6 }),
  };
}

const project = ([lon, lat]) => [lon * 2, lat * 3];

test('the callback pair draws what project draws, and warns once', () => {
  const x = (lon) => lon * 2;
  const y = (lat) => lat * 3;
  const old = path();
  limn(old, [ring], x, y, {});
  limn(old, [ring], x, y, {});
  const now = path();
  limn(now, [ring], project);
  limn(now, [ring], project);
  assert.deepEqual(old.calls, now.calls);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /callback pair/);
});

test('the pair is detected by arity in every function that takes it', () => {
  const x = (lon) => lon * 2;
  const y = (lat) => lat * 3;
  const same = (draw, ...rest) => {
    const old = path();
    const now = path();
    draw(old, ...rest, x, y);
    draw(now, ...rest, project);
    assert.deepEqual(old.calls, now.calls);
  };
  same(trace, [[ring]]);
  same(fill, [[ring]]);
  same(hatch, [[ring]]);
  assert.deepEqual(runs([line], x, y), runs([line], project));
  const names = [{ text: 'Fiji', at: [5, 5] }];
  assert.deepEqual(place(path(), names, x, y), place(path(), names, project));
  const old = path();
  const now = path();
  assert.deepEqual(letter(old, names, x, y), letter(now, names, project));
  assert.deepEqual(old.calls, now.calls);
});

test('each of the pair receives the other coordinate second', () => {
  const calls = [];
  limn(
    path(),
    [[[10, 20]]],
    (lon, lat) => (calls.push(['x', lon, lat]), lon),
    (lat, lon) => (calls.push(['y', lat, lon]), lat),
    {},
  );
  assert.deepEqual(calls, [
    ['x', 10, 20],
    ['y', 20, 10],
  ]);
});

test('lonCenter is centralMeridian, and warns', () => {
  assert.deepEqual(
    runs([line], project, { lonCenter: 180 }),
    runs([line], project, { centralMeridian: 180 }),
  );
  assert.equal(runs([line], project, { lonCenter: 180 }).length, 1);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /lonCenter/);
});

test('the new name wins when both are given', () => {
  assert.equal(runs([line], project, { lonCenter: 0, centralMeridian: 180 }).length, 1);
});

test('limn takes cap as lineCap, and warns', () => {
  const ctx = path();
  limn(ctx, [ring], project, { cap: 'round' });
  assert.equal(ctx.lineCap, 'round');
  assert.ok(warnings.some((message) => /`cap`/.test(message)));
});

test('footprint is boundingBox, and warns', () => {
  const run = [
    [0, 0],
    [10, 0],
    [10, 4],
    [0, 4],
    [0, 0],
  ];
  assert.deepEqual(footprint(run), boundingBox(run));
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /footprint/);
});

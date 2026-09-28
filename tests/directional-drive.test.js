import assert from 'node:assert/strict';
import test from 'node:test';
import { createDirectionalDrive } from '../assets/shared/directional-drive.js';
import { CAMERA_AZIMUTH, CAMERA_ELEVATION } from '../assets/shared/camera-rig.js';
import { createRideSession } from '../assets/surf-rides/ride-session.js';
import { createRace } from '../assets/bay-racer/race.js';

const camera = { azimuth: CAMERA_AZIMUTH, elevation: CAMERA_ELEVATION };
const makeDrive = () => createDirectionalDrive(camera);
const angleDifference = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const near = (actual, expected, tolerance = 1e-10) =>
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} should be near ${expected}`);

function screenDirection(heading, speed = 1) {
  const x = Math.sin(heading) * speed;
  const z = Math.cos(heading) * speed;
  const horizontal = x * Math.cos(camera.azimuth) - z * Math.sin(camera.azimuth);
  const vertical =
    (x * Math.sin(camera.azimuth) + z * Math.cos(camera.azimuth)) * Math.sin(camera.elevation);
  const length = Math.hypot(horizontal, vertical);
  return { x: horizontal / length, y: vertical / length };
}

const directions = [
  { input: { up: true }, x: 0, y: -1 },
  { input: { down: true }, x: 0, y: 1 },
  { input: { left: true }, x: -1, y: 0 },
  { input: { right: true }, x: 1, y: 0 },
  { input: { up: true, left: true }, x: -1, y: -1 },
  { input: { up: true, right: true }, x: 1, y: -1 },
  { input: { down: true, left: true }, x: -1, y: 1 },
  { input: { down: true, right: true }, x: 1, y: 1 },
];

test('screen-down drives forward when facing down and screen-up reverses without turning', () => {
  const state = { heading: camera.azimuth, speed: 0 };
  const drive = makeDrive();
  const forward = drive.update({ down: true }, state);
  assert.equal(forward.gas, true);
  assert.equal(forward.reverse, false);
  near(forward.steering, 0);
  const reverse = drive.update({ up: true }, state);
  assert.equal(reverse.gas, false);
  assert.equal(reverse.reverse, true);
  near(reverse.steering, 0);
});

test('all eight screen directions preserve their projection in forward and reverse', () => {
  for (const direction of directions) {
    const expectedHeading = Math.atan2(
      direction.x * Math.cos(camera.azimuth) +
        (direction.y / Math.sin(camera.elevation)) * Math.sin(camera.azimuth),
      -direction.x * Math.sin(camera.azimuth) +
        (direction.y / Math.sin(camera.elevation)) * Math.cos(camera.azimuth),
    );
    for (const gear of [1, -1]) {
      const heading = expectedHeading + (gear === -1 ? Math.PI : 0);
      const output = makeDrive().update(direction.input, { heading, speed: 0 });
      assert.equal(output.gas, gear === 1);
      assert.equal(output.reverse, gear === -1);
      near(output.steering, 0);
      const projected = screenDirection(heading, gear);
      near(projected.x, direction.x / Math.hypot(direction.x, direction.y));
      near(projected.y, direction.y / Math.hypot(direction.x, direction.y));
    }
  }
});

test('side arrows apply throttle from rest and steering settles across the angle boundary', () => {
  for (const input of [{ left: true }, { right: true }]) {
    const output = makeDrive().update(input, { heading: camera.azimuth, speed: 0 });
    assert.equal(output.gas, true);
    assert.equal(Math.abs(output.steering), 1);
  }
  const drive = createDirectionalDrive({ azimuth: 0, elevation: Math.PI / 2 });
  const output = drive.update({ up: true }, { heading: -Math.PI + 0.02, speed: 2 });
  assert.equal(output.gas, true);
  near(output.steering, -0.05);
});

test('reversal chooses gear from heading but steers according to current motion', () => {
  const heading = camera.azimuth - 0.1;
  const forwardMotion = makeDrive().update({ up: true }, { heading, speed: 4 });
  const reverseMotion = makeDrive().update({ up: true }, { heading, speed: -4 });
  const stopped = makeDrive().update({ up: true }, { heading, speed: 0 });
  for (const output of [forwardMotion, reverseMotion, stopped]) assert.equal(output.reverse, true);
  near(forwardMotion.steering, 0.25);
  near(reverseMotion.steering, -0.25);
  near(stopped.steering, -0.25);
});

test('gear remains stable near perpendicular and neutral or reset restores a forward preference', () => {
  const drive = makeDrive();
  const facing = (offset) => ({ heading: camera.azimuth + offset, speed: 0 });
  assert.equal(drive.update({ down: true }, facing(Math.PI)).reverse, true);
  for (const offset of [Math.PI / 2 - 0.04, Math.PI / 2 + 0.04, Math.PI / 2 - 0.1])
    assert.equal(drive.update({ down: true }, facing(offset)).reverse, true);
  assert.equal(drive.update({ down: true }, facing(Math.PI / 2 - 0.3)).gas, true);
  drive.update({ down: true }, facing(Math.PI));
  drive.update({}, facing(0));
  assert.equal(drive.update({ down: true }, facing(Math.PI / 2)).gas, true);
  drive.update({ down: true }, facing(Math.PI));
  drive.reset();
  assert.equal(drive.update({ down: true }, facing(Math.PI / 2)).gas, true);
});

test('neutral inputs coast, preserve brake/boost and remove stale directional steering fields', () => {
  const drive = makeDrive();
  const target = { up: true, down: true, left: true, right: true, brake: true, boost: true };
  assert.equal(drive.update(target, { heading: 0, speed: 8 }, target), target);
  assert.deepEqual(target, { gas: false, reverse: false, steering: 0, brake: true, boost: true });
  const horizontal = drive.update(
    { up: true, down: true, right: true },
    { heading: camera.azimuth + Math.PI / 2, speed: 0 },
  );
  assert.equal(horizontal.gas, true);
  near(horizontal.steering, 0);
  for (const heading of [undefined, NaN, Infinity]) {
    const output = drive.update({ up: true }, { heading, speed: 0 });
    assert.equal(output.gas, false);
    assert.equal(output.reverse, false);
    assert.equal(output.steering, 0);
  }
});

function openWorld() {
  return {
    bounds: { minX: -2000, maxX: 2000, minZ: -2000, maxZ: 2000 },
    spawn: { x: 0, z: 0 },
    dropoff: { x: 1000, z: 1000 },
    pickups: [
      { id: 'first', x: 1100, z: 1100 },
      { id: 'second', x: 1200, z: 1200 },
    ],
    roads: [{ x1: -2000, z1: 0, x2: 2000, z2: 0, width: 4000 }],
    obstacles: [],
    gates: [
      { x: 0, z: 0, normal: { x: 0, z: 1 }, halfWidth: 10 },
      { x: 1000, z: 1000, normal: { x: 0, z: 1 }, halfWidth: 10 },
    ],
  };
}

for (const [name, createSimulation] of [
  ['Jeep', createRideSession],
  ['boat', createRace],
]) {
  test(`${name} converges to every screen direction from several headings in forward and reverse`, () => {
    for (const direction of directions) {
      for (const heading of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
        const simulation = createSimulation(openWorld());
        simulation.start();
        Object.assign(simulation.state, { mode: name === 'Jeep' ? 'playing' : 'racing', heading });
        const drive = makeDrive();
        const output = {};
        for (let frame = 0; frame < 480; frame++)
          simulation.update(1 / 60, drive.update(direction.input, simulation.state, output));
        const projected = screenDirection(
          simulation.state.heading,
          Math.sign(simulation.state.speed),
        );
        const expected = Math.atan2(direction.y, direction.x);
        const actual = Math.atan2(projected.y, projected.x);
        assert.ok(
          Math.abs(angleDifference(actual, expected)) < 0.04,
          `${name}: ${JSON.stringify(direction.input)} from ${heading} converged to ${actual}, expected ${expected}`,
        );
        assert.ok(Math.abs(simulation.state.speed) > 4);
      }
    }
  });

  test(`${name} changes direction while moving without oscillating between forward and reverse`, () => {
    const simulation = createSimulation(openWorld());
    simulation.start();
    Object.assign(simulation.state, {
      mode: name === 'Jeep' ? 'playing' : 'racing',
      heading: camera.azimuth - 0.2,
      speed: 12,
    });
    const drive = makeDrive();
    const output = {};
    for (const direction of [directions[0], directions[3], directions[1]]) {
      const requestedGear = drive.update(direction.input, simulation.state).gas;
      for (let frame = 0; frame < 480; frame++) {
        drive.update(direction.input, simulation.state, output);
        assert.equal(output.gas, requestedGear);
        simulation.update(1 / 60, output);
      }
      const actual = screenDirection(simulation.state.heading, simulation.state.speed);
      near(actual.x, direction.x, 0.02);
      near(actual.y, direction.y, 0.02);
    }
  });
}

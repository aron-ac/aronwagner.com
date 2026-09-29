import assert from 'node:assert/strict';
import test from 'node:test';
import { mapVehicleInput } from '../assets/shared/vehicle-drive.js';
import { createRace, NORMAL_SPEED, BOOST_SPEED, REVERSE_SPEED } from '../assets/bay-racer/race.js';
import { CAMERA_AZIMUTH, CAMERA_ELEVATION } from '../assets/shared/camera-rig.js';

const near = (actual, expected, tolerance = 1e-10) =>
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} should be near ${expected}`);
const angleDifference = (to, from) => Math.atan2(Math.sin(to - from), Math.cos(to - from));

function createSession(heading = 0, speed = 0) {
  const race = createRace({
    bounds: { minX: -2000, maxX: 2000, minZ: -2000, maxZ: 2000 },
    obstacles: [],
    gates: [
      { x: 0, z: 0, normal: { x: 0, z: 1 }, halfWidth: 10 },
      { x: 1000, z: 1000, normal: { x: 0, z: 1 }, halfWidth: 10 },
    ],
  });
  race.start();
  Object.assign(race.state, {
    mode: 'racing',
    x: 0,
    z: 0,
    heading,
    speed,
    vx: Math.sin(heading) * speed,
    vz: Math.cos(heading) * speed,
  });
  return race;
}

function run(race, seconds, keys = {}, { fps = 60, touch = null } = {}) {
  const input = {};
  for (let frame = 0; frame < Math.round(seconds * fps); frame++) {
    mapVehicleInput(keys, touch, race.state, input);
    input.boost = Boolean(keys.boost);
    race.update(1 / fps, input);
  }
}

function projectHeading(heading) {
  const x = Math.sin(heading),
    z = Math.cos(heading);
  return Math.atan2(
    (x * Math.sin(CAMERA_AZIMUTH) + z * Math.cos(CAMERA_AZIMUTH)) * Math.sin(CAMERA_ELEVATION),
    x * Math.cos(CAMERA_AZIMUTH) - z * Math.sin(CAMERA_AZIMUTH),
  );
}

test('boat steering alone does not spin or propel a stationary hull', () => {
  for (const key of ['left', 'right']) {
    const race = createSession(0.9);
    run(race, 1, { [key]: true });
    near(race.state.heading, 0.9);
    near(race.state.x, 0);
    near(race.state.z, 0);
    near(race.state.speed, 0);
    assert.ok(Math.abs(race.state.steer) > 0.99);
  }
});

test('boat simultaneous keyboard throttle and steering drive visible clockwise or counterclockwise curves', () => {
  for (const [key, sign] of [
    ['right', 1],
    ['left', -1],
  ]) {
    const race = createSession(CAMERA_AZIMUTH + Math.PI, NORMAL_SPEED);
    let previousAngle = projectHeading(race.state.heading);
    let totalTurn = 0;
    for (let frame = 0; frame < 300; frame++) {
      run(race, 1 / 60, { up: true, [key]: true });
      const angle = projectHeading(race.state.heading);
      const delta = angleDifference(angle, previousAngle);
      assert.ok(delta * sign > 0, 'Steering must turn in the visible requested direction');
      totalTurn += delta;
      previousAngle = angle;
    }
    assert.ok(totalTurn * sign > Math.PI * 2);
    near(race.state.speed, NORMAL_SPEED);
    assert.ok(Math.hypot(race.state.x, race.state.z) > 1);
  }
});

test('boat retains its normal and reverse speed limits while reverse mirrors steering', () => {
  for (const [keys, expected] of [
    [{ up: true }, NORMAL_SPEED],
    [{ down: true }, -REVERSE_SPEED],
  ]) {
    const race = createSession();
    run(race, 4, keys);
    near(race.state.speed, expected);
    assert.equal(Math.sign(race.state.z), Math.sign(expected));
    run(race, 0.5, { ...keys, right: true });
    assert.equal(Math.sign(race.state.heading), -Math.sign(expected));
  }
});

test('boat opposite pedal stops completely before accelerating in the other direction', () => {
  for (const [speed, keys, sign] of [
    [NORMAL_SPEED, { down: true }, -1],
    [-REVERSE_SPEED, { up: true }, 1],
  ]) {
    const race = createSession(0, speed);
    let stopped = false;
    let changedDirection = false;
    for (let frame = 0; frame < 180; frame++) {
      run(race, 1 / 60, keys);
      if (race.state.speed === 0) stopped = true;
      if (race.state.speed * sign > 0) {
        assert.ok(stopped, 'Reversal must include a stopped simulation step');
        changedDirection = true;
      }
    }
    assert.ok(changedDirection);
    near(race.state.speed, sign > 0 ? NORMAL_SPEED : -REVERSE_SPEED);
    near(race.state.heading, 0);
    assert.equal(Math.sign(race.state.vz), sign);
  }
});

test('boat touch distance sustains proportional speed in either gear', () => {
  for (const [progress, direction] of [
    [0.5, 1],
    [0.25, 1],
    [0.5, -1],
  ]) {
    const race = createSession();
    run(
      race,
      8,
      {},
      {
        touch: { active: true, heading: direction > 0 ? 0 : Math.PI, progress },
      },
    );
    const limit = direction > 0 ? NORMAL_SPEED : REVERSE_SPEED;
    near(race.state.speed, direction * limit * progress ** 3);
    assert.ok(Math.abs(race.state.speed) < limit / 2);
  }
});

test('boat touch steers toward a world bearing through motion without snapping its nose', () => {
  const race = createSession();
  const touch = { active: true, heading: Math.PI / 2, progress: 1 };
  run(race, 1 / 60, {}, { touch });
  assert.ok(race.state.heading > 0 && race.state.heading < 0.01);
  run(race, 4, {}, { touch });
  near(race.state.heading, touch.heading, 0.003);
  assert.ok(race.state.vx > 18);
  assert.ok(Math.abs(race.state.vz) < 0.2);
});

test('boat moving a touch closer eases down from cruise without snapping speed', () => {
  const race = createSession(0, NORMAL_SPEED);
  const touch = { active: true, heading: 0, progress: 0.5 };
  run(race, 1 / 60, {}, { touch });
  assert.ok(race.state.speed < NORMAL_SPEED && race.state.speed > NORMAL_SPEED * 0.95);
  let previousSpeed = race.state.speed;
  for (let frame = 0; frame < 120; frame++) {
    run(race, 1 / 60, {}, { touch });
    assert.ok(race.state.speed <= previousSpeed);
    assert.ok(previousSpeed - race.state.speed < 0.25);
    previousSpeed = race.state.speed;
  }
  near(race.state.speed, NORMAL_SPEED / 8);
});

test('boat steering switches ease smoothly and a released touch coasts to a predictable stop', () => {
  const race = createSession(0, NORMAL_SPEED);
  run(race, 0.5, { up: true, right: true });
  const previous = race.state.steer;
  run(race, 1 / 60, { up: true, left: true });
  assert.ok(race.state.steer < 0 && race.state.steer > previous);
  const straight = createSession(0, NORMAL_SPEED);
  run(straight, 1 / 60);
  assert.ok(straight.state.speed < NORMAL_SPEED && straight.state.speed > NORMAL_SPEED * 0.95);
  run(straight, 4.5);
  near(straight.state.speed, 0);
  assert.ok(Math.hypot(straight.state.vx, straight.state.vz) < 0.01);
  assert.ok(straight.state.z > 16 && straight.state.z < 26, `Coast distance: ${straight.state.z}`);
});

test('boat boost preserves its strong 33-unit top speed, drains its meter, then eases to normal speed', () => {
  const race = createSession(0, NORMAL_SPEED);
  run(race, 0.25, { up: true, boost: true });
  assert.ok(race.state.speed >= 25.9, 'Boost should produce a clear immediate acceleration');
  run(race, 0.5, { up: true, boost: true });
  near(race.state.speed, BOOST_SPEED);
  assert.equal(race.state.boosting, true);
  near(race.state.boost, 100 - 34 * 0.75, 1e-8);
  const previousSpeed = race.state.speed;
  run(race, 1 / 60, { up: true });
  assert.equal(race.state.boosting, false);
  assert.ok(race.state.speed < previousSpeed && race.state.speed > previousSpeed * 0.95);
  run(race, 1.5, { up: true });
  near(race.state.speed, NORMAL_SPEED);
});

test('boat boost depletion locks until it recharges and cannot propel a neutral, reversing or braking boat', () => {
  const race = createSession(0, NORMAL_SPEED);
  run(race, 3.1, { up: true, boost: true });
  assert.equal(race.state.boostLocked, true);
  assert.equal(race.state.boosting, false);
  run(race, 1, { up: true, boost: true });
  assert.equal(race.state.boostLocked, true);
  assert.equal(race.state.boosting, false);
  run(race, 1, { up: true, boost: true });
  assert.equal(race.state.boostLocked, false);
  assert.equal(race.state.boosting, true);
  for (const keys of [
    { boost: true },
    { down: true, boost: true },
    { up: true, brake: true, boost: true },
  ]) {
    const inactive = createSession();
    run(inactive, 1, keys);
    assert.equal(inactive.state.boosting, false);
    assert.equal(inactive.state.boost, 100);
  }
  const reversing = createSession(0, -REVERSE_SPEED);
  run(reversing, 0.1, { up: true, boost: true });
  assert.equal(reversing.state.boosting, false);
  assert.equal(reversing.state.boost, 100);
});

test('boat brake overrides pedals and quickly removes water momentum', () => {
  const race = createSession(0, BOOST_SPEED);
  run(race, 2, { up: true, down: true, boost: true, brake: true });
  assert.ok(Math.abs(race.state.speed) < 0.001);
  assert.ok(Math.hypot(race.state.vx, race.state.vz) < 0.001);
  assert.equal(race.state.boosting, false);
});

test('boat driving paths remain consistent across phone and desktop frame rates', () => {
  const states = [20, 60, 120].map((fps) => {
    const race = createSession();
    run(race, 1, { up: true }, { fps });
    run(race, 0.5, { up: true, right: true }, { fps });
    run(race, 0.5, { up: true, left: true }, { fps });
    run(race, 1, { down: true }, { fps });
    return race.state;
  });
  for (const state of states) {
    const reference = states[1];
    near(state.heading, reference.heading, 0.03);
    near(state.speed, reference.speed, 0.3);
    assert.ok(Math.hypot(state.x - reference.x, state.z - reference.z) < 0.3);
  }
});

test('boat pause freezes motion, and recovery and restart clear steering and velocity', () => {
  const race = createSession(0, NORMAL_SPEED);
  run(race, 0.3, { up: true, right: true });
  assert.ok(race.state.steer < -0.9);
  race.pause();
  const paused = structuredClone(race.state);
  run(race, 0.5, { down: true, left: true });
  assert.deepEqual(race.state, paused);
  race.resume();
  race.recover();
  for (const key of ['speed', 'steer', 'vx', 'vz']) assert.equal(race.state[key], 0);
  const heading = race.state.heading;
  run(race, 0.5);
  near(race.state.heading, heading);
  run(race, 0.5, { up: true, left: true });
  assert.ok(race.state.steer > 0.9);
  race.start();
  for (const key of ['speed', 'steer', 'vx', 'vz']) assert.equal(race.state[key], 0);
});

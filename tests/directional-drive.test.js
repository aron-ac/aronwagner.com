import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyDirectionalHeading,
  createDirectionalDrive,
} from '../assets/shared/directional-drive.js';
import { CAMERA_AZIMUTH, CAMERA_ELEVATION } from '../assets/shared/camera-rig.js';
import { createRideSession } from '../assets/surf-rides/ride-session.js';
import { createRace } from '../assets/bay-racer/race.js';

const camera = { azimuth: CAMERA_AZIMUTH, elevation: CAMERA_ELEVATION };
const makeDrive = () => createDirectionalDrive(camera);
const angleDifference = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const near = (actual, expected, tolerance = 1e-10) =>
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} should be near ${expected}`);

function project(x, z) {
  return {
    x: x * Math.cos(camera.azimuth) - z * Math.sin(camera.azimuth),
    y: (x * Math.sin(camera.azimuth) + z * Math.cos(camera.azimuth)) * Math.sin(camera.elevation),
  };
}

const directions = [
  { input: { up: true }, x: 0, y: -1 },
  { input: { down: true }, x: 0, y: 1 },
  { input: { left: true }, x: -1, y: 0 },
  { input: { right: true }, x: 1, y: 0 },
];
const headingFor = (direction) => makeDrive().update(direction.input, { heading: 0 }).targetHeading;

function assertDirection(vector, direction, tolerance = 0.02) {
  assert.ok(Math.hypot(vector.x, vector.y) > 0.1, 'The vehicle must actually be moving');
  const actual = Math.atan2(vector.y, vector.x);
  const expected = Math.atan2(direction.y, direction.x);
  assert.ok(
    Math.abs(angleDifference(actual, expected)) < tolerance,
    `Projected angle ${actual} should approach ${expected}`,
  );
}

test('cardinal arrows always request nose-first travel in their screen direction', () => {
  for (const direction of directions) {
    for (const heading of [
      0,
      Math.PI / 2,
      Math.PI,
      -Math.PI / 2,
      headingFor(direction) + Math.PI,
    ]) {
      const output = makeDrive().update(direction.input, { heading, speed: 0 });
      assert.equal(output.gas, true);
      assert.equal(output.reverse, false);
      assert.equal(output.turnRate, 0);
      assertDirection(
        project(Math.sin(output.targetHeading), Math.cos(output.targetHeading)),
        direction,
      );
    }
  }
});

test('holding vertical + right circles clockwise and vertical + left circles counterclockwise', () => {
  for (const vertical of ['up', 'down']) {
    for (const [horizontal, sign] of [
      ['right', -1],
      ['left', 1],
    ]) {
      const output = makeDrive().update({ [vertical]: true, [horizontal]: true }, { heading: 0 });
      assert.equal(output.gas, true);
      assert.equal(output.reverse, false);
      assert.equal(output.targetHeading, null);
      assert.equal(Math.sign(output.turnRate), sign);
      near(Math.abs(output.turnRate), 2.4);
    }
  }
});

test('neutral inputs coast, preserve brake/boost and erase stale aiming or circle commands', () => {
  const drive = makeDrive();
  const target = drive.update({ up: true, right: true }, { heading: 0 });
  Object.assign(target, {
    up: true,
    down: true,
    left: true,
    right: true,
    brake: true,
    boost: true,
  });
  assert.equal(drive.update(target, { heading: 0, speed: 8 }, target), target);
  assert.deepEqual(target, {
    gas: false,
    reverse: false,
    steering: 0,
    brake: true,
    boost: true,
    targetHeading: null,
    turnRate: 0,
  });
  drive.reset();
  const singleAxis = drive.update({ up: true, down: true, right: true }, { heading: 0 }, target);
  assert.equal(singleAxis.turnRate, 0);
  assertDirection(
    project(Math.sin(singleAxis.targetHeading), Math.cos(singleAxis.targetHeading)),
    directions[3],
  );
  for (const heading of [undefined, NaN, Infinity]) {
    const output = drive.update({ up: true }, { heading, speed: 0 }, target);
    assert.equal(output.gas, false);
    assert.equal(output.targetHeading, null);
    assert.equal(output.turnRate, 0);
  }
});

test('assisted aiming follows the shortest arc without overshoot across the angle boundary', () => {
  for (const frameRate of [20, 60, 120]) {
    for (const [heading, targetHeading] of [
      [-Math.PI + 0.1, Math.PI - 0.1],
      [Math.PI - 0.1, -Math.PI + 0.1],
    ]) {
      const state = { heading, steer: 0 };
      let error = angleDifference(targetHeading, state.heading);
      const turnSign = Math.sign(error);
      for (let frame = 0; frame < frameRate; frame++) {
        applyDirectionalHeading(state, { gas: true, targetHeading }, 1 / frameRate);
        const nextError = angleDifference(targetHeading, state.heading);
        assert.ok(Math.abs(nextError) <= Math.abs(error) + 1e-12);
        assert.equal(Math.sign(nextError), turnSign);
        error = nextError;
      }
      near(error, 0, 0.001);
    }
  }
});

test('exact U-turns choose a deterministic route and legacy inputs remain unassisted', () => {
  for (const heading of [-Math.PI, 0, Math.PI, Math.PI * 9]) {
    const state = { heading, steer: 0 };
    applyDirectionalHeading(state, { gas: true, targetHeading: heading + Math.PI }, 1 / 60);
    assert.ok(state.heading > heading);
  }
  const state = { heading: 2, steer: -1 };
  assert.equal(applyDirectionalHeading(state, { gas: true, left: true }, 1 / 60), null);
  assert.deepEqual(state, { heading: 2, steer: -1 });
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
  const start = (heading, speed = 0) => {
    const simulation = createSimulation(openWorld());
    simulation.start();
    Object.assign(simulation.state, {
      mode: name === 'Jeep' ? 'playing' : 'racing',
      x: 0,
      z: 0,
      heading,
      speed,
      vx: Math.sin(heading) * speed,
      vz: Math.cos(heading) * speed,
    });
    return simulation;
  };
  const velocity = (state) =>
    name === 'boat'
      ? project(state.vx, state.vz)
      : project(Math.sin(state.heading) * state.speed, Math.cos(state.heading) * state.speed);

  test(`${name} turns nose-first toward every cardinal direction within one second from rest or cruise`, () => {
    for (const frameRate of [20, 60, 120]) {
      for (const direction of directions) {
        for (const heading of [
          0,
          Math.PI / 2,
          Math.PI,
          -Math.PI / 2,
          headingFor(direction) + Math.PI,
        ]) {
          for (const speed of [0, 19]) {
            const simulation = start(heading, speed);
            const drive = makeDrive();
            const output = {};
            for (let frame = 0; frame < frameRate; frame++) {
              simulation.update(
                1 / frameRate,
                drive.update(direction.input, simulation.state, output),
              );
              assert.equal(output.reverse, false);
              assert.ok(simulation.state.speed >= 0);
            }
            assertDirection(
              project(Math.sin(simulation.state.heading), Math.cos(simulation.state.heading)),
              direction,
            );
            assertDirection(velocity(simulation.state), direction);
            assert.ok(simulation.state.speed > 3);
          }
        }
      }
    }
  });

  test(`${name} starts moving the requested way within half a second during a full-speed U-turn`, () => {
    for (const frameRate of [20, 60, 120]) {
      for (const direction of directions) {
        const heading = headingFor(direction) + Math.PI;
        const simulation = start(heading, 19);
        const drive = makeDrive();
        let wrongWayDistance = 0;
        for (let frame = 0; frame < frameRate / 2; frame++) {
          simulation.update(1 / frameRate, drive.update(direction.input, simulation.state));
          const position = project(simulation.state.x, simulation.state.z);
          wrongWayDistance = Math.max(
            wrongWayDistance,
            -position.x * direction.x - position.y * direction.y,
          );
        }
        const movement = velocity(simulation.state);
        assert.ok(
          movement.x * direction.x + movement.y * direction.y > 1,
          'Actual velocity must point toward the held arrow',
        );
        assert.ok(wrongWayDistance < 3, `A U-turn drifted ${wrongWayDistance} units the wrong way`);
      }
    }
  });

  test(`${name} held arrow combinations complete continuous circles in the requested direction`, () => {
    for (const frameRate of [20, 60]) {
      for (const vertical of ['up', 'down']) {
        for (const [horizontal, sign] of [
          ['right', -1],
          ['left', 1],
        ]) {
          const simulation = start(0);
          const drive = makeDrive();
          const input = { [vertical]: true, [horizontal]: true };
          let previous = simulation.state.heading;
          let travel = 0;
          for (let frame = 0; frame < frameRate * 3; frame++) {
            const x = simulation.state.x,
              z = simulation.state.z;
            simulation.update(1 / frameRate, drive.update(input, simulation.state));
            assert.ok((simulation.state.heading - previous) * sign > 0);
            travel += Math.hypot(simulation.state.x - x, simulation.state.z - z);
            previous = simulation.state.heading;
          }
          assert.ok(
            simulation.state.heading * sign > Math.PI * 2,
            'A held chord must continue beyond a full revolution',
          );
          assert.ok(travel > 20, 'The vehicle must drive a circle rather than only spin in place');
          near(simulation.state.heading, sign * 7.2, 1e-8);
        }
      }
    }
  });

  test(`${name} responds to repeated cardinal changes after leaving a circle`, () => {
    const simulation = start(0, 12);
    const drive = makeDrive();
    const output = {};
    for (let frame = 0; frame < 90; frame++)
      simulation.update(1 / 60, drive.update({ up: true, right: true }, simulation.state, output));
    for (const direction of [
      directions[0],
      directions[3],
      directions[1],
      directions[2],
      directions[0],
    ]) {
      for (let frame = 0; frame < 60; frame++)
        simulation.update(1 / 60, drive.update(direction.input, simulation.state, output));
      assert.equal(output.turnRate, 0);
      assert.equal(output.reverse, false);
      assertDirection(velocity(simulation.state), direction);
    }
  });

  test(`${name} brake takes precedence over assisted acceleration and neutral permits coasting`, () => {
    const simulation = start(headingFor(directions[0]), 12);
    const drive = makeDrive();
    simulation.update(1 / 60, drive.update({}, simulation.state));
    assert.ok(simulation.state.speed > 0 && simulation.state.speed < 12);
    for (let frame = 0; frame < 120; frame++)
      simulation.update(
        1 / 60,
        drive.update({ up: true, brake: true, boost: true }, simulation.state),
      );
    assert.ok(simulation.state.speed < 0.04);
    if (name === 'boat') {
      assert.equal(simulation.state.boosting, false);
      assert.equal(simulation.state.boost, 100);
    }
  });
}

test('boat boost waits for the nose to face the requested direction', () => {
  const simulation = createRace(openWorld());
  simulation.start();
  Object.assign(simulation.state, { mode: 'racing', heading: headingFor(directions[0]) + Math.PI });
  const drive = makeDrive();
  for (let frame = 0; frame < 12; frame++) {
    simulation.update(1 / 60, drive.update({ up: true, boost: true }, simulation.state));
    assert.equal(simulation.state.boosting, false);
    assert.equal(simulation.state.boost, 100);
  }
  for (let frame = 0; frame < 48; frame++)
    simulation.update(1 / 60, drive.update({ up: true, boost: true }, simulation.state));
  assert.equal(simulation.state.boosting, true);
  assert.ok(simulation.state.boost < 100);
});

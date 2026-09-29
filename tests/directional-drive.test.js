import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyDirectionalHeading,
  createDirectionalDrive,
} from '../assets/shared/directional-drive.js';
import { CAMERA_AZIMUTH, CAMERA_ELEVATION } from '../assets/shared/camera-rig.js';
import { createRace, NORMAL_SPEED } from '../assets/bay-racer/race.js';

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
      assertDirection(
        project(Math.sin(output.targetHeading), Math.cos(output.targetHeading)),
        direction,
      );
    }
  }
});

test('ambiguous multi-arrow input coasts instead of creating diagonals or circles', () => {
  const keys = ['up', 'down', 'left', 'right'];
  for (let mask = 1; mask < 16; mask++) {
    const active = keys.filter((_, index) => mask & (1 << index));
    if (active.length < 2) continue;
    const input = Object.fromEntries(active.map((key) => [key, true]));
    const output = makeDrive().update(input, { heading: 1 });
    assert.equal(output.gas, false);
    assert.equal(output.reverse, false);
    assert.equal(output.targetHeading, null);
    const state = { heading: 1, steer: 0 };
    assert.equal(applyDirectionalHeading(state, output, 1 / 60), 1);
    assert.equal(state.heading, 1);
  }
});

test('neutral inputs coast, preserve brake/boost and erase stale aiming commands', () => {
  const drive = makeDrive();
  const target = drive.update({ up: true }, { heading: 0 });
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
  });
  drive.reset();
  const cardinal = drive.update({ right: true }, { heading: 0 }, target);
  assert.equal(cardinal.gas, true);
  assertDirection(
    project(Math.sin(cardinal.targetHeading), Math.cos(cardinal.targetHeading)),
    directions[3],
  );
  for (const heading of [undefined, NaN, Infinity]) {
    const output = drive.update({ up: true }, { heading, speed: 0 }, target);
    assert.equal(output.gas, false);
    assert.equal(output.targetHeading, null);
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

{
  const name = 'boat';
  const cruisingSpeed = NORMAL_SPEED;
  const start = (heading, speed = 0) => {
    const simulation = createRace(openWorld());
    simulation.start();
    Object.assign(simulation.state, {
      mode: 'racing',
      x: 0,
      z: 0,
      heading,
      speed,
      vx: Math.sin(heading) * speed,
      vz: Math.cos(heading) * speed,
    });
    return simulation;
  };
  const velocity = (state) => project(state.vx, state.vz);

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
          for (const speed of [0, cruisingSpeed]) {
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
        const simulation = start(heading, cruisingSpeed);
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

  test(`${name} responds to repeated cardinal changes without circling`, () => {
    const simulation = start(0, 12);
    const drive = makeDrive();
    const output = {};
    for (const direction of [
      directions[0],
      directions[3],
      directions[1],
      directions[2],
      directions[0],
    ]) {
      for (let frame = 0; frame < 60; frame++)
        simulation.update(1 / 60, drive.update(direction.input, simulation.state, output));
      assert.equal(output.reverse, false);
      assertDirection(velocity(simulation.state), direction);
      const settledHeading = simulation.state.heading;
      for (let frame = 0; frame < 120; frame++)
        simulation.update(1 / 60, drive.update(direction.input, simulation.state, output));
      near(simulation.state.heading, settledHeading, 0.001);
      assertDirection(velocity(simulation.state), direction);
    }
  });

  test(`${name} eases moving quarter-turns without snapping steering or shedding most of its speed`, () => {
    for (const [from, to] of [
      [directions[0], directions[3]],
      [directions[3], directions[0]],
      [directions[1], directions[2]],
      [directions[2], directions[1]],
    ]) {
      const initialHeading = headingFor(from);
      const simulation = start(initialHeading, cruisingSpeed);
      const drive = makeDrive();
      const dt = 1 / 60;
      simulation.update(dt, drive.update(to.input, simulation.state));
      const firstTurn = Math.abs(angleDifference(simulation.state.heading, initialHeading));
      assert.ok(firstTurn > 0 && firstTurn < Math.PI / 90, 'The first frame eases into the turn');
      assert.ok(Math.abs(simulation.state.steer) < 0.4, 'Wheels and boat banking ease in too');
      assert.ok(
        simulation.state.speed > cruisingSpeed * 0.95,
        'Changing direction must not slam the brakes',
      );
      let minimumSpeed = simulation.state.speed;
      let peakTurn = firstTurn;
      for (let frame = 1; frame < 60; frame++) {
        const previous = simulation.state.heading;
        simulation.update(dt, drive.update(to.input, simulation.state));
        peakTurn = Math.max(
          peakTurn,
          Math.abs(angleDifference(simulation.state.heading, previous)),
        );
        minimumSpeed = Math.min(minimumSpeed, simulation.state.speed);
      }
      assert.ok(peakTurn > firstTurn * 1.5, 'Turning builds gradually from its first frame');
      assert.ok(minimumSpeed > cruisingSpeed * 0.65, 'Ordinary corners preserve forward momentum');
      assertDirection(velocity(simulation.state), to);
      assert.ok(Math.abs(simulation.state.steer) < 0.02, 'Steering settles at the new direction');
    }
  });

  test(`${name} eases through a brief neutral gap and an opposite steering request`, () => {
    const simulation = start(headingFor(directions[0]), cruisingSpeed);
    const drive = makeDrive();
    const dt = 1 / 60;
    for (let frame = 0; frame < 6; frame++)
      simulation.update(dt, drive.update(directions[3].input, simulation.state));
    let previousSteer = simulation.state.steer;
    const turningSign = Math.sign(previousSteer);
    assert.notEqual(turningSign, 0);
    for (let frame = 0; frame < 3; frame++) {
      simulation.update(dt, drive.update({}, simulation.state));
      assert.equal(Math.sign(simulation.state.steer), turningSign);
      assert.ok(Math.abs(simulation.state.steer) < Math.abs(previousSteer));
      assert.ok(Math.abs(simulation.state.steer - previousSteer) < 0.4);
      previousSteer = simulation.state.steer;
    }
    for (let frame = 0; frame < 60; frame++) {
      simulation.update(dt, drive.update(directions[2].input, simulation.state));
      assert.ok(
        Math.abs(simulation.state.steer - previousSteer) < 0.4,
        'Retargeting must not abruptly flip the wheels or boat bank',
      );
      previousSteer = simulation.state.steer;
    }
    assertDirection(velocity(simulation.state), directions[2]);
  });

  test(`${name} moving turns follow the same path across frame rates`, () => {
    const outcomes = [20, 60, 120].map((fps) => {
      const simulation = start(headingFor(directions[0]), cruisingSpeed);
      const drive = makeDrive();
      for (const [direction, seconds] of [
        [directions[3], 0.3],
        [null, 0.05],
        [directions[2], 0.65],
      ]) {
        for (let frame = 0; frame < Math.round(fps * seconds); frame++)
          simulation.update(1 / fps, drive.update(direction?.input ?? {}, simulation.state));
      }
      return simulation.state;
    });
    const reference = outcomes[1];
    for (const state of outcomes) {
      near(angleDifference(state.heading, reference.heading), 0, 0.04);
      near(state.speed, reference.speed, 0.8);
      assert.ok(
        Math.hypot(state.x - reference.x, state.z - reference.z) < 0.8,
        'Frame rate must not noticeably change the turning path',
      );
    }
  });

  test(`${name} settles smoothly when a new arrow falls inside an ongoing U-turn`, () => {
    const simulation = start(headingFor(directions[0]), cruisingSpeed);
    const drive = makeDrive();
    const dt = 1 / 60;
    for (let frame = 0; frame < 18; frame++)
      simulation.update(dt, drive.update(directions[1].input, simulation.state));
    let previousSteer = simulation.state.steer;
    assert.ok(Math.abs(previousSteer) > 0.8, 'Retarget while still turning at speed');
    for (let frame = 0; frame < 60; frame++) {
      simulation.update(dt, drive.update(directions[2].input, simulation.state));
      assert.ok(
        Math.abs(simulation.state.steer - previousSteer) < 0.4,
        'Crossing the new heading must not snap steering to zero',
      );
      previousSteer = simulation.state.steer;
    }
    assertDirection(velocity(simulation.state), directions[2]);
    assert.ok(Math.abs(simulation.state.steer) < 0.02);
  });

  test(`${name} pauses turning momentum and clears it on recovery or restart`, () => {
    const simulation = start(headingFor(directions[0]), cruisingSpeed);
    const drive = makeDrive();
    for (let frame = 0; frame < 6; frame++)
      simulation.update(1 / 60, drive.update(directions[3].input, simulation.state));
    assert.ok(Math.abs(simulation.state.directionalTurnRate) > 1);
    simulation.pause();
    const paused = { ...simulation.state };
    simulation.update(0.1, drive.update(directions[2].input, simulation.state));
    assert.deepEqual(simulation.state, paused, 'Paused steering must stay frozen');
    simulation.resume();
    simulation.recover();
    assert.equal(simulation.state.directionalTurnRate, 0);
    assert.equal(simulation.state.steer, 0);
    const recoveredHeading = simulation.state.heading;
    simulation.update(1 / 60, drive.update({}, simulation.state));
    assert.equal(simulation.state.heading, recoveredHeading, 'Recovery cannot inherit an old turn');
    simulation.update(1 / 60, drive.update(directions[1].input, simulation.state));
    assert.notEqual(simulation.state.directionalTurnRate, 0);
    simulation.start();
    assert.equal(simulation.state.directionalTurnRate, 0);
    assert.equal(simulation.state.steer, 0);
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
    assert.equal(simulation.state.boosting, false);
    assert.equal(simulation.state.boost, 100);
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

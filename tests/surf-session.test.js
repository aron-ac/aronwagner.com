import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createRideSession,
  nearestRoad,
  SHIFT_SECONDS,
} from '../assets/surf-rides/ride-session.js';

function fixture() {
  return {
    bounds: { minX: -62, maxX: 64, minZ: -68, maxZ: 68 },
    spawn: { x: 0, z: 5 },
    dropoff: { x: -53, z: 0 },
    pickups: [
      { id: 'hostel', name: 'Surf Hostel', x: -38, z: -44 },
      { id: 'cafe', name: 'Jungle Café', x: 0, z: -44 },
      { id: 'boards', name: 'Board Shack', x: 38, z: -44 },
    ],
    roads: [
      ...[-38, 0, 38].map((x) => ({ x1: x, z1: -58, x2: x, z2: 58, width: 10 })),
      ...[-44, 0, 44].map((z) => ({ x1: -53, z1: z, x2: 50, z2: z, width: 10 })),
    ],
    obstacles: [{ x: 19, z: 22, radius: 8.5 }],
  };
}
function setup() {
  const world = fixture(),
    events = [];
  const session = createRideSession(
    world,
    (type, detail) => events.push({ type, detail: structuredClone(detail) }),
    { random: () => 0.4 },
  );
  session.start();
  return { world, session, state: session.state, events };
}
function step(session, seconds, input = {}) {
  for (let frame = 0; frame < Math.ceil(seconds * 60); frame++) session.update(1 / 60, input);
}
function stopAt(session, point) {
  Object.assign(session.state, { x: point.x, z: point.z, speed: 0 });
  step(session, 1.2);
}

test('real acceleration and braking reach the first surfer and reset the ride clock', () => {
  const { session, state, events } = setup();
  assert.equal(state.remaining, SHIFT_SECONDS);
  step(session, 177 / 60, { gas: true });
  step(session, 140 / 60, { brake: true });
  assert.equal(state.ride.phase, 'dropoff');
  assert.equal(state.ride.patienceMax, 60);
  assert.ok(events.some((event) => event.type === 'pickup'));
  assert.ok(state.z < -39 && state.z > -49);
});

test('dropoffs reward fare and tips, then dispatch a different pickup', () => {
  const { session, state, world, events } = setup();
  const first = state.ride.pickup;
  stopAt(session, first);
  stopAt(session, world.dropoff);
  assert.equal(state.rides, 1);
  assert.equal(state.streak, 1);
  assert.equal(state.bestStreak, 1);
  const completed = events.find((event) => event.type === 'dropoff').detail;
  assert.equal(state.cash, completed.ride.quote + completed.tip);
  assert.equal(state.totalTips, completed.tip);
  assert.ok(completed.tip > 0);
  assert.equal(state.ride, null);
  step(session, 2.6);
  assert.equal(state.ride.phase, 'pickup');
  assert.notEqual(state.ride.pickup.id, first.id);
});

test('coconuts are once per shift and never extend either clock or change fares', () => {
  const { session, state, events } = setup();
  const coconut = session.coconuts[0];
  Object.assign(state, { x: coconut.x, z: coconut.z, speed: 0 });
  const shift = state.remaining,
    patience = state.ride.patience;
  session.update(1 / 60);
  assert.equal(session.score(), 25);
  assert.equal(state.coconuts, 1);
  assert.equal(state.cash, 0);
  assert.equal(coconut.active, false);
  assert.equal(state.remaining, shift - 1 / 60);
  assert.equal(state.ride.patience, patience - 1 / 60);
  step(session, 1);
  assert.equal(events.filter((event) => event.type === 'coconut').length, 1);
  session.start();
  assert.equal(session.score(), 0);
  assert.ok(session.coconuts.every((item) => item.active));
});

test('collision cooldown prevents repeated comfort penalties while stuck against an obstacle', () => {
  const { session, state, world } = setup();
  stopAt(session, state.ride.pickup);
  const obstacle = world.obstacles[0];
  Object.assign(state, { x: obstacle.x, z: obstacle.z, speed: 8 });
  session.update(1 / 60);
  assert.equal(state.bumps, 1);
  assert.equal(state.ride.comfort, 82);
  assert.ok(Math.hypot(state.x - obstacle.x, state.z - obstacle.z) >= obstacle.radius + 1.3 - 1e-8);
  Object.assign(state, { x: obstacle.x, z: obstacle.z, speed: 8 });
  session.update(1 / 60);
  assert.equal(state.bumps, 1);
  assert.equal(state.ride.comfort, 82);
});

test('paused and ended sessions freeze all gameplay state and ignore recovery', () => {
  const { session, state } = setup();
  for (const mode of ['paused', 'ended']) {
    if (mode === 'paused') session.pause();
    else {
      session.resume();
      session.end();
    }
    const before = structuredClone(state);
    step(session, 3, { gas: true, left: true });
    session.recover();
    session.requestRide();
    assert.deepEqual(state, before);
  }
});

test('expired pickup and passenger requests reset streaks without paying a fare', () => {
  const { session, state, events } = setup();
  for (const phase of ['pickup', 'dropoff']) {
    if (!state.ride) step(session, 2.1);
    if (phase === 'dropoff') stopAt(session, state.ride.pickup);
    state.streak = 3;
    state.ride.patience = 0.01;
    session.update(0.02);
    assert.equal(state.ride, null);
    assert.equal(state.cash, 0);
    assert.equal(state.streak, 0);
  }
  assert.equal(state.missed, 2);
  assert.deepEqual(
    events.filter((event) => event.type === 'expired').map((event) => event.detail.ride.phase),
    ['pickup', 'dropoff'],
  );
});

test('recovery ends a depleted shift once and repeated recovery cannot double charge', () => {
  const { session, state, events } = setup();
  stopAt(session, state.ride.pickup);
  state.x = 12;
  state.z = 10;
  const time = state.remaining;
  session.recover();
  assert.equal(state.remaining, time - 5);
  assert.equal(state.ride.comfort, 92);
  assert.equal(nearestRoad(fixture().roads, state.x, state.z).distance, 0);
  session.recover();
  assert.equal(state.remaining, time - 5);
  state.recoverCooldown = 0;
  state.remaining = 4;
  session.recover();
  assert.equal(state.remaining, 0);
  assert.equal(state.mode, 'ended');
  session.end();
  assert.equal(events.filter((event) => event.type === 'end').length, 1);
});

test('invalid update intervals cannot corrupt the session', () => {
  const { session, state } = setup();
  const before = structuredClone(state);
  for (const dt of [0, -1, NaN, Infinity]) session.update(dt, { gas: true });
  assert.deepEqual(state, before);
});

test('same input and injected randomness produce identical state and events', () => {
  const a = setup(),
    b = setup();
  for (const run of [a, b]) {
    step(run.session, 2, { gas: true });
    step(run.session, 1, { gas: true, left: true });
    step(run.session, 0.5, { brake: true });
    run.session.recover();
    step(run.session, 50);
  }
  assert.deepEqual(a.state, b.state);
  assert.deepEqual(a.events, b.events);
});

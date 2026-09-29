const assert = require('node:assert/strict');
const { settleCamera } = require('./browser.cjs');

async function resetBoat(page) {
  await page.evaluate(() => {
    bayDebug.startRace();
    for (let i = 0; i < 186; i++) bayDebug.update(1 / 60);
    // The open start channel leaves room for short arcs, gear changes and stops.
    Object.assign(bayDebug.state, { heading: 0, speed: 0, steer: 0, vx: 0, vz: 0 });
  });
  await settleCamera(page, 'bayDebug');
}

async function stepBoat(page, frames = 30) {
  return page.evaluate((frames) => {
    for (let i = 0; i < frames; i++) bayDebug.update(1 / 60);
    const { x, z, heading, speed, steer, bumps, mode, boost, boosting, vx, vz } = bayDebug.state;
    return {
      x,
      z,
      heading,
      speed,
      steer,
      bumps,
      mode,
      boost,
      boosting,
      velocity: Math.hypot(vx, vz),
      input: { ...bayDebug.drivingInput },
      touch: bayDebug.touchDrive.snapshot(),
    };
  }, frames);
}

async function groundPoint(page, distance = 8.5, bearing = 0) {
  const point = await page.evaluate(
    ({ distance, bearing }) => {
      const game = bayDebug;
      const viewport = document.getElementById('viewport');
      const bounds = viewport.getBoundingClientRect();
      const heading = game.state.heading + bearing;
      const projected = game.camera.position
        .clone()
        .set(
          game.state.x + Math.sin(heading) * distance,
          0,
          game.state.z + Math.cos(heading) * distance,
        )
        .project(game.camera);
      const x = bounds.left + ((projected.x + 1) * bounds.width) / 2;
      const y = bounds.top + ((1 - projected.y) * bounds.height) / 2;
      const hit = document.elementFromPoint(x, y);
      return {
        x,
        y,
        hit: hit?.id || hit?.tagName,
        reachable: (hit === viewport || hit?.tagName === 'CANVAS') && viewport.contains(hit),
      };
    },
    { distance, bearing },
  );
  assert.equal(
    point.reachable,
    true,
    `Projected boat steering target reaches the scene (${JSON.stringify(point)})`,
  );
  return point;
}

async function pressGround(page, distance = 8.5, bearing = 0) {
  const point = await groundPoint(page, distance, bearing);
  const finger = await page.touchscreen.touchStart(point.x, point.y);
  await page.waitForFunction(() => bayDebug.touchDrive.snapshot().active);
  return finger;
}

async function pressAction(page, action) {
  const rect = await (await page.$(`[data-control="${action}"]`)).boundingBox();
  return page.touchscreen.touchStart(rect.x + rect.width / 2, rect.y + rect.height / 2);
}

async function assertBoatControls(page, label) {
  const buttons = await page.$$eval('[data-control]', (buttons) =>
    buttons.map((button) => {
      const r = button.getBoundingClientRect();
      return {
        action: button.dataset.control,
        width: r.width,
        height: r.height,
        reachable: button.contains(
          document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2),
        ),
      };
    }),
  );
  assert.deepEqual(
    buttons.map((button) => button.action).sort(),
    ['boost', 'brake'],
    `${label}: only independent Brake and Boost buttons remain`,
  );
  assert.equal(await page.$('[data-dpad]'), null, `${label}: the obsolete D-pad is absent`);
  for (const button of buttons)
    assert.ok(
      button.width >= 44 && button.height >= 44 && button.reachable,
      `${label}: ${button.action} is an unobstructed touch target`,
    );
  await groundPoint(page);
}

async function exerciseBoatKeyboard(page) {
  for (const [key, sign] of [
    ['ArrowLeft', 1],
    ['ArrowRight', -1],
    ['KeyA', 1],
    ['KeyD', -1],
  ]) {
    await resetBoat(page);
    await page.keyboard.down(key);
    const state = await stepBoat(page);
    await page.keyboard.up(key);
    assert.ok(state.steer * sign > 0.8, `${key} steers the boat`);
    assert.equal(state.speed, 0, 'Steering alone does not accelerate');
    assert.equal(state.heading, 0, 'Steering alone cannot rotate a stationary boat');
  }
  for (const [key, sign] of [
    ['ArrowUp', 1],
    ['ArrowDown', -1],
    ['KeyW', 1],
    ['KeyS', -1],
  ]) {
    await resetBoat(page);
    await page.keyboard.down(key);
    const state = await stepBoat(page);
    await page.keyboard.up(key);
    assert.ok(
      state.speed * sign > 1 && state.z * sign > 0.2,
      `${key} drives along the boat's front/rear axis`,
    );
    assert.ok(Math.abs(state.heading) < 0.01, 'A pedal does not aim toward a screen direction');
  }
  for (const [key, sign] of [
    ['ArrowLeft', 1],
    ['ArrowRight', -1],
  ]) {
    await resetBoat(page);
    await page.keyboard.down('ArrowUp');
    await page.keyboard.down(key);
    const state = await stepBoat(page, 60);
    await page.keyboard.up(key);
    await page.keyboard.up('ArrowUp');
    assert.ok(
      state.heading * sign > 0.2 && state.speed > 1,
      `Up + ${key} drives the corresponding arc`,
    );
    assert.ok(
      Math.hypot(state.x + 62, state.z) > 1,
      'The boat moves through an arc instead of spinning in place',
    );
    assert.equal(state.bumps, 0, 'The arc does not rely on a collision');
  }
  await resetBoat(page);
  await page.keyboard.down('ArrowUp');
  const forward = await stepBoat(page, 45);
  await page.keyboard.up('ArrowUp');
  await page.keyboard.down('ArrowDown');
  const speeds = await page.evaluate(() =>
    Array.from({ length: 90 }, () => {
      bayDebug.update(1 / 60);
      return bayDebug.state.speed;
    }),
  );
  await page.keyboard.up('ArrowDown');
  assert.ok(
    speeds[0] > 0 && speeds[0] < forward.speed && speeds.includes(0) && speeds.at(-1) < -1,
    'Reverse first stops the boat before engaging the other gear',
  );
  for (const key of ['KeyB', 'ControlLeft']) {
    await resetBoat(page);
    await page.keyboard.down('ArrowUp');
    await stepBoat(page, 45);
    await page.keyboard.down(key);
    const stopped = await stepBoat(page, 90);
    await page.keyboard.up(key);
    await page.keyboard.up('ArrowUp');
    assert.ok(
      Math.abs(stopped.speed) < 0.03 && stopped.velocity < 0.03,
      `${key} stops both throttle and water drift`,
    );
  }
}

async function exerciseBoatTouch(page) {
  await resetBoat(page);
  let finger = await pressGround(page, 2);
  const neutral = await stepBoat(page);
  assert.equal(neutral.touch.progress, 0, 'Touching close to the boat is neutral');
  assert.equal(neutral.speed, 0);
  await finger.end();

  await resetBoat(page);
  finger = await pressGround(page, 5);
  const gentle = await stepBoat(page);
  assert.ok(
    gentle.input.gas > 0 && gentle.input.gas < 0.25,
    'Nearby touch applies gentle throttle',
  );
  await finger.end();
  await resetBoat(page);
  finger = await pressGround(page);
  const full = await stepBoat(page);
  assert.ok(
    full.input.gas > 0.9 && full.speed > gentle.speed * 4 && full.z > 0.5,
    'A farther touch drives forward at a substantially higher speed',
  );
  const held = await stepBoat(page, 15);
  assert.equal(
    held.touch.progress,
    full.touch.progress,
    'Holding a finger still preserves the selected throttle as the camera follows',
  );
  assert.equal(held.touch.heading, full.touch.heading);
  // Move clearly beyond native touch slop first: after manual simulation steps,
  // a near target can project onto almost the same pixel as the original touch.
  const side = await groundPoint(page, 5, Math.PI / 2);
  await finger.move(side.x, side.y);
  const closer = await groundPoint(page, 5);
  await finger.move(closer.x, closer.y);
  await page.waitForFunction(() => bayDebug.touchDrive.snapshot().progress < 0.5);
  const slowed = await stepBoat(page, 30);
  assert.ok(
    slowed.input.gas < 0.25 && slowed.speed > 0 && slowed.speed < held.speed,
    'Moving closer slows an already moving boat',
  );
  await finger.end();

  await resetBoat(page);
  finger = await pressGround(page);
  const straight = await stepBoat(page);
  const turn = await groundPoint(page, 8.5, Math.PI / 3);
  await finger.move(turn.x, turn.y);
  await page.waitForFunction(() => bayDebug.drivingInput.steering > 0.5);
  const turned = await stepBoat(page);
  assert.ok(
    turned.heading > straight.heading + 0.1 && turned.speed > 0,
    'Dragging to the side steers a moving arc',
  );
  await finger.end();
  const coast = await stepBoat(page, 15);
  assert.ok(
    !coast.touch.active && coast.speed > 0 && coast.speed < turned.speed,
    'Lifting releases the steering command and coasts',
  );
  await resetBoat(page);
  finger = await pressGround(page, 8.5, Math.PI);
  const reverse = await stepBoat(page);
  assert.ok(
    reverse.input.reverse > 0.9 && reverse.speed < -1 && reverse.z < -0.2,
    'A rear touch reverses the boat',
  );
  assert.ok(Math.abs(reverse.heading) < 0.1, 'A rear touch does not force a U-turn');
  await finger.end();

  await resetBoat(page);
  finger = await pressGround(page);
  await stepBoat(page, 45);
  const brake = await pressAction(page, 'brake');
  const stopped = await stepBoat(page, 90);
  assert.ok(
    stopped.touch.active &&
      stopped.input.brake &&
      Math.abs(stopped.speed) < 0.03 &&
      stopped.velocity < 0.03,
    'A second finger on Brake stops the boat without cancelling steering',
  );
  await brake.end();
  assert.ok((await stepBoat(page)).speed > 2, 'Releasing Brake resumes the held throttle');
  await finger.end();

  await resetBoat(page);
  finger = await pressGround(page);
  await stepBoat(page, 30);
  const normal = await page.evaluate(() => {
    const saved = structuredClone(bayDebug.state);
    for (let i = 0; i < 30; i++) bayDebug.update(1 / 60);
    const normal = {
      speed: bayDebug.state.speed,
      velocity: Math.hypot(bayDebug.state.vx, bayDebug.state.vz),
      bumps: bayDebug.state.bumps - saved.bumps,
    };
    Object.assign(bayDebug.state, saved);
    return normal;
  });
  const boost = await pressAction(page, 'boost');
  const boosted = await stepBoat(page);
  assert.equal(normal.bumps, 0, 'Normal-speed comparison is collision-free');
  assert.ok(
    boosted.touch.active &&
      boosted.boosting &&
      boosted.boost < 100 &&
      boosted.speed > normal.speed * 1.25 &&
      boosted.velocity > normal.velocity * 1.2,
    'A second finger on Boost substantially increases actual boat speed while steering',
  );
  await boost.end();
  const released = await stepBoat(page, 15);
  assert.ok(
    released.touch.active && !released.boosting && released.boost > boosted.boost,
    'Releasing Boost preserves steering and recharges the meter',
  );
  await finger.end();
  assert.equal(
    await page.$$eval('[data-control].pressed', (buttons) => buttons.length),
    0,
    'No action remains pressed after both fingers lift',
  );

  await resetBoat(page);
  const scale = await page.evaluate(() => visualViewport.scale);
  finger = await pressGround(page);
  const secondPoint = await groundPoint(page, 8.5, Math.PI / 2);
  const second = await page.touchscreen.touchStart(secondPoint.x, secondPoint.y);
  assert.equal(
    (await stepBoat(page, 1)).touch.active,
    false,
    'A second scene finger cancels steering',
  );
  await second.end();
  assert.equal(
    (await stepBoat(page, 1)).touch.active,
    false,
    'Steering remains suspended until all scene fingers lift',
  );
  await finger.end();
  finger = await pressGround(page);
  await page.tap('#pause');
  assert.equal(
    (await stepBoat(page, 1)).mode,
    'paused',
    'A second finger can pause while steering is held',
  );
  assert.equal((await stepBoat(page, 1)).touch.active, false, 'Pausing clears the scene command');
  await finger.end();
  assert.equal(
    (await stepBoat(page, 1)).mode,
    'paused',
    'Lifting the old steering finger cannot activate Resume',
  );
  await page.tap('#start');
  const resumed = await stepBoat(page, 1);
  assert.ok(
    resumed.mode === 'racing' && !resumed.touch.active && resumed.input.gas === 0,
    'Resume cannot revive old steering',
  );
  assert.ok(
    Math.abs((await page.evaluate(() => visualViewport.scale)) - scale) < 0.01,
    'Scene gestures do not zoom',
  );
  assert.equal(
    await page.evaluate(() => getSelection().toString()),
    '',
    'Scene gestures do not select text',
  );

  await resetBoat(page);
  const point = await groundPoint(page);
  const client = await page.createCDPSession();
  try {
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: point.x, y: point.y, id: 1 }],
    });
    await page.waitForFunction(() => bayDebug.touchDrive.snapshot().active);
    await client.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    const cancelled = await stepBoat(page, 1);
    assert.ok(
      !cancelled.touch.active && cancelled.input.gas === 0,
      'Native touch cancellation clears steering',
    );
  } finally {
    await client.detach();
  }
}

async function exerciseBoatResponsiveTouch(page, label) {
  const finger = await pressGround(page);
  const moved = await stepBoat(page, 20);
  await finger.end();
  assert.ok(Math.abs(moved.speed) > 0.2, `${label}: scene touch reaches the driving controls`);
  assert.equal(
    (await stepBoat(page, 1)).touch.active,
    false,
    `${label}: lifting clears the command`,
  );
}

module.exports = {
  assertBoatControls,
  exerciseBoatKeyboard,
  exerciseBoatTouch,
  exerciseBoatResponsiveTouch,
};

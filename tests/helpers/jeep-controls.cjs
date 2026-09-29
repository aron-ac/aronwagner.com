const assert = require('node:assert/strict');
const { settleCamera } = require('./browser.cjs');
const { exerciseMapWhileSteering } = require('./driving-controls.cjs');

async function resetJeep(page) {
  await page.evaluate(() => {
    const game = surfDebug;
    game.startGame();
    // This real road intersection has room for short driving arcs and stops.
    Object.assign(game.state, { x: -38, z: 40, heading: 0, speed: 0, steer: 0 });
  });
  await settleCamera(page, 'surfDebug');
}

async function stepJeep(page, frames = 30) {
  return page.evaluate((frames) => {
    const game = surfDebug;
    for (let frame = 0; frame < frames; frame++) game.update(1 / 60);
    const { x, z, heading, speed, steer, bumps, mode } = game.state;
    return {
      x,
      z,
      heading,
      speed,
      steer,
      bumps,
      mode,
      input: { ...game.drivingInput },
      touch: game.touchDrive.snapshot(),
    };
  }, frames);
}

// Project a real point on the ground, without duplicating the touch raycaster.
async function jeepGroundPoint(page, distance = 8.5, bearing = 0) {
  const point = await page.evaluate(
    ({ distance, bearing }) => {
      const game = surfDebug;
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
    `The projected driving target reaches the scene, not the HUD (${JSON.stringify(point)})`,
  );
  return point;
}

async function assertJeepControls(page, label) {
  const controls = await page.$$eval('[data-control]', (buttons) =>
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
    controls.map((control) => control.action),
    ['brake'],
    `${label}: Brake is the only touch button`,
  );
  assert.equal(await page.$('[data-dpad]'), null, `${label}: the obsolete D-pad is absent`);
  assert.ok(
    controls[0].width >= 44 && controls[0].height >= 44 && controls[0].reachable,
    `${label}: Brake is an unobstructed touch target`,
  );
  await jeepGroundPoint(page);
}

async function exerciseJeepKeyboard(page) {
  for (const [key, sign] of [
    ['ArrowLeft', 1],
    ['ArrowRight', -1],
    ['KeyA', 1],
    ['KeyD', -1],
  ]) {
    await resetJeep(page);
    await page.keyboard.down(key);
    const state = await stepJeep(page);
    await page.keyboard.up(key);
    assert.ok(state.steer * sign > 0.8, `${key} turns the steering wheels`);
    assert.equal(state.speed, 0, 'Steering alone does not accelerate');
    assert.equal(state.heading, 0, 'Steering alone does not spin a stationary Jeep');
    assert.equal(state.x, -38);
    assert.equal(state.z, 40);
  }
  for (const [key, sign] of [
    ['ArrowUp', 1],
    ['ArrowDown', -1],
    ['KeyW', 1],
    ['KeyS', -1],
  ]) {
    await resetJeep(page);
    await page.keyboard.down(key);
    const state = await stepJeep(page);
    await page.keyboard.up(key);
    assert.ok(
      state.speed * sign > 1 && (state.z - 40) * sign > 0.3,
      `${key} drives along the Jeep's front/rear axis`,
    );
    assert.ok(
      Math.abs(state.heading) < 0.01,
      'A pedal does not turn the vehicle toward a screen direction',
    );
  }
  for (const [key, sign] of [
    ['ArrowLeft', 1],
    ['ArrowRight', -1],
  ]) {
    await resetJeep(page);
    await page.keyboard.down('ArrowUp');
    await page.keyboard.down(key);
    const state = await stepJeep(page, 60);
    await page.keyboard.up(key);
    await page.keyboard.up('ArrowUp');
    assert.ok(
      state.heading * sign > 0.2 && state.speed > 1,
      `Up + ${key} drives the corresponding turning arc`,
    );
    assert.ok(
      Math.hypot(state.x + 38, state.z - 40) > 1,
      'The Jeep drives an arc rather than rotating in place',
    );
    assert.equal(state.bumps, 0, 'The turning arc does not depend on a collision');
  }
  await resetJeep(page);
  await page.keyboard.down('ArrowUp');
  const forward = await stepJeep(page, 45);
  await page.keyboard.up('ArrowUp');
  await page.keyboard.down('ArrowDown');
  const reversal = await page.evaluate(() => {
    const speeds = [];
    for (let frame = 0; frame < 90; frame++) {
      surfDebug.update(1 / 60);
      speeds.push(surfDebug.state.speed);
    }
    return speeds;
  });
  await page.keyboard.up('ArrowDown');
  assert.ok(
    reversal[0] > 0 && reversal[0] < forward.speed,
    'The reverse pedal first slows forward motion',
  );
  assert.ok(reversal.includes(0) && reversal.at(-1) < -1, 'The Jeep stops before engaging reverse');

  for (const key of ['Space', 'KeyB']) {
    await resetJeep(page);
    await page.keyboard.down('ArrowUp');
    await stepJeep(page, 45);
    await page.keyboard.down(key);
    const stopped = await stepJeep(page, 60);
    await page.keyboard.up(key);
    await page.keyboard.up('ArrowUp');
    assert.ok(
      Math.abs(stopped.speed) < 0.03,
      `${key} stops the Jeep while the forward pedal stays held`,
    );
  }
}

async function pressGround(page, distance = 8.5, bearing = 0) {
  const point = await jeepGroundPoint(page, distance, bearing);
  const finger = await page.touchscreen.touchStart(point.x, point.y);
  await page.waitForFunction(() => surfDebug.touchDrive.snapshot().active);
  return finger;
}

async function exerciseJeepTouch(page) {
  await resetJeep(page);
  let finger = await pressGround(page, 2);
  const neutral = await stepJeep(page);
  assert.equal(neutral.touch.progress, 0, 'Touching close to the Jeep is neutral');
  assert.equal(neutral.speed, 0, 'The neutral ring does not propel or spin the Jeep');
  assert.equal(neutral.heading, 0);
  await finger.end();

  await resetJeep(page);
  finger = await pressGround(page, 5);
  const gentle = await stepJeep(page);
  assert.ok(
    gentle.input.gas > 0 && gentle.input.gas < 0.25,
    'A nearby ground touch applies gentle throttle',
  );
  await finger.end();
  await resetJeep(page);
  finger = await pressGround(page);
  const full = await stepJeep(page);
  assert.ok(
    full.input.gas > 0.9 && full.speed > gentle.speed * 4,
    'Dragging farther gives a clearly stronger throttle',
  );
  assert.ok(
    full.z > 41 && Math.abs(full.heading) < 0.1,
    'An ahead target drives forward without rotating in place',
  );
  const held = await stepJeep(page, 15);
  assert.equal(
    held.touch.progress,
    full.touch.progress,
    'A held command stays stable as the camera and Jeep move',
  );
  assert.equal(held.touch.heading, full.touch.heading);
  // Cross native touch slop before aiming closer. After the Jeep and camera
  // move, the near ground target can project onto the original touch pixel.
  const sidePoint = await jeepGroundPoint(page, 5, Math.PI / 2);
  await finger.move(sidePoint.x, sidePoint.y);
  const closerPoint = await jeepGroundPoint(page, 5);
  await finger.move(closerPoint.x, closerPoint.y);
  await page.waitForFunction(() => surfDebug.touchDrive.snapshot().progress < 0.5);
  const slowed = await stepJeep(page, 20);
  assert.ok(
    slowed.input.gas < 0.25 && slowed.speed > 0 && slowed.speed < held.speed,
    'Moving the thumb closer eases the moving Jeep down to a gentler speed',
  );
  await finger.end();

  // Keep each manually advanced sequence short enough for the real render-loop
  // camera to frame the next ground target without inventing a camera transform.
  await resetJeep(page);
  finger = await pressGround(page);
  const straight = await stepJeep(page);
  const turningPoint = await jeepGroundPoint(page, 8.5, Math.PI / 3);
  await finger.move(turningPoint.x, turningPoint.y);
  await page.waitForFunction(() => surfDebug.drivingInput.steering > 0.5);
  const turned = await stepJeep(page);
  assert.ok(
    turned.heading > straight.heading + 0.1 && turned.speed > 0,
    'Dragging beside the Jeep steers a moving arc',
  );
  await finger.end();
  const coasting = await stepJeep(page, 15);
  assert.equal(coasting.touch.active, false, 'Lifting clears the scene control');
  assert.ok(coasting.speed > 0 && coasting.speed < turned.speed, 'Lifting lets the Jeep coast');

  await resetJeep(page);
  finger = await pressGround(page, 8.5, Math.PI);
  const reversing = await stepJeep(page);
  assert.ok(
    reversing.input.reverse > 0.9 && reversing.speed < -1 && reversing.z < 39.5,
    'Touching directly behind backs the Jeep up',
  );
  assert.ok(Math.abs(reversing.heading) < 0.1, 'A rear target reverses without a forced U-turn');
  await finger.end();

  await resetJeep(page);
  finger = await pressGround(page);
  await exerciseMapWhileSteering(page, 'surfDebug');
  await stepJeep(page, 45);
  const brake = await (await page.$('[data-control="brake"]')).boundingBox();
  const brakeFinger = await page.touchscreen.touchStart(
    brake.x + brake.width / 2,
    brake.y + brake.height / 2,
  );
  const stopped = await stepJeep(page, 60);
  assert.ok(
    stopped.touch.active && stopped.input.brake && Math.abs(stopped.speed) < 0.03,
    'A second finger on Brake stops the Jeep without cancelling the driving finger',
  );
  await brakeFinger.end();
  const resumed = await stepJeep(page);
  assert.ok(
    resumed.touch.active && resumed.speed > 2,
    'Releasing Brake resumes the held scene command',
  );
  await finger.end();

  await resetJeep(page);
  const scale = await page.evaluate(() => visualViewport.scale);
  finger = await pressGround(page);
  const secondPoint = await jeepGroundPoint(page, 8.5, Math.PI / 2);
  const second = await page.touchscreen.touchStart(secondPoint.x, secondPoint.y);
  let cancelled = await stepJeep(page, 1);
  assert.ok(
    !cancelled.touch.active && cancelled.input.gas === 0,
    'A second scene finger cancels driving',
  );
  await second.end();
  cancelled = await stepJeep(page, 1);
  assert.equal(
    cancelled.touch.active,
    false,
    'Driving stays cancelled until every scene finger lifts',
  );
  await finger.end();
  finger = await pressGround(page);
  assert.equal(
    (await stepJeep(page, 1)).touch.active,
    true,
    'A fresh touch works after all fingers lift',
  );
  await page.tap('#pause');
  const paused = await stepJeep(page, 1);
  assert.equal(paused.mode, 'paused', 'A second finger can pause while the scene touch is held');
  assert.equal(paused.touch.active, false, 'Pausing releases the scene command');
  await finger.end();
  assert.equal(
    (await stepJeep(page, 1)).mode,
    'paused',
    'Lifting the old scene touch keeps the pause menu open',
  );
  await page.tap('#start');
  const resumedMenu = await stepJeep(page, 1);
  assert.ok(
    resumedMenu.mode === 'playing' && !resumedMenu.touch.active && resumedMenu.input.gas === 0,
    'Resuming cannot revive an old touch',
  );
  assert.ok(
    Math.abs((await page.evaluate(() => visualViewport.scale)) - scale) < 0.01,
    'Scene gestures do not zoom the game',
  );
  assert.equal(
    await page.evaluate(() => getSelection().toString()),
    '',
    'Scene gestures do not select text',
  );

  await resetJeep(page);
  const point = await jeepGroundPoint(page);
  const client = await page.createCDPSession();
  try {
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: point.x, y: point.y, id: 1 }],
    });
    await page.waitForFunction(() => surfDebug.touchDrive.snapshot().active);
    await client.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    const cancelledTouch = await stepJeep(page, 1);
    assert.ok(
      !cancelledTouch.touch.active && cancelledTouch.input.gas === 0,
      'Native touch cancellation clears the scene command',
    );
  } finally {
    await client.detach();
  }
}

async function exerciseJeepResponsiveTouch(page, label) {
  const finger = await pressGround(page);
  const moved = await stepJeep(page, 20);
  await finger.end();
  assert.ok(
    Math.abs(moved.speed) > 0.2,
    `${label}: a scene touch reaches the actual driving controls`,
  );
  assert.equal(
    (await stepJeep(page, 1)).touch.active,
    false,
    `${label}: release clears scene control`,
  );
}

module.exports = {
  assertJeepControls,
  exerciseJeepKeyboard,
  exerciseJeepTouch,
  exerciseJeepResponsiveTouch,
};

const assert = require('node:assert/strict');

async function assertDrivingControls(page, label) {
  const controls = await page.$$eval('[data-control]', (buttons) =>
    Object.fromEntries(
      buttons.map((button) => {
        const r = button.getBoundingClientRect();
        return [
          button.dataset.control,
          {
            text: button.textContent,
            width: r.width,
            height: r.height,
            x: r.x + r.width / 2,
            y: r.y + r.height / 2,
            reachable: button.contains(
              document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2),
            ),
          },
        ];
      }),
    ),
  );
  for (const [action, glyph] of Object.entries({ gas: '↑', reverse: '↓', left: '←', right: '→' })) {
    const control = controls[action];
    assert.ok(control?.text.includes(glyph), `${label}: ${action} has a visible ${glyph} arrow`);
  }
  for (const [action, control] of Object.entries(controls)) {
    assert.ok(
      control.width >= 44 && control.height >= 44 && control.reachable,
      `${label}: ${action} offers an unobstructed touch target of at least 44px`,
    );
  }
  assert.ok(
    Math.abs(controls.gas.x - controls.reverse.x) < 1 && controls.gas.y < controls.reverse.y,
    `${label}: forward sits directly above reverse`,
  );
  assert.ok(
    Math.abs(controls.left.y - controls.right.y) < 1 && controls.left.x < controls.right.x,
    `${label}: left and right steering sit side by side`,
  );
  assert.ok(
    controls.right.x < controls.gas.x,
    `${label}: steering and forward/reverse are reachable by separate thumbs`,
  );
}

async function exerciseDrivingControls(page, { debugName, start, countdownFrames = 0 }) {
  const center = async (action) => {
    const r = await (await page.$(`[data-control="${action}"]`)).boundingBox();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  };
  const press = async (action) => {
    const p = await center(action);
    return page.touchscreen.touchStart(p.x, p.y);
  };
  const reset = () =>
    page.evaluate(
      ({ debugName, start, countdownFrames }) => {
        const game = window[debugName];
        game[start]();
        for (let i = 0; i < countdownFrames; i++) game.update(1 / 60);
        return { x: game.state.x, z: game.state.z, heading: game.state.heading };
      },
      { debugName, start, countdownFrames },
    );
  const assertPressed = async (expected, label) => {
    // Chromium may deliver a captured touch move on the following frame.
    await page.waitForFunction(
      (expected) =>
        [...document.querySelectorAll('[data-control].pressed')]
          .map((button) => button.dataset.control)
          .sort()
          .join(',') === expected.join(','),
      { timeout: 5000 },
      expected.toSorted(),
    );
    assert.deepEqual(
      await page.$$eval('[data-control].pressed', (buttons) =>
        buttons.map((button) => button.dataset.control).sort(),
      ),
      expected.toSorted(),
      label,
    );
  };
  for (const direction of ['gas', 'reverse']) {
    for (const steering of ['left', 'right']) {
      const before = await reset();
      const throttleTouch = await press(direction);
      const steeringTouch = await press(steering);
      const driven = await page.evaluate((debugName) => {
        const game = window[debugName];
        for (let i = 0; i < 45; i++) game.update(1 / 60);
        const { x, z, speed, heading, steer } = game.state;
        return { x, z, speed, heading, steer };
      }, debugName);
      const directionSign = direction === 'gas' ? 1 : -1;
      const steeringSign = steering === 'left' ? 1 : -1;
      assert.ok(
        driven.speed * directionSign > 0.5 &&
          Math.hypot(driven.x - before.x, driven.z - before.z) > 0.1 &&
          (driven.heading - before.heading) * directionSign * steeringSign > 0.02,
        `${direction} + ${steering}: two fingers drive and turn in the expected direction`,
      );
      await steeringTouch.end();
      const released = await page.evaluate(
        ({ debugName, direction, steering }) => {
          const game = window[debugName];
          for (let i = 0; i < 20; i++) game.update(1 / 60);
          return {
            speed: game.state.speed,
            steer: game.state.steer,
            throttleHeld: document
              .querySelector(`[data-control="${direction}"]`)
              .classList.contains('pressed'),
            steeringHeld: document
              .querySelector(`[data-control="${steering}"]`)
              .classList.contains('pressed'),
          };
        },
        { debugName, direction, steering },
      );
      assert.ok(
        released.throttleHeld &&
          !released.steeringHeld &&
          released.speed * directionSign > 0.5 &&
          Math.abs(released.steer) < Math.abs(driven.steer) / 2,
        `${direction} + ${steering}: releasing steering keeps the other finger driving`,
      );
      await throttleTouch.end();
      assert.equal(
        await page.$$eval('[data-control].pressed', (buttons) => buttons.length),
        0,
        `${direction} + ${steering}: releasing both fingers leaves no stuck controls`,
      );
    }
  }
  // Use real touch moves while pointer capture remains on the original arrow.
  await reset();
  const throttleTouch = await press('gas');
  const steeringTouch = await press('left');
  const reverse = await center('reverse');
  await throttleTouch.move(reverse.x, reverse.y);
  await assertPressed(
    ['left', 'reverse'],
    'Sliding down selects reverse while steering stays held',
  );
  assert.ok(
    await page.evaluate((debugName) => {
      const game = window[debugName];
      for (let i = 0; i < 45; i++) game.update(1 / 60);
      return game.state.speed < -0.5;
    }, debugName),
    'Sliding from forward to reverse changes the real driving input',
  );
  const right = await center('right');
  await steeringTouch.move(right.x, right.y);
  await assertPressed(['right', 'reverse'], 'Sliding across steering switches left to right');
  const viewport = page.viewport();
  await steeringTouch.move(viewport.width / 2, viewport.height / 2);
  await assertPressed(['reverse'], 'Sliding off a pad releases only that finger’s action');
  await throttleTouch.move(right.x, right.y);
  await assertPressed([], 'A throttle finger cannot switch to the steering pad');
  const gas = await center('gas');
  await throttleTouch.move(gas.x, gas.y);
  await assertPressed(['gas'], 'Returning to the original pad resumes that finger’s control');
  await throttleTouch.end();
  await steeringTouch.end();
  await assertPressed([], 'Ending a sliding gesture leaves no controls held');
}

module.exports = { assertDrivingControls, exerciseDrivingControls };

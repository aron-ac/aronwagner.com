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
    controls.left.x < controls.gas.x &&
      controls.gas.x < controls.right.x &&
      controls.gas.y < controls.left.y &&
      controls.left.y < controls.reverse.y,
    `${label}: four directions form a single cross`,
  );
  const pads = await page.$$eval('[data-dpad]', (pads) =>
    pads.map((pad) => {
      const bounds = pad.getBoundingClientRect();
      return {
        right: bounds.right,
        viewportWidth: innerWidth,
        actions: [...pad.querySelectorAll('[data-control]')]
          .map((button) => button.dataset.control)
          .sort(),
      };
    }),
  );
  assert.equal(pads.length, 1, `${label}: one D-pad holds all four directions`);
  assert.deepEqual(pads[0].actions, ['gas', 'left', 'reverse', 'right']);
  assert.ok(pads[0].right <= pads[0].viewportWidth / 2, `${label}: the D-pad stays on the left`);
  const auxiliary = Object.keys(controls).filter(
    (action) => !['gas', 'reverse', 'left', 'right'].includes(action),
  );
  assert.equal(auxiliary.length, 1, `${label}: only Brake or Boost sits beside the D-pad`);
  assert.ok(
    controls[auxiliary[0]].x > pads[0].viewportWidth / 2,
    `${label}: the auxiliary action remains reachable by the right thumb`,
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
  const padPoint = async (direction, steering) =>
    page.$eval(
      '[data-dpad]',
      (pad, { direction, steering }) => {
        const r = pad.getBoundingClientRect();
        return {
          x: r.x + r.width * (steering === 'left' ? 1 / 6 : steering === 'right' ? 5 / 6 : 1 / 2),
          y:
            r.y +
            r.height * (direction === 'gas' ? 1 / 6 : direction === 'reverse' ? 5 / 6 : 1 / 2),
        };
      },
      { direction, steering },
    );
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
      const corner = await padPoint(direction, steering);
      const touch = await page.touchscreen.touchStart(corner.x, corner.y);
      await assertPressed(
        [direction, steering],
        `${direction} + ${steering}: one finger holds both axes`,
      );
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
        `${direction} + ${steering}: one thumb drives and turns in the expected direction`,
      );
      await touch.end();
      await assertPressed([], `${direction} + ${steering}: lifting the thumb releases both axes`);
    }
  }
  // The same captured finger can select diagonals, return to neutral, or leave.
  await reset();
  const throttleTouch = await press('gas');
  const forwardLeft = await padPoint('gas', 'left');
  await throttleTouch.move(forwardLeft.x, forwardLeft.y);
  await assertPressed(['gas', 'left'], 'Sliding into a corner combines forward and steering');
  const reverseRight = await padPoint('reverse', 'right');
  await throttleTouch.move(reverseRight.x, reverseRight.y);
  await assertPressed(['reverse', 'right'], 'Sliding across the pad selects the opposite diagonal');
  assert.ok(
    await page.evaluate((debugName) => {
      const game = window[debugName];
      for (let i = 0; i < 90; i++) game.update(1 / 60);
      return game.state.speed < -0.5;
    }, debugName),
    'Sliding from forward to reverse changes the real driving input',
  );
  const neutral = await padPoint();
  await throttleTouch.move(neutral.x, neutral.y);
  await assertPressed([], 'The center of the D-pad is neutral');
  const viewport = page.viewport();
  await throttleTouch.move(viewport.width / 2, viewport.height / 2);
  await assertPressed([], 'Sliding off the D-pad releases both directions');
  const gas = await center('gas');
  await throttleTouch.move(gas.x, gas.y);
  await assertPressed(['gas'], 'Reentering the pad resumes the selected direction');
  const auxiliary = await page.$eval(
    '.driving-actions [data-control]',
    (button) => button.dataset.control,
  );
  const auxiliaryCenter = await center(auxiliary);
  await throttleTouch.move(auxiliaryCenter.x, auxiliaryCenter.y);
  await assertPressed([], 'A captured D-pad finger cannot activate the right action button');
  await throttleTouch.end();
  await assertPressed([], 'Ending a sliding gesture leaves no controls held');

  await reset();
  const steeringTouch = await press('left');
  const gasTouch = await press('gas');
  await assertPressed(['gas', 'left'], 'Separate fingers on the D-pad remain independent');
  await steeringTouch.end();
  await assertPressed(['gas'], 'Releasing steering keeps the other finger driving');
  const beforeAuxiliary = await page.evaluate((debugName) => {
    const game = window[debugName];
    for (let i = 0; i < 45; i++) game.update(1 / 60);
    return { speed: game.state.speed, boost: game.state.boost };
  }, debugName);
  const auxiliaryTouch = await press(auxiliary);
  await assertPressed(
    ['gas', auxiliary],
    'The right thumb can use the auxiliary action while driving',
  );
  const afterAuxiliary = await page.evaluate((debugName) => {
    const game = window[debugName];
    for (let i = 0; i < 30; i++) game.update(1 / 60);
    return { speed: game.state.speed, boost: game.state.boost, boosting: game.state.boosting };
  }, debugName);
  assert.ok(
    auxiliary === 'boost'
      ? afterAuxiliary.boosting && afterAuxiliary.boost < beforeAuxiliary.boost
      : afterAuxiliary.speed < beforeAuxiliary.speed / 2,
    `${auxiliary}: the independent action changes actual vehicle behavior`,
  );
  await auxiliaryTouch.end();
  await assertPressed(['gas'], 'Releasing the right action preserves the left thumb’s input');
  await gasTouch.end();
  await assertPressed([], 'All fingers released leaves no stuck controls');
}

async function assertCompactDrivingUI(page, label) {
  const layout = await page.evaluate(() => {
    const visible = (selector) => document.querySelector(selector).getClientRects().length > 0;
    const viewport = document.querySelector('#viewport').getBoundingClientRect();
    const x = viewport.left + viewport.width / 2;
    const y = viewport.top + viewport.height / 2;
    return {
      compact: matchMedia('(max-width: 900px), (max-height: 600px) and (orientation: landscape)')
        .matches,
      extraPanels: ['.game-brand', '#speedometer', 'footer', '#recover', '#map-panel'].filter(
        visible,
      ),
      buttons: ['#pause', '#map-toggle'].map((selector) => {
        const button = document.querySelector(selector);
        const r = button.getBoundingClientRect();
        return {
          selector,
          width: r.width,
          height: r.height,
          reachable: button.contains(
            document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2),
          ),
        };
      }),
      obscuredCenter: [
        '.stats',
        '#dispatch',
        '#course-panel',
        '#target',
        '[data-dpad]',
        '.driving-actions',
      ]
        .flatMap((selector) => [...document.querySelectorAll(selector)])
        .filter((element) => {
          const r = element.getBoundingClientRect();
          return r.width && r.height && x > r.left && x < r.right && y > r.top && y < r.bottom;
        })
        .map((element) => element.id || element.className),
    };
  });
  if (!layout.compact) return;
  assert.deepEqual(
    layout.extraPanels,
    [],
    `${label}: compact play hides secondary chrome and the closed map`,
  );
  assert.deepEqual(
    layout.obscuredCenter,
    [],
    `${label}: the center of the driving view stays clear`,
  );
  for (const button of layout.buttons) {
    assert.ok(
      button.width >= 44 && button.height >= 44 && button.reachable,
      `${label}: ${button.selector} has an unobstructed 44px target`,
    );
  }
}

async function exerciseCompactDrivingUI(page, { debugName, activeMode }) {
  const mapVisible = () => page.$eval('#map-panel', (map) => map.getClientRects().length > 0);
  assert.equal(await mapVisible(), false, 'The compact map starts closed');
  await page.click('#map-toggle');
  assert.equal(await mapVisible(), true, 'Map opens on demand during play');
  assert.equal(
    await page.$eval('#map-toggle', (button) => button.getAttribute('aria-expanded')),
    'true',
  );
  await page.click('#map-toggle');
  assert.equal(await mapVisible(), false, 'Map can be dismissed without pausing');
  await page.click('#map-toggle');
  await page.click('#pause');
  const before = await page.evaluate((debugName) => {
    const state = window[debugName].state;
    return { mode: state.mode, remaining: state.remaining, penalties: state.penalties };
  }, debugName);
  assert.equal(before.mode, 'paused');
  assert.equal(
    await page.$eval(
      '#menu-recover',
      (button) => button.getClientRects().length > 0 && !button.disabled,
    ),
    true,
    'Recovery is available inside the pause menu',
  );
  await page.click('#menu-recover');
  const after = await page.evaluate((debugName) => {
    const state = window[debugName].state;
    return {
      mode: state.mode,
      remaining: state.remaining,
      penalties: state.penalties,
      speed: state.speed,
    };
  }, debugName);
  assert.equal(after.mode, activeMode, 'Pause-menu recovery returns to the active game');
  if (debugName === 'bayDebug')
    assert.equal(
      after.penalties,
      before.penalties + 5,
      'Boat recovery adds the stated five-second penalty',
    );
  else
    assert.ok(
      after.remaining <= before.remaining - 5 && after.remaining > before.remaining - 5.5,
      'Jeep recovery deducts the stated five-second penalty',
    );
  assert.equal(after.speed, 0, 'Recovery leaves the vehicle stopped');
  assert.equal(await mapVisible(), false, 'Resuming after recovery closes the map');
}

module.exports = {
  assertDrivingControls,
  exerciseDrivingControls,
  assertCompactDrivingUI,
  exerciseCompactDrivingUI,
};

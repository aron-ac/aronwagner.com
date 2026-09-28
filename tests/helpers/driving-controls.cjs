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
  for (const [action, glyph] of Object.entries({ up: '↑', down: '↓', left: '←', right: '→' })) {
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
    Math.abs(controls.up.x - controls.down.x) < 1 && controls.up.y < controls.down.y,
    `${label}: up sits directly above down`,
  );
  assert.ok(
    Math.abs(controls.left.y - controls.right.y) < 1 && controls.left.x < controls.right.x,
    `${label}: left and right sit side by side`,
  );
  assert.ok(
    controls.left.x < controls.up.x &&
      controls.up.x < controls.right.x &&
      controls.up.y < controls.left.y &&
      controls.left.y < controls.down.y,
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
  assert.deepEqual(pads[0].actions, ['down', 'left', 'right', 'up']);
  assert.ok(pads[0].right <= pads[0].viewportWidth / 2, `${label}: the D-pad stays on the left`);
  const auxiliary = Object.keys(controls).filter(
    (action) => !['up', 'down', 'left', 'right'].includes(action),
  );
  assert.equal(auxiliary.length, 1, `${label}: only Brake or Boost sits beside the D-pad`);
  assert.ok(
    controls[auxiliary[0]].x > pads[0].viewportWidth / 2,
    `${label}: the auxiliary action remains reachable by the right thumb`,
  );
}

const screenDirections = {
  up: { x: 0, y: 1, heading: (-3 * Math.PI) / 4, key: 'ArrowUp' },
  down: { x: 0, y: -1, heading: Math.PI / 4, key: 'ArrowDown' },
  left: { x: -1, y: 0, heading: -Math.PI / 4, key: 'ArrowLeft' },
  right: { x: 1, y: 0, heading: (3 * Math.PI) / 4, key: 'ArrowRight' },
};

async function resetDriving(page, { debugName, start, countdownFrames = 0 }, facing = 'up') {
  await page.evaluate(
    ({ debugName, start, countdownFrames, heading }) => {
      const game = window[debugName];
      game[start]();
      for (let i = 0; i < countdownFrames; i++) game.update(1 / 60);
      game.state.heading = heading;
    },
    { debugName, start, countdownFrames, heading: screenDirections[facing].heading },
  );
}

async function measureDriving(page, debugName, frames = 60) {
  return page.evaluate(
    ({ debugName, frames }) => {
      const game = window[debugName];
      // Freeze projection for both endpoints. Camera following must not create
      // or conceal movement in a direction test.
      const camera = game.camera.clone();
      camera.updateMatrixWorld(true);
      const viewport = document.getElementById('viewport');
      const point = camera.position.clone().set(game.state.x, 0, game.state.z);
      const before = point.clone().project(camera);
      const bumps = game.state.bumps;
      for (let i = 0; i < frames; i++) game.update(1 / 60);
      const after = point.set(game.state.x, 0, game.state.z).project(camera);
      return {
        x: ((after.x - before.x) * viewport.clientWidth) / 2,
        y: ((after.y - before.y) * viewport.clientHeight) / 2,
        speed: game.state.speed,
        bumps: game.state.bumps - bumps,
      };
    },
    { debugName, frames },
  );
}

function assertScreenTravel(travel, directions, label) {
  const desired = directions.reduce(
    (sum, action) => ({
      x: sum.x + screenDirections[action].x,
      y: sum.y + screenDirections[action].y,
    }),
    { x: 0, y: 0 },
  );
  const along = (travel.x * desired.x + travel.y * desired.y) / Math.hypot(desired.x, desired.y);
  assert.ok(
    along > 0.75 && along / Math.hypot(travel.x, travel.y) > 0.2,
    `${label}: real movement follows the requested screen direction (${JSON.stringify(travel)})`,
  );
  assert.equal(travel.bumps, 0, `${label}: direction check does not rely on a collision`);
}

async function exerciseDrivingKeyboard(page, options) {
  for (const facing of ['up', 'down']) {
    for (const action of Object.keys(screenDirections)) {
      await resetDriving(page, options, facing);
      const key = screenDirections[action].key;
      await page.keyboard.down(key);
      const travel = await measureDriving(page, options.debugName);
      await page.keyboard.up(key);
      assertScreenTravel(travel, [action], `${facing}-facing vehicle, ${key}`);
      if (action === 'up' || action === 'down')
        assert.ok(
          travel.speed * (action === facing ? 1 : -1) > 0.5,
          `${key}: matching the nose drives forward, opposite the nose reverses`,
        );
    }
  }
  const aliases = { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD' };
  for (const action of Object.keys(aliases)) {
    await resetDriving(page, options, action);
    await page.keyboard.down(aliases[action]);
    const travel = await measureDriving(page, options.debugName);
    await page.keyboard.up(aliases[action]);
    assertScreenTravel(travel, [action], `${aliases[action]} matches its arrow key`);
  }
}

async function exerciseDrivingControls(page, options) {
  const { debugName } = options;
  const center = async (action) => {
    const r = await (await page.$(`[data-control="${action}"]`)).boundingBox();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  };
  const press = async (action) => {
    const p = await center(action);
    return page.touchscreen.touchStart(p.x, p.y);
  };
  const padPoint = async (vertical, horizontal) =>
    page.$eval(
      '[data-dpad]',
      (pad, { vertical, horizontal }) => {
        const r = pad.getBoundingClientRect();
        return {
          x:
            r.x +
            r.width * (horizontal === 'left' ? 1 / 6 : horizontal === 'right' ? 5 / 6 : 1 / 2),
          y: r.y + r.height * (vertical === 'up' ? 1 / 6 : vertical === 'down' ? 5 / 6 : 1 / 2),
        };
      },
      { vertical, horizontal },
    );
  const reset = (facing) => resetDriving(page, options, facing);
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
  for (const facing of Object.keys(screenDirections)) {
    for (const action of Object.keys(screenDirections)) {
      await reset(facing);
      const touch = await press(action);
      await assertPressed([action], `${action}: touching a cardinal holds only that direction`);
      const travel = await measureDriving(page, debugName);
      assertScreenTravel(travel, [action], `${facing}-facing vehicle, ${action} touch`);
      if (facing === action)
        assert.ok(travel.speed > 0.5, `${action}: following the vehicle's nose drives forward`);
      else if (
        screenDirections[facing].x + screenDirections[action].x === 0 &&
        screenDirections[facing].y + screenDirections[action].y === 0
      )
        assert.ok(travel.speed < -0.5, `${action}: opposite the vehicle's nose reverses`);
      await touch.end();
      await assertPressed([], `${action}: lifting the thumb releases input`);
    }
  }
  for (const vertical of ['up', 'down']) {
    for (const horizontal of ['left', 'right']) {
      await reset(vertical);
      const corner = await padPoint(vertical, horizontal);
      const touch = await page.touchscreen.touchStart(corner.x, corner.y);
      await assertPressed([vertical, horizontal], 'One finger in a corner holds both directions');
      const travel = await measureDriving(page, debugName);
      assertScreenTravel(travel, [vertical, horizontal], `${vertical} + ${horizontal}`);
      assert.ok(
        travel.x * screenDirections[horizontal].x > 0.5 &&
          travel.y * screenDirections[vertical].y > 0.5,
        'A diagonal moves along both screen axes',
      );
      await touch.end();
      await assertPressed([], 'Lifting the thumb releases both axes');
    }
  }
  // The same captured finger can select diagonals, return to neutral, or leave.
  await reset();
  const drivingTouch = await press('up');
  const upperLeft = await padPoint('up', 'left');
  await drivingTouch.move(upperLeft.x, upperLeft.y);
  await assertPressed(['up', 'left'], 'Sliding into a corner combines screen directions');
  const lowerRight = await padPoint('down', 'right');
  await drivingTouch.move(lowerRight.x, lowerRight.y);
  await assertPressed(['down', 'right'], 'Sliding across the pad selects the opposite diagonal');
  assertScreenTravel(
    await measureDriving(page, debugName, 90),
    ['down', 'right'],
    'Sliding to the opposite corner changes real movement',
  );
  const neutral = await padPoint();
  await drivingTouch.move(neutral.x, neutral.y);
  await assertPressed([], 'The center of the D-pad is neutral');
  const viewport = page.viewport();
  await drivingTouch.move(viewport.width / 2, viewport.height / 2);
  await assertPressed([], 'Sliding off the D-pad releases both directions');
  const up = await center('up');
  await drivingTouch.move(up.x, up.y);
  await assertPressed(['up'], 'Reentering the pad resumes the selected direction');
  const auxiliary = await page.$eval(
    '.driving-actions [data-control]',
    (button) => button.dataset.control,
  );
  const auxiliaryCenter = await center(auxiliary);
  await drivingTouch.move(auxiliaryCenter.x, auxiliaryCenter.y);
  await assertPressed([], 'A captured D-pad finger cannot activate the right action button');
  await drivingTouch.end();
  await assertPressed([], 'Ending a sliding gesture leaves no controls held');

  await reset();
  const leftTouch = await press('left');
  const upTouch = await press('up');
  await assertPressed(['up', 'left'], 'Separate fingers on the D-pad remain independent');
  await leftTouch.end();
  await assertPressed(['up'], 'Releasing left keeps the other finger driving up');
  const beforeAuxiliary = await page.evaluate((debugName) => {
    const game = window[debugName];
    for (let i = 0; i < 45; i++) game.update(1 / 60);
    return { speed: game.state.speed, boost: game.state.boost };
  }, debugName);
  const auxiliaryTouch = await press(auxiliary);
  await assertPressed(['up', auxiliary], 'The right thumb can use its action while driving');
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
  await assertPressed(['up'], 'Releasing the right action preserves the left thumb’s input');
  await upTouch.end();
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
  exerciseDrivingKeyboard,
  assertCompactDrivingUI,
  exerciseCompactDrivingUI,
};

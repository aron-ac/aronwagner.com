const assert = require('node:assert/strict');
const { settleCamera } = require('./browser.cjs');

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

async function resetDriving(
  page,
  { debugName, start, countdownFrames = 0, position },
  facing = 'up',
) {
  await page.evaluate(
    ({ debugName, start, countdownFrames, heading, position }) => {
      const game = window[debugName];
      game[start]();
      for (let i = 0; i < countdownFrames; i++) game.update(1 / 60);
      if (position) {
        const { x, z } = position;
        const bounds = game.world.bounds;
        const clearance = Math.min(
          x - bounds.minX,
          bounds.maxX - x,
          z - bounds.minZ,
          bounds.maxZ - z,
          ...game.world.obstacles.map(
            (obstacle) => Math.hypot(x - obstacle.x, z - obstacle.z) - obstacle.radius,
          ),
        );
        if (clearance < 16) throw new Error('Driving test needs a clear area of the real map.');
        Object.assign(game.state, { x, z });
      }
      game.state.heading = heading;
    },
    { debugName, start, countdownFrames, position, heading: screenDirections[facing].heading },
  );
  // A synchronous restart changes the vehicle before the render loop relocates
  // its camera. Project movement only once the camera has reached the new spawn.
  await settleCamera(page, debugName);
}

async function measureDriving(page, debugName, frames = 30, turnFrames = 60) {
  return page.evaluate(
    ({ debugName, frames, turnFrames }) => {
      const game = window[debugName];
      const bumps = game.state.bumps;
      // A direction change turns the nose before settling into its new course.
      // Measure that settled course, not the arc traveled while turning around.
      for (let i = 0; i < turnFrames; i++) game.update(1 / 60);
      // Freeze projection for both endpoints. Camera following must not create
      // or conceal movement in a direction test.
      const camera = game.camera.clone();
      camera.updateMatrixWorld(true);
      const viewport = document.getElementById('viewport');
      const point = camera.position.clone().set(game.state.x, 0, game.state.z);
      const before = point.clone().project(camera);
      let rotation = 0;
      let minimumSpeed = Infinity;
      for (let i = 0; i < frames; i++) {
        const heading = game.state.heading;
        game.update(1 / 60);
        rotation += Math.atan2(
          Math.sin(game.state.heading - heading),
          Math.cos(game.state.heading - heading),
        );
        minimumSpeed = Math.min(minimumSpeed, game.state.speed);
      }
      const after = point.clone().set(game.state.x, 0, game.state.z).project(camera);
      const nose = point
        .clone()
        .set(
          game.state.x + Math.sin(game.state.heading) * 3,
          0,
          game.state.z + Math.cos(game.state.heading) * 3,
        )
        .project(camera);
      const velocity = point
        .clone()
        .set(
          game.state.x + (game.state.vx ?? Math.sin(game.state.heading) * game.state.speed),
          0,
          game.state.z + (game.state.vz ?? Math.cos(game.state.heading) * game.state.speed),
        )
        .project(camera);
      return {
        x: ((after.x - before.x) * viewport.clientWidth) / 2,
        y: ((after.y - before.y) * viewport.clientHeight) / 2,
        speed: game.state.speed,
        minimumSpeed,
        rotation,
        nose: {
          x: (nose.x - after.x) * viewport.clientWidth,
          y: (nose.y - after.y) * viewport.clientHeight,
        },
        velocity: {
          x: (velocity.x - after.x) * viewport.clientWidth,
          y: (velocity.y - after.y) * viewport.clientHeight,
        },
        bumps: game.state.bumps - bumps,
      };
    },
    { debugName, frames, turnFrames },
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
    along > 0.75 && along / Math.hypot(travel.x, travel.y) > 0.95,
    `${label}: real movement follows the requested screen direction (${JSON.stringify(travel)})`,
  );
  for (const property of ['nose', 'velocity']) {
    const vector = travel[property];
    assert.ok(
      (vector.x * desired.x + vector.y * desired.y) /
        (Math.hypot(vector.x, vector.y) * Math.hypot(desired.x, desired.y)) >
        0.95,
      `${label}: ${property} aligns with the requested direction (${JSON.stringify(travel)})`,
    );
  }
  assert.ok(
    travel.minimumSpeed > 0.5,
    `${label}: the vehicle travels nose-first rather than selecting reverse`,
  );
  assert.equal(travel.bumps, 0, `${label}: direction check does not rely on a collision`);
}

function assertCircling(travel, horizontal, label) {
  const clockwise = horizontal === 'right';
  assert.ok(
    travel.rotation * (clockwise ? -1 : 1) > 1.3,
    `${label}: the held chord keeps turning ${clockwise ? 'clockwise' : 'counter-clockwise'} (${JSON.stringify(travel)})`,
  );
  assert.ok(
    Math.hypot(travel.x, travel.y) > 0.75 && travel.speed > 0.5 && travel.minimumSpeed >= 0,
    `${label}: circling drives the vehicle forward along a real arc`,
  );
  assert.equal(travel.bumps, 0, `${label}: the turn does not rely on a collision`);
}

async function exerciseDrivingKeyboard(page, options) {
  for (const facing of Object.keys(screenDirections)) {
    for (const action of Object.keys(screenDirections)) {
      await resetDriving(page, options, facing);
      const key = screenDirections[action].key;
      await page.keyboard.down(key);
      const travel = await measureDriving(page, options.debugName);
      await page.keyboard.up(key);
      assertScreenTravel(travel, [action], `${facing}-facing vehicle, ${key}`);
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
  for (const horizontal of ['left', 'right']) {
    await resetDriving(page, options);
    await page.keyboard.down('ArrowUp');
    await page.keyboard.down(screenDirections[horizontal].key);
    assertCircling(
      await measureDriving(page, options.debugName, 45, 0),
      horizontal,
      `Keyboard Up + ${horizontal}`,
    );
    await page.keyboard.up(screenDirections[horizontal].key);
    await page.keyboard.up('ArrowUp');
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
      assertCircling(
        await measureDriving(page, debugName, 45, 0),
        horizontal,
        `One-finger ${vertical} + ${horizontal}`,
      );
      if (vertical === 'up')
        assertCircling(
          await measureDriving(page, debugName, 45, 0),
          horizontal,
          `Holding one-finger ${vertical} + ${horizontal} continues the circle`,
        );
      await touch.end();
      await assertPressed([], 'Lifting the thumb releases both axes');
    }
  }
  // The same captured finger can select a circling chord, return to neutral, or leave.
  await reset();
  const drivingTouch = await press('up');
  const upperLeft = await padPoint('up', 'left');
  await drivingTouch.move(upperLeft.x, upperLeft.y);
  await assertPressed(['up', 'left'], 'Sliding into a corner selects a circling chord');
  const lowerRight = await padPoint('down', 'right');
  await drivingTouch.move(lowerRight.x, lowerRight.y);
  await assertPressed(['down', 'right'], 'Sliding across the pad changes the circling direction');
  assertCircling(
    await measureDriving(page, debugName, 45, 0),
    'right',
    'Sliding to the opposite corner changes real turning',
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
  const rightTouch = await press('right');
  const secondUpTouch = await press('up');
  await assertPressed(['up', 'right'], 'Two fingers can hold the clockwise circling chord');
  assertCircling(await measureDriving(page, debugName, 45, 0), 'right', 'Two-finger Up + Right');
  assertCircling(
    await measureDriving(page, debugName, 45, 0),
    'right',
    'Holding two-finger Up + Right continues the circle',
  );
  await rightTouch.end();
  await secondUpTouch.end();
  await assertPressed([], 'Releasing both circling fingers clears the chord');

  await reset();
  const leftTouch = await press('left');
  const upTouch = await press('up');
  await assertPressed(['up', 'left'], 'Separate fingers on the D-pad remain independent');
  assertCircling(await measureDriving(page, debugName, 45, 0), 'left', 'Two-finger Up + Left');
  assertCircling(
    await measureDriving(page, debugName, 45, 0),
    'left',
    'Holding two-finger Up + Left continues the circle',
  );
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
      extraPanels: ['.game-brand', '#speedometer', 'footer', '#recover'].filter(visible),
      mapVisible: visible('#map-panel'),
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
        '#map-panel',
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
  assert.deepEqual(layout.extraPanels, [], `${label}: compact play hides secondary chrome`);
  assert.equal(layout.mapVisible, true, `${label}: the map is visible by default`);
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
  assert.equal(await mapVisible(), true, 'The compact map is shown by default');
  assert.equal(
    await page.$eval('#map-toggle', (button) => button.getAttribute('aria-expanded')),
    'true',
  );
  await page.click('#map-toggle');
  assert.equal(await mapVisible(), false, 'Map can be dismissed without pausing');
  await page.click('#map-toggle');
  assert.equal(await mapVisible(), true, 'Map can be shown again during play');
  await page.click('#pause');
  assert.equal(await mapVisible(), false, 'The map hides behind the pause menu');
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
  assert.equal(await mapVisible(), true, 'Resuming after recovery shows the map');
}

module.exports = {
  assertDrivingControls,
  exerciseDrivingControls,
  exerciseDrivingKeyboard,
  assertCompactDrivingUI,
  exerciseCompactDrivingUI,
};

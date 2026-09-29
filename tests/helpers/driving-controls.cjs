const assert = require('node:assert/strict');

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
  await page.tap('#map-toggle');
  assert.equal(await mapVisible(), false, 'One touch dismisses the map exactly once');
  await page.tap('#map-toggle');
  assert.equal(await mapVisible(), true, 'A second touch restores the map exactly once');
  await page.click('#map-toggle');
  assert.equal(await mapVisible(), false, 'Map can be dismissed without pausing');
  await page.click('#map-toggle');
  assert.equal(await mapVisible(), true, 'Map can be shown again during play');
  await page.focus('#map-toggle');
  await page.keyboard.press('Enter');
  assert.equal(await mapVisible(), false, 'Enter activates the focused Map button');
  await page.keyboard.press('Space');
  assert.equal(await mapVisible(), true, 'Space activates the focused Map button');
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

// The caller holds a real scene finger throughout this sequence. Chromium does
// not synthesize a click for the second finger, so an isolated tap misses this bug.
async function exerciseMapWhileSteering(page, debugName) {
  for (const open of [false, true]) {
    await page.tap('#map-toggle');
    const state = await page.evaluate((debugName) => {
      const game = window[debugName];
      return {
        mapVisible: document.querySelector('#map-panel').getClientRects().length > 0,
        expanded: document.querySelector('#map-toggle').getAttribute('aria-expanded'),
        touch: game.touchDrive.snapshot(),
      };
    }, debugName);
    assert.equal(
      state.mapVisible,
      open,
      `A second-finger tap ${open ? 'opens' : 'closes'} the map exactly once`,
    );
    assert.equal(state.expanded, String(open), 'The map accessibility state matches visibility');
    assert.ok(
      state.touch.active && state.touch.progress > 0,
      'Toggling the map preserves the held steering command',
    );
  }
}

module.exports = {
  assertCompactDrivingUI,
  exerciseCompactDrivingUI,
  exerciseMapWhileSteering,
};

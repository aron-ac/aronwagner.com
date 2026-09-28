const { test } = require('node:test');
/* Run against a local HTTP server. See assets/surf-rides/README.md. */
const assert = require('node:assert/strict');
const {
  launchBrowser,
  loadGame,
  closeBrowser,
  artifactPath,
  settleCamera,
} = require('./helpers/browser.cjs');
const gameURL = new URL(
  process.env.GAME_URL ||
    new URL('surf-riders.html', process.env.SITE_URL || 'http://localhost:8000/'),
);
gameURL.searchParams.set('debug', '1');
const url = gameURL.href;
test('surf rides smoke', { timeout: 300_000 }, async () => {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('response', (response) => {
      if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
    });
    await page.setViewport({ width: 1440, height: 1000 });
    await loadGame(page, url, 'surfDebug');
    assert.equal(await page.title(), 'Surf Riders · Mark Hammonds', 'The game uses its new name');
    const navigationLinks = await page.$$eval('a[href]', (els) =>
      els
        .filter((el) => el.getAttribute('href') && !el.getAttribute('href').startsWith('#'))
        .map((el) => ({ href: el.getAttribute('href'), target: el.target, rel: [...el.relList] })),
    );
    assert.ok(navigationLinks.length > 0, 'Game has navigation links to check');
    for (const link of navigationLinks) {
      assert.equal(
        link.target,
        '_blank',
        `${link.href} targets a new tab without replacing the game`,
      );
      assert.ok(
        link.rel.includes('noopener') && link.rel.includes('noreferrer'),
        `${link.href} protects the originating game tab`,
      );
    }
    const cameraView = await page.evaluate(() => {
      const camera = surfDebug.camera;
      const direction = camera.getWorldDirection(camera.position.clone());
      return {
        perspective: camera.isPerspectiveCamera,
        fov: camera.fov,
        elevation: (Math.atan2(-direction.y, Math.hypot(direction.x, direction.z)) * 180) / Math.PI,
        azimuth: (Math.atan2(-direction.x, -direction.z) * 180) / Math.PI,
      };
    });
    assert.equal(cameraView.perspective, true, 'Driving scene uses perspective projection');
    assert.equal(cameraView.fov, 25, 'A narrow lens keeps the Jeep proportions natural');
    assert.ok(
      Math.abs(cameraView.elevation - 34.2) < 0.1 && Math.abs(cameraView.azimuth - 45) < 0.1,
      'Camera follows the reference’s elevated diagonal angle',
    );
    const mechanical = await page.evaluate(() => {
      const d = window.surfDebug,
        s = d.state,
        results = [];
      const check = (condition, name) => {
        if (!condition) throw new Error(name);
        results.push(name);
      };
      const step = (seconds) => {
        for (let i = 0; i < Math.ceil(seconds * 60); i++) d.update(1 / 60);
      };
      d.startGame();
      const coconuts = d.coconuts.items;
      check(
        coconuts.length >= 12 &&
          coconuts.every((item) => {
            const b = d.world.bounds;
            return (
              item.x > b.minX + 1.4 &&
              item.x < b.maxX - 1.4 &&
              item.z > b.minZ + 1.4 &&
              item.z < b.maxZ - 1.4 &&
              d.world.obstacles.every(
                (obstacle) =>
                  Math.hypot(item.x - obstacle.x, item.z - obstacle.z) >= obstacle.radius + 1.5,
              ) &&
              [...d.world.pickups, d.world.dropoff].every(
                (point) => Math.hypot(item.x - point.x, item.z - point.z) >= 6,
              )
            );
          }),
        'Coconut routes stay drivable and clear of ride destinations',
      );
      const firstCoconut = coconuts[0];
      s.x = firstCoconut.x;
      s.z = firstCoconut.z;
      s.speed = 0;
      const beforeCoconut = { remaining: s.remaining, patience: s.ride.patience, cash: s.cash };
      d.update(1 / 60);
      check(
        s.coconuts === 1 && d.score() === 25 && !firstCoconut.active,
        'Collecting a coconut awards 25 points',
      );
      check(
        s.cash === beforeCoconut.cash &&
          Math.abs(s.remaining - (beforeCoconut.remaining - 1 / 60)) < 1e-8 &&
          Math.abs(s.ride.patience - (beforeCoconut.patience - 1 / 60)) < 1e-8,
        'Coconuts leave fares and both clocks unchanged apart from elapsed time',
      );
      step(0.1);
      check(
        s.coconuts === 1 && d.score() === 25,
        'A collected coconut cannot score again during the shift',
      );
      const secondCoconut = coconuts.find((item) => item.active);
      s.x = secondCoconut.x;
      s.z = secondCoconut.z - 19 / 60;
      s.heading = 0;
      s.speed = 19;
      d.update(1 / 60);
      check(
        s.coconuts === 2 && d.score() === 50 && !secondCoconut.active,
        'Driving through a coconut at full speed collects it',
      );
      const waitingCoconut = coconuts.find((item) => item.active);
      s.x = waitingCoconut.x;
      s.z = waitingCoconut.z;
      s.speed = 0;
      d.pauseGame();
      step(3);
      check(s.coconuts === 2 && waitingCoconut.active, 'Paused shifts cannot collect coconuts');
      d.resumeGame();
      d.endGame();
      step(1);
      check(s.coconuts === 2 && waitingCoconut.active, 'Ended shifts cannot collect coconuts');
      check(
        Number(localStorage.getItem('cr-surf-rides-best-score')) === 50,
        'Personal best includes coconut points under the new score key',
      );
      check(
        document.getElementById('results').textContent.includes('50'),
        'Shift results show the combined points total',
      );
      d.startGame();
      check(
        s.coconuts === 0 && d.score() === 0 && coconuts.every((item) => item.active),
        'A new shift restores every coconut and resets points',
      );
      check(
        s.remaining === 180 && s.ride.phase === 'pickup',
        'Three-minute shift starts with a request',
      );
      const first = s.ride.pickup;
      s.x = first.x;
      s.z = first.z;
      s.speed = 0;
      step(1.2);
      check(
        s.ride.phase === 'dropoff' && d.jeep.userData.surfboards.visible,
        'Stopped pickup boards the surfer and roof boards',
      );
      const obstacle = d.world.obstacles[0];
      s.x = obstacle.x;
      s.z = obstacle.z;
      s.speed = 8;
      d.update(1 / 60);
      check(s.ride.comfort === 82 && s.bumps === 1, 'Collision reduces passenger comfort once');
      s.x = d.world.dropoff.x;
      s.z = d.world.dropoff.z;
      s.speed = 0;
      step(1.2);
      check(
        s.rides === 1 && s.cash > 0 && s.totalTips > 0 && s.streak === 1 && !s.ride,
        'Beach drop-off awards fare, tip and streak',
      );
      check(
        d.score() === s.cash + s.coconuts * 25,
        'Ride earnings contribute to the same score as coconuts',
      );
      check(!d.jeep.userData.surfboards.visible, 'Roof clears after drop-off');
      step(2.6);
      check(s.ride.phase === 'pickup', 'Next request arrives automatically');
      s.ride.patience = 0.01;
      d.update(0.02);
      check(s.missed === 1 && s.streak === 0 && !s.ride, 'Missed pickup resets streak');
      step(2.1);
      s.x = s.ride.pickup.x;
      s.z = s.ride.pickup.z;
      s.speed = 0;
      step(1.2);
      s.ride.patience = 0.01;
      d.update(0.02);
      check(
        s.missed === 2 && !s.ride && !d.jeep.userData.surfboards.visible,
        'Expired passenger ride clears without fare',
      );
      step(2.1);
      d.pauseGame();
      const remaining = s.remaining,
        patience = s.ride.patience;
      step(3);
      check(s.remaining === remaining && s.ride.patience === patience, 'Pause freezes both clocks');
      d.resumeGame();
      const beforeRecover = s.remaining;
      d.recover();
      check(
        s.remaining === beforeRecover - 5 && s.speed === 0,
        'Recovery returns to road with a five-second penalty',
      );
      s.remaining = 0.01;
      d.update(0.02);
      check(
        s.mode === 'ended' && !document.querySelector('#results').classList.contains('hidden'),
        'Shift ends with results',
      );
      d.startGame();
      check(
        s.cash === 0 && s.rides === 0 && s.remaining === 180 && s.missed === 0,
        'New shift resets all scores and timers',
      );
      return results;
    });
    // Browser keyboard events must drive the real input path, without teleporting.
    await page.keyboard.down('KeyW');
    await page.evaluate(() => {
      for (let i = 0; i < 177; i++) surfDebug.update(1 / 60);
    });
    await page.keyboard.up('KeyW');
    await page.keyboard.down('Space');
    await page.evaluate(() => {
      for (let i = 0; i < 140; i++) surfDebug.update(1 / 60);
    });
    await page.keyboard.up('Space');
    assert.equal(
      await page.evaluate(() => surfDebug.state.ride.phase),
      'dropoff',
      'Keyboard drive and braking reach first pickup',
    );
    await page.keyboard.press('KeyP');
    assert.equal(await page.evaluate(() => surfDebug.state.mode), 'paused');
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => surfDebug.state.mode), 'playing');
    await settleCamera(page, 'surfDebug');
    const desktopLayout = await page.evaluate(() => {
      const overlaps = (a, b) =>
        a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      const scoreHud = document.getElementById('coconut-hud').getBoundingClientRect();
      const dispatch = document.getElementById('dispatch').getBoundingClientRect();
      const pop = document.getElementById('coconut-pop');
      const wasShowing = pop.classList.contains('show');
      pop.classList.add('show');
      const popRect = pop.getBoundingClientRect();
      const popOverlap = ['dispatch', 'coconut-hud', 'target', 'map-panel'].some((id) =>
        overlaps(popRect, document.getElementById(id).getBoundingClientRect()),
      );
      if (!wasShowing) pop.classList.remove('show');
      return {
        scoreOverlap: overlaps(scoreHud, dispatch),
        popOverlap,
        popPointerEvents: getComputedStyle(pop).pointerEvents,
        scoreMatches:
          Number(document.getElementById('score').textContent.replace(/[^\d]/g, '')) ===
          surfDebug.score(),
        countMatches:
          Number(document.getElementById('coconut-count').textContent) === surfDebug.state.coconuts,
      };
    });
    assert.equal(desktopLayout.scoreOverlap, false, 'Desktop coconut HUD stays clear of dispatch');
    assert.equal(
      desktopLayout.popOverlap,
      false,
      'Desktop coconut popup stays clear of other HUD panels',
    );
    assert.equal(
      desktopLayout.popPointerEvents,
      'none',
      'Coconut popup cannot block driving controls',
    );
    assert.ok(
      desktopLayout.scoreMatches && desktopLayout.countMatches,
      'Live HUD matches coconut count and combined score',
    );
    await page.screenshot({ path: artifactPath('surf-riders-desktop.png') });
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 844, height: 390 },
    ]) {
      await page.setViewport({ ...viewport, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
      await loadGame(page, url, 'surfDebug');
      await page.click('#start');
      await settleCamera(page, 'surfDebug');
      const layout = await page.evaluate(() => {
        const bounds = (id) => {
          const r = document.getElementById(id).getBoundingClientRect();
          return { x: r.x, y: r.y, right: r.right, bottom: r.bottom };
        };
        const overlaps = (a, b) =>
          a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y;
        const a = bounds('target'),
          b = bounds('map-panel');
        const pop = document.getElementById('coconut-pop');
        pop.classList.add('show');
        const popBounds = bounds('coconut-pop');
        const popOverlap = ['dispatch', 'coconut-hud', 'target', 'map-panel'].some((id) =>
          overlaps(popBounds, bounds(id)),
        );
        pop.classList.remove('show');
        return {
          overflow: document.documentElement.scrollWidth > innerWidth,
          scroll: scrollY,
          targetOverlap: overlaps(a, b),
          coconutOverlap: overlaps(bounds('coconut-hud'), bounds('dispatch')),
          popOverlap,
          hudTop: document.querySelector('.hud').getBoundingClientRect().top,
          controls: [...document.querySelectorAll('[data-control]')].map((el) => {
            const r = el.getBoundingClientRect();
            return { x: r.x, y: r.y, bottom: r.bottom, right: r.right };
          }),
        };
      });
      assert.equal(layout.overflow, false, 'No horizontal overflow');
      assert.equal(layout.targetOverlap, false, 'Target remains clear of minimap');
      assert.equal(layout.coconutOverlap, false, 'Coconut HUD remains clear of dispatch');
      assert.equal(layout.popOverlap, false, 'Coconut popup remains clear of other HUD panels');
      assert.ok(layout.hudTop >= 0, 'HUD stays visible after starting');
      assert.ok(
        layout.controls.every(
          (r) => r.x >= 0 && r.y >= 0 && r.bottom <= viewport.height && r.right <= viewport.width,
        ),
        'All touch controls visible',
      );
      const client = await page.createCDPSession();
      const gas = await page.$('[data-control="gas"]');
      const rect = await gas.boundingBox();
      const touchPoints = [{ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, id: 1 }];
      await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints });
      assert.ok(
        await page.evaluate(() => {
          for (let i = 0; i < 30; i++) surfDebug.update(1 / 60);
          return surfDebug.state.speed > 0;
        }),
        'Touch gas accelerates',
      );
      await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      assert.ok(
        await page.evaluate(() => {
          const before = surfDebug.state.speed;
          for (let i = 0; i < 15; i++) surfDebug.update(1 / 60);
          return (
            surfDebug.state.speed < before &&
            !document.querySelector('[data-control="gas"]').classList.contains('pressed')
          );
        }),
        'Touch release clears input',
      );
      await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints });
      await client.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
      assert.ok(
        await page.evaluate(
          () => !document.querySelector('[data-control="gas"]').classList.contains('pressed'),
        ),
        'Touch cancellation clears input',
      );
      await client.detach();
      await page.screenshot({ path: artifactPath(`surf-riders-${viewport.width}.png`) });
    }
    await loadGame(page, new URL('cr-surf-rides.html?debug=1#start', url).href, 'surfDebug');
    const redirected = new URL(page.url());
    assert.ok(
      redirected.pathname.endsWith('/surf-riders.html'),
      'The old game URL redirects to Surf Riders',
    );
    assert.equal(redirected.search, '?debug=1', 'The redirect retains query parameters');
    assert.equal(redirected.hash, '#start', 'The redirect retains the fragment');
    assert.deepEqual(errors, [], 'No page errors or failed asset requests');
    console.log(
      `PASS: ${mechanical.length} mechanics, keyboard pickup, pause keys, portrait and landscape layouts.\n${mechanical.join('\n')}`,
    );
  } finally {
    await closeBrowser(browser);
  }
});

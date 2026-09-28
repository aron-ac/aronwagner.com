const { test } = require('node:test');
/* Run against a local HTTP server. Optional PUPPETEER_MODULE, CHROME_BIN and GAME_URL. */
const assert = require('node:assert/strict');
const {
  launchBrowser,
  closeBrowser,
  artifactPath,
  settleCamera,
} = require('./helpers/browser.cjs');
const url = new URL(
  process.env.GAME_URL ||
    new URL('bay-racer.html', process.env.SITE_URL || 'http://localhost:8000/').href,
);
url.searchParams.set('debug', '1');

test('bay racer smoke', { timeout: 300_000 }, async () => {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('response', (response) => {
      if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
    });
    await page.setViewport({ width: 1440, height: 1000 });
    await page.goto(url.href, { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => window.bayDebug);
    assert.equal(await page.title(), 'Bay Racer · Mark Hammonds');
    await page.screenshot({ path: artifactPath('bay-racer-menu-desktop.png') });
    assert.equal(
      await page.evaluate(() => bayDebug.camera.isPerspectiveCamera),
      true,
      'Boat and scenery share a perspective camera',
    );
    const links = await page.$$eval('a[href]', (els) =>
      els
        .filter((el) => !el.getAttribute('href').startsWith('#'))
        .map((el) => ({ href: el.getAttribute('href'), target: el.target, rel: [...el.relList] })),
    );
    assert.ok(links.length > 0, 'Game provides navigation links');
    for (const link of links) {
      assert.equal(link.target, '_blank', `${link.href} keeps the game in its original tab`);
      assert.ok(
        link.rel.includes('noopener') && link.rel.includes('noreferrer'),
        `${link.href} protects the originating game tab`,
      );
    }
    const mechanical = await page.evaluate(() => {
      const d = bayDebug,
        s = d.state,
        results = [];
      const check = (condition, label) => {
        if (!condition) throw new Error(label);
        results.push(label);
      };
      const step = (seconds) => {
        for (let i = 0; i < Math.ceil(seconds * 60); i++) d.update(1 / 60);
      };
      const ready = () => {
        d.startRace();
        step(3.1);
        check(s.mode === 'racing', 'Countdown releases the boat into the race');
      };
      // Cross the actual checkpoint plane through the same movement update as driving.
      const cross = (index, { reverse = false, offset = 0 } = {}) => {
        d.clearInput();
        const gate = d.world.gates[index],
          n = gate.normal,
          direction = reverse ? -1 : 1;
        s.x = gate.x - n.x * 0.12 * direction + n.z * offset;
        s.z = gate.z - n.z * 0.12 * direction - n.x * offset;
        s.heading = Math.atan2(n.x * direction, n.z * direction);
        s.speed = 12;
        s.vx = n.x * 12 * direction;
        s.vz = n.z * 12 * direction;
        s.steer = 0;
        d.update(1 / 30);
      };
      const finishCourse = () => {
        let attempts = 0;
        while (s.mode === 'racing' && attempts++ < d.world.gates.length * 4) cross(s.nextGate);
        check(
          s.mode === 'finished',
          'Crossing every ordered gate for three laps finishes the race',
        );
      };
      d.startRace();
      check(
        s.mode === 'countdown' && s.countdown === 3 && s.lap === 1 && s.nextGate === 1,
        'Race starts with a three-second countdown and the first checkpoint',
      );
      check(
        document.querySelector('#gate-label').textContent === 'GATE 01 / 08' &&
          !!d.world.group.getObjectByName('Checkpoint 1'),
        'Initial HUD gate number matches the first numbered buoy signs',
      );
      const start = { x: s.x, z: s.z };
      d.keys.add('KeyW');
      step(1);
      d.clearInput();
      check(
        s.mode === 'countdown' &&
          s.elapsed === 0 &&
          s.speed === 0 &&
          s.x === start.x &&
          s.z === start.z,
        'Throttle cannot move the boat or start the clock before the countdown',
      );
      step(2.1);
      check(s.mode === 'racing', 'Countdown starts racing automatically');
      cross(3);
      check(s.nextGate === 1 && s.lap === 1, 'Later checkpoints cannot be collected out of order');
      cross(0);
      check(s.nextGate === 1 && s.lap === 1, 'Crossing the finish early cannot skip a lap');
      cross(1, { reverse: true });
      check(s.nextGate === 1, 'A checkpoint crossed backward does not count');
      cross(1, { offset: d.world.gates[1].halfWidth + 6 });
      check(s.nextGate === 1, 'Passing outside the buoy opening does not count');
      cross(1);
      check(
        s.nextGate === 2 && s.cleanGates === 1,
        'A forward crossing between the buoys advances the checkpoint',
      );
      cross(1);
      check(s.nextGate === 2 && s.cleanGates === 1, 'The same gate cannot score twice');
      d.pauseRace();
      const frozen = { elapsed: s.elapsed, boost: s.boost, x: s.x, z: s.z };
      step(2);
      check(
        s.mode === 'paused' &&
          s.elapsed === frozen.elapsed &&
          s.boost === frozen.boost &&
          s.x === frozen.x &&
          s.z === frozen.z,
        'Pause freezes the clock, boat and boost',
      );
      d.resumeRace();
      check(s.mode === 'racing', 'Resume restores the active race');
      const recoverBefore = { penalties: s.penalties, gate: s.nextGate, lap: s.lap };
      d.recover();
      check(
        s.penalties === recoverBefore.penalties + 5 &&
          s.nextGate === recoverBefore.gate &&
          s.lap === recoverBefore.lap &&
          s.speed === 0,
        'Recovery adds five seconds without granting a checkpoint',
      );
      const obstacle = d.world.obstacles.find((o) => Math.abs(o.x) < 30 && Math.abs(o.z) < 30);
      const collide = () => {
        s.x = obstacle.x + obstacle.radius - 0.2;
        s.z = obstacle.z;
        s.heading = -Math.PI / 2;
        s.speed = 8;
        s.vx = -8;
        s.vz = 0;
        d.update(1 / 60);
      };
      const beforeCollision = { bumps: s.bumps, penalties: s.penalties };
      collide();
      check(
        s.bumps === beforeCollision.bumps + 1 && s.penalties === beforeCollision.penalties + 2,
        'A fast collision records a bump and two-second penalty',
      );
      const afterCollision = s.penalties;
      collide();
      check(
        s.penalties === afterCollision,
        'Collision cooldown prevents repeat penalties on consecutive frames',
      );
      ready();
      d.keys.add('KeyW');
      step(1.2);
      d.clearInput();
      const normalSpeed = s.speed;
      ready();
      d.keys.add('KeyW');
      d.keys.add('Space');
      step(1.2);
      d.clearInput();
      check(
        s.boost < 100 && s.speed > normalSpeed,
        'Boost consumes its charge and accelerates harder than normal throttle',
      );
      const drained = s.boost;
      step(0.4);
      check(s.boost > drained, 'Boost recharges when released');
      ready();
      s.elapsed = 90;
      for (let index = 1; index < d.world.gates.length; index++) cross(index);
      check(
        s.nextGate === 0 && s.lap === 1,
        'A full set of checkpoints leads back to the finish gate',
      );
      cross(0);
      check(
        s.lap === 2 && s.nextGate === 1 && s.lapTimes.length === 1,
        'Crossing the finish records a lap and advances to lap two',
      );
      finishCourse();
      check(s.lapTimes.length === 3, 'Finish records all three lap splits');
      const best = Number(localStorage.getItem('bay-racer-best-time'));
      check(best > 0 && Number.isFinite(best), 'Finished race saves a personal best');
      check(
        !document.querySelector('#results').classList.contains('hidden'),
        'Finished race displays results',
      );
      const finished = { elapsed: s.elapsed, lap: s.lap, penalties: s.penalties };
      step(1);
      check(
        s.elapsed === finished.elapsed &&
          s.lap === finished.lap &&
          s.penalties === finished.penalties,
        'Finished race stops advancing',
      );
      ready();
      s.elapsed = best + 20;
      finishCourse();
      check(
        Number(localStorage.getItem('bay-racer-best-time')) === best,
        'A slower finish does not replace the personal best',
      );
      ready();
      finishCourse();
      check(
        Number(localStorage.getItem('bay-racer-best-time')) < best,
        'A faster finish replaces the personal best',
      );
      d.startRace();
      check(
        s.elapsed === 0 &&
          s.penalties === 0 &&
          s.bumps === 0 &&
          s.cleanGates === 0 &&
          s.boost === 100 &&
          s.lapTimes.length === 0 &&
          s.lap === 1 &&
          s.nextGate === 1,
        'Restart clears race progress, penalties and boost use',
      );
      step(3.1);
      return results;
    });
    // Exercise real browser input independently of the checkpoint setup above.
    const initial = await page.evaluate(() => ({ x: bayDebug.state.x, z: bayDebug.state.z }));
    await page.keyboard.down('KeyW');
    await page.evaluate(() => {
      for (let i = 0; i < 60; i++) bayDebug.update(1 / 60);
    });
    await page.keyboard.up('KeyW');
    assert.ok(
      await page.evaluate(
        (initial) =>
          Math.hypot(bayDebug.state.x - initial.x, bayDebug.state.z - initial.z) > 1 &&
          bayDebug.state.speed > 0,
        initial,
      ),
      'Keyboard throttle drives the boat',
    );
    const heading = await page.evaluate(() => bayDebug.state.heading);
    await page.keyboard.down('KeyD');
    await page.keyboard.down('KeyW');
    await page.evaluate(() => {
      for (let i = 0; i < 30; i++) bayDebug.update(1 / 60);
    });
    await page.keyboard.up('KeyD');
    await page.keyboard.up('KeyW');
    assert.ok(
      await page.evaluate((heading) => Math.abs(bayDebug.state.heading - heading) > 0.02, heading),
      'Keyboard steering changes heading while underway',
    );
    await page.keyboard.press('KeyP');
    assert.equal(await page.evaluate(() => bayDebug.state.mode), 'paused');
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => bayDebug.state.mode), 'racing');
    const savedBest = await page.evaluate(() =>
      Number(localStorage.getItem('bay-racer-best-time')),
    );
    await settleCamera(page, 'bayDebug');
    await page.screenshot({ path: artifactPath('bay-racer-desktop.png') });
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 844, height: 390 },
    ]) {
      await page.setViewport({ ...viewport, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
      await page.goto(url.href, { waitUntil: 'networkidle0' });
      await page.waitForFunction(() => window.bayDebug);
      assert.equal(
        await page.evaluate(() => bayDebug.state.best),
        savedBest,
        'Personal best survives reloading the game',
      );
      assert.ok(
        await page.$eval('#start', (el) => {
          const r = el.getBoundingClientRect();
          return r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight;
        }),
        'Start button is visible without scrolling',
      );
      await page.screenshot({ path: artifactPath(`bay-racer-menu-${viewport.width}.png`) });
      await page.click('#start');
      await page.evaluate(() => {
        for (let i = 0; i < 186; i++) bayDebug.update(1 / 60);
      });
      assert.equal(
        await page.evaluate(() => bayDebug.state.mode),
        'racing',
        'Touch start runs the countdown into racing',
      );
      await settleCamera(page, 'bayDebug');
      const layout = await page.evaluate(() => {
        const rect = (el) => {
          const r = el.getBoundingClientRect();
          return {
            x: r.x,
            y: r.y,
            right: r.right,
            bottom: r.bottom,
            width: r.width,
            height: r.height,
          };
        };
        const panels = ['.hud', '#course-panel', '#map-panel', '#target', '#touch-controls'].map(
          (selector) => ({ selector, ...rect(document.querySelector(selector)) }),
        );
        const overlaps = (a, b) =>
          a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y;
        return {
          overflow: document.documentElement.scrollWidth > innerWidth,
          panels,
          overlapping: panels.flatMap((a, i) =>
            panels
              .slice(i + 1)
              .filter((b) => overlaps(a, b))
              .map((b) => `${a.selector} overlaps ${b.selector}`),
          ),
          controls: [...document.querySelectorAll('[data-control]')].map(rect),
        };
      });
      assert.equal(layout.overflow, false, 'Mobile game has no horizontal overflow');
      assert.deepEqual(
        layout.overlapping,
        [],
        `Race information and touch controls stay clear of one another at ${viewport.width}×${viewport.height}`,
      );
      assert.ok(
        layout.panels.every(
          (r) => r.x >= 0 && r.y >= 0 && r.right <= viewport.width && r.bottom <= viewport.height,
        ),
        'Race HUD panels fit the viewport',
      );
      assert.ok(
        layout.controls.length >= 4 &&
          layout.controls.every(
            (r) =>
              r.width > 0 &&
              r.height > 0 &&
              r.x >= 0 &&
              r.y >= 0 &&
              r.right <= viewport.width &&
              r.bottom <= viewport.height,
          ),
        'All touch controls fit the viewport',
      );
      const client = await page.createCDPSession();
      const rect = await (await page.$('[data-control="gas"]')).boundingBox();
      const touchPoints = [{ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, id: 1 }];
      await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints });
      assert.ok(
        await page.evaluate(() => {
          for (let i = 0; i < 45; i++) bayDebug.update(1 / 60);
          return bayDebug.state.speed > 0;
        }),
        'Touch throttle accelerates',
      );
      await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      assert.ok(
        await page.evaluate(() => {
          const before = bayDebug.state.speed;
          for (let i = 0; i < 30; i++) bayDebug.update(1 / 60);
          return (
            bayDebug.state.speed < before &&
            !document.querySelector('[data-control="gas"]').classList.contains('pressed')
          );
        }),
        'Releasing touch throttle clears input and lets the boat coast',
      );
      await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints });
      await client.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
      assert.ok(
        await page.evaluate(
          () => !document.querySelector('[data-control="gas"]').classList.contains('pressed'),
        ),
        'Cancelled touch releases throttle',
      );
      await client.detach();
      const boostRect = await (await page.$('[data-control="boost"]')).boundingBox();
      const gasTouch = await page.touchscreen.touchStart(
        rect.x + rect.width / 2,
        rect.y + rect.height / 2,
      );
      const boostTouch = await page.touchscreen.touchStart(
        boostRect.x + boostRect.width / 2,
        boostRect.y + boostRect.height / 2,
      );
      assert.ok(
        await page.evaluate(() => {
          for (let i = 0; i < 30; i++) bayDebug.update(1 / 60);
          return bayDebug.state.boosting && bayDebug.state.boost < 100;
        }),
        'Two fingers can accelerate and boost together',
      );
      await boostTouch.end();
      assert.ok(
        await page.evaluate(() => {
          bayDebug.update(1 / 60);
          return (
            !bayDebug.state.boosting &&
            document.querySelector('[data-control="gas"]').classList.contains('pressed') &&
            !document.querySelector('[data-control="boost"]').classList.contains('pressed')
          );
        }),
        'Releasing boost keeps the other finger on throttle',
      );
      await gasTouch.end();
      assert.equal(
        await page.$$eval('[data-control].pressed', (els) => els.length),
        0,
        'Releasing both fingers leaves no stuck controls',
      );
      await page.screenshot({ path: artifactPath(`bay-racer-${viewport.width}.png`) });
    }
    assert.deepEqual(errors, [], 'No JavaScript errors or failed game assets');
    console.log(
      `PASS: ${mechanical.length} race checks, keyboard driving, pause keys, touch input, portrait/landscape layout and new-tab navigation.\n${mechanical.join('\n')}`,
    );
  } finally {
    await closeBrowser(browser);
  }
});

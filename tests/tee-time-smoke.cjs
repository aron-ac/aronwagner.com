const { test } = require('node:test');
/* Serve the repo, then run with optional PUPPETEER_MODULE, CHROME_BIN and GAME_URL.
   Golf rules and physics are covered by tests/tee-time.test.js; this checks the page. */
const assert = require('node:assert/strict');
const { launchBrowser, closeBrowser, artifactPath, settlePage } = require('./helpers/browser.cjs');
const url = new URL(
  process.env.GAME_URL ||
    new URL('tee-time.html', process.env.SITE_URL || 'http://localhost:8000/').href,
);
url.searchParams.set('debug', '1');
url.searchParams.set('seed', '4');
const step = (page, frames) =>
  page.evaluate((frames) => {
    for (let i = 0; i < frames; i++) teeDebug.update(1 / 60);
  }, frames);
const untilAim = (page) =>
  page.evaluate(() => {
    const s = teeDebug.state;
    for (let i = 0; i < 3000 && s.phase !== 'aim' && s.mode === 'playing'; i++)
      teeDebug.update(1 / 60);
    return s.phase;
  });

test('tee time smoke', { timeout: 300_000 }, async () => {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage(),
      errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('response', (response) => {
      if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
    });
    await page.setViewport({ width: 1440, height: 1000 });
    await page.goto(url.href, { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => window.teeDebug);
    assert.match(await page.title(), /Tee Time/);
    for (const link of await page.$$eval('a[href]:not([href^="mailto:"])', (els) =>
      els.map((el) => ({ target: el.target, rel: [...el.relList] })),
    )) {
      assert.equal(link.target, '_blank');
      assert.ok(link.rel.includes('noopener') && link.rel.includes('noreferrer'));
    }
    await page.screenshot({ path: artifactPath('tee-time-menu-desktop.png') });

    await page.click('#start');
    assert.equal(await page.evaluate(() => teeDebug.state.mode), 'playing');
    await page.evaluate(() => (teeDebug.state.maggieUsed = true));
    // Keyboard: aim with the arrows, hold Space for power, release to swing.
    const before = await page.evaluate(() => teeDebug.state.aim.angle);
    await page.keyboard.down('ArrowLeft');
    await step(page, 15);
    await page.keyboard.up('ArrowLeft');
    assert.ok((await page.evaluate(() => teeDebug.state.aim.angle)) < before, '← aims higher');
    await page.keyboard.down('Space');
    await step(page, 25);
    assert.ok((await page.evaluate(() => teeDebug.state.aim.power)) > 0.25, 'Space charges');
    await page.keyboard.up('Space');
    await step(page, 1);
    assert.equal(await page.evaluate(() => teeDebug.state.phase), 'swing');
    assert.equal(await untilAim(page), 'aim');
    assert.equal(await page.evaluate(() => teeDebug.state.strokes), 1);
    await page.evaluate(() => teeDebug.updateUI());
    assert.equal(await page.$eval('#strokes', (el) => el.textContent), '1');

    // Mouse: drag back from anywhere and let go.
    await page.evaluate(() => (teeDebug.view.x = Math.max(0, teeDebug.view.x - 300)));
    const box = await (await page.$('#canvas')).boundingBox();
    const x = box.x + box.width / 2,
      y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x - 60, y + 50, { steps: 5 });
    const aim = await page.evaluate(() => ({ ...teeDebug.state.aim }));
    assert.ok(
      aim.power > 0.2 && aim.angle < 0 && Math.cos(aim.angle) > 0,
      `drag aims up-right: ${JSON.stringify({ aim, phase: await page.evaluate(() => teeDebug.state.phase), hit: await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.id || document.elementFromPoint(x, y)?.className, { x, y }) })}`,
    );
    await page.evaluate(() => teeDebug.render());
    await page.screenshot({ path: artifactPath('tee-time-aim-desktop.png') });
    await page.mouse.up();
    await step(page, 1);
    assert.equal(await page.evaluate(() => teeDebug.state.phase), 'swing');
    await untilAim(page);
    assert.equal(await page.evaluate(() => teeDebug.state.strokes), 2);

    await page.keyboard.press('KeyP');
    assert.equal(await page.evaluate(() => teeDebug.state.mode), 'paused');
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => teeDebug.state.mode), 'playing');

    // Sink a putt, see the scorecard, go on to the next hole.
    await page.evaluate(() => {
      const s = teeDebug.state;
      Object.assign(s.ball, { x: s.hole.cup - 40, rolling: true, speed: 150, support: null });
      s.phase = 'flight';
      s.phaseTime = 0;
      for (let i = 0; i < 400 && s.mode === 'playing'; i++) teeDebug.update(1 / 60);
    });
    assert.equal(await page.evaluate(() => teeDebug.state.mode), 'card');
    assert.equal(await page.$$eval('.card-grid > div', (els) => els.length), 9);
    await page.screenshot({ path: artifactPath('tee-time-card-desktop.png') });
    await page.click('#start');
    assert.deepEqual(await page.evaluate(() => [teeDebug.state.mode, teeDebug.state.holeIndex]), [
      'playing',
      1,
    ]);
    await page.evaluate(() => teeDebug.render());
    await page.screenshot({ path: artifactPath('tee-time-living-room.png') });

    // Finish the round: the result, the best round and the golf invite.
    await page.evaluate(() => {
      const s = teeDebug.state;
      s.scores.push(3, 4, 4, 3, 5, 4, 3, 4);
      teeDebug.round.finish();
    });
    assert.equal(await page.evaluate(() => teeDebug.state.mode), 'done');
    assert.equal(
      await page.$eval('#golf-invite', (el) => (el.classList.contains('hidden') ? '' : el.href)),
      'mailto:aron@americancloud.com?subject=Golf',
    );
    const total = await page.evaluate(() => teeDebug.state.result.total);
    assert.equal(
      await page.evaluate(() => Number(localStorage.getItem('tee-time-best-round'))),
      total,
    );
    await settlePage(page);
    await page.screenshot({ path: artifactPath('tee-time-done-desktop.png') });

    for (const viewport of [
      { width: 390, height: 844 },
      { width: 844, height: 390 },
    ]) {
      await page.setViewport({ ...viewport, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
      await page.goto(url.href, { waitUntil: 'networkidle0' });
      await page.waitForFunction(() => window.teeDebug);
      await page.click('#start');
      await page.evaluate(() => (teeDebug.state.maggieUsed = true));
      const controls = await page.$$eval('[data-control]', (els) =>
        els.map((el) => {
          const r = el.getBoundingClientRect();
          return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, w: r.width, h: r.height };
        }),
      );
      assert.equal(controls.length, 3);
      for (const r of controls)
        assert.ok(
          r.w >= 40 &&
            r.h >= 34 &&
            r.x >= 0 &&
            r.y >= 0 &&
            r.right <= viewport.width &&
            r.bottom <= viewport.height,
          `${viewport.width}×${viewport.height}: touch control fits`,
        );
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
      );
      const center = (selector) =>
        page.$eval(selector, (el) => {
          const r = el.getBoundingClientRect();
          return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
        });
      const angle = await page.evaluate(() => teeDebug.state.aim.angle);
      const rotate = await center('[data-control="right"]');
      const finger = await page.touchscreen.touchStart(rotate.x, rotate.y);
      await step(page, 10);
      await finger.end();
      assert.ok((await page.evaluate(() => teeDebug.state.aim.angle)) > angle, '↻ aims lower');
      const swing = await center('[data-control="action"]');
      const hold = await page.touchscreen.touchStart(swing.x, swing.y);
      await step(page, 20);
      await hold.end();
      await step(page, 1);
      assert.equal(
        await page.evaluate(() => teeDebug.state.phase),
        'swing',
        'the swing button swings',
      );
      await untilAim(page);
      await page.evaluate(() => teeDebug.render());
      await page.screenshot({ path: artifactPath(`tee-time-${viewport.width}.png`) });
      await page.tap('#pause');
      assert.equal(await page.evaluate(() => teeDebug.state.mode), 'paused');
    }
    assert.deepEqual(errors, [], 'No JavaScript errors or failed game assets');
  } finally {
    await closeBrowser(browser);
  }
});

const { test } = require('node:test');
/* Serve the repo, then run with optional PUPPETEER_MODULE, CHROME_BIN and GAME_URL.
   Shift rules and balance are covered by tests/five-nines.test.js; this checks the page. */
const assert = require('node:assert/strict');
const { launchBrowser, closeBrowser, artifactPath, settlePage } = require('./helpers/browser.cjs');
const url = new URL(
  process.env.GAME_URL ||
    new URL('five-nines.html', process.env.SITE_URL || 'http://localhost:8000/').href,
);
url.searchParams.set('debug', '1');
url.searchParams.set('seed', '4');
const step = (page, frames) =>
  page.evaluate((frames) => {
    for (let i = 0; i < frames; i++) ninesDebug.update(1 / 60);
  }, frames);
// Nothing breaks on its own; the test breaks racks itself.
const quiet = (page) =>
  page.evaluate(() =>
    Object.assign(ninesDebug.state, { scripted: [], nextProblem: Infinity, nextTicket: Infinity }),
  );
const breakRack = (page, id, kind, x) =>
  page.evaluate(
    ({ id, kind, x }) => {
      const s = ninesDebug.state;
      s.racks[id].problem = { kind, age: 0, limit: 0, fixed: 0, spread: 0 };
      if (x !== undefined) Object.assign(s.aron, { x, facing: 1, vx: 0 });
      ninesDebug.snapCamera();
    },
    { id, kind, x },
  );

test('five nines smoke', { timeout: 300_000 }, async () => {
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
    await page.waitForFunction(() => window.ninesDebug);
    assert.match(await page.title(), /Five Nines/);
    for (const link of await page.$$eval('a[href]', (els) =>
      els.map((el) => ({ target: el.target, rel: [...el.relList] })),
    )) {
      assert.equal(link.target, '_blank');
      assert.ok(link.rel.includes('noopener') && link.rel.includes('noreferrer'));
    }
    await page.screenshot({ path: artifactPath('five-nines-menu-desktop.png') });

    await page.click('#start');
    assert.equal(await page.evaluate(() => ninesDebug.state.mode), 'playing');
    await quiet(page);
    // Run with the arrow keys.
    const x = await page.evaluate(() => ninesDebug.state.aron.x);
    await page.keyboard.down('ArrowRight');
    await step(page, 30);
    await page.keyboard.up('ArrowRight');
    assert.ok((await page.evaluate(() => ninesDebug.state.aron.x)) > x + 100, '→ runs right');

    // Hold Space in front of a rack to fix it.
    const rackX = await page.evaluate(() => ninesDebug.racks.vms.x);
    await breakRack(page, 'vms', 'cable', rackX - 70);
    await page.evaluate(() => ninesDebug.updateUI());
    assert.equal(await page.$eval('#action', (el) => el.textContent), 'PLUG IN');
    await page.keyboard.down('Space');
    await step(page, 20);
    assert.equal(await page.evaluate(() => ninesDebug.state.aron.fixing), 'plug');
    await page.evaluate(() => ninesDebug.render());
    await page.screenshot({ path: artifactPath('five-nines-fix-desktop.png') });
    await step(page, 30);
    await page.keyboard.up('Space');
    assert.equal(await page.evaluate(() => ninesDebug.state.racks.vms.problem), null);
    await page.evaluate(() => ninesDebug.updateUI());
    assert.notEqual(await page.$eval('#uptime', (el) => el.textContent), '100.000%');

    // A fire, with a ticket about it waiting at the desk.
    await page.evaluate(() => {
      const s = ninesDebug.state;
      s.tickets.push({
        id: 99,
        who: 3,
        about: 'object',
        lines: ['Is Object Storage on', 'fire? Asking for a friend.'],
        age: 4,
        limit: 25,
        fixed: 0,
      });
    });
    await breakRack(
      page,
      'object',
      'fire',
      await page.evaluate(() => ninesDebug.racks.object.x - 120),
    );
    await page.keyboard.down('Space');
    await step(page, 60);
    await page.evaluate(() => ninesDebug.render());
    await page.screenshot({ path: artifactPath('five-nines-fire-desktop.png') });
    await step(page, 100);
    await page.keyboard.up('Space');
    assert.equal(await page.evaluate(() => ninesDebug.state.racks.object.problem), null);
    assert.equal(await page.evaluate(() => ninesDebug.state.tickets.length), 0, 'ticket closed');

    // Answer a ticket at the help desk.
    await page.evaluate(() => {
      const s = ninesDebug.state;
      s.tickets.push({
        id: 100,
        who: 4,
        about: null,
        lines: ['is it down', 'is it down now'],
        age: 0,
        limit: 25,
        fixed: 0,
      });
      s.aron.x = 1130;
      ninesDebug.snapCamera();
      ninesDebug.updateUI();
    });
    assert.equal(await page.$eval('#tickets', (el) => el.textContent), '1');
    assert.equal(await page.$eval('#action', (el) => el.textContent), 'ANSWER');
    await page.keyboard.down('KeyE');
    await step(page, 70);
    await page.keyboard.up('KeyE');
    assert.equal(await page.evaluate(() => ninesDebug.state.tickets.length), 0);

    await page.keyboard.press('KeyP');
    assert.equal(await page.evaluate(() => ninesDebug.state.mode), 'paused');
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => ninesDebug.state.mode), 'playing');

    // Clock out at 6 AM: the result card and the best shift.
    await page.evaluate(() => {
      ninesDebug.state.elapsed = 179.95;
      ninesDebug.update(1 / 10);
    });
    assert.equal(await page.evaluate(() => ninesDebug.state.mode), 'done');
    const result = await page.evaluate(() => ninesDebug.state.result);
    assert.equal(result.reason, 'morning');
    assert.equal(await page.$$eval('#results > div', (els) => els.length), 4);
    assert.equal(
      await page.evaluate(() => Number(localStorage.getItem('five-nines-best-score'))),
      result.score,
    );
    await settlePage(page);
    await page.screenshot({ path: artifactPath('five-nines-done-desktop.png') });

    for (const viewport of [
      { width: 390, height: 844 },
      { width: 844, height: 390 },
    ]) {
      await page.setViewport({ ...viewport, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
      await page.goto(url.href, { waitUntil: 'networkidle0' });
      await page.waitForFunction(() => window.ninesDebug);
      await page.click('#start');
      await quiet(page);
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
      const start = await page.evaluate(() => ninesDebug.state.aron.x);
      const right = await center('[data-control="right"]');
      const finger = await page.touchscreen.touchStart(right.x, right.y);
      await step(page, 20);
      await finger.end();
      assert.ok((await page.evaluate(() => ninesDebug.state.aron.x)) > start + 50, '▶ runs');
      await breakRack(
        page,
        'block',
        'cable',
        await page.evaluate(() => ninesDebug.racks.block.x - 70),
      );
      const fix = await center('[data-control="action"]');
      const hold = await page.touchscreen.touchStart(fix.x, fix.y);
      await step(page, 60);
      await hold.end();
      assert.equal(
        await page.evaluate(() => ninesDebug.state.racks.block.problem),
        null,
        'holding the fix button fixes',
      );
      await page.evaluate(() => ninesDebug.render());
      await page.screenshot({ path: artifactPath(`five-nines-${viewport.width}.png`) });
      await page.tap('#pause');
      assert.equal(await page.evaluate(() => ninesDebug.state.mode), 'paused');
    }
    assert.deepEqual(errors, [], 'No JavaScript errors or failed game assets');
  } finally {
    await closeBrowser(browser);
  }
});

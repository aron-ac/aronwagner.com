const { test } = require('node:test');
/* Serve the repo, then run with optional PUPPETEER_MODULE, CHROME_BIN and GAME_URL.
   Game rules are covered by tests/aisle-dash.test.js; this checks the page, input and layout. */
const assert = require('node:assert/strict');
const { launchBrowser, closeBrowser, artifactPath, settlePage } = require('./helpers/browser.cjs');
const url = new URL(
  process.env.GAME_URL ||
    new URL('aisle-dash.html', process.env.SITE_URL || 'http://localhost:8000/').href,
);
url.searchParams.set('debug', '1');
url.searchParams.set('seed', '7');

// Put Rebecca at a display with a known moment and Aron right beside her.
async function stageMoment(page, moment) {
  await page.evaluate((moment) => {
    const s = aisleDebug.state;
    const spot = s.store.spots[2];
    Object.assign(s.rebecca, { x: spot.x, task: 'browse', moving: false, wait: 0 });
    s.moment = { expires: s.elapsed + 60, duration: 60, icon: 'candle', sale: false, ...moment };
    Object.assign(s.aron, { x: spot.x - 90, vx: 0 });
    s.pacifier.nextToss = Infinity;
    aisleDebug.view.x = s.aron.x - aisleDebug.view.width * 0.3;
  }, moment);
}
const step = (page, frames) =>
  page.evaluate((frames) => {
    for (let i = 0; i < frames; i++) aisleDebug.update(1 / 120);
  }, frames);

test('aisle dash smoke', { timeout: 300_000 }, async () => {
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
    await page.waitForFunction(() => window.aisleDebug);
    assert.match(await page.title(), /Aisle Dash/);
    const links = await page.$$eval('a[href]', (els) =>
      els.map((el) => ({ target: el.target, rel: [...el.relList] })),
    );
    assert.ok(links.length > 0);
    for (const link of links) {
      assert.equal(link.target, '_blank');
      assert.ok(link.rel.includes('noopener') && link.rel.includes('noreferrer'));
    }
    await page.screenshot({ path: artifactPath('aisle-dash-menu-desktop.png') });

    await page.click('#start');
    assert.equal(await page.evaluate(() => aisleDebug.state.mode), 'playing');
    assert.equal(await page.$eval('#budget', (el) => el.textContent), '$250');
    // Real keyboard input walks Aron and drives the HUD.
    await page.evaluate(() => (aisleDebug.state.pacifier.nextToss = Infinity));
    const before = await page.evaluate(() => aisleDebug.state.aron.x);
    await page.keyboard.down('ArrowRight');
    await step(page, 60);
    await page.keyboard.up('ArrowRight');
    const middle = await page.evaluate(() => aisleDebug.state.aron.x);
    await page.keyboard.down('KeyA');
    await step(page, 30);
    await page.keyboard.up('KeyA');
    const after = await page.evaluate(() => aisleDebug.state.aron);
    assert.ok(middle > before + 60, 'Arrow keys walk Aron');
    assert.ok(after.x < middle - 20 && after.facing === -1, 'A walks him back');

    await stageMoment(page, { kind: 'want', name: 'Throw blanket', price: 35, hearts: 2 });
    await step(page, 2);
    await page.evaluate(() => aisleDebug.updateUI());
    await page.keyboard.down('Space');
    await step(page, 2);
    await page.keyboard.up('Space');
    await step(page, 1);
    await page.evaluate(() => aisleDebug.updateUI());
    assert.deepEqual(
      await page.evaluate(() => ({
        money: aisleDebug.state.money,
        bags: aisleDebug.state.bags,
        budget: document.querySelector('#budget').textContent,
        happy: document.querySelector('#happiness').textContent,
      })),
      { money: 215, bags: 1, budget: '$215', happy: '60%' },
      'Space buys what she wants and the HUD follows',
    );
    await stageMoment(page, { kind: 'looking', name: 'Candle', price: 14, hearts: 1 });
    await page.evaluate(() => aisleDebug.render());
    await page.screenshot({ path: artifactPath('aisle-dash-moment-desktop.png') });
    await page.keyboard.down('KeyE');
    await step(page, 2);
    await page.keyboard.up('KeyE');
    await step(page, 1);
    assert.equal(await page.evaluate(() => aisleDebug.state.stats.traps), 1, 'E also buys');

    await page.keyboard.press('KeyP');
    assert.equal(await page.evaluate(() => aisleDebug.state.mode), 'paused');
    assert.equal(await page.$eval('#restart', (el) => el.classList.contains('hidden')), false);
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => aisleDebug.state.mode), 'playing');

    // Finish Target, carry on to the mall, then finish the day.
    const finishStop = () =>
      page.evaluate(() => {
        const s = aisleDebug.state;
        s.moment = null;
        s.rebecca.task = 'waiting';
        Object.assign(s.aron, { x: s.store.exit.x + 20 });
        aisleDebug.update(1 / 120);
      });
    await finishStop();
    assert.equal(await page.evaluate(() => aisleDebug.state.mode), 'between');
    assert.match(await page.$eval('#menu-title', (el) => el.textContent), /International Plaza/);
    await page.click('#start');
    assert.equal(await page.evaluate(() => aisleDebug.state.store.id), 'mall');
    await page.evaluate(() => aisleDebug.render());
    await page.screenshot({ path: artifactPath('aisle-dash-mall-desktop.png') });
    await page.evaluate(() => (aisleDebug.state.happiness = 90));
    await finishStop();
    assert.equal(await page.evaluate(() => aisleDebug.state.mode), 'done');
    assert.equal(await page.$eval('#results', (el) => el.classList.contains('hidden')), false);
    const score = await page.evaluate(() => aisleDebug.state.result.score);
    assert.equal(
      await page.evaluate(() => Number(localStorage.getItem('aisle-dash-best-score'))),
      score,
      'A finished day saves its score',
    );
    await settlePage(page);
    await page.screenshot({ path: artifactPath('aisle-dash-results-desktop.png') });

    for (const viewport of [
      { width: 390, height: 844 },
      { width: 844, height: 390 },
    ]) {
      await page.setViewport({ ...viewport, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
      await page.goto(url.href, { waitUntil: 'networkidle0' });
      await page.waitForFunction(() => window.aisleDebug);
      assert.equal(
        await page.evaluate(() => Number(localStorage.getItem('aisle-dash-best-score'))),
        score,
        'The best day persists across reloads',
      );
      await page.click('#start');
      const layout = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > innerWidth,
        controls: [...document.querySelectorAll('[data-control]')].map((el) => {
          const r = el.getBoundingClientRect();
          return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, w: r.width, h: r.height };
        }),
      }));
      assert.equal(layout.overflow, false, 'No horizontal overflow on mobile');
      assert.equal(layout.controls.length, 3);
      for (const r of layout.controls)
        assert.ok(
          r.w >= 36 &&
            r.h >= 34 &&
            r.x >= 0 &&
            r.y >= 0 &&
            r.right <= viewport.width &&
            r.bottom <= viewport.height,
          `${viewport.width}×${viewport.height}: touch control fits and is large enough`,
        );
      const center = (selector) =>
        page.$eval(selector, (el) => {
          const r = el.getBoundingClientRect();
          return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
        });
      await page.evaluate(() => (aisleDebug.state.pacifier.nextToss = Infinity));
      const start = await page.evaluate(() => aisleDebug.state.aron.x);
      const right = await center('[data-control="right"]');
      const finger = await page.touchscreen.touchStart(right.x, right.y);
      await step(page, 40);
      assert.ok(
        await page.evaluate((x) => aisleDebug.state.aron.x > x + 30, start),
        'The right arrow walks Aron',
      );
      // A second finger buys while the first keeps walking.
      await stageMoment(page, { kind: 'want', name: 'Onesies for Jack', price: 20, hearts: 3 });
      await step(page, 1);
      await page.evaluate(() => aisleDebug.updateUI());
      assert.equal(await page.$eval('#action', (el) => el.textContent.trim()), 'BUY $20');
      const action = await center('#action');
      const second = await page.touchscreen.touchStart(action.x, action.y);
      await step(page, 2);
      await second.end();
      await finger.end();
      await step(page, 2);
      assert.equal(await page.evaluate(() => aisleDebug.state.bags), 1, 'The action button buys');
      assert.equal(await page.$$eval('[data-control].pressed', (els) => els.length), 0);
      await page.evaluate(() => aisleDebug.render());
      await page.screenshot({ path: artifactPath(`aisle-dash-${viewport.width}.png`) });
      await page.tap('#pause');
      assert.equal(await page.evaluate(() => aisleDebug.state.mode), 'paused');
      await page.screenshot({ path: artifactPath(`aisle-dash-menu-${viewport.width}.png`) });
    }
    assert.deepEqual(errors, [], 'No JavaScript errors or failed game assets');
  } finally {
    await closeBrowser(browser);
  }
});

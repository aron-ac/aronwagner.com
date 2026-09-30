const { test } = require('node:test');
/* Responsive layout checks; serve the repo before running directly. */
const assert = require('node:assert/strict');
const { launchBrowser, closeBrowser, artifactPath } = require('./helpers/browser.cjs');
const url = new URL(
  process.env.GAME_URL ||
    new URL('aisle-dash.html', process.env.SITE_URL || 'http://localhost:8000/').href,
);
url.searchParams.set('debug', '1');
url.searchParams.set('seed', '7');
const sizes = [
  [320, 568, true],
  [375, 667, true],
  [390, 844, true],
  [568, 320, true],
  [667, 375, true],
  [844, 390, true],
  [768, 1024, true],
  [1024, 768, true],
  [1280, 720, false],
  [1440, 900, false],
];

test('responsive aisle dash', { timeout: 300_000 }, async () => {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('response', (response) => {
      if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
    });
    for (const [width, height, touch] of sizes) {
      const label = `${width}×${height}`;
      await page.setViewport({
        width,
        height,
        isMobile: touch,
        hasTouch: touch,
        deviceScaleFactor: 1,
      });
      await page.goto(url.href, { waitUntil: 'networkidle0' });
      await page.waitForFunction(() => window.aisleDebug);
      const reachable = async (selector) => {
        const result = await page.$eval(selector, (element) => {
          const r = element.getBoundingClientRect();
          const target = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          return {
            fits:
              r.width > 0 &&
              r.height > 0 &&
              r.left >= 0 &&
              r.top >= 0 &&
              r.right <= innerWidth &&
              r.bottom <= innerHeight,
            receivesInput: element.contains(target),
          };
        });
        assert.ok(result.fits && result.receivesInput, `${label}: ${selector} is reachable`);
      };
      await reachable('#start');
      await page.click('#start');
      await reachable('#pause');
      assert.ok(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth <= innerWidth &&
            document.documentElement.scrollHeight <= innerHeight &&
            scrollY === 0,
        ),
        `${label}: gameplay fits without scrolling`,
      );
      if (touch)
        for (const control of ['left', 'right', 'action'])
          await reachable(`[data-control="${control}"]`);
      // Aron, Rebecca and her thought bubble stay clear of the HUD and controls.
      const covered = await page.evaluate(() => {
        const d = aisleDebug,
          s = d.state,
          view = d.view;
        const spot = s.store.spots[2];
        Object.assign(s.rebecca, { x: spot.x, task: 'browse', moving: false, wait: 0 });
        s.moment = {
          kind: 'want',
          name: 'Throw blanket',
          price: 35,
          hearts: 2,
          icon: 'throw-blanket',
          sale: false,
          expires: s.elapsed + 60,
          duration: 60,
        };
        Object.assign(s.aron, { x: spot.x - 90, vx: 0 });
        s.pacifier.nextToss = Infinity;
        view.x = Math.max(0, s.aron.x - view.width * 0.3);
        d.render();
        const canvas = d.canvas.getBoundingClientRect();
        const toScreen = (x, y) => ({
          x: canvas.left + ((x - view.x) * canvas.width) / view.width,
          y: canvas.top + ((y - view.y) * canvas.height) / view.height,
        });
        const points = {
          'Aron’s face': toScreen(s.aron.x + 20, 566 - 250),
          Jack: toScreen(s.aron.x + 90, 566 - 120),
          'Rebecca’s face': toScreen(s.rebecca.x, 540 - 230),
          'the bubble': toScreen(s.rebecca.x, 540 - 252 - 80),
        };
        const blockers = [
          ...document.querySelectorAll(
            '.game-brand h1, .stats, .day-panel, .touch-controls button, .bottom-bar button',
          ),
        ].filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && getComputedStyle(el).display !== 'none';
        });
        const hidden = [];
        for (const [name, p] of Object.entries(points)) {
          if (p.x < canvas.left || p.x > canvas.right || p.y < canvas.top || p.y > canvas.bottom)
            hidden.push(`${name} off screen`);
          for (const el of blockers) {
            const r = el.getBoundingClientRect();
            if (p.x > r.left && p.x < r.right && p.y > r.top && p.y < r.bottom)
              hidden.push(`${name} under ${el.className || el.id || el.tagName}`);
          }
        }
        return hidden;
      });
      assert.deepEqual(covered, [], `${label}: the scene stays visible`);
      await page.screenshot({ path: artifactPath(`aisle-dash-responsive-${width}x${height}.png`) });
      await page.click('#pause');
      assert.equal(await page.evaluate(() => aisleDebug.state.mode), 'paused');
      await reachable('#start');
      await reachable('#restart');
      await page.click('#restart');
      assert.equal(await page.evaluate(() => aisleDebug.state.mode), 'playing');
      await page.evaluate(() => {
        const s = aisleDebug.state;
        s.moment = null;
        s.rebecca.task = 'waiting';
        s.aron.x = s.store.exit.x + 20;
        aisleDebug.update(1 / 120);
      });
      assert.equal(await page.evaluate(() => aisleDebug.state.mode), 'between');
      await reachable('#start');
    }
    assert.deepEqual(errors, [], 'No browser errors or missing assets');
  } finally {
    await closeBrowser(browser);
  }
});

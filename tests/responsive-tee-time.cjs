const { test } = require('node:test');
/* Responsive layout checks; serve the repo before running directly. */
const assert = require('node:assert/strict');
const { launchBrowser, closeBrowser, artifactPath } = require('./helpers/browser.cjs');
const url = new URL(
  process.env.GAME_URL ||
    new URL('tee-time.html', process.env.SITE_URL || 'http://localhost:8000/').href,
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

test('responsive tee time', { timeout: 300_000 }, async () => {
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
      await page.waitForFunction(() => window.teeDebug);
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
      // Aron, the ball and the power meter stay clear of the HUD and controls.
      const covered = await page.evaluate(() => {
        const d = teeDebug,
          s = d.state,
          view = d.view;
        s.aim.power = 0.5;
        d.snapCamera();
        d.render();
        const canvas = d.canvas.getBoundingClientRect();
        const toScreen = (x, y) => ({
          x: canvas.left + ((x - view.x) * canvas.width) / view.width,
          y: canvas.top + ((y - view.y) * canvas.height) / view.height,
        });
        const points = {
          'the ball': toScreen(s.ball.x, s.ball.y),
          'Aron’s head': toScreen(s.ball.x - 80, s.ball.y - 230),
          'the power meter': toScreen(s.ball.x, s.ball.y - 92),
        };
        const blockers = [
          ...document.querySelectorAll(
            '.game-brand h1, .stats, .day-panel, .touch-controls button, .bottom-bar button',
          ),
        ].filter(
          (el) => el.getBoundingClientRect().width > 0 && getComputedStyle(el).display !== 'none',
        );
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
      await page.screenshot({ path: artifactPath(`tee-time-responsive-${width}x${height}.png`) });
      await page.click('#pause');
      assert.equal(await page.evaluate(() => teeDebug.state.mode), 'paused');
      await reachable('#start');
      await reachable('#restart');
      await page.click('#restart');
      assert.equal(await page.evaluate(() => teeDebug.state.mode), 'playing');
      await page.evaluate(() => {
        const s = teeDebug.state;
        Object.assign(s.ball, { x: s.hole.cup - 40, rolling: true, speed: 150, support: null });
        s.phase = 'flight';
        s.phaseTime = 0;
        for (let i = 0; i < 400 && s.mode === 'playing'; i++) teeDebug.update(1 / 60);
      });
      assert.equal(await page.evaluate(() => teeDebug.state.mode), 'card');
      await reachable('#start');
    }
    assert.deepEqual(errors, [], 'No browser errors or missing assets');
  } finally {
    await closeBrowser(browser);
  }
});

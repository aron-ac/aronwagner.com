const { test } = require('node:test');
/* Responsive layout regression checks; serve the repo before running directly. */
const assert = require('node:assert/strict');
const { launchBrowser, closeBrowser, artifactPath } = require('./helpers/browser.cjs');
const url = new URL(
  process.env.GAME_URL ||
    new URL('maggies-toy-run.html', process.env.SITE_URL || 'http://localhost:8000/').href,
);
url.searchParams.set('debug', '1');
const sizes = [
  [320, 568, true],
  [360, 640, true],
  [375, 667, true],
  [568, 320, true],
  [667, 375, true],
  [667, 600, true],
  [651, 621, true],
  [700, 650, true],
  [768, 1024, true],
  [820, 1180, true],
  [1024, 768, true],
  [1180, 820, true],
  [1024, 600, false],
  [1280, 720, false],
  [1366, 768, false],
];
const safeAreaSizes = [
  [844, 390, true, { top: 0, right: 44, bottom: 21, left: 44 }],
  [390, 844, true, { top: 44, right: 0, bottom: 34, left: 0 }],
  [700, 650, true, { top: 0, right: 0, bottom: 21, left: 0 }],
];

test('responsive maggie', { timeout: 300_000 }, async () => {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('response', (response) => {
      if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
    });
    for (const [width, height, touch, safeArea] of [...sizes, ...safeAreaSizes]) {
      const label = `${width}×${height}${safeArea ? ' with safe areas' : ''}`;
      const insets = safeArea || { top: 0, right: 0, bottom: 0, left: 0 };
      await page.setViewport({
        width,
        height,
        isMobile: touch,
        hasTouch: touch,
        deviceScaleFactor: 1,
      });
      await page.goto(url.href, { waitUntil: 'networkidle0' });
      await page.waitForFunction(() => window.maggieDebug);
      if (safeArea) {
        // Chromium emulation does not supply iOS safe-area environment values.
        await page.addStyleTag({
          content: `:root { ${Object.entries(insets)
            .map(([side, value]) => `--safe-${side}: ${value}px;`)
            .join(' ')} }`,
        });
      }
      const reachable = async (selector) => {
        const result = await page.$eval(
          selector,
          (element, insets) => {
            const r = element.getBoundingClientRect();
            const target = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
            return {
              fits:
                r.width > 0 &&
                r.height > 0 &&
                r.left >= insets.left &&
                r.top >= insets.top &&
                r.right <= innerWidth - insets.right &&
                r.bottom <= innerHeight - insets.bottom,
              receivesInput: element.contains(target),
            };
          },
          insets,
        );
        assert.ok(result.fits && result.receivesInput, `${label}: ${selector} is reachable`);
      };
      await reachable('#start');
      await page.click('#start');
      await reachable('#pause');
      const fit = await page.evaluate((insets) => {
        const shell = document.querySelector('#game-shell').getBoundingClientRect();
        return (
          document.documentElement.scrollWidth <= innerWidth &&
          document.documentElement.scrollHeight <= innerHeight &&
          shell.left >= insets.left &&
          shell.right <= innerWidth - insets.right &&
          shell.top >= insets.top &&
          shell.bottom <= innerHeight - insets.bottom &&
          scrollY === 0
        );
      }, insets);
      assert.ok(fit, `${label}: gameplay fits without scrolling`);
      if (touch) {
        for (const control of ['left', 'right', 'jump']) {
          await reachable(`[data-control="${control}"]`);
        }
        const button = await page.$('[data-control="right"]');
        const r = await button.boundingBox();
        const before = await page.evaluate(() => maggieDebug.state.player.x);
        const finger = await page.touchscreen.touchStart(r.x + r.width / 2, r.y + r.height / 2);
        const after = await page.evaluate(() => {
          for (let i = 0; i < 36; i++) maggieDebug.update(1 / 120);
          return maggieDebug.state.player.x;
        });
        await finger.end();
        assert.ok(after > before + 10, `${label}: touch steering moves Maggie`);
      }
      await page.click('#pause');
      assert.equal(await page.evaluate(() => maggieDebug.state.mode), 'paused');
      await reachable('#start');
      await reachable('#restart');
      await page.click('#restart');
      assert.equal(await page.evaluate(() => maggieDebug.state.mode), 'playing');

      // The tallest optional route exposed HUD collisions that ground-level
      // screenshots missed. Place Maggie on it without changing canvas scaling.
      const visibility = await page.evaluate(() => {
        const d = maggieDebug;
        const p = d.state.player;
        Object.assign(p, { x: 5150, y: 127, vx: 0, vy: 0, onGround: true });
        const view = d.view;
        view.cameraX = p.x - view.width * (view.width < view.height ? 0.2 : 0.28);
        d.render();
        const canvas = d.canvas.getBoundingClientRect();
        const player = {
          left: canvas.left + ((p.x - view.cameraX) * canvas.width) / view.width,
          top: canvas.top + (p.y * canvas.height) / view.height,
          width: (p.w * canvas.width) / view.width,
          height: (p.h * canvas.height) / view.height,
        };
        const blockers = [...document.querySelectorAll('.game-brand, .stats, .trail-progress')]
          .filter((element) => {
            const r = element.getBoundingClientRect();
            return (
              player.left < r.right &&
              player.left + player.width > r.left &&
              player.top < r.bottom &&
              player.top + player.height > r.top
            );
          })
          .map((element) => element.className);
        const landing = d.level.platforms.find(
          (platform) => platform.id === 'platform-treetop-down',
        );
        const landingLeft = canvas.left + ((landing.x - view.cameraX) * canvas.width) / view.width;
        return {
          blockers,
          landingVisible: landingLeft < canvas.right && landingLeft > canvas.left,
        };
      });
      assert.deepEqual(
        visibility.blockers,
        [],
        `${label}: HUD does not cover Maggie on the upper route`,
      );
      assert.ok(visibility.landingVisible, `${label}: the next landing is visible ahead`);
      await page.screenshot({
        path: artifactPath(
          `maggie-responsive-${width}x${height}${safeArea ? '-safe-area' : ''}.png`,
        ),
      });
      await page.evaluate(() => {
        const d = maggieDebug;
        Object.assign(d.state.player, {
          x: d.level.finish.x + 10,
          y: d.level.finish.y + d.level.finish.h - d.state.player.h,
          vx: 0,
          vy: 0,
        });
        d.update(1 / 120);
      });
      assert.equal(await page.evaluate(() => maggieDebug.state.mode), 'won');
      await reachable('#start');
    }
    assert.deepEqual(errors, [], 'No browser errors or missing assets');
    console.log(
      `PASS: Maggie responsive menus, touch controls, upper-route visibility and results at ${sizes.length} phone, tablet and laptop sizes plus portrait and landscape safe areas.`,
    );
  } finally {
    await closeBrowser(browser);
  }
});

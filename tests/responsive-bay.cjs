const { test } = require('node:test');
/* Browser layout regression: compact phones, tablets, and laptop viewports. */
const assert = require('node:assert/strict');
const { launchBrowser, closeBrowser, artifactPath } = require('./helpers/browser.cjs');

const url = new URL(
  process.env.GAME_URL ||
    new URL('bay-racer.html', process.env.SITE_URL || 'http://localhost:8000/').href,
);
url.searchParams.set('debug', '1');
const viewports = [
  [320, 568],
  [360, 640],
  [375, 667],
  [568, 320],
  [667, 375],
  [667, 600],
  [651, 621],
  [700, 650],
  [768, 1024],
  [820, 1180],
  [1024, 768],
  [1180, 820],
  [1024, 600, false],
  [1280, 720, false],
  [1366, 768, false],
  // Simulate browser-provided safe areas on notched phones in both orientations.
  [844, 390, true, { left: 44, right: 44, bottom: 21 }],
  [390, 844, true, { top: 47, bottom: 34 }],
];

async function assertLayout(page, label, selectors, checkOverlaps = false) {
  const layout = await page.evaluate((selectors) => {
    const bodyStyle = getComputedStyle(document.body);
    const insideSafeArea = (r) =>
      r.x >= parseFloat(bodyStyle.paddingLeft) &&
      r.y >= parseFloat(bodyStyle.paddingTop) &&
      r.right <= innerWidth - parseFloat(bodyStyle.paddingRight) &&
      r.bottom <= innerHeight - parseFloat(bodyStyle.paddingBottom);
    const panels = selectors
      .map((selector) => {
        const el = document.querySelector(selector);
        const r = el.getBoundingClientRect();
        return {
          selector,
          x: r.x,
          y: r.y,
          right: r.right,
          bottom: r.bottom,
          width: r.width,
          height: r.height,
        };
      })
      .filter((r) => r.width && r.height);
    const buttons = [...document.querySelectorAll('button')]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width && r.height;
      })
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          label: el.getAttribute('aria-label') || el.textContent.trim(),
          insideSafeArea: insideSafeArea(r),
          reachable: el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)),
        };
      });
    return {
      overflow:
        document.documentElement.scrollWidth > innerWidth ||
        document.documentElement.scrollHeight > innerHeight,
      outside: panels.filter((r) => !insideSafeArea(r)),
      overlapping: panels.flatMap((a, i) =>
        panels
          .slice(i + 1)
          .filter((b) => a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y)
          .map((b) => `${a.selector} / ${b.selector}`),
      ),
      blocked: buttons.filter((b) => !b.reachable || !b.insideSafeArea),
    };
  }, selectors);
  assert.equal(layout.overflow, false, `${label}: game fits without page scrolling`);
  assert.deepEqual(layout.outside, [], `${label}: panels stay inside viewport`);
  assert.deepEqual(layout.blocked, [], `${label}: every visible button is directly reachable`);
  if (checkOverlaps)
    assert.deepEqual(layout.overlapping, [], `${label}: HUD panels do not overlap`);
}

test('responsive bay', { timeout: 300_000 }, async () => {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    for (const [width, height, touch = true, safeArea] of viewports) {
      const label = `${width}×${height} ${touch ? 'touch' : 'mouse'}${safeArea ? ' safe area' : ''}`;
      await page.setViewport({
        width,
        height,
        hasTouch: touch,
        isMobile: touch,
        deviceScaleFactor: 1,
      });
      await page.goto(url.href, { waitUntil: 'networkidle0' });
      await page.waitForFunction(() => window.bayDebug);
      if (safeArea)
        await page.addStyleTag({
          content: `:root { ${Object.entries(safeArea)
            .map(([edge, value]) => `--safe-${edge}: ${value}px;`)
            .join(' ')} }`,
        });
      await assertLayout(page, `${label} menu`, ['.hud', '.menu-card']);
      await page.click('#start');
      await page.evaluate(() => {
        for (let i = 0; i < 186; i++) bayDebug.update(1 / 60);
      });
      await assertLayout(
        page,
        `${label} racing`,
        [
          '.game-brand',
          '.stats',
          '#course-panel',
          '#speedometer',
          '#map-panel',
          '#target',
          '#touch-controls',
          '.bottom-bar',
        ],
        true,
      );
      if (touch) {
        const button = await page.$('[data-control="gas"]');
        const box = await button.boundingBox();
        const client = await page.createCDPSession();
        await client.send('Input.dispatchTouchEvent', {
          type: 'touchStart',
          touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1 }],
        });
        assert.equal(
          await page.$eval('[data-control="gas"]', (el) => el.classList.contains('pressed')),
          true,
          `${label}: throttle accepts touch`,
        );
        await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await client.detach();
      }
      await page.click('#pause');
      assert.equal(await page.evaluate(() => bayDebug.state.mode), 'paused');
      await assertLayout(page, `${label} pause`, ['.menu-card']);
      await page.click('#restart');
      await page.evaluate(() => {
        const d = bayDebug;
        for (let i = 0; i < 186; i++) d.update(1 / 60);
        let attempts = 0;
        while (d.state.mode === 'racing' && attempts++ < d.world.gates.length * 4) {
          const gate = d.world.gates[d.state.nextGate];
          const n = gate.normal;
          Object.assign(d.state, {
            x: gate.x - n.x * 0.12,
            z: gate.z - n.z * 0.12,
            heading: Math.atan2(n.x, n.z),
            speed: 12,
            vx: n.x * 12,
            vz: n.z * 12,
            steer: 0,
          });
          d.update(1 / 30);
        }
      });
      assert.equal(await page.evaluate(() => bayDebug.state.mode), 'finished');
      await assertLayout(page, `${label} results`, ['.menu-card']);
      if (width === 320 || width === 568)
        await page.screenshot({ path: artifactPath(`bay-responsive-results-${width}.png`) });
      console.log(`PASS Bay Racer ${label}: menu, race, pause, restart, and results`);
    }
    assert.deepEqual(errors, [], 'No browser errors throughout responsive layouts');
  } finally {
    await closeBrowser(browser);
  }
});

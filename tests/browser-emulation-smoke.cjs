const { test } = require('node:test');
const assert = require('node:assert/strict');
const { launchBrowser, closeBrowser } = require('./helpers/browser.cjs');

test('browser input capabilities survive desktop, touch, and hybrid transitions', async () => {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    for (const mode of ['desktop', 'touch', 'desktop', 'hybrid', 'touch', 'desktop']) {
      const touch = mode === 'touch';
      await page.setViewport({ width: 1024, height: 768, hasTouch: touch, isMobile: touch });
      const hybridSetup =
        mode === 'hybrid'
          ? await page.evaluateOnNewDocument(() => {
              Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 5 });
            })
          : null;
      await page.goto('about:blank');
      if (hybridSetup) await page.removeScriptToEvaluateOnNewDocument(hybridSetup.identifier);
      // Check real CSS evaluation as well as matchMedia: overriding only the JS
      // API would conceal broken responsive rules in the site and games.
      await page.setContent(`
        <style>
          #probe { --input: unknown; }
          @media (hover: hover) and (pointer: fine) { #probe { --input: mouse; } }
          @media (hover: none) and (pointer: coarse) { #probe { --input: touch; } }
        </style>
        <div id="probe"></div>
      `);
      assert.deepEqual(
        await page.evaluate(() => ({
          hover: matchMedia('(hover: hover)').matches,
          fine: matchMedia('(pointer: fine)').matches,
          coarse: matchMedia('(pointer: coarse)').matches,
          touchPoints: navigator.maxTouchPoints,
          cssInput: getComputedStyle(document.getElementById('probe'))
            .getPropertyValue('--input')
            .trim(),
        })),
        {
          hover: !touch,
          fine: !touch,
          coarse: touch,
          touchPoints: mode === 'hybrid' ? 5 : touch ? 1 : 0,
          cssInput: touch ? 'touch' : 'mouse',
        },
        `${mode}: CSS and JavaScript observe the intended input device`,
      );
    }
  } finally {
    await closeBrowser(browser);
  }
});

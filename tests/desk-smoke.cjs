const { test } = require('node:test');
/* Alternate desk coverage, including its supported direct-file entry point. */
const assert = require('node:assert/strict');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');
const { launchBrowser, closeBrowser } = require('./helpers/browser.cjs');

const site = process.env.SITE_URL || 'http://localhost:8000/';
const localPage = (filename) => pathToFileURL(resolve(__dirname, '..', filename)).href;

function collectErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('response', (response) => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });
  return errors;
}

test('desk smoke', { timeout: 300_000 }, async () => {
  const browser = await launchBrowser();
  try {
    const fixtures = [
      { name: 'desktop-day', width: 1440, night: false, held: true },
      { name: 'desktop-night', width: 1440, night: true, held: true },
      { name: 'mobile', width: 390, night: false },
      { name: 'direct-file-night', width: 390, night: true, file: true },
    ];
    for (const fixture of fixtures) {
      const context = await browser.createBrowserContext();
      try {
        const page = await context.newPage();
        const errors = collectErrors(page);
        await page.setViewport({ width: fixture.width, height: 900 });
        await page.evaluateOnNewDocument((night) => {
          localStorage.clear();
          if (night) localStorage.setItem('mark-site-theme', 'night');
        }, fixture.night);
        const held = [];
        if (fixture.held) {
          await page.setRequestInterception(true);
          page.on('request', (request) => {
            if (new URL(request.url()).pathname.endsWith('/assets/homepage/desk.js'))
              held.push(request);
            else request.continue().catch(() => {});
          });
        }
        let navigationError;
        const url = fixture.file
          ? `${localPage('desk.html')}#nightmode`
          : new URL('desk.html', site).href;
        const navigation = page.goto(url, { waitUntil: 'load' }).catch((error) => {
          navigationError = error;
        });
        if (fixture.held) {
          await page.waitForFunction(
            () =>
              document.querySelector('#bio') &&
              [...document.styleSheets].some((sheet) =>
                sheet.href?.endsWith('/assets/homepage/desk.css'),
              ),
          );
          assert.equal(held.length, 1, `${fixture.name}: runtime is held before initialization`);
          const initial = await page.evaluate(() => ({
            night: document.documentElement.classList.contains('nightmode'),
            background: getComputedStyle(document.body).backgroundColor,
            initialized: document.body.classList.contains('go'),
          }));
          assert.deepEqual(
            initial,
            {
              night: fixture.night,
              background: fixture.night ? 'rgb(28, 42, 98)' : 'rgb(248, 243, 236)',
              initialized: false,
            },
            `${fixture.name}: saved colors apply before external JavaScript loads`,
          );
          for (const request of held) await request.continue();
        }
        await navigation;
        if (navigationError) throw navigationError;
        await page.waitForFunction(() => document.querySelector('#dog').classList.contains('up'));
        assert.ok(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
          `${fixture.name}: layout fits viewport`,
        );
        assert.equal(
          await page.$eval('#laptop', (element) => element.getAttribute('href')),
          'surf-riders.html',
        );
        assert.ok(
          await page.$$eval('[data-link][href]:not([href="#"])', (elements) =>
            elements.every(
              (element) => element.target === '_blank' && element.relList.contains('noopener'),
            ),
          ),
          'Desk navigation remains in a new tab',
        );
        assert.equal(
          await page.$$eval('#mobile .links a', (elements) => elements.length),
          2,
          'Configured mobile links are initialized',
        );
        assert.equal(
          await page.$eval('.label-arrow svg', (element) => element.getAttribute('aria-hidden')),
          'true',
          'Decorative arrows initialize',
        );
        await page.focus('#dog');
        await page.keyboard.press('Enter');
        assert.equal(
          await page.$eval('#dog', (element) => element.classList.contains('excited')),
          true,
          'CiCi responds to keyboard input',
        );
        await page.click('#night');
        await page.waitForFunction(
          (night) => document.documentElement.classList.contains('nightmode') !== night,
          {},
          fixture.night,
        );
        assert.equal(
          await page.evaluate(() => localStorage.getItem('mark-site-theme')),
          fixture.night ? 'day' : 'night',
          'Desk choice persists with its legacy key',
        );
        assert.deepEqual(errors, [], `${fixture.name}: no console, runtime, or asset errors`);
      } finally {
        await context.close();
      }
    }

    console.log(
      'PASS: alternate desk prepaint theme, desktop/mobile layout, keyboard and link controls, extracted assets, and direct-file support for the alternate desk.',
    );
  } finally {
    await closeBrowser(browser);
  }
});

const { test } = require('node:test');
/* Theme first-paint checks. Serve the repo; optional PUPPETEER_MODULE / CHROME_BIN / SITE_URL. */
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { readFile } = require('node:fs/promises');
const { createServer } = require('node:http');
const { extname, resolve, sep } = require('node:path');
const { launchBrowser, closeBrowser, artifactPath } = require('./helpers/browser.cjs');
const site = process.env.SITE_URL || 'http://localhost:8000/';
const override = (night, period) => JSON.stringify({ night, period });
const fixtures = [
  { name: 'winter-day', now: '2026-01-15T11:00:00Z', night: false, delayStyles: true },
  { name: 'winter-night', now: '2026-01-16T00:00:00Z', night: true, delayStyles: true },
  { name: 'summer-day', now: '2026-07-15T10:00:00Z', night: false },
  { name: 'summer-night', now: '2026-07-15T23:00:00Z', night: true },
  {
    name: 'saved-night-during-day',
    now: '2026-01-15T18:00:00Z',
    night: true,
    stored: override(true, '2026-01-15:06'),
  },
  {
    name: 'saved-day-during-night',
    now: '2026-07-16T01:00:00Z',
    night: false,
    stored: override(false, '2026-07-15:19'),
  },
  {
    name: 'expired-override',
    now: '2026-01-15T18:00:00Z',
    night: false,
    stored: override(true, '2026-01-14:19'),
  },
  { name: 'malformed-json', now: '2026-01-16T02:00:00Z', night: true, stored: '{invalid' },
  {
    name: 'malformed-value',
    now: '2026-01-15T18:00:00Z',
    night: false,
    stored: JSON.stringify({ night: 'true', period: '2026-01-15:06' }),
  },
  { name: 'blocked-storage', now: '2026-01-16T02:00:00Z', night: true, blocked: true },
  { name: 'delayed-night-art', now: '2026-01-16T02:00:00Z', night: true, delayNight: true },
];

function assertFrames(samples, fixture, label) {
  assert.ok(samples.length >= 4, `${label}: observed painted frames`);
  const background = fixture.night ? 'rgb(28, 42, 98)' : 'rgb(248, 243, 236)';
  const scheme = fixture.night ? 'dark' : 'light';
  for (const sample of samples) {
    const frame = `${label}, ${sample.phase}, ${sample.time.toFixed(1)}ms`;
    assert.equal(sample.night, fixture.night, `${frame}: correct root theme`);
    assert.equal(
      sample.background,
      background,
      `${frame}: page background has no opposite-theme or blended frame`,
    );
    assert.equal(
      sample.rootBackground,
      background,
      `${frame}: browser canvas has the same background`,
    );
    assert.equal(
      sample.colorScheme,
      scheme,
      `${frame}: native controls use the correct color scheme`,
    );
    assert.equal(sample.rootColorScheme, scheme, `${frame}: root color scheme is correct`);
    if (sample.dayOpacity !== null && sample.nightOpacity !== null) {
      assert.equal(
        sample.dayOpacity,
        fixture.night ? 0 : 1,
        `${frame}: day scene is fully shown or hidden`,
      );
      assert.equal(
        sample.nightOpacity,
        fixture.night ? 1 : 0,
        `${frame}: night scene is fully shown or hidden`,
      );
    }
    assert.deepEqual(sample.wrongLayers, [], `${frame}: no opposite-theme scene layer is visible`);
  }
}

async function checkThemeLoads(site, fixtures) {
  const browser = await launchBrowser();
  let navigations = 0,
    frames = 0;
  try {
    for (const fixture of fixtures) {
      const context = await browser.createBrowserContext();
      const page = await context.newPage();
      const errors = [],
        pendingScripts = [],
        pendingImages = [],
        pendingStyles = [];
      let holdScript = true,
        holdNight = !!fixture.delayNight,
        holdStyles = !!fixture.delayStyles;
      const release = async (requests) => {
        for (const request of requests.splice(0))
          if (!request.isInterceptResolutionHandled()) await request.continue();
      };
      try {
        page.on('pageerror', (error) => errors.push(error.message));
        page.on('response', (response) => {
          if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
        });
        await page.setViewport({ width: 1440, height: 1100 });
        await page.setCacheEnabled(true);
        const client = await page.createCDPSession();
        await client.send('Network.clearBrowserCache');
        await client.detach();
        await page.setRequestInterception(true);
        page.on('request', (request) => {
          const pathname = new URL(request.url()).pathname;
          if (holdScript && pathname.endsWith('/script.js')) pendingScripts.push(request);
          else if (holdStyles && pathname.endsWith('/styles.css')) pendingStyles.push(request);
          else if (holdNight && /office-night(?:-small)?\.webp$/.test(pathname))
            pendingImages.push(request);
          else request.continue().catch(() => {});
        });
        await page.evaluateOnNewDocument((fixture) => {
          const NativeDate = Date,
            now = NativeDate.parse(fixture.now);
          window.Date = class extends NativeDate {
            constructor(...args) {
              super(...(args.length ? args : [now]));
            }
            static now() {
              return now;
            }
          };
          if (!sessionStorage.getItem('theme-load-seeded')) {
            localStorage.clear();
            if (fixture.stored !== undefined)
              localStorage.setItem('site-theme-override', fixture.stored);
            sessionStorage.setItem('theme-load-seeded', '1');
          }
          if (fixture.blocked)
            Object.defineProperty(window, 'localStorage', {
              configurable: true,
              get() {
                throw new DOMException('Storage blocked for this test', 'SecurityError');
              },
            });
          const probe = (window.themeLoadProbe = {
            samples: [],
            paints: [],
            phase: 'script-held',
            running: true,
          });
          new PerformanceObserver((list) =>
            probe.paints.push(
              ...list.getEntries().map((entry) => ({ name: entry.name, time: entry.startTime })),
            ),
          ).observe({ type: 'paint', buffered: true });
          const visible = (element) => {
            for (let current = element; current; current = current.parentElement) {
              const style = getComputedStyle(current);
              if (
                style.display === 'none' ||
                style.visibility === 'hidden' ||
                Number(style.opacity) === 0
              )
                return false;
            }
            return true;
          };
          const sample = () => {
            // The external stylesheet blocks painting. Begin sampling as soon as
            // it has parsed, rather than waiting for DOMContentLoaded or script.js.
            const styled = [...document.styleSheets].some(
              (sheet) => sheet.href && new URL(sheet.href).pathname.endsWith('/styles.css'),
            );
            if (styled && document.body) {
              const root = document.documentElement,
                body = getComputedStyle(document.body),
                rootStyle = getComputedStyle(root);
              const day = document.querySelector('.scene-day'),
                night = document.querySelector('.scene-night');
              const wrongSelector = fixture.night ? '.scene-day' : '.scene-night';
              probe.samples.push({
                time: performance.now(),
                phase: probe.phase,
                night: root.classList.contains('night'),
                background: body.backgroundColor,
                rootBackground: rootStyle.backgroundColor,
                colorScheme: body.colorScheme,
                rootColorScheme: rootStyle.colorScheme,
                dayOpacity: day ? Number(getComputedStyle(day).opacity) : null,
                nightOpacity: night ? Number(getComputedStyle(night).opacity) : null,
                wrongLayers: [...document.querySelectorAll(wrongSelector)]
                  .filter(visible)
                  .map((el) => el.getAttribute('class')),
              });
            }
            if (probe.running) requestAnimationFrame(sample);
          };
          requestAnimationFrame(sample);
        }, fixture);
        for (const cache of ['cold', 'warm']) {
          holdScript = true;
          holdNight = !!fixture.delayNight && cache === 'cold';
          holdStyles = !!fixture.delayStyles;
          const label = `${fixture.name}/${cache}`;
          const previousOrigin = await page.evaluate(() => performance.timeOrigin);
          let navigationError;
          const navigation = (
            cache === 'cold'
              ? page.goto(site, { waitUntil: 'load' })
              : page.reload({ waitUntil: 'load' })
          ).catch((error) => {
            navigationError = error;
          });
          if (holdStyles) {
            await page.waitForFunction(
              (origin) =>
                performance.timeOrigin !== origin && document.querySelector('.scene-night'),
              { polling: 'mutation' },
              previousOrigin,
            );
            assert.equal(
              pendingStyles.length,
              1,
              `${label}: external CSS is held before it can style the page`,
            );
            const critical = await page.evaluate(() => ({
              night: document.documentElement.classList.contains('night'),
              background: getComputedStyle(document.documentElement).backgroundColor,
              scheme: getComputedStyle(document.documentElement).colorScheme,
              meta: document.querySelector('meta[name="theme-color"]').content,
            }));
            assert.deepEqual(
              critical,
              {
                night: fixture.night,
                background: fixture.night ? 'rgb(28, 42, 98)' : 'rgb(248, 243, 236)',
                scheme: fixture.night ? 'dark' : 'light',
                meta: fixture.night ? '#1c2a62' : '#f8f3ec',
              },
              `${label}: inline theme colors are ready before the stylesheet loads`,
            );
            holdStyles = false;
            await release(pendingStyles);
          }
          await page.waitForFunction(
            (origin) =>
              performance.timeOrigin !== origin &&
              window.themeLoadProbe?.samples.length >= 4 &&
              document.querySelector('.scene-night') &&
              themeLoadProbe.paints.some((paint) => paint.name === 'first-contentful-paint'),
            {},
            previousOrigin,
          );
          assert.equal(
            pendingScripts.length,
            1,
            `${label}: deferred application code is still intercepted at first paint`,
          );
          const samples = await page.evaluate(() => themeLoadProbe.samples);
          assertFrames(samples, fixture, label);
          if (holdNight) {
            assert.ok(pendingImages.length > 0, 'Night artwork is intentionally still loading');
            assert.equal(
              await page.$eval('.scene-night', (el) => el.complete && el.naturalWidth > 0),
              false,
              'Night scene has not loaded during the first-paint check',
            );
            await page.screenshot({ path: artifactPath('homepage-theme-night-art-held.png') });
          }
          await page.evaluate(() => {
            themeLoadProbe.phase = 'script-released';
          });
          holdScript = false;
          await release(pendingScripts);
          await page.waitForFunction(() => !document.querySelector('.theme-toggle').hidden);
          const releasedCount = await page.evaluate(() => themeLoadProbe.samples.length);
          await page.waitForFunction(
            (count) => themeLoadProbe.samples.length >= count + 6,
            {},
            releasedCount,
          );
          assertFrames(await page.evaluate(() => themeLoadProbe.samples), fixture, label);
          holdNight = false;
          await release(pendingImages);
          await navigation;
          if (navigationError) throw navigationError;
          await page.waitForFunction(
            (night) => {
              const image = document.querySelector(night ? '.scene-night' : '.scene-day');
              return image.complete && image.naturalWidth > 0;
            },
            {},
            fixture.night,
          );
          await page.evaluate(() => {
            themeLoadProbe.phase = 'fully-loaded';
          });
          const loadedCount = await page.evaluate(() => themeLoadProbe.samples.length);
          await page.waitForFunction(
            (count) => themeLoadProbe.samples.length >= count + 8,
            {},
            loadedCount,
          );
          const result = await page.evaluate(() => {
            themeLoadProbe.running = false;
            return themeLoadProbe;
          });
          assertFrames(result.samples, fixture, label);
          frames += result.samples.length;
          navigations++;
          if (fixture.delayNight && cache === 'cold')
            await page.screenshot({ path: artifactPath('homepage-theme-night-art-loaded.png') });
        }
        if (fixture.blocked) {
          await page.click('.theme-toggle');
          assert.equal(
            await page.evaluate(() => document.documentElement.classList.contains('night')),
            false,
            'Manual toggling still works when localStorage throws',
          );
        }
        assert.deepEqual(errors, [], `${fixture.name}: no JavaScript errors or failed assets`);
      } finally {
        holdScript = false;
        holdNight = false;
        holdStyles = false;
        await release(pendingScripts).catch(() => {});
        await release(pendingImages).catch(() => {});
        await release(pendingStyles).catch(() => {});
        await context.close();
      }
    }
    console.log(
      `PASS: ${navigations} cold/warm navigations and ${frames} rendered-frame samples across ${fixtures.length} theme fixtures without an opposite-theme flash.`,
    );
  } finally {
    await closeBrowser(browser);
  }
}

test('homepage theme load', { timeout: 300_000 }, () => checkThemeLoads(site, fixtures));

test(
  'raw static homepage resolves the theme before first paint',
  { timeout: 120_000 },
  async (t) => {
    // Deliberately serve bytes without the production build or development HTML
    // transform, just as a generic static server does.
    const root = resolve(__dirname, '..');
    const mimeTypes = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'text/javascript',
      '.json': 'application/json',
      '.jpg': 'image/jpeg',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.ico': 'image/x-icon',
      '.ttf': 'font/ttf',
      '.woff2': 'font/woff2',
    };
    const server = createServer(async (request, response) => {
      try {
        const pathname = new URL(request.url, 'http://localhost').pathname;
        const filename = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
        if (!filename.startsWith(`${root}${sep}`)) {
          response.writeHead(403).end();
          return;
        }
        const bytes = await readFile(filename);
        response.writeHead(200, {
          'Content-Type': mimeTypes[extname(filename)] || 'application/octet-stream',
          'Content-Length': bytes.length,
        });
        response.end(bytes);
      } catch {
        response.writeHead(404).end();
      }
    });
    t.after(async () => {
      server.closeAllConnections();
      await new Promise((done) => server.close(done));
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    await checkThemeLoads(
      `http://127.0.0.1:${server.address().port}/`,
      fixtures.filter((fixture) =>
        ['winter-day', 'winter-night', 'saved-night-during-day'].includes(fixture.name),
      ),
    );
  },
);

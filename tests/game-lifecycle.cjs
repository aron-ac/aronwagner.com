const { test } = require('node:test');
/* Optional SITE_URL, PUPPETEER_MODULE and CHROME_BIN. No game-specific test hooks added. */
const assert = require('node:assert/strict');
const { setTimeout: delay } = require('node:timers/promises');
const { launchBrowser, closeBrowser, loadGame } = require('./helpers/browser.cjs');

const baseURL = process.env.SITE_URL || 'http://localhost:8000/';
const games = [
  {
    page: 'maggies-toy-run.html',
    debug: 'maggieDebug',
    active: ['playing'],
    touch: 'right',
  },
  {
    page: 'aisle-dash.html',
    debug: 'aisleDebug',
    active: ['playing'],
    touch: 'right',
  },
  {
    page: 'tee-time.html',
    debug: 'teeDebug',
    active: ['playing'],
    touch: 'right',
  },
];

async function assertKeyboardNavigation(browser, page, game, selector, mode) {
  const targets = new Set(browser.targets());
  const destination = await page.$eval(selector, (link) => link.href);
  await page.focus(selector);
  const opened = browser.waitForTarget(
    (target) => !targets.has(target) && target.type() === 'page' && target.url() === destination,
  );
  await page.keyboard.press('Enter');
  const popup = await (await opened).page();
  try {
    assert.equal(page.url(), new URL(`${game.page}?debug=1`, baseURL).href);
    assert.equal(
      await page.evaluate((name) => window[name].state.mode, game.debug),
      mode,
      `${game.page}: Enter on ${selector} opens the link without starting or resuming gameplay`,
    );
  } finally {
    await popup.close();
    await page.bringToFront();
  }
}

async function checkGame(browser, game) {
  const page = await browser.newPage();
  const url = new URL(game.page, baseURL);
  url.searchParams.set('debug', '1');
  const errors = [];
  const expectedErrors = [];
  let blockingDependency = false;
  let blockedRequests = 0;

  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    (blockingDependency ? expectedErrors : errors).push(message.text());
  });
  page.on('response', (response) => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });
  page.on('requestfailed', (request) => {
    if (!blockingDependency) errors.push(`${request.failure()?.errorText} ${request.url()}`);
  });

  try {
    await page.setViewport({ width: 1000, height: 800, hasTouch: true });
    await page.setCacheEnabled(false);
    await page.evaluateOnNewDocument(() => {
      const request = window.requestAnimationFrame.bind(window);
      const cancel = window.cancelAnimationFrame.bind(window);
      const pending = new Set();
      const frames = {
        pending,
        callbacks: 0,
        renders: 0,
        timestamp: -1,
        callbacksAtTimestamp: 0,
        maxCallbacksPerFrame: 0,
      };
      window.__gameFrames = frames;
      window.requestAnimationFrame = (callback) => {
        const id = request((timestamp) => {
          pending.delete(id);
          frames.callbacks++;
          frames.callbacksAtTimestamp =
            frames.timestamp === timestamp ? frames.callbacksAtTimestamp + 1 : 1;
          frames.timestamp = timestamp;
          frames.maxCallbacksPerFrame = Math.max(
            frames.maxCallbacksPerFrame,
            frames.callbacksAtTimestamp,
          );
          callback(timestamp);
        });
        pending.add(id);
        return id;
      };
      window.cancelAnimationFrame = (id) => {
        pending.delete(id);
        cancel(id);
      };
    });

    // loadGame uses timer polling, so readiness never contributes RAF callbacks.
    await loadGame(page, url.href, game.debug);
    await assertKeyboardNavigation(browser, page, game, '.topbar a', 'menu');
    await page.focus('#sound');
    await page.keyboard.press('Enter');
    assert.equal(
      await page.$eval('#sound', (button) => button.getAttribute('aria-pressed')),
      'true',
    );
    assert.equal(await page.evaluate((name) => window[name].state.mode, game.debug), 'menu');
    await page.keyboard.press('Enter');
    assert.deepEqual(
      await page.$$eval('[data-control]', (buttons) =>
        buttons
          .filter(
            (button) =>
              button.getAttribute('type') !== 'button' || !button.getAttribute('aria-label'),
          )
          .map((button) => button.outerHTML),
      ),
      [],
      `${game.page}: every touch control is an explicitly typed, named button`,
    );
    assert.equal(
      await page.$eval('#touch-controls', (element) => element.getAttribute('role')),
      'group',
    );
    await page.evaluate(({ debug }) => {
      // Each frame starts by clearing the canvas, so clears count renders.
      const context = window[debug].canvas.getContext('2d');
      const clear = context.clearRect.bind(context);
      context.clearRect = (...args) => {
        window.__gameFrames.renders++;
        return clear(...args);
      };
    }, game);
    await page.focus('#start');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__gameFrames.renders >= 2, { polling: 50 });
    assert.ok(
      game.active.includes(await page.evaluate((name) => window[name].state.mode, game.debug)),
      `${game.page}: starting enters active gameplay`,
    );

    const client = await page.createCDPSession();
    const point = await page.$eval(`[data-control="${game.touch}"]`, (button) => {
      const rect = button.getBoundingClientRect();
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    });
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ ...point, id: 1 }],
    });
    await page.keyboard.down('ArrowRight');
    assert.equal(
      await page.evaluate((name) => window[name].keys.has('ArrowRight'), game.debug),
      true,
    );
    assert.equal(await page.$$eval('[data-control].pressed', (buttons) => buttons.length), 1);

    const hidden = await page.evaluate((name) => {
      const previousMode = window[name].state.mode;
      window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
      return {
        mode: window[name].state.mode,
        previousMode,
        elapsed: window[name].state.elapsed,
        keys: window[name].keys.size,
        pressed: document.querySelectorAll('[data-control].pressed').length,
        pending: window.__gameFrames.pending.size,
        renders: window.__gameFrames.renders,
        callbacks: window.__gameFrames.callbacks,
      };
    }, game.debug);
    assert.equal(hidden.mode, 'paused', `${game.page}: persisted pagehide pauses active play`);
    assert.equal(hidden.keys, 0, `${game.page}: held keyboard input is cleared`);
    assert.equal(hidden.pressed, 0, `${game.page}: held touch input is cleared`);
    assert.equal(hidden.pending, 0, `${game.page}: pagehide cancels the scheduled frame`);
    // This bounded observation period is intentional: no frames may run while suspended.
    await delay(200);
    const stopped = await page.evaluate(
      (name) => ({
        elapsed: window[name].state.elapsed,
        renders: window.__gameFrames.renders,
        callbacks: window.__gameFrames.callbacks,
        pending: window.__gameFrames.pending.size,
      }),
      game.debug,
    );
    assert.deepEqual(
      stopped,
      {
        elapsed: hidden.elapsed,
        renders: hidden.renders,
        callbacks: hidden.callbacks,
        pending: 0,
      },
      `${game.page}: neither simulation nor drawing continues while hidden`,
    );

    await page.keyboard.up('ArrowRight');
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await client.detach();
    const restored = await page.evaluate((name) => {
      // Repeated restore notifications must be idempotent, including before the first frame.
      for (let i = 0; i < 8; i++) {
        window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
      }
      return { mode: window[name].state.mode, pending: window.__gameFrames.pending.size };
    }, game.debug);
    assert.equal(restored.mode, 'paused', `${game.page}: restoring does not resume gameplay`);
    assert.equal(
      restored.pending,
      1,
      `${game.page}: repeated pageshow starts only one frame chain`,
    );
    await page.waitForFunction(
      (renders) => window.__gameFrames.renders >= renders + 3,
      { polling: 50 },
      hidden.renders,
    );
    const rendering = await page.evaluate(
      (name) => ({
        mode: window[name].state.mode,
        elapsed: window[name].state.elapsed,
        pending: window.__gameFrames.pending.size,
        maximum: window.__gameFrames.maxCallbacksPerFrame,
      }),
      game.debug,
    );
    assert.deepEqual(
      rendering,
      {
        mode: 'paused',
        elapsed: hidden.elapsed,
        pending: 1,
        maximum: 1,
      },
      `${game.page}: rendering resumes once per frame while the simulation stays paused`,
    );
    await assertKeyboardNavigation(browser, page, game, 'footer a', 'paused');
    await page.evaluate(() => document.getElementById('start').click());
    assert.equal(
      await page.evaluate((name) => window[name].state.mode, game.debug),
      hidden.previousMode,
      `${game.page}: user resume restores the paused mode`,
    );
    assert.deepEqual(errors, [], `${game.page}: normal lifecycle reports no browser errors`);

    // Abort a real transitive module import, not the entrypoint or the error reporter itself.
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      if (
        blockingDependency &&
        new URL(request.url()).pathname.endsWith('/assets/shared/audio.js')
      ) {
        blockedRequests++;
        void request.abort('failed');
      } else void request.continue();
    });
    blockingDependency = true;
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(
      () => /could not load.*refresh/i.test(document.getElementById('load-state').textContent),
      { polling: 50 },
    );
    assert.ok(blockedRequests > 0, `${game.page}: dependency failure was actually injected`);
    const failed = await page.evaluate((name) => {
      const status = document.getElementById('load-state');
      const style = getComputedStyle(status);
      return {
        initialized: Boolean(window[name]),
        visible:
          !status.classList.contains('hidden') &&
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          Number(style.opacity) > 0,
      };
    }, game.debug);
    assert.equal(
      failed.initialized,
      false,
      `${game.page}: failed dependencies cannot partially launch the game`,
    );
    assert.equal(failed.visible, true, `${game.page}: loader failure is visible`);
    assert.ok(
      expectedErrors.some((message) => message.includes('Unable to initialize game')),
      `${game.page}: loader reports its caught failure`,
    );

    blockingDependency = false;
    await loadGame(page, url.href, game.debug, { reload: true });
    assert.equal(
      await page.$eval('#load-state', (status) => status.classList.contains('hidden')),
      true,
    );
    await page.evaluate(() => document.getElementById('start').click());
    assert.ok(
      game.active.includes(await page.evaluate((name) => window[name].state.mode, game.debug)),
      `${game.page}: starting enters active gameplay`,
    );
    assert.deepEqual(errors, [], `${game.page}: normal reload recovers without browser errors`);
    console.log(
      `PASS: ${game.page} lifecycle, render loop, input cleanup, keyboard navigation, loader recovery, accessible controls and optional render targets.`,
    );
  } finally {
    await page.close();
  }
}

test('game lifecycle', { timeout: 300_000 }, async () => {
  const browser = await launchBrowser();
  try {
    for (const game of games) await checkGame(browser, game);
  } finally {
    await closeBrowser(browser);
  }
});

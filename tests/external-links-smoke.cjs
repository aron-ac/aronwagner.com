const { test } = require('node:test');
const assert = require('node:assert/strict');
const { launchBrowser, closeBrowser, settlePage } = require('./helpers/browser.cjs');
const { screenLinks } = require('./helpers/identity.cjs');

const site = process.env.SITE_URL || 'http://localhost:8000/';
const dialogSelector = '#external-link-dialog';
const destinations = ['.left-screen', '.laptop', '.right-screen'].map((selector, index) => ({
  selector,
  name: screenLinks[index][1],
  url: screenLinks[index][0],
}));

// Attach before a popup's first request: regular page interception starts too
// late for new tabs. The browser still follows each real external anchor URL.
async function mockDestinations(browser, errors, navigations) {
  const interceptor = await browser.target().createCDPSession();
  interceptor.on('sessionattached', (session) => {
    session.on('Fetch.requestPaused', ({ requestId, request, resourceType }) => {
      if (resourceType === 'Document') navigations.push(request.url);
      void session
        .send('Fetch.fulfillRequest', {
          requestId,
          responseCode: 200,
          responseHeaders: [{ name: 'Content-Type', value: 'text/html; charset=utf-8' }],
          body: Buffer.from(
            '<!doctype html><title>External fixture</title><p id="external-fixture">Local external destination fixture</p>',
          ).toString('base64'),
        })
        .catch((error) => errors.push(error.message));
    });
    void (async () => {
      await session.send('Fetch.enable', {
        patterns: destinations.map(({ url }) => ({ urlPattern: `${new URL(url).origin}/*` })),
      });
      await session.send('Runtime.runIfWaitingForDebugger');
    })().catch((error) => errors.push(error.message));
  });
  await interceptor.send('Target.setAutoAttach', {
    autoAttach: true,
    waitForDebuggerOnStart: true,
    flatten: true,
    filter: [{ type: 'page', exclude: false }],
  });
  return interceptor;
}

async function assertDialog(page, destination, label) {
  const actual = await page.$eval(dialogSelector, (dialog) => {
    const rect = (element) => {
      const bounds = element.getBoundingClientRect();
      return {
        inside:
          bounds.left >= 0 &&
          bounds.top >= 0 &&
          bounds.right <= innerWidth &&
          bounds.bottom <= innerHeight,
        width: bounds.width,
        height: bounds.height,
        reachable: element.contains(
          document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2),
        ),
      };
    };
    const proceed = dialog.querySelector('.external-link-continue');
    const cancel = dialog.querySelector('.external-link-cancel');
    return {
      modal: dialog instanceof HTMLDialogElement && dialog.matches(':modal'),
      labelledBy: dialog.getAttribute('aria-labelledby'),
      title: dialog.querySelector('#external-link-title').textContent.trim(),
      url: dialog.querySelector('.external-link-url').textContent.trim(),
      focusedCancel: cancel === document.activeElement,
      newTabCopy: /new tab/i.test(dialog.textContent),
      href: proceed.href,
      target: proceed.target,
      rel: [...proceed.relList].sort(),
      anchor: proceed instanceof HTMLAnchorElement,
      dialog: rect(dialog),
      cancel: rect(cancel),
      proceed: rect(proceed),
      noOverflow:
        dialog.scrollWidth <= dialog.clientWidth &&
        document.documentElement.scrollWidth <= innerWidth,
    };
  });
  assert.equal(actual.modal, true, `${label}: confirmation is a native modal dialog`);
  assert.equal(actual.labelledBy, 'external-link-title', `${label}: dialog has its visible title`);
  assert.equal(actual.title, `Open ${destination.name}?`, `${label}: title identifies destination`);
  assert.equal(actual.url, destination.url, `${label}: actual destination is visible`);
  assert.equal(actual.focusedCancel, true, `${label}: opening focuses cancellation`);
  assert.equal(actual.newTabCopy, true, `${label}: copy explains opening a new tab`);
  assert.equal(actual.anchor, true, `${label}: confirmation is a real navigation link`);
  assert.equal(actual.href, destination.url, `${label}: confirmation uses the selected URL`);
  assert.equal(actual.target, '_blank', `${label}: confirmation opens a new tab`);
  assert.deepEqual(actual.rel, ['noopener', 'noreferrer'], `${label}: new tab is isolated`);
  assert.equal(actual.noOverflow, true, `${label}: dialog and page do not overflow horizontally`);
  for (const control of ['dialog', 'cancel', 'proceed']) {
    assert.equal(actual[control].inside, true, `${label}: ${control} fits within the viewport`);
  }
  for (const control of ['cancel', 'proceed']) {
    assert.equal(actual[control].reachable, true, `${label}: ${control} can receive input`);
    assert.ok(
      actual[control].width >= 44 && actual[control].height >= 44,
      `${label}: ${control} has a 44px target`,
    );
  }
}

async function activateSceneLink(page, selector, hasTouch, keyboard = false) {
  await page.$eval(selector, (link) => link.scrollIntoView({ block: 'center' }));
  if (keyboard) {
    await page.focus(selector);
    await page.keyboard.press('Enter');
  } else if (hasTouch) {
    const point = await page.$eval(`${selector} .hotspot-pin`, (pin) => {
      const bounds = pin.getBoundingClientRect();
      const x = bounds.left + bounds.width / 2;
      const y = bounds.top + bounds.height / 2;
      return { x, y, reachable: pin.closest('a').contains(document.elementFromPoint(x, y)) };
    });
    assert.equal(point.reachable, true, `${selector}: the touch pin belongs to its link`);
    await page.touchscreen.tap(point.x, point.y);
  } else {
    await page.click(selector);
  }
  await page.waitForFunction(() => document.querySelector('#external-link-dialog').open);
  await settlePage(page);
}

test('external scene links require confirmation', { timeout: 180_000 }, async () => {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    const errors = [];
    const navigations = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    const interceptor = await mockDestinations(browser, errors, navigations);
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    const originalTargets = new Set(await browser.pages());
    const viewportFixtures = [
      { width: 1440, height: 900, hasTouch: false },
      { width: 320, height: 568, hasTouch: true },
      { width: 568, height: 320, hasTouch: true },
    ];

    for (const viewport of viewportFixtures) {
      await page.setViewport({ ...viewport, isMobile: viewport.hasTouch });
      await page.goto(site, { waitUntil: 'networkidle0' });
      const originalUrl = page.url();
      assert.deepEqual(
        await page.$$eval('[data-confirm-external]', (links) =>
          links.map((link) => ({
            name: link.dataset.destination,
            href: link.href,
            target: link.target,
            rel: [...link.relList].sort(),
            dialog: link.getAttribute('aria-controls'),
            popup: link.getAttribute('aria-haspopup'),
          })),
        ),
        destinations.map(({ name, url }) => ({
          name,
          href: url,
          target: '_blank',
          rel: ['noopener', 'noreferrer'],
          dialog: 'external-link-dialog',
          popup: 'dialog',
        })),
        'Only the three scene links require confirmation and preserve usable fallback URLs',
      );

      for (const night of [false, true]) {
        if (
          (await page.evaluate(() => document.documentElement.classList.contains('night'))) !==
          night
        ) {
          await page.click('.theme-toggle');
        }
        for (const [index, destination] of destinations.entries()) {
          const label = `${viewport.width}×${viewport.height} ${night ? 'night' : 'day'} ${destination.name}`;
          const previousNavigations = navigations.length;
          await activateSceneLink(page, destination.selector, viewport.hasTouch);
          await assertDialog(page, destination, label);
          assert.equal(
            navigations.length,
            previousNavigations,
            `${label}: opening does not navigate`,
          );
          assert.deepEqual(
            new Set(await browser.pages()),
            originalTargets,
            `${label}: opening does not create a tab`,
          );

          // All dismissal paths must return focus to the exact scene link.
          if (index === 0) {
            if (viewport.hasTouch) await page.tap('.external-link-cancel');
            else await page.click('.external-link-cancel');
          } else if (index === 1) {
            await page.keyboard.press('Escape');
          } else if (viewport.hasTouch) {
            await page.touchscreen.tap(1, 1);
          } else {
            await page.mouse.click(1, 1);
          }
          await page.waitForFunction(() => !document.querySelector('#external-link-dialog').open);
          assert.equal(
            await page.$eval(destination.selector, (link) => document.activeElement === link),
            true,
            `${label}: dismissal restores focus to its scene link`,
          );
          assert.equal(
            navigations.length,
            previousNavigations,
            `${label}: dismissal does not navigate`,
          );

          await activateSceneLink(
            page,
            destination.selector,
            viewport.hasTouch,
            !viewport.hasTouch,
          );
          await assertDialog(page, destination, label);
          const popupTarget = browser.waitForTarget(
            (target) => target.type() === 'page' && target.url() === destination.url,
          );
          if (viewport.hasTouch) await page.tap('.external-link-continue');
          else {
            await page.focus('.external-link-continue');
            await page.keyboard.press('Enter');
          }
          const popup = await (await popupTarget).page();
          await popup.waitForSelector('#external-fixture');
          assert.deepEqual(
            await popup.evaluate(() => ({
              url: location.href,
              isolated: window.opener === null,
              referrer: document.referrer,
            })),
            { url: destination.url, isolated: true, referrer: '' },
            `${label}: confirmation opens the correct isolated tab without a referrer`,
          );
          assert.deepEqual(navigations.slice(previousNavigations), [destination.url]);
          assert.equal(page.url(), originalUrl, `${label}: homepage remains in its original tab`);
          assert.equal(
            await page.$eval(dialogSelector, (dialog) => dialog.open),
            false,
            `${label}: confirming closes the dialog`,
          );
          await popup.close();
          await page.bringToFront();
          assert.equal(
            await page.$eval(destination.selector, (link) => document.activeElement === link),
            true,
            `${label}: returning to the homepage restores the scene link focus`,
          );
        }
      }
    }
    await interceptor.detach();
    assert.deepEqual(
      errors,
      [],
      'Confirmation and external fixture pages produce no browser errors',
    );
  } finally {
    await closeBrowser(browser);
  }
});

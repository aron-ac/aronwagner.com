const { test } = require('node:test');
/* Serve the repo first. Optional SITE_URL and CHROME_BIN match the other browser suites. */
const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const path = require('node:path');
const { launchBrowser, closeBrowser } = require('./helpers/browser.cjs');

const site = process.env.SITE_URL || 'http://localhost:8000/';
const dialogSelector = '#books-dialog';
const closeSelector = `${dialogSelector} [data-dialog-close]`;

async function coverLayout(page) {
  return page.$eval('.book-cover', (image) => {
    const bounds = (element) => {
      const { x, y, width, height } = element.getBoundingClientRect();
      return { x, y, width, height };
    };
    return {
      image: bounds(image),
      frame: bounds(image.parentElement),
      dialog: bounds(image.closest('dialog')),
      fit: getComputedStyle(image).objectFit,
    };
  });
}

function assertCoverFits(layout, label) {
  const { image, frame } = layout;
  assert.ok(image.width > 0 && image.height > 0, `${label}: cover has a visible frame`);
  assert.ok(
    image.x >= frame.x - 1 &&
      image.y >= frame.y - 1 &&
      image.x + image.width <= frame.x + frame.width + 1 &&
      image.y + image.height <= frame.y + frame.height + 1,
    `${label}: cover stays within its frame`,
  );
  assert.equal(layout.fit, 'contain', `${label}: the complete cover fits without cropping`);
}

function assertStableCover(before, after, label) {
  for (const element of ['image', 'frame', 'dialog']) {
    for (const dimension of ['width', 'height']) {
      assert.ok(
        Math.abs(before[element][dimension] - after[element][dimension]) <= 1,
        `${label}: ${element} ${dimension} does not change`,
      );
    }
  }
}

test('books smoke', { timeout: 300_000 }, async () => {
  const catalog = JSON.parse(
    await readFile(path.join(__dirname, '../assets/books/catalog.json'), 'utf8'),
  );
  assert.equal(catalog.length, 11, 'All requested books are present');
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    const errors = [];
    let catalogRequests = 0;
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.endsWith('/assets/books/catalog.json')) catalogRequests++;
    });
    page.on('response', (response) => {
      if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
    });
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);

    const isOpen = () => page.$eval(dialogSelector, (dialog) => dialog.open);
    const focused = (selector) =>
      page.$eval(selector, (element) => element === document.activeElement);
    const currentTitle = () => page.$eval('.book-title', (element) => element.textContent);

    async function openShelf(y = 450) {
      await page.$eval('.scene', (scene) => scene.scrollIntoView({ block: 'start' }));
      const point = await page.$eval(
        '.scene',
        (scene, sourceY) => {
          const bounds = scene.getBoundingClientRect();
          const x = bounds.left + (1300 / 1536) * bounds.width;
          const y = bounds.top + (sourceY / 1024) * bounds.height;
          return { x, y, hit: Boolean(document.elementFromPoint(x, y)?.closest('.books-toggle')) };
        },
        y,
      );
      assert.equal(point.hit, true, 'The illustrated bookshelf receives input');
      await page.mouse.click(point.x, point.y);
      await page.waitForFunction(
        () =>
          document.querySelector('#books-dialog').open &&
          !document.querySelector('.book-carousel').hidden,
      );
    }

    async function assertBook(index) {
      const expected = catalog[index];
      await page.waitForFunction(() => {
        const image = document.querySelector('.book-cover');
        return !image.hidden && image.complete && image.naturalWidth > 0;
      });
      const actual = await page.$eval(dialogSelector, (dialog) => ({
        title: dialog.querySelector('.book-title').textContent,
        author: dialog.querySelector('.book-author').textContent,
        cover: dialog.querySelector('.book-cover').getAttribute('src'),
        alt: dialog.querySelector('.book-cover').alt,
        position: dialog.querySelector('.book-position').textContent,
        links: [...dialog.querySelectorAll('.book-cover-link, .book-amazon')].map((link) => ({
          href: link.href,
          target: link.target,
          rel: [...link.relList],
          label: link.getAttribute('aria-label'),
        })),
      }));
      assert.equal(actual.title, expected.title);
      assert.equal(actual.author, expected.author);
      const coverURL = new URL(actual.cover, site);
      assert.equal(coverURL.origin, new URL(site).origin, 'Book covers are served locally');
      assert.equal(
        coverURL.pathname.replace(/^\/immutable\/[a-f0-9]{16}\//, '/'),
        `/${expected.cover}`,
      );
      assert.equal(actual.alt, expected.alt);
      assert.equal(actual.position, `${String(index + 1).padStart(2, '0')} / ${catalog.length}`);
      for (const link of actual.links) {
        assert.equal(
          link.href,
          expected.amazonUrl,
          `${expected.title}: original Amazon link preserved`,
        );
        assert.equal(link.target, '_blank');
        assert.ok(link.rel.includes('noopener') && link.rel.includes('noreferrer'));
        assert.match(link.label, /opens in a new tab/);
      }
      assertCoverFits(await coverLayout(page), expected.title);
    }

    async function assertLayout(label) {
      const layout = await page.$eval(dialogSelector, (dialog) => {
        const rect = (element) => {
          const r = element.getBoundingClientRect();
          return {
            inside:
              r.left >= -1 &&
              r.top >= -1 &&
              r.right <= innerWidth + 1 &&
              r.bottom <= innerHeight + 1,
            width: r.width,
            height: r.height,
            hit: element.contains(
              document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2),
            ),
          };
        };
        const slide = dialog.querySelector('.book-slide');
        return {
          dialog: rect(dialog),
          close: rect(dialog.querySelector('[data-dialog-close]')),
          prev: rect(dialog.querySelector('.book-prev')),
          next: rect(dialog.querySelector('.book-next')),
          slide: rect(slide),
          canScroll:
            slide.scrollHeight <= slide.clientHeight + 1 ||
            getComputedStyle(slide).overflowY === 'auto',
          noPageOverflow: document.documentElement.scrollWidth <= innerWidth,
          noDialogScroll: dialog.scrollHeight <= dialog.clientHeight + 1,
          noSlideOverflow: slide.scrollWidth <= slide.clientWidth + 1,
        };
      });
      for (const name of ['dialog', 'close', 'prev', 'next', 'slide']) {
        assert.equal(layout[name].inside, true, `${label}: ${name} stays within viewport`);
      }
      for (const name of ['close', 'prev', 'next']) {
        assert.equal(layout[name].hit, true, `${label}: ${name} receives input`);
        assert.ok(
          layout[name].width >= 44 && layout[name].height >= 44,
          `${label}: ${name} has a 44px target`,
        );
      }
      assert.equal(layout.canScroll, true, `${label}: compact slide contents can scroll`);
      assert.ok(layout.slide.height >= 60, `${label}: slide remains usable`);
      assert.equal(layout.noPageOverflow, true, `${label}: page does not overflow horizontally`);
      assert.equal(layout.noDialogScroll, true, `${label}: controls stay outside slide scrolling`);
      assert.equal(layout.noSlideOverflow, true, `${label}: slide does not overflow horizontally`);
      await page.$eval('.book-amazon', (link) => link.scrollIntoView({ block: 'nearest' }));
      assert.equal(
        await page.$eval('.book-amazon', (link) => {
          const r = link.getBoundingClientRect();
          return (
            r.top >= 0 &&
            r.bottom <= innerHeight &&
            link.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2))
          );
        }),
        true,
        `${label}: Amazon link is reachable by scrolling`,
      );
    }

    // Hold the first cover response until the visible modal has painted. This
    // catches intrinsic image sizing changes that cached desktop checks miss.
    for (const viewport of [
      { width: 402, height: 874, isMobile: true, hasTouch: true },
      { width: 874, height: 402, isMobile: true, hasTouch: true },
    ]) {
      const coldPage = await browser.newPage();
      try {
        await coldPage.setViewport(viewport);
        await coldPage.setCacheEnabled(false);
        await coldPage.setRequestInterception(true);
        const firstCover = Promise.withResolvers();
        let holdCover = true;
        coldPage.on('request', (request) => {
          if (holdCover && new URL(request.url()).pathname.endsWith(`/${catalog[0].cover}`)) {
            holdCover = false;
            firstCover.resolve(request);
          } else void request.continue();
        });
        await coldPage.goto(site, { waitUntil: 'networkidle0' });
        await coldPage.evaluate(() => document.fonts.ready.then(() => undefined));
        await coldPage.tap('.books-toggle');
        await coldPage.waitForFunction(() => !document.querySelector('.book-carousel').hidden);
        const request = await firstCover.promise;
        const label = `${viewport.width}×${viewport.height} first cover`;
        const pending = await coverLayout(coldPage);
        assertCoverFits(pending, `${label} while loading`);
        assert.equal(
          await coldPage.$eval('.book-cover', (image) => image.complete),
          false,
          `${label}: the image response is still pending`,
        );
        await request.continue();
        await coldPage.waitForFunction(() => {
          const image = document.querySelector('.book-cover');
          return image.complete && image.naturalWidth > 0;
        });
        const loaded = await coverLayout(coldPage);
        assertCoverFits(loaded, `${label} after loading`);
        assertStableCover(pending, loaded, `${label} loading`);
        for (let index = 1; index <= 3; index++) {
          await coldPage.tap('.book-next');
          await coldPage.waitForFunction(() => {
            const image = document.querySelector('.book-cover');
            return image.complete && image.naturalWidth > 0;
          });
          assertCoverFits(await coverLayout(coldPage), `${label} next ${index}`);
        }
        for (let index = 0; index < 3; index++) await coldPage.tap('.book-prev');
        await coldPage.waitForFunction(() => {
          const image = document.querySelector('.book-cover');
          return image.complete && image.naturalWidth > 0;
        });
        assert.equal(
          await coldPage.$eval('.book-title', (element) => element.textContent),
          catalog[0].title,
        );
        assertStableCover(loaded, await coverLayout(coldPage), `${label} after browsing`);
        await coldPage.tap(closeSelector);
        await coldPage.tap('.books-toggle');
        await coldPage.waitForFunction(() => !document.querySelector('.book-carousel').hidden);
        assertStableCover(loaded, await coverLayout(coldPage), `${label} after reopening`);
      } finally {
        await coldPage.close();
      }
    }

    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(site, { waitUntil: 'networkidle0' });
    assert.equal(catalogRequests, 0, 'The catalog is not fetched before the bookshelf opens');
    await openShelf();
    assert.equal(catalogRequests, 1, 'Opening loads the catalog once');
    assert.equal(await focused(closeSelector), true, 'Opening focuses close');
    for (let i = 0; i < catalog.length; i++) {
      await assertBook(i);
      await page.click('.book-next');
    }
    await assertBook(0);
    await page.click('.book-prev');
    await assertBook(catalog.length - 1);
    await page.keyboard.press('Home');
    await assertBook(0);
    await page.keyboard.press('ArrowRight');
    await assertBook(1);
    await page.keyboard.press('ArrowLeft');
    await assertBook(0);
    await page.keyboard.press('End');
    await assertBook(catalog.length - 1);
    await page.keyboard.press('Home');

    // Redirect the click locally before its default action, so no Amazon request is made.
    await page.$eval('.book-cover-link', (link) =>
      link.addEventListener(
        'click',
        () => {
          link.href = 'about:blank';
        },
        { once: true },
      ),
    );
    const popupPromise = new Promise((resolve) => page.once('popup', resolve));
    const originalUrl = page.url();
    await page.click('.book-cover-link');
    const popup = await popupPromise;
    assert.equal(popup.url(), 'about:blank', 'Cover click opens a separate tab');
    assert.equal(await popup.evaluate(() => window.opener), null, 'The new tab has no opener');
    assert.equal(page.url(), originalUrl, 'The homepage remains in its original tab');
    await popup.close();
    await page.bringToFront();
    await page.keyboard.press('Home');

    await page.focus(closeSelector);
    for (const selector of ['.book-cover-link', '.book-amazon', '.book-prev', '.book-next']) {
      await page.keyboard.press('Tab');
      assert.equal(await focused(selector), true, `${selector} is keyboard reachable in the modal`);
    }
    await page.keyboard.down('Shift');
    await page.keyboard.press('Tab');
    await page.keyboard.up('Shift');
    assert.equal(await focused('.book-prev'), true, 'Reverse tab order remains within the modal');
    await page.click(closeSelector);
    assert.equal(await isOpen(), false);
    assert.equal(await focused('.books-toggle'), true, 'Close restores bookshelf focus');
    await openShelf(580);
    assert.equal(catalogRequests, 1, 'The second bookshelf row reuses the loaded catalog');
    await page.keyboard.press('Escape');
    assert.equal(await isOpen(), false);
    assert.equal(await focused('.books-toggle'), true, 'Escape restores bookshelf focus');
    await openShelf();
    await page.click('#books-title');
    assert.equal(await isOpen(), true, 'Inside clicks leave the modal open');
    const backdrop = await page.$eval(dialogSelector, (dialog) => {
      const r = dialog.getBoundingClientRect();
      return { x: r.left - 8, y: r.top + r.height / 2 };
    });
    await page.mouse.click(backdrop.x, backdrop.y);
    assert.equal(await isOpen(), false, 'Backdrop click closes the modal');
    assert.equal(await focused('.books-toggle'), true, 'Backdrop restores bookshelf focus');

    const viewports = [
      { width: 320, height: 568, isMobile: true, hasTouch: true },
      { width: 390, height: 844, isMobile: true, hasTouch: true },
      { width: 568, height: 320, isMobile: true, hasTouch: true },
      { width: 768, height: 1024, hasTouch: true },
      { width: 1440, height: 900 },
    ];
    for (const viewport of viewports) {
      await page.setViewport(viewport);
      for (const night of [false, true]) {
        await page.goto(site, { waitUntil: 'networkidle0' });
        if (
          (await page.evaluate(() => document.documentElement.classList.contains('night'))) !==
          night
        )
          await page.click('.theme-toggle');
        await openShelf();
        for (let i = 0; i < catalog.length; i++) {
          await assertBook(i);
          await assertLayout(
            `${viewport.width}×${viewport.height} ${night ? 'night' : 'day'} ${catalog[i].title}`,
          );
          await page.click('.book-next');
        }
        await page.click(closeSelector);
      }
    }

    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.goto(site, { waitUntil: 'networkidle0' });
    await openShelf();
    const client = await page.createCDPSession();
    async function swipe(direction) {
      await page.$eval('.book-cover-link', (link) => link.scrollIntoView({ block: 'nearest' }));
      const r = await page.$eval('.book-cover-link', (link) => {
        const r = link.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      });
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x: r.x - direction * 60, y: r.y }],
      });
      for (let step = 1; step <= 6; step++)
        await client.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [{ x: r.x - direction * 60 + direction * 20 * step, y: r.y }],
        });
      await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    }
    const tabsBefore = (await browser.pages()).length;
    await swipe(-1);
    assert.equal(
      await currentTitle(),
      catalog[1].title,
      'A leftward touch swipe advances the book',
    );
    await swipe(1);
    assert.equal(
      await currentTitle(),
      catalog[0].title,
      'A rightward touch swipe returns to the previous book',
    );
    assert.equal(
      (await browser.pages()).length,
      tabsBefore,
      'Swipes do not activate the Amazon link',
    );
    await client.detach();
    assert.deepEqual(errors, [], 'No browser errors or failed requests during normal use');

    const failurePage = await browser.newPage();
    const failureErrors = [];
    failurePage.on('pageerror', (error) => failureErrors.push(error.message));
    let failCatalog = true;
    let failCover = true;
    await failurePage.setRequestInterception(true);
    failurePage.on('request', (request) => {
      const pathname = new URL(request.url()).pathname;
      if (failCatalog && pathname.endsWith('/assets/books/catalog.json')) {
        failCatalog = false;
        void request.respond({
          status: 503,
          contentType: 'text/plain',
          body: 'Unavailable for test',
        });
      } else if (failCover && pathname.endsWith(`/${catalog[0].cover}`)) {
        failCover = false;
        void request.respond({
          status: 404,
          contentType: 'text/plain',
          body: 'Unavailable for test',
        });
      } else void request.continue();
    });
    await failurePage.goto(site, { waitUntil: 'networkidle0' });
    await failurePage.click('.books-toggle');
    await failurePage.waitForFunction(() => !document.querySelector('.books-retry').hidden);
    assert.match(
      await failurePage.$eval('.books-status', (status) => status.textContent),
      /couldn’t load/,
    );
    await failurePage.click('.books-retry');
    await failurePage.waitForFunction(
      () =>
        !document.querySelector('.book-carousel').hidden &&
        !document.querySelector('.book-cover-fallback').hidden,
    );
    assert.equal(
      await failurePage.evaluate(() =>
        document.querySelector('#books-dialog').contains(document.activeElement),
      ),
      true,
      'Retry restores keyboard focus within the recovered modal',
    );
    assert.equal(
      await failurePage.$eval('.book-title', (title) => title.textContent),
      catalog[0].title,
      'Retry recovers the catalog',
    );
    assert.equal(
      await failurePage.$eval('.book-cover', (cover) => cover.hidden),
      true,
      'A failed cover shows the fallback',
    );
    assert.equal(
      await failurePage.$eval('.book-amazon', (link) => link.href),
      catalog[0].amazonUrl,
      'A failed cover leaves the Amazon link intact',
    );
    await failurePage.keyboard.press('ArrowRight');
    await failurePage.waitForFunction(() => {
      const image = document.querySelector('.book-cover');
      return !image.hidden && image.complete && image.naturalWidth > 0;
    });
    assert.equal(
      await failurePage.$eval('.book-cover-fallback', (fallback) => fallback.hidden),
      true,
      'The next successful cover clears the fallback',
    );
    assert.equal(
      await failurePage.$eval('.book-title', (title) => title.textContent),
      catalog[1].title,
      'Keyboard navigation works immediately after retry',
    );
    assert.deepEqual(failureErrors, [], 'Recoverable network failures do not throw page errors');
    await failurePage.close();
    console.log(
      'Favorite books: stable cold/slow first-cover sizing, 11 exact covers/links, carousel keys/wrap, modal focus/dismissal, touch swipes, 10 responsive theme layouts, and network recovery passed.',
    );
  } finally {
    await closeBrowser(browser);
  }
});

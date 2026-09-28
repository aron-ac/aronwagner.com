const { test } = require('node:test');
/* Serve the repo, then run with Puppeteer. Optional PUPPETEER_MODULE / CHROME_BIN / SITE_URL. */
const assert = require('node:assert/strict');
const { launchBrowser, closeBrowser, artifactPath, settlePage } = require('./helpers/browser.cjs');
const site = process.env.SITE_URL || 'http://localhost:8000/';
test('homepage smoke', { timeout: 300_000 }, async () => {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('response', (response) => {
      if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
    });
    await page.setViewport({ width: 1440, height: 1100 });
    await page.evaluateOnNewDocument(() => {
      const NativeDate = Date;
      let now = NativeDate.parse('2026-01-15T18:00:00Z');
      window.Date = class extends NativeDate {
        constructor(...args) {
          super(...(args.length ? args : [now]));
        }
        static now() {
          return now;
        }
      };
      window.setTestClock = (value) => {
        now = NativeDate.parse(value);
        window.dispatchEvent(new Event('focus'));
      };
      if (!sessionStorage.getItem('homepage-test-seeded')) {
        localStorage.clear();
        localStorage.setItem('mark-site-theme', 'night');
        sessionStorage.setItem('homepage-test-seeded', '1');
      }
    });
    await page.goto(site, { waitUntil: 'networkidle0' });
    const isNight = () => page.evaluate(() => document.documentElement.classList.contains('night'));
    assert.equal(
      await isNight(),
      false,
      'Old permanently saved theme does not override the new schedule',
    );
    const fixtures = [
      ['2026-01-15T10:59:00Z', true],
      ['2026-01-15T11:00:00Z', false],
      ['2026-01-15T23:59:00Z', false],
      ['2026-01-16T00:00:00Z', true],
      ['2026-01-16T05:00:00Z', true],
      ['2026-01-16T11:00:00Z', false],
      ['2026-07-15T09:59:00Z', true],
      ['2026-07-15T10:00:00Z', false],
      ['2026-07-15T22:59:00Z', false],
      ['2026-07-15T23:00:00Z', true],
    ];
    for (const [time, night] of fixtures) {
      await page.evaluate((time) => setTestClock(time), time);
      assert.equal(await isNight(), night, `Eastern schedule at ${time}`);
    }
    await page.evaluate(() => setTestClock('2026-01-15T18:00:00Z'));
    await page.click('.theme-toggle');
    assert.equal(await isNight(), true, 'Manual theme switch works');
    await page.reload({ waitUntil: 'networkidle0' });
    assert.equal(
      await isNight(),
      true,
      'Manual choice survives reload within the same time period',
    );
    await page.evaluate(() => setTestClock('2026-01-16T00:00:00Z'));
    assert.equal(
      await page.evaluate(() => localStorage.getItem('mark-site-theme-override')),
      null,
      'Next scheduled boundary expires manual override',
    );
    await page.evaluate(() => setTestClock('2026-01-16T11:00:00Z'));
    assert.equal(await isNight(), false, 'Following morning automatically returns to day');
    const navigationLinks = await page.$$eval('a[href]', (els) =>
      els
        .filter((el) => el.getAttribute('href') && !el.getAttribute('href').startsWith('#'))
        .map((el) => ({ href: el.getAttribute('href'), target: el.target, rel: [...el.relList] })),
    );
    assert.ok(navigationLinks.length > 0, 'Homepage has navigation links to check');
    for (const link of navigationLinks) {
      assert.equal(link.target, '_blank', `${link.href} opens in a new tab`);
      assert.ok(
        link.rel.includes('noopener') && link.rel.includes('noreferrer'),
        `${link.href} protects the originating page`,
      );
    }

    const links = [
      ['https://x.com/markhammonds', 'Twitter'],
      ['https://www.linkedin.com/in/mhammonds/', 'LinkedIn'],
      ['https://github.com/mhammonds', 'GitHub'],
    ];
    for (const [href, label] of links) {
      const selector = `.scene a[href="${href}"]`;
      assert.equal(
        await page.$$eval(selector, (els) => els.length),
        1,
        `${label} screen link is present once`,
      );
      await page.hover(selector);
      assert.ok(
        await page.$eval(
          `${selector} .label`,
          (el, label) => el.textContent.includes(label),
          label,
        ),
        `${label} has the requested hover label`,
      );
    }
    assert.deepEqual(
      await page.$$eval('.quick-links a', (els) =>
        els.map((el) => [el.getAttribute('href'), el.textContent.trim()]),
      ),
      links,
      'Submenu contains only the three requested social links',
    );
    const games = [
      ['surf-riders.html', 'Surf Riders'],
      ['bay-racer.html', 'Bay Racer'],
      ['cici-treat-trail.html', 'CiCi’s Treat Trail'],
    ];
    assert.deepEqual(
      await page.$$eval('.project-card', (els) =>
        els
          .map((el) => [el.getAttribute('href'), el.querySelector('h3').textContent.trim()])
          .sort(),
      ),
      [...games].sort(),
      'All three current games appear on the homepage',
    );
    const homeUrl = page.url();
    for (const [href, title] of games) {
      const gameTargetPromise = browser.waitForTarget(
        (target) =>
          target.type() === 'page' &&
          target !== page.target() &&
          new URL(target.url()).pathname.endsWith(`/${href}`),
      );
      await page.click(`.project-card[href="${href}"]`);
      const gamePage = await (await gameTargetPromise).page();
      assert.equal(page.url(), homeUrl, `Opening ${title} keeps the homepage in its original tab`);
      assert.equal(
        await gamePage.evaluate(() => window.opener === null),
        true,
        `${title} has no access to its opener`,
      );
      await gamePage.close();
      await page.bringToFront();
    }
    assert.equal(
      await page.evaluate(() => /Asteroids|CR Surf Rides/i.test(document.body.innerText)),
      false,
      'Retired game and old title are absent',
    );
    assert.equal(
      await page.evaluate(() =>
        [...document.querySelectorAll('.screen-wallpapers image')].some((el) =>
          (el.getAttribute('href') || '').includes('bitmotive'),
        ),
      ),
      false,
      'Small screens use Tampa rather than logo graphics',
    );

    assert.deepEqual(
      await page.$$eval('a[href^="mailto:"]', (els) => els.map((el) => el.getAttribute('href'))),
      ['mailto:mark@bitmotive.com'],
      'The business card provides the requested email address',
    );
    assert.equal(
      await page.evaluate(() => /Amor Fati/i.test(document.body.textContent)),
      false,
      'Retired motto is absent, including closed dialog content',
    );
    const popupOpen = () => page.$eval('#business-card-dialog', (el) => el.open);
    await page.click('#name button');
    assert.equal(await popupOpen(), true, 'Signature opens the business card');
    assert.equal(
      await page.$eval('#business-card-name', (el) => el.textContent.trim()),
      'Mark Hammonds',
    );
    assert.equal(
      await page.$eval('.business-card-title', (el) => el.textContent.trim()),
      'CEO, Bitmotive',
    );
    assert.ok(
      await page.$eval(
        '.business-card-logo img',
        (el) =>
          new URL(el.src).origin === location.origin &&
          new URL(el.src).pathname.endsWith('/assets/brand/bitmotive-logo.svg') &&
          el.complete &&
          el.naturalWidth > 0 &&
          el.alt.includes('Bitmotive'),
      ),
      'Official local Bitmotive logo loads with accessible text',
    );
    for (const selector of ['.business-card-logo', '.business-card-website']) {
      assert.equal(
        await page.$eval(selector, (el) => el.href),
        'https://www.bitmotive.com/',
        'Card logo and website link to Bitmotive',
      );
    }
    assert.deepEqual(
      await page.$eval('#business-card-dialog .business-card-email', (link) => ({
        text: link.querySelector('span:not([aria-hidden])').textContent.trim(),
        href: link.getAttribute('href'),
        target: link.target,
        rel: [...link.relList].sort(),
        label: link.getAttribute('aria-label'),
      })),
      {
        text: 'mark@bitmotive.com',
        href: 'mailto:mark@bitmotive.com',
        target: '_blank',
        rel: ['noopener', 'noreferrer'],
        label: 'Email Mark at mark@bitmotive.com (opens your email app)',
      },
      'The card displays the exact email link with the shared navigation policy',
    );
    await page.screenshot({ path: artifactPath('homepage-business-card-desktop.png') });
    await page.keyboard.press('Escape');
    assert.equal(await popupOpen(), false, 'Escape closes the popup');
    assert.ok(
      await page.evaluate(() => !!document.activeElement.closest('#name')),
      'Focus returns to the triggering name',
    );
    await page.keyboard.press('Enter');
    assert.equal(await popupOpen(), true, 'Name supports keyboard activation');
    await page.click('.business-card-close');
    assert.equal(await popupOpen(), false, 'Close button dismisses the popup');
    await page.click('.portrait');
    assert.equal(await popupOpen(), true, 'Portrait opens the same popup');
    await page.mouse.click(10, 10);
    assert.equal(await popupOpen(), false, 'Backdrop click dismisses the popup');
    for (const selector of ['.intro p [data-business-card]', 'footer [data-business-card]']) {
      await page.click(selector);
      assert.equal(await popupOpen(), true, 'Other visible name instances open the popup');
      await page.click('.business-card-close');
    }

    const polaroidOpen = () => page.$eval('#polaroid-dialog', (el) => el.open);
    const loadedPhoto = async (previous) => {
      await page.waitForFunction(
        (previous) => {
          const photo = document.querySelector('.polaroid-photo');
          return (
            photo &&
            photo.complete &&
            photo.naturalWidth > 0 &&
            photo.currentSrc &&
            photo.currentSrc !== previous
          );
        },
        {},
        previous || '',
      );
      const photo = await page.$eval('.polaroid-photo', (el) => ({
        src: el.currentSrc,
        alt: el.alt,
      }));
      const source = new URL(photo.src);
      assert.equal(source.origin, new URL(site).origin, 'Camera photo loads from the local site');
      assert.match(source.pathname, /\.jpg$/i, 'Camera displays a converted JPG');
      assert.ok(photo.alt.trim(), 'Camera photo has alternative text');
      return photo.src;
    };
    assert.equal(
      await page.$eval('.polaroid-photo', (el) => !!el.getAttribute('src')),
      false,
      'Photo loading waits until the camera is opened',
    );
    await page.click('.camera-toggle');
    assert.equal(await polaroidOpen(), true, 'Camera opens the photo viewer');
    let previousPhoto = await loadedPhoto();
    const photoBag = new Set([previousPhoto]);
    for (let i = 1; i < 6; i++) {
      if (i === 1) {
        await page.focus('.polaroid-next');
        await page.keyboard.press('Enter');
      } else await page.click('.polaroid-next');
      previousPhoto = await loadedPhoto(previousPhoto);
      photoBag.add(previousPhoto);
      if (i === 1)
        assert.equal(
          await page.evaluate(() => document.activeElement.matches('.polaroid-next')),
          true,
          'Another photo retains keyboard focus after loading',
        );
    }
    assert.equal(
      photoBag.size,
      6,
      'All six photos appear once before the shuffled collection repeats',
    );
    await page.click('.polaroid-next');
    previousPhoto = await loadedPhoto(previousPhoto);
    assert.ok(
      photoBag.has(previousPhoto),
      'A new shuffled collection reuses the same local photos',
    );
    await page.screenshot({ path: artifactPath('homepage-polaroid-desktop.png') });
    await page.keyboard.press('Escape');
    assert.equal(await polaroidOpen(), false, 'Escape closes the photo viewer');
    assert.equal(
      await page.evaluate(() => document.activeElement.matches('.camera-toggle')),
      true,
      'Closing returns keyboard focus to the camera',
    );
    await page.keyboard.press('Enter');
    assert.equal(await polaroidOpen(), true, 'Camera supports keyboard activation');
    previousPhoto = await loadedPhoto(previousPhoto);
    await page.click('.polaroid-close');
    assert.equal(await polaroidOpen(), false, 'Photo viewer close button works');
    await page.click('.camera-toggle');
    await loadedPhoto(previousPhoto);
    await page.mouse.click(10, 10);
    assert.equal(await polaroidOpen(), false, 'Clicking the backdrop closes the photo viewer');

    const pressed = () => page.$eval('.candle-toggle', (el) => el.getAttribute('aria-pressed'));
    assert.equal(await pressed(), 'true', 'Candle starts lit');
    await page.click('.candle-toggle');
    assert.equal(await pressed(), 'false');
    assert.equal(
      await page.$eval('.scene', (el) => el.classList.contains('candle-lit')),
      false,
      'Click blows out candle',
    );
    assert.match(await page.$eval('#candle-status', (el) => el.textContent), /out/);
    await page.focus('.candle-toggle');
    await page.keyboard.press('Enter');
    assert.equal(await pressed(), 'true', 'Keyboard relights candle');
    await page.click('.painting-toggle');
    assert.equal(
      await page.$eval('.painting-toggle', (el) => el.getAttribute('aria-expanded')),
      'true',
    );
    assert.equal(await page.$eval('#wall-safe', (el) => el.getAttribute('aria-hidden')), 'false');
    await settlePage(page);
    await page.screenshot({ path: artifactPath('homepage-day-safe.png'), fullPage: true });
    await page.keyboard.press('Escape');
    assert.equal(
      await page.$eval('.painting-toggle', (el) => el.getAttribute('aria-expanded')),
      'false',
    );
    await page.evaluate(() => setTestClock('2026-01-16T02:00:00Z'));
    await page.click('.candle-toggle');
    await settlePage(page);
    await page.screenshot({ path: artifactPath('homepage-night-unlit.png'), fullPage: true });
    await page.click('.candle-toggle');
    await page.screenshot({ path: artifactPath('homepage-night-lit.png'), fullPage: true });

    const tapRegion = async (selector) => {
      const point = await page.$eval(selector, (region) => {
        region.scrollIntoView({ block: 'center', behavior: 'instant' });
        const bounds = region.getBoundingClientRect();
        return { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 };
      });
      await page.touchscreen.tap(point.x, point.y);
    };
    const tapPin = (selector) => tapRegion(`${selector} .hotspot-pin`);
    for (const width of [390, 768]) {
      await page.setViewport({
        width,
        height: 1000,
        isMobile: width === 390,
        hasTouch: width === 390,
      });
      await page.goto(site, { waitUntil: 'networkidle0' });
      assert.ok(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        'No horizontal overflow',
      );
      if (width === 390) {
        const pins = await page.$$eval('.hotspot-pin', (pins) =>
          pins.map((pin) => ({
            control: pin.parentElement.className,
            pulsing: [null, '::before', '::after'].some((pseudo) => {
              const style = getComputedStyle(pin, pseudo);
              return (
                style.animationName !== 'none' &&
                parseFloat(style.animationDuration) > 0 &&
                style.animationIterationCount === 'infinite'
              );
            }),
          })),
        );
        assert.equal(pins.length, 11, 'Scene objects have touch pins except Mark and CiCi');
        assert.equal(
          await page.$$eval('.portrait .hotspot-pin, .dog .hotspot-pin', (pins) => pins.length),
          0,
          'Mark and CiCi remain free of pin dots',
        );
        for (const pin of pins) {
          assert.equal(pin.pulsing, true, `${pin.control} pin pulses with normal motion`);
        }
      }
      for (const [href, label] of links) {
        assert.ok(
          await page.$eval(`.scene a[href="${href}"]`, (el) => {
            const r = el.getBoundingClientRect(),
              hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
            return hit === el || el.contains(hit);
          }),
          `${label} screen can be tapped at ${width}px`,
        );
      }
      await page.click('#name button');
      assert.equal(await popupOpen(), true, 'Mobile name tap opens popup');
      assert.ok(
        await page.$eval('#business-card-dialog', (el) => {
          const r = el.getBoundingClientRect();
          return r.x >= 0 && r.right <= innerWidth && r.y >= 0 && r.bottom <= innerHeight;
        }),
        'Business card fits mobile viewport',
      );
      await page.screenshot({ path: artifactPath(`homepage-business-card-${width}.png`) });
      await page.click('.business-card-close');
      assert.equal(await popupOpen(), false);
      if (width === 390) {
        await tapRegion('.portrait');
        assert.equal(await popupOpen(), true, 'Tapping Mark opens the business card without a pin');
        await page.click('.business-card-close');
        const dogStatus = await page.$eval('#dog-status', (status) => status.textContent);
        await tapRegion('.dog');
        assert.notEqual(
          await page.$eval('#dog-status', (status) => status.textContent),
          dogStatus,
          'Tapping CiCi still pets her without a pin',
        );
        await tapPin('.candle-toggle');
      } else await page.click('.candle-toggle');
      assert.equal(await pressed(), 'false', 'Mobile candle toggle');
      if (width === 390) await tapPin('.painting-toggle');
      else await page.click('.painting-toggle');
      assert.equal(
        await page.$eval('.painting-toggle', (el) => el.getAttribute('aria-expanded')),
        'true',
        'Painting tap reveals the safe',
      );
      await settlePage(page);
      if (width === 390) {
        await tapPin('.painting-toggle');
        assert.equal(
          await page.$eval('.painting-toggle', (el) => el.getAttribute('aria-expanded')),
          'false',
          'The painting pin can close the revealed safe',
        );
        await settlePage(page);
        await tapPin('.painting-toggle');
        assert.equal(
          await page.$eval('.painting-toggle', (el) => el.getAttribute('aria-expanded')),
          'true',
          'The painting pin can reopen the safe',
        );
        await settlePage(page);
      }
      await page.screenshot({ path: artifactPath(`homepage-${width}.png`), fullPage: true });
    }
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 844, height: 390 },
    ]) {
      await page.setViewport({ ...viewport, isMobile: true, hasTouch: true });
      await page.goto(site, { waitUntil: 'networkidle0' });
      await tapPin('.camera-toggle');
      assert.equal(await polaroidOpen(), true, 'Tapping the camera pin opens the photo viewer');
      let prior = '';
      for (let i = 0; i < 6; i++) {
        if (i) await page.click('.polaroid-next');
        prior = await loadedPhoto(prior);
        const fit = await page.evaluate(() => {
          const dialog = document.querySelector('#polaroid-dialog');
          const items = [
            dialog,
            ...dialog.querySelectorAll(
              '.polaroid-frame,.polaroid-photo,.polaroid-next,.polaroid-close',
            ),
          ];
          const overflow = getComputedStyle(dialog);
          return {
            visible: items.every((el) => {
              const r = el.getBoundingClientRect();
              return (
                r.width > 0 &&
                r.height > 0 &&
                r.left >= -1 &&
                r.top >= -1 &&
                r.right <= innerWidth + 1 &&
                r.bottom <= innerHeight + 1
              );
            }),
            scrolls:
              (['auto', 'scroll'].includes(overflow.overflowY) &&
                dialog.scrollHeight > dialog.clientHeight + 1) ||
              (['auto', 'scroll'].includes(overflow.overflowX) &&
                dialog.scrollWidth > dialog.clientWidth + 1),
          };
        });
        assert.ok(
          fit.visible,
          `Photo ${i + 1}, its frame and both controls fit ${viewport.width}×${viewport.height}`,
        );
        assert.equal(fit.scrolls, false, 'Photo viewer needs no internal scrolling');
      }
      await page.screenshot({ path: artifactPath(`homepage-polaroid-${viewport.width}.png`) });
      await page.click('.polaroid-close');
      assert.equal(await polaroidOpen(), false, 'Mobile close control dismisses the photo viewer');
    }
    assert.deepEqual(errors, [], 'No JavaScript errors or failed homepage assets');
    console.log(
      'PASS: Eastern schedule (winter/summer), manual override expiry, new-tab navigation and all three game launches, social screen and submenu links, Bitmotive business card and email link, six-photo Polaroid shuffle and keyboard controls, candle click/keyboard, safe reveal/Escape, pulsing touch pins and touchscreen activation, all three game cards, and responsive layouts.',
    );
  } finally {
    await closeBrowser(browser);
  }
});

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { launchBrowser, closeBrowser } = require('./helpers/browser.cjs');
const site = process.env.SITE_URL || 'http://localhost:8000/';
const viewports = [
  [320, 568, true],
  [360, 640, true],
  [375, 667, true],
  [390, 844, true],
  [480, 800, true],
  [481, 800, true],
  [568, 320, true],
  [650, 900, true],
  [651, 900, true],
  [667, 375, true],
  [844, 390, true],
  [768, 1024, true],
  [820, 1180, true],
  [1024, 768, true],
  [1180, 820, true],
  [1024, 600, false],
  [390, 844, false],
  [1280, 720, false],
  [1366, 768, false],
  [1440, 900, false],
  [1440, 900, true],
];

const sceneControls = [
  '.camera-toggle',
  '.meditations-toggle',
  '.katana-toggle',
  '.sisyphus-toggle',
  '.books-toggle',
  '.candle-toggle',
  '.painting-toggle',
  '.monitor',
  '.left-screen',
  '.laptop',
  '.right-screen',
  '.portrait',
  '.dog',
];

const sceneObjects = [
  ['.camera-toggle', 306, 270],
  ['.meditations-toggle', 445, 302],
  ['.katana-toggle', 300, 368],
  ['.candle-toggle', 321, 461],
  ['.portrait', 551, 485],
  ['.dog', 795, 795],
  ['.monitor', 860, 390],
  ['.left-screen', 727, 486],
  ['.laptop', 861, 490],
  ['.right-screen', 1009, 510],
  ['.sisyphus-toggle', 1303, 334],
  ['.sisyphus-toggle', 1367, 307],
  ['.sisyphus-toggle', 1265, 359],
  ['.painting-toggle', 1308, 287],
  ['.painting-toggle', 1325, 270],
  ['.books-toggle', 1304, 450],
  ['.books-toggle', 1304, 580],
];

async function assertVisible(page, selector, label, interactive = false) {
  const result = await page.$eval(selector, (element) => {
    const r = element.getBoundingClientRect();
    return {
      fits:
        r.width > 0 &&
        r.height > 0 &&
        r.left >= 0 &&
        r.top >= 0 &&
        r.right <= innerWidth &&
        r.bottom <= innerHeight,
      reachable: element.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)),
    };
  });
  assert.equal(result.fits, true, `${label}: ${selector} fits the viewport`);
  if (interactive) assert.equal(result.reachable, true, `${label}: ${selector} is reachable`);
}

async function assertThemeContrast(page, label) {
  const checks = await page.evaluate(() => {
    function luminance(color) {
      const linear = color
        .match(/[\d.]+/g)
        .slice(0, 3)
        .map(Number)
        .map((value) => {
          const channel = value / 255;
          return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
        });
      return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
    }
    return [
      ['.theme-toggle', 'body', 3],
      ['#sisyphus-dialog .quote-source', '#sisyphus-dialog', 4.5],
      ['.book-amazon', '.book-amazon', 4.5],
    ].map(([selector, background, minimum]) => {
      const foreground = luminance(getComputedStyle(document.querySelector(selector)).color);
      const backdrop = luminance(
        getComputedStyle(document.querySelector(background)).backgroundColor,
      );
      const ratio =
        (Math.max(foreground, backdrop) + 0.05) / (Math.min(foreground, backdrop) + 0.05);
      return { selector, minimum, ratio };
    });
  });
  for (const { selector, minimum, ratio } of checks) {
    assert.ok(
      ratio >= minimum,
      `${label}: ${selector} contrast ${ratio.toFixed(2)}:1 meets ${minimum}:1`,
    );
  }
}

async function assertHotspotPins(page, label, hasTouch) {
  assert.equal(
    await page.evaluate(() => matchMedia('(hover: none)').matches),
    hasTouch,
    `${label}: hover capability matches the emulated device`,
  );
  const circles = [];
  for (const selector of sceneControls) {
    await page.$eval(selector, (control) => control.scrollIntoView({ block: 'center' }));
    const pin = await page.$eval(selector, (control) => {
      const pins = control.querySelectorAll('.hotspot-pin');
      const pin = pins[0];
      if (!pin) return { count: 0 };
      const bounds = pin.getBoundingClientRect();
      const styles = [
        getComputedStyle(pin),
        getComputedStyle(pin, '::before'),
        getComputedStyle(pin, '::after'),
      ];
      const x = bounds.left + bounds.width / 2;
      const y = bounds.top + bounds.height / 2;
      const radius = Math.min(bounds.width, bounds.height) / 2 - 1;
      return {
        count: pins.length,
        decorative: pin.getAttribute('aria-hidden') === 'true' && pin.tabIndex === -1,
        visible: pin.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }),
        width: bounds.width,
        height: bounds.height,
        // Document coordinates stay comparable while each control is scrolled into view.
        x: x + scrollX,
        y: y + scrollY,
        hasDot: styles.some(
          (style) =>
            style.display !== 'none' &&
            style.visibility === 'visible' &&
            Number(style.opacity) > 0 &&
            parseFloat(style.width) > 0 &&
            parseFloat(style.width) <= 18 &&
            parseFloat(style.height) > 0 &&
            parseFloat(style.height) <= 18 &&
            style.backgroundColor !== 'rgba(0, 0, 0, 0)',
        ),
        tapFailures: [
          [x, y],
          ...[radius / 2, radius].flatMap((distance) =>
            Array.from({ length: 16 }, (_, index) => {
              const angle = (index * Math.PI) / 8;
              return [x + Math.cos(angle) * distance, y + Math.sin(angle) * distance];
            }),
          ),
        ]
          .map(([x, y]) => ({ x, y, hit: document.elementFromPoint(x, y) }))
          .filter(({ hit }) => !control.contains(hit))
          .map(({ x, y, hit }) => ({
            x,
            y,
            hit: hit?.closest('a, button')?.className || hit?.className || null,
          })),
        cornerHits: [-1, 1].flatMap((dx) =>
          [-1, 1]
            .map((dy) => [x + dx * bounds.width * 0.45, y + dy * bounds.height * 0.45])
            .filter(([x, y]) => pin.contains(document.elementFromPoint(x, y))),
        ),
        animations: styles.map((style) => style.animationName),
      };
    });
    if (['.portrait', '.dog', '.candle-toggle', '.monitor'].includes(selector)) {
      assert.equal(pin.count, 0, `${label}: ${selector} keeps its artwork free of pins`);
      continue;
    }
    assert.equal(pin.count, 1, `${label}: ${selector} has one pin`);
    assert.equal(pin.decorative, true, `${label}: ${selector} keeps one accessible control`);
    assert.equal(pin.visible, hasTouch, `${label}: ${selector} pin follows hover capability`);
    if (hasTouch) {
      assert.ok(
        pin.width >= 44 && pin.height >= 44,
        `${label}: ${selector} pin has a 44px tap area`,
      );
      assert.ok(Math.abs(pin.width - pin.height) < 0.1, `${label}: ${selector} pin is circular`);
      assert.deepEqual(pin.cornerHits, [], `${label}: ${selector} excludes the square's corners`);
      assert.equal(pin.hasDot, true, `${label}: ${selector} pin displays a small dot`);
      assert.deepEqual(pin.tapFailures, [], `${label}: ${selector} owns its pin's tap area`);
      assert.deepEqual(
        pin.animations,
        ['none', 'none', 'none'],
        `${label}: ${selector} pin remains still with reduced motion`,
      );
      circles.push({ selector, x: pin.x, y: pin.y, radius: pin.width / 2 });
    }
  }
  for (const [index, first] of circles.entries()) {
    for (const second of circles.slice(index + 1)) {
      const separation = Math.hypot(first.x - second.x, first.y - second.y);
      assert.ok(
        separation + 0.1 >= first.radius + second.radius,
        `${label}: ${first.selector} and ${second.selector} tap circles do not overlap (${separation.toFixed(2)}px apart)`,
      );
    }
  }
}

test('responsive home', { timeout: 300_000 }, async () => {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    for (const [width, height, hasTouch] of viewports) {
      const label = `homepage ${width}×${height} (${hasTouch ? 'touch' : 'mouse'})`;
      await page.setViewport({ width, height, hasTouch, isMobile: hasTouch });
      await page.goto(site, { waitUntil: 'networkidle0' });
      assert.ok(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        `${label}: no horizontal overflow`,
      );
      for (const selector of ['.theme-toggle', ...sceneControls]) {
        await page.$eval(selector, (element) => element.scrollIntoView({ block: 'center' }));
        await assertVisible(page, selector, label, true);
      }
      await assertHotspotPins(page, label, hasTouch);
      await page.$eval('.scene', (scene) => scene.scrollIntoView({ block: 'start' }));
      for (const [selector, x, y] of sceneObjects) {
        await page.$eval(selector, (control) => control.scrollIntoView({ block: 'center' }));
        const reachable = await page.$eval(
          '.scene',
          (scene, { selector, x, y }) => {
            const bounds = scene.getBoundingClientRect();
            return Boolean(
              document
                .elementFromPoint(
                  bounds.left + (x / 1536) * bounds.width,
                  bounds.top + (y / 1024) * bounds.height,
                )
                ?.closest(selector),
            );
          },
          { selector, x, y },
        );
        assert.equal(
          reachable,
          true,
          `${label}: ${selector} owns its illustrated object at (${x}, ${y})`,
        );
      }
      if (width <= 650) {
        for (const selector of ['.meditations-toggle', '.katana-toggle', '.sisyphus-toggle']) {
          const meetsTargetSize = await page.$eval(selector, (element) => {
            const bounds = element.getBoundingClientRect();
            return bounds.width >= 24 && bounds.height >= 24;
          });
          assert.ok(meetsTargetSize, `${label}: ${selector} has a compact 24px touch target`);
        }
      }
      for (const night of [false, true]) {
        if (
          (await page.evaluate(() => document.documentElement.classList.contains('night'))) !==
          night
        ) {
          await page.click('.theme-toggle');
        }
        await page.click('.sisyphus-toggle');
        await assertThemeContrast(page, `${label} (${night ? 'night' : 'day'})`);
        await assertVisible(page, '#sisyphus-dialog', label);
        await assertVisible(page, '#sisyphus-dialog .quote-close', label, true);
        await assertVisible(page, '#sisyphus-dialog .quote-passage', label, true);
        assert.equal(
          await page.$eval('#sisyphus-quote', (quote) =>
            quote.textContent.replace(/\s+/g, ' ').trim(),
          ),
          "The struggle itself towards the heights is enough to fill a man's heart. One must imagine Sisyphus happy.",
          `${label}: the statue displays the requested Camus quote`,
        );
        assert.equal(
          await page.$eval('#sisyphus-dialog .quote-author', (author) => author.textContent.trim()),
          'Albert Camus',
          `${label}: the quote identifies Albert Camus`,
        );
        assert.equal(
          await page.$eval(
            '#sisyphus-dialog .quote-close',
            (button) => button === document.activeElement,
          ),
          true,
          `${label}: opening the statue dialog focuses its close button`,
        );
        await page.focus('#sisyphus-dialog .quote-passage');
        await page.keyboard.press('End');
        await assertVisible(page, '#sisyphus-dialog .quote-author', label, true);
        await assertVisible(page, '#sisyphus-dialog .quote-source', label, true);
        await assertVisible(page, '#sisyphus-dialog .quote-actions', label);
        assert.deepEqual(
          await page.$eval('#sisyphus-dialog .quote-source', (source) => ({
            title: source.textContent.trim(),
            href: source.href,
            target: source.target,
            rel: [...source.relList].sort(),
          })),
          {
            title: 'The Myth of Sisyphus',
            href: 'https://www.penguin.co.uk/books/56970/the-myth-of-sisyphus-by-albert-camus-trans-justin-obrien-intro-james-wood/9780141182001',
            target: '_blank',
            rel: ['noopener', 'noreferrer'],
          },
          `${label}: the source links to the publisher in a protected new tab`,
        );
        assert.equal(
          await page.$eval('#sisyphus-dialog .quote-actions', (actions) =>
            actions.textContent.trim(),
          ),
          'Justin O’Brien translation · Penguin Modern Classics, 2013',
          `${label}: the citation identifies the translation and edition`,
        );
        await page.click('#sisyphus-dialog .quote-close');
        assert.equal(
          await page.$eval('#sisyphus-dialog', (dialog) => dialog.open),
          false,
          `${label}: the statue dialog closes`,
        );
        assert.equal(
          await page.$eval('.sisyphus-toggle', (button) => button === document.activeElement),
          true,
          `${label}: closing returns focus to the statue`,
        );
      }
      if (width === 1440) {
        await page.keyboard.press('Enter');
        assert.equal(
          await page.$eval('#sisyphus-dialog', (dialog) => dialog.open),
          true,
          'Enter opens the focused statue',
        );
        await page.keyboard.press('Escape');
        assert.equal(
          await page.$eval('#sisyphus-dialog', (dialog) => dialog.open),
          false,
          'Escape closes the statue dialog',
        );
        assert.equal(
          await page.$eval('.sisyphus-toggle', (button) => button === document.activeElement),
          true,
          'Escape restores statue focus',
        );
        await page.click('.painting-toggle');
        await page.click('.sisyphus-toggle');
        await page.keyboard.press('Escape');
        assert.equal(
          await page.$eval('#sisyphus-dialog', (dialog) => dialog.open),
          false,
          'Escape dismisses the statue quote above the open safe',
        );
        assert.equal(
          await page.$eval('.painting-toggle', (button) => button.getAttribute('aria-expanded')),
          'true',
          'The same Escape leaves the safe open',
        );
        await page.keyboard.press('Escape');
        assert.equal(
          await page.$eval('.painting-toggle', (button) => button.getAttribute('aria-expanded')),
          'false',
          'The next Escape closes the safe',
        );
        await page.click('.sisyphus-toggle');
        const backdrop = await page.$eval('#sisyphus-dialog', (dialog) => {
          const bounds = dialog.getBoundingClientRect();
          return { x: bounds.left - 8, y: bounds.top + bounds.height / 2 };
        });
        await page.mouse.click(backdrop.x, backdrop.y);
        assert.equal(
          await page.$eval('#sisyphus-dialog', (dialog) => dialog.open),
          false,
          'The backdrop dismisses the statue dialog',
        );
        assert.equal(
          await page.$eval('.sisyphus-toggle', (button) => button === document.activeElement),
          true,
          'Backdrop dismissal restores statue focus',
        );
      }
      await page.click('#name button');
      await assertVisible(page, '#business-card-dialog', label);
      await assertVisible(page, '.business-card-close', label, true);
      await assertVisible(page, '.business-card-website', label, true);
      await assertVisible(page, '.business-card-email', label, true);
      await page.click('.business-card-close');
      await page.click('.camera-toggle');
      // Exercise every image aspect ratio where available space is most constrained.
      const photos = width === 320 || height === 320 || height === 600 ? 6 : 1;
      let previous = '';
      for (let i = 0; i < photos; i++) {
        if (i) await page.click('.polaroid-next');
        await page.waitForFunction(
          (previous) => {
            const photo = document.querySelector('.polaroid-photo');
            return (
              photo.complete &&
              photo.naturalWidth > 0 &&
              photo.currentSrc &&
              photo.currentSrc !== previous
            );
          },
          {},
          previous,
        );
        previous = await page.$eval('.polaroid-photo', (element) => element.currentSrc);
        for (const selector of ['#polaroid-dialog', '.polaroid-frame', '.polaroid-photo']) {
          await assertVisible(page, selector, label);
        }
        await assertVisible(page, '.polaroid-close', label, true);
        await assertVisible(page, '.polaroid-next', label, true);
      }
      await page.click('.polaroid-close');
    }
    assert.deepEqual(errors, [], 'No runtime errors across responsive homepage layouts');
    console.log(
      `PASS: homepage at ${viewports.length} phone, tablet and laptop sizes; touch pins respect hover capability and reduced motion, and scene targets, Sisyphus quote/modal controls, business card and Polaroids remain reachable.`,
    );
  } finally {
    await closeBrowser(browser);
  }
});

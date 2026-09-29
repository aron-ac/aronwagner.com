const { test } = require('node:test');
/* Serve the repo first. Optional SITE_URL and CHROME_BIN match the other browser suites. */
const assert = require('node:assert/strict');
const { launchBrowser, closeBrowser } = require('./helpers/browser.cjs');
const identity = require('./helpers/identity.cjs');

const site = process.env.SITE_URL || 'http://localhost:8000/';
// Each card opens from an object in the 1536x1024 illustration.
const cards = [
  {
    name: 'John 3:16',
    trigger: '.bible-toggle',
    dialog: '#verse-dialog',
    point: [204, 365],
    // King James Version text; the card must not paraphrase or modernize it.
    text: 'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.',
    textSelector: '#verse-text',
  },
  {
    name: 'Army service',
    trigger: '.uniform-toggle',
    dialog: '#service-dialog',
    point: [1393, 290],
    text: 'Airborne Infantryman with the 82nd Airborne Division, Ranger Tab, One Tour to Iraq',
    textSelector: '#service-text',
  },
  {
    name: 'Golf',
    trigger: '.golf-toggle',
    dialog: '#golf-dialog',
    point: [1379, 661],
    text: "Email me if you'd like to play a round.",
    textSelector: '#golf-text',
  },
];

test('cards smoke', { timeout: 300_000 }, async () => {
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
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);

    const isOpen = (card) => page.$eval(card.dialog, (dialog) => dialog.open);
    const focused = (selector) =>
      page.$eval(selector, (element) => element === document.activeElement);

    async function clickSceneTrigger(card, label = card.name) {
      await page.$eval('.scene', (scene) => scene.scrollIntoView({ block: 'start' }));
      const point = await page.$eval(
        '.scene',
        (scene, { point, trigger }) => {
          const bounds = scene.getBoundingClientRect();
          const x = bounds.left + (point[0] / 1536) * bounds.width;
          const y = bounds.top + (point[1] / 1024) * bounds.height;
          return { x, y, reachable: Boolean(document.elementFromPoint(x, y)?.closest(trigger)) };
        },
        card,
      );
      assert.equal(point.reachable, true, `${label}: the illustrated object receives input`);
      await page.mouse.click(point.x, point.y);
      assert.equal(await isOpen(card), true, `${label}: the object opens its card`);
    }

    async function closeWithButton(card) {
      await page.click(`${card.dialog} .quote-close`);
      assert.equal(await isOpen(card), false, `${card.name}: close button dismisses the card`);
      assert.equal(
        await focused(card.trigger),
        true,
        `${card.name}: closing restores focus to its scene object`,
      );
    }

    async function assertCardFits(card, label) {
      const layout = await page.$eval(card.dialog, (dialog) => {
        const rect = (element) => {
          const bounds = element.getBoundingClientRect();
          return {
            inside:
              bounds.left >= -1 &&
              bounds.top >= -1 &&
              bounds.right <= innerWidth + 1 &&
              bounds.bottom <= innerHeight + 1,
            width: bounds.width,
            height: bounds.height,
            hit: element.contains(
              document.elementFromPoint(
                bounds.left + bounds.width / 2,
                bounds.top + bounds.height / 2,
              ),
            ),
          };
        };
        return {
          dialog: rect(dialog),
          close: rect(dialog.querySelector('.quote-close')),
          passage: rect(dialog.querySelector('.quote-passage')),
          passageFits: (() => {
            const passage = dialog.querySelector('.quote-passage');
            return passage.scrollHeight <= passage.clientHeight + 1;
          })(),
          noPageOverflow: document.documentElement.scrollWidth <= innerWidth,
          noDialogScroll: dialog.scrollHeight <= dialog.clientHeight + 1,
        };
      });
      for (const key of ['dialog', 'close', 'passage']) {
        assert.equal(layout[key].inside, true, `${label}: ${key} remains inside the viewport`);
        assert.equal(layout[key].hit, true, `${label}: ${key} receives pointer input`);
      }
      assert.ok(
        layout.close.width >= 44 && layout.close.height >= 44,
        `${label}: close target is at least 44px`,
      );
      // Short cards show all their text; longer ones keep a readable, scrollable window.
      assert.ok(
        layout.passageFits || layout.passage.height >= 40,
        `${label}: the text remains readable`,
      );
      assert.equal(layout.noPageOverflow, true, `${label}: no horizontal page overflow`);
      assert.equal(layout.noDialogScroll, true, `${label}: only the passage scrolls`);
    }

    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(site, { waitUntil: 'networkidle0' });
    for (const card of cards) {
      await clickSceneTrigger(card);
      assert.equal(
        await focused(`${card.dialog} .quote-close`),
        true,
        `${card.name}: opening focuses the close button`,
      );
      await page.keyboard.press('Tab');
      assert.equal(
        await focused(`${card.dialog} .quote-passage`),
        true,
        `${card.name}: the text region is keyboard reachable`,
      );
      assert.equal(
        await page.$eval(card.textSelector, (element) =>
          element.textContent.replace(/\s+/g, ' ').trim(),
        ),
        card.text,
        `${card.name}: the card shows the exact wording`,
      );
      await closeWithButton(card);

      await clickSceneTrigger(card);
      await page.keyboard.press('Escape');
      assert.equal(await isOpen(card), false, `${card.name}: Escape dismisses the card`);
      assert.equal(await focused(card.trigger), true, `${card.name}: Escape restores focus`);

      await clickSceneTrigger(card);
      await page.click(`${card.dialog} h2`);
      assert.equal(await isOpen(card), true, `${card.name}: card clicks leave it open`);
      const backdrop = await page.$eval(card.dialog, (dialog) => {
        const bounds = dialog.getBoundingClientRect();
        return { x: bounds.left - 8, y: bounds.top + bounds.height / 2 };
      });
      await page.mouse.click(backdrop.x, backdrop.y);
      assert.equal(await isOpen(card), false, `${card.name}: backdrop dismisses the card`);
      assert.equal(await focused(card.trigger), true, `${card.name}: backdrop restores focus`);
    }

    const verse = await page.$eval('#verse-dialog', (dialog) => {
      const link = dialog.querySelector('.quote-source');
      return {
        href: link.href,
        target: link.target,
        rel: [...link.relList],
        label: link.getAttribute('aria-label'),
        cite: dialog.querySelector('blockquote').cite,
        translation: dialog.querySelector('.quote-actions').textContent.trim(),
      };
    });
    assert.equal(verse.href, 'https://www.kingjamesbibleonline.org/John-3-16/');
    assert.equal(verse.cite, verse.href, 'The verse cites its source');
    assert.equal(verse.target, '_blank', 'The verse source opens in a new tab');
    assert.ok(verse.rel.includes('noopener') && verse.rel.includes('noreferrer'));
    assert.match(verse.label, /King James Version \(opens in a new tab\)/);
    assert.equal(verse.translation, 'King James Version', 'The card names the translation');

    const email = await page.$eval('#golf-dialog a.quote-next', (link) => ({
      href: link.getAttribute('href'),
      target: link.target,
      label: link.getAttribute('aria-label'),
    }));
    assert.deepEqual(
      email,
      {
        href: `mailto:${identity.email}?subject=Golf`,
        target: '',
        label: `Email ${identity.firstName} about golf at ${identity.email} (opens your email app)`,
      },
      'The golf invitation emails Aron without requesting a new tab',
    );

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
        ) {
          await page.click('.theme-toggle');
        }
        for (const card of cards) {
          const label = `${card.name} ${viewport.width}×${viewport.height} ${night ? 'night' : 'day'}`;
          await clickSceneTrigger(card, label);
          await assertCardFits(card, label);
          await closeWithButton(card);
        }
      }
    }
    assert.deepEqual(errors, [], 'No browser errors or failed asset requests');
    console.log(
      'Cards: Bible verse (KJV), service note and golf invitation open from their scene objects, keep exact wording, support keyboard/close/Escape/backdrop, and fit 10 responsive theme layouts.',
    );
  } finally {
    await closeBrowser(browser);
  }
});

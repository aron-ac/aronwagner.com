const { test } = require('node:test');
/* Serve the repo first. Optional SITE_URL and CHROME_BIN match the other browser suites. */
const assert = require('node:assert/strict');
const { launchBrowser, closeBrowser, artifactPath } = require('./helpers/browser.cjs');

const site = process.env.SITE_URL || 'http://localhost:8000/';
const readings = [
  {
    name: 'Meditations',
    trigger: '.meditations-toggle',
    dialog: '#meditations-dialog',
    quote: '#meditations-quote',
    point: [445, 302],
    count: 12,
  },
  {
    name: 'The Art of War',
    trigger: '.katana-toggle',
    dialog: '#art-of-war-dialog',
    quote: '#art-of-war-quote',
    point: [300, 368],
    count: 12,
  },
];

test('meditations smoke', { timeout: 300_000 }, async () => {
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

    const isOpen = (reading) => page.$eval(reading.dialog, (dialog) => dialog.open);
    const quote = (reading) => page.$eval(reading.quote, (element) => element.textContent.trim());
    const control = (reading, className) => `${reading.dialog} .quote-${className}`;
    const focused = (selector) =>
      page.$eval(selector, (element) => element === document.activeElement);

    async function clickSceneTrigger(reading) {
      await page.$eval('.scene', (scene) => scene.scrollIntoView({ block: 'start' }));
      const point = await page.$eval(
        '.scene',
        (scene, { point, trigger }) => {
          const bounds = scene.getBoundingClientRect();
          const x = bounds.left + (point[0] / 1536) * bounds.width;
          const y = bounds.top + (point[1] / 1024) * bounds.height;
          return {
            x,
            y,
            reachable: Boolean(document.elementFromPoint(x, y)?.closest(trigger)),
          };
        },
        reading,
      );
      assert.equal(point.reachable, true, `${reading.name}: the illustrated object receives input`);
      await page.mouse.click(point.x, point.y);
      assert.equal(await isOpen(reading), true, `${reading.name}: the object opens its dialog`);
    }

    async function closeWithButton(reading) {
      await page.click(control(reading, 'close'));
      assert.equal(await isOpen(reading), false, `${reading.name}: close button dismisses dialog`);
      assert.equal(
        await focused(reading.trigger),
        true,
        `${reading.name}: closing restores focus to its scene object`,
      );
    }

    async function assertCardFits(reading, label) {
      const layout = await page.$eval(reading.dialog, (dialog) => {
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
        const passage = dialog.querySelector('.quote-passage');
        return {
          dialog: rect(dialog),
          close: rect(dialog.querySelector('.quote-close')),
          next: rect(dialog.querySelector('.quote-next')),
          passage: rect(passage),
          passageCanScroll:
            passage.scrollHeight <= passage.clientHeight + 1 ||
            getComputedStyle(passage).overflowY === 'auto',
          noPageOverflow: document.documentElement.scrollWidth <= innerWidth,
          noDialogScroll: dialog.scrollHeight <= dialog.clientHeight + 1,
        };
      });
      for (const key of ['dialog', 'close', 'next', 'passage']) {
        assert.equal(layout[key].inside, true, `${label}: ${key} remains inside the viewport`);
        assert.equal(layout[key].hit, true, `${label}: ${key} receives pointer input`);
      }
      assert.ok(
        layout.close.width >= 44 && layout.close.height >= 44,
        `${label}: close target is at least 44px`,
      );
      assert.ok(layout.next.height >= 44, `${label}: next target is at least 44px tall`);
      assert.ok(layout.passage.height >= 40, `${label}: quote remains readable`);
      assert.equal(layout.passageCanScroll, true, `${label}: overflowing quotes can scroll`);
      assert.equal(layout.noPageOverflow, true, `${label}: no horizontal page overflow`);
      assert.equal(layout.noDialogScroll, true, `${label}: only the passage scrolls`);
    }

    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(site, { waitUntil: 'networkidle0' });
    for (const reading of readings) {
      await clickSceneTrigger(reading);
      assert.equal(
        await focused(control(reading, 'close')),
        true,
        `${reading.name}: opening focuses the close button`,
      );
      await page.keyboard.press('Tab');
      assert.equal(
        await focused(control(reading, 'passage')),
        true,
        `${reading.name}: the quote scroll region is keyboard reachable`,
      );

      const seen = new Set([await quote(reading)]);
      for (let i = 1; i < reading.count; i++) {
        await page.click(control(reading, 'next'));
        assert.equal(
          await focused(control(reading, 'next')),
          true,
          `${reading.name}: drawing another quote retains button focus`,
        );
        seen.add(await quote(reading));
      }
      assert.equal(seen.size, reading.count, `${reading.name}: every quote appears before repeats`);
      const lastQuote = await quote(reading);
      await page.click(control(reading, 'next'));
      assert.notEqual(await quote(reading), lastQuote, `${reading.name}: no immediate deck repeat`);

      const citation = await page.$eval(control(reading, 'source'), (link) => ({
        href: link.href,
        target: link.target,
        rel: [...link.relList],
        label: link.getAttribute('aria-label'),
        text: link.textContent,
        cite: link.closest('.quote-passage').querySelector('blockquote').cite,
      }));
      if (reading.name === 'Meditations') {
        assert.match(
          citation.href,
          /^https:\/\/en\.wikisource\.org\/wiki\/The_Thoughts_of_the_Emperor_Marcus_Aurelius_Antoninus\/Book_[IVX]+$/,
        );
        assert.match(citation.label, /Book [IVX]+, section \d+ \(opens in a new tab\)/);
        assert.match(citation.text, /Book [IVX]+ · \d+/);
      } else {
        assert.match(
          citation.href,
          /^https:\/\/www\.gutenberg\.org\/cache\/epub\/17405\/pg17405-images\.html#chap0[1-7]$/,
        );
        assert.match(citation.label, /Read The Art of War, [IVX]+\. .+, section \d/);
        assert.match(citation.text, /^[IVX]+\. .+ · \d/);
      }
      assert.equal(citation.target, '_blank', `${reading.name}: source opens in a new tab`);
      assert.ok(
        citation.rel.includes('noopener') && citation.rel.includes('noreferrer'),
        `${reading.name}: source protects the opener`,
      );
      assert.match(citation.label, /opens in a new tab/);
      assert.equal(
        citation.cite,
        citation.href,
        `${reading.name}: blockquote matches its citation`,
      );
      await closeWithButton(reading);

      await clickSceneTrigger(reading);
      await page.keyboard.press('Escape');
      assert.equal(await isOpen(reading), false, `${reading.name}: Escape dismisses the dialog`);
      assert.equal(await focused(reading.trigger), true, `${reading.name}: Escape restores focus`);

      await clickSceneTrigger(reading);
      await page.click(`${reading.dialog} h2`);
      assert.equal(await isOpen(reading), true, `${reading.name}: card clicks leave dialog open`);
      const backdrop = await page.$eval(reading.dialog, (dialog) => {
        const bounds = dialog.getBoundingClientRect();
        return { x: bounds.left - 8, y: bounds.top + bounds.height / 2 };
      });
      await page.mouse.click(backdrop.x, backdrop.y);
      assert.equal(await isOpen(reading), false, `${reading.name}: backdrop dismisses the dialog`);
      assert.equal(
        await focused(reading.trigger),
        true,
        `${reading.name}: backdrop restores focus`,
      );

      await page.click('.painting-toggle');
      await clickSceneTrigger(reading);
      await page.keyboard.press('Escape');
      assert.equal(await isOpen(reading), false, `${reading.name}: Escape closes modal above safe`);
      assert.equal(
        await page.$eval('.painting-toggle', (button) => button.getAttribute('aria-expanded')),
        'true',
        `${reading.name}: the same Escape leaves the safe open`,
      );
      await page.keyboard.press('Escape');
      assert.equal(
        await page.$eval('.painting-toggle', (button) => button.getAttribute('aria-expanded')),
        'false',
        `${reading.name}: the next Escape closes the safe`,
      );
    }

    const viewports = [
      { width: 320, height: 568, isMobile: true, hasTouch: true },
      { width: 390, height: 844, isMobile: true, hasTouch: true },
      { width: 568, height: 320, isMobile: true, hasTouch: true },
      { width: 768, height: 1024, hasTouch: true },
      { width: 1440, height: 900 },
    ];
    const checkedHome = new Set();
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
        for (const reading of readings) {
          const label = `${reading.name} ${viewport.width}×${viewport.height} ${night ? 'night' : 'day'}`;
          await clickSceneTrigger(reading);
          const cycle = new Set();
          for (let i = 0; i < reading.count; i++) {
            cycle.add(await quote(reading));
            assert.equal(
              await page.$eval(control(reading, 'passage'), (passage) => passage.scrollTop),
              0,
              `${label}: each quote starts at the top of its passage`,
            );
            await assertCardFits(reading, label);
            if (
              await page.$eval(
                control(reading, 'passage'),
                (passage) => passage.scrollHeight > passage.clientHeight + 1,
              )
            ) {
              await page.focus(control(reading, 'passage'));
              await page.keyboard.press('End');
              await page
                .waitForFunction(
                  (selector) => {
                    const passage = document.querySelector(selector);
                    const source = passage.querySelector('.quote-source');
                    const bounds = source.getBoundingClientRect();
                    return (
                      passage.scrollTop > 0 &&
                      bounds.bottom <= passage.getBoundingClientRect().bottom + 1 &&
                      source.contains(
                        document.elementFromPoint(
                          bounds.left + bounds.width / 2,
                          bounds.top + bounds.height / 2,
                        ),
                      )
                    );
                  },
                  {},
                  control(reading, 'passage'),
                )
                .catch(async (error) => {
                  const details = await page.$eval(control(reading, 'passage'), (passage) => {
                    const source = passage.querySelector('.quote-source');
                    const bounds = source.getBoundingClientRect();
                    return {
                      quote: passage.textContent.trim(),
                      scrollTop: passage.scrollTop,
                      scrollHeight: passage.scrollHeight,
                      clientHeight: passage.clientHeight,
                      focused: passage === document.activeElement,
                      source: bounds.toJSON(),
                      passage: passage.getBoundingClientRect().toJSON(),
                      hit: document.elementFromPoint(
                        bounds.left + bounds.width / 2,
                        bounds.top + bounds.height / 2,
                      )?.outerHTML,
                      fonts: document.fonts.status,
                    };
                  });
                  await page.screenshot({ path: artifactPath('quote-scroll-failure.png') });
                  throw new Error(
                    `${label}: End must reveal the citation. ${JSON.stringify(details)}`,
                    { cause: error },
                  );
                });
              if (!checkedHome.has(reading.name)) {
                await page.keyboard.press('Home');
                await page.waitForFunction(
                  (selector) => document.querySelector(selector).scrollTop === 0,
                  {},
                  control(reading, 'passage'),
                );
                // Leave the passage at its end so the following quote still
                // exercises the application's reset-to-top behavior.
                await page.keyboard.press('End');
                await page.waitForFunction(
                  (selector) => {
                    const passage = document.querySelector(selector);
                    return (
                      passage.scrollTop > 0 &&
                      Math.abs(passage.scrollHeight - passage.clientHeight - passage.scrollTop) <= 1
                    );
                  },
                  {},
                  control(reading, 'passage'),
                );
                checkedHome.add(reading.name);
              }
            }
            if (i < reading.count - 1) await page.click(control(reading, 'next'));
          }
          assert.equal(cycle.size, reading.count, `${label}: all quote lengths fit`);
          await closeWithButton(reading);
        }
      }
    }
    assert.equal(checkedHome.size, readings.length, 'Both reading cards support Home after End');
    assert.deepEqual(errors, [], 'No browser errors or failed asset requests');
    console.log(
      'Meditations / Art of War: distinct scene objects, shuffled quotes, citations, modal keyboard/dismissal, and 10 responsive theme layouts passed.',
    );
  } finally {
    await closeBrowser(browser);
  }
});

const { mkdir } = require('node:fs/promises');
const { once } = require('node:events');
const { dirname, resolve } = require('node:path');
const { parseArgs } = require('node:util');
const { launchBrowser, closeBrowser } = require('./browser.cjs');

async function renderPreview(asset, draw) {
  const { values } = parseArgs({
    options: { 'site-url': { type: 'string' }, output: { type: 'string' } },
  });
  const output = resolve(
    values.output ||
      process.env.PREVIEW_OUTPUT ||
      resolve(__dirname, '../../assets', asset, 'preview.webp'),
  );
  let baseURL = values['site-url'] || process.env.SITE_URL;
  let server;
  let browser;
  try {
    if (!baseURL) {
      const { createSiteServer } = await import('../serve.js');
      server = createSiteServer();
      server.listen(0, '127.0.0.1');
      await once(server, 'listening');
      baseURL = `http://127.0.0.1:${server.address().port}/`;
    }
    await mkdir(dirname(output), { recursive: true });
    browser = await launchBrowser();
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('response', (response) => {
      if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
    });
    await page.setViewport({ width: 1200, height: 600, deviceScaleFactor: 1 });
    await page.goto(new URL('index.html', baseURL).href, { waitUntil: 'networkidle0' });
    // Stop the original page's lifecycle before replacing it with a static render.
    await page.evaluate(() =>
      window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })),
    );
    await page.evaluate(draw);
    if (errors.length) throw new Error(errors.join('\n'));
    await page.screenshot({ path: output, type: 'webp', quality: 92 });
    console.log(`Rendered ${output} (1200 × 600)`);
  } finally {
    try {
      if (browser) await closeBrowser(browser);
    } finally {
      if (server) {
        server.closeAllConnections();
        await new Promise((done) => server.close(done));
      }
    }
  }
}
module.exports = { renderPreview };

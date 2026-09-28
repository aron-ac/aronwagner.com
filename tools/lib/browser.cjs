const { pathToFileURL } = require('node:url');

async function launchBrowser() {
  const resolved = require.resolve(process.env.PUPPETEER_MODULE || 'puppeteer');
  const imported = await import(pathToFileURL(resolved).href);
  const puppeteer = imported.default || imported;
  const browser = await puppeteer.launch({
    headless: true,
    // Explicit opt-in for trusted local pages on GPU-less CI runners. Keep the
    // browser sandbox and real WebGL rendering; local runs use the native GPU.
    ...(process.env.BROWSER_SOFTWARE_RENDERING === '1'
      ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }
      : {}),
    ...(process.env.CHROME_BIN ? { executablePath: process.env.CHROME_BIN } : {}),
  });
  // On macOS, an orphaned Chrome crash reporter can inherit stderr and keep
  // Node alive after the browser exits. Release only this child's own pipes.
  const child = browser.process();
  child?.once('exit', () => {
    for (const stream of child.stdio) stream?.destroy();
  });
  return browser;
}

async function closeBrowser(browser) {
  let timeout;
  try {
    await Promise.race([
      browser.close(),
      new Promise((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error('Test browser did not shut down within 10 seconds')),
          10_000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timeout);
    const child = browser.process();
    if (child && child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    for (const stream of child?.stdio || []) stream?.destroy();
  }
}

module.exports = { launchBrowser, closeBrowser };

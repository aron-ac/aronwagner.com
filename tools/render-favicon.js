import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { launchBrowser, closeBrowser } from './lib/browser.cjs';

const root = new URL('../', import.meta.url);
const source = await readFile(new URL('assets/favicon.svg', root), 'utf8');
const browser = await launchBrowser();

try {
  const page = await browser.newPage();
  const images = await page.evaluate(async (svg) => {
    const image = new Image();
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    await image.decode();
    return [16, 32, 48, 180].map((size) => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const context = canvas.getContext('2d');
      // iOS supplies its own corner mask; give its home-screen icon an opaque base.
      if (size === 180) {
        context.fillStyle = '#152d34';
        context.fillRect(0, 0, size, size);
      }
      context.drawImage(image, 0, 0, size, size);
      return { size, png: canvas.toDataURL('image/png').split(',')[1] };
    });
  }, source);

  const icons = images.map(({ size, png }) => ({ size, bytes: Buffer.from(png, 'base64') }));
  for (const { size, bytes } of icons) {
    if (size === 16) continue;
    const filename = size === 180 ? 'apple-touch-icon.png' : `favicon-${size}.png`;
    await writeFile(new URL(`assets/${filename}`, root), bytes);
    console.log(`Rendered assets/${filename} (${size} × ${size}, ${bytes.length} bytes)`);
  }

  // ICO supports PNG frames: retain native 16, 32, and 48px choices for browsers.
  const frames = icons.filter(({ size }) => size < 180);
  const header = Buffer.alloc(6 + frames.length * 16);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(frames.length, 4);
  let offset = header.length;
  frames.forEach(({ size, bytes }, index) => {
    const entry = 6 + index * 16;
    header[entry] = header[entry + 1] = size;
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(bytes.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += bytes.length;
  });
  const ico = Buffer.concat([header, ...frames.map(({ bytes }) => bytes)]);
  await writeFile(new URL('favicon.ico', root), ico);
  console.log(`Rendered favicon.ico (16, 32, 48px frames, ${ico.length} bytes)`);

  // Optional visual review sheet, deliberately outside the deployment asset list.
  if (process.env.FAVICON_PREVIEW) {
    const iconUrl = `data:image/svg+xml;base64,${Buffer.from(source).toString('base64')}`;
    await page.setViewport({ width: 720, height: 340, deviceScaleFactor: 1 });
    await page.setContent(`<!doctype html><style>
      * { box-sizing: border-box; }
      body { margin: 0; background: #f8f3ec; color: #152d34; font: 14px system-ui; }
      main { display: flex; gap: 40px; align-items: center; padding: 50px; }
      figure { margin: 0; text-align: center; }
      figcaption { margin-top: 20px; }
      .dark { padding: 24px; border-radius: 16px; background: #20252b; color: white; }
    </style><main>
      ${[16, 32, 180]
        .map(
          (size) => `<figure><img src="${iconUrl}" width="${size}" height="${size}">
          <figcaption>${size}px</figcaption></figure>`,
        )
        .join('')}
      <figure class="dark"><img src="${iconUrl}" width="32" height="32">
        <figcaption>Dark tab</figcaption></figure>
    </main>`);
    await page.evaluate(() => Promise.all([...document.images].map((image) => image.decode())));
    await page.screenshot({ path: process.env.FAVICON_PREVIEW });
    console.log(`Preview: ${process.env.FAVICON_PREVIEW}`);
  }
} finally {
  await closeBrowser(browser);
}

console.log(`Source: ${fileURLToPath(new URL('assets/favicon.svg', root))}`);

import { once } from 'node:events';
import { mkdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createSiteServer } from './serve.js';
import { launchBrowser, closeBrowser } from './lib/browser.cjs';

// Render the existing scene and game artwork so shared links match the actual site.
const output = fileURLToPath(new URL('../assets/social/', import.meta.url));
const server = createSiteServer();
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const origin = `http://127.0.0.1:${server.address().port}/`;
let browser;
try {
  await mkdir(output, { recursive: true });
  browser = await launchBrowser();
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.goto(origin, { waitUntil: 'networkidle0' });
  // Identity comes from the homepage itself so the cards never drift from the business card.
  const identity = await page.evaluate(() => ({
    name: document.querySelector('#business-card-name').textContent.trim(),
    role: document.querySelector('#business-card-title').textContent.trim(),
    domain: new URL(document.querySelector('link[rel="canonical"]').href).host,
  }));
  const [firstName, ...otherNames] = identity.name.split(' ');
  await page.evaluate(
    ({ identity, firstName, otherNames }) => {
      // Freeze a daytime scene regardless of the scheduled theme or local preference.
      window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
      document.documentElement.classList.remove('night');
      const scene = document.querySelector('.scene');
      scene
        .querySelectorAll('.scene-hotspot, .label, .sr-only')
        .forEach((element) => element.remove());
      document.body.replaceChildren();
      const card = document.createElement('div');
      card.className = 'social-card';
      card.innerHTML = `
      <div class="social-brand"><img src="assets/favicon.svg" alt="" /><span></span></div>
      <div class="social-copy">
        <h1><span class="social-first"></span><br><span class="social-last"></span><span class="social-dot">.</span></h1>
        <p class="social-role"></p>
        <div class="social-rule"></div>
        <p class="social-welcome">Make yourself<br>at home.</p>
      </div>`;
      card.querySelector('.social-brand span').textContent = identity.domain.toUpperCase();
      card.querySelector('.social-first').textContent = firstName;
      card.querySelector('.social-last').textContent = otherNames.join(' ');
      card.querySelector('.social-role').textContent = identity.role;
      const illustration = document.createElement('div');
      illustration.className = 'social-illustration';
      illustration.append(scene);
      card.append(illustration);
      document.body.append(card);
      const style = document.createElement('style');
      style.textContent = `
      html,body{width:1200px;height:630px;overflow:hidden;scroll-behavior:auto!important}
      *,*::before,*::after{animation:none!important;transition:none!important}
      .social-card{position:relative;width:1200px;height:630px;background:#f8f3ec;color:#19373d;overflow:hidden}
      .social-card::after{content:"";position:absolute;inset:20px;border:1px solid #19373d20;border-radius:22px;pointer-events:none}
      .social-brand{position:absolute;top:58px;left:62px;display:flex;align-items:center;gap:15px;font:700 13px/1 Arial,sans-serif;letter-spacing:2px;z-index:2}
      .social-brand img{width:44px;height:44px}
      .social-copy{position:absolute;left:62px;top:184px;z-index:2}
      .social-copy h1{font:300 62px/1.18 Merriweather,Georgia,serif;letter-spacing:-2px;margin:0}
      .social-copy h1 .social-dot{color:#6d9989}
      .social-role{font:18px/1.5 Arial,sans-serif;color:#57716b;margin:21px 0 0}
      .social-rule{width:54px;height:3px;background:#9bb8a7;margin-top:33px;border-radius:2px}
      .social-welcome{font:36px/1.08 Caveat,cursive;color:#57716b;margin:20px 0 0}
      .social-illustration{position:absolute;width:830px;left:389px;top:56px;container-type:inline-size}
      .social-illustration .scene{width:100%}
    `;
      document.head.append(style);
    },
    { identity, firstName, otherNames },
  );
  await ready(page);
  await save(page, 'aron-wagner-og.jpg');

  for (const game of [
    {
      file: 'surf-riders',
      image: 'surf-rides',
      title: 'Surf Riders',
      description: 'Pick up surfers. Chase the swell to Playa Guiones.',
    },
    {
      file: 'bay-racer',
      image: 'bay-racer',
      title: 'Bay Racer',
      description: 'Three laps. Your Sea-Doo. One more shot at your best time.',
    },
    {
      file: 'maggies-toy-run',
      image: 'maggies-toy-run',
      title: 'Maggie’s Toy Run',
      description: 'Grab the tennis balls. Dodge bath time. Be a very good girl.',
    },
    {
      file: 'aisle-dash',
      image: 'aisle-dash',
      title: 'Aisle Dash',
      description: 'Keep Rebecca happy. Keep the budget alive. Get home before Jack calls it.',
    },
  ]) {
    await page.evaluate(
      ({ game, arcade, domain }) => {
        const card = document.querySelector('.social-card');
        card.className = 'social-card game-social-card';
        card.innerHTML = `
        <img class="social-game-art" src="assets/${game.image}/preview.webp" alt="" />
        <div class="social-shade"></div>
        <div class="social-brand"><img src="assets/favicon.svg" alt="" /><span></span></div>
        <span class="social-play">PLAY IN YOUR BROWSER</span>
        <div class="social-game-copy"><h1></h1><p></p></div>
        <span class="social-domain"></span>`;
        card.querySelector('.social-brand span').textContent = arcade;
        card.querySelector('.social-domain').textContent = domain;
        card.querySelector('h1').textContent = game.title;
        card.querySelector('p').textContent = game.description;
        const style = document.createElement('style');
        style.textContent = `
        .social-game-art{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
        .social-shade{position:absolute;inset:0;background:linear-gradient(180deg,#102b3630,transparent 30%,#102b3600 42%,#102b36eb 100%)}
        .game-social-card::after{border-color:#fff4}
        .game-social-card .social-brand{top:46px;color:#fffef4;text-shadow:0 1px 5px #102b3650}
        .social-play{position:absolute;top:63px;right:62px;font:700 12px/1 Arial,sans-serif;letter-spacing:2px;color:#102b36}
        .social-game-copy{position:absolute;left:62px;bottom:62px;color:#fffef4}
        .social-game-copy h1{font:400 78px/1.05 'Caveat Brush',cursive;letter-spacing:-1px;margin:0 0 12px}
        .social-game-copy p{font:20px/1.5 Arial,sans-serif;color:#e6efdf;margin:0}
        .social-domain{position:absolute;right:62px;bottom:69px;font:12px/1 Arial,sans-serif;letter-spacing:1px;color:#ccdecf}
      `;
        document.head.append(style);
      },
      { game, arcade: `${firstName.toUpperCase()}’S ARCADE`, domain: identity.domain },
    );
    await ready(page);
    await save(page, `${game.file}-og.jpg`);
  }
} finally {
  if (browser) await closeBrowser(browser);
  server.closeAllConnections();
  server.close();
}

async function ready(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((image) => image.decode()));
    // Includes mask images and SVG image references in the homepage scene.
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  await page.waitForNetworkIdle();
}

async function save(page, filename) {
  const path = join(output, filename);
  await page.screenshot({ path, type: 'jpeg', quality: 92 });
  console.log(`Rendered ${filename}: 1200×630, ${Math.round((await stat(path)).size / 1024)} KiB`);
}

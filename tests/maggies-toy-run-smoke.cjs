const { test } = require('node:test');
/* Serve the repo, then run with optional PUPPETEER_MODULE, CHROME_BIN and GAME_URL. */
const assert = require('node:assert/strict');
const { launchBrowser, closeBrowser, artifactPath, settlePage } = require('./helpers/browser.cjs');
const url = new URL(
  process.env.GAME_URL ||
    new URL('maggies-toy-run.html', process.env.SITE_URL || 'http://localhost:8000/').href,
);
url.searchParams.set('debug', '1');

async function exerciseMobileGestures(page) {
  const center = async (selector) =>
    page.$eval(selector, (element) => {
      const r = element.getBoundingClientRect();
      return {
        x: r.x + r.width / 2,
        y: r.y + r.height / 2,
        top: r.top,
        left: r.left,
        right: r.right,
      };
    });
  const left = await center('[data-control="left"]');
  const right = await center('[data-control="right"]');
  const gap = { x: (left.right + right.left) / 2, y: right.y };
  const miss = { x: gap.x, y: right.top - 18 };
  const metrics = () =>
    page.evaluate(() => ({
      scale: visualViewport.scale,
      selection: getSelection().toString(),
      x: scrollX,
      y: scrollY,
    }));
  const before = await metrics();
  const frame = () => page.evaluate(() => new Promise(requestAnimationFrame));
  for (const point of [left, right, gap, miss]) {
    await page.touchscreen.tap(point.x, point.y);
    await frame();
    await page.touchscreen.tap(point.x, point.y);
  }
  const held = await page.touchscreen.touchStart(right.x, right.y);
  // Long-press selection requires elapsed wall time, rather than simulated game ticks.
  await page.evaluate(() => new Promise((done) => setTimeout(done, 650)));
  await held.end();
  const client = await page.createCDPSession();
  const pinch = async ({ x, y }) => {
    const points = (distance) => [
      { x: x - distance, y, id: 1 },
      { x: x + distance, y, id: 2 },
    ];
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(20) });
    for (let distance = 30; distance <= 70; distance += 10) {
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: points(distance),
      });
      await frame();
    }
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await frame();
  };
  try {
    await pinch(miss);
    const after = await metrics();
    assert.equal(after.selection, '', 'Rapid taps and a held arrow do not select game text');
    assert.ok(
      Math.abs(after.scale - before.scale) < 0.01,
      'Near-miss taps and pinch gestures do not zoom active play',
    );
    assert.equal(after.x, before.x, 'Touch controls do not pan the page horizontally');
    assert.equal(after.y, before.y, 'Touch controls do not pan the page vertically');
    assert.equal(await page.$$eval('[data-control].pressed', (buttons) => buttons.length), 0);

    await page.tap('#pause');
    assert.equal(await page.evaluate(() => maggieDebug.state.mode), 'paused');
    const menu = await page.$eval('#overlay', (element) => {
      const r = element.getBoundingClientRect();
      return {
        x: r.left + r.width / 2,
        y: r.top + r.height / 2,
        bottom: r.bottom,
        overflow: element.scrollHeight > element.clientHeight + 1,
      };
    });
    if (menu.overflow) {
      const finger = await page.touchscreen.touchStart(menu.x, menu.bottom - 25);
      for (let step = 1; step <= 6; step++) {
        await finger.move(menu.x, menu.bottom - 25 - step * 20);
        await frame();
      }
      await finger.end();
      await page.waitForFunction(() => document.querySelector('#overlay').scrollTop > 0);
    }
    // Positive control: the same native gesture must zoom the paused menu,
    // proving the active-play check is not passing because touch emulation is inert.
    await pinch(menu);
    assert.ok(
      (await metrics()).scale > before.scale + 0.1,
      'Paused menus retain native pinch zoom',
    );
  } finally {
    await client.send('Emulation.setPageScaleFactor', { pageScaleFactor: before.scale });
    await client.detach();
  }
  await page.$eval('#overlay', (element) => {
    element.scrollTop = 0;
  });
  await page.click('#start');
}

async function exerciseMobilePause(page) {
  await page.evaluate(() => maggieDebug.startGame());
  const right = await (await page.$('[data-control="right"]')).boundingBox();
  const finger = await page.touchscreen.touchStart(
    right.x + right.width / 2,
    right.y + right.height / 2,
  );
  assert.ok(
    await page.evaluate(() => {
      for (let i = 0; i < 12; i++) maggieDebug.update(1 / 120);
      return maggieDebug.state.player.vx > 0;
    }),
    'The first finger is moving Maggie before the second finger pauses',
  );
  await page.tap('#pause');
  assert.equal(
    await page.evaluate(() => maggieDebug.state.mode),
    'paused',
    'A second finger pauses Maggie while a movement arrow remains held',
  );
  await finger.end();
  assert.equal(
    await page.evaluate(() => maggieDebug.state.mode),
    'paused',
    'Lifting the old movement finger cannot activate the newly exposed menu',
  );
  assert.equal(
    await page.$$eval('[data-control].pressed', (buttons) => buttons.length),
    0,
    'Pausing clears all pressed movement controls',
  );
  await page.tap('#start');
  assert.ok(
    await page.evaluate(() => {
      for (let i = 0; i < 120; i++) maggieDebug.update(1 / 120);
      return maggieDebug.state.mode === 'playing' && Math.abs(maggieDebug.state.player.vx) < 0.1;
    }),
    'Resuming cannot reactivate the old movement finger',
  );
  await page.focus('#pause');
  await page.keyboard.press('Enter');
  assert.equal(
    await page.evaluate(() => maggieDebug.state.mode),
    'paused',
    'Keyboard activation of the Pause button is preserved',
  );
  await page.click('#start');
  await page.click('#pause');
  assert.equal(
    await page.evaluate(() => maggieDebug.state.mode),
    'paused',
    'Mouse activation of the Pause button is preserved',
  );
  await page.click('#start');
}

test('maggies toy run smoke', { timeout: 300_000 }, async () => {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage(),
      errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('response', (response) => {
      if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
    });
    await page.setViewport({ width: 1440, height: 1000 });
    await page.goto(url.href, { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => window.maggieDebug);
    assert.match(await page.title(), /Maggie[’']s Toy Run/);
    const links = await page.$$eval('a[href]', (els) =>
      els
        .filter((el) => !el.getAttribute('href').startsWith('#'))
        .map((el) => ({ href: el.getAttribute('href'), target: el.target, rel: [...el.relList] })),
    );
    assert.ok(links.length > 0, 'Game provides navigation links');
    for (const link of links) {
      assert.equal(link.target, '_blank');
      assert.ok(
        link.rel.includes('noopener') && link.rel.includes('noreferrer'),
        `${link.href} protects its originating tab`,
      );
    }
    await page.screenshot({ path: artifactPath('maggies-toy-run-menu-desktop.png') });
    const mechanical = await page.evaluate(() => {
      const d = maggieDebug,
        s = d.state,
        results = [];
      const check = (condition, label) => {
        if (!condition) throw new Error(label);
        results.push(label);
      };
      const step = (seconds) => {
        for (let i = 0; i < Math.ceil(seconds * 120); i++) d.update(1 / 120);
      };
      const place = (x, y, extra = {}) => {
        d.clearInput();
        s.jumpHeld = false;
        Object.assign(
          s.player,
          { x, y, vx: 0, vy: 0, onGround: false, invulnerable: 0, coyote: 0, jumpBuffer: 0 },
          extra,
        );
      };
      const ground = () => d.level.platforms.find((platform) => platform.kind === 'ground');
      d.startGame();
      check(
        s.mode === 'playing' && s.hearts === 3 && s.balls === 0 && s.score === 0,
        'A fresh adventure starts with three hearts and no collected balls',
      );
      place(100, ground().y - s.player.h - 1, { vy: 180 });
      step(1 / 60);
      check(
        s.player.onGround &&
          Math.abs(s.player.y - (ground().y - s.player.h)) < 0.01 &&
          s.player.vy === 0,
        'Descending onto ground lands Maggie without sinking',
      );
      d.keys.add('Space');
      step(1 / 60);
      d.keys.delete('Space');
      step(1 / 120);
      check(s.player.vy < 0 && s.player.vy >= -240, 'Releasing jump early produces a shorter hop');
      d.startGame();
      place(ground().x + ground().w - s.player.w - 2, ground().y - s.player.h);
      step(1 / 120);
      s.player.x = ground().x + ground().w + 2;
      step(0.04);
      check(
        !s.player.onGround && s.player.coyote > 0,
        'Running off an edge keeps a brief coyote window',
      );
      d.keys.add('Space');
      step(1 / 120);
      d.clearInput();
      check(s.player.vy < -400, 'Jumping just after leaving an edge still works');
      d.startGame();
      place(100, ground().y - s.player.h - 8, { vy: 300 });
      d.keys.add('Space');
      step(1 / 120);
      d.keys.delete('Space');
      step(0.065);
      check(
        s.player.vy < 0 && !s.player.onGround && s.player.y < ground().y - s.player.h,
        'A jump pressed just before landing is buffered into the next hop',
      );
      d.startGame();
      const ledge = d.level.platforms.find((platform) => platform.kind === 'platform');
      place(ledge.x + 20, ledge.y + 5, { vy: -400 });
      step(0.08);
      check(
        s.player.y < ledge.y + 5 && s.player.vy < 0,
        'Maggie can jump upward through an optional one-way ledge',
      );
      place(ledge.x + 20, ledge.y - s.player.h - 1, { vy: 180 });
      step(1 / 60);
      check(
        s.player.onGround && Math.abs(s.player.y - (ledge.y - s.player.h)) < 0.01,
        'Descending onto an optional ledge lands on its top',
      );
      const wall = d.level.platforms.filter((platform) => platform.kind === 'ground')[1];
      place(wall.x - s.player.w - 1, wall.y + 8, { vx: 260 });
      d.keys.add('KeyD');
      step(1 / 30);
      d.clearInput();
      check(
        s.player.x + s.player.w <= wall.x + 0.01,
        'Maggie cannot run through the side of solid ground',
      );
      d.startGame();
      const ball = d.level.balls[0];
      place(ball.x - s.player.w / 2, ball.y - s.player.h / 2);
      step(1 / 120);
      check(
        ball.collected && s.balls === 1 && s.score === 10,
        'Touching a ball collects it for ten points',
      );
      step(0.1);
      check(s.balls === 1 && s.score === 10, 'A collected ball cannot score twice');
      d.startGame();
      let bubble = d.level.bubbles[0];
      place(bubble.x, bubble.y, { vy: 0 });
      step(1 / 120);
      check(
        s.hearts === 2 && s.player.invulnerable > 0,
        'A side hit from a bubble costs one heart and grants recovery time',
      );
      Object.assign(s.player, { x: bubble.x, y: bubble.y, vx: 0, vy: 0 });
      step(0.1);
      check(s.hearts === 2, 'Recovery invulnerability prevents repeated contact damage');
      d.startGame();
      bubble = d.level.bubbles[0];
      place(bubble.x, bubble.y - s.player.h - 1, { vy: 180 });
      step(1 / 60);
      check(
        s.hearts === 3 && s.bounces === 1 && s.score === 25 && s.player.vy < 0 && bubble.popped > 0,
        'Landing on a bubble bounces Maggie, pops it and awards twenty-five points',
      );
      place(d.level.spawn.x, d.level.spawn.y);
      step(3.1);
      place(bubble.x, bubble.y - s.player.h - 1, { vy: 180 });
      step(1 / 60);
      check(s.score === 25, 'Bouncing on the same bubble again does not farm points');
      d.startGame();
      place(d.level.spawn.x, 580);
      step(1 / 120);
      const savedBall = d.level.balls[0];
      place(savedBall.x - s.player.w / 2, savedBall.y - s.player.h / 2);
      step(1 / 120);
      const checkpoint = d.level.checkpoints[0];
      place(checkpoint.x - s.player.w / 2, checkpoint.y);
      step(1 / 120);
      check(
        checkpoint.active && s.checkpointId === checkpoint.id && s.hearts === 3 && s.score === 60,
        'Reaching a checkpoint saves its anchor, restores a heart and awards fifty points',
      );
      place(s.player.x, 580);
      step(1 / 120);
      check(
        s.hearts === 2 &&
          Math.abs(s.player.x - s.respawn.x) < 1 &&
          Math.abs(s.player.y - s.respawn.y) < 1,
        'Falling into a pit loses one heart and returns to the checkpoint',
      );
      check(
        s.balls === 1 && s.score === 60 && savedBall.collected,
        'Checkpoint recovery preserves collected balls and score',
      );
      place(s.player.x, 580);
      step(1 / 120);
      place(s.player.x, 580);
      step(1 / 120);
      check(s.hearts === 0 && s.mode === 'lost', 'Losing all three hearts ends the adventure');
      const stopped = { x: s.player.x, y: s.player.y, elapsed: s.elapsed };
      d.keys.add('KeyD');
      step(0.3);
      d.clearInput();
      check(
        s.player.x === stopped.x && s.player.y === stopped.y && s.elapsed === stopped.elapsed,
        'Game over freezes movement and elapsed time',
      );
      check(
        localStorage.getItem('maggies-toy-run-best-score') === null,
        'An unfinished adventure does not save a completion record',
      );
      d.startGame();
      check(
        s.hearts === 3 &&
          s.score === 0 &&
          s.balls === 0 &&
          s.checkpointId === null &&
          d.level.balls.every((item) => !item.collected) &&
          d.level.checkpoints.every((item) => !item.active),
        'Restart restores hearts, balls and checkpoint flags',
      );
      step(0.2);
      d.pauseGame();
      const paused = {
        x: s.player.x,
        y: s.player.y,
        time: s.elapsed,
        enemies: d.level.bubbles.map((enemy) => enemy.x),
      };
      step(0.5);
      check(
        s.mode === 'paused' &&
          s.player.x === paused.x &&
          s.player.y === paused.y &&
          s.elapsed === paused.time &&
          d.level.bubbles.every((enemy, i) => enemy.x === paused.enemies[i]),
        'Pause freezes Maggie, bubbles and the timer',
      );
      d.resumeGame();
      check(s.mode === 'playing', 'Resume returns to the adventure');
      place(d.level.finish.x + 10, d.level.finish.y + d.level.finish.h - s.player.h);
      step(1 / 120);
      check(
        s.mode === 'won' && s.score === 175,
        'Reaching home wins with the finish and remaining-heart bonuses',
      );
      const winScore = s.score;
      step(0.2);
      check(s.score === winScore, 'The finish bonus is awarded only once');
      check(
        Number(localStorage.getItem('maggies-toy-run-best-score')) === winScore,
        'Completed adventure saves its best score',
      );
      return results;
    });
    // Complete the entire route through real keyboard input. No player positions,
    // velocities, hearts or checkpoint values are edited in this playthrough.
    await page.click('#start');
    await page.keyboard.down('ArrowRight');
    let jumpHeld = false,
      jumpAt = 0,
      snapshot;
    const trace = [];
    for (let frame = 0; frame < 1800; frame++) {
      snapshot = await page.evaluate(() => {
        for (let i = 0; i < 4; i++) maggieDebug.update(1 / 120);
        const s = maggieDebug.state,
          p = s.player;
        const sections = maggieDebug.level.platforms
          .filter((platform) => platform.kind === 'ground')
          .sort((a, b) => a.x - b.x);
        const nextEdge = sections
          .slice(0, -1)
          .map((platform) => platform.x + platform.w)
          .find((edge) => edge > p.x);
        const enemies = maggieDebug.level.bubbles
          .filter((enemy) => enemy.popped <= 0 && enemy.x + enemy.w >= p.x && enemy.x < p.x + 220)
          .map((enemy) => enemy.x - (p.x + p.w));
        return {
          mode: s.mode,
          x: p.x,
          y: p.y,
          onGround: p.onGround,
          coyote: p.coyote,
          elapsed: s.elapsed,
          hearts: s.hearts,
          balls: s.balls,
          score: s.score,
          nextEdge,
          enemies,
        };
      });
      if (frame % 30 === 0)
        trace.push({
          x: Math.round(snapshot.x),
          y: Math.round(snapshot.y),
          hearts: snapshot.hearts,
        });
      if (snapshot.mode !== 'playing') break;
      if (jumpHeld && snapshot.elapsed - jumpAt > 0.43) {
        await page.keyboard.up('Space');
        jumpHeld = false;
      }
      const approachingGap = snapshot.nextEdge !== undefined && snapshot.nextEdge - snapshot.x < 80;
      const approachingBubble = snapshot.enemies.some(
        (distance) => distance < 66 && distance > -28,
      );
      if (
        !jumpHeld &&
        (snapshot.onGround || snapshot.coyote > 0) &&
        (approachingGap || approachingBubble)
      ) {
        await page.keyboard.down('Space');
        jumpHeld = true;
        jumpAt = snapshot.elapsed;
      }
    }
    await page.keyboard.up('Space');
    await page.keyboard.up('ArrowRight');
    if (snapshot.mode !== 'won') {
      await page.screenshot({ path: artifactPath('maggies-toy-run-playthrough-failure.png') });
      throw new Error(
        `Keyboard playthrough did not finish: ${JSON.stringify({ snapshot, trace })}`,
      );
    }
    assert.ok(snapshot.balls >= 5, 'Full keyboard playthrough collects balls along the route');
    assert.ok(snapshot.hearts > 0, 'Full keyboard playthrough reaches home with hearts remaining');
    assert.equal(
      await page.$eval('#results', (el) => el.classList.contains('hidden')),
      false,
      'Winning displays the results',
    );
    await settlePage(page);
    await page.screenshot({ path: artifactPath('maggies-toy-run-win.png') });
    const savedBest = await page.evaluate(() =>
      Number(localStorage.getItem('maggies-toy-run-best-score')),
    );
    await page.click('#start');
    await page.keyboard.down('KeyD');
    await page.evaluate(() => {
      for (let i = 0; i < 60; i++) maggieDebug.update(1 / 120);
    });
    await page.keyboard.up('KeyD');
    await page.keyboard.press('KeyP');
    assert.equal(await page.evaluate(() => maggieDebug.state.mode), 'paused');
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => maggieDebug.state.mode), 'playing');
    await page.screenshot({ path: artifactPath('maggies-toy-run-desktop.png') });
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 844, height: 390 },
    ]) {
      await page.setViewport({ ...viewport, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
      await page.goto(url.href, { waitUntil: 'networkidle0' });
      await page.waitForFunction(() => window.maggieDebug);
      assert.equal(
        await page.evaluate(() => Number(localStorage.getItem('maggies-toy-run-best-score'))),
        savedBest,
        'Completion record persists across reloads',
      );
      assert.ok(
        await page.$eval('#start', (el) => {
          const r = el.getBoundingClientRect();
          return r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight;
        }),
        'Mobile start button is visible without scrolling',
      );
      await page.click('#start');
      const layout = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > innerWidth,
        controls: [...document.querySelectorAll('[data-control]')].map((el) => {
          const r = el.getBoundingClientRect();
          return {
            x: r.x,
            y: r.y,
            right: r.right,
            bottom: r.bottom,
            width: r.width,
            height: r.height,
          };
        }),
      }));
      assert.equal(layout.overflow, false, 'No horizontal overflow on mobile');
      assert.ok(
        layout.controls.length === 3 &&
          layout.controls.every(
            (r) =>
              r.width > 0 &&
              r.height > 0 &&
              r.x >= 0 &&
              r.y >= 0 &&
              r.right <= viewport.width &&
              r.bottom <= viewport.height,
          ),
        'All three touch controls fit the viewport',
      );
      await exerciseMobileGestures(page);
      await exerciseMobilePause(page);
      const right = await (await page.$('[data-control="right"]')).boundingBox();
      const jump = await (await page.$('[data-control="jump"]')).boundingBox();
      const startX = await page.evaluate(() => maggieDebug.state.player.x);
      const moveTouch = await page.touchscreen.touchStart(
        right.x + right.width / 2,
        right.y + right.height / 2,
      );
      await page.evaluate(() => {
        for (let i = 0; i < 36; i++) maggieDebug.update(1 / 120);
      });
      assert.ok(
        await page.evaluate((x) => maggieDebug.state.player.x > x + 10, startX),
        'Touch direction moves Maggie',
      );
      const jumpTouch = await page.touchscreen.touchStart(
        jump.x + jump.width / 2,
        jump.y + jump.height / 2,
      );
      assert.ok(
        await page.evaluate(() => {
          for (let i = 0; i < 6; i++) maggieDebug.update(1 / 120);
          return maggieDebug.state.player.vy < 0;
        }),
        'Two fingers can move and jump together',
      );
      await jumpTouch.end();
      assert.ok(
        await page.$eval('[data-control="right"]', (el) => el.classList.contains('pressed')),
        'Releasing jump keeps the movement finger active',
      );
      await moveTouch.end();
      assert.equal(
        await page.$$eval('[data-control].pressed', (els) => els.length),
        0,
        'Releasing both fingers leaves no stuck controls',
      );
      // Capture only after touch checks; screenshots can alter Chromium's emulated input state.
      await page.screenshot({ path: artifactPath(`maggies-toy-run-${viewport.width}.png`) });
      await page.click('#pause');
      await page.screenshot({ path: artifactPath(`maggies-toy-run-menu-${viewport.width}.png`) });
    }
    assert.deepEqual(errors, [], 'No JavaScript errors or failed game assets');
    console.log(
      `PASS: ${mechanical.length} platform checks, full keyboard playthrough (${snapshot.balls} balls, ${snapshot.hearts} hearts), pause keys, multitouch, touch gesture protection and mobile layouts.\n${mechanical.join('\n')}`,
    );
  } finally {
    await closeBrowser(browser);
  }
});

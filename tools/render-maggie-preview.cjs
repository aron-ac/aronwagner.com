/* Render the homepage thumbnail with the game's native Canvas art and level. */
const { renderPreview } = require('./lib/preview.cjs');

renderPreview('maggies-toy-run', async () => {
  const art = await import('./assets/maggies-toy-run/art.js');
  const { createLevel } = await import('./assets/maggies-toy-run/level.js');
  const level = createLevel(),
    cameraX = 350,
    time = 1.2;
  document.body.replaceChildren();
  document.body.style = 'margin:0;overflow:hidden';
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 600;
  document.body.append(canvas);
  const ctx = canvas.getContext('2d');
  ctx.scale(1.2, 1.2);
  art.drawBackground(ctx, { cameraX, width: 1000, height: 500, time });
  ctx.save();
  ctx.translate(-cameraX, 0);
  for (const pool of level.pools) art.drawPool(ctx, pool, time);
  for (const platform of level.platforms) art.drawPlatform(ctx, platform);
  for (const ball of level.balls) art.drawBall(ctx, ball.x, ball.y, time);
  for (const bubble of level.bubbles) art.drawBubble(ctx, bubble, time);
  for (const checkpoint of level.checkpoints)
    art.drawCheckpoint(ctx, { ...checkpoint, y: checkpoint.y + 48 }, time);
  art.drawFinish(ctx, level.finish, time);
  art.drawMaggie(
    ctx,
    {
      x: 780,
      y: 264,
      w: 46,
      h: 48,
      vx: 260,
      vy: -60,
      facing: 1,
      onGround: false,
      invulnerable: 0,
    },
    time,
  );
  ctx.restore();
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

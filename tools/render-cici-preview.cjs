/* Render the homepage thumbnail with the game's native Canvas art and level. */
const { renderPreview } = require('./lib/preview.cjs');

renderPreview('cici-treat-trail', async () => {
  const art = await import('./assets/cici-treat-trail/art.js');
  const { createLevel } = await import('./assets/cici-treat-trail/level.js');
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
  for (const platform of level.platforms) art.drawPlatform(ctx, platform);
  for (const treat of level.treats) art.drawTreat(ctx, treat.x, treat.y, time);
  for (const squirrel of level.squirrels) art.drawSquirrel(ctx, squirrel, time);
  for (const checkpoint of level.checkpoints)
    art.drawCheckpoint(ctx, { ...checkpoint, y: checkpoint.y + 48 }, time);
  art.drawFinish(ctx, level.finish, time);
  art.drawCici(
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

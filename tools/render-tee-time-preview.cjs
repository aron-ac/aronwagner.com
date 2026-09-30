/* Render the homepage thumbnail with the game's own art, sprites and course. */
const { renderPreview } = require('./lib/preview.cjs');

renderPreview('tee-time', async () => {
  const art = await import('./assets/tee-time/art.js');
  const sprites = await import('./assets/tee-time/sprites.js');
  const { HOLES } = await import('./assets/tee-time/holes.js');
  const { groundAt, previewPath } = await import('./assets/tee-time/golf.js');
  const sheets = await sprites.loadSprites();
  const hole = HOLES[4],
    time = 1.4;
  document.body.replaceChildren();
  document.body.style = 'margin:0;overflow:hidden';
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 600;
  document.body.append(canvas);
  const ctx = canvas.getContext('2d');
  const view = { x: 0, y: 0, width: 1000, height: 600 };
  ctx.scale(1.2, 1.2);
  ctx.translate(0, -90);
  art.drawBackdrop(ctx, hole, view, time);
  art.drawProps(ctx, sheets, hole, view, { back: true });
  art.drawTerrain(ctx, hole, view, time);
  art.drawProps(ctx, sheets, hole, view, { back: false });
  // Stand a little farther from the edge than the real tee so Aron fits the frame.
  const tee = { x: 330, y: groundAt(hole, 330).y - 6 };
  const stance = sprites.aronStance(tee, 1, false);
  sprites.drawAron(ctx, sheets, { x: stance.x, y: stance.y, name: 'follow', facing: 1 });
  // The shot's arc out over the gator pond.
  const path = previewPath(hole, tee, -0.72, 0.8, false, 0.75);
  const ball = path[path.length - 1];
  art.drawBall(ctx, hole, { x: ball.x, y: ball.y }, path.slice(-10));
  const dogX = 560;
  sprites.drawMaggie(ctx, sheets, {
    x: dogX,
    y: groundAt(hole, dogX).y + 6,
    name: 'bow',
    facing: -1,
  });
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

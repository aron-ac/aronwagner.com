/* Render the homepage thumbnail with the game's own art, sprites and store layout. */
const { renderPreview } = require('./lib/preview.cjs');

renderPreview('aisle-dash', async () => {
  const art = await import('./assets/aisle-dash/art.js');
  const { loadSprites } = await import('./assets/aisle-dash/sprites.js');
  const { STORES } = await import('./assets/aisle-dash/stores.js');
  const sheets = await loadSprites();
  const store = STORES[0],
    time = 1.2;
  document.body.replaceChildren();
  document.body.style = 'margin:0;overflow:hidden';
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 600;
  document.body.append(canvas);
  const ctx = canvas.getContext('2d');
  const view = { x: 1330, y: 0, width: 1000, height: 500 };
  ctx.scale(1.2, 1.2);
  ctx.translate(0, -80);
  art.drawBackdrop(ctx, store, { ...view, height: 600 }, time);
  ctx.translate(-view.x, 0);
  art.drawFixtures(ctx, store, sheets, { ...view, height: 600 }, time);
  const rebecca = { x: 1720, facing: 1, moving: false, walked: 0, mood: null, holding: null };
  const aron = { x: 1520, vx: 200, facing: 1, walked: 40, carrying: null };
  art.drawRebeccaFigure(ctx, sheets, rebecca, { browsing: true });
  art.drawAronFigure(ctx, sheets, aron, { bags: 2, time });
  art.drawMoment(
    ctx,
    sheets,
    rebecca,
    {
      kind: 'want',
      name: 'Faux olive tree',
      price: 60,
      hearts: 3,
      icon: 'olive-tree',
      sale: true,
      expires: 6,
      duration: 9,
    },
    { now: 1, price: 42 },
  );
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

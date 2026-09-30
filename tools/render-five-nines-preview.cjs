/* Render the homepage thumbnail with the game's own art, sprites and row. */
const { renderPreview } = require('./lib/preview.cjs');

renderPreview('five-nines', async () => {
  const art = await import('./assets/five-nines/art.js');
  const { loadSprites } = await import('./assets/five-nines/sprites.js');
  const { RACKS } = await import('./assets/five-nines/floor.js');
  const sheets = await loadSprites();
  const time = 1.35;
  document.body.replaceChildren();
  document.body.style = 'margin:0;overflow:hidden';
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 600;
  document.body.append(canvas);
  const ctx = canvas.getContext('2d');
  const view = { x: 292, y: 0, width: 1200, height: 600 };
  ctx.translate(-view.x, 0);
  const rack = (id) => RACKS.find((r) => r.id === id);
  const states = {
    vms: { problem: { kind: 'cable', age: 3, limit: 0 } },
    object: { problem: { kind: 'fire', age: 4, limit: 0, fixed: 0.55 } },
    block: { problem: { kind: 'disk', age: 9, limit: 16 } },
    kubernetes: { problem: { kind: 'heat', age: 7, limit: 14 } },
  };
  art.drawRoom(ctx, view, time);
  art.drawScenery(ctx, sheets, 'back', view);
  for (const r of RACKS) art.drawRack(ctx, sheets, r, states[r.id], time);
  art.drawBoard(ctx, 99.962, states);
  art.drawTickets(
    ctx,
    sheets,
    [
      { who: 4, lines: ['Is WordPress down?', 'My knitting blog is.'], age: 6, limit: 20 },
      { who: 3, lines: ['Is Object Storage on', 'fire? Asking for a friend.'], age: 3, limit: 20 },
      { who: 0, lines: ['is it down', 'is it down now'], age: 17, limit: 20 },
    ],
    time,
  );
  const aron = { x: rack('object').x - 175, vx: 0, facing: 1, walked: 0, fixing: 'fire' };
  art.drawAronFigure(ctx, sheets, aron);
  art.drawFire(ctx, sheets, rack('object'), time);
  art.drawFoam(ctx, sheets, art.nozzle(aron), { x: rack('object').x, y: 300 }, time);
  art.drawScenery(ctx, sheets, 'front', view);
  art.drawPlacards(ctx, states);
  for (const [id, s] of Object.entries(states))
    art.drawProblemBubble(ctx, sheets, rack(id), s.problem, time);
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

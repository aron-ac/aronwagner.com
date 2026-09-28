// Original side-scrolling meadow course. Platforms use top-left coordinates;
// treat coordinates are their centers. Every call returns fresh mutable state.
export function createLevel() {
  const width = 6200;
  const groundTop = 420;
  const groundSections = [
    [0, 770],
    [865, 1510],
    [1610, 2305],
    [2415, 3040],
    [3140, 3750],
    [3860, 4590],
    [4690, 5330],
    [5435, width],
  ];
  const platforms = groundSections.map(([start, end], index) => ({
    id: `ground-${index + 1}`,
    x: start,
    y: groundTop,
    w: end - start,
    h: 180,
    kind: 'ground',
  }));

  // The main route stays at ground level; every raised route is optional.
  // These short stairs reward exploratory jumps without requiring a double jump.
  const upperRoute = [
    ['first-hop', 300, 340, 155],
    ['picnic-step', 1090, 330, 150],
    ['picnic-table', 1250, 245, 135],
    ['picnic-down', 1395, 330, 100],
    ['lookout', 1760, 332, 130],
    ['checkpoint-hop', 2140, 335, 135],
    ['garden-step', 2490, 340, 150],
    ['garden-rise', 2660, 252, 135],
    ['garden-top', 2820, 176, 150],
    ['garden-down', 3000, 265, 130],
    ['hill-step', 3250, 345, 145],
    ['hill-top', 3425, 265, 145],
    ['hill-down', 3600, 345, 140],
    ['orchard-step', 4215, 335, 140],
    ['orchard-top', 4390, 250, 125],
    ['orchard-down', 4540, 335, 125],
    ['treetop-step', 4800, 340, 120],
    ['treetop-rise', 4960, 255, 130],
    ['treetop-top', 5130, 175, 140],
    ['treetop-down', 5300, 270, 150],
    ['home-hop', 5510, 345, 120],
    ['last-hop', 5780, 335, 130],
  ];
  for (const [id, x, y, w] of upperRoute) {
    platforms.push({ id: `platform-${id}`, x, y, w, h: 20, kind: 'platform' });
  }

  const treats = [];
  const addTreat = (id, x, y) => treats.push({ id, x, y, collected: false });
  // Mouth-height treats can be collected while running along the safe ground.
  const groundTreats = [
    140, 220, 510, 700, 960, 1030, 1335, 1435, 1690, 1900, 1980, 2080, 2230, 2460, 2740, 2950, 3210,
    3520, 3685, 3960, 4040, 4160, 4330, 4510, 4760, 5090, 5240, 5490, 5735, 5850, 5900, 5930,
  ];
  groundTreats.forEach((x, index) => addTreat(`treat-ground-${index + 1}`, x, groundTop - 34));
  // Three-treat arcs illustrate the flight path over each mandatory gap. A
  // full-speed jump started about 70px before the gap can touch the whole arc.
  for (let index = 0; index < groundSections.length - 1; index++) {
    const left = groundSections[index][1];
    const right = groundSections[index + 1][0];
    addTreat(`treat-jump-${index + 1}-rise`, left + 8, 300);
    addTreat(`treat-jump-${index + 1}-peak`, (left + right) / 2, 280);
    addTreat(`treat-jump-${index + 1}-land`, right - 8, 312);
  }
  upperRoute.forEach(([id, x, y, w]) => addTreat(`treat-upper-${id}`, x + w / 2, y - 34));

  // Patrol endpoints refer to the squirrel's left edge. Every patrol remains
  // at least 80px from a pit and well clear of the spawn and checkpoint flags.
  const patrols = [
    [550, 480, 635, -44],
    [1200, 1135, 1300, 48],
    [1740, 1695, 1795, -42],
    [2570, 2525, 2665, 46],
    [3380, 3325, 3490, -50],
    [4380, 4340, 4450, 45],
    [4910, 4850, 5000, -47],
    [5620, 5580, 5700, 43],
  ];
  const squirrels = patrols.map(([x, patrolMin, patrolMax, vx], index) => ({
    id: `squirrel-${index + 1}`,
    x,
    y: groundTop - 34,
    w: 44,
    h: 34,
    vx,
    patrolMin,
    patrolMax,
    stunned: 0,
  }));
  // y is the standing player's top-left respawn height; flags may be drawn
  // above this anchor with their base at the 420px ground line.
  const checkpoints = [
    { id: 'checkpoint-picnic', x: 2025, y: groundTop - 48, active: false },
    { id: 'checkpoint-orchard', x: 4080, y: groundTop - 48, active: false },
  ];
  return {
    width,
    spawn: { x: 80, y: groundTop - 48 },
    platforms,
    treats,
    squirrels,
    checkpoints,
    finish: { x: width - 230, y: 280, w: 100, h: 140 },
  };
}

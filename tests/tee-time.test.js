import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BALL_RADIUS,
  DRIVE_SPEED,
  PUTT_SPEED,
  MATERIALS,
  MAX_STROKES,
  createRound,
  groundAt,
  inWater,
  scoreName,
  stepBall,
} from '../assets/tee-time/golf.js';
import { HOLES, TOTAL_PAR } from '../assets/tee-time/holes.js';
import { SPRITES } from '../assets/tee-time/sprite-data.js';

const STEP = 1 / 240;
function settle(hole, ball, wind = 0, seconds = 20) {
  for (let t = 0; t < seconds; t += STEP) {
    const result = stepBall(ball, hole, STEP, wind);
    if (result) return result;
  }
  return 'timeout';
}
const restingBall = (hole, x) => ({
  x,
  y: groundAt(hole, x).y - BALL_RADIUS,
  vx: 0,
  vy: 0,
  rolling: false,
  support: null,
});

test('nine holes, par 33, with ground that covers every hole end to end', () => {
  assert.equal(HOLES.length, 9);
  assert.equal(TOTAL_PAR, 33);
  for (const hole of HOLES) {
    assert.equal(hole.ground[0][0], 0, `${hole.name} starts at 0`);
    assert.equal(hole.ground.at(-1)[1], hole.length, `${hole.name} ends at its length`);
    for (let i = 1; i < hole.ground.length; i++) {
      const [prevFrom, prevTo, , , prevY] = hole.ground[i - 1];
      const [from, , material, y0] = hole.ground[i];
      assert.ok(prevTo > prevFrom);
      assert.equal(from, prevTo, `${hole.name}: runs are contiguous`);
      assert.equal(y0, prevY, `${hole.name}: no steps in the ground at ${from}`);
      assert.ok(MATERIALS[material], material);
    }
    const cup = groundAt(hole, hole.cup);
    assert.ok(MATERIALS[cup.material].green, `${hole.name}: the cup is on a green`);
    assert.equal(cup.slope, 0, `${hole.name}: the cup sits on flat ground`);
    assert.ok(!inWater(hole, hole.tee) && !inWater(hole, hole.cup));
    for (const item of [...(hole.props || []), ...(hole.solids || [])])
      assert.ok(SPRITES.props[item.prop || item.name], `${hole.name}: ${item.prop || item.name}`);
  }
});

test('score names', () => {
  assert.equal(scoreName(1, 3), 'Hole in one!');
  assert.equal(scoreName(2, 3), 'Birdie!');
  assert.equal(scoreName(3, 5), 'Eagle!');
  assert.equal(scoreName(4, 4), 'Par');
  assert.equal(scoreName(5, 4), 'Bogey');
  assert.equal(scoreName(6, 4), 'Double bogey');
  assert.equal(scoreName(8, 4), '+4');
});

test('a dropped ball bounces, rolls and settles on the fairway', () => {
  const hole = HOLES[3];
  const ball = { x: 500, y: 200, vx: 300, vy: 0, rolling: false, support: null };
  assert.equal(settle(hole, ball), 'rest');
  assert.ok(ball.x > 500);
  assert.ok(Math.abs(ball.y + BALL_RADIUS - groundAt(hole, ball.x).y) < 0.5);
});

test('sand stops a rolling ball far sooner than the green', () => {
  const hole = HOLES[3];
  const roll = (x) => {
    const ball = restingBall(hole, x);
    Object.assign(ball, { rolling: true, speed: 300 });
    settle(hole, ball);
    return Math.abs(ball.x - x);
  };
  assert.ok(roll(1490) < roll(2450) / 4, 'sand is slow and the green is fast');
});

test('a slow putt drops, a fast one hops the cup', () => {
  const hole = HOLES[3];
  const slow = restingBall(hole, hole.cup - 60);
  Object.assign(slow, { rolling: true, speed: 200 });
  assert.equal(settle(hole, slow), 'holed');
  const fast = restingBall(hole, hole.cup - 60);
  Object.assign(fast, { rolling: true, speed: 520 });
  const result = settle(hole, fast);
  assert.notEqual(result, 'holed');
  assert.ok(fast.x > hole.cup + 20, 'it ran past');
});

test('water ends the ball, the ceiling and walls keep it indoors', () => {
  const pond = HOLES[4];
  const wet = { x: 700, y: 300, vx: 0, vy: 0, rolling: false, support: null };
  assert.equal(settle(pond, wet), 'water');
  const office = HOLES[0];
  const high = { x: 600, y: 300, vx: 0, vy: -900, rolling: false, support: null };
  let top = high.y;
  for (let t = 0; t < 1; t += STEP) {
    stepBall(high, office, STEP);
    top = Math.min(top, high.y);
  }
  assert.ok(top >= office.ceiling.y + BALL_RADIUS - 0.01, 'the ceiling stopped it');
  const wall = { x: office.length - 20, y: 400, vx: 900, vy: 0, rolling: false, support: null };
  settle(office, wall);
  assert.ok(wall.x <= office.length - BALL_RADIUS);
});

test('the ball can land on furniture and roll off its edge', () => {
  const living = HOLES[1];
  const sofa = living.solids[0];
  const ball = { x: sofa.x + 40, y: 300, vx: 0, vy: 0, rolling: false, support: null };
  assert.equal(settle(living, ball), 'rest');
  assert.equal(ball.support, sofa);
  assert.ok(Math.abs(ball.y + BALL_RADIUS - sofa.y) < 0.5, 'resting on the cushions');
  const table = living.solids[1];
  const slide = { x: table.x + table.w - 20, y: table.y - BALL_RADIUS, vx: 0, vy: 0 };
  Object.assign(slide, { rolling: true, speed: 250, support: table });
  settle(living, slide);
  assert.ok(slide.x > table.x + table.w && slide.support !== table, 'rolled off the table');
});

function play(round, angle, power) {
  const s = round.state;
  round.setAim(angle, power);
  assert.ok(round.shoot(power));
  for (let i = 0; i < 20000 && s.phase !== 'aim' && s.mode === 'playing'; i++)
    round.update(1 / 60, {});
}

test('a stroke goes aim → swing → flight → aim, and counts once', () => {
  const round = createRound();
  round.start({ seed: 4 });
  const s = round.state;
  assert.equal(s.phase, 'aim');
  const x = s.ball.x;
  play(round, -0.35, 0.4);
  assert.equal(s.strokes, 1);
  assert.equal(s.phase, 'aim');
  assert.notEqual(s.ball.x, x);
  assert.deepEqual(s.lastSafe, { x, y: groundAt(s.hole, x).y - BALL_RADIUS });
});

test('holding the action button charges power; letting go swings', () => {
  const round = createRound();
  round.start({ seed: 4 });
  const s = round.state;
  for (let i = 0; i < 30; i++) round.update(1 / 60, { action: true });
  assert.ok(s.aim.charging && s.aim.power > 0.35 && s.aim.power < 0.6);
  round.update(1 / 60, {});
  assert.equal(s.phase, 'swing');
  for (let i = 0; i < 20; i++) round.update(1 / 60, { right: true });
  assert.equal(s.phase, 'flight', 'aim keys do nothing mid-shot');
});

test('water costs a penalty stroke and replays from the last spot', () => {
  const round = createRound();
  round.start({ seed: 4 });
  const s = round.state;
  for (let i = 0; i < 4; i++) {
    s.mode = 'card';
    round.nextHole();
  }
  assert.equal(s.hole.name, 'Gator Pond');
  const tee = s.ball.x;
  s.wind = 0;
  play(round, -0.6, 0.62);
  assert.equal(s.strokes, 2, 'one for the shot, one for the water');
  assert.equal(s.ball.x, tee);
});

test('pausing freezes the ball', () => {
  const round = createRound();
  round.start({ seed: 4 });
  const s = round.state;
  round.setAim(-0.5, 0.8);
  round.shoot();
  for (let i = 0; i < 30; i++) round.update(1 / 60, {});
  round.pause();
  const frozen = { ...s.ball, elapsed: s.elapsed };
  for (let i = 0; i < 60; i++) round.update(1 / 60, {});
  assert.deepEqual({ ...s.ball, elapsed: s.elapsed }, frozen);
  round.resume();
  assert.equal(s.mode, 'playing');
});

test('after eight strokes the ball is picked up', () => {
  const round = createRound();
  round.start({ seed: 4 });
  const s = round.state;
  s.maggieUsed = true;
  for (let i = 0; i < MAX_STROKES && s.phase === 'aim'; i++) play(round, -0.2, 0.05);
  assert.equal(s.phase, 'holed');
  assert.equal(s.scores[0], MAX_STROKES + 1);
});

// A capable golfer: tries a grid of shots on a copy of the ball and takes the
// one that finishes closest to the pin, then plays it through the round.
function bestShot(s) {
  const hole = s.hole;
  const left = hole.cup < s.ball.x;
  const angles = s.putting
    ? [left ? -Math.PI : 0]
    : Array.from({ length: 16 }, (_, i) => -0.15 - i * 0.08).map((a) => (left ? -Math.PI - a : a));
  const wind = s.putting || hole.theme !== 'course' ? 0 : s.wind * 34;
  let best = null;
  for (const angle of angles)
    for (let power = 0.06; power <= 1; power += s.putting ? 0.03 : 0.06) {
      const speed = power * (s.putting ? PUTT_SPEED : DRIVE_SPEED);
      const ball = {
        ...s.ball,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        rolling: s.putting,
        speed: Math.cos(angle) * speed,
      };
      const result = settle(hole, ball, wind);
      const d =
        result === 'holed' ? -1 : result === 'water' ? Infinity : Math.abs(ball.x - hole.cup);
      if (!best || d < best.d) best = { d, angle, power };
    }
  return best;
}

test('a capable golfer finishes the round at or under par', () => {
  const round = createRound();
  round.start({ seed: 11 });
  const s = round.state;
  for (let guard = 0; s.mode !== 'done' && guard < 400; guard++) {
    if (s.mode === 'card') {
      round.nextHole();
      continue;
    }
    if (s.phase !== 'aim') {
      round.update(1 / 60, {});
      continue;
    }
    const { angle, power } = bestShot(s);
    play(round, angle, power);
  }
  assert.equal(s.mode, 'done');
  assert.equal(s.result.scores.length, 9);
  assert.ok(s.result.toPar <= 0, `shot ${s.result.total}`);
  assert.ok(s.result.scores.every((score) => score <= MAX_STROKES));
});

test('Maggie steals the ball, drops it nearby, and costs no stroke', () => {
  const events = [];
  const round = createRound((type, detail) => events.push({ type, detail }), { maggieChance: 1 });
  round.start({ seed: 4 });
  const s = round.state;
  for (let i = 0; i < 3; i++) {
    s.mode = 'card';
    round.nextHole();
  }
  s.wind = 0;
  round.setAim(-0.5, 0.5);
  round.shoot();
  for (let i = 0; i < 2000 && s.phase !== 'maggie'; i++) round.update(1 / 60, {});
  assert.equal(s.phase, 'maggie');
  const rested = s.ball.x;
  assert.equal(s.strokes, 1);
  for (let i = 0; i < 2000 && s.phase === 'maggie'; i++) round.update(1 / 60, {});
  assert.equal(s.phase, 'aim');
  assert.equal(s.strokes, 1, 'no penalty');
  assert.ok(Math.abs(s.ball.x - rested) > 100, 'she moved it');
  assert.ok(!inWater(s.hole, s.ball.x), 'never into the water');
  assert.ok(Math.abs(s.ball.y + BALL_RADIUS - groundAt(s.hole, s.ball.x).y) < 0.5);
  assert.ok(events.some((e) => e.type === 'maggie-drop'));
  for (let i = 0; i < 300 && s.maggie; i++) round.update(1 / 60, {});
  assert.equal(s.maggie, null, 'she runs off');
  // Only once per hole.
  play(round, -0.4, 0.2);
  assert.notEqual(s.phase, 'maggie');
});

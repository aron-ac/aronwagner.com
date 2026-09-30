import { HOLES, TOTAL_PAR } from './holes.js';

// Deterministic side-on golf: ball physics, strokes, Maggie and the round.
// No DOM or canvas. Units are world units and seconds; larger y is lower.
export const GRAVITY = 900;
export const BALL_RADIUS = 6;
export const DRIVE_SPEED = 1150;
export const PUTT_SPEED = 560;
export const MAX_STROKES = 8;
export const WIND_ACCEL = 34;
export const CUP_HALF = 8;
export const CUP_SPEED = 260;
export const MAGGIE_CHANCE = 0.35;
export const MAGGIE_RUN = 720;
export const MAGGIE_CARRY = 520;
const STEP = 1 / 240;

export const MATERIALS = {
  hardwood: { bounce: 0.42, roll: 230, grip: 0.14 },
  carpet: { bounce: 0.22, roll: 380, grip: 0.3 },
  mat: { bounce: 0.2, roll: 150, grip: 0.3, green: true },
  cushion: { bounce: 0.12, roll: 900, grip: 0.6 },
  wood: { bounce: 0.45, roll: 170, grip: 0.12 },
  metal: { bounce: 0.55, roll: 170, grip: 0.1 },
  patio: { bounce: 0.5, roll: 220, grip: 0.14 },
  fairway: { bounce: 0.3, roll: 430, grip: 0.24 },
  rough: { bounce: 0.18, roll: 900, grip: 0.5 },
  sand: { bounce: 0.04, roll: 1500, grip: 0.85 },
  green: { bounce: 0.2, roll: 150, grip: 0.3, green: true },
  mud: { bounce: 0.05, roll: 1500, grip: 0.85 },
};

export function createRandom(seed) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/** The ground run under x: its material, height and slope (dy/dx). */
export function groundAt(hole, x) {
  const runs = hole.ground;
  let run = runs[runs.length - 1];
  for (const candidate of runs)
    if (x < candidate[1]) {
      run = candidate;
      break;
    }
  const [from, to, material, y0, y1] = run;
  const t = clamp((x - from) / (to - from), 0, 1);
  return { material, y: y0 + (y1 - y0) * t, slope: (y1 - y0) / (to - from) };
}

export function inWater(hole, x) {
  return (hole.water || []).find((pond) => x >= pond.from && x <= pond.to) || null;
}

export function scoreName(strokes, par) {
  if (strokes === 1) return 'Hole in one!';
  const names = { '-3': 'Albatross!', '-2': 'Eagle!', '-1': 'Birdie!', 0: 'Par', 1: 'Bogey' };
  const diff = strokes - par;
  return names[diff] ?? (diff === 2 ? 'Double bogey' : `+${diff}`);
}

/** Advance a ball by one physics step. Returns 'rest', 'holed', 'water' or null. */
export function stepBall(ball, hole, dt, wind = 0) {
  const r = BALL_RADIUS;
  if (ball.rolling) return roll(ball, hole, dt);
  const px = ball.x,
    py = ball.y;
  ball.vy += GRAVITY * dt;
  ball.vx += wind * dt;
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;
  if (hole.ceiling && ball.x < hole.ceiling.to && ball.y - r < hole.ceiling.y && ball.vy < 0) {
    ball.y = hole.ceiling.y + r;
    ball.vy = -ball.vy * 0.5;
  }
  if (ball.x < r) {
    ball.x = r;
    ball.vx = Math.abs(ball.vx) * 0.5;
  } else if (ball.x > hole.length - r) {
    ball.x = hole.length - r;
    ball.vx = -Math.abs(ball.vx) * 0.5;
  }
  for (const solid of hole.solids || []) {
    const cx = clamp(ball.x, solid.x, solid.x + solid.w),
      cy = clamp(ball.y, solid.y, solid.y + solid.h);
    if ((ball.x - cx) ** 2 + (ball.y - cy) ** 2 >= r * r) continue;
    if (py + r <= solid.y + 1) {
      ball.y = solid.y - r;
      if (land(ball, MATERIALS[solid.material], 0)) ball.support = solid;
    } else if (py - r >= solid.y + solid.h - 1) {
      ball.y = solid.y + solid.h + r;
      ball.vy = Math.abs(ball.vy) * 0.4;
    } else if (px < solid.x + solid.w / 2) {
      ball.x = solid.x - r;
      ball.vx = -Math.abs(ball.vx) * 0.5;
    } else {
      ball.x = solid.x + solid.w + r;
      ball.vx = Math.abs(ball.vx) * 0.5;
    }
  }
  const pond = inWater(hole, ball.x);
  if (pond && ball.y + r > pond.level + 4) return 'water';
  const ground = groundAt(hole, ball.x);
  if (Math.abs(ball.x - hole.cup) < CUP_HALF - 2 && ball.vy > 0 && ball.y + r >= ground.y - 1)
    if (Math.abs(ball.vx) < 200) return 'holed';
  if (ball.y + r > ground.y) {
    ball.y = ground.y - r;
    if (land(ball, MATERIALS[ground.material], ground.slope)) ball.support = null;
  }
  return null;
}

// Bounce off a surface with the given slope. Returns true if the ball settles
// into rolling along it.
function land(ball, material, slope) {
  const length = Math.hypot(slope, 1);
  const nx = slope / length,
    ny = -1 / length;
  const tx = -ny,
    ty = nx;
  const vn = ball.vx * nx + ball.vy * ny;
  if (vn >= 0) return false;
  const vt = (ball.vx * tx + ball.vy * ty) * (1 - material.grip);
  const bounced = -vn * material.bounce;
  if (bounced < 45) {
    ball.rolling = true;
    ball.speed = vt;
    ball.vx = vt * tx;
    ball.vy = vt * ty;
    return true;
  }
  ball.vx = bounced * nx + vt * tx;
  ball.vy = bounced * ny + vt * ty;
  return false;
}

function roll(ball, hole, dt) {
  const r = BALL_RADIUS;
  let slope = 0,
    material,
    surfaceY;
  if (ball.support) {
    material = MATERIALS[ball.support.material];
  } else {
    const ground = groundAt(hole, ball.x);
    slope = ground.slope;
    material = MATERIALS[ground.material];
  }
  const length = Math.hypot(1, slope);
  const downhill = (GRAVITY * slope) / length;
  ball.speed += downhill * dt;
  const friction = material.roll * dt;
  if (Math.abs(ball.speed) <= friction) ball.speed = 0;
  else ball.speed -= Math.sign(ball.speed) * friction;
  const before = ball.x;
  ball.x += (ball.speed / length) * dt;
  if (ball.x < r || ball.x > hole.length - r) {
    ball.x = clamp(ball.x, r, hole.length - r);
    ball.speed = -ball.speed * 0.5;
  }
  if (ball.support) {
    const s = ball.support;
    if (ball.x < s.x || ball.x > s.x + s.w) {
      // Rolled off the edge of the furniture: fall.
      ball.rolling = false;
      ball.support = null;
      ball.vx = ball.speed;
      ball.vy = 0;
      return null;
    }
    surfaceY = s.y;
  } else surfaceY = groundAt(hole, ball.x).y;
  ball.y = surfaceY - r;
  ball.vx = ball.speed / length;
  ball.vy = (ball.speed * slope) / length;
  const pond = inWater(hole, ball.x);
  if (pond && ball.y + r > pond.level + 4) return 'water';
  if (!ball.support && Math.abs(ball.x - hole.cup) < CUP_HALF) {
    if (Math.abs(ball.speed) < CUP_SPEED) return 'holed';
    // Too fast: it hops over the cup.
    if (Math.sign(before - hole.cup) !== Math.sign(ball.x - hole.cup)) {
      ball.rolling = false;
      ball.vx = ball.speed * 0.8;
      ball.vy = -Math.abs(ball.speed) * 0.12;
      return null;
    }
  }
  const settled = ball.speed === 0 && Math.abs(downhill) <= material.roll;
  return settled ? 'rest' : null;
}

/** The first part of a shot's flight, for the aiming guide (no wind). */
export function previewPath(hole, from, angle, power, putting, seconds = 0.7) {
  const speed = power * (putting ? PUTT_SPEED : DRIVE_SPEED);
  const ball = { x: from.x, y: from.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed };
  const points = [];
  for (let t = 0; t < seconds; t += STEP) {
    const result = stepBall(ball, hole, STEP, 0);
    if (Math.round(t / STEP) % 12 === 0) points.push({ x: ball.x, y: ball.y });
    if (result || ball.rolling) break;
  }
  return points;
}

export function createRound(onEvent = () => {}, { maggieChance = MAGGIE_CHANCE } = {}) {
  let random;
  const state = { mode: 'menu', elapsed: 0 };

  function supportMaterial() {
    const ball = state.ball;
    if (ball.support) return ball.support.material;
    return groundAt(state.hole, ball.x).material;
  }
  function beginHole(index, quiet = false) {
    const hole = HOLES[index];
    const range = hole.wind || [0, 0];
    Object.assign(state, {
      holeIndex: index,
      hole,
      strokes: 0,
      phase: 'aim',
      phaseTime: 0,
      wind: Math.round((range[0] + random() * (range[1] - range[0])) * 10) / 10,
      maggie: null,
      maggieUsed: false,
      ball: {
        x: hole.tee,
        y: groundAt(hole, hole.tee).y - BALL_RADIUS,
        vx: 0,
        vy: 0,
        rolling: false,
        support: null,
      },
    });
    state.lastSafe = { x: state.ball.x, y: state.ball.y };
    aimAtCup();
    if (!quiet) onEvent('hole', { hole, index });
  }
  function aimAtCup() {
    const left = state.hole.cup < state.ball.x;
    state.putting = Boolean(MATERIALS[supportMaterial()].green);
    state.aim = {
      angle: state.putting ? (left ? -Math.PI : 0) : left ? -Math.PI + 0.62 : -0.62,
      power: 0,
      charging: false,
      rising: true,
    };
    state.facing = left ? -1 : 1;
  }
  function reset(seed, quiet = false) {
    random = createRandom(seed);
    Object.assign(state, { elapsed: 0, seed, scores: [], result: null, actionHeld: false });
    beginHole(0, quiet);
  }
  function start({ seed = Date.now() } = {}) {
    reset(seed);
    state.mode = 'playing';
    onEvent('start');
  }
  function pause() {
    if (state.mode !== 'playing') return;
    state.mode = 'paused';
    state.aim.charging = false;
    onEvent('pause');
  }
  function resume() {
    if (state.mode !== 'paused') return;
    state.mode = 'playing';
    state.actionHeld = true;
    onEvent('resume');
  }
  function nextHole() {
    if (state.mode !== 'card') return;
    if (state.holeIndex + 1 >= HOLES.length) return finish();
    state.mode = 'playing';
    state.actionHeld = true;
    beginHole(state.holeIndex + 1);
  }
  function finish() {
    const total = state.scores.reduce((sum, score) => sum + score, 0);
    state.result = { total, toPar: total - TOTAL_PAR, scores: [...state.scores] };
    state.mode = 'done';
    onEvent('done', state.result);
  }

  function clampAim(angle) {
    return state.putting ? clamp(angle, -Math.PI, 0) : clamp(angle, -Math.PI + 0.08, -0.08);
  }
  /** Aim from a drag: angle in radians (0 is right, negative is up) and power 0..1. */
  function setAim(angle, power) {
    if (state.mode !== 'playing' || state.phase !== 'aim') return;
    state.aim.angle = clampAim(angle);
    state.aim.power = clamp(power, 0, 1);
    state.facing = Math.cos(state.aim.angle) < 0 ? -1 : 1;
  }
  function shoot(power = state.aim.power) {
    if (state.mode !== 'playing' || state.phase !== 'aim' || power < 0.03) return false;
    state.aim.power = clamp(power, 0, 1);
    state.aim.charging = false;
    state.strokes++;
    state.lastSafe = { x: state.ball.x, y: state.ball.y };
    state.phase = 'swing';
    state.phaseTime = 0;
    onEvent('swing', { putting: state.putting });
    return true;
  }
  function launch() {
    const speed = state.aim.power * (state.putting ? PUTT_SPEED : DRIVE_SPEED);
    Object.assign(state.ball, {
      vx: Math.cos(state.aim.angle) * speed,
      vy: Math.sin(state.aim.angle) * speed,
      rolling: false,
      support: null,
    });
    if (state.putting && Math.abs(Math.sin(state.aim.angle)) < 0.05) {
      state.ball.rolling = true;
      state.ball.speed = state.ball.vx;
    }
    state.phase = 'flight';
    state.phaseTime = 0;
    onEvent('hit', { power: state.aim.power, putting: state.putting });
  }

  function atRest() {
    const hole = state.hole;
    if (state.strokes >= MAX_STROKES) return holed(true);
    const material = supportMaterial();
    const onGreen = MATERIALS[material].green;
    if (
      !onGreen &&
      !state.maggieUsed &&
      !state.ball.support &&
      state.strokes >= 1 &&
      random() < maggieChance
    ) {
      startMaggie();
      return;
    }
    state.phase = 'aim';
    aimAtCup();
    onEvent('rest', { material, distance: Math.abs(hole.cup - state.ball.x) });
  }
  function holed(pickedUp = false) {
    const strokes = pickedUp ? MAX_STROKES + 1 : state.strokes;
    state.scores.push(strokes);
    state.phase = 'holed';
    state.phaseTime = 0;
    onEvent('holed', {
      strokes,
      par: state.hole.par,
      name: pickedUp ? 'Picked up' : scoreName(strokes, state.hole.par),
      pickedUp,
    });
  }

  // Maggie runs in, grabs the ball, and drops it somewhere nearby: closer or farther.
  function dropSpot() {
    const hole = state.hole;
    const direction = random() < 0.5 ? -1 : 1;
    let x = clamp(state.ball.x + direction * (160 + random() * 340), 90, hole.length - 90);
    const bad = (spot) =>
      inWater(hole, spot) ||
      (hole.solids || []).some((s) => spot > s.x - 20 && spot < s.x + s.w + 20) ||
      Math.abs(spot - hole.cup) < 30;
    for (let tries = 0; bad(x) && tries < 60; tries++) x += x > state.ball.x ? -20 : 20;
    return bad(x) ? state.ball.x : x;
  }
  function startMaggie() {
    state.maggieUsed = true;
    const from = state.ball.x - 700 < 0 ? state.ball.x + 700 : state.ball.x - 700;
    state.maggie = {
      stage: 'in',
      x: from,
      facing: from < state.ball.x ? 1 : -1,
      target: dropSpot(),
    };
    state.phase = 'maggie';
    onEvent('maggie', { maggie: state.maggie });
  }
  function moveMaggie(dt) {
    const m = state.maggie,
      ball = state.ball;
    const toward = (goal, speed) => {
      const gap = goal - m.x;
      m.facing = gap >= 0 ? 1 : -1;
      m.x += Math.sign(gap) * Math.min(Math.abs(gap), speed * dt);
      return Math.abs(goal - m.x) < 0.5;
    };
    if (m.stage === 'in' && toward(ball.x, MAGGIE_RUN)) m.stage = 'carry';
    else if (m.stage === 'carry') {
      const arrived = toward(m.target, MAGGIE_CARRY);
      ball.x = m.x;
      ball.y = groundAt(state.hole, ball.x).y - BALL_RADIUS;
      if (arrived) {
        m.stage = 'sit';
        m.until = state.elapsed + 1.1;
        const before = Math.abs(state.lastSafe.x - state.hole.cup);
        onEvent('maggie-drop', { closer: Math.abs(ball.x - state.hole.cup) < before });
      }
    } else if (m.stage === 'sit' && state.elapsed >= m.until) {
      m.stage = 'out';
      m.exit = m.x + (m.facing > 0 ? 900 : -900);
      state.phase = 'aim';
      aimAtCup();
    } else if (m.stage === 'out' && toward(m.exit, MAGGIE_RUN)) state.maggie = null;
  }

  function tick(dt, input) {
    state.elapsed += dt;
    state.phaseTime += dt;
    if (state.maggie && state.maggie.stage === 'out') moveMaggie(dt);
    if (state.phase === 'aim') {
      const turn = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      if (turn) {
        // Right turns the aim clockwise toward level-right, left toward level-left.
        state.aim.angle = clampAim(state.aim.angle + turn * (state.putting ? 0.7 : 1.2) * dt);
        state.facing = Math.cos(state.aim.angle) < 0 ? -1 : 1;
      }
      if (input.action) {
        if (!state.aim.charging && !state.actionHeld) {
          state.aim.charging = true;
          state.aim.power = 0;
          state.aim.rising = true;
        }
        if (state.aim.charging) {
          const rate = dt / (state.putting ? 1.3 : 1.05);
          state.aim.power += state.aim.rising ? rate : -rate;
          if (state.aim.power >= 1) {
            state.aim.power = 1;
            state.aim.rising = false;
          } else if (state.aim.power <= 0) {
            state.aim.power = 0;
            state.aim.rising = true;
          }
        }
      } else if (state.aim.charging) shoot(state.aim.power);
    } else if (state.phase === 'swing') {
      if (state.phaseTime >= (state.putting ? 0.22 : 0.3)) launch();
    } else if (state.phase === 'flight') {
      const wind = state.putting || state.hole.theme !== 'course' ? 0 : state.wind * WIND_ACCEL;
      let result = null;
      for (let t = 0; t < dt - 1e-9 && !result; t += STEP)
        result = stepBall(state.ball, state.hole, STEP, wind);
      if (!result && state.phaseTime > 20) result = 'rest';
      if (result === 'holed') {
        state.ball.x = state.hole.cup;
        holed();
      } else if (result === 'water') {
        state.strokes++;
        Object.assign(state.ball, {
          x: state.lastSafe.x,
          y: state.lastSafe.y,
          vx: 0,
          vy: 0,
          rolling: false,
          support: null,
        });
        onEvent('water', { strokes: state.strokes });
        if (state.strokes >= MAX_STROKES) holed(true);
        else {
          state.phase = 'aim';
          aimAtCup();
        }
      } else if (result === 'rest') {
        state.ball.rolling = false;
        atRest();
      }
    } else if (state.phase === 'maggie') moveMaggie(dt);
    else if (state.phase === 'holed' && state.phaseTime > 2.2) {
      state.mode = 'card';
      onEvent('card', { index: state.holeIndex, scores: state.scores });
    }
    state.actionHeld = Boolean(input.action) && state.phase !== 'aim' ? true : state.actionHeld;
  }

  function update(dt, input = {}) {
    if (state.mode !== 'playing' || !Number.isFinite(dt) || dt <= 0) return;
    const duration = Math.min(dt, 0.1);
    tick(duration, input);
    if (!input.action) state.actionHeld = false;
  }

  // The menu shows the first hole before anyone presses start.
  reset(1, true);
  return { state, start, pause, resume, nextHole, update, setAim, shoot, finish };
}

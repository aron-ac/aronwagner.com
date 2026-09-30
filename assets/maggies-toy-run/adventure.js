import { createLevel } from './level.js';

export const MAX_HEARTS = 3;
export const RUN_SPEED = 260;
export const JUMP_SPEED = 610;
export const GRAVITY = 1600;
const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const damp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));

export function createAdventure(level, onEvent = () => {}) {
  const makePlayer = () => ({
    x: level.spawn.x,
    y: level.spawn.y,
    w: 46,
    h: 48,
    vx: 0,
    vy: 0,
    facing: 1,
    onGround: true,
    invulnerable: 0,
    coyote: 0.1,
    jumpBuffer: 0,
    knockback: 0,
  });
  const initial = () => ({
    mode: 'menu',
    elapsed: 0,
    hearts: MAX_HEARTS,
    balls: 0,
    score: 0,
    bounces: 0,
    checkpointId: null,
    respawn: { ...level.spawn },
    player: makePlayer(),
    jumpHeld: false,
  });
  const state = initial();

  function start() {
    Object.assign(level, createLevel());
    Object.assign(state, initial(), { mode: 'playing' });
    onEvent('start');
  }
  function pause() {
    if (state.mode !== 'playing') return;
    state.mode = 'paused';
    state.jumpHeld = false;
    onEvent('pause');
  }
  function resume() {
    if (state.mode !== 'paused') return;
    state.mode = 'playing';
    state.jumpHeld = false;
    onEvent('resume');
  }
  function hurt(reason, respawn = false, sourceX = state.player.x + 1) {
    if (state.mode !== 'playing') return;
    const p = state.player;
    if (p.invulnerable > 0 && !respawn) return;
    state.hearts--;
    if (state.hearts <= 0) {
      state.hearts = 0;
      state.mode = 'lost';
      p.vx = p.vy = 0;
      onEvent('lost', { reason });
      return;
    }
    p.invulnerable = 1.5;
    p.jumpBuffer = 0;
    if (respawn) {
      p.x = state.respawn.x;
      p.y = state.respawn.y;
      p.vx = p.vy = 0;
      p.onGround = true;
      p.coyote = 0.1;
      p.knockback = 0;
    } else {
      p.vx = p.x + p.w / 2 < sourceX ? -240 : 240;
      p.vy = -280;
      p.onGround = false;
      p.coyote = 0;
      p.knockback = 0.24;
    }
    onEvent('hurt', { reason, respawn });
  }
  function update(dt, input = {}) {
    if (state.mode !== 'playing' || !Number.isFinite(dt) || dt <= 0) return;
    const p = state.player;
    const jumping = !!input.jump;
    if (jumping && !state.jumpHeld) p.jumpBuffer = 0.12;
    if (!jumping && state.jumpHeld && p.vy < -240) p.vy = -240;
    state.jumpHeld = jumping;
    const duration = Math.min(dt, 0.1),
      steps = Math.max(1, Math.ceil(duration / (1 / 120)));
    for (let i = 0; i < steps && state.mode === 'playing'; i++) tick(duration / steps, input);
  }
  function tick(dt, input) {
    const p = state.player;
    state.elapsed += dt;
    p.invulnerable = Math.max(0, p.invulnerable - dt);
    p.knockback = Math.max(0, p.knockback - dt);
    p.coyote = p.onGround ? 0.1 : Math.max(0, p.coyote - dt);
    p.jumpBuffer = Math.max(0, p.jumpBuffer - dt);
    const direction = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (p.knockback <= 0) p.vx = damp(p.vx, direction * RUN_SPEED, p.onGround ? 18 : 11, dt);
    if (direction) p.facing = direction;
    if (p.jumpBuffer > 0 && p.coyote > 0) {
      p.vy = -JUMP_SPEED;
      p.onGround = false;
      p.coyote = 0;
      p.jumpBuffer = 0;
      onEvent('jump');
    }
    const previousBottom = p.y + p.h;
    p.x += p.vx * dt;
    p.x = Math.max(0, Math.min(level.width - p.w, p.x));
    for (const platform of level.platforms) {
      if (platform.kind === 'platform' || !overlaps(p, platform)) continue;
      if (p.vx > 0) p.x = platform.x - p.w;
      else if (p.vx < 0) p.x = platform.x + platform.w;
      p.vx = 0;
    }
    const previousY = p.y;
    p.vy = Math.min(950, p.vy + GRAVITY * dt);
    p.y += p.vy * dt;
    p.onGround = false;
    for (const platform of level.platforms) {
      if (p.x + p.w <= platform.x || p.x >= platform.x + platform.w) continue;
      if (p.vy >= 0 && previousBottom <= platform.y + 0.5 && p.y + p.h >= platform.y) {
        p.y = platform.y - p.h;
        p.vy = 0;
        p.onGround = true;
      } else if (
        platform.kind !== 'platform' &&
        p.vy < 0 &&
        previousY >= platform.y + platform.h - 0.5 &&
        p.y <= platform.y + platform.h
      ) {
        p.y = platform.y + platform.h;
        p.vy = 0;
      }
    }
    for (const ball of level.balls) {
      if (
        !ball.collected &&
        ball.x >= p.x - 10 &&
        ball.x <= p.x + p.w + 10 &&
        ball.y >= p.y - 10 &&
        ball.y <= p.y + p.h + 10
      ) {
        ball.collected = true;
        state.balls++;
        state.score += 10;
        onEvent('ball', { x: ball.x, y: ball.y });
      }
    }
    for (const bubble of level.bubbles) {
      if (bubble.popped > 0) {
        bubble.popped = Math.max(0, bubble.popped - dt);
        continue;
      }
      bubble.x += bubble.vx * dt;
      if (bubble.x < bubble.patrolMin) {
        bubble.x = bubble.patrolMin;
        bubble.vx = Math.abs(bubble.vx);
      }
      if (bubble.x > bubble.patrolMax) {
        bubble.x = bubble.patrolMax;
        bubble.vx = -Math.abs(bubble.vx);
      }
      if (!overlaps(p, bubble)) continue;
      if (p.vy > 0 && previousBottom <= bubble.y + 14) {
        p.y = bubble.y - p.h;
        p.vy = -450;
        p.onGround = false;
        p.coyote = 0;
        bubble.popped = 3;
        const firstBounce = !bubble.bounced;
        if (firstBounce) {
          bubble.bounced = true;
          state.bounces++;
          state.score += 25;
        }
        onEvent('bounce', { x: bubble.x + bubble.w / 2, y: bubble.y, firstBounce });
      } else hurt('bubble', false, bubble.x + bubble.w / 2);
      if (state.mode !== 'playing') return;
    }
    for (const checkpoint of level.checkpoints) {
      if (
        !checkpoint.active &&
        checkpoint.x > state.respawn.x &&
        p.x + p.w / 2 >= checkpoint.x &&
        p.x < checkpoint.x + 100 &&
        Math.abs(p.y - checkpoint.y) < 72
      ) {
        checkpoint.active = true;
        state.checkpointId = checkpoint.id;
        state.respawn = { x: checkpoint.x, y: checkpoint.y };
        state.hearts = Math.min(MAX_HEARTS, state.hearts + 1);
        state.score += 50;
        onEvent('checkpoint', { x: checkpoint.x, y: checkpoint.y });
      }
    }
    if (p.y > 570) {
      hurt('fall', true);
      return;
    }
    if (overlaps(p, level.finish)) {
      state.mode = 'won';
      state.score += 100 + state.hearts * 25;
      p.vx = p.vy = 0;
      onEvent('won');
    }
  }
  return { state, start, pause, resume, update };
}

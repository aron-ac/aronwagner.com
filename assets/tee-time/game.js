import { createRound, previewPath, groundAt, scoreName } from './golf.js';
import { HOLES, TOTAL_PAR } from './holes.js';
import { loadSprites, drawAron, drawMaggie, aronStance, MAGGIE_HEIGHT } from './sprites.js';
import * as art from './art.js';
import { createSynthAudio } from '../shared/audio.js';
import { createGameInput } from '../shared/input.js';
import { bindTouchAction } from '../shared/touch-action.js';
import { createGameLoop } from '../shared/game-loop.js';
import { requireElements, setText, isInteractiveTarget } from '../shared/dom.js';
import { readStoredNumber, writeStoredNumber } from '../shared/storage.js';

const ui = requireElements([
  'viewport',
  'canvas',
  'load-state',
  'overlay',
  'start',
  'restart',
  'pause',
  'touch-controls',
  'hole',
  'par',
  'strokes',
  'to-par',
  'hole-panel',
  'hole-name',
  'distance',
  'wind',
  'hint',
  'toast',
  'menu-eyebrow',
  'menu-title',
  'menu-description',
  'intro-details',
  'results',
  'menu-note',
  'best',
  'sound',
  'golf-invite',
]);
const canvas = ui.canvas,
  ctx = canvas.getContext('2d');
if (!ctx) {
  ui['load-state'].textContent = 'This game needs a browser with Canvas support.';
  throw new Error('Canvas unavailable');
}
const sheets = await loadSprites();
const round = createRound(gameEvent);
const state = round.state;
const view = { x: 0, y: 0, width: 1000, height: 600, zoom: 1 };
const controls = createGameInput({
  bindings: {
    left: ['KeyA', 'ArrowLeft', 'ArrowDown', 'KeyS'],
    right: ['KeyD', 'ArrowRight', 'ArrowUp', 'KeyW'],
    action: ['Space', 'KeyE'],
  },
  isActive: () => state.mode === 'playing',
});
const keys = controls.keys;
const clearInput = () => controls.clear();
const frameInput = {};
const coarse = matchMedia('(pointer:coarse)').matches || navigator.maxTouchPoints > 0;
const reducedMotion = matchMedia('(prefers-reduced-motion:reduce)').matches;
const BEST_KEY = 'tee-time-best-round';
let best = readStoredNumber(BEST_KEY);
let toastUntil = 0,
  animationTime = 0,
  uiTimer = 0,
  poseOverride = null,
  poseUntil = 0;
const popups = [],
  trail = [];
ui.best.textContent = best ? `${best} (${formatToPar(best - TOTAL_PAR)})` : '—';
const audio = createSynthAudio({
  button: ui.sound,
  volume: 0.03,
  duration: 0.1,
  endFrequencyRatio: 0.85,
});
const beep = (frequency = 440, duration = 0.1, delay = 0) =>
  audio.beep(frequency, duration, 'sine', delay);

function formatToPar(value) {
  return value === 0 ? 'E' : value > 0 ? `+${value}` : String(value);
}
function toast(text, seconds = 3) {
  ui.toast.textContent = text;
  ui.toast.classList.add('show');
  toastUntil = performance.now() + seconds * 1000;
}
function popup(x, y, text, color, size) {
  popups.push({ x, y, text, color, life: 1, size });
}
function strikePose(name, seconds) {
  poseOverride = name;
  poseUntil = state.elapsed + seconds;
}
function setPlayingUI(playing) {
  ui.pause.classList.toggle('hidden', !playing);
  ui['hole-panel'].classList.toggle('hidden', !playing);
  ui['touch-controls'].classList.toggle('hidden', !playing || !coarse);
}
function showMenu({
  eyebrow,
  title,
  description,
  button,
  results = null,
  restart = false,
  invite = false,
}) {
  clearInput();
  setPlayingUI(false);
  ui.overlay.classList.remove('hidden');
  ui['intro-details'].classList.add('hidden');
  ui.results.classList.toggle('hidden', !results);
  if (results) ui.results.innerHTML = results;
  ui.restart.classList.toggle('hidden', !restart);
  ui['golf-invite'].classList.toggle('hidden', !invite);
  ui.toast.classList.remove('show');
  ui['menu-eyebrow'].textContent = eyebrow;
  ui['menu-title'].textContent = title;
  ui['menu-description'].textContent = description;
  ui.start.innerHTML = `${button} <span aria-hidden="true">↗</span>`;
  ui.start.focus({ preventScroll: true });
}
function scorecard() {
  const cells = HOLES.map((hole, i) => {
    const score = state.scores[i];
    const diff = score === undefined ? '' : score - hole.par;
    const mark = diff === '' ? '' : diff < 0 ? 'under' : diff > 0 ? 'over' : 'even';
    return `<div class="${mark}"><span>${i + 1}</span><small>PAR ${hole.par}</small><strong>${score ?? '·'}</strong></div>`;
  }).join('');
  const played = state.scores.length;
  const total = state.scores.reduce((sum, s) => sum + s, 0);
  const par = HOLES.slice(0, played).reduce((sum, h) => sum + h.par, 0);
  return `<div class="card-grid">${cells}</div><p class="card-total">TOTAL <strong>${total}</strong> · ${formatToPar(total - par)}</p>`;
}

function gameEvent(type, detail = {}) {
  if (type === 'start') {
    ui.overlay.classList.add('hidden');
    ui.results.classList.add('hidden');
    setPlayingUI(true);
    canvas.focus({ preventScroll: true });
  } else if (type === 'hole') {
    popups.length = trail.length = 0;
    poseOverride = null;
    snapCamera();
    const wind = detail.hole.theme === 'course' ? ` Wind ${windText()}.` : '';
    toast(`Hole ${detail.index + 1}: ${detail.hole.name}. Par ${detail.hole.par}.${wind}`, 3.2);
  } else if (type === 'swing') beep(detail.putting ? 300 : 220, 0.08);
  else if (type === 'hit') {
    trail.length = 0;
    beep(detail.putting ? 520 : 760 + detail.power * 200, 0.07);
  } else if (type === 'rest') {
    const yards = Math.round(detail.distance / 12);
    if (detail.material === 'sand') toast('In the bunker. Give it some power.');
    else if (detail.material === 'cushion') toast('Soft landing. Maggie approves.');
    else if (detail.material === 'rough') toast(`In the rough, ${yards} yards out.`, 2);
  } else if (type === 'water') {
    strikePose('frustrated', 1.8);
    toast(
      state.hole.props?.some((prop) => prop.name === 'gator')
        ? 'Splash. The gator can keep that one. Penalty stroke.'
        : 'Splash. Penalty stroke.',
    );
    beep(180, 0.3);
  } else if (type === 'maggie') {
    toast('Maggie! She’s got your ball!', 2.5);
    beep(880, 0.06);
    beep(990, 0.06, 0.08);
  } else if (type === 'maggie-drop') {
    toast(detail.closer ? 'Good girl! She dropped it closer.' : 'Maggie… that’s farther.', 2.5);
    beep(detail.closer ? 880 : 300, 0.12);
  } else if (type === 'holed') {
    const good = detail.strokes <= detail.par;
    strikePose(good ? 'celebrate' : 'frustrated', 2.2);
    const cupY = groundAt(state.hole, state.hole.cup).y;
    popup(state.hole.cup, cupY - 190, detail.name, good ? '#2f7d4f' : '#8a5a3c', 30);
    beep(good ? 660 : 330, 0.12);
    if (good) {
      beep(880, 0.12, 0.12);
      beep(1100, 0.2, 0.24);
    }
  } else if (type === 'card') {
    const last = detail.index === HOLES.length - 1;
    const score = state.scores[detail.index],
      par = HOLES[detail.index].par;
    showMenu({
      eyebrow: `HOLE ${detail.index + 1} · ${HOLES[detail.index].name.toUpperCase()}`,
      title: score > 8 ? 'Picked up.' : scoreName(score, par),
      description: last
        ? 'That’s the round. Let’s see the card.'
        : `Next: ${HOLES[detail.index + 1].name}, par ${HOLES[detail.index + 1].par}.`,
      button: last ? 'SEE YOUR ROUND' : 'NEXT HOLE',
      results: scorecard(),
    });
  } else if (type === 'pause') {
    showMenu({
      eyebrow: 'TIMEOUT',
      title: 'Cart break.',
      description: 'The round is paused. Maggie is guarding your ball. Probably.',
      button: 'KEEP PLAYING',
      restart: true,
    });
  } else if (type === 'resume') {
    ui.overlay.classList.add('hidden');
    setPlayingUI(true);
    canvas.focus({ preventScroll: true });
  } else if (type === 'done') {
    const record = !best || detail.total < best;
    if (record) {
      best = detail.total;
      writeStoredNumber(BEST_KEY, best);
    }
    ui.best.textContent = `${best} (${formatToPar(best - TOTAL_PAR)})`;
    const toPar = detail.toPar;
    const [eyebrow, title] =
      toPar <= -5
        ? ['TOUR-LEVEL STUFF', 'Take a bow.']
        : toPar < 0
          ? ['UNDER PAR', 'Nice round!']
          : toPar === 0
            ? ['RIGHT ON THE NUMBER', 'Even par.']
            : toPar <= 6
              ? ['NOT BAD AT ALL', 'Solid round.']
              : ['THE COURSE WON TODAY', 'Rematch?'];
    showMenu({
      eyebrow: record ? 'A NEW BEST ROUND' : eyebrow,
      title,
      description: `You shot ${detail.total} (${formatToPar(toPar)}) from the office to the bay. If you're local and you golf, let's play a real round.`,
      button: 'PLAY AGAIN',
      results: scorecard(),
      invite: true,
    });
    beep(523, 0.14);
    beep(659, 0.14, 0.14);
    beep(784, 0.22, 0.28);
  }
}
function windText() {
  const mph = Math.round(Math.abs(state.wind) * 6);
  return mph === 0 ? 'calm' : `${mph} mph ${state.wind > 0 ? '→' : '←'}`;
}

function startGame() {
  clearInput();
  const seed = Number(new URLSearchParams(location.search).get('seed')) || undefined;
  round.start(seed ? { seed } : {});
  updateUI();
}
function pauseGame() {
  drag = null;
  round.pause();
  updateUI();
}
function resumeGame() {
  clearInput();
  round.resume();
  updateUI();
}
function primaryAction() {
  if (state.mode === 'paused') resumeGame();
  else if (state.mode === 'card') {
    round.nextHole();
    if (state.mode === 'playing') {
      ui.overlay.classList.add('hidden');
      setPlayingUI(true);
      canvas.focus({ preventScroll: true });
    }
  } else startGame();
}
ui.start.addEventListener('click', primaryAction);
ui.restart.addEventListener('click', startGame);
const disposePauseAction = bindTouchAction(ui.pause, pauseGame);
document.addEventListener('keydown', (event) => {
  if (event.repeat) return;
  if (event.code === 'KeyP' || event.code === 'Escape') {
    if (state.mode === 'paused') resumeGame();
    else pauseGame();
  }
  if (
    event.code === 'Enter' &&
    !isInteractiveTarget(event.target) &&
    ['menu', 'paused', 'card', 'done'].includes(state.mode)
  ) {
    event.preventDefault();
    primaryAction();
  }
});

// Slingshot aiming: press anywhere on the course, pull back, let go.
let drag = null;
const PULL = 190;
function toWorld(event) {
  const r = canvas.getBoundingClientRect();
  return {
    x: view.x + ((event.clientX - r.left) / r.width) * view.width,
    y: view.y + ((event.clientY - r.top) / r.height) * view.height,
  };
}
canvas.addEventListener('pointerdown', (event) => {
  if (state.mode !== 'playing' || state.phase !== 'aim' || drag) return;
  event.preventDefault();
  canvas.setPointerCapture(event.pointerId);
  drag = { id: event.pointerId, start: toWorld(event), moved: false };
});
canvas.addEventListener('pointermove', (event) => {
  if (!drag || drag.id !== event.pointerId) return;
  const point = toWorld(event);
  const dx = drag.start.x - point.x,
    dy = drag.start.y - point.y;
  const length = Math.hypot(dx, dy);
  if (length < 6) return;
  drag.moved = true;
  round.setAim(Math.atan2(dy, dx), length / PULL);
});
const endDrag = (event) => {
  if (!drag || drag.id !== event.pointerId) return;
  const shoot = drag.moved && state.aim.power >= 0.05;
  drag = null;
  if (shoot) round.shoot();
  else if (state.phase === 'aim') state.aim.power = 0;
};
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', (event) => {
  if (drag && drag.id === event.pointerId) {
    drag = null;
    state.aim.power = 0;
  }
});

function update(dt) {
  round.update(dt, controls.snapshot(frameInput));
}

function updateUI() {
  setText(ui.hole, `${state.holeIndex + 1}/${HOLES.length}`);
  setText(ui.par, state.hole.par);
  setText(ui.strokes, state.strokes);
  const played = state.scores.reduce((sum, s) => sum + s, 0);
  const parSoFar = HOLES.slice(0, state.scores.length).reduce((sum, h) => sum + h.par, 0);
  setText(ui['to-par'], formatToPar(played - parSoFar));
  setText(ui['hole-name'], state.hole.name.toUpperCase());
  setText(ui.distance, `${Math.round(Math.abs(state.hole.cup - state.ball.x) / 12)} YDS`);
  setText(
    ui.wind,
    state.hole.theme === 'course' ? `WIND ${windText().toUpperCase()}` : 'INDOORS · NO WIND',
  );
  let hint;
  if (state.phase === 'maggie') hint = 'Maggie has your ball…';
  else if (state.phase !== 'aim') hint = 'Watch it go';
  else if (state.putting)
    hint = coarse
      ? 'On the green: drag back gently to putt'
      : 'On the green: hold Space for a gentle putt';
  else
    hint = coarse
      ? 'Drag back from anywhere, then let go'
      : 'Drag back and let go, or aim with ← → and hold Space';
  setText(ui.hint, hint);
}

function resize() {
  const width = ui.viewport.clientWidth,
    height = ui.viewport.clientHeight,
    dpr = Math.min(devicePixelRatio, 2);
  if (width <= 0 || height <= 0) return;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  // Landscape shows the 600-unit scene top to bottom. Portrait shows 640 across
  // and keeps the ground about 60% of the way down, under the HUD.
  view.zoom = width >= height ? height / 600 : width / 640;
  view.width = width / view.zoom;
  view.height = height / view.zoom;
  view.y = Math.min(0, 470 - view.height * 0.6);
  snapCamera();
}
function cameraTarget() {
  const hole = state.hole,
    ball = state.ball;
  let focus;
  if (state.phase === 'flight') focus = ball.x + Math.sign(ball.vx || 1) * view.width * 0.12;
  else if (state.phase === 'maggie' && state.maggie) focus = state.maggie.x;
  else {
    // Aiming: keep the ball on the tee side with room to see toward the pin.
    const toward = Math.sign(hole.cup - ball.x) || 1;
    focus = ball.x + toward * Math.min(view.width * 0.12, Math.abs(hole.cup - ball.x) / 2);
  }
  return Math.max(0, Math.min(hole.length - view.width, focus - view.width / 2));
}
function snapCamera() {
  view.x = cameraTarget();
}

function aronPose() {
  if (poseOverride && state.elapsed < poseUntil) return poseOverride;
  if (state.phase === 'swing') return state.putting ? 'putt' : 'backswing';
  if (state.phase === 'flight') return state.putting ? 'putt' : 'follow';
  if (state.phase === 'maggie') return 'frustrated';
  return state.putting ? 'putt' : 'address';
}

function render() {
  const time = reducedMotion ? 0 : animationTime;
  const hole = state.hole,
    ball = state.ball;
  const scale = (canvas.width / (view.width * view.zoom)) * view.zoom;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, view.width, view.height);
  ctx.save();
  ctx.translate(0, -view.y);
  art.drawBackdrop(ctx, hole, view, time);
  ctx.translate(-view.x, 0);
  art.drawProps(ctx, sheets, hole, view, { back: true });
  art.drawTerrain(ctx, hole, view, time);
  art.drawProps(ctx, sheets, hole, view, { back: false });
  art.drawCup(ctx, sheets, hole);
  // Aron addresses the ball while aiming, and stays where he swung from after.
  const spot = state.phase === 'aim' ? ball : state.lastSafe;
  const stance = aronStance(spot, state.facing, state.putting);
  drawAron(ctx, sheets, { x: stance.x, y: stance.y, name: aronPose(), facing: state.facing });
  const m = state.maggie;
  const carrying = m && (m.stage === 'carry' || m.stage === 'sit');
  if (!carrying && state.phase !== 'holed') art.drawBall(ctx, hole, ball, trail);
  if (m) {
    const stride = Math.floor(time * 10) % 2;
    const name =
      m.stage === 'sit'
        ? 'sit'
        : m.stage === 'carry'
          ? stride
            ? 'runBallB'
            : 'runBallA'
          : stride
            ? 'runB'
            : 'runA';
    const y = groundAt(hole, m.x).y + 6;
    drawMaggie(ctx, sheets, { x: m.x, y, name, facing: m.stage === 'sit' ? 1 : m.facing });
    if (m.stage === 'sit')
      art.drawPopup(ctx, {
        x: m.x,
        y: y - MAGGIE_HEIGHT - 30,
        text: '♥',
        color: '#e0486f',
        life: 1,
        size: 26,
      });
  }
  if (state.mode === 'playing' && state.phase === 'aim') {
    const path = previewPath(
      hole,
      ball,
      state.aim.angle,
      Math.max(state.aim.power, 0.25),
      state.putting,
    );
    art.drawAim(ctx, ball, state.aim, path, state.putting);
  }
  for (const effect of popups) art.drawPopup(ctx, effect);
  ctx.restore();
  // Point to the pin when it's off camera.
  const sx = hole.cup - view.x;
  if (state.mode === 'playing' && (sx < 0 || sx > view.width)) {
    const direction = sx < 0 ? -1 : 1;
    ctx.save();
    ctx.translate(0, -view.y);
    art.drawPinPointer(ctx, sheets, {
      x: direction < 0 ? 64 : view.width - 64,
      y: 300,
      direction,
      label: `${Math.round(Math.abs(hole.cup - ball.x) / 12)}y`,
    });
    ctx.restore();
  }
}

function animate(dt, now) {
  update(dt);
  if (state.mode !== 'paused') {
    animationTime += dt;
    for (let i = popups.length - 1; i >= 0; i--) {
      popups[i].life -= dt * 0.6;
      if (popups[i].life <= 0) popups.splice(i, 1);
    }
    if (state.phase === 'flight') {
      trail.push({ x: state.ball.x, y: state.ball.y });
      if (trail.length > 14) trail.shift();
    } else if (trail.length) trail.shift();
  }
  if (state.mode === 'playing') view.x += (cameraTarget() - view.x) * (1 - Math.exp(-dt * 4));
  uiTimer -= dt;
  if (uiTimer <= 0) {
    updateUI();
    uiTimer = 0.1;
  }
  if (toastUntil && now > toastUntil) {
    ui.toast.classList.remove('show');
    toastUntil = 0;
  }
  render();
}
const loop = createGameLoop({
  viewport: ui.viewport,
  frame: animate,
  pause: pauseGame,
  clearInput,
  resize,
  dispose() {
    disposePauseAction();
    controls.dispose();
    audio.dispose();
  },
});
setPlayingUI(false);
updateUI();
ui['load-state'].classList.add('hidden');
loop.start();
if (new URLSearchParams(location.search).has('debug'))
  window.teeDebug = {
    state,
    round,
    holes: HOLES,
    startGame,
    pauseGame,
    resumeGame,
    primaryAction,
    update,
    keys,
    clearInput,
    render,
    view,
    canvas,
    updateUI,
    snapCamera,
  };

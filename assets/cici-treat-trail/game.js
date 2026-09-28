import { createLevel } from './level.js';
import { createAdventure, MAX_HEARTS } from './adventure.js';
import * as art from './art.js';
import { createSynthAudio } from '../shared/audio.js';
import { createGameInput } from '../shared/input.js';
import { createGameLoop } from '../shared/game-loop.js';
import { requireElements, setText, setAttribute } from '../shared/dom.js';
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
  'treats',
  'score',
  'hearts',
  'trail-progress',
  'progress',
  'progress-label',
  'zone',
  'checkpoint-label',
  'toast',
  'menu-eyebrow',
  'menu-title',
  'menu-description',
  'intro-details',
  'results',
  'menu-note',
  'best',
  'sound',
]);
const canvas = ui.canvas,
  ctx = canvas.getContext('2d');
if (!ctx) {
  ui['load-state'].textContent = 'This adventure needs a browser with Canvas support.';
  throw new Error('Canvas unavailable');
}
const level = createLevel();
const adventure = createAdventure(level, gameEvent);
const state = adventure.state;
const view = { width: 900, height: 500, cameraX: 0 };
const followAnchor = () => (view.width < view.height ? 0.2 : 0.28);
const controls = createGameInput({
  bindings: {
    left: ['KeyA', 'ArrowLeft'],
    right: ['KeyD', 'ArrowRight'],
    jump: ['Space', 'KeyW', 'ArrowUp'],
  },
  isActive: () => state.mode === 'playing',
});
const keys = controls.keys;
const clearInput = () => controls.clear();
const frameInput = {};
const coarse = matchMedia('(pointer:coarse)').matches || navigator.maxTouchPoints > 0;
const reducedMotion = matchMedia('(prefers-reduced-motion:reduce)').matches;
const effects = [];
const BEST_SCORE_KEY = 'cici-treat-trail-best-score';
let best = Math.max(0, readStoredNumber(BEST_SCORE_KEY));
let toastUntil = 0,
  animationTime = 0,
  uiTimer = 0;
ui.best.textContent = best;
const formatTime = (seconds) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
const audio = createSynthAudio({
  button: ui.sound,
  volume: 0.03,
  duration: 0.1,
  endFrequencyRatio: 0.8,
});
const beep = (frequency = 440, duration = 0.1, delay = 0) =>
  audio.beep(frequency, duration, 'sine', delay);
function toast(text, seconds = 2.6) {
  ui.toast.textContent = text;
  ui.toast.classList.add('show');
  toastUntil = performance.now() + seconds * 1000;
}
function pop(x, y, text, color = '#72512e') {
  effects.push({ x, y, text, color, life: 1 });
}
function setPlayingUI(playing) {
  ui.pause.classList.toggle('hidden', !playing);
  ui['trail-progress'].classList.toggle('hidden', !playing);
  ui['touch-controls'].classList.toggle('hidden', !playing || !coarse);
}
function gameEvent(type, detail = {}) {
  if (type === 'start') {
    view.cameraX = 0;
    effects.length = 0;
    ui.overlay.classList.add('hidden');
    ui.results.classList.add('hidden');
    ui.toast.classList.remove('show');
    setPlayingUI(true);
  } else if (type === 'jump') beep(480, 0.12);
  else if (type === 'treat') {
    pop(detail.x, detail.y, '+10');
    beep(880, 0.08);
  } else if (type === 'bounce') {
    pop(detail.x, detail.y, detail.firstBounce ? '+25' : 'Boing!', '#83572a');
    beep(620, 0.16);
  } else if (type === 'checkpoint') {
    pop(detail.x + 20, detail.y - 30, '+50', '#346846');
    toast('Checkpoint saved! A little water break restores one heart.');
    beep(523);
    beep(784, 0.17, 0.12);
  } else if (type === 'hurt') {
    toast(
      detail.reason === 'fall'
        ? 'Back to your last paw flag. You’ve got this, CiCi!'
        : 'Cheeky squirrel! Hop over the next one.',
    );
    beep(170, 0.2);
    if (detail.respawn) {
      view.cameraX = Math.max(0, state.player.x - view.width * followAnchor());
      clearInput();
    }
  } else if (type === 'pause') {
    clearInput();
    setPlayingUI(false);
    ui.overlay.classList.remove('hidden');
    ui['intro-details'].classList.add('hidden');
    ui.results.classList.add('hidden');
    ui['menu-eyebrow'].textContent = 'A LITTLE PAWS';
    ui['menu-title'].textContent = 'Sniff break.';
    ui['menu-description'].textContent = 'The treats can wait. Your adventure is paused.';
    ui.start.innerHTML = 'KEEP GOING <span aria-hidden="true">↗</span>';
    ui.restart.classList.remove('hidden');
    ui.start.focus({ preventScroll: true });
  } else if (type === 'resume') {
    ui.overlay.classList.add('hidden');
    setPlayingUI(true);
    canvas.focus({ preventScroll: true });
  } else if (type === 'won' || type === 'lost') {
    clearInput();
    setPlayingUI(false);
    ui.overlay.classList.remove('hidden');
    ui['intro-details'].classList.add('hidden');
    ui.results.classList.remove('hidden');
    ui.restart.classList.add('hidden');
    ui.toast.classList.remove('show');
    const won = type === 'won',
      record = won && state.score > best;
    if (record) {
      best = state.score;
      writeStoredNumber(BEST_SCORE_KEY, best);
      ui.best.textContent = best;
    }
    ui['menu-eyebrow'].textContent = won
      ? record
        ? 'A PERSONAL BEST FOR A VERY GOOD DOG'
        : 'THE PICNIC IS SERVED'
      : 'EVERY GOOD DOG GETS ANOTHER TRY';
    ui['menu-title'].textContent = won ? 'Picnic time!' : 'One more walk?';
    ui['menu-description'].textContent = won
      ? `CiCi brought ${state.treats} treats to the picnic. That deserves a belly rub.`
      : 'A few squirrels got in the way. Let’s try that trail again.';
    ui.results.innerHTML = `<div><span>TREATS</span><strong>${state.treats} / ${level.treats.length}</strong></div><div><span>SCORE</span><strong>${state.score}</strong></div><div><span>TRAIL TIME</span><strong>${formatTime(state.elapsed)}</strong></div><div><span>BEST PICNIC</span><strong>${best}</strong></div>`;
    ui.start.innerHTML = `${won ? 'ANOTHER ADVENTURE' : 'TRY AGAIN'} <span aria-hidden="true">↗</span>`;
    ui.start.focus({ preventScroll: true });
    beep(won ? 523 : 220, 0.16);
    if (won) {
      beep(659, 0.14, 0.14);
      beep(784, 0.23, 0.28);
    }
  }
}
function startGame() {
  clearInput();
  adventure.start();
  canvas.focus({ preventScroll: true });
  updateUI();
}
function pauseGame() {
  adventure.pause();
  updateUI();
}
function resumeGame() {
  clearInput();
  adventure.resume();
  updateUI();
}
ui.start.addEventListener('click', () => (state.mode === 'paused' ? resumeGame() : startGame()));
ui.restart.addEventListener('click', startGame);
ui.pause.addEventListener('click', pauseGame);
document.addEventListener('keydown', (event) => {
  if (event.repeat) return;
  if (event.code === 'KeyP' || event.code === 'Escape') {
    state.mode === 'paused' ? resumeGame() : pauseGame();
  }
  if (
    event.code === 'Enter' &&
    event.target.tagName !== 'BUTTON' &&
    ['menu', 'paused', 'won', 'lost'].includes(state.mode)
  ) {
    event.preventDefault();
    state.mode === 'paused' ? resumeGame() : startGame();
  }
});

function update(dt) {
  adventure.update(dt, controls.snapshot(frameInput));
}
function updateUI() {
  setText(ui.treats, `${state.treats} / ${level.treats.length}`);
  setText(ui.score, state.score);
  setText(ui.hearts, '♥'.repeat(state.hearts) + '♡'.repeat(MAX_HEARTS - state.hearts));
  setAttribute(ui.hearts, 'aria-label', `${state.hearts} hearts remaining`);
  const pct = Math.max(
    0,
    Math.min(100, ((state.player.x - level.spawn.x) / (level.finish.x - level.spawn.x)) * 100),
  );
  const progress = state.mode === 'won' ? 100 : pct;
  if (ui.progress.value !== progress) ui.progress.value = progress;
  setText(ui['progress-label'], `${Math.round(progress)}%`);
  setText(
    ui.zone,
    state.player.x < level.checkpoints[0].x
      ? 'MEADOW MUNCHIES'
      : state.player.x < level.checkpoints[1].x
        ? 'ACORN ALLEY'
        : 'PICNIC PARK',
  );
  setText(
    ui['checkpoint-label'],
    state.checkpointId ? 'Paw flag saved · onward to the picnic' : 'Next stop: a picnic!',
  );
}
function resize() {
  const width = ui.viewport.clientWidth,
    height = ui.viewport.clientHeight,
    dpr = Math.min(devicePixelRatio, 2);
  if (width <= 0 || height <= 0) return;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  view.height = width < 650 && height > width ? 560 : 500;
  view.width = (width / height) * view.height;
  view.cameraX = Math.max(0, Math.min(level.width - view.width, view.cameraX));
}
const visible = (x, w = 50) => x + w >= view.cameraX - 80 && x <= view.cameraX + view.width + 80;
const backgroundView = { ...view, time: 0 };
const menuPlayer = {};
const checkpointView = {};
function render() {
  const time = reducedMotion ? 0 : animationTime;
  ctx.setTransform(canvas.width / view.width, 0, 0, canvas.height / view.height, 0, 0);
  ctx.clearRect(0, 0, view.width, view.height);
  Object.assign(backgroundView, view);
  backgroundView.time = time;
  art.drawBackground(ctx, backgroundView);
  ctx.save();
  ctx.translate(-view.cameraX, 0);
  for (const platform of level.platforms)
    if (visible(platform.x, platform.w)) art.drawPlatform(ctx, platform);
  for (const checkpoint of level.checkpoints)
    if (visible(checkpoint.x, 80)) {
      Object.assign(checkpointView, checkpoint);
      checkpointView.y += 48;
      art.drawCheckpoint(ctx, checkpointView, time);
    }
  if (visible(level.finish.x, level.finish.w + 80)) art.drawFinish(ctx, level.finish, time);
  for (const treat of level.treats)
    if (!treat.collected && visible(treat.x, 20)) art.drawTreat(ctx, treat.x, treat.y, time);
  for (const squirrel of level.squirrels)
    if (visible(squirrel.x, squirrel.w)) art.drawSquirrel(ctx, squirrel, time);
  if (state.mode === 'menu' && view.width > 650) {
    Object.assign(menuPlayer, state.player);
    menuPlayer.x = view.cameraX + view.width * 0.76 - 50;
    menuPlayer.y = 307;
    menuPlayer.w = 108;
    menuPlayer.h = 113;
    menuPlayer.vx = 0;
    art.drawCici(ctx, menuPlayer, time);
  } else art.drawCici(ctx, state.player, time);
  ctx.textAlign = 'center';
  ctx.font = 'bold 16px Trebuchet MS, sans-serif';
  for (const effect of effects) {
    ctx.globalAlpha = Math.max(0, effect.life);
    ctx.fillStyle = effect.color;
    ctx.fillText(effect.text, effect.x, effect.y - (1 - effect.life) * 34);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}
function animate(dt, now) {
  update(dt);
  if (state.mode !== 'paused') {
    animationTime += dt;
    for (let i = effects.length - 1; i >= 0; i--) {
      effects[i].life -= dt * 1.2;
      if (effects[i].life <= 0) effects.splice(i, 1);
    }
  }
  const target = Math.max(
    0,
    Math.min(level.width - view.width, state.player.x - view.width * followAnchor()),
  );
  if (state.mode === 'playing' || state.mode === 'won')
    view.cameraX += (target - view.cameraX) * (1 - Math.exp(-dt * 8));
  uiTimer -= dt;
  if (uiTimer <= 0) {
    updateUI();
    uiTimer = 0.075;
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
    controls.dispose();
    audio.dispose();
  },
});
setPlayingUI(false);
updateUI();
ui['load-state'].classList.add('hidden');
loop.start();
if (new URLSearchParams(location.search).has('debug'))
  window.ciciDebug = {
    state,
    level,
    adventure,
    startGame,
    pauseGame,
    resumeGame,
    update,
    keys,
    clearInput,
    render,
    view,
    canvas,
    updateUI,
  };

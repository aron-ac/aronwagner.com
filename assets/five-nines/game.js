import { createShift, clockOf, formatUptime, SHIFT_SECONDS, DOWN } from './shift.js';
import { RACKS, ROW_LENGTH, HELP_DESK, ARON_Y } from './floor.js';
import { loadSprites, ARON_HEIGHT } from './sprites.js';
import * as art from './art.js';
import { createSynthAudio } from '../shared/audio.js';
import { createGameInput } from '../shared/input.js';
import { bindTouchAction } from '../shared/touch-action.js';
import { createGameLoop } from '../shared/game-loop.js';
import { requireElements, setText, setAttribute, isInteractiveTarget } from '../shared/dom.js';
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
  'action',
  'uptime',
  'happiness',
  'happy-fill',
  'tickets',
  'clock',
  'shift-fill',
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
const hudElement = document.querySelector('.hud');
if (!ctx) {
  ui['load-state'].textContent = 'This game needs a browser with Canvas support.';
  throw new Error('Canvas unavailable');
}
const sheets = await loadSprites();
const shift = createShift(gameEvent);
const state = shift.state;
// The scene is 600 tall; at least SKY of ceiling goes above it for the HUD.
const SKY = 110;
const view = { x: 0, y: -SKY, width: 1000, height: 600 + SKY, zoom: 1, shake: 0 };
const controls = createGameInput({
  bindings: {
    left: ['KeyA', 'ArrowLeft'],
    right: ['KeyD', 'ArrowRight'],
    action: ['Space', 'KeyE', 'ArrowUp', 'KeyW'],
  },
  isActive: () => state.mode === 'playing',
});
const keys = controls.keys;
const clearInput = () => controls.clear();
const frameInput = {};
const coarse = matchMedia('(pointer:coarse)').matches || navigator.maxTouchPoints > 0;
const reducedMotion = matchMedia('(prefers-reduced-motion:reduce)').matches;
const BEST_SCORE_KEY = 'five-nines-best-score';
let best = Math.max(0, readStoredNumber(BEST_SCORE_KEY));
let toastUntil = 0,
  animationTime = 0,
  uiTimer = 0;
const popups = [];
const seen = new Set();
ui.best.textContent = best;
const audio = createSynthAudio({
  button: ui.sound,
  volume: 0.03,
  duration: 0.1,
  endFrequencyRatio: 0.85,
});
const beep = (frequency = 440, duration = 0.1, delay = 0, type = 'sine') =>
  audio.beep(frequency, duration, type, delay);
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const rackById = Object.fromEntries(RACKS.map((rack) => [rack.id, rack]));

function toast(text, seconds = 3) {
  ui.toast.textContent = text;
  ui.toast.classList.add('show');
  toastUntil = performance.now() + seconds * 1000;
}
function popup(x, y, text, color) {
  popups.push({ x, y, text, color, life: 1 });
}
const aboveAron = () => ARON_Y - ARON_HEIGHT - 20;
function customers(delta) {
  if (!delta) return;
  popup(
    state.aron.x,
    aboveAron(),
    `${delta > 0 ? '+' : '−'}${Math.abs(Math.round(delta))} ☺`,
    delta > 0 ? '#6dffae' : '#ff7b7b',
  );
}
function setPlayingUI(playing) {
  ui.pause.classList.toggle('hidden', !playing);
  ui['touch-controls'].classList.toggle('hidden', !playing || !coarse);
}
function showMenu({ eyebrow, title, description, button, results = false, restart = false }) {
  clearInput();
  setPlayingUI(false);
  ui.overlay.classList.remove('hidden');
  ui['intro-details'].classList.add('hidden');
  ui.results.classList.toggle('hidden', !results);
  ui.restart.classList.toggle('hidden', !restart);
  ui.toast.classList.remove('show');
  ui['menu-eyebrow'].textContent = eyebrow;
  ui['menu-title'].textContent = title;
  ui['menu-description'].textContent = description;
  ui.start.innerHTML = `${button} <span aria-hidden="true">↗</span>`;
  ui.start.focus({ preventScroll: true });
}

const PROBLEM_NEWS = {
  cable: (rack) => `${rack.name} is down. Someone tripped over a cable.`,
  disk: (rack) => `${rack.name}: disk full. Swap in a bigger drive.`,
  heat: (rack) => `${rack.name} is running hot. Cool it before it catches fire.`,
  traffic: () => 'Traffic spike on the Load Balancers! Scale them up.',
  fire: (rack) => `${rack.name} is on fire. Grab the extinguisher.`,
  crash: (rack) => `${rack.name} crashed. Reboot it.`,
};
const FIXED_NEWS = {
  cable: 'Plugged back in.',
  disk: 'Bigger drive. Problem solved.',
  heat: 'Cooled down.',
  traffic: 'Scaled up.',
  fire: 'Fire’s out!',
  crash: 'Back up!',
};

const ENDINGS = {
  five: (r) => [
    'FIVE NINES',
    'Flawless.',
    `${formatUptime(r.uptime)} uptime and happy customers. Put it on the website.`,
  ],
  four: () => [
    'FOUR NINES',
    'Great shift.',
    'So close to perfect. Sales will round it up to five.',
  ],
  ghosted: () => [
    'UP, BUT…',
    'The servers are fine.',
    'The customers are not. Answer the tickets next time.',
  ],
  three: () => [
    'THREE NINES',
    'Not bad.',
    'A few blips. Nobody’s writing a blog post about it. Probably.',
  ],
  rough: () => [
    'LET’S CALL IT A LEARNING EXPERIENCE',
    'Rough night.',
    'Lots of red on the board. Catch the warnings before they get worse.',
  ],
  churn: () => [
    'EVERYONE LOGGED OFF',
    'The customers gave up.',
    'Too many outages and unanswered tickets. The help desk is right in the middle.',
  ],
};

function gameEvent(type, detail = {}) {
  if (type === 'start') {
    popups.length = 0;
    seen.clear();
    ui.overlay.classList.add('hidden');
    ui.results.classList.add('hidden');
    setPlayingUI(true);
    snapCamera();
    toast('9 PM. Nine racks, one of you. Run to trouble and hold Space to fix it.', 4);
    canvas.focus({ preventScroll: true });
  } else if (type === 'problem') {
    const { rack, problem } = detail;
    // Explain each kind of trouble the first time; after that, just the name.
    const first = !seen.has(problem.kind);
    seen.add(problem.kind);
    if (first || DOWN.has(problem.kind)) toast(PROBLEM_NEWS[problem.kind](rack), first ? 4 : 2.5);
    if (DOWN.has(problem.kind)) {
      beep(220, 0.14, 0, 'square');
      beep(180, 0.2, 0.14, 'square');
    } else beep(520, 0.08);
  } else if (type === 'worse' && detail.to === 'fire') view.shake = 0.4;
  else if (type === 'spread') {
    toast(`The fire in ${detail.rack.name} is spreading!`, 3);
    view.shake = 0.3;
  } else if (type === 'fixed') {
    const { rack, problem, closed } = detail;
    popup(rack.x, art.rackBounds(rack).y + 40, FIXED_NEWS[problem.kind], '#6dffae');
    if (closed.length) {
      toast(
        closed.length > 1
          ? `${closed.length} tickets closed themselves. Everyone’s happy.`
          : 'Their ticket closed itself. “Oh, it’s back!”',
        2.5,
      );
      popup(HELP_DESK.x, 200, `+${closed.length * 6} ☺`, '#6dffae');
    }
    beep(660, 0.08);
    beep(990, 0.12, 0.09);
  } else if (type === 'ticket') {
    if (!seen.has('ticket')) {
      seen.add('ticket');
      toast('A customer ticket! Answer it at the help desk.', 3.5);
    }
    beep(880, 0.05);
    beep(880, 0.05, 0.1);
  } else if (type === 'answered') {
    customers(detail.happiness);
    toast(
      detail.stillDown
        ? '“We’re on it.” Now go fix it.'
        : pick(['“It’s up. Try refreshing?”', '“All good on our end!”', '“Happy to help!”']),
      2,
    );
    beep(740, 0.08);
  } else if (type === 'ignored') {
    customers(detail.happiness);
    toast('A customer gave up waiting and posted about it.', 2.5);
    beep(200, 0.22);
  } else if (type === 'coffee') {
    toast('Coffee. You feel faster.', 2);
    beep(600, 0.08);
    beep(800, 0.1, 0.08);
  } else if (type === 'pause') {
    showMenu({
      eyebrow: 'HOLD ON',
      title: 'Snack break.',
      description: 'The racks are frozen in time. Nothing breaks while you’re away.',
      button: 'BACK TO WORK',
      restart: true,
    });
  } else if (type === 'resume') {
    ui.overlay.classList.add('hidden');
    setPlayingUI(true);
    canvas.focus({ preventScroll: true });
  } else if (type === 'done') {
    const record = detail.score > best && detail.reason === 'morning';
    if (record) {
      best = detail.score;
      writeStoredNumber(BEST_SCORE_KEY, best);
      ui.best.textContent = best;
    }
    const [eyebrow, title, description] = ENDINGS[detail.ending](detail);
    showMenu({
      eyebrow: record ? `A NEW BEST SHIFT · ${eyebrow}` : eyebrow,
      title,
      description,
      button: 'ANOTHER SHIFT',
      results: true,
    });
    ui.results.innerHTML = `<div><span>UPTIME</span><strong>${formatUptime(detail.uptime)}</strong></div><div><span>CUSTOMERS</span><strong>${detail.happiness}%</strong></div><div><span>SCORE</span><strong>${detail.score}</strong></div><div><span>BEST SHIFT</span><strong>${best}</strong></div>`;
    const good = detail.reason === 'morning' && detail.nines >= 3;
    beep(good ? 523 : 220, 0.16);
    if (good) {
      beep(659, 0.14, 0.14);
      beep(784, 0.23, 0.28);
    }
  }
}

function startGame() {
  clearInput();
  const seed = Number(new URLSearchParams(location.search).get('seed')) || undefined;
  shift.start(seed ? { seed } : {});
  updateUI();
}
function pauseGame() {
  shift.pause();
  updateUI();
}
function resumeGame() {
  clearInput();
  shift.resume();
  updateUI();
}
function primaryAction() {
  if (state.mode === 'paused') resumeGame();
  else startGame();
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
    ['menu', 'paused', 'done'].includes(state.mode)
  ) {
    event.preventDefault();
    primaryAction();
  }
});

function update(dt) {
  shift.update(dt, controls.snapshot(frameInput));
}

function updateUI() {
  const uptime = shift.uptime;
  setText(ui.uptime, formatUptime(uptime));
  ui.uptime.parentElement.classList.toggle('warn', uptime < 99.99 && uptime >= 99.9);
  ui.uptime.parentElement.classList.toggle('bad', uptime < 99.9);
  const happy = Math.round(state.happiness);
  setText(ui.happiness, `${happy}%`);
  ui['happy-fill'].style.width = `${happy}%`;
  setAttribute(ui.happiness, 'aria-label', `Customers are ${happy}% happy`);
  setText(ui.tickets, state.tickets.length);
  setText(ui.clock, clockOf(state.elapsed));
  ui['shift-fill'].style.width =
    `${(Math.min(state.elapsed, SHIFT_SECONDS) / SHIFT_SECONDS) * 100}%`;
  const action = shift.availableAction();
  setText(ui.action, action ? action.label : 'FIX');
  ui.action.classList.toggle('ready', Boolean(action));
}

function resize() {
  const width = ui.viewport.clientWidth,
    height = ui.viewport.clientHeight,
    dpr = Math.min(devicePixelRatio, 2);
  if (width <= 0 || height <= 0) return;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  // Landscape shows the scene plus enough ceiling for the HUD to sit over
  // (bubbles float near the top of the scene). Portrait shows 640 units
  // across, unless that would crop the scene, and adds ceiling and floor.
  const hud = hudElement.getBoundingClientRect().bottom - ui.viewport.getBoundingClientRect().top;
  const sky = Math.max(SKY, (600 * (hud + 8)) / Math.max(1, height - hud - 8));
  const tall = height / (600 + sky);
  view.zoom = width >= height ? tall : Math.min(width / 640, tall);
  view.width = width / view.zoom;
  view.height = height / view.zoom;
  view.y = Math.min(-sky, (600 - view.height) * 0.62);
  snapCamera();
}
function cameraTarget() {
  const a = state.aron;
  // On the menu, keep Aron clear of the menu card on the left.
  if (state.mode === 'menu' && view.width > 900) return a.x - view.width * 0.6;
  // In portrait, center Aron so he stands between the arrows and the fix button.
  const ahead = view.height > view.width ? 0.5 : a.facing > 0 ? 0.4 : 0.6;
  return Math.max(0, Math.min(ROW_LENGTH - view.width, a.x - view.width * ahead));
}
function snapCamera() {
  view.x = cameraTarget();
}

function render() {
  const time = reducedMotion ? 0 : animationTime;
  const a = state.aron;
  const scale = (canvas.width / (view.width * view.zoom)) * view.zoom;
  const shake = view.shake > 0 && !reducedMotion ? Math.sin(time * 90) * 8 * view.shake : 0;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, view.width, view.height);
  ctx.save();
  ctx.translate(shake, -view.y);
  ctx.save();
  ctx.translate(-view.x, 0);
  art.drawRoom(ctx, view, time);
  art.drawScenery(ctx, sheets, 'back', view);
  for (const rack of RACKS) art.drawRack(ctx, sheets, rack, state.racks[rack.id], time);
  art.drawBoard(ctx, shift.uptime, state.racks);
  art.drawTickets(ctx, sheets, state.tickets, time);
  art.drawAronFigure(ctx, sheets, a);
  for (const rack of RACKS)
    if (state.racks[rack.id].problem?.kind === 'fire') art.drawFire(ctx, sheets, rack, time);
  const action = shift.availableAction();
  if (a.fixing === 'spray' && action?.rack)
    art.drawFoam(ctx, sheets, art.nozzle(a), { x: action.rack.x, y: 330 }, time);
  art.drawScenery(ctx, sheets, 'front', view);
  art.drawPlacards(ctx, state.racks);
  for (const rack of RACKS) {
    const problem = state.racks[rack.id].problem;
    if (problem) art.drawProblemBubble(ctx, sheets, rack, problem, time);
  }
  if (action && !coarse && state.mode === 'playing')
    art.drawPrompt(ctx, a.x, aboveAron(), `SPACE · ${action.label}`);
  for (const effect of popups) art.drawPopup(ctx, effect);
  ctx.restore();
  // Point to trouble that's off camera, nearest first on each side.
  if (state.mode === 'playing') {
    const slots = { '-1': 0, 1: 0 };
    const edge = (x, options) => {
      const sx = x - view.x;
      if (sx > 20 && sx < view.width - 20) return;
      const direction = sx < 0 ? -1 : 1;
      const slot = slots[direction]++;
      if (slot > 2) return;
      art.drawPointer(ctx, sheets, {
        x: direction < 0 ? 40 : view.width - 40,
        y: 250 + slot * 70,
        direction,
        time,
        ...options,
      });
    };
    const troubled = RACKS.filter((rack) => state.racks[rack.id].problem).sort(
      (p, q) => Math.abs(p.x - a.x) - Math.abs(q.x - a.x),
    );
    for (const rack of troubled) {
      const kind = state.racks[rack.id].problem.kind;
      edge(rack.x, { kind, color: DOWN.has(kind) ? '#ff4b4b' : '#ffc23d' });
    }
    if (state.tickets.length) edge(HELP_DESK.x, { kind: 'ticket', color: '#9cc3ff' });
  }
  ctx.restore();
}

function animate(dt, now) {
  update(dt);
  if (state.mode !== 'paused') {
    animationTime += dt;
    for (let i = popups.length - 1; i >= 0; i--) {
      popups[i].life -= dt * 0.7;
      if (popups[i].life <= 0) popups.splice(i, 1);
    }
    view.shake = Math.max(0, view.shake - dt);
  }
  if (state.mode === 'playing') view.x += (cameraTarget() - view.x) * (1 - Math.exp(-dt * 5));
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
  window.ninesDebug = {
    state,
    shift,
    racks: rackById,
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
    snapCamera,
  };

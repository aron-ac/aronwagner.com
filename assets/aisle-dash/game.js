import { createShoppingDay, BUDGET, priceOf } from './shopping.js';
import { STORES } from './stores.js';
import { loadSprites } from './sprites.js';
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
  'budget',
  'happiness',
  'happy-fill',
  'bags',
  'day-panel',
  'patience',
  'patience-label',
  'zone',
  'objective',
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
  ui['load-state'].textContent = 'This game needs a browser with Canvas support.';
  throw new Error('Canvas unavailable');
}
const sheets = await loadSprites();
const day = createShoppingDay(gameEvent);
const state = day.state;
const view = { x: 0, y: 0, width: 1000, height: 600, zoom: 1, shake: 0 };
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
const BEST_SCORE_KEY = 'aisle-dash-best-score';
let best = Math.max(0, readStoredNumber(BEST_SCORE_KEY));
let toastUntil = 0,
  animationTime = 0,
  uiTimer = 0,
  lessonShown = false;
const popups = [],
  bursts = [],
  flights = [];
const speech = { text: '', until: 0 };
ui.best.textContent = best;
const audio = createSynthAudio({
  button: ui.sound,
  volume: 0.03,
  duration: 0.1,
  endFrequencyRatio: 0.85,
});
const beep = (frequency = 440, duration = 0.1, delay = 0) =>
  audio.beep(frequency, duration, 'sine', delay);
const pick = (list) => list[Math.floor(Math.random() * list.length)];

function toast(text, seconds = 3) {
  ui.toast.textContent = text;
  ui.toast.classList.add('show');
  toastUntil = performance.now() + seconds * 1000;
}
function say(text, seconds = 1.8) {
  speech.text = text;
  speech.until = state.elapsed + seconds;
}
const headOf = (r) => ({ x: r.x, y: art.REBECCA_Y - art.REBECCA_HEIGHT - 10 });
function popup(x, y, text, color) {
  popups.push({ x, y, text, color, life: 1 });
}
function mood(delta) {
  if (!delta) return;
  const head = headOf(state.rebecca);
  popup(
    head.x + 40,
    head.y,
    `${delta > 0 ? '+' : '−'}${Math.abs(delta)} ♥`,
    delta > 0 ? '#e0486f' : '#7a6f66',
  );
  if (delta > 0) bursts.push({ x: head.x, y: head.y + 30, t: 0 });
}
function spend(price) {
  const handle = art.handleOf(state.aron);
  popup(handle.x, handle.y - 60, `−$${price}`, '#cf3a3d');
}
function fly(icon) {
  const r = state.rebecca,
    handle = art.handleOf(state.aron);
  flights.push({
    icon,
    from: { x: r.x + 60, y: art.REBECCA_Y - 150 },
    to: { x: handle.x, y: handle.y + 20 },
    t: 0,
  });
}
function setPlayingUI(playing) {
  ui.pause.classList.toggle('hidden', !playing);
  ui['day-panel'].classList.toggle('hidden', !playing);
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

const ENDINGS = {
  perfect: (r) => [
    'HAPPY WIFE. HAPPY WALLET.',
    'Perfect day.',
    `Rebecca’s smiling and you still have $${r.money}. Nailed it.`,
  ],
  broke: (r) => [
    'SHE HAD THE BEST TIME',
    'She’s thrilled. The bank account is not.',
    `$${r.money} left. Worth it? Probably.`,
  ],
  stingy: (r) => ['YOU WON THE BUDGET', `You saved $${r.money}.`, 'And she’s not speaking to you.'],
  rough: () => [
    'THAT DIDN’T GO GREAT',
    'Rough day.',
    'Low on money, low on smiles. Maybe try the coffee next time.',
  ],
  solid: () => ['NOT BAD AT ALL', 'Solid day.', 'Nobody cried. Mostly.'],
  meltdown: () => [
    'JACK HAS SPOKEN',
    'Everyone’s going home.',
    'Jack’s patience ran out. Grab his pacifier when he throws it.',
  ],
};

function gameEvent(type, detail = {}) {
  if (type === 'start' || type === 'stop') {
    popups.length = bursts.length = flights.length = 0;
    speech.until = 0;
    ui.overlay.classList.add('hidden');
    ui.results.classList.add('hidden');
    setPlayingUI(true);
    snapCamera();
    toast(
      type === 'start'
        ? 'Target first. Stay close to Rebecca.'
        : 'International Plaza. The budget carries over.',
    );
    canvas.focus({ preventScroll: true });
  } else if (type === 'moment') beep(detail.moment.kind === 'looking' ? 520 : 700, 0.08);
  else if (type === 'bought') {
    spend(detail.price);
    fly(detail.moment.icon);
    mood(detail.happiness);
    say(
      detail.moment.sale
        ? 'And it was on sale!'
        : pick(['Yay, thank you!', 'You get me.', 'Love it.']),
    );
    if (detail.usedCoupon) toast('Coupon applied: 20% off.');
    beep(660, 0.08);
    beep(880, 0.12, 0.09);
  } else if (type === 'trap') {
    spend(detail.price);
    fly(detail.moment.icon);
    mood(detail.happiness);
    say('I was just looking…');
    if (!lessonShown) {
      lessonShown = true;
      toast('Hearts mean she wants it. “Hmm…” means she’s just looking.', 4);
    }
    beep(240, 0.18);
  } else if (type === 'declined' && detail.counter) {
    toast('Card declined. No treat this time.');
    view.shake = 0.35;
    beep(180, 0.25);
  } else if (type === 'declined') {
    mood(detail.happiness);
    say('I’ll get this one…');
    toast('Card declined. She paid. Awkward.');
    view.shake = 0.35;
    beep(180, 0.25);
  } else if (type === 'complimented') {
    mood(detail.happiness);
    say(pick(['Aww, thank you.', 'Stop it. (Don’t stop.)', 'You’re sweet.']));
    beep(740, 0.1);
    beep(988, 0.14, 0.1);
  } else if (type === 'ignored') {
    mood(detail.happiness);
    say('…you didn’t even look.');
    beep(220, 0.2);
  } else if (type === 'passed') {
    mood(detail.happiness);
    say('Maybe next time.');
  } else if (type === 'shrugged') say('Nah.', 1.1);
  else if (type === 'craving') {
    const counter = detail.counter;
    toast(
      counter.kind === 'coffee'
        ? 'Rebecca could really go for a coffee. The coffee bar is back by the entrance.'
        : 'Rebecca’s craving a cupcake from Sugar Rush.',
      4,
    );
    say(counter.kind === 'coffee' ? 'I could really go for a coffee.' : 'Ooh, cupcakes…', 2.4);
    beep(560, 0.1);
    beep(700, 0.1, 0.12);
  } else if (type === 'ordered') {
    spend(detail.price);
    toast('Now bring it to her.');
    beep(620, 0.08);
  } else if (type === 'delivered') {
    mood(detail.happiness);
    say(detail.craved ? 'You’re the best.' : 'Aww, for me?');
    beep(784, 0.1);
    beep(1047, 0.16, 0.1);
  } else if (type === 'craving-missed') {
    mood(detail.happiness);
    say('Guess I’ll get it myself.');
  } else if (type === 'coupon') {
    popup(state.aron.x, art.ARON_Y - 300, '20% OFF', '#b27b0e');
    toast('Coupon! 20% off your next purchase.');
    beep(900, 0.08);
  } else if (type === 'toss') {
    toast('Jack threw his pacifier! Grab it before he gets fussy.', 3);
    beep(420, 0.08);
    beep(300, 0.12, 0.08);
  } else if (type === 'pacifier') {
    popup(state.aron.x, art.ARON_Y - 300, 'Crisis averted', '#4f8db5');
    beep(500, 0.08);
    beep(750, 0.1, 0.08);
  } else if (type === 'leaving') {
    toast(
      detail.store.id === 'target'
        ? 'She’s done here. Meet her at checkout.'
        : 'Ready to head home? Meet her at the exit.',
      3.5,
    );
    say(detail.store.id === 'target' ? 'Okay, I’m done. Checkout?' : 'Ready to go home?', 2);
  } else if (type === 'between') {
    showMenu({
      eyebrow: `${detail.store.name.toUpperCase()}: DONE`,
      title: `Next stop: ${detail.next.name}.`,
      description: `You spent $${detail.spent} at ${detail.store.name}. Jack napped in the car, so he’s a little more patient.`,
      button: 'ON TO THE MALL',
    });
    beep(523, 0.12);
    beep(659, 0.14, 0.12);
  } else if (type === 'pause') {
    showMenu({
      eyebrow: 'HOLD ON',
      title: 'Bench break.',
      description: 'Jack dozed off for a second. Your shopping day is paused.',
      button: 'KEEP SHOPPING',
      restart: true,
    });
  } else if (type === 'resume') {
    ui.overlay.classList.add('hidden');
    setPlayingUI(true);
    canvas.focus({ preventScroll: true });
  } else if (type === 'done') {
    const record = detail.score > best && detail.reason === 'home';
    if (record) {
      best = detail.score;
      writeStoredNumber(BEST_SCORE_KEY, best);
      ui.best.textContent = best;
    }
    const [eyebrow, title, description] = ENDINGS[detail.ending](detail);
    showMenu({
      eyebrow: record ? 'A NEW BEST DAY' : eyebrow,
      title,
      description,
      button: 'ANOTHER DAY OUT',
      results: true,
    });
    ui.results.innerHTML = `<div><span>HAPPINESS</span><strong>${detail.happiness}%</strong></div><div><span>MONEY LEFT</span><strong>$${detail.money}</strong></div><div><span>SCORE</span><strong>${detail.score}</strong></div><div><span>BEST DAY</span><strong>${best}</strong></div>`;
    const good = detail.reason === 'home' && detail.happiness >= 45;
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
  day.start(seed ? { seed } : {});
  updateUI();
}
function pauseGame() {
  day.pause();
  updateUI();
}
function resumeGame() {
  clearInput();
  day.resume();
  updateUI();
}
function continueDay() {
  clearInput();
  day.continueDay();
  updateUI();
}
function primaryAction() {
  if (state.mode === 'paused') resumeGame();
  else if (state.mode === 'between') continueDay();
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
    ['menu', 'paused', 'between', 'done'].includes(state.mode)
  ) {
    event.preventDefault();
    primaryAction();
  }
});

function update(dt) {
  day.update(dt, controls.snapshot(frameInput));
}

function sectionName() {
  const store = state.store;
  if (!store.sections.length) return store.short;
  let current = store.sections[0];
  for (const section of store.sections) if (state.aron.x >= section.x - 260) current = section;
  return `${store.short} · ${current.name}`;
}
function objective() {
  const r = state.rebecca,
    counter = state.craving && state.store.counters.find((c) => c.id === state.craving.counter);
  if (state.pacifier.out) return 'Grab Jack’s pacifier!';
  if (r.task === 'leave' || r.task === 'waiting')
    return state.store.id === 'target' ? 'Meet Rebecca at checkout' : 'Meet Rebecca at the exit';
  if (state.aron.carrying) return `Bring Rebecca her ${state.aron.carrying.name.toLowerCase()}`;
  if (counter) return `She wants a ${counter.name.toLowerCase()}`;
  if (state.moment) return 'She has her eye on something';
  if (state.coupon) return 'Coupon ready: 20% off next buy';
  return 'Stay close to Rebecca';
}

function updateUI() {
  setText(ui.budget, `$${state.money}`);
  const happy = Math.round(state.happiness);
  setText(ui.happiness, `${happy}%`);
  ui['happy-fill'].style.width = `${happy}%`;
  setText(ui.bags, state.bags);
  setAttribute(ui.happiness, 'aria-label', `Rebecca is ${happy}% happy`);
  const patience = Math.round(state.patience);
  if (ui.patience.value !== patience) ui.patience.value = patience;
  ui['day-panel'].classList.toggle('low', patience < 30 || state.pacifier.out);
  setText(ui['patience-label'], `JACK ${patience}%`);
  setText(ui.zone, sectionName());
  setText(ui.objective, objective());
  const action = day.availableAction();
  setText(ui.action, action ? action.label : '···');
  ui.action.classList.toggle('ready', Boolean(action));
}

function resize() {
  const width = ui.viewport.clientWidth,
    height = ui.viewport.clientHeight,
    dpr = Math.min(devicePixelRatio, 2);
  if (width <= 0 || height <= 0) return;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  // Landscape shows the 600-unit scene top to bottom. Portrait shows 640 units
  // across and adds ceiling above and floor below for the HUD and controls.
  view.zoom = width >= height ? height / 600 : width / 640;
  view.width = width / view.zoom;
  view.height = height / view.zoom;
  view.y = Math.min(0, (600 - view.height) * 0.62);
  snapCamera();
}
function cameraTarget() {
  const a = state.aron;
  // On the menu, keep Aron and Rebecca clear of the menu card on the left.
  if (state.mode === 'menu' && view.width > 900) return a.x - view.width * 0.52;
  const ahead = a.facing > 0 ? 0.3 : 0.6;
  return Math.max(0, Math.min(state.store.length - view.width, a.x - view.width * ahead));
}
function snapCamera() {
  view.x = cameraTarget();
}

function render() {
  const time = reducedMotion ? 0 : animationTime;
  const store = state.store,
    a = state.aron,
    r = state.rebecca;
  const scale = (canvas.width / (view.width * view.zoom)) * view.zoom;
  const shake = view.shake > 0 && !reducedMotion ? Math.sin(time * 90) * 8 * view.shake : 0;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, view.width, view.height);
  ctx.save();
  ctx.translate(shake, -view.y);
  art.drawBackdrop(ctx, store, view, time);
  ctx.save();
  ctx.translate(-view.x, 0);
  art.drawFixtures(ctx, store, sheets, view, time);
  const leaving = r.task === 'leave' || r.task === 'waiting';
  const counter =
    state.craving && !a.carrying && store.counters.find((c) => c.id === state.craving.counter);
  for (const pickup of state.pickups) if (!pickup.taken) art.drawCoupon(ctx, pickup.x, time);
  art.drawRebeccaFigure(ctx, sheets, r, { browsing: Boolean(state.moment) });
  if (state.pacifier.out) art.drawPacifier(ctx, sheets, state.pacifier, state.elapsed, time);
  const inFlight = flights.filter((f) => f.t < 1).length;
  art.drawAronFigure(ctx, sheets, a, { bags: state.bags - inFlight, time });
  for (const flight of flights) art.drawFlyingItem(ctx, sheets, flight);
  for (const burst of bursts) art.drawHeartBurst(ctx, burst.x, burst.y, burst.t);
  // Overlays sit above the scene so thought bubbles are never hidden.
  if (state.moment)
    art.drawMoment(ctx, sheets, r, state.moment, {
      now: state.elapsed,
      price: state.moment.kind === 'outfit' ? 0 : priceOf(state.moment, state.coupon),
    });
  else if (speech.until > state.elapsed)
    art.drawSpeech(ctx, r.x, art.REBECCA_Y - art.REBECCA_HEIGHT - 16, speech.text);
  if (state.craving && !state.moment) {
    const icon = store.counters.find((c) => c.id === state.craving.counter).icon;
    art.drawCraving(ctx, sheets, r, icon, time);
  }
  if (r.waiting && !state.moment && speech.until <= state.elapsed)
    art.drawSpeech(ctx, r.x, art.REBECCA_Y - art.REBECCA_HEIGHT - 16, 'Babe? You coming?');
  const action = day.availableAction();
  if (action && !coarse && state.mode === 'playing')
    art.drawPrompt(ctx, a.x + a.facing * 40, art.ARON_Y - 312, `SPACE · ${action.label}`);
  for (const effect of popups) art.drawPopup(ctx, effect);
  ctx.restore();
  // Point to whatever needs Aron when it's off camera.
  if (state.mode === 'playing') {
    const edge = (x, y, options) => {
      const sx = x - view.x;
      if (sx > 20 && sx < view.width - 20) return;
      const direction = sx < 0 ? -1 : 1;
      art.drawPointer(ctx, sheets, {
        x: direction < 0 ? 50 : view.width - 50,
        y,
        direction,
        ...options,
      });
    };
    edge(r.x, 360, { label: '♥', color: '#e0486f' });
    if (counter) edge(counter.x, 440, { icon: counter.icon, color: '#cf3a3d' });
    if (state.pacifier.out) edge(state.pacifier.x, 520, { icon: 'pacifier', color: '#4f8db5' });
    if (leaving) edge(store.exit.x + 60, 280, { label: '→', color: '#e0a82e' });
  }
  ctx.restore();
}

function animate(dt, now) {
  update(dt);
  if (state.mode !== 'paused') {
    animationTime += dt;
    for (let i = popups.length - 1; i >= 0; i--) {
      popups[i].life -= dt * 0.8;
      if (popups[i].life <= 0) popups.splice(i, 1);
    }
    for (let i = bursts.length - 1; i >= 0; i--) {
      bursts[i].t += dt * 1.4;
      if (bursts[i].t >= 1) bursts.splice(i, 1);
    }
    for (let i = flights.length - 1; i >= 0; i--) {
      flights[i].t += dt * 1.8;
      if (flights[i].t >= 1) flights.splice(i, 1);
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
  window.aisleDebug = {
    state,
    day,
    stores: STORES,
    budget: BUDGET,
    startGame,
    pauseGame,
    resumeGame,
    continueDay,
    update,
    keys,
    clearInput,
    render,
    view,
    canvas,
    updateUI,
  };

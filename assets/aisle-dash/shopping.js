import { STORES } from './stores.js';

// Deterministic, side-on shopping-day simulation. No DOM or canvas: the
// controller feeds it input snapshots and draws the state. Positions are world
// x coordinates along each store; times are in seconds.
export const BUDGET = 250;
export const START_HAPPINESS = 50;
export const ARON_SPEED = 240;
export const REBECCA_SPEED = 118;
export const MOMENT_SECONDS = 9;
// She doesn't linger when she's only looking.
export const LOOKING_SECONDS = 4.5;
export const CRAVING_SECONDS = 25;
// Jack is patient while he has his pacifier and fussy once he's thrown it.
export const PATIENCE_DRAIN = 1;
export const FUSSY_DRAIN = 2.4;
export const PACIFIER_PATIENCE = 10;
export const TOSS_EVERY = [15, 25];
export const NAP_PATIENCE = 15;
export const REACH = 150;
export const COUNTER_REACH = 90;
export const DELIVERY_REACH = 110;
export const PICKUP_REACH = 40;
// Rebecca waits for Aron when he falls this far behind.
export const WAIT_DISTANCE = 620;
export const STOPS_PER_VISIT = 6;
export const REACTION_SECONDS = 1.4;

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

function shuffle(list, random) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Pick the spots Rebecca visits (in walking order) and what catches her eye. */
export function planVisit(store, random) {
  const spots = shuffle(store.spots, random);
  const must = spots.find((spot) => spot.dept === store.mustVisit);
  const chosen = [must, ...spots.filter((spot) => spot !== must)]
    .slice(0, STOPS_PER_VISIT)
    .sort((a, b) => a.x - b.x);
  const visit = chosen.map((spot) => {
    const items = store.items[spot.dept];
    const [name, price, hearts, icon] = items[Math.floor(random() * items.length)];
    if (store.outfitDepts.includes(spot.dept) && random() < 0.5)
      return {
        spot: spot.id,
        kind: 'outfit',
        name: spot.dept === 'shoes' ? 'How do these look?' : 'How does this look?',
        icon: spot.dept === 'shoes' ? 'sandals' : store.outfitIcon,
        price: 0,
      };
    return {
      spot: spot.id,
      kind: random() < 0.62 ? 'want' : 'looking',
      name,
      price,
      hearts,
      icon,
      sale: random() < 0.25,
    };
  });
  // Every visit teaches both tells: at least one real want and one "just looking".
  const buyable = visit.filter((moment) => moment.kind !== 'outfit');
  if (buyable.length && !buyable.some((moment) => moment.kind === 'looking'))
    buyable[buyable.length - 1].kind = 'looking';
  if (buyable.length > 1 && !buyable.some((moment) => moment.kind === 'want'))
    buyable[0].kind = 'want';
  return visit;
}

export function priceOf(moment, coupon) {
  let price = moment.price;
  if (moment.sale) price *= 0.7;
  if (coupon) price *= 0.8;
  return Math.max(1, Math.round(price));
}

export function createShoppingDay(onEvent = () => {}) {
  let store, random;
  const state = { mode: 'menu', elapsed: 0 };

  function enterStop(index) {
    store = STORES[index];
    Object.assign(state, {
      stopIndex: index,
      store,
      aron: { x: store.spawn.aron, vx: 0, facing: 1, carrying: null, walked: 0 },
      rebecca: {
        x: store.spawn.rebecca,
        facing: 1,
        moving: false,
        target: null,
        task: 'idle',
        wait: 0.8,
        holding: null,
        mood: null,
        moodUntil: 0,
        waiting: false,
        walked: 0,
      },
      visit: planVisit(store, random),
      visitIndex: -1,
      moment: null,
      craving: null,
      cravingDone: false,
      surprised: false,
      pickups: store.pickups.map((pickup) => ({ ...pickup, taken: false })),
      spentHere: 0,
      cravingAt: 1 + Math.floor(random() * 2),
      pacifier: { out: false, x: 0, nextToss: state.elapsed + nextTossDelay() },
    });
  }

  const nextTossDelay = () => TOSS_EVERY[0] + random() * (TOSS_EVERY[1] - TOSS_EVERY[0]);
  function reset(seed) {
    random = createRandom(seed);
    Object.assign(state, {
      elapsed: 0,
      seed,
      money: BUDGET,
      happiness: START_HAPPINESS,
      patience: 100,
      bags: 0,
      coupon: false,
      result: null,
      actionHeld: false,
      stats: { bought: 0, traps: 0, compliments: 0, treats: 0, missed: 0, declined: 0 },
    });
    enterStop(0);
  }
  function start({ seed = Date.now() } = {}) {
    reset(seed);
    state.mode = 'playing';
    onEvent('start', { store });
  }
  function pause() {
    if (state.mode !== 'playing') return;
    state.mode = 'paused';
    onEvent('pause');
  }
  function resume() {
    if (state.mode !== 'paused') return;
    state.mode = 'playing';
    state.actionHeld = true;
    onEvent('resume');
  }
  function continueDay() {
    if (state.mode !== 'between') return;
    enterStop(state.stopIndex + 1);
    state.mode = 'playing';
    state.actionHeld = true;
    onEvent('stop', { store });
  }

  const mood = (delta) => {
    state.happiness = clamp(state.happiness + delta, 0, 100);
    return delta;
  };
  function react(kind) {
    state.rebecca.mood = kind;
    state.rebecca.moodUntil = state.elapsed + REACTION_SECONDS;
  }

  function walkTo(x, task) {
    const r = state.rebecca;
    r.target = x;
    r.task = task;
    r.moving = true;
  }
  function nextStop() {
    state.moment = null;
    state.visitIndex++;
    if (!state.cravingDone && !state.craving && state.visitIndex === state.cravingAt) {
      const counter = store.counters.find((item) => item.kind === store.craving);
      state.craving = {
        counter: counter.id,
        kind: counter.kind,
        expires: state.elapsed + CRAVING_SECONDS,
      };
      onEvent('craving', { counter });
    }
    if (state.visitIndex < state.visit.length) {
      const plan = state.visit[state.visitIndex];
      walkTo(store.spots.find((spot) => spot.id === plan.spot).x, 'browse');
    } else {
      walkTo(store.exit.spot, 'leave');
      onEvent('leaving', { store });
    }
  }
  function beginMoment() {
    const plan = state.visit[state.visitIndex];
    const duration = plan.kind === 'looking' ? LOOKING_SECONDS : MOMENT_SECONDS;
    state.moment = { ...plan, expires: state.elapsed + duration, duration };
    onEvent('moment', { moment: state.moment });
  }
  function resolveMoment(outcome, detail = {}) {
    const moment = state.moment;
    state.moment = null;
    state.rebecca.wait = 0.9;
    state.rebecca.task = 'react';
    onEvent(outcome, { moment, ...detail });
  }
  function momentTimeout() {
    const moment = state.moment;
    if (moment.kind === 'want') {
      state.stats.missed++;
      react('unimpressed');
      resolveMoment('passed', { happiness: mood(-moment.hearts * 2) });
    } else if (moment.kind === 'outfit') {
      state.stats.missed++;
      react('unimpressed');
      resolveMoment('ignored', { happiness: mood(-8) });
    } else resolveMoment('shrugged', { happiness: 0 });
  }

  /** What the action button does right now, for prompts and touch labels. */
  function availableAction() {
    if (state.mode !== 'playing') return null;
    const a = state.aron,
      r = state.rebecca;
    if (state.moment && r.task === 'browse' && Math.abs(a.x - r.x) < REACH) {
      if (state.moment.kind === 'outfit') return { type: 'compliment', label: 'COMPLIMENT' };
      const price = priceOf(state.moment, state.coupon);
      return { type: 'buy', price, label: `BUY $${price}` };
    }
    if (!a.carrying)
      for (const counter of store.counters)
        if (Math.abs(a.x - counter.x) < COUNTER_REACH)
          return {
            type: 'order',
            counter,
            price: counter.price,
            label: `${counter.kind === 'coffee' ? 'COFFEE' : 'CUPCAKE'} $${counter.price}`,
          };
    return null;
  }

  function act() {
    const action = availableAction();
    if (!action) return false;
    const a = state.aron;
    if (action.type === 'compliment') {
      state.stats.compliments++;
      react('delighted');
      resolveMoment('complimented', { happiness: mood(10) });
    } else if (action.type === 'buy') {
      const moment = state.moment;
      if (action.price > state.money) {
        state.stats.declined++;
        react('unimpressed');
        resolveMoment('declined', { happiness: mood(-6), price: action.price });
        return true;
      }
      state.money -= action.price;
      state.spentHere += action.price;
      state.bags++;
      const usedCoupon = state.coupon;
      state.coupon = false;
      if (moment.kind === 'looking') {
        state.stats.traps++;
        react('unimpressed');
        resolveMoment('trap', { happiness: mood(-4), price: action.price, usedCoupon });
      } else {
        state.stats.bought++;
        react('delighted');
        resolveMoment('bought', {
          happiness: mood(moment.hearts * 5 + (moment.sale ? 2 : 0)),
          price: action.price,
          usedCoupon,
        });
      }
    } else if (action.type === 'order') {
      if (action.price > state.money) {
        state.stats.declined++;
        onEvent('declined', { price: action.price, happiness: 0, counter: action.counter });
        return true;
      }
      state.money -= action.price;
      state.spentHere += action.price;
      a.carrying = {
        kind: action.counter.kind,
        name: action.counter.name,
        icon: action.counter.icon,
      };
      onEvent('ordered', { counter: action.counter, price: action.price });
    }
    return true;
  }

  function deliver() {
    const a = state.aron,
      r = state.rebecca;
    const item = a.carrying;
    a.carrying = null;
    r.holding = { ...item, until: state.elapsed + 8 };
    state.stats.treats++;
    react('delighted');
    if (state.craving && state.craving.kind === item.kind) {
      state.craving = null;
      state.cravingDone = true;
      onEvent('delivered', { item, happiness: mood(15), craved: true });
    } else {
      const delta = mood(state.surprised ? 2 : 6);
      state.surprised = true;
      onEvent('delivered', { item, happiness: delta, craved: false });
    }
  }

  function finish(reason) {
    if (reason === 'meltdown') mood(-10);
    const happiness = Math.round(state.happiness),
      money = state.money;
    const score = Math.round(happiness * 5 + money);
    let ending;
    if (reason === 'meltdown') ending = 'meltdown';
    else if (happiness >= 75 && money >= 80) ending = 'perfect';
    else if (happiness >= 75) ending = 'broke';
    else if (happiness < 45 && money >= 125) ending = 'stingy';
    else if (happiness < 45) ending = 'rough';
    else ending = 'solid';
    state.result = { reason, ending, happiness, money, score, bags: state.bags };
    state.mode = 'done';
    state.aron.vx = 0;
    onEvent('done', state.result);
  }

  function moveAron(dt, input) {
    const a = state.aron;
    const direction = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (direction) a.facing = direction;
    a.vx += (direction * ARON_SPEED - a.vx) * (1 - Math.exp(-dt * (direction ? 12 : 16)));
    const before = a.x;
    a.x = clamp(a.x + a.vx * dt, 60, store.length - 60);
    if (a.x === 60 || a.x === store.length - 60) a.vx = 0;
    a.walked += Math.abs(a.x - before);
  }

  function moveRebecca(dt) {
    const r = state.rebecca,
      a = state.aron;
    if (r.holding && state.elapsed > r.holding.until) r.holding = null;
    if (r.mood && state.elapsed > r.moodUntil) r.mood = null;
    if (r.wait > 0) {
      r.wait -= dt;
      if (r.wait <= 0 && (r.task === 'idle' || r.task === 'react')) nextStop();
      return;
    }
    if (!r.moving) return;
    // She waits up when Aron falls well behind, so a coffee run can't lose her.
    r.waiting = r.x - a.x > WAIT_DISTANCE;
    if (r.waiting) return;
    const gap = r.target - r.x;
    r.facing = gap >= 0 ? 1 : -1;
    const step = Math.min(Math.abs(gap), REBECCA_SPEED * dt);
    r.x += Math.sign(gap) * step;
    r.walked += step;
    if (Math.abs(r.target - r.x) < 0.01) {
      r.x = r.target;
      r.moving = false;
      r.facing = 1;
      if (r.task === 'browse') beginMoment();
      else if (r.task === 'leave') r.task = 'waiting';
    }
  }

  function tick(dt, input) {
    state.elapsed += dt;
    moveAron(dt, input);
    moveRebecca(dt);
    const a = state.aron;
    for (const pickup of state.pickups) {
      if (pickup.taken || Math.abs(a.x - pickup.x) > PICKUP_REACH) continue;
      pickup.taken = true;
      state.coupon = true;
      onEvent('coupon', { pickup });
    }
    // Jack throws his pacifier behind the stroller; getting it back calms him.
    const pacifier = state.pacifier;
    if (!pacifier.out && state.elapsed >= pacifier.nextToss) {
      pacifier.out = true;
      pacifier.x = clamp(a.x - a.facing * (170 + random() * 170), 80, store.length - 80);
      pacifier.from = a.x + a.facing * 60;
      pacifier.thrownAt = state.elapsed;
      onEvent('toss', { pacifier });
    } else if (
      pacifier.out &&
      state.elapsed - pacifier.thrownAt > 0.6 &&
      Math.abs(a.x - pacifier.x) < PICKUP_REACH
    ) {
      pacifier.out = false;
      pacifier.nextToss = state.elapsed + nextTossDelay();
      state.patience = Math.min(100, state.patience + PACIFIER_PATIENCE);
      onEvent('pacifier', { pacifier });
    }
    if (a.carrying && Math.abs(a.x - state.rebecca.x) < DELIVERY_REACH) deliver();
    if (state.moment && state.elapsed >= state.moment.expires) momentTimeout();
    if (state.craving && state.elapsed >= state.craving.expires) {
      state.craving = null;
      state.cravingDone = true;
      state.stats.missed++;
      react('unimpressed');
      onEvent('craving-missed', { happiness: mood(-8) });
    }
    state.patience = Math.max(
      0,
      state.patience - (state.pacifier.out ? FUSSY_DRAIN : PATIENCE_DRAIN) * dt,
    );
    if (state.patience <= 0) return finish('meltdown');
    const leaving = state.rebecca.task === 'leave' || state.rebecca.task === 'waiting';
    if (leaving && a.x >= store.exit.x) {
      if (state.stopIndex === STORES.length - 1) return finish('home');
      state.craving = null;
      state.moment = null;
      state.mode = 'between';
      state.patience = Math.min(100, state.patience + NAP_PATIENCE);
      a.vx = 0;
      onEvent('between', { store, spent: state.spentHere, next: STORES[state.stopIndex + 1] });
    }
  }

  function update(dt, input = {}) {
    if (state.mode !== 'playing' || !Number.isFinite(dt) || dt <= 0) return;
    const pressed = !!input.action;
    if (pressed && !state.actionHeld) act();
    state.actionHeld = pressed;
    const duration = Math.min(dt, 0.1),
      steps = Math.max(1, Math.ceil(duration / (1 / 120)));
    for (let i = 0; i < steps && state.mode === 'playing'; i++) tick(duration / steps, input);
  }

  // The menu shows the first store before anyone presses start.
  reset(1);
  return {
    state,
    start,
    pause,
    resume,
    continueDay,
    update,
    act,
    availableAction,
    get store() {
      return store;
    },
  };
}

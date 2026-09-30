import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BUDGET,
  START_HAPPINESS,
  STOPS_PER_VISIT,
  PATIENCE_DRAIN,
  FUSSY_DRAIN,
  createShoppingDay,
  planVisit,
  priceOf,
  createRandom,
} from '../assets/aisle-dash/shopping.js';
import { STORES } from '../assets/aisle-dash/stores.js';
import { ITEM_INDEX } from '../assets/aisle-dash/sprites.js';

const STEP = 1 / 120;
function setup(seed = 7) {
  const events = [];
  const day = createShoppingDay((type, detail) => events.push({ type, detail }));
  day.start({ seed });
  // Keep Jack calm unless a test is about him.
  day.state.pacifier.nextToss = Infinity;
  return { day, s: day.state, events, last: (type) => events.findLast((e) => e.type === type) };
}
function run(day, seconds, input = {}) {
  for (let i = 0; i < Math.round(seconds / STEP); i++) day.update(STEP, input);
}
function press(day) {
  day.update(STEP, { action: true });
  day.update(STEP, {});
}
// Put Rebecca at a display with a specific moment, and Aron beside her.
function browse(s, moment) {
  Object.assign(s.rebecca, { x: 1240, task: 'browse', moving: false, wait: 0 });
  s.moment = { expires: s.elapsed + 9, duration: 9, icon: 'candle', sale: false, ...moment };
  Object.assign(s.aron, { x: 1150, vx: 0 });
}
const away = (s) => Object.assign(s.aron, { x: s.rebecca.x - 400, vx: 0 });

test('a day starts at Target with the full budget and a patient Jack', () => {
  const { s } = setup();
  assert.equal(s.mode, 'playing');
  assert.equal(s.store.id, 'target');
  assert.equal(s.money, BUDGET);
  assert.equal(s.happiness, START_HAPPINESS);
  assert.equal(s.patience, 100);
  assert.equal(s.visit.length, STOPS_PER_VISIT);
});

test('every item, outfit and counter has a sprite, and stores run left to right', () => {
  for (const store of STORES) {
    for (const items of Object.values(store.items))
      for (const [name, , hearts, icon] of items) {
        assert.ok(ITEM_INDEX.includes(icon), `${store.id}: ${name} has a sprite`);
        assert.ok(hearts >= 1 && hearts <= 3);
      }
    for (const counter of store.counters) assert.ok(ITEM_INDEX.includes(counter.icon));
    assert.ok(ITEM_INDEX.includes(store.outfitIcon));
    for (const spot of store.spots) {
      assert.ok(store.items[spot.dept], `${store.id}: ${spot.id} has items`);
      assert.ok(spot.x > store.spawn.rebecca && spot.x < store.exit.x);
    }
    assert.ok(store.exit.spot > store.exit.x && store.exit.spot < store.length);
    assert.ok(store.counters.some((counter) => counter.kind === store.craving));
  }
});

test('each visit walks forward and mixes real wants with just-looking moments', () => {
  for (let seed = 1; seed < 200; seed++)
    for (const store of STORES) {
      const visit = planVisit(store, createRandom(seed));
      const xs = visit.map((m) => store.spots.find((spot) => spot.id === m.spot).x);
      assert.deepEqual(
        xs,
        [...xs].sort((a, b) => a - b),
        'Rebecca never doubles back',
      );
      assert.equal(new Set(visit.map((m) => m.spot)).size, STOPS_PER_VISIT);
      assert.ok(
        visit.some((m) => store.spots.find((spot) => spot.id === m.spot).dept === store.mustVisit),
      );
      const buyable = visit.filter((m) => m.kind !== 'outfit');
      assert.ok(
        buyable.some((m) => m.kind === 'looking'),
        `${store.id} ${seed}: a trap`,
      );
      if (buyable.length > 1)
        assert.ok(
          buyable.some((m) => m.kind === 'want'),
          `${store.id} ${seed}: a want`,
        );
    }
});

test('Aron walks both ways and stays inside the store', () => {
  const { day, s } = setup();
  const x = s.aron.x;
  run(day, 1, { right: true });
  assert.ok(s.aron.x > x + 180, 'walking right moves Aron');
  assert.equal(s.aron.facing, 1);
  run(day, 3, { left: true });
  assert.equal(s.aron.x, 60, 'the entrance wall stops him');
  assert.equal(s.aron.facing, -1);
});

test('buying something she wants costs money and makes her happy', () => {
  const { day, s, last } = setup();
  browse(s, { kind: 'want', name: 'Throw blanket', price: 35, hearts: 2 });
  assert.equal(day.availableAction().label, 'BUY $35');
  press(day);
  assert.equal(s.money, BUDGET - 35);
  assert.equal(s.happiness, START_HAPPINESS + 10);
  assert.equal(s.bags, 1);
  assert.equal(last('bought').detail.price, 35);
  assert.equal(s.rebecca.mood, 'delighted');
  assert.equal(s.moment, null);
});

test('buying something she was just looking at costs money and a little happiness', () => {
  const { day, s } = setup();
  browse(s, { kind: 'looking', name: 'Candle', price: 14, hearts: 1 });
  press(day);
  assert.equal(s.money, BUDGET - 14);
  assert.equal(s.happiness, START_HAPPINESS - 4);
  assert.equal(s.stats.traps, 1);
  assert.equal(s.rebecca.mood, 'unimpressed');
});

test('coupons are picked up on the way, and stack with sales once', () => {
  const { day, s } = setup();
  const coupon = s.pickups[0];
  Object.assign(s.aron, { x: coupon.x - 60 });
  run(day, 0.5, { right: true });
  assert.equal(s.coupon, true);
  assert.equal(priceOf({ price: 50, sale: true }, true), 28);
  browse(s, { kind: 'want', name: 'Lamp', price: 50, hearts: 3, sale: true });
  press(day);
  assert.equal(s.money, BUDGET - 28);
  assert.equal(s.happiness, START_HAPPINESS + 17, 'hearts plus the sale bonus');
  assert.equal(s.coupon, false);
});

test('a declined card keeps the money and costs some happiness', () => {
  const { day, s, last } = setup();
  s.money = 10;
  browse(s, { kind: 'want', name: 'Mirror', price: 70, hearts: 2 });
  press(day);
  assert.equal(s.money, 10);
  assert.equal(s.bags, 0);
  assert.equal(s.happiness, START_HAPPINESS - 6);
  assert.ok(last('declined'));
});

test('compliments are free; ignoring an outfit or a want costs happiness', () => {
  const { day, s } = setup();
  browse(s, { kind: 'outfit', name: 'How does this look?', price: 0 });
  assert.equal(day.availableAction().type, 'compliment');
  press(day);
  assert.equal(s.happiness, START_HAPPINESS + 10);
  assert.equal(s.money, BUDGET);
  browse(s, { kind: 'outfit', name: 'How does this look?', price: 0 });
  away(s);
  run(day, 9.1);
  assert.equal(s.happiness, START_HAPPINESS + 2);
  browse(s, { kind: 'want', name: 'Onesies', price: 20, hearts: 3 });
  away(s);
  run(day, 9.1);
  assert.equal(s.happiness, START_HAPPINESS - 4);
  browse(s, {
    kind: 'looking',
    name: 'Notepad',
    price: 3,
    hearts: 1,
    duration: 4.5,
    expires: s.elapsed + 4.5,
  });
  away(s);
  run(day, 4.6);
  assert.equal(s.happiness, START_HAPPINESS - 4, 'passing on a just-looking item is free');
});

test('a craved coffee is worth the trip back; a surprise treat still helps', () => {
  const { day, s, last } = setup();
  s.craving = { counter: 'coffee', kind: 'coffee', expires: s.elapsed + 25 };
  const counter = s.store.counters[0];
  Object.assign(s.rebecca, { x: 1400, task: 'react', wait: 100 });
  Object.assign(s.aron, { x: counter.x });
  assert.equal(day.availableAction().type, 'order');
  press(day);
  assert.equal(s.money, BUDGET - 6);
  assert.equal(s.aron.carrying.kind, 'coffee');
  run(day, 5, { right: true });
  assert.equal(s.aron.carrying, null, 'walking up to her hands it over');
  assert.equal(s.craving, null);
  assert.equal(s.happiness, START_HAPPINESS + 15);
  assert.equal(last('delivered').detail.craved, true);
  assert.equal(s.rebecca.holding.kind, 'coffee');
  Object.assign(s.aron, { x: counter.x });
  press(day);
  Object.assign(s.aron, { x: s.rebecca.x - 50 });
  day.update(STEP, {});
  assert.equal(s.happiness, START_HAPPINESS + 21, 'the first surprise is +6');
});

test('a craving that goes unanswered expires', () => {
  const { day, s } = setup();
  s.craving = { counter: 'coffee', kind: 'coffee', expires: s.elapsed + 1 };
  run(day, 1.1);
  assert.equal(s.craving, null);
  assert.equal(s.happiness, START_HAPPINESS - 8);
});

test('Jack throws his pacifier behind Aron and gets fussy until it comes back', () => {
  const { day, s, last } = setup();
  Object.assign(s.aron, { x: 1500, facing: 1 });
  Object.assign(s.rebecca, { task: 'react', wait: 100 });
  s.pacifier.nextToss = s.elapsed;
  day.update(STEP, {});
  assert.equal(s.pacifier.out, true);
  assert.ok(s.pacifier.x < s.aron.x - 150, 'it lands behind him');
  assert.ok(last('toss'));
  const before = s.patience;
  run(day, 1);
  assert.ok(Math.abs(before - s.patience - FUSSY_DRAIN) < 0.05, 'fussy Jack drains faster');
  run(day, 3, { left: true });
  assert.equal(s.pacifier.out, false, 'walking over it picks it up');
  assert.ok(last('pacifier'));
  assert.ok(s.pacifier.nextToss > s.elapsed + 10);
  const calm = s.patience;
  run(day, 1);
  assert.ok(Math.abs(calm - s.patience - PATIENCE_DRAIN) < 0.05, 'calm Jack drains slowly');
});

test('running out of patience ends the day', () => {
  const { day, s } = setup();
  s.patience = 0.5;
  run(day, 1);
  assert.equal(s.mode, 'done');
  assert.equal(s.result.ending, 'meltdown');
  assert.equal(s.result.happiness, START_HAPPINESS - 10);
});

test('Rebecca waits up when Aron falls far behind', () => {
  const { day, s } = setup();
  Object.assign(s.rebecca, { x: 1400, target: 2400, task: 'browse', moving: true, wait: 0 });
  Object.assign(s.aron, { x: 600 });
  run(day, 1);
  assert.equal(s.rebecca.x, 1400);
  assert.equal(s.rebecca.waiting, true);
  Object.assign(s.aron, { x: 1300 });
  run(day, 1);
  assert.ok(s.rebecca.x > 1400);
});

test('the day moves from Target to the mall and ends at the exit', () => {
  const { day, s, last } = setup();
  s.money = 120;
  s.rebecca.task = 'waiting';
  s.moment = null;
  s.patience = 50;
  Object.assign(s.aron, { x: s.store.exit.x + 10 });
  day.update(STEP, {});
  assert.equal(s.mode, 'between');
  assert.ok(s.patience > 64, 'Jack naps in the car');
  day.update(1, {});
  assert.equal(s.mode, 'between', 'the day waits between stops');
  day.continueDay();
  assert.equal(s.mode, 'playing');
  assert.equal(s.store.id, 'mall');
  assert.equal(s.money, 120, 'the budget carries over');
  s.happiness = 80;
  s.rebecca.task = 'waiting';
  Object.assign(s.aron, { x: s.store.exit.x + 10 });
  day.update(STEP, {});
  assert.equal(s.mode, 'done');
  assert.deepEqual(
    { ending: s.result.ending, score: s.result.score, reason: s.result.reason },
    { ending: 'perfect', score: 80 * 5 + 120, reason: 'home' },
  );
  assert.ok(last('done'));
});

test('endings reflect both happiness and money', () => {
  for (const [happiness, money, ending] of [
    [80, 20, 'broke'],
    [30, 200, 'stingy'],
    [30, 40, 'rough'],
    [60, 90, 'solid'],
  ]) {
    const { day, s } = setup();
    s.rebecca.task = 'waiting';
    Object.assign(s.aron, { x: s.store.exit.x + 10 });
    day.update(STEP, {});
    day.continueDay();
    Object.assign(s, { happiness, money });
    s.rebecca.task = 'waiting';
    Object.assign(s.aron, { x: s.store.exit.x + 10 });
    day.update(STEP, {});
    assert.equal(s.result.ending, ending, `${happiness}% and $${money}`);
  }
});

test('pausing freezes the day', () => {
  const { day, s } = setup();
  run(day, 0.5, { right: true });
  day.pause();
  const frozen = { x: s.aron.x, elapsed: s.elapsed, patience: s.patience, r: s.rebecca.x };
  run(day, 2, { right: true });
  assert.deepEqual(
    { x: s.aron.x, elapsed: s.elapsed, patience: s.patience, r: s.rebecca.x },
    frozen,
  );
  day.resume();
  assert.equal(s.mode, 'playing');
});

// Walks with ordinary left/right input: no teleporting.
function playDay(seed, { fetchPacifier = true } = {}) {
  const day = createShoppingDay();
  day.start({ seed });
  const s = day.state;
  for (let frame = 0; s.mode !== 'done' && frame < 200000; frame++) {
    if (s.mode === 'between') {
      day.continueDay();
      continue;
    }
    const r = s.rebecca,
      a = s.aron;
    let goal;
    if (fetchPacifier && s.pacifier.out) goal = s.pacifier.x;
    else if (s.craving && !a.carrying)
      goal = s.store.counters.find((c) => c.id === s.craving.counter).x;
    else if (r.task === 'leave' || r.task === 'waiting') goal = s.store.exit.x + 40;
    else goal = r.x - 70;
    const action = day.availableAction();
    const wise =
      action &&
      (action.type === 'compliment' ||
        (action.type === 'order' && Boolean(s.craving)) ||
        (action.type === 'buy' &&
          s.moment.kind === 'want' &&
          (s.moment.hearts > 1 || action.price < 20)));
    day.update(1 / 60, {
      right: goal > a.x + 15,
      left: goal < a.x - 15,
      action: wise && frame % 2 === 0,
    });
  }
  return s;
}

test('an attentive shopper gets home with Rebecca happy', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const s = playDay(seed);
    assert.equal(s.result.reason, 'home', `seed ${seed} gets home before Jack melts down`);
    assert.ok(s.result.happiness >= 70, `seed ${seed}: an attentive day keeps Rebecca happy`);
  }
});

test('ignoring the pacifier usually ends the day early', () => {
  let meltdowns = 0;
  for (let seed = 1; seed <= 30; seed++)
    if (playDay(seed, { fetchPacifier: false }).result.reason === 'meltdown') meltdowns++;
  assert.ok(meltdowns >= 20, `${meltdowns} of 30 ignored-pacifier days melt down`);
});

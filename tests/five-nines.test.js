import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ANSWERED_TICKET,
  AUTO_CLOSED,
  COFFEE_COOLDOWN,
  DESK_REACH,
  DOWN,
  FIRE_SPREAD_SECONDS,
  FIXES,
  HANDS,
  IGNORED_TICKET,
  REACH,
  SHIFT_SECONDS,
  TICKET_SECONDS,
  WARNING_SECONDS,
  clockOf,
  createShift,
  formatUptime,
  ninesOf,
  uptimePercent,
} from '../assets/five-nines/shift.js';
import { COFFEE, HELP_DESK, RACKS, SCENERY } from '../assets/five-nines/floor.js';
import { SPRITES } from '../assets/five-nines/sprite-data.js';

const STEP = 1 / 60;
const rack = (id) => RACKS.find((r) => r.id === id);
const run = (shift, seconds, input = {}) => {
  for (let t = 0; t < seconds - 1e-9 && shift.state.mode === 'playing'; t += STEP)
    shift.update(STEP, input);
};
// A shift with nothing breaking on its own, for testing one thing at a time.
function quiet(events = []) {
  const shift = createShift((type, detail) => events.push({ type, detail }));
  shift.start({ seed: 4 });
  Object.assign(shift.state, { scripted: [], nextProblem: Infinity, nextTicket: Infinity });
  return shift;
}
function breakRack(shift, id, kind) {
  const limit = WARNING_SECONDS[kind] || 0;
  shift.state.racks[id].problem = { kind, age: 0, limit, fixed: 0, spread: 0 };
}
// Stand facing the rack with it in front of Aron's hands.
function standAt(shift, id) {
  Object.assign(shift.state.aron, { x: rack(id).x - HANDS, facing: 1, vx: 0 });
}

test('uptime, nines, the clock and the board’s number', () => {
  assert.equal(uptimePercent(0), 100);
  assert.ok(uptimePercent(5) >= 99.999, 'a few seconds of downtime is five nines');
  assert.equal(ninesOf(uptimePercent(10)), 4);
  assert.equal(ninesOf(uptimePercent(50)), 3);
  assert.ok(uptimePercent(600) < 90);
  assert.deepEqual([100, 99.9995, 99.99, 99.95, 99.5, 95, 80].map(ninesOf), [5, 5, 4, 3, 2, 1, 0]);
  assert.equal(clockOf(0), '9:00 PM');
  assert.equal(clockOf(SHIFT_SECONDS / 2), '1:30 AM');
  assert.equal(clockOf(SHIFT_SECONDS), '6:00 AM');
  assert.equal(formatUptime(99.99968), '99.999%', 'never rounds up to 100%');
  assert.equal(formatUptime(100), '100.000%');
});

test('every rack and prop has art, and the row reads left to right', () => {
  for (const [sheet, name] of [...SCENERY.back, ...SCENERY.front])
    assert.ok(SPRITES[sheet][name], `${sheet}/${name}`);
  for (const r of RACKS) assert.ok(SPRITES.racks[r.sprite], r.sprite);
  for (let i = 1; i < RACKS.length; i++) assert.ok(RACKS[i].x > RACKS[i - 1].x);
  assert.equal(new Set(RACKS.map((r) => r.id)).size, RACKS.length);
  assert.ok(RACKS.some((r) => r.name === 'WordPress') && RACKS.some((r) => r.id === 'lb'));
});

test('the shift opens at 9 PM with a pulled cable a few seconds in', () => {
  const events = [];
  const shift = createShift((type, detail) => events.push({ type, detail }));
  assert.equal(shift.state.mode, 'menu');
  shift.start({ seed: 4 });
  assert.equal(shift.state.mode, 'playing');
  assert.equal(shift.uptime, 100);
  run(shift, 3.1);
  assert.equal(shift.state.racks.block.problem?.kind, 'cable');
  assert.ok(events.some((e) => e.type === 'problem' && e.detail.rack.id === 'block'));
});

test('holding the action button in front of a rack fixes it', () => {
  const events = [];
  const shift = quiet(events);
  breakRack(shift, 'object', 'cable');
  standAt(shift, 'object');
  assert.equal(shift.availableAction().label, FIXES.cable.label);
  run(shift, FIXES.cable.seconds / 2, { action: true });
  assert.equal(shift.state.aron.fixing, 'plug');
  assert.ok(shift.state.racks.object.problem, 'not done yet');
  run(shift, FIXES.cable.seconds / 2 + 0.05, { action: true });
  assert.equal(shift.state.racks.object.problem, null);
  assert.ok(events.some((e) => e.type === 'fixed'));
  assert.ok(shift.state.downSeconds > 0 && shift.uptime < 100, 'the outage cost uptime');
});

test('Aron fixes the rack he faces, not the one behind him', () => {
  const shift = quiet();
  breakRack(shift, 'kubernetes', 'heat');
  breakRack(shift, 'object', 'disk');
  // Between the two, closer to Kubernetes, but facing Object Storage.
  Object.assign(shift.state.aron, { x: rack('object').x - 110, facing: 1 });
  assert.equal(shift.availableAction().rack.id, 'object');
  shift.state.aron.facing = -1;
  assert.equal(shift.availableAction().rack.id, 'kubernetes');
  shift.state.racks.kubernetes.problem = null;
  shift.state.aron.x = rack('object').x - HANDS - REACH - 60;
  shift.state.aron.facing = 1;
  assert.equal(shift.availableAction(), null, 'out of reach');
});

test('warnings get worse when left alone, and lose any half-done fix', () => {
  const events = [];
  const shift = quiet(events);
  breakRack(shift, 'databases', 'heat');
  breakRack(shift, 'dns', 'disk');
  breakRack(shift, 'lb', 'traffic');
  shift.state.racks.databases.problem.fixed = 0.5;
  run(shift, WARNING_SECONDS.heat + 0.1);
  assert.equal(shift.state.racks.databases.problem.kind, 'fire');
  assert.equal(shift.state.racks.databases.problem.fixed, 0);
  run(shift, Math.max(WARNING_SECONDS.disk, WARNING_SECONDS.traffic) - WARNING_SECONDS.heat);
  assert.equal(shift.state.racks.dns.problem.kind, 'crash');
  assert.equal(shift.state.racks.lb.problem.kind, 'crash');
  assert.ok(DOWN.has('fire') && DOWN.has('crash') && !DOWN.has('heat'));
  assert.deepEqual(
    events.filter((e) => e.type === 'worse').map((e) => e.detail.to),
    ['fire', 'crash', 'crash'],
  );
});

test('a fire left burning heats up the racks next to it', () => {
  const shift = quiet();
  breakRack(shift, 'object', 'fire');
  run(shift, FIRE_SPREAD_SECONDS + 0.1);
  assert.equal(shift.state.racks.kubernetes.problem?.kind, 'heat');
  assert.equal(shift.state.racks.block.problem?.kind, 'heat');
  assert.equal(shift.state.racks.vms.problem, null, 'only the neighbors');
});

test('only down racks cost uptime, and it never goes back up', () => {
  const shift = quiet();
  breakRack(shift, 'dns', 'heat');
  run(shift, 5);
  assert.equal(shift.uptime, 100, 'a hot rack is still up');
  breakRack(shift, 'vms', 'cable');
  let last = shift.uptime;
  for (let i = 0; i < 10; i++) {
    run(shift, 0.5);
    assert.ok(shift.uptime <= last);
    last = shift.uptime;
  }
  assert.ok(Math.abs(shift.state.downSeconds - 5) < 0.05);
});

test('tickets: answered at the desk, closed by a fix, or ignored', () => {
  const events = [];
  const shift = quiet(events);
  const s = shift.state;
  const ticket = (about = null) => {
    const t = {
      id: ++s.ticketCount,
      who: 0,
      about,
      lines: ['a', 'b'],
      age: 0,
      limit: TICKET_SECONDS,
      fixed: 0,
    };
    s.tickets.push(t);
    return t;
  };
  // Answer one at the help desk; its timer stops while Aron types.
  const first = ticket();
  s.aron.x = HELP_DESK.x + DESK_REACH - 10;
  assert.equal(shift.availableAction().type, 'ticket');
  const happy = s.happiness;
  run(shift, 0.5, { action: true });
  const frozen = first.age;
  run(shift, 0.6, { action: true });
  assert.equal(first.age, frozen, 'the ticket waits while it is answered');
  assert.equal(s.tickets.length, 0);
  assert.equal(s.happiness, happy + ANSWERED_TICKET);
  // One about an outage closes itself when the rack is fixed.
  breakRack(shift, 'wordpress', 'cable');
  ticket('wordpress');
  standAt(shift, 'wordpress');
  const before = s.happiness;
  run(shift, FIXES.cable.seconds + 0.05, { action: true });
  assert.equal(s.tickets.length, 0);
  assert.ok(s.happiness >= before + AUTO_CLOSED);
  assert.equal(s.stats.autoClosed, 1);
  // One left too long costs a lot.
  ticket();
  const waiting = s.happiness;
  run(shift, TICKET_SECONDS + 0.1);
  assert.equal(s.tickets.length, 0);
  assert.equal(s.happiness, waiting - IGNORED_TICKET);
  assert.ok(events.some((e) => e.type === 'ignored'));
});

test('coffee makes Aron faster for a while, then needs a refill', () => {
  const events = [];
  const shift = quiet(events);
  const s = shift.state;
  s.aron.x = COFFEE.x;
  assert.equal(shift.availableAction().type, 'coffee');
  shift.update(STEP, { action: true });
  shift.update(STEP, {});
  assert.ok(events.some((e) => e.type === 'coffee'));
  assert.equal(shift.availableAction(), null, 'no refill yet');
  const x = s.aron.x;
  run(shift, 1, { right: true });
  const boosted = s.aron.x - x;
  run(shift, COFFEE_COOLDOWN);
  s.aron.x = 400;
  run(shift, 1, { right: true });
  assert.ok(boosted > (s.aron.x - 400) * 1.2, 'faster on coffee');
});

test('pausing freezes the shift', () => {
  const shift = createShift();
  shift.start({ seed: 4 });
  run(shift, 5);
  shift.pause();
  const frozen = JSON.stringify(shift.state);
  run(shift, 2);
  shift.update(1, { right: true });
  assert.equal(JSON.stringify(shift.state), frozen);
  shift.resume();
  assert.equal(shift.state.mode, 'playing');
});

// A bot that plays the shift: `lag` is how often it looks around, and whether
// it bothers with tickets. It runs to the most urgent rack and holds the button.
function play(seed, { lag = 0.3, tickets = true } = {}) {
  const shift = createShift();
  shift.start({ seed });
  const s = shift.state;
  let target = null,
    wait = 0;
  while (s.mode === 'playing') {
    wait -= STEP;
    if (wait <= 0) {
      wait = lag;
      const troubled = RACKS.map((r) => ({ r, p: s.racks[r.id].problem })).filter((x) => x.p);
      const urgency = ({ r, p }) =>
        (DOWN.has(p.kind) ? 0 : p.limit - p.age) + Math.abs(r.x - s.aron.x) / 370;
      troubled.sort((a, b) => urgency(a) - urgency(b));
      const due = s.tickets.length && s.tickets[0].limit - s.tickets[0].age < 9;
      const calm = !troubled.length || (!DOWN.has(troubled[0].p.kind) && urgency(troubled[0]) > 8);
      if (tickets && due && calm) target = { x: HELP_DESK.x, reach: DESK_REACH - 30 };
      else if (troubled.length) target = { x: troubled[0].r.x - HANDS, reach: 40 };
      else if (tickets && s.tickets.length) target = { x: HELP_DESK.x, reach: DESK_REACH - 30 };
      else target = null;
    }
    const input = {};
    if (target) {
      const gap = target.x - s.aron.x;
      const action = shift.availableAction();
      if (Math.abs(gap) < target.reach && action && action.type !== 'coffee') input.action = true;
      else if (Math.abs(gap) >= target.reach) input[gap > 0 ? 'right' : 'left'] = true;
      else input.right = true; // face the rack
    }
    shift.update(STEP, input);
  }
  return { ...s.result, elapsed: s.elapsed };
}

test('a sharp player works the whole night with good uptime and happy customers', () => {
  const results = [1, 2, 3, 4, 5, 6].map((seed) => play(seed));
  for (const r of results) {
    assert.equal(r.reason, 'morning');
    assert.ok(r.nines >= 3, `uptime ${r.uptime}`);
    assert.ok(r.happiness >= 60, `customers ${r.happiness}`);
  }
  assert.ok(
    results.some((r) => r.nines >= 4),
    'four nines is within reach',
  );
  assert.deepEqual(play(3), results[2], 'the same seed plays out the same');
});

test('ignoring the tickets or doing nothing loses the customers', () => {
  for (const seed of [1, 2, 3]) {
    const ghost = play(seed, { lag: 1.2, tickets: false });
    assert.ok(ghost.happiness < 40, `ignoring tickets: ${ghost.happiness}`);
    const shift = createShift();
    shift.start({ seed });
    run(shift, SHIFT_SECONDS + 1);
    assert.equal(shift.state.result.ending, 'churn');
    assert.ok(shift.state.elapsed < 90, 'nobody sticks around for long');
  }
});

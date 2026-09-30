import { RACKS, ROW_LENGTH, START_X, HELP_DESK, COFFEE } from './floor.js';

// Deterministic, side-on night-shift simulation. No DOM or canvas: the
// controller feeds it input snapshots and draws the state. Positions are world
// x coordinates along the row; times are in seconds.
export const SHIFT_SECONDS = 180;
export const SHIFT_START_HOUR = 21; // 9 PM to 6 AM
export const SHIFT_HOURS = 9;
export const ARON_SPEED = 370;
export const COFFEE_SPEED = 1.3;
export const COFFEE_SECONDS = 15;
export const COFFEE_COOLDOWN = 40;
export const REACH = 120;
export const HANDS = 70;
export const DESK_REACH = 120;
export const START_HAPPINESS = 80;

// How long each fix takes (holding the action button), what it's called, and
// how long a warning lasts before it gets worse.
export const FIXES = {
  cable: { seconds: 0.7, label: 'PLUG IN', pose: 'plug' },
  disk: { seconds: 1.4, label: 'SWAP DRIVE', pose: 'drive' },
  heat: { seconds: 1.2, label: 'COOL IT', pose: 'type' },
  fire: { seconds: 2.2, label: 'SPRAY', pose: 'spray' },
  traffic: { seconds: 1.6, label: 'SCALE UP', pose: 'type' },
  crash: { seconds: 2, label: 'REBOOT', pose: 'type' },
};
export const WARNING_SECONDS = { disk: 18, heat: 14, traffic: 16 };
export const WORSENS_TO = { disk: 'crash', heat: 'fire', traffic: 'crash' };
export const DOWN = new Set(['cable', 'fire', 'crash']);
// A fire left burning spreads heat to the racks on either side.
export const FIRE_SPREAD_SECONDS = 9;
export const SPREAD_HEAT_SECONDS = 6;
export const MAX_PROBLEMS = 4;
// Pulled cables take a rack down at once, so they're the rarest trouble.
const KINDS = ['cable', 'disk', 'disk', 'heat', 'heat'];
const KINDS_LB = ['traffic', 'traffic', 'traffic', 'cable', 'heat'];
// New trouble arrives faster as the night goes on.
export const PROBLEM_EVERY = [7.5, 3.6];
export const TICKET_EVERY = [16, 9];
export const TICKET_SECONDS = 25;
export const ANSWER_SECONDS = 1;
export const MAX_TICKETS = 3;
// Customer happiness: outages cost a little every second, ignored tickets a lot.
export const OUTAGE_DRAIN = 0.35;
export const IGNORED_TICKET = 10;
export const ANSWERED_TICKET = 6;
export const WORKING_ON_IT = 2;
export const AUTO_CLOSED = 6;
export const FIXED_BONUS = 1;

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
const lerp = (a, b, t) => a + (b - a) * t;

/**
 * Uptime as shown on the board, measured against the whole shift so it only
 * ever ticks down. Real math would be a plain rack-seconds ratio; the board
 * squares the down fraction so a sharp shift reads like real "nines" (a
 * spotless night is 100%, a few quick blips ~99.99%, chaos ~95%).
 */
export function uptimePercent(downSeconds, racks = RACKS.length) {
  const down = clamp(downSeconds / (racks * SHIFT_SECONDS), 0, 1);
  return 100 * (1 - down * down);
}

/** Uptime to three decimals, rounded down so 99.9996% never shows as 100%. */
export function formatUptime(uptime) {
  return `${(Math.floor(uptime * 1000) / 1000).toFixed(3)}%`;
}

/** How many nines: 99.95 → 3, 99.99 → 4, 99.999 and up → 5. */
export function ninesOf(uptime) {
  const thresholds = [90, 99, 99.9, 99.99, 99.999];
  return thresholds.filter((threshold) => uptime >= threshold - 1e-9).length;
}

export function clockOf(elapsed) {
  const minutes = Math.floor((clamp(elapsed, 0, SHIFT_SECONDS) / SHIFT_SECONDS) * SHIFT_HOURS * 60);
  const hour = (SHIFT_START_HOUR + Math.floor(minutes / 60)) % 24;
  const minute = minutes % 60;
  const display = hour % 12 || 12;
  return `${display}:${String(minute).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`;
}

const GENERIC_TICKETS = [
  ['is it down', 'is it down now'],
  ['Quick question.', 'Is it down?'],
  ['Not urgent, but', 'also URGENT.'],
  ['My site feels slow.', 'Is it you or me?'],
  ['Love the service!', 'Can I get a T-shirt?'],
  ['Just checking in.', 'Everything okay?'],
];
const RACK_TICKETS = {
  vms: ['My VM stopped', 'answering. Rude.'],
  kubernetes: ['My pods are', 'crash-looping. Help?'],
  object: ['Where did my', 'bucket go?'],
  block: ['My volume says', 'it’s full. Of what?'],
  lb: ['The load balancer is', 'balancing nothing.'],
  databases: ['Database is down.', 'No backups. (Kidding.)'],
  dns: ['It’s always DNS.', 'Is it DNS?'],
  wordpress: ['Is WordPress down?', 'My knitting blog is.'],
  vpc: ['Can’t reach my', 'private network.'],
};

export function createShift(onEvent = () => {}) {
  let random;
  const state = { mode: 'menu', elapsed: 0 };
  const rackById = Object.fromEntries(RACKS.map((rack) => [rack.id, rack]));

  function reset(seed) {
    random = createRandom(seed);
    Object.assign(state, {
      elapsed: 0,
      seed,
      aron: { x: START_X, vx: 0, facing: 1, walked: 0, fixing: null, mood: null, moodUntil: 0 },
      racks: Object.fromEntries(RACKS.map((rack) => [rack.id, { problem: null, fixedAt: -99 }])),
      tickets: [],
      answering: null,
      happiness: START_HAPPINESS,
      downSeconds: 0,
      coffeeUntil: 0,
      coffeeReady: 0,
      nextProblem: 3,
      scripted: [
        { at: 3, rack: 'block', kind: 'cable' },
        { at: 11, rack: 'databases', kind: 'heat' },
        { at: 21, rack: 'kubernetes', kind: 'disk' },
      ],
      nextTicket: 8,
      ticketCount: 0,
      result: null,
      actionHeld: false,
      stats: { fixed: 0, fires: 0, crashes: 0, answered: 0, ignored: 0, autoClosed: 0, coffee: 0 },
    });
  }
  function start({ seed = Date.now() } = {}) {
    reset(seed);
    state.mode = 'playing';
    onEvent('start');
  }
  function pause() {
    if (state.mode !== 'playing') return;
    state.mode = 'paused';
    state.aron.fixing = null;
    onEvent('pause');
  }
  function resume() {
    if (state.mode !== 'paused') return;
    state.mode = 'playing';
    state.actionHeld = true;
    onEvent('resume');
  }

  const cheer = (delta) => {
    state.happiness = clamp(state.happiness + delta, 0, 100);
    return delta;
  };
  const progress = () => clamp(state.elapsed / SHIFT_SECONDS, 0, 1);
  const troubled = () => RACKS.filter((rack) => state.racks[rack.id].problem);
  function mood(name, seconds = 1.2) {
    state.aron.mood = name;
    state.aron.moodUntil = state.elapsed + seconds;
  }

  function begin(rackId, kind, limit = WARNING_SECONDS[kind]) {
    const rack = state.racks[rackId];
    rack.problem = { kind, age: 0, limit: limit || 0, fixed: 0, spread: 0 };
    if (kind === 'fire') state.stats.fires++;
    if (kind === 'crash') state.stats.crashes++;
    onEvent('problem', { rack: rackById[rackId], problem: rack.problem });
  }

  function spawnProblem() {
    if (state.scripted.length && state.elapsed >= state.scripted[0].at) {
      const next = state.scripted.shift();
      if (!state.racks[next.rack].problem) begin(next.rack, next.kind);
      return;
    }
    if (state.elapsed < state.nextProblem) return;
    state.nextProblem =
      state.elapsed +
      lerp(PROBLEM_EVERY[0], PROBLEM_EVERY[1], progress()) * (0.75 + random() * 0.5);
    if (troubled().length >= MAX_PROBLEMS) return;
    // Racks fixed in the last few seconds get a breather.
    const free = RACKS.filter(
      (rack) => !state.racks[rack.id].problem && state.elapsed - state.racks[rack.id].fixedAt > 6,
    );
    if (!free.length) return;
    const rack = free[Math.floor(random() * free.length)];
    const kinds = rack.id === 'lb' ? KINDS_LB : KINDS;
    begin(rack.id, kinds[Math.floor(random() * kinds.length)]);
  }

  function spawnTicket() {
    if (state.elapsed < state.nextTicket) return;
    const spike = state.racks.lb.problem?.kind === 'traffic';
    state.nextTicket =
      state.elapsed +
      lerp(TICKET_EVERY[0], TICKET_EVERY[1], progress()) *
        (0.8 + random() * 0.4) *
        (spike ? 0.6 : 1);
    if (state.tickets.length >= MAX_TICKETS) return;
    const down = RACKS.filter((rack) => {
      const problem = state.racks[rack.id].problem;
      return problem && DOWN.has(problem.kind) && !state.tickets.some((t) => t.about === rack.id);
    });
    let about = null,
      lines;
    if (down.length && random() < 0.75) {
      const rack = down[Math.floor(random() * down.length)];
      about = rack.id;
      lines =
        state.racks[rack.id].problem.kind === 'fire'
          ? [`Is ${rack.name} on`, 'fire? Asking for a friend.']
          : RACK_TICKETS[rack.id];
    } else lines = GENERIC_TICKETS[Math.floor(random() * GENERIC_TICKETS.length)];
    const who = about === 'wordpress' ? 4 : Math.floor(random() * 5);
    const ticket = {
      id: ++state.ticketCount,
      who,
      about,
      lines,
      age: 0,
      limit: TICKET_SECONDS,
      fixed: 0,
    };
    state.tickets.push(ticket);
    onEvent('ticket', { ticket });
  }

  /** What the action button does right now, for prompts and touch labels. */
  function availableAction() {
    if (state.mode !== 'playing') return null;
    const a = state.aron;
    // Aron fixes what's in front of his hands, so the rack he faces wins.
    const hands = a.x + a.facing * HANDS;
    let best = null;
    for (const rack of RACKS) {
      const problem = state.racks[rack.id].problem;
      const distance = Math.abs(hands - rack.x);
      if (problem && distance < REACH && (!best || distance < best.distance))
        best = { type: 'fix', rack, problem, label: FIXES[problem.kind].label, distance };
    }
    if (best) return best;
    if (state.tickets.length && Math.abs(a.x - HELP_DESK.x) < DESK_REACH)
      return { type: 'ticket', ticket: state.tickets[0], label: 'ANSWER' };
    if (Math.abs(a.x - COFFEE.x) < DESK_REACH && state.elapsed >= state.coffeeReady)
      return { type: 'coffee', label: 'COFFEE' };
    return null;
  }

  function fix(rack) {
    const status = state.racks[rack.id];
    const problem = status.problem;
    status.problem = null;
    status.fixedAt = state.elapsed;
    state.stats.fixed++;
    cheer(FIXED_BONUS);
    mood(problem.kind === 'fire' || problem.kind === 'crash' ? 'celebrate' : null, 1);
    // Anyone who asked about this rack hears it's back.
    const closed = state.tickets.filter((ticket) => ticket.about === rack.id);
    state.tickets = state.tickets.filter((ticket) => ticket.about !== rack.id);
    state.stats.autoClosed += closed.length;
    cheer(AUTO_CLOSED * closed.length);
    if (state.answering && closed.includes(state.answering)) state.answering = null;
    onEvent('fixed', { rack, problem, closed });
  }

  function answer(ticket) {
    state.tickets = state.tickets.filter((t) => t !== ticket);
    state.answering = null;
    state.stats.answered++;
    const problem = ticket.about && state.racks[ticket.about].problem;
    const delta = cheer(problem ? WORKING_ON_IT : ANSWERED_TICKET);
    onEvent('answered', { ticket, stillDown: Boolean(problem), happiness: delta });
  }

  function work(dt, input) {
    const a = state.aron;
    const action = input.action ? availableAction() : null;
    a.fixing = null;
    if (!action) {
      state.actionHeld = !!input.action;
      return false;
    }
    if (action.type === 'coffee') {
      if (!state.actionHeld) {
        state.coffeeUntil = state.elapsed + COFFEE_SECONDS;
        state.coffeeReady = state.elapsed + COFFEE_COOLDOWN;
        state.stats.coffee++;
        onEvent('coffee');
      }
      state.actionHeld = true;
      return false;
    }
    state.actionHeld = true;
    if (action.type === 'fix') {
      const problem = action.problem;
      a.fixing = FIXES[problem.kind].pose;
      problem.fixed += dt / FIXES[problem.kind].seconds;
      if (problem.fixed >= 1) fix(action.rack);
    } else {
      const ticket = action.ticket;
      state.answering = ticket;
      a.fixing = 'type';
      a.facing = HELP_DESK.x >= a.x ? 1 : -1;
      ticket.fixed += dt / ANSWER_SECONDS;
      if (ticket.fixed >= 1) answer(ticket);
    }
    a.vx = 0;
    return true;
  }

  function moveAron(dt, input) {
    const a = state.aron;
    const direction = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (direction) a.facing = direction;
    const speed = ARON_SPEED * (state.elapsed < state.coffeeUntil ? COFFEE_SPEED : 1);
    a.vx += (direction * speed - a.vx) * (1 - Math.exp(-dt * (direction ? 10 : 16)));
    const before = a.x;
    a.x = clamp(a.x + a.vx * dt, 60, ROW_LENGTH - 60);
    if (a.x === 60 || a.x === ROW_LENGTH - 60) a.vx = 0;
    a.walked += Math.abs(a.x - before);
  }

  function age(dt) {
    let down = 0;
    for (const rack of RACKS) {
      const status = state.racks[rack.id];
      const problem = status.problem;
      if (!problem) continue;
      problem.age += dt;
      if (DOWN.has(problem.kind)) down++;
      if (problem.limit && problem.age >= problem.limit) {
        // Warnings left alone get worse; the fix so far is lost.
        const worse = WORSENS_TO[problem.kind];
        onEvent('worse', { rack, from: problem.kind, to: worse });
        begin(rack.id, worse, 0);
        continue;
      }
      if (problem.kind === 'fire') {
        problem.spread += dt;
        if (problem.spread >= FIRE_SPREAD_SECONDS) {
          problem.spread = 0;
          const index = RACKS.indexOf(rack);
          for (const neighbor of [RACKS[index - 1], RACKS[index + 1]])
            if (
              neighbor &&
              !state.racks[neighbor.id].problem &&
              Math.abs(neighbor.x - rack.x) < 300
            )
              begin(neighbor.id, 'heat', SPREAD_HEAT_SECONDS);
          onEvent('spread', { rack });
        }
      }
    }
    state.downSeconds += down * dt;
    cheer(-OUTAGE_DRAIN * down * dt);
    for (const ticket of [...state.tickets]) {
      if (ticket === state.answering) continue;
      ticket.age += dt;
      if (ticket.age < ticket.limit) continue;
      state.tickets = state.tickets.filter((t) => t !== ticket);
      state.stats.ignored++;
      onEvent('ignored', { ticket, happiness: cheer(-IGNORED_TICKET) });
    }
  }

  function finish(reason) {
    const uptime = uptimePercent(state.downSeconds);
    const happiness = Math.round(state.happiness);
    const nines = ninesOf(uptime);
    let ending;
    if (reason === 'churn') ending = 'churn';
    else if (nines >= 5 && happiness >= 60) ending = 'five';
    else if (nines >= 4 && happiness < 40) ending = 'ghosted';
    else if (nines >= 4) ending = 'four';
    else if (nines >= 3) ending = 'three';
    else ending = 'rough';
    const score = Math.max(0, Math.round((uptime - 95) * 200)) + happiness * 5;
    state.result = { reason, ending, uptime, nines, happiness, score, stats: { ...state.stats } };
    state.mode = 'done';
    state.aron.vx = 0;
    state.aron.fixing = null;
    onEvent('done', state.result);
  }

  function tick(dt, input) {
    state.elapsed += dt;
    const a = state.aron;
    if (a.mood && state.elapsed > a.moodUntil) a.mood = null;
    if (!work(dt, input)) moveAron(dt, input);
    else a.walked = 0;
    age(dt);
    spawnProblem();
    spawnTicket();
    const down = RACKS.filter((rack) => DOWN.has(state.racks[rack.id].problem?.kind)).length;
    if (down >= 3 && !a.mood && !a.fixing) mood('stressed', 1.4);
    if (state.happiness <= 0) return finish('churn');
    if (state.elapsed >= SHIFT_SECONDS) finish('morning');
  }

  function update(dt, input = {}) {
    if (state.mode !== 'playing' || !Number.isFinite(dt) || dt <= 0) return;
    const duration = Math.min(dt, 0.1),
      steps = Math.max(1, Math.ceil(duration / (1 / 120)));
    for (let i = 0; i < steps && state.mode === 'playing'; i++) tick(duration / steps, input);
    if (!input.action) state.actionHeld = false;
  }

  // The menu shows a quiet row before anyone presses start.
  reset(1);
  return {
    state,
    start,
    pause,
    resume,
    update,
    availableAction,
    get uptime() {
      return uptimePercent(state.downSeconds);
    },
  };
}

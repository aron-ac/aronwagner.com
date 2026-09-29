import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameInput } from '../assets/shared/input.js';

// A small event-capable DOM fixture keeps input tests independent of WebGL and
// browser timing. Hit-testing and capture targets are controlled explicitly.
class InputElement extends EventTarget {
  constructor(dataset = {}, parent = null) {
    super();
    this.dataset = dataset;
    this.parentElement = parent;
    this.captures = new Set();
    const classes = new Set();
    this.classList = {
      toggle(name, enabled) {
        if (enabled) classes.add(name);
        else classes.delete(name);
      },
      contains: (name) => classes.has(name),
    };
  }
  closest(selector) {
    const property =
      selector === '[data-control-pad]'
        ? 'controlPad'
        : selector === '[data-control]'
          ? 'control'
          : selector === '[data-dpad]'
            ? 'dpad'
            : null;
    if (property && property in this.dataset) return this;
    return this.parentElement?.closest(selector) ?? null;
  }
  setPointerCapture(id) {
    this.captures.add(id);
  }
  hasPointerCapture(id) {
    return this.captures.has(id);
  }
  releasePointerCapture(id) {
    this.captures.delete(id);
    dispatch(this, 'lostpointercapture', { pointerId: id });
  }
  getBoundingClientRect() {
    return this.bounds ?? { left: 20, top: 40, width: 176, height: 176 };
  }
}

function dispatch(target, type, properties = {}) {
  const event = new Event(type, { cancelable: true });
  Object.assign(event, properties);
  target.dispatchEvent(event);
  return event;
}

function createFixture(t, { dpad = false, exclusiveDirections = dpad, bindings } = {}) {
  const window = new EventTarget();
  const document = new EventTarget();
  document.hidden = false;
  document.elementFromPoint = () => document.hit;
  for (const [name, value] of Object.entries({ window, document, Element: InputElement })) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, value });
    t.after(() => {
      if (previous) Object.defineProperty(globalThis, name, previous);
      else delete globalThis[name];
    });
  }
  const drivingPad = dpad ? new InputElement({ controlPad: 'driving', dpad: '' }) : null;
  const steering = drivingPad || new InputElement({ controlPad: 'steering' });
  const throttle = drivingPad || new InputElement({ controlPad: 'throttle' });
  const buttons = Object.fromEntries(
    [
      ['left', steering],
      ['right', steering],
      ['up', throttle],
      ['down', throttle],
      ['brake', null],
      ['boost', null],
      ['jump', null],
    ].map(([action, pad]) => [action, new InputElement({ control: action }, pad)]),
  );
  if (dpad) {
    for (const [action, left, top] of [
      ['up', 86, 40],
      ['down', 86, 172],
      ['left', 20, 106],
      ['right', 152, 106],
    ]) {
      buttons[action].bounds = { left, top, width: 44, height: 44 };
    }
  }
  let active = true;
  const input = createGameInput({
    bindings: bindings ?? {
      left: ['ArrowLeft', 'KeyA'],
      right: ['ArrowRight', 'KeyD'],
      up: ['ArrowUp', 'KeyW'],
      down: ['ArrowDown', 'KeyS'],
      brake: ['Space'],
      boost: ['KeyB'],
    },
    buttons: Object.values(buttons),
    isActive: () => active,
    exclusiveDirections,
  });
  t.after(() => input.dispose());
  const pointer = (action, type, id = 1) =>
    dispatch(buttons[action], type, {
      pointerId: id,
      pointerType: 'touch',
      clientX: 0,
      clientY: 0,
    });
  return {
    input,
    buttons,
    document,
    window,
    pointer,
    drivingPad,
    padPointer(action, type, x, y, id = 1) {
      const bounds = drivingPad.getBoundingClientRect();
      return dispatch(action ? buttons[action] : drivingPad, type, {
        pointerId: id,
        pointerType: 'touch',
        clientX: bounds.left + ((x + 1) * bounds.width) / 2,
        clientY: bounds.top + ((y + 1) * bounds.height) / 2,
      });
    },
    setActive: (value) => (active = value),
    move(origin, target, id = 1) {
      document.hit = typeof target === 'string' ? buttons[target] : target;
      pointer(origin, 'pointermove', id);
    },
  };
}

test('direction pads support sliding, neutral gaps, and returning without recapturing', (t) => {
  const { input, buttons, pointer, move } = createFixture(t);
  pointer('up', 'pointerdown');
  assert.equal(input.isDown('up'), true);
  move('up', new InputElement({}, buttons.down));
  assert.equal(input.isDown('up'), false);
  assert.equal(input.isDown('down'), true);
  assert.equal(buttons.up.classList.contains('pressed'), false);
  assert.equal(buttons.down.classList.contains('pressed'), true);
  assert.equal(buttons.up.hasPointerCapture(1), true);
  assert.equal(buttons.down.hasPointerCapture(1), false);
  move('up', buttons.down.parentElement);
  assert.equal(input.isDown('down'), false, 'space between buttons is neutral');
  move('up', null);
  assert.equal(input.isDown('up'), false, 'leaving the viewport is neutral');
  move('up', 'up');
  assert.equal(input.isDown('up'), true);
  pointer('up', 'pointerup');
  assert.equal(input.isDown('up'), false);
});

test('a D-pad activates only the four visible arrow rectangles', (t) => {
  const { input, buttons, drivingPad, padPointer } = createFixture(t, { dpad: true });
  for (const [x, y, expected] of [
    [0, -0.7, ['up']],
    [0, 0.7, ['down']],
    [-0.7, 0, ['left']],
    [0.7, 0, ['right']],
    [-0.7, -0.7, []],
    [0.7, -0.7, []],
    [-0.7, 0.7, []],
    [0.7, 0.7, []],
    [0, 0, []],
    [0, -0.4, []],
    [0, 0.4, []],
    [-0.4, 0, []],
    [0.4, 0, []],
  ]) {
    padPointer(null, 'pointerdown', x, y);
    assert.equal(drivingPad.hasPointerCapture(1), true);
    assert.deepEqual(
      Object.keys(input.snapshot())
        .filter((action) => input.isDown(action))
        .sort(),
      expected.toSorted(),
    );
    assert.deepEqual(
      Object.keys(buttons)
        .filter((action) => buttons[action].classList.contains('pressed'))
        .sort(),
      expected.toSorted(),
    );
    padPointer(null, 'pointerup', x, y);
    assert.equal(Object.values(input.snapshot()).some(Boolean), false);
  }
});

test('D-pad hit testing follows each arrow after layout changes', (t) => {
  const { input, buttons, padPointer } = createFixture(t, { dpad: true });
  buttons.up.bounds = { left: 120, top: 50, width: 44, height: 44 };
  padPointer(null, 'pointerdown', 0, -0.7);
  assert.equal(input.isDown('up'), false, 'the former arrow position is neutral');
  padPointer(null, 'pointermove', 0.4, -0.6);
  assert.equal(input.isDown('up'), true, 'the relocated arrow responds at its actual position');
  buttons.up.bounds.width = 0;
  padPointer(null, 'pointermove', 0.4, -0.6);
  assert.equal(input.isDown('up'), false, 'collapsed arrows cannot capture input');
});

test('the most recently entered arrow wins across fingers and falls back on release', (t) => {
  const { input, buttons, padPointer } = createFixture(t, { dpad: true });
  padPointer('up', 'pointerdown', 0, -0.7, 1);
  padPointer('right', 'pointerdown', 0.7, 0, 2);
  assert.equal(input.isDown('right'), true);
  assert.equal(input.isDown('up'), false);
  assert.equal(buttons.right.classList.contains('pressed'), true);
  assert.equal(buttons.up.classList.contains('pressed'), false);
  padPointer('up', 'pointermove', 0.1, -0.8, 1);
  assert.equal(
    input.isDown('right'),
    true,
    'motion within the older arrow does not steal priority',
  );
  padPointer('up', 'pointermove', 0, 0, 1);
  padPointer('up', 'pointermove', 0, -0.7, 1);
  assert.equal(input.isDown('up'), true, 'entering an arrow again selects it');
  assert.equal(input.isDown('right'), false);
  padPointer('up', 'pointercancel', 0, -0.7, 1);
  assert.equal(input.isDown('right'), true, 'the other held direction resumes');
  padPointer('right', 'pointerup', 0.7, 0, 2);
  assert.equal(Object.values(input.snapshot()).some(Boolean), false);
});

test('keyboard direction priority ignores repeats and resumes a still-held arrow', (t) => {
  const { input, window } = createFixture(t, { exclusiveDirections: true });
  dispatch(window, 'keydown', { code: 'ArrowUp' });
  dispatch(window, 'keydown', { code: 'ArrowRight' });
  dispatch(window, 'keydown', { code: 'ArrowUp', repeat: true });
  assert.equal(input.isDown('right'), true);
  assert.equal(input.isDown('up'), false);
  dispatch(window, 'keydown', { code: 'KeyS' });
  assert.equal(input.isDown('down'), true, 'WASD participates in the same ordering');
  assert.equal(input.isDown('right'), false);
  dispatch(window, 'keyup', { code: 'KeyS' });
  assert.equal(input.isDown('right'), true);
  dispatch(window, 'keyup', { code: 'ArrowRight' });
  assert.equal(input.isDown('up'), true);
  dispatch(window, 'keydown', { code: 'ArrowDown' });
  assert.equal(input.isDown('down'), true, 'opposite arrows also select the newer direction');
  assert.equal(input.isDown('up'), false);
  dispatch(window, 'keyup', { code: 'ArrowDown' });
  dispatch(window, 'keyup', { code: 'ArrowUp' });
  assert.equal(Object.values(input.snapshot()).some(Boolean), false);
});

test('keyboard and touch share direction priority without affecting auxiliary actions', (t) => {
  const { input, window, padPointer, pointer } = createFixture(t, { dpad: true });
  dispatch(window, 'keydown', { code: 'ArrowUp' });
  padPointer('left', 'pointerdown', -0.7, 0);
  assert.equal(input.isDown('left'), true);
  assert.equal(input.isDown('up'), false);
  pointer('brake', 'pointerdown', 2);
  dispatch(window, 'keydown', { code: 'KeyB' });
  assert.equal(input.isDown('left') && input.isDown('brake') && input.isDown('boost'), true);
  dispatch(window, 'keydown', { code: 'ArrowRight' });
  assert.equal(input.isDown('right'), true);
  assert.equal(input.isDown('left'), false);
  dispatch(window, 'keyup', { code: 'ArrowRight' });
  assert.equal(input.isDown('left'), true);
  padPointer('left', 'lostpointercapture', -0.7, 0);
  assert.equal(input.isDown('up'), true);
  assert.equal(input.isDown('brake') && input.isDown('boost'), true);
  assert.deepEqual(
    Object.keys(input.snapshot()).filter((action) => input.isDown(action)),
    ['up', 'brake', 'boost'],
  );
});

test('D-pad sliding crosses neutral gaps, selects another arrow and releases outside', (t) => {
  const { input, buttons, drivingPad, padPointer } = createFixture(t, { dpad: true });
  padPointer('up', 'pointerdown', 0, -0.7);
  // The same down event also bubbles to the pad in a browser. It cannot recapture.
  padPointer(null, 'pointerdown', 0, -0.7);
  assert.equal(buttons.up.hasPointerCapture(1), true);
  assert.equal(drivingPad.hasPointerCapture(1), false);
  padPointer('up', 'pointermove', -0.7, -0.7);
  assert.equal(Object.values(input.snapshot()).some(Boolean), false, 'empty corners are neutral');
  padPointer('up', 'pointermove', 0.7, 0);
  assert.equal(input.isDown('right'), true);
  assert.equal(input.isDown('up') || input.isDown('left'), false);
  padPointer('up', 'pointermove', 0.2, -0.2);
  assert.equal(Object.values(input.snapshot()).some(Boolean), false, 'the center is neutral');
  padPointer('up', 'pointermove', -0.7, 0);
  assert.equal(input.isDown('left'), true);
  padPointer('up', 'pointermove', -1.1, -0.7);
  assert.equal(Object.values(input.snapshot()).some(Boolean), false, 'outside the pad is neutral');
  padPointer('up', 'pointermove', 0, -0.7);
  assert.equal(input.isDown('up'), true, 'returning to the pad resumes driving');
  padPointer('up', 'pointercancel', 0, -0.7);
  assert.equal(Object.values(input.snapshot()).some(Boolean), false);
});

test('a D-pad touch and auxiliary controls remain independent', (t) => {
  const { input, padPointer, pointer } = createFixture(t, { dpad: true });
  padPointer(null, 'pointerdown', 0, -0.7);
  pointer('brake', 'pointerdown', 2);
  pointer('boost', 'pointerdown', 3);
  assert.equal(input.isDown('up') && input.isDown('brake') && input.isDown('boost'), true);
  padPointer(null, 'pointermove', 1.1, 0);
  assert.equal(input.isDown('up') || input.isDown('left'), false);
  assert.equal(input.isDown('brake'), true, 'leaving the D-pad keeps the other finger held');
  padPointer(null, 'pointermove', 0.7, 0);
  pointer('brake', 'pointerup', 2);
  assert.equal(input.isDown('right') && input.isDown('boost'), true);
  assert.equal(input.isDown('brake'), false);
  padPointer(null, 'lostpointercapture', 0.7, 0);
  assert.equal(input.isDown('right'), false);
  assert.equal(input.isDown('boost'), true);
  pointer('boost', 'pointerup', 3);
  assert.equal(Object.values(input.snapshot()).some(Boolean), false);
});

test('D-pad cleanup releases captures, selected actions and pressed arrows', (t) => {
  const { input, buttons, drivingPad, padPointer, window, document } = createFixture(t, {
    dpad: true,
  });
  for (const cleanup of [
    () => input.clear(),
    () => dispatch(window, 'blur'),
    () => {
      document.hidden = true;
      dispatch(document, 'visibilitychange');
    },
    () => input.dispose(),
  ]) {
    padPointer(null, 'pointerdown', 0, -0.7);
    assert.equal(input.isDown('up'), true);
    cleanup();
    assert.equal(Object.values(input.snapshot()).some(Boolean), false);
    assert.equal(drivingPad.hasPointerCapture(1), false);
    assert.equal(
      Object.values(buttons).some((button) => button.classList.contains('pressed')),
      false,
    );
    document.hidden = false;
  }
  padPointer(null, 'pointerdown', 0, -0.7);
  assert.equal(input.isDown('up'), false, 'disposed D-pads no longer accept input');
});

test('sliding never transfers a finger to another pad or an auxiliary action', (t) => {
  const { input, buttons, pointer, move } = createFixture(t);
  pointer('left', 'pointerdown');
  for (const target of ['up', 'brake']) {
    move('left', target);
    assert.equal(input.isDown('left'), false);
    assert.equal(input.isDown(target), false);
  }
  const unregistered = new InputElement({ control: 'up' }, buttons.left.parentElement);
  move('left', unregistered);
  assert.equal(input.isDown('up'), false, 'only registered controls are actionable');
  move('left', 'right');
  assert.equal(input.isDown('right'), true);
});

test('independent fingers can accelerate and change steering without releasing each other', (t) => {
  const { input, buttons, pointer, move } = createFixture(t);
  pointer('up', 'pointerdown', 1);
  pointer('left', 'pointerdown', 2);
  move('left', 'right', 2);
  assert.equal(input.isDown('up'), true);
  assert.equal(input.isDown('left'), false);
  assert.equal(input.isDown('right'), true);
  pointer('left', 'pointerup', 2);
  assert.equal(input.isDown('up'), true);
  assert.equal(input.isDown('right'), false);
  assert.equal(buttons.right.classList.contains('pressed'), false);
  pointer('up', 'pointerup', 1);
  assert.equal(input.isDown('up'), false);
});

test('buttons outside a direction pad retain their original hold behavior', (t) => {
  const { input, pointer, move } = createFixture(t);
  pointer('brake', 'pointerdown');
  move('brake', 'up');
  assert.equal(input.isDown('brake'), true);
  assert.equal(input.isDown('up'), false);
  move('brake', null);
  assert.equal(input.isDown('brake'), true);
  pointer('brake', 'pointerup');
  assert.equal(input.isDown('brake'), false);
});

test('cancelled or lost pointer capture releases the action selected after sliding', (t) => {
  const { input, buttons, pointer, move } = createFixture(t);
  for (const type of ['pointercancel', 'lostpointercapture']) {
    pointer('up', 'pointerdown');
    move('up', 'down');
    pointer('up', type);
    assert.equal(input.isDown('down'), false, type);
    assert.equal(buttons.down.classList.contains('pressed'), false, type);
  }
});

test('keyboard input remains independent of touch sliding and releases normally', (t) => {
  const { input, window, pointer, move } = createFixture(t);
  dispatch(window, 'keydown', { code: 'ArrowUp' });
  pointer('up', 'pointerdown');
  move('up', null);
  assert.equal(input.isDown('up'), true, 'a held keyboard key survives touch release');
  pointer('up', 'pointerup');
  assert.equal(input.isDown('up'), true);
  dispatch(window, 'keyup', { code: 'ArrowUp' });
  assert.equal(input.isDown('up'), false);
});

test('platformer running and jumping remain simultaneous without exclusive directions', (t) => {
  const { input, window, pointer } = createFixture(t, {
    bindings: { left: ['KeyA'], right: ['KeyD'], jump: ['Space'] },
  });
  dispatch(window, 'keydown', { code: 'KeyA' });
  dispatch(window, 'keydown', { code: 'Space' });
  assert.equal(input.isDown('left') && input.isDown('jump'), true);
  dispatch(window, 'keyup', { code: 'KeyA' });
  dispatch(window, 'keyup', { code: 'Space' });
  pointer('right', 'pointerdown', 1);
  pointer('jump', 'pointerdown', 2);
  assert.equal(input.isDown('right') && input.isDown('jump'), true);
  pointer('jump', 'pointerup', 2);
  assert.equal(input.isDown('right'), true);
  assert.equal(input.isDown('jump'), false);
});

test('clear, blur, visibility and disposal release original captures and slid actions', (t) => {
  const { input, buttons, document, window, pointer, move, setActive } = createFixture(t);
  for (const cleanup of [
    () => input.clear(),
    () => dispatch(window, 'blur'),
    () => {
      document.hidden = true;
      dispatch(document, 'visibilitychange');
    },
  ]) {
    dispatch(window, 'keydown', { code: 'ArrowUp' });
    pointer('left', 'pointerdown');
    move('left', 'right');
    cleanup();
    assert.equal(Object.values(input.snapshot()).some(Boolean), false);
    assert.equal(buttons.left.hasPointerCapture(1), false);
    assert.equal(buttons.right.classList.contains('pressed'), false);
    document.hidden = false;
  }
  setActive(false);
  pointer('up', 'pointerdown');
  dispatch(window, 'keydown', { code: 'ArrowUp' });
  assert.equal(input.isDown('up'), false, 'inactive games reject new inputs');
  setActive(true);
  pointer('up', 'pointerdown');
  move('up', 'down');
  input.dispose();
  assert.equal(buttons.up.hasPointerCapture(1), false);
  assert.equal(input.isDown('down'), false);
  pointer('up', 'pointerdown');
  dispatch(window, 'keydown', { code: 'ArrowUp' });
  assert.equal(input.isDown('up'), false, 'disposed controls no longer listen');
});

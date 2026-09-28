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
}

function dispatch(target, type, properties = {}) {
  const event = new Event(type, { cancelable: true });
  Object.assign(event, properties);
  target.dispatchEvent(event);
  return event;
}

function createFixture(t) {
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
  const steering = new InputElement({ controlPad: 'steering' });
  const throttle = new InputElement({ controlPad: 'throttle' });
  const buttons = Object.fromEntries(
    [
      ['left', steering],
      ['right', steering],
      ['gas', throttle],
      ['reverse', throttle],
      ['brake', null],
    ].map(([action, pad]) => [action, new InputElement({ control: action }, pad)]),
  );
  let active = true;
  const input = createGameInput({
    bindings: {
      left: ['ArrowLeft'],
      right: ['ArrowRight'],
      gas: ['ArrowUp'],
      reverse: ['ArrowDown'],
      brake: ['Space'],
    },
    buttons: Object.values(buttons),
    isActive: () => active,
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
    setActive: (value) => (active = value),
    move(origin, target, id = 1) {
      document.hit = typeof target === 'string' ? buttons[target] : target;
      pointer(origin, 'pointermove', id);
    },
  };
}

test('direction pads support sliding, neutral gaps, and returning without recapturing', (t) => {
  const { input, buttons, pointer, move } = createFixture(t);
  pointer('gas', 'pointerdown');
  assert.equal(input.isDown('gas'), true);
  move('gas', new InputElement({}, buttons.reverse));
  assert.equal(input.isDown('gas'), false);
  assert.equal(input.isDown('reverse'), true);
  assert.equal(buttons.gas.classList.contains('pressed'), false);
  assert.equal(buttons.reverse.classList.contains('pressed'), true);
  assert.equal(buttons.gas.hasPointerCapture(1), true);
  assert.equal(buttons.reverse.hasPointerCapture(1), false);
  move('gas', buttons.reverse.parentElement);
  assert.equal(input.isDown('reverse'), false, 'space between buttons is neutral');
  move('gas', null);
  assert.equal(input.isDown('gas'), false, 'leaving the viewport is neutral');
  move('gas', 'gas');
  assert.equal(input.isDown('gas'), true);
  pointer('gas', 'pointerup');
  assert.equal(input.isDown('gas'), false);
});

test('sliding never transfers a finger to another pad or an auxiliary action', (t) => {
  const { input, buttons, pointer, move } = createFixture(t);
  pointer('left', 'pointerdown');
  for (const target of ['gas', 'brake']) {
    move('left', target);
    assert.equal(input.isDown('left'), false);
    assert.equal(input.isDown(target), false);
  }
  const unregistered = new InputElement({ control: 'gas' }, buttons.left.parentElement);
  move('left', unregistered);
  assert.equal(input.isDown('gas'), false, 'only registered controls are actionable');
  move('left', 'right');
  assert.equal(input.isDown('right'), true);
});

test('independent fingers can accelerate and change steering without releasing each other', (t) => {
  const { input, buttons, pointer, move } = createFixture(t);
  pointer('gas', 'pointerdown', 1);
  pointer('left', 'pointerdown', 2);
  move('left', 'right', 2);
  assert.equal(input.isDown('gas'), true);
  assert.equal(input.isDown('left'), false);
  assert.equal(input.isDown('right'), true);
  pointer('left', 'pointerup', 2);
  assert.equal(input.isDown('gas'), true);
  assert.equal(input.isDown('right'), false);
  assert.equal(buttons.right.classList.contains('pressed'), false);
  pointer('gas', 'pointerup', 1);
  assert.equal(input.isDown('gas'), false);
});

test('buttons outside a direction pad retain their original hold behavior', (t) => {
  const { input, pointer, move } = createFixture(t);
  pointer('brake', 'pointerdown');
  move('brake', 'gas');
  assert.equal(input.isDown('brake'), true);
  assert.equal(input.isDown('gas'), false);
  move('brake', null);
  assert.equal(input.isDown('brake'), true);
  pointer('brake', 'pointerup');
  assert.equal(input.isDown('brake'), false);
});

test('cancelled or lost pointer capture releases the action selected after sliding', (t) => {
  const { input, buttons, pointer, move } = createFixture(t);
  for (const type of ['pointercancel', 'lostpointercapture']) {
    pointer('gas', 'pointerdown');
    move('gas', 'reverse');
    pointer('gas', type);
    assert.equal(input.isDown('reverse'), false, type);
    assert.equal(buttons.reverse.classList.contains('pressed'), false, type);
  }
});

test('keyboard input remains independent of touch sliding and releases normally', (t) => {
  const { input, window, pointer, move } = createFixture(t);
  dispatch(window, 'keydown', { code: 'ArrowUp' });
  pointer('gas', 'pointerdown');
  move('gas', null);
  assert.equal(input.isDown('gas'), true, 'a held keyboard key survives touch release');
  pointer('gas', 'pointerup');
  assert.equal(input.isDown('gas'), true);
  dispatch(window, 'keyup', { code: 'ArrowUp' });
  assert.equal(input.isDown('gas'), false);
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
  pointer('gas', 'pointerdown');
  dispatch(window, 'keydown', { code: 'ArrowUp' });
  assert.equal(input.isDown('gas'), false, 'inactive games reject new inputs');
  setActive(true);
  pointer('gas', 'pointerdown');
  move('gas', 'reverse');
  input.dispose();
  assert.equal(buttons.gas.hasPointerCapture(1), false);
  assert.equal(input.isDown('reverse'), false);
  pointer('gas', 'pointerdown');
  dispatch(window, 'keydown', { code: 'ArrowUp' });
  assert.equal(input.isDown('gas'), false, 'disposed controls no longer listen');
});

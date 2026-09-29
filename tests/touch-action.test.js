import assert from 'node:assert/strict';
import test from 'node:test';
import { bindTouchAction } from '../assets/shared/touch-action.js';

function fixture(t) {
  const button = new EventTarget();
  const captures = new Set();
  button.setPointerCapture = (id) => captures.add(id);
  button.hasPointerCapture = (id) => captures.has(id);
  button.releasePointerCapture = (id) => captures.delete(id);
  let activations = 0;
  const dispose = bindTouchAction(button, () => activations++);
  t.after(dispose);
  return {
    button,
    dispose,
    get activations() {
      return activations;
    },
    send(type, properties = {}) {
      const event = new Event(type, { cancelable: true });
      Object.assign(event, { button: 0, pointerId: 1, detail: 1 }, properties);
      button.dispatchEvent(event);
      return event;
    },
  };
}

for (const pointerType of ['touch', 'pen']) {
  test(`${pointerType} actions activate a secondary pointer once and suppress its click`, (t) => {
    const f = fixture(t);
    const down = f.send('pointerdown', { pointerType, isPrimary: false });
    assert.equal(down.defaultPrevented, true);
    assert.equal(f.activations, 1, 'does not wait for a click from the secondary pointer');
    assert.equal(
      f.button.hasPointerCapture(1),
      true,
      'capture precedes an action that can open a menu',
    );
    f.send('pointerup', { pointerType });
    assert.equal(f.send('click', { pointerType }).defaultPrevented, true);
    assert.equal(f.activations, 1, 'a synthesized click cannot toggle the action twice');
  });
}

test('legacy compatibility clicks are suppressed without swallowing keyboard or mouse activation', (t) => {
  const f = fixture(t);
  f.send('pointerdown', { pointerType: 'touch' });
  f.send('pointerup', { pointerType: 'touch' });
  assert.equal(f.send('click').defaultPrevented, true, 'older clicks may not expose pointerType');
  assert.equal(f.activations, 1);
  f.send('click', { detail: 0 });
  assert.equal(f.activations, 2, 'keyboard and assistive activation still use click');
  f.send('pointerdown', { pointerType: 'mouse' });
  assert.equal(f.activations, 2, 'mouse waits for its normal click');
  f.send('click', { pointerType: 'mouse' });
  assert.equal(f.activations, 3, 'mouse clicks work after a touch');
});

test('disabled buttons and pen barrel buttons do not activate actions', (t) => {
  const f = fixture(t);
  f.button.disabled = true;
  f.send('pointerdown', { pointerType: 'touch' });
  f.send('click', { detail: 0 });
  assert.equal(f.activations, 0);
  f.button.disabled = false;
  f.send('pointerdown', { pointerType: 'pen', button: 2 });
  assert.equal(f.activations, 0);
});

test('assistive zero-detail touch clicks activate without requiring pointerdown', (t) => {
  const f = fixture(t);
  f.send('click', { pointerType: 'touch', detail: 0 });
  assert.equal(f.activations, 1);
  f.send('pointerdown', { pointerType: 'touch' });
  f.send('pointerup', { pointerType: 'touch' });
  f.send('click', { pointerType: 'touch', detail: 0 });
  assert.equal(f.activations, 3, 'prior pointer suppression must not swallow assistive clicks');
});

test('disposing an action releases remaining captures and removes every activation listener', (t) => {
  const f = fixture(t);
  f.send('pointerdown', { pointerType: 'touch' });
  f.dispose();
  assert.equal(f.button.hasPointerCapture(1), false);
  f.send('pointerdown', { pointerType: 'touch' });
  f.send('click', { detail: 0 });
  assert.equal(f.activations, 1);
});

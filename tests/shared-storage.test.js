import assert from 'node:assert/strict';
import test from 'node:test';
import { readStoredNumber, writeStoredNumber } from '../assets/shared/storage.js';

function installStorage(t, descriptor) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, ...descriptor });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete globalThis.localStorage;
  });
}

function memoryStorage(t) {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  };
  installStorage(t, { value: storage });
  return storage;
}

test('missing and empty score entries use the caller fallback', (t) => {
  const storage = memoryStorage(t);
  assert.equal(readStoredNumber('missing'), 0);
  assert.equal(readStoredNumber('missing', 25), 25);
  assert.equal(readStoredNumber('missing', Infinity), Infinity);
  for (const value of ['', ' ', '\n\t']) {
    storage.setItem('score', value);
    assert.equal(readStoredNumber('score', 25), 25);
  }
});

test('corrupt, negative and nonfinite stored values cannot become scores', (t) => {
  const storage = memoryStorage(t);
  for (const value of [
    'broken',
    '{"score":12}',
    'null',
    'undefined',
    '-1',
    '-0.5',
    'NaN',
    'Infinity',
    '-Infinity',
    '1e309',
  ]) {
    storage.setItem('score', value);
    assert.equal(readStoredNumber('score', 25), 25, `${value} falls back`);
  }
});

test('zero and finite nonnegative scores roundtrip without replacing a valid zero with fallback', (t) => {
  const storage = memoryStorage(t);
  for (const value of [0, 25, 1234.5, Number.MAX_SAFE_INTEGER]) {
    assert.equal(writeStoredNumber('score', value), true);
    assert.equal(storage.getItem('score'), String(value));
    assert.equal(readStoredNumber('score', 99), value);
  }
});

test('invalid writes preserve the existing record', (t) => {
  const storage = memoryStorage(t);
  storage.setItem('score', '350');
  for (const value of [-1, -0.5, NaN, Infinity, -Infinity, '400', null, undefined]) {
    assert.equal(writeStoredNumber('score', value), false);
    assert.equal(storage.getItem('score'), '350');
  }
});

test('blocked getItem and setItem fail safely', (t) => {
  installStorage(t, {
    value: {
      getItem() {
        throw new Error('Storage access denied');
      },
      setItem() {
        throw new Error('Quota exceeded');
      },
    },
  });
  assert.equal(readStoredNumber('score', 25), 25);
  assert.equal(writeStoredNumber('score', 100), false);
});

test('an unavailable localStorage property fails safely before method access', (t) => {
  installStorage(t, {
    get() {
      throw new Error('Storage is unavailable for this origin');
    },
  });
  assert.equal(readStoredNumber('score'), 0);
  assert.equal(writeStoredNumber('score', 100), false);
});

test('storage-free environments can still run score code', (t) => {
  installStorage(t, { value: undefined });
  delete globalThis.localStorage;
  assert.equal(readStoredNumber('score', Infinity), Infinity);
  assert.equal(writeStoredNumber('score', 100), false);
});

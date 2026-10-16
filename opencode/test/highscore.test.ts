import { describe, expect, test } from 'bun:test';
import type { Context } from '../src/host';
import { HIGHSCORE_KEY, bestAfter, createHighscore, isValidScore } from '../src/highscore';

/** Map-backed fake of the host storage; mutate applies the draft and persists. */
function fakeStorage(backing: Map<string, object>): Context['storage'] {
  return {
    store<Value extends object>(key: string, options: { readonly initial: Value }) {
      if (!backing.has(key)) backing.set(key, structuredClone(options.initial));
      const store = backing.get(key) as Value;
      const mutate = async (mutation: (draft: Value) => void) => {
        mutation(store);
      };
      return [store, mutate] as const;
    },
  };
}

describe('isValidScore', () => {
  test('accepts whole numbers in range', () => {
    for (const s of [0, 1, 120, 999_999_999]) expect(isValidScore(s)).toBe(true);
  });
  test('rejects everything else', () => {
    for (const s of [1.5, -1, '120', NaN, 1e9, Infinity, null, undefined, {}]) {
      expect(isValidScore(s)).toBe(false);
    }
  });
});

describe('bestAfter', () => {
  test('keeps higher valid scores only', () => {
    expect(bestAfter(10, 20)).toBe(20);
    expect(bestAfter(10, 5)).toBe(10);
    expect(bestAfter(10, 10)).toBe(10);
    expect(bestAfter(10, 1.5)).toBe(10);
    expect(bestAfter(10, '120')).toBe(10);
    expect(bestAfter(10, 1e9)).toBe(10);
  });
});

describe('createHighscore', () => {
  test('starts at 0 and records only higher valid scores', async () => {
    const hs = createHighscore(fakeStorage(new Map()));
    expect(hs.best()).toBe(0);
    expect(await hs.record(50)).toBe(true);
    expect(hs.best()).toBe(50);
    expect(await hs.record(30)).toBe(false);
    expect(await hs.record(50)).toBe(false);
    for (const bad of [1.5, -1, '120', NaN, 1e9]) expect(await hs.record(bad)).toBe(false);
    expect(hs.best()).toBe(50);
  });

  test('best survives a reload', async () => {
    const backing = new Map<string, object>();
    await createHighscore(fakeStorage(backing)).record(77);
    expect(createHighscore(fakeStorage(backing)).best()).toBe(77);
  });

  test('corrupted stored value reads as 0 and can be replaced', async () => {
    const backing = new Map<string, object>([[HIGHSCORE_KEY, { best: 'oops' }]]);
    const hs = createHighscore(fakeStorage(backing));
    expect(hs.best()).toBe(0);
    expect(await hs.record(5)).toBe(true);
    expect(hs.best()).toBe(5);
  });
});

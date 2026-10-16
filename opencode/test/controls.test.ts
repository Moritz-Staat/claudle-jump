import { describe, expect, test } from 'bun:test';

import { create } from '../../hooks/game';
import { KEY_BINDS, keyAction, newPlay, press, tick } from '../src/controls';
import type { Action, Play } from '../src/types';

const SIZE = { width: 40, height: 20 };

function playing(): Play {
  return press(newPlay(SIZE.width, SIZE.height, 7), 'start', 7);
}

describe('keyAction', () => {
  const table: [string, Action | null][] = [
    ['a', 'left'], ['h', 'left'], ['left', 'left'],
    ['d', 'right'], ['l', 'right'], ['right', 'right'],
    ['space', 'start'], [' ', 'start'], ['s', 'start'], ['return', 'start'], ['enter', 'start'],
    ['p', 'pause'],
    ['escape', 'leave'], ['esc', 'leave'],
    ['A', 'left'], ['Space', 'start'], ['ESCAPE', 'leave'],
    ['x', null], ['', null], ['up', null], ['constructor', null],
  ];

  for (const [key, action] of table) {
    test(`${JSON.stringify(key)} -> ${action}`, () => {
      expect(keyAction(key)).toBe(action);
    });
  }

  test('every bound key maps to its declared action', () => {
    expect(KEY_BINDS.map((bind) => bind.key).sort()).toEqual(
      ['a', 'd', 'h', 'l', 'left', 'p', 'escape', 'return', 'right', 's', 'space'].sort());
    for (const bind of KEY_BINDS) expect(keyAction(bind.key)).toBe(bind.action);
  });
});

describe('newPlay', () => {
  test('is a ready board with no input and no record', () => {
    const play = newPlay(30, 12, 1);
    expect(play.game.status).toBe('ready');
    expect([play.game.width, play.game.height]).toEqual([30, 12]);
    expect(play.pending).toEqual({ left: 0, right: 0 });
    expect(play.isRecord).toBe(false);
  });
});

describe('press', () => {
  test('presses accumulate impulses', () => {
    const play = press(press(press(playing(), 'left'), 'left'), 'right');
    expect(play.pending).toEqual({ left: 2, right: 1 });
  });

  test('impulses steer the doodler after a tick', () => {
    const base = playing();
    const left = tick(press(press(base, 'left'), 'left'), SIZE, 0).play;
    const right = tick(press(press(base, 'right'), 'right'), SIZE, 0).play;
    const idle = tick(base, SIZE, 0).play;
    expect(left.game.vx).toBeLessThan(0);
    expect(right.game.vx).toBeGreaterThan(0);
    expect(idle.game.vx).toBe(0);
    expect(left.pending).toEqual({ left: 0, right: 0 });
  });

  test('start begins a game and clears isRecord', () => {
    const over: Play = {
      game: { ...create(40, 20, 3), status: 'over' },
      pending: { left: 0, right: 0 },
      isRecord: true,
    };
    const next = press(over, 'start', 3);
    expect(next.game.status).toBe('playing');
    expect(next.isRecord).toBe(false);
  });

  test('start on a ready board plays', () => {
    expect(playing().game.status).toBe('playing');
  });

  test('pause toggles playing and paused', () => {
    const paused = press(playing(), 'pause');
    expect(paused.game.status).toBe('paused');
    expect(press(paused, 'pause').game.status).toBe('playing');
  });

  test('start resumes a paused game', () => {
    expect(press(press(playing(), 'pause'), 'start').game.status).toBe('playing');
  });
});

describe('tick', () => {
  test('a ready board of another size is recreated at the new size', () => {
    const { play, finished } = tick(newPlay(40, 20, 1), { width: 60, height: 30 }, 0);
    expect([play.game.width, play.game.height]).toEqual([60, 30]);
    expect(play.game.status).toBe('ready');
    expect(finished).toBeUndefined();
  });

  test('a ready board of the same size is returned unchanged', () => {
    const ready = newPlay(40, 20, 1);
    expect(tick(ready, SIZE, 0).play).toBe(ready);
  });

  test('a playing game adopts a new height but keeps its width', () => {
    const { play } = tick(playing(), { width: 40, height: 25 }, 0);
    expect(play.game.height).toBe(25);
    expect(play.game.width).toBe(40);
    expect(play.game.status).toBe('playing');
  });

  test('a playing game advances', () => {
    const before = playing();
    expect(tick(before, SIZE, 0).play.game.y).not.toBe(before.game.y);
  });

  test('a paused game does not move', () => {
    const paused = press(press(playing(), 'pause'), 'left');
    const { play, finished } = tick(paused, SIZE, 0);
    expect(play).toBe(paused);
    expect(finished).toBeUndefined();
  });

  test('game over yields finished score and isRecord', () => {
    const fall = (hi: number) => {
      const start = playing();
      const play: Play = { ...start, game: { ...start.game, y: -50, vy: -5, platforms: [] } };
      return tick(play, SIZE, hi);
    };
    const beaten = fall(-1);
    expect(beaten.play.game.status).toBe('over');
    expect(beaten.finished).toBe(beaten.play.game.score);
    expect(beaten.play.isRecord).toBe(true);
    const kept = fall(100);
    expect(kept.finished).toBe(kept.play.game.score);
    expect(kept.play.isRecord).toBe(false);
  });
});

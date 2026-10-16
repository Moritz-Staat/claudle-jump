/** Pure input mapping and play controller; tui.tsx feeds it keys and ticks. */
import { create, step, togglePause, toggleStart } from '../../hooks/game';
import type { Action, Play } from './types';

const KEY_ACTIONS: ReadonlyMap<string, Action> = new Map<string, Action>([
  ['a', 'left'], ['h', 'left'], ['left', 'left'],
  ['d', 'right'], ['l', 'right'], ['right', 'right'],
  ['space', 'start'], [' ', 'start'], ['s', 'start'], ['return', 'start'], ['enter', 'start'],
  ['p', 'pause'],
  ['escape', 'leave'], ['esc', 'leave'],
]);

/** Maps an OpenCode key name to a game action. */
export function keyAction(key: string): Action | null {
  return KEY_ACTIONS.get(key.toLowerCase()) ?? null;
}

/** The keys to bind in OpenCode's keymap. */
export const KEY_BINDS: readonly { key: string; action: Action }[] = [
  'a', 'd', 'h', 'l', 'left', 'right', 'space', 's', 'return', 'p', 'escape',
].map((key) => ({ key, action: KEY_ACTIONS.get(key)! }));

export function newPlay(width: number, height: number, seed?: number): Play {
  return { game: create(width, height, seed), pending: { left: 0, right: 0 }, isRecord: false };
}

export function press(play: Play, action: Exclude<Action, 'leave'>, seed?: number): Play {
  switch (action) {
    case 'left':
      return { ...play, pending: { ...play.pending, left: play.pending.left + 1 } };
    case 'right':
      return { ...play, pending: { ...play.pending, right: play.pending.right + 1 } };
    case 'start': {
      const game = toggleStart(play.game, seed);
      return game === play.game ? play : { ...play, game, isRecord: false };
    }
    case 'pause':
      return { ...play, game: togglePause(play.game) };
  }
}

/** Advances one engine tick; reports the score once when the game ends. */
export function tick(
  play: Play,
  size: { width: number; height: number },
  hi: number,
): { play: Play; finished?: number } {
  const { game } = play;
  if (game.status === 'ready') {
    if (game.width === size.width && game.height === size.height) return { play };
    return { play: { ...play, game: create(size.width, size.height), pending: { left: 0, right: 0 } } };
  }
  if (game.status !== 'playing') return { play };

  const sized = game.height === size.height ? game : { ...game, height: size.height };
  const next = step(sized, play.pending);
  const cleared: Play = { ...play, game: next, pending: { left: 0, right: 0 } };
  if (next.status !== 'over') return { play: cleared };

  return { play: { ...cleared, isRecord: next.score > hi }, finished: next.score };
}

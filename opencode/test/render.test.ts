import { describe, expect, test } from 'bun:test';

import { create, pause, toggleStart, type Game } from '../../hooks/game';
import { boardSize, frame, isTooSmall } from '../src/render';
import type { FrameInput, Line } from '../src/types';
const BS = String.fromCharCode(92);

const text = (line: Line): string => line.map((run) => run.text).join('');

function render(game: Game, extra: Partial<FrameInput> = {}): string[] {
  return frame({ game, hi: 0, isWorking: false, isRecord: false, ...extra }).map(text);
}

/** A quiet 20x10 board: one normal platform at the floor, doodler standing on it. */
function handMade(patch: Partial<Game> = {}): Game {
  return {
    ...create(20, 10, 1),
    platforms: [{ x: 4, y: 0, w: 5, kind: 'normal', dx: 0, isBroken: false }],
    x: 5,
    y: 1,
    status: 'playing',
    ...patch,
  };
}

describe('boardSize', () => {
  test('follows the panel and clamps', () => {
    expect(boardSize(40, 20)).toEqual({ width: 38, height: 17 });
    expect(boardSize(10, 5)).toEqual({ width: 16, height: 8 });
    expect(boardSize(200, 500)).toEqual({ width: 48, height: 120 });
  });
});

describe('isTooSmall', () => {
  test('flags panels below 18 columns or 11 rows', () => {
    expect(isTooSmall(17, 30)).toBe(true);
    expect(isTooSmall(40, 10)).toBe(true);
    expect(isTooSmall(18, 11)).toBe(false);
  });
});

describe('frame layout', () => {
  test('has header, borders and one row per board row', () => {
    const rows = render(handMade());
    expect(rows).toHaveLength(10 + 3);
    expect(rows[1]).toBe('+' + '-'.repeat(20) + '+');
    expect(rows[12]).toBe(rows[1]!);
    for (const row of rows.slice(2, 12)) {
      expect(row).toHaveLength(22);
      expect(row.startsWith('|') && row.endsWith('|')).toBe(true);
    }
  });

  test('merges adjacent cells of one colour into a single run', () => {
    const lines = frame({ game: handMade(), hi: 0, isWorking: false, isRecord: false });
    const platformRow = lines[2 + 9]!;
    const platform = platformRow.find((run) => run.text.includes('====='));
    expect(platform?.color).toBe('green');
  });
});

describe('running board', () => {
  test('draws platform and doodler at their rows', () => {
    const rows = render(handMade());
    expect(rows[11]).toBe('|    =====           |');
    // Doodler y=1 stands on platform y=0: feet one row above it, head above.
    expect(rows[10]).toContain('/ ' + BS);
    expect(rows[9]).toContain('(o)');
  });

  test('uses the sprite of each platform kind and the squash feet', () => {
    const game = handMade({
      sinceBounce: 0,
      platforms: [
        { x: 0, y: 0, w: 5, kind: 'moving', dx: 4, isBroken: false },
        { x: 6, y: 0, w: 5, kind: 'breaking', dx: 0, isBroken: false },
        { x: 12, y: 0, w: 5, kind: 'spring', dx: 0, isBroken: false },
        { x: 0, y: 5, w: 5, kind: 'normal', dx: 0, isBroken: true },
      ],
    });
    const rows = render(game);
    expect(rows[11]).toContain('<===>');
    expect(rows[11]).toContain('~~~~~');
    expect(rows[11]).toContain('==^==');
    expect(rows[10]).toContain('/_' + BS);
    expect(rows.join('')).not.toContain('=====');
  });

  test('shows the doodler leaning with its speed', () => {
    expect(render(handMade({ vx: 5 })).join('\n')).toContain('(o>');
    expect(render(handMade({ vx: -5 })).join('\n')).toContain('<o)');
  });

  test('works on a game from the engine', () => {
    const game = toggleStart(create(24, 12, 7), 7);
    const rows = render(game);
    expect(rows).toHaveLength(15);
    expect(rows.slice(2, 14).every((row) => row.length === 26)).toBe(true);
  });
});

describe('header', () => {
  test('shows score, best and agent activity', () => {
    const working = render(handMade({ score: 12, width: 40 }), { hi: 99, isWorking: true })[0]!;
    expect(working).toContain('SCORE 12');
    expect(working).toContain('HI 99');
    expect(working).toContain('* Agent working');
    expect(working).toHaveLength(42);
    expect(render(handMade())[0]).toContain('- Agent idle');
  });
});

describe('overlays', () => {
  test('start screen', () => {
    const rows = render(create(24, 14, 3)).join('\n');
    expect(rows).toContain('CLAUDLE JUMP');
    expect(rows).toContain('space');
  });

  test('paused with banner', () => {
    const rows = render(pause(handMade({ width: 40 }), 'Agent is done - back to work!')).join('\n');
    expect(rows).toContain('Agent is done - back to work!');
    expect(rows).toContain('resume');
  });

  test('plain pause', () => {
    expect(render(pause(handMade())).join('\n')).toContain('PAUSED');
  });

  test('game over with a record', () => {
    const over = handMade({ status: 'over', score: 42 });
    const rows = render(over, { hi: 10, isRecord: true }).join('\n');
    expect(rows).toContain('GAME OVER');
    expect(rows).toContain('score 42');
    expect(rows).toContain('NEW HIGHSCORE!');
  });

  test('game over without a record shows the best', () => {
    const rows = render(handMade({ status: 'over', score: 3 }), { hi: 10 }).join('\n');
    expect(rows).toContain('best 10');
    expect(rows).not.toContain('NEW HIGHSCORE!');
  });

  test('keeps every row at width + 2', () => {
    const rows = render(create(16, 8, 3));
    expect(rows.slice(2, 10).every((row) => row.length === 18)).toBe(true);
  });
});

describe('narrow board', () => {
  test('wraps a long banner instead of cutting it', () => {
    const rows = render(pause(handMade(), 'Agent is done - back to work!'));
    expect(rows.join('\n')).toContain('work!');
    expect(rows.slice(2, 12).every((row) => row.length === 22)).toBe(true);
  });
});

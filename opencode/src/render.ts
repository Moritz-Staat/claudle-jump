/** Pure frame renderer: a game state in, coloured terminal rows out. */
import { DOODLER_WIDTH, type Game, type Kind } from '../../hooks/game';
import type { Color, FrameInput, Line, Run } from './types';

const MIN_COLUMNS = 18;
const MIN_ROWS = 11;
const BACKSLASH = String.fromCharCode(92);

const SPRITES: Record<Kind, string> = {
  normal: '=====',
  moving: '<===>',
  breaking: '~~~~~',
  spring: '==^==',
};

const COLORS: Record<Kind, Color> = {
  normal: 'green',
  moving: 'cyan',
  breaking: 'yellow',
  spring: 'magenta',
};

type Cell = { char: string; color: Color; bold?: boolean };

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Board cells for a panel, leaving room for the header and the two borders. */
export function boardSize(columns: number, rows: number): { width: number; height: number } {
  return { width: clamp(columns - 2, 16, 48), height: clamp(rows - 3, 8, 120) };
}

export function isTooSmall(columns: number, rows: number): boolean {
  return columns < MIN_COLUMNS || rows < MIN_ROWS;
}

function blank(): Cell {
  return { char: ' ', color: 'white' };
}

function paint(game: Game): Cell[][] {
  const grid = Array.from({ length: game.height }, () => Array.from({ length: game.width }, blank));
  const base = Math.floor(game.camera);
  const rowOf = (y: number): number => game.height - 1 - (Math.floor(y) - base);
  const put = (row: number, col: number, char: string, color: Color): void => {
    const line = grid[row];
    if (line === undefined || char === ' ') return;
    line[((col % game.width) + game.width) % game.width] = { char, color };
  };

  for (const p of game.platforms) {
    if (p.isBroken) continue;
    const sprite = SPRITES[p.kind].slice(0, p.w);
    const x = Math.round(p.x);
    for (let i = 0; i < sprite.length; i++) put(rowOf(p.y), x + i, sprite[i]!, COLORS[p.kind]);
  }

  const x = Math.floor(game.x);
  const head = game.vx > 1 ? '(o>' : game.vx < -1 ? '<o)' : '(o)';
  const feet = game.sinceBounce < 3 ? '/_' + BACKSLASH : '/ ' + BACKSLASH;
  for (let i = 0; i < DOODLER_WIDTH; i++) {
    put(rowOf(game.y) - 1, x + i, head[i]!, 'white');
    put(rowOf(game.y), x + i, feet[i]!, 'white');
  }

  return grid;
}

function overlayText(game: Game, hi: number, isRecord: boolean): string[] {
  if (game.status === 'ready') {
    return ['CLAUDLE JUMP', '', 'space  start', 'a/d or <-/->  steer', 'p  pause', '', `best ${hi}`];
  }
  if (game.status === 'paused') return [game.banner ?? 'PAUSED', '', 'space  resume'];
  if (game.status === 'over') {
    return [
      ...(game.banner === null ? [] : [game.banner, '']),
      'GAME OVER',
      `score ${game.score}`,
      isRecord ? 'NEW HIGHSCORE!' : `best ${hi}`,
      '',
      'space  play again',
    ];
  }

  return [];
}

/** Stamps the lines centred into a cleared box, so platforms never cut through them. */
function stamp(grid: Cell[][], raw: string[]): void {
  const width = grid[0]?.length ?? 0;
  const lines = raw.flatMap((line) => wrap(line, width - 4));
  const inner = Math.min(width, Math.max(...lines.map((line) => line.length)) + 4);
  const left = Math.floor((width - inner) / 2);
  const top = Math.max(0, Math.floor((grid.length - lines.length - 2) / 2));
  ['', ...lines, ''].forEach((text, i) => {
    const row = grid[top + i];
    if (row === undefined) return;
    const cut = text.slice(0, inner);
    const start = left + Math.floor((inner - cut.length) / 2);
    for (let c = 0; c < inner; c++) row[left + c] = blank();
    for (let c = 0; c < cut.length; c++) {
      row[start + c] = { char: cut[c]!, color: i === 1 ? 'yellow' : 'white', bold: i === 1 };
    }
  });
}

/** Joins neighbours of one colour; a space joins whatever run precedes it. */
function toRuns(cells: Cell[]): Run[] {
  const out: { text: string; color: Color; bold?: boolean }[] = [];
  for (const cell of cells) {
    const last = out[out.length - 1];
    if (last !== undefined && last.bold === cell.bold && (last.color === cell.color || cell.char === ' ')) {
      last.text += cell.char;
    } else {
      out.push({ text: cell.char, color: cell.color, bold: cell.bold });
    }
  }

  return out.map((run) => (run.bold ? run : { text: run.text, color: run.color }));
}

function header({ game, hi, isWorking }: FrameInput): Line {
  const score = `SCORE ${game.score}`;
  const best = `HI ${Math.max(hi, game.status === 'over' ? game.score : 0)}`;
  const agent = isWorking ? '* Agent working' : '- Agent idle';
  const gap = Math.max(1, game.width + 2 - score.length - best.length - agent.length - 2);

  return [
    { text: score, color: 'white', bold: true },
    { text: '  ', color: 'white' },
    { text: best, color: 'yellow' },
    { text: ' '.repeat(gap), color: 'white' },
    { text: agent, color: isWorking ? 'green' : 'gray' },
  ];
}

export function frame(input: FrameInput): Line[] {
  const { game, hi, isRecord } = input;
  const grid = paint(game);
  if (game.status !== 'playing') stamp(grid, overlayText(game, hi, isRecord));

  const border: Line = [{ text: '+' + '-'.repeat(game.width) + '+', color: 'gray' }];
  const wall: Run = { text: '|', color: 'gray' };

  return [header(input), border, ...grid.map((row): Line => [wall, ...toRuns(row), wall]), border];
}

/** Breaks a line at spaces so it fits the overlay box. */
function wrap(text: string, max: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    if (line !== '' && line.length + 1 + word.length > max) {
      out.push(line);
      line = word;
    } else {
      line = line === '' ? word : `${line} ${word}`;
    }
  }
  out.push(line);

  return out;
}

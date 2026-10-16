// The board: runs the engine on the drawing thread's frame clock, reads keys
// while the region has the focus, and draws the world in classic ASCII.
import type { ClientKeyEvent, ClientModule, ClientSurface } from 'claude-code'

import type { BoardProps, Presses } from '../types'
import {
  DOODLER_WIDTH,
  TICK_MS,
  create,
  pause,
  step,
  toggleStart,
  togglePause,
  type Game,
  type Kind,
  type Input,
} from './game'

export const DONE_BANNER = 'Claude is done - back to work!'

type Color = 'green' | 'cyan' | 'yellow' | 'magenta' | 'white' | 'gray' | 'red'

type BoardState = {
  game: Game | null
  pending: Input
  /** The press counters and finish count last applied from props. */
  seen: Presses & { done: number }
  isRecord: boolean
}

const SPRITES: Record<Kind, string> = {
  normal: '=====',
  moving: '<===>',
  breaking: '~~~~~',
  spring: '==^==',
}

const COLORS: Record<Kind, Color> = {
  normal: 'green',
  moving: 'cyan',
  breaking: 'yellow',
  spring: 'magenta',
}

function size(surface: ClientSurface<BoardState>): { width: number; height: number } {
  return {
    width: Math.max(16, Math.min(48, surface.columns - 2)),
    height: Math.max(8, Math.min(120, surface.rows - 3)),
  }
}

function press(state: BoardState, key: 'left' | 'right' | 'start' | 'pause'): BoardState {
  const game = state.game
  if (game === null) return state
  if (key === 'left') return { ...state, pending: { ...state.pending, left: state.pending.left + 1 } }
  if (key === 'right') return { ...state, pending: { ...state.pending, right: state.pending.right + 1 } }
  if (key === 'pause') return { ...state, game: togglePause(game) }
  const started = toggleStart(game)

  return { ...state, game: started, isRecord: started === game ? state.isRecord : false }
}

export function keyAction(event: ClientKeyEvent): 'left' | 'right' | 'start' | 'pause' | null {
  const key = event.key.toLowerCase()
  if (key === 'left' || key === 'a' || key === 'h') return 'left'
  if (key === 'right' || key === 'd' || key === 'l') return 'right'
  if (key === ' ' || key === 'space' || key === 'return' || key === 's') return 'start'
  if (key === 'p') return 'pause'

  return null
}

function tick(surface: ClientSurface<BoardState>, hi: () => number): void {
  const state = surface.state
  if (state === undefined) return
  const { width, height } = size(surface)
  if (surface.columns === 0) return

  let game = state.game
  if (game === null || (game.status === 'ready' && (game.width !== width || game.height !== height))) {
    surface.setState({ ...state, game: create(width, height) })
    return
  }
  if (game.status !== 'playing') return

  if (game.height !== height) game = { ...game, height }
  const next = step(game, state.pending)
  if (next.status === 'over') {
    surface.post({ kind: 'over', score: next.score })
  }
  surface.setState({
    ...state,
    game: next,
    pending: { left: 0, right: 0 },
    isRecord: next.status === 'over' ? next.score > hi() : state.isRecord,
  })
}

type Cell = { char: string; color: Color }

function paint(game: Game): Cell[][] {
  const blank = (): Cell => ({ char: ' ', color: 'white' })
  const grid: Cell[][] = Array.from({ length: game.height }, () =>
    Array.from({ length: game.width }, blank),
  )
  const base = Math.floor(game.camera)
  const rowOf = (y: number): number => game.height - 1 - (Math.floor(y) - base)
  const put = (row: number, col: number, char: string, color: Color): void => {
    const line = grid[row]
    if (line === undefined || char === ' ') return
    line[((col % game.width) + game.width) % game.width] = { char, color }
  }

  for (const p of game.platforms) {
    if (p.isBroken) continue
    const sprite = SPRITES[p.kind].slice(0, p.w)
    const x = Math.round(p.x)
    for (let i = 0; i < sprite.length; i++) put(rowOf(p.y), x + i, sprite[i]!, COLORS[p.kind])
  }

  const x = Math.floor(game.x)
  const head = game.vx > 1 ? '(o>' : game.vx < -1 ? '<o)' : '(o)'
  const feet = game.sinceBounce < 3 ? '/_\\' : '/ \\'
  for (let i = 0; i < DOODLER_WIDTH; i++) {
    put(rowOf(game.y) - 1, x + i, head[i]!, 'white')
    put(rowOf(game.y), x + i, feet[i]!, 'white')
  }

  return grid
}

function overlay(game: Game, isRecord: boolean, hi: number): string[] {
  if (game.status === 'ready') {
    return ['CLAUDLE JUMP', '', 'space  start', 'a/d or <-/->  steer', 'p  pause', '', `best ${hi}`]
  }
  if (game.status === 'paused') return game.banner === null ? ['PAUSED', '', 'space  resume'] : [game.banner, '', 'space  resume']
  if (game.status === 'over') {
    return [
      ...(game.banner === null ? [] : [game.banner, '']),
      'GAME OVER',
      `score ${game.score}`,
      ...(isRecord ? ['NEW HIGHSCORE!'] : [`best ${hi}`]),
      '',
      'space  play again',
    ]
  }

  return []
}

/** Draws the lines centred in a cleared box, so platforms never cut through them. */
function stamp(grid: Cell[][], lines: string[]): void {
  const width = grid[0]?.length ?? 0
  const inner = Math.min(width, Math.max(...lines.map(line => line.length)) + 4)
  const left = Math.floor((width - inner) / 2)
  const top = Math.max(0, Math.floor((grid.length - lines.length - 2) / 2))
  ;['', ...lines, ''].forEach((text, i) => {
    const row = grid[top + i]
    if (row === undefined) return
    const cut = text.slice(0, inner)
    const start = left + Math.floor((inner - cut.length) / 2)
    for (let c = 0; c < inner; c++) row[left + c] = { char: ' ', color: 'white' }
    for (let c = 0; c < cut.length; c++) {
      row[start + c] = { char: cut[c]!, color: i === 1 ? 'yellow' : 'white' }
    }
  })
}

const Board: ClientModule<BoardProps, BoardState> = (props, surface) => {
  const { Box, Text } = surface.elements
  let state = surface.state

  if (state === undefined) {
    state = {
      game: null,
      pending: { left: 0, right: 0 },
      seen: { ...props.presses, done: props.doneSeq },
      isRecord: false,
    }
    surface.setState(state)
    let latest = props
    surface.every(TICK_MS, () => tick(surface, () => latest.hi))
    surface.onKey(event => {
      const action = keyAction(event)
      const current = surface.state
      if (action !== null && current !== undefined) surface.setState(press(current, action))
    })
    track = next => {
      latest = next
    }
  }
  track(props)

  // Props carry what the hooks module saw: the pane's hotkeys and a finished turn.
  const { seen } = state
  if (
    props.doneSeq !== seen.done ||
    props.presses.left !== seen.left ||
    props.presses.right !== seen.right ||
    props.presses.start !== seen.start ||
    props.presses.pause !== seen.pause
  ) {
    let next: BoardState = { ...state, seen: { ...props.presses, done: props.doneSeq } }
    for (let i = seen.left; i < props.presses.left; i++) next = press(next, 'left')
    for (let i = seen.right; i < props.presses.right; i++) next = press(next, 'right')
    if (props.presses.start > seen.start) next = press(next, 'start')
    if (props.presses.pause > seen.pause) next = press(next, 'pause')
    if (props.doneSeq > seen.done && next.game !== null) next = { ...next, game: pause(next.game, DONE_BANNER) }
    surface.setState(next)
    state = next
  }

  const game = state.game
  if (game === null) return <Text dimColor>Loading the board...</Text>

  const grid = paint(game)
  if (game.status !== 'playing') stamp(grid, overlay(game, state.isRecord, props.hi))

  const score = `SCORE ${game.score}`
  const best = `HI ${Math.max(props.hi, game.status === 'over' ? game.score : 0)}`
  const claude = props.isWorking ? '* Claude working' : '- Claude idle'
  const gap = Math.max(1, game.width + 2 - score.length - best.length - claude.length - 2)

  return (
    <Box flexDirection="column" alignItems="center" width="100%">
      <Box>
        <Text bold>{score}</Text>
        <Text>{'  '}</Text>
        <Text color="yellow">{best}</Text>
        <Text>{' '.repeat(gap)}</Text>
        <Text color={props.isWorking ? 'green' : 'gray'}>{claude}</Text>
      </Box>
      <Text color="gray">{'+' + '-'.repeat(game.width) + '+'}</Text>
      {grid.map(row => (
        <Text>
          <Text color="gray">|</Text>
          {runs(row).map(run => (
            <Text color={run.color}>{run.text}</Text>
          ))}
          <Text color="gray">|</Text>
        </Text>
      ))}
      <Text color="gray">{'+' + '-'.repeat(game.width) + '+'}</Text>
    </Box>
  )
}

let track: (props: BoardProps) => void = () => {}

function runs(row: Cell[]): { text: string; color: Color }[] {
  const out: { text: string; color: Color }[] = []
  for (const cell of row) {
    const last = out[out.length - 1]
    if (last !== undefined && (last.color === cell.color || cell.char === ' ')) last.text += cell.char
    else out.push({ text: cell.char, color: cell.color })
  }

  return out
}

export default Board

// Claudle Jump: a pure, deterministic Doodle Jump engine.
// World units are terminal cells; y grows upward, x wraps at the edges.
// No UI here, so the engine runs the same in the surface module and in tests.

export type Kind = 'normal' | 'moving' | 'breaking' | 'spring'

export type Platform = {
  x: number
  y: number
  w: number
  kind: Kind
  dx: number
  isBroken: boolean
}

export type Status = 'ready' | 'playing' | 'paused' | 'over'

export type Game = {
  width: number
  height: number
  x: number
  y: number
  vx: number
  vy: number
  camera: number
  score: number
  platforms: Platform[]
  /** Highest y a platform was generated at. */
  top: number
  seed: number
  status: Status
  /** Text drawn over a paused board, e.g. when Claude finished its turn. */
  banner: string | null
  /** Ticks since the last bounce, drives the squash animation. */
  sinceBounce: number
}

/** Presses since the last tick; the terminal sends no key-up, so steering is impulses. */
export type Input = { left: number; right: number }

export const TICK_MS = 40
export const DOODLER_WIDTH = 3
export const PLATFORM_WIDTH = 5

const DT = TICK_MS / 1000
const GRAVITY = 70
const JUMP = 30
const SPRING_JUMP = 50
const IMPULSE = 14
const MAX_VX = 32
const FRICTION = 0.86
const CAMERA_LINE = 0.55

/** Rows a normal bounce reaches: v^2 / 2g. Every generated gap stays below it. */
export const JUMP_ROWS = (JUMP * JUMP) / (2 * GRAVITY)

/** mulberry32: small, seedable and JSON-safe (the state is one number). */
export function random(seed: number): [number, number] {
  const next = (seed + 0x6d2b79f5) | 0
  let t = next
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)

  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, next]
}

/** How hard the game is at a height, from 0 (start) to 1 (from 1500 rows up). */
export function difficulty(y: number): number {
  return Math.min(1, Math.max(0, y / 1500))
}

function wrap(x: number, width: number): number {
  return ((x % width) + width) % width
}

/** Fills platforms up to `until`, keeping every gap reachable with a normal bounce. */
function generate(game: Game, until: number): Game {
  let { seed, top } = game
  const platforms = [...game.platforms]
  const roll = (): number => {
    const [value, next] = random(seed)
    seed = next

    return value
  }

  while (top < until) {
    const hard = difficulty(top)
    const maxGap = Math.min(JUMP_ROWS - 1.5, 2.5 + hard * 4)
    const gap = 1.5 + roll() * (maxGap - 1.5)
    top += gap

    const pick = roll()
    const kind: Kind =
      pick < 0.06 ? 'spring' : pick < 0.06 + 0.1 + hard * 0.35 ? 'moving' : 'normal'
    const w = hard > 0.6 && roll() < 0.5 ? PLATFORM_WIDTH - 1 : PLATFORM_WIDTH
    const speed = 4 + hard * 10
    platforms.push({
      x: Math.floor(roll() * (game.width - w + 1)),
      y: Math.round(top),
      w,
      kind,
      dx: kind === 'moving' ? (roll() < 0.5 ? -speed : speed) : 0,
      isBroken: false,
    })

    // A breaking platform is a decoy between two reachable ones, never a step.
    if (roll() < 0.08 + hard * 0.3) {
      platforms.push({
        x: Math.floor(roll() * (game.width - PLATFORM_WIDTH + 1)),
        y: Math.round(top - gap / 2),
        w: PLATFORM_WIDTH,
        kind: 'breaking',
        dx: 0,
        isBroken: false,
      })
    }
  }

  return { ...game, platforms, top, seed }
}

export function create(width: number, height: number, seed = Date.now()): Game {
  const floor: Platform = {
    x: Math.floor((width - PLATFORM_WIDTH) / 2),
    y: 0,
    w: PLATFORM_WIDTH,
    kind: 'normal',
    dx: 0,
    isBroken: false,
  }
  const game: Game = {
    width,
    height,
    x: floor.x + 1,
    y: 1,
    vx: 0,
    vy: 0,
    camera: 0,
    score: 0,
    platforms: [floor],
    top: 0,
    seed: seed | 0,
    status: 'ready',
    banner: null,
    sinceBounce: 99,
  }

  return generate(game, height * 2)
}

function overlaps(x: number, p: Platform, width: number): boolean {
  for (let i = 0; i < DOODLER_WIDTH; i++) {
    const cell = wrap(Math.floor(x) + i, width)
    if (cell >= p.x && cell < p.x + p.w) return true
  }

  return false
}

/** One fixed tick. Only a playing game moves; the rest is returned unchanged. */
export function step(game: Game, input: Input): Game {
  if (game.status !== 'playing') return game

  let vx = game.vx + (input.right - input.left) * IMPULSE
  vx = Math.max(-MAX_VX, Math.min(MAX_VX, vx)) * FRICTION
  if (Math.abs(vx) < 0.3) vx = 0
  const x = wrap(game.x + vx * DT, game.width)

  let vy = game.vy - GRAVITY * DT
  let y = game.y + vy * DT
  let sinceBounce = game.sinceBounce + 1

  const platforms = game.platforms.map(p => {
    if (p.kind !== 'moving') return p
    let px = p.x + p.dx * DT
    let dx = p.dx
    if (px < 0 || px > game.width - p.w) {
      dx = -dx
      px = Math.max(0, Math.min(game.width - p.w, px))
    }

    return { ...p, x: px, dx }
  })

  // Land only while falling, when the feet cross the row just above a platform.
  if (vy < 0) {
    for (let i = 0; i < platforms.length; i++) {
      const p = platforms[i]!
      const stand = p.y + 1
      if (p.isBroken || game.y < stand || y > stand) continue
      if (!overlaps(x, { ...p, x: Math.round(p.x) }, game.width)) continue

      if (p.kind === 'breaking') {
        platforms[i] = { ...p, isBroken: true }
        continue
      }
      y = stand
      vy = p.kind === 'spring' ? SPRING_JUMP : JUMP
      sinceBounce = 0
      break
    }
  }

  let camera = game.camera
  if (y - camera > game.height * CAMERA_LINE) camera = y - game.height * CAMERA_LINE

  const next: Game = {
    ...game,
    x,
    y,
    vx,
    vy,
    camera,
    score: Math.max(game.score, Math.floor(camera)),
    sinceBounce,
    platforms: platforms.filter(p => p.y >= camera - 2 && !(p.isBroken && p.y < camera)),
  }

  if (y < camera - 2) return { ...next, status: 'over' }

  return generate(next, camera + game.height * 2)
}

/** Space: start a fresh board, resume a paused one, or restart after game over. */
export function toggleStart(game: Game, seed = Date.now()): Game {
  if (game.status === 'paused') return { ...game, status: 'playing', banner: null }
  if (game.status === 'playing') return game
  const fresh = create(game.width, game.height, seed)

  return { ...fresh, status: 'playing', vy: JUMP }
}

export function pause(game: Game, banner: string | null = null): Game {
  if (game.status === 'playing') return { ...game, status: 'paused', banner }

  return banner === null ? game : { ...game, banner }
}

export function togglePause(game: Game): Game {
  if (game.status === 'playing') return pause(game)
  if (game.status === 'paused') return { ...game, status: 'playing', banner: null }

  return game
}

import { describe, expect, test } from 'claude-code/testing'

import {
  JUMP_ROWS,
  create,
  pause,
  random,
  step,
  toggleStart,
  togglePause,
  type Game,
  type Platform,
} from '../hooks/game'

const IDLE = { left: 0, right: 0 }

function platform(kind: Platform['kind'], x = 0, y = 0): Platform {
  return { x, y, w: 5, kind, dx: 0, isBroken: false }
}

/** A playing board with exactly the platforms given, the doodler just above the first. */
function board(platforms: Platform[], over: Partial<Game> = {}): Game {
  return {
    ...create(30, 20, 7),
    platforms,
    top: 1e6,
    x: 1,
    y: 1.2,
    vy: -5,
    status: 'playing',
    ...over,
  }
}

describe('engine', () => {
  test('a new board starts ready, with a floor under the doodler', () => {
    const game = create(30, 20, 1)
    expect(game.status).toBe('ready')
    expect(game.platforms[0]).toMatchObject({ y: 0, kind: 'normal' })
    expect(game.top).toBeGreaterThanOrEqual(40)
  })

  test('the same seed builds the same board', () => {
    expect(create(30, 20, 42).platforms).toEqual(create(30, 20, 42).platforms)
    expect(random(1)).toEqual(random(1))
  })

  test('falling onto a platform bounces', () => {
    const next = step(board([platform('normal')]), IDLE)
    expect(next.y).toBe(1)
    expect(next.vy).toBeGreaterThan(20)
    expect(next.sinceBounce).toBe(0)
  })

  test('rising through a platform does not bounce', () => {
    const next = step(board([platform('normal')], { y: 0.8, vy: 10 }), IDLE)
    expect(next.vy).toBeLessThan(10)
    expect(next.sinceBounce).toBeGreaterThan(0)
  })

  test('a spring launches higher than a normal platform', () => {
    const normal = step(board([platform('normal')]), IDLE)
    const spring = step(board([platform('spring')]), IDLE)
    expect(spring.vy).toBeGreaterThan(normal.vy)
  })

  test('a breaking platform breaks and lets the doodler fall', () => {
    const next = step(board([platform('breaking')]), IDLE)
    expect(next.platforms[0]?.isBroken).toBe(true)
    expect(next.vy).toBeLessThan(0)
  })

  test('steering right past the edge wraps to the left', () => {
    let game = board([], { x: 29.5, vy: 20, y: 5 })
    game = step(game, { left: 0, right: 2 })
    expect(game.x).toBeLessThan(5)
  })

  test('a tap moves a few cells and friction stops it', () => {
    let game = board([], { x: 10, vy: 0, y: 5, camera: 0 })
    game = step(game, { left: 0, right: 1 })
    for (let i = 0; i < 40; i++) game = step({ ...game, vy: 0, y: 5 }, IDLE)
    expect(game.vx).toBe(0)
    expect(game.x - 10).toBeGreaterThan(2)
    expect(game.x - 10).toBeLessThan(8)
  })

  test('climbing scrolls the camera and raises the score', () => {
    const next = step(board([], { y: 30, vy: 20 }), IDLE)
    expect(next.camera).toBeGreaterThan(0)
    expect(next.score).toBe(Math.floor(next.camera))
  })

  test('falling below the screen ends the game', () => {
    const next = step(board([], { y: -2.5, vy: -10 }), IDLE)
    expect(next.status).toBe('over')
  })

  test('every gap between steps is reachable with a normal bounce', () => {
    let game: Game = { ...create(30, 20, 3), status: 'playing' }
    // Climb by teleporting the camera, so generation runs far up the difficulty ramp.
    for (let i = 0; i < 450; i++) game = step({ ...game, y: game.camera + 15, vy: 1 }, IDLE)
    const steps = game.platforms
      .filter(p => p.kind !== 'breaking')
      .map(p => p.y)
      .sort((a, b) => a - b)
    expect(game.camera).toBeGreaterThan(1500)
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i]! - steps[i - 1]!).toBeLessThan(JUMP_ROWS)
    }
  })

  test('space starts, pauses resume, game over restarts', () => {
    const ready = create(30, 20, 1)
    const playing = toggleStart(ready, 2)
    expect(playing.status).toBe('playing')
    const paused = togglePause(playing)
    expect(paused.status).toBe('paused')
    expect(toggleStart(paused).status).toBe('playing')
    const over: Game = { ...playing, status: 'over', score: 50 }
    expect(toggleStart(over, 3)).toMatchObject({ status: 'playing', score: 0 })
  })

  test('pause with a banner freezes a running game', () => {
    const playing = toggleStart(create(30, 20, 1), 2)
    const paused = pause(playing, 'done')
    expect(paused).toMatchObject({ status: 'paused', banner: 'done' })
    expect(step(paused, { left: 0, right: 3 })).toBe(paused)
  })
})

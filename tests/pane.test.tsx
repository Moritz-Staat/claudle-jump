import type { On } from 'claude-code'
import { describe, expect, test } from 'claude-code/testing'

import { parseScore } from '../hooks/register'

const PANE = {
  plugin: 'claudle-jump',
  component: 'Pane',
  requestId: 'claudle-jump',
  props: {
    title: 'Claudle Jump',
    isFocused: true,
    bodyColumns: 44,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 26 },
    view: {},
  },
  viewport: { columns: 120, rows: 40 },
} as const

/** The engine's side of the nouns the mod calls, answered from memory; `store` is $.store. */
function world(on: On, store: Record<string, unknown> = {}): { toasts: string[] } {
  const toasts: string[] = []
  on('store.get', ($, e) => ({ value: store[e.key] }))
  on('store.set', ($, e) => {
    store[e.key] = e.value

    return { value: undefined }
  })
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('ui.panes', () => ({
    value: [{ id: 'claudle-jump', title: 'Claudle Jump', isShown: true, isFocused: true, isPlaced: true }],
  }))
  on('ui.toast', ($, e) => {
    toasts.push(String(e.text))

    return { value: undefined }
  })
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('turn.complete', ($, e) => ({ text: e.answer }))

  return { toasts }
}

const TURN = { turnId: 't1', answer: 'ok', durationMs: 10, isAborted: false, reason: 'answer' } as const

describe('pane', () => {
  for (const surface of ['terminal', 'desktop'] as const) {
    test(`the board starts, steers and pauses by key on ${surface}`, async ($, on) => {
      world(on)
      const ui = await $.ui.mount({ ...PANE, surface })
      await ui.resize({ columns: 40, rows: 24, in: 'board' })
      await ui.advance(100)
      expect(await ui.find({ in: 'board', text: /CLAUDLE JUMP/ })).toBeDefined()

      await ui.key({ key: ' ', in: 'board' })
      await ui.advance(400)
      expect(await ui.find({ in: 'board', text: /CLAUDLE JUMP/ })).toBeUndefined()
      expect(await ui.find({ in: 'board', text: /SCORE/ })).toBeDefined()

      await ui.key({ key: 'right', in: 'board' })
      await ui.key({ key: 'p', in: 'board' })
      await ui.advance(100)
      expect(await ui.find({ in: 'board', text: /PAUSED/ })).toBeDefined()
      await ui.unmount()
    })

    test(`pane hotkey buttons drive the board on ${surface}`, async ($, on) => {
      world(on)
      const ui = await $.ui.mount({ ...PANE, surface })
      await ui.resize({ columns: 40, rows: 24, in: 'board' })
      await ui.advance(100)
      await ui.press({ key: 'start' })
      await ui.advance(200)
      expect(await ui.find({ in: 'board', text: /CLAUDLE JUMP/ })).toBeUndefined()
      await ui.press({ key: 'pause' })
      await ui.advance(100)
      expect(await ui.find({ in: 'board', text: /PAUSED/ })).toBeDefined()
      await ui.unmount()
    })

    test(`a finished turn pauses a running game with a banner on ${surface}`, async ($, on) => {
      const { toasts } = world(on)
      const ui = await $.ui.mount({ ...PANE, surface })
      await ui.resize({ columns: 40, rows: 24, in: 'board' })
      await ui.advance(100)
      await $.turn.start({ text: 'go', turnId: 't1' })
      await ui.redraw()
      expect(await ui.find({ in: 'board', text: /Claude working/ })).toBeDefined()

      await ui.key({ key: ' ', in: 'board' })
      await ui.advance(200)
      await $.turn.complete(TURN)
      await ui.redraw()
      await ui.advance(100)
      expect(await ui.find({ in: 'board', text: /back to work/ })).toBeDefined()
      expect(await ui.find({ in: 'board', text: /Claude idle/ })).toBeDefined()
      expect(toasts.some(t => t.includes('back to work'))).toBe(true)

      await ui.key({ key: ' ', in: 'board' })
      await ui.advance(100)
      expect(await ui.find({ in: 'board', text: /back to work/ })).toBeUndefined()
      await ui.unmount()
    })
  }

  test('a subagent finishing does not pause the game', async ($, on) => {
    const { toasts } = world(on)
    await $.turn.complete({ ...TURN, agentId: 'a1' })
    expect(toasts).toHaveLength(0)
  })
})

describe('highscore', () => {
  test('only a whole, sane score is accepted', () => {
    expect(parseScore({ kind: 'over', score: 120 })).toBe(120)
    expect(parseScore({ kind: 'over', score: 1.5 })).toBeNull()
    expect(parseScore({ kind: 'over', score: -1 })).toBeNull()
    expect(parseScore({ kind: 'other', score: 3 })).toBeNull()
    expect(parseScore('120')).toBeNull()
  })

  test('a posted record is kept in the store and shown as HI', async ($, on) => {
    const store: Record<string, unknown> = { highscore: 40 }
    world(on, store)
    await $.session.start({ cwd: '.', surface: 'terminal', isInteractive: true })
    const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
    await ui.resize({ columns: 40, rows: 24, in: 'board' })
    await ui.advance(100)
    expect(await ui.find({ in: 'board', text: /HI 40/ })).toBeDefined()

    await ui.post({ kind: 'over', score: 25 }, { in: 'board' })
    expect(store.highscore).toBe(40)
    await ui.post({ kind: 'over', score: 90 }, { in: 'board' })
    expect(store.highscore).toBe(90)
    await ui.redraw()
    await ui.advance(100)
    expect(await ui.find({ in: 'board', text: /HI 90/ })).toBeDefined()
    await ui.unmount()
  })
})

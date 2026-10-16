import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { BoardProps, Presses } from '../types'

const PANE = 'claudle-jump'
const TITLE = 'Claudle Jump'
const STORE_HI = 'highscore'

const hi = atom({ plugin: 'claudle-jump', key: 'hi' } as const, 0)
const isWorking = atom({ plugin: 'claudle-jump', key: 'isWorking' } as const, false)
const doneSeq = atom({ plugin: 'claudle-jump', key: 'doneSeq' } as const, 0)
const presses = atom({ plugin: 'claudle-jump', key: 'presses' } as const, {
  left: 0,
  right: 0,
  start: 0,
  pause: 0,
} as Presses)

/** A score the board posts is input from code: a whole, sane number or nothing. */
export function parseScore(data: unknown): number | null {
  if (typeof data !== 'object' || data === null) return null
  const { kind, score } = data as { kind?: unknown; score?: unknown }
  if (kind !== 'over' || typeof score !== 'number' || !Number.isInteger(score)) return null

  return score >= 0 && score < 1e9 ? score : null
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'jump',
      description: 'Play Claudle Jump (Doodle Jump) in a pane while Claude works; /jump close hides it',
    })
    const stored = await $.store.get(STORE_HI)
    if (typeof stored === 'number' && Number.isFinite(stored)) await update($, hi, () => stored)

    return next(e)
  })

  on('command.run', { command: 'jump' }, async ($, e) => {
    if (e.args.trim() === 'close') {
      await $.ui.close({ id: PANE })

      return { text: 'Claudle Jump closed.' }
    }
    await $.ui.open({ id: PANE, title: TITLE, focus: true, rows: 26, columns: 44 })

    return {
      text: 'Claudle Jump is open. Space starts, a/d steer, p pauses (click the board or ctrl+x tab to give it the keys).',
    }
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) await update($, isWorking, () => true)

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId !== undefined) return next(e)
    await update($, isWorking, () => false)
    const panes = await $.ui.panes()
    if (panes.some(pane => pane.id === PANE)) {
      await update($, doneSeq, n => n + 1)
      $.ui.toast('Claudle Jump: Claude is done - back to work!')
    }

    return next(e)
  })

  on('ui.message', async ($, e, next) => {
    const score = parseScore(e.data)
    if (score !== null && score > (await read($, hi))) {
      await update($, hi, () => score)
      await $.store.set(STORE_HI, score)
    }

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    if (e.surface !== 'terminal' && e.surface !== 'desktop') {
      const { Text } = $.ui.resolve(e)

      return <Text dimColor>Claudle Jump needs the terminal or the desktop app.</Text>
    }
    const { Box, Button, Client } = $.ui.resolve(e)
    const props: BoardProps = {
      hi: await read($, hi),
      isWorking: await read($, isWorking),
      doneSeq: await read($, doneSeq),
      presses: await read($, presses),
    }
    const tap = (key: keyof Presses) => () => update($, presses, p => ({ ...p, [key]: p[key] + 1 }))
    // A Client with no size is only as tall as its first drawing: size it to the pane body, less the hotkey row.
    const rows = Math.max(12, (e.props.scroll.bodyRows || e.viewport?.rows || 26) - 1)
    const columns = Math.max(20, e.props.bodyColumns || e.viewport?.columns || 44)

    return (
      <Box flexDirection="column">
        <Client key="board" module="./surface.tsx" props={props} width={columns} height={rows} />
        <Box justifyContent="center">
          <Button key="left" plain hotkey="a" label="left " onPress={tap('left')} />
          <Button key="right" plain hotkey="d" label="right " onPress={tap('right')} />
          <Button key="start" plain hotkey="s" label="start " onPress={tap('start')} />
          <Button key="pause" plain hotkey="p" label="pause" onPress={tap('pause')} />
        </Box>
      </Box>
    )
  })
}

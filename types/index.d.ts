/** How often each pane hotkey was pressed this session; the board applies the difference. */
export type Presses = { left: number; right: number; start: number; pause: number }

/** What the hooks module hands the board's surface module. */
export type BoardProps = {
  hi: number
  isWorking: boolean
  /** Counts finished main-loop turns; a rise pauses a running game with a banner. */
  doneSeq: number
  presses: Presses
}

declare module 'claude-code' {
  interface PluginState {
    'claudle-jump': {
      hi: number
      isWorking: boolean
      doneSeq: number
      presses: Presses
    }
  }
}

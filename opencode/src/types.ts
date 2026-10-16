/**
 * Contracts shared by the plugin's modules. Each pure module (render,
 * controls, agent, highscore, sidebar) is unit tested against these; tui.tsx
 * wires them to the OpenCode host.
 */
import type { Game, Input } from '../../hooks/game';

export type { Game, Input };

/** Colour names the renderer uses; tui.tsx maps them to terminal colours. */
export type Color = 'green' | 'cyan' | 'yellow' | 'magenta' | 'white' | 'gray' | 'red';

/** A stretch of one colour on a line. */
export type Run = { readonly text: string; readonly color: Color; readonly bold?: boolean };

/** One terminal row, left to right. */
export type Line = readonly Run[];

/** What a frame draws besides the game itself. */
export type FrameInput = {
  readonly game: Game;
  readonly hi: number;
  readonly isWorking: boolean;
  /** The finished game beat the best score. */
  readonly isRecord: boolean;
};

/** Keys the game understands, after mapping. */
export type Action = 'left' | 'right' | 'start' | 'pause' | 'leave';

/** A running session of play: the board plus input gathered since the last tick. */
export type Play = {
  readonly game: Game;
  readonly pending: Input;
  readonly isRecord: boolean;
};

/** What the plugin knows about the agent of the open session. */
export type AgentView = {
  readonly isWorking: boolean;
  /** Counts finished main-session runs; a rise pauses a running game. */
  readonly doneSeq: number;
};

/** The subset of an OpenCode bus event the plugin reads. */
export type AgentEvent = {
  readonly type: string;
  readonly data?: { readonly sessionID?: string };
};

/** Pure agent-state logic: turns OpenCode bus events into an AgentView. */
import type { AgentEvent, AgentView } from './types';

export const DONE_BANNER = 'Agent is done - back to work!';

export const INITIAL_AGENT: AgentView = { isWorking: false, doneSeq: 0 };

const STARTED = 'session.execution.started';
const STOPPED = new Set([
  'session.execution.succeeded',
  'session.execution.interrupted',
  'session.execution.failed',
]);

/** Returns the same object when the event changes nothing. */
export function reduceAgent(
  view: AgentView,
  event: AgentEvent,
  watched: (sessionID: string) => boolean,
): AgentView {
  const sessionID = event.data?.sessionID;
  if (sessionID === undefined || !watched(sessionID)) return view;
  if (event.type === STARTED) {
    return view.isWorking ? view : { ...view, isWorking: true };
  }
  if (STOPPED.has(event.type) && view.isWorking) {
    return { isWorking: false, doneSeq: view.doneSeq + 1 };
  }
  return view;
}

/** True for the open session itself, not for its subagent sessions. */
export function isMainSession(
  sessionID: string,
  openSessionID: string | undefined,
  parentOf: (id: string) => string | undefined,
): boolean {
  return sessionID === openSessionID && parentOf(sessionID) === undefined;
}

export function shouldPause(previous: AgentView, next: AgentView): boolean {
  return next.doneSeq > previous.doneSeq;
}

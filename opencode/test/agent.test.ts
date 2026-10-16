import { describe, expect, test } from 'bun:test';
import {
  DONE_BANNER,
  INITIAL_AGENT,
  isMainSession,
  reduceAgent,
  shouldPause,
} from '../src/agent';
import type { AgentEvent, AgentView } from '../src/types';

const MAIN = 'ses_main';
const watched = (id: string) => id === MAIN;
const event = (type: string, sessionID?: string): AgentEvent => ({
  type,
  data: sessionID === undefined ? undefined : { sessionID },
});
const WORKING: AgentView = { isWorking: true, doneSeq: 0 };

describe('reduceAgent', () => {
  test('start then succeed pauses (doneSeq rises)', () => {
    const working = reduceAgent(INITIAL_AGENT, event('session.execution.started', MAIN), watched);
    expect(working).toEqual({ isWorking: true, doneSeq: 0 });
    const done = reduceAgent(working, event('session.execution.succeeded', MAIN), watched);
    expect(done).toEqual({ isWorking: false, doneSeq: 1 });
    expect(shouldPause(working, done)).toBe(true);
  });

  test('interrupted and failed also count as done', () => {
    for (const type of ['session.execution.interrupted', 'session.execution.failed']) {
      const next = reduceAgent(WORKING, event(type, MAIN), watched);
      expect(next).toEqual({ isWorking: false, doneSeq: 1 });
      expect(shouldPause(WORKING, next)).toBe(true);
    }
  });

  test('events of unwatched sessions are ignored', () => {
    for (const type of ['session.execution.started', 'session.execution.succeeded']) {
      const view = type.endsWith('started') ? INITIAL_AGENT : WORKING;
      expect(reduceAgent(view, event(type, 'ses_child'), watched)).toBe(view);
    }
  });

  test('noise events return the same object', () => {
    for (const type of ['session.text.delta', 'session.usage.updated']) {
      expect(reduceAgent(WORKING, event(type, MAIN), watched)).toBe(WORKING);
    }
  });

  test('events without data or session id return the same object', () => {
    expect(reduceAgent(WORKING, event('session.execution.succeeded'), watched)).toBe(WORKING);
    expect(reduceAgent(WORKING, { type: 'session.execution.succeeded', data: {} }, watched)).toBe(
      WORKING,
    );
  });

  test('repeated stop without start does not double count', () => {
    const once = reduceAgent(WORKING, event('session.execution.succeeded', MAIN), watched);
    const twice = reduceAgent(once, event('session.execution.failed', MAIN), watched);
    expect(twice).toBe(once);
    expect(twice.doneSeq).toBe(1);
    expect(shouldPause(once, twice)).toBe(false);
  });

  test('a second run counts again', () => {
    let view = reduceAgent(INITIAL_AGENT, event('session.execution.started', MAIN), watched);
    view = reduceAgent(view, event('session.execution.succeeded', MAIN), watched);
    view = reduceAgent(view, event('session.execution.started', MAIN), watched);
    view = reduceAgent(view, event('session.execution.interrupted', MAIN), watched);
    expect(view).toEqual({ isWorking: false, doneSeq: 2 });
  });

  test('start while already working returns the same object', () => {
    expect(reduceAgent(WORKING, event('session.execution.started', MAIN), watched)).toBe(WORKING);
  });
});

describe('shouldPause', () => {
  test('false when doneSeq is unchanged', () => {
    expect(shouldPause(INITIAL_AGENT, WORKING)).toBe(false);
  });
});

describe('isMainSession', () => {
  const none = () => undefined;
  test('open session without parent is main', () => {
    expect(isMainSession(MAIN, MAIN, none)).toBe(true);
  });
  test('open session with a parent is not main', () => {
    expect(isMainSession(MAIN, MAIN, () => 'ses_root')).toBe(false);
  });
  test('other session is not main', () => {
    expect(isMainSession('ses_other', MAIN, none)).toBe(false);
  });
  test('no open session is never main', () => {
    expect(isMainSession(MAIN, undefined, none)).toBe(false);
  });
});

test('banner text', () => {
  expect(DONE_BANNER).toBe('Agent is done - back to work!');
});

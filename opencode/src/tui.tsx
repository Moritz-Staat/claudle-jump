/** @jsxImportSource @opentui/solid */
import { createEffect, createSignal, on, onCleanup } from 'solid-js';

import { TICK_MS, pause } from '../../hooks/game';
import { DONE_BANNER, INITIAL_AGENT, isMainSession, reduceAgent, shouldPause } from './agent';
import { KEY_BINDS, newPlay, press, tick } from './controls';
import { createHighscore } from './highscore';
import type { Context, PanelInput } from './host';
import { boardSize, frame, isTooSmall } from './render';
import { sidebarLine } from './sidebar';
import type { AgentView, Color } from './types';

const PANEL = 'claudle-jump';
const KEY_MODE = 'claudle-jump';
const HINT = 'a/d steer  space start  p pause  esc prompt';
/** Rows the host keeps around the panel (tab bar, status bar) plus our hint line. */
const CHROME_ROWS = 3;

const DARK: Record<Color, string> = {
  green: '#5fd75f',
  cyan: '#5fd7ff',
  yellow: '#ffd75f',
  magenta: '#ff87d7',
  white: '#e4e4e4',
  gray: '#808080',
  red: '#ff5f5f',
};

const LIGHT: Record<Color, string> = {
  green: '#008700',
  cyan: '#005f87',
  yellow: '#875f00',
  magenta: '#af0087',
  white: '#1c1c1c',
  gray: '#6c6c6c',
  red: '#d70000',
};

type Shared = {
  readonly ctx: Context;
  readonly highscore: ReturnType<typeof createHighscore>;
  readonly agent: () => AgentView;
};

/** Registers /jump; keymap layers must be created inside a rendered component. */
function Commands(props: { readonly ctx: Context }) {
  props.ctx.keymap.layer(() => ({
    mode: 'global',
    commands: [
      {
        id: 'claudle-jump.open',
        title: 'Play Claudle Jump',
        description: 'Doodle Jump in a side panel while the agent works',
        group: 'Claudle Jump',
        palette: true,
        slash: { name: 'jump' },
        run: () => {
          if (!props.ctx.ui.panel.open(PANEL)) {
            props.ctx.ui.toast.show({ message: 'Open a session first, then /jump.' });
          }
        },
      },
    ],
  }));

  return null;
}

function Board(props: { readonly shared: Shared; readonly input: PanelInput }) {
  const { ctx, highscore, agent } = props.shared;
  const palette = ctx.themeMode === 'light' ? LIGHT : DARK;
  const rows = () => ctx.renderer.height - CHROME_ROWS;
  const size = () => boardSize(props.input.width, rows());
  const [play, setPlay] = createSignal(newPlay(size().width, size().height));

  const timer = setInterval(() => {
    const result = tick(play(), size(), highscore.best());
    if (result.play !== play()) setPlay(result.play);
    if (result.finished !== undefined) void highscore.record(result.finished);
  }, TICK_MS);
  onCleanup(() => clearInterval(timer));

  // The game owns the keys while the panel is focused; Esc hands them back.
  createEffect(() => {
    if (!props.input.focused) return;
    const release = ctx.keymap.mode.push(KEY_MODE);
    onCleanup(release);
  });
  ctx.keymap.layer(() => ({
    mode: KEY_MODE,
    commands: KEY_BINDS.map(({ key, action }) => ({
      bind: key,
      title: action,
      group: 'Claudle Jump',
      run: () => {
        if (action === 'leave') ctx.keymap.dispatch('pane.focus.left');
        else setPlay((current) => press(current, action));
      },
    })),
  }));

  createEffect(
    on(agent, (next, previous) => {
      if (previous === undefined || !shouldPause(previous, next)) return;
      setPlay((current) => ({ ...current, game: pause(current.game, DONE_BANNER) }));
    }),
  );

  const isWorking = () =>
    agent().isWorking || ctx.data.session.status(props.input.sessionID) === 'running';

  return (
    <box flexDirection="column" width="100%" height="100%" alignItems="center">
      {isTooSmall(props.input.width, rows()) ? (
        <text fg={palette.gray}>Claudle Jump needs a wider panel.</text>
      ) : (
        <>
          {frame({
            game: play().game,
            hi: highscore.best(),
            isWorking: isWorking(),
            isRecord: play().isRecord,
          }).map((line) => (
            <text>
              {line.map((run) => (
                <span style={{ fg: palette[run.color] }}>{run.text}</span>
              ))}
            </text>
          ))}
          <text fg={palette.gray}>{HINT}</text>
        </>
      )}
    </box>
  );
}

export default {
  id: 'claudle-jump',
  setup(ctx: Context) {
    const highscore = createHighscore(ctx.storage);
    const [agent, setAgent] = createSignal<AgentView>(INITIAL_AGENT);
    const openSession = () => ctx.ui.panel.current()?.sessionID ?? ctx.ui.router.current().sessionID;
    const parentOf = (id: string) => ctx.data.session.get(id)?.parentID;

    const stop = ctx.data.listen(({ details }) => {
      const previous = agent();
      const next = reduceAgent(previous, details, (id) => isMainSession(id, openSession(), parentOf));
      if (next === previous) return;
      setAgent(next);
      if (shouldPause(previous, next) && ctx.ui.panel.current()?.name === PANEL) {
        ctx.ui.toast.show({ title: 'Claudle Jump', message: DONE_BANNER });
      }
    });

    const shared: Shared = { ctx, highscore, agent };
    ctx.ui.slot({ append: 'app', render: () => <Commands ctx={ctx} /> });
    ctx.ui.slot({
      append: 'session.panel',
      render: (input) => (input.name === PANEL ? <Board shared={shared} input={input} /> : null),
    });
    ctx.ui.slot({
      append: 'sidebar.content',
      render: () => <text fg="#808080">{sidebarLine(highscore.best())}</text>,
    });

    return stop;
  },
};

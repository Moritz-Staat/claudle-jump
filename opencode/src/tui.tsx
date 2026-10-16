/** @jsxImportSource @opentui/solid */
import type { Context, PanelInput } from './host';

const PANEL = 'claudle-jump';

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
          props.ctx.ui.panel.open(PANEL);
        },
      },
    ],
  }));

  return null;
}

function Board(props: { readonly input: PanelInput }) {
  return (
    <box flexDirection="column" width="100%" height="100%">
      <text>Claudle Jump ({props.input.width} columns)</text>
    </box>
  );
}

export default {
  id: 'claudle-jump',
  setup(ctx: Context) {
    ctx.ui.slot({ append: 'app', render: () => <Commands ctx={ctx} /> });
    ctx.ui.slot({
      append: 'session.panel',
      render: (input) => (input.name === PANEL ? <Board input={input} /> : null),
    });
  },
};

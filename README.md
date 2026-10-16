# Claudle Jump

Doodle Jump for the Claude Code terminal. Open a pane, bounce up the platforms while Claude works,
and get told to get back to work the moment Claude finishes its turn.

The game exists for both: as a Claude Code mod (this page) and as an [OpenCode plugin](#opencode).

```
SCORE 412  HI 1337          * Claude working
+--------------------------------+
|    =====                       |
|                                |
|      <===>                     |
|                  ~~~~~         |
|                   (o>          |
|               ====/ \          |
|                                |
|   ==^==                        |
|                         =====  |
+--------------------------------+
        a: left  d: right  s: start  p: pause
```

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install claudle-jump --marketplace Moritz-Staat/claudle-jump
```

Answer `y` to add the marketplace, then pick a scope (user scope is the default). The mod is active right away.

From a shell:

```
claude plugin install claudle-jump --marketplace Moritz-Staat/claudle-jump
```

In the desktop app: click **+** next to the prompt box, then **Plugins**, **Add marketplace** with
`Moritz-Staat/claudle-jump`, then **Add plugin**.

Needs Claude Code 2.1.287 or newer (mods with function hooks).

## Play

| Key | Action |
| --- | --- |
| `/jump` | open the game pane (`/jump close` hides it) |
| `space` or `s` | start, resume, play again |
| `a` / `d` or `←` / `→` | steer (each press is a push, tap or hold) |
| `p` | pause |
| `Esc` | hand the keyboard back to the prompt |

The board takes the keyboard when you click it. Without a mouse, `ctrl+x tab` focuses the pane and the
`a` / `d` / `s` / `p` hotkeys below the board drive it.

| Platform | |
| --- | --- |
| `=====` | normal |
| `<===>` | moves sideways |
| `~~~~~` | breaks when you land on it |
| `==^==` | spring, super jump |

It gets harder the higher you climb: wider gaps, more moving and breaking platforms. Your best score is
kept across sessions.

### While Claude works

The header shows whether Claude is working. When Claude finishes its turn, a running game pauses with
**Claude is done - back to work!** and a toast; `space` keeps playing. Subagents finishing do not
interrupt you.

## Limitations

- Terminals send no key-up events, so steering works by pushes that slow down by themselves instead of
  holding a direction. Holding a key works through key repeat.
- An unasked pane needs a wide terminal; `/jump` always opens it.

## Develop

```
claude plugin validate .
claude plugin test .
claude --plugin-dir .
```

`hooks/game.ts` is the pure engine, `hooks/surface.tsx` the board drawn on the terminal's frame clock,
`hooks/register.tsx` the command, pane, turn and highscore hooks.

## OpenCode

The same game as a TUI plugin for OpenCode.

**Requirements:** OpenCode 2.0.20 or newer (V2 TUI).

### Install

PowerShell:

```
irm https://raw.githubusercontent.com/Moritz-Staat/claudle-jump/main/opencode/install.ps1 | iex
```

sh (needs `node` and `tar`):

```
curl -fsSL https://raw.githubusercontent.com/Moritz-Staat/claudle-jump/main/opencode/install.sh | sh
```

Restart OpenCode, then type `/jump`. Set `CLAUDLE_JUMP_VERSION` to install another release, and
`OPENCODE_CONFIG_DIR` if your config is not in `~/.config/opencode`.

Manual install: download `claudle-jump-opencode.tar.gz` from the
[`opencode-v0.1.0` release](https://github.com/Moritz-Staat/claudle-jump/releases), extract it into the
OpenCode config dir (so `claudle-jump/tui.tsx` sits there) and add `"./claudle-jump"` to `plugins` in
`cli.json`.

### Play

| Key | Action |
| --- | --- |
| `a` / `d`, `h` / `l` or `←` / `→` | steer |
| `space`, `s` or `enter` | start, resume, play again |
| `p` | pause |
| `Esc` | back to the prompt |

Click the panel or type `/jump` to play again.

When the agent finishes its turn, a running game pauses with a banner and a toast. Finishing subagents
are ignored. Your highscore is kept across sessions and shown as a line in the sidebar.

### Update and uninstall

Update by running the installer again (it replaces the old copy and keeps `cli.json` entries unique).
Uninstall by deleting the `claudle-jump` folder in the config dir and removing `"./claudle-jump"` from
`plugins` in `cli.json`.

### Develop

```
cd opencode
bun install
bun test
bun run build     # writes dist/claudle-jump/
bun run package   # writes dist/claudle-jump-opencode.tar.gz
```

`scripts/drive.py` is a pseudo-terminal end-to-end driver; point it at a throwaway config with
`OPENCODE_CLI_CONFIG_CONTENT`.

## License

MIT

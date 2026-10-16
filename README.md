# Claudle Jump

Doodle Jump for the Claude Code terminal. Open a pane, bounce up the platforms while Claude works,
and get told to get back to work the moment Claude finishes its turn.

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

## License

MIT

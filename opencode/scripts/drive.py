"""Drive a TUI in a pseudo terminal and print text snapshots.

Usage: tuidrive.py --cwd DIR --cols 160 --rows 45 -- STEP...
Steps: wait:SECONDS  type:TEXT  key:NAME  shot:LABEL
Key names: enter esc tab space left right up down ctrl+p or any single char.
"""
import argparse
import os
import sys
import threading
import time

import pyte
from winpty import PtyProcess

KEYS = {
    'enter': '\r', 'esc': '\x1b', 'tab': '\t', 'space': ' ',
    'left': '\x1b[D', 'right': '\x1b[C', 'up': '\x1b[A', 'down': '\x1b[B',
    'ctrl+p': '\x10', 'ctrl+x': '\x18', 'ctrl+c': '\x03', 'bs': '\x7f',
}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--cwd', required=True)
    parser.add_argument('--cols', type=int, default=160)
    parser.add_argument('--rows', type=int, default=45)
    parser.add_argument('--cmd', default='opencode')
    parser.add_argument('steps', nargs='*')
    args = parser.parse_args()

    env = dict(os.environ)
    for name in ('HERDR_ENV', 'HERDR_SOCKET_PATH', 'HERDR_PANE_ID'):
        env.pop(name, None)
    env['TERM'] = 'xterm-256color'

    screen = pyte.Screen(args.cols, args.rows)
    stream = pyte.Stream(screen)
    proc = PtyProcess.spawn(args.cmd, cwd=args.cwd, env=env, dimensions=(args.rows, args.cols))
    lock = threading.Lock()

    def pump():
        while proc.isalive():
            try:
                data = proc.read(65536)
            except EOFError:
                break
            with lock:
                stream.feed(data)

    threading.Thread(target=pump, daemon=True).start()

    for step in args.steps:
        kind, _, value = step.partition(':')
        if kind == 'wait':
            time.sleep(float(value))
        elif kind == 'type':
            proc.write(value)
        elif kind == 'key':
            proc.write(KEYS.get(value, value))
        elif kind == 'shot':
            with lock:
                lines = [line.rstrip() for line in screen.display]
            while lines and not lines[-1]:
                lines.pop()
            print(f'===== {value} =====')
            print('\n'.join(lines))
            sys.stdout.flush()

    proc.write(KEYS['ctrl+c'])
    time.sleep(0.5)
    proc.terminate(force=True)


if __name__ == '__main__':
    main()

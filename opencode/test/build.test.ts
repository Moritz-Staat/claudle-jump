import { beforeAll, describe, expect, test } from 'bun:test';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { build, OUT_DIR } from '../scripts/build';

/** Relative import specifiers of a source file. */
function relativeImports(source: string): string[] {
  return [...source.matchAll(/from\s+['"](\.{1,2}\/[^'"]+)['"]/g)].map((match) => match[1]!);
}

describe('plugin folder build', () => {
  beforeAll(() => build());

  test('produces a folder OpenCode can load: tui.tsx plus the engine', () => {
    expect(existsSync(join(OUT_DIR, 'tui.tsx'))).toBe(true);
    expect(existsSync(join(OUT_DIR, 'game.ts'))).toBe(true);
  });

  test('ships no tests', () => {
    expect(readdirSync(OUT_DIR).some((file) => file.includes('.test.'))).toBe(false);
  });

  test('every relative import resolves inside the folder', () => {
    for (const file of readdirSync(OUT_DIR).filter((name) => /\.tsx?$/.test(name))) {
      const source = readFileSync(join(OUT_DIR, file), 'utf8');
      for (const specifier of relativeImports(source)) {
        const target = resolve(dirname(join(OUT_DIR, file)), specifier);
        expect(target.startsWith(resolve(OUT_DIR))).toBe(true);
        expect(['.ts', '.tsx'].some((ext) => existsSync(target + ext))).toBe(true);
      }
    }
  });

  test('the entry default-exports an id and a setup function', () => {
    const entry = readFileSync(join(OUT_DIR, 'tui.tsx'), 'utf8');
    expect(entry).toContain('@jsxImportSource @opentui/solid');
    expect(entry).toMatch(/id:\s*['"]claudle-jump['"]/);
    expect(entry).toMatch(/setup\s*\(/);
    expect(entry).toMatch(/export default/);
  });
});

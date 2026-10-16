/**
 * Builds the plugin folder OpenCode loads: the sources from src/ plus the
 * shared engine, flattened into dist/claudle-jump with imports rewritten.
 */
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dir, '..');
const SRC_DIR = join(ROOT, 'src');
const ENGINE = resolve(ROOT, '..', 'hooks', 'game.ts');

export const OUT_DIR = join(ROOT, 'dist', 'claudle-jump');

export function build(): void {
  rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });
  copyFileSync(ENGINE, join(OUT_DIR, 'game.ts'));

  for (const file of readdirSync(SRC_DIR)) {
    if (!/\.tsx?$/.test(file) || file.endsWith('.d.ts')) continue;
    const source = readFileSync(join(SRC_DIR, file), 'utf8');
    writeFileSync(join(OUT_DIR, file), source.replaceAll("'../../hooks/game'", "'./game'"));
  }
}

if (import.meta.main) {
  build();
  console.log(`Built ${OUT_DIR}`);
}

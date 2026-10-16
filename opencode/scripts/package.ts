/** Builds the plugin folder and packs it as the release asset. */
import { rmSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { build, OUT_DIR } from './build';

export const ASSET_NAME = 'claudle-jump-opencode.tar.gz';

/** Builds the plugin and returns the path of the tarball with top-level `claudle-jump/`. */
export function packageAsset(): string {
  build();
  const distDir = dirname(OUT_DIR);
  const asset = join(distDir, ASSET_NAME);
  rmSync(asset, { force: true });
  // Relative paths and cwd: GNU tar reads "C:\..." as a remote host.
  const result = Bun.spawnSync(['tar', '-czf', ASSET_NAME, 'claudle-jump'], {
    cwd: distDir,
    stdout: 'pipe',
    stderr: 'pipe',
  });
  if (result.exitCode !== 0) {
    throw new Error(`tar failed: ${result.stderr.toString()}`);
  }
  return asset;
}

if (import.meta.main) {
  console.log(`Packaged ${packageAsset()}`);
}

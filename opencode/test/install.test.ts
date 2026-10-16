import { beforeAll, describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { packageAsset } from '../scripts/package';

const ROOT = join(import.meta.dir, '..');
const TIMEOUT = 120_000;

function available(command: string, args: string[]): boolean {
  try {
    return Bun.spawnSync([command, ...args], { stdout: 'ignore', stderr: 'ignore' }).exitCode === 0;
  } catch {
    return false;
  }
}

const hasSh = available('sh', ['-c', 'command -v node >/dev/null && command -v tar >/dev/null']);
const hasPowershell = available('powershell', ['-NoProfile', '-Command', 'exit 0']);

interface Installer {
  name: string;
  enabled: boolean;
  command: (asset: string) => string[];
}

const installers: Installer[] = [
  { name: 'install.sh', enabled: hasSh, command: () => ['sh', join(ROOT, 'install.sh')] },
  {
    name: 'install.ps1',
    enabled: hasPowershell,
    command: () => [
      'powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(ROOT, 'install.ps1'),
    ],
  },
];

let asset = '';

function freshConfigDir(): string {
  return mkdtempSync(join(tmpdir(), 'cj-install-'));
}

function run(installer: Installer, configDir: string) {
  const result = Bun.spawnSync(installer.command(asset), {
    env: { ...process.env, OPENCODE_CONFIG_DIR: configDir, CLAUDLE_JUMP_ASSET: asset },
    stdout: 'pipe',
    stderr: 'pipe',
  });
  return { code: result.exitCode, out: result.stdout.toString() + result.stderr.toString() };
}

function readConfig(configDir: string): { raw: Buffer; json: Record<string, unknown> } {
  const raw = Buffer.from(readFileSync(join(configDir, 'cli.json')));
  return { raw, json: JSON.parse(raw.toString('utf8')) };
}

describe('package', () => {
  beforeAll(() => {
    asset = packageAsset();
  });

  test('creates a tarball', () => {
    expect(existsSync(asset)).toBe(true);
    expect(asset.endsWith('claudle-jump-opencode.tar.gz')).toBe(true);
  }, TIMEOUT);
});

for (const installer of installers) {
  describe(installer.name, () => {
    const t = installer.enabled ? test : test.skip;

    t('fresh install creates the plugin folder and cli.json', () => {
      const dir = freshConfigDir();
      const result = run(installer, dir);
      expect(result.code).toBe(0);
      expect(result.out).toContain('Restart OpenCode, then type /jump');
      expect(existsSync(join(dir, 'claudle-jump', 'tui.tsx'))).toBe(true);
      expect(existsSync(join(dir, 'claudle-jump', 'game.ts'))).toBe(true);
      const { raw, json } = readConfig(dir);
      expect(json.plugins).toEqual(['./claudle-jump']);
      expect(json.$schema).toBe('https://opencode.ai/v2/cli.json');
      expect(raw.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))).toBe(false);
    }, TIMEOUT);

    t('second run is idempotent and replaces an older copy', () => {
      const dir = freshConfigDir();
      run(installer, dir);
      writeFileSync(join(dir, 'claudle-jump', 'stale.txt'), 'old');
      const result = run(installer, dir);
      expect(result.code).toBe(0);
      expect(readConfig(dir).json.plugins).toEqual(['./claudle-jump']);
      expect(existsSync(join(dir, 'claudle-jump', 'stale.txt'))).toBe(false);
      expect(existsSync(join(dir, 'claudle-jump', 'tui.tsx'))).toBe(true);
    }, TIMEOUT);

    t('keeps existing keys and plugins', () => {
      const dir = freshConfigDir();
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        join(dir, 'cli.json'),
        JSON.stringify({ $schema: 'x', theme: 'dark', session: { a: { b: 1 } }, plugins: ['./herdr-opencode'] }),
      );
      expect(run(installer, dir).code).toBe(0);
      const { raw, json } = readConfig(dir);
      expect(json.plugins).toEqual(['./herdr-opencode', './claudle-jump']);
      expect(json.theme).toBe('dark');
      expect(json.session).toEqual({ a: { b: 1 } });
      expect(json.$schema).toBe('x');
      expect(raw.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))).toBe(false);
    }, TIMEOUT);

    t('adds plugins when cli.json has none', () => {
      const dir = freshConfigDir();
      writeFileSync(join(dir, 'cli.json'), '{"theme":"dark"}');
      expect(run(installer, dir).code).toBe(0);
      const { json } = readConfig(dir);
      expect(json.plugins).toEqual(['./claudle-jump']);
      expect(json.theme).toBe('dark');
    }, TIMEOUT);
  });
}

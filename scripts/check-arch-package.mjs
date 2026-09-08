import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { runCommandSync } from './run-command.mjs';

assert.equal(
  process.argv.length,
  3,
  'Usage: node scripts/check-arch-package.mjs <package.pkg.tar.zst>',
);
const packagePath = resolve(process.argv[2]);
const unpacked = mkdtempSync(join(tmpdir(), 'sage-arch-check-'));
try {
  runCommandSync('bsdtar', ['-xf', packagePath, '-C', unpacked], {
    stdio: 'inherit',
  });
  const binary = join(unpacked, 'usr/lib/sage-wallet/sage-tauri');
  assert.equal(readFileSync(binary).subarray(0, 4).toString(), '\x7fELF');
  assert.ok(statSync(binary).mode & 0o111, 'Wallet binary must be executable');
  const libraries = execFileSync('ldd', [binary], { encoding: 'utf8' });
  assert.ok(!libraries.includes('not found'), libraries);
  for (const file of [
    'usr/share/icons/hicolor/32x32/apps/sage-tauri.png',
    'usr/share/icons/hicolor/128x128/apps/sage-tauri.png',
    'usr/share/icons/hicolor/256x256/apps/sage-tauri.png',
    'usr/share/licenses/sage-wallet/LICENSE',
    'usr/lib/Sage/builtin-apps/system/app-install/sage-manifest.json',
    'usr/lib/Sage/builtin-apps/runtime/origin-cleanup/sage-manifest.json',
  ]) {
    assert.ok(statSync(join(unpacked, file)).isFile(), `Missing ${file}`);
  }
  runCommandSync(
    'desktop-file-validate',
    [join(unpacked, 'usr/share/applications/sage-wallet.desktop')],
    { stdio: 'inherit' },
  );

  const launcherPath = join(unpacked, 'usr/bin/sage-tauri');
  assert.ok(statSync(launcherPath).mode & 0o111, 'Launcher must be executable');
  const launcher = readFileSync(launcherPath, 'utf8');
  const command = 'exec /usr/lib/sage-wallet/sage-tauri "$@"';
  assert.ok(
    launcher.includes(command),
    'Launcher must forward arguments to the packaged binary',
  );
  // Substitute the final exec to observe the real launcher's environment without opening a wallet.
  const probe = launcher.replace(
    command,
    'printf "%s\\n" "${__NV_DISABLE_EXPLICIT_SYNC-unset}" "$@"',
  );
  const env = { ...process.env };
  delete env.WAYLAND_DISPLAY;
  delete env.__NV_DISABLE_EXPLICIT_SYNC;
  for (const [overrides, expected] of [
    [{}, 'unset'],
    [{ WAYLAND_DISPLAY: 'wayland-0' }, '1'],
    [{ WAYLAND_DISPLAY: 'wayland-0', __NV_DISABLE_EXPLICIT_SYNC: '0' }, '0'],
  ]) {
    assert.equal(
      execFileSync(
        'sh',
        ['-c', probe, 'sage-tauri', 'argument with spaces', '--flag'],
        {
          env: { ...env, ...overrides },
          encoding: 'utf8',
        },
      ),
      `${expected}\nargument with spaces\n--flag\n`,
    );
  }
  console.log(`Arch package checks passed: ${packagePath}`);
} finally {
  rmSync(unpacked, { recursive: true, force: true });
}

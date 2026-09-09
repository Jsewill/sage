import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { runCommandSync } from './run-command.mjs';

assert.equal(
  process.argv.length,
  3,
  'Usage: pnpm check:flatpak-package <flatpak-build-directory>',
);
const buildDir = resolve(process.argv[2]);
const files = join(buildDir, 'files');
const binary = join(files, 'bin/sage-tauri');
assert.equal(readFileSync(binary).subarray(0, 4).toString(), '\x7fELF');
assert.ok(statSync(binary).mode & 0o111, 'Wallet binary must be executable');
for (const file of [
  'share/icons/hicolor/32x32/apps/com.rigidnetwork.sage.png',
  'share/icons/hicolor/128x128/apps/com.rigidnetwork.sage.png',
  'share/icons/hicolor/256x256@2/apps/com.rigidnetwork.sage.png',
  'share/licenses/com.rigidnetwork.sage/LICENSE',
  'lib/Sage/builtin-apps/system/app-install/sage-manifest.json',
  'lib/Sage/builtin-apps/runtime/origin-cleanup/sage-manifest.json',
]) {
  assert.ok(statSync(join(files, file)).isFile(), `Missing ${file}`);
}

// Check the runtime users install; SDK-only libraries must not hide missing dependencies.
const runtime = ['build', '--runtime', '--readonly', buildDir];
const libraries = execFileSync(
  'flatpak',
  [...runtime, 'ldd', '-r', '/app/bin/sage-tauri'],
  { encoding: 'utf8' },
);
assert.doesNotMatch(libraries, /not found|undefined symbol/, libraries);
runCommandSync(
  'flatpak',
  [
    ...runtime,
    'desktop-file-validate',
    '/app/share/applications/com.rigidnetwork.sage.desktop',
  ],
  { stdio: 'inherit' },
);
console.log(`Flatpak package checks passed: ${buildDir}`);

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

test('Arch uses the working-tree version and orders release candidates before releases', () => {
  const checkout = mkdtempSync(join(tmpdir(), 'sage-arch-version-'));
  const archDir = join(checkout, 'src-tauri/arch');
  try {
    mkdirSync(archDir, { recursive: true });
    copyFileSync(
      resolve(import.meta.dirname, '../src-tauri/arch/PKGBUILD'),
      join(archDir, 'PKGBUILD'),
    );
    for (const [version, expected] of [
      ['0.13.0', '0.13.0'],
      ['0.14.0-rc.1', '0.14.0rc.1'],
      ['0.14.0', '0.14.0'],
    ]) {
      writeFileSync(
        join(checkout, 'src-tauri/tauri.conf.json'),
        JSON.stringify({ version }),
      );
      assert.equal(
        execFileSync(
          'bash',
          [
            '-c',
            'startdir=$1; source "$startdir/PKGBUILD"; pkgver',
            'test',
            archDir,
          ],
          { encoding: 'utf8' },
        ).trim(),
        expected,
      );
    }
    assert.equal(
      execFileSync('vercmp', ['0.14.0rc.1', '0.14.0'], {
        encoding: 'utf8',
      }).trim(),
      '-1',
    );
  } finally {
    rmSync(checkout, { recursive: true, force: true });
  }
});

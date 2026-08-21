#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const bin = path.resolve(__dirname, 'source/bin/index.ts');
const workdir = path.dirname(bin);
const base = path.basename(bin, '.ts');

if (process.platform === 'win32') {
  const cmdContent = `@IF EXIST "%~dp0\\node.exe" (
  "%~dp0\\node.exe" "${bin}" %*
) ELSE (
  @SETLOCAL
  @SET PATHEXT=%PATHEXT:;.JS;=;%
  node "${bin}" %*
)`;
  const ps1Content = `#!/usr/bin/env pwsh
$basedir=Split-Path $MyInvocation.MyCommand.Definition -Parent

if (Test-Path "$basedir/node.exe") {
  # Note: running setup.exe from the current directory may fail due to Windows Installer restrictions.
  # See https://github.com
  & "$basedir/node.exe" "$basedir/${path.relative(workdir, bin)}" $args
} else {
  & "node" "$basedir/${path.relative(workdir, bin)}" $args
}`;

  try {
    fs.writeFileSync(path.join(workdir, `${base}.cmd`), cmdContent, 'utf-8');
    fs.writeFileSync(path.join(workdir, `${base}.ps1`), ps1Content, 'utf-8');
  } catch (err) {
    console.error('Raiton Cli: Error create Windows files', err);
  }

} else {
  fs.chmod(bin, '755', (err) => {
    if (err) {
      console.error('Raiton Cli: Error chmod', err);
    }
  });
}

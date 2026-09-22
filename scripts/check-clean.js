#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const paths = ['skills', '.claude-plugin', '.codex-plugin', '.cursor-plugin', '.agents/plugins', 'plugin.json'];
const output = execFileSync('git', ['status', '--porcelain', '--', ...paths], { cwd: rootDir, encoding: 'utf8' }).trim();

if (output) {
  console.error('Generated content is not committed:');
  console.error(output);
  process.exit(1);
}

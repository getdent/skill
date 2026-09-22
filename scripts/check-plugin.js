#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { manifestPaths } from './lib/manifests.js';

const rootDir = resolve(process.env.DENT_CHECK_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..'));

try {
  const packageVersion = JSON.parse(readFileSync(join(rootDir, 'package.json'))).version;
  const mismatches = [];
  const check = (path, version) => {
    if (version !== packageVersion) mismatches.push(`${path}: expected ${packageVersion}, found ${version ?? 'missing'}`);
  };
  check('skills/dent/.dent-skill.json', JSON.parse(readFileSync(join(rootDir, 'skills', 'dent', '.dent-skill.json'))).version);
  for (const manifestPath of manifestPaths) {
    const manifest = JSON.parse(readFileSync(join(rootDir, manifestPath)));
    check(manifestPath, manifest.version);
    if (manifest.plugins) check(`${manifestPath} dent plugin`, manifest.plugins.find(item => item.name === 'dent')?.version);
    if (manifest.metadata) check(`${manifestPath} metadata`, manifest.metadata.version);
  }
  if (mismatches.length > 0) {
    for (const mismatch of mismatches) console.error(`Plugin version mismatch: ${mismatch}`);
    process.exit(1);
  }
  console.log(`Plugin version check passed: ${packageVersion}`);
} catch (error) {
  console.error('Plugin version check failed.');
  console.error(error.message);
  process.exit(1);
}

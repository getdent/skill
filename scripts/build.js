#!/usr/bin/env node

import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync, cpSync, chmodSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { manifestPaths } from './lib/manifests.js';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8'));
const providerConfig = JSON.parse(readFileSync(join(rootDir, 'providers.json'), 'utf8'));
const sourcePath = join(rootDir, 'skill', 'Source.md');
const pointerPath = join(rootDir, 'skill', 'Pointer.md');
const distDir = join(rootDir, 'dist');
const skillsDir = join(rootDir, 'skills', 'dent');
const providers = providerConfig.providers;

function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

function replacePlaceholders(text, provider) {
  return text
    .replaceAll('{{VERSION}}', packageJson.version)
    .replaceAll('{{PROVIDER}}', provider?.label || 'Claude web');
}

function customizeProviderFile(text, provider, relativePath) {
  const markdown = filterBlocks(replacePlaceholders(text, provider), provider.mode);
  if (provider.customize === 'none' || !provider.customize) return markdown;
  throw new Error(`Unknown provider customization for ${provider.name} at ${relativePath}: ${provider.customize}`);
}

function filterBlocks(text, mode) {
  const output = [];
  let excludedMode = null;
  let skipNextBlankLine = false;

  for (const line of text.split('\n')) {
    const marker = line.match(/^\s*<!-- dent:(cli|web):(start|end) -->\s*$/);
    if (marker) {
      const [, markerMode, markerPosition] = marker;
      if (markerPosition === 'start' && markerMode !== mode) excludedMode = markerMode;
      if (markerPosition === 'end' && markerMode === excludedMode) {
        excludedMode = null;
        skipNextBlankLine = true;
      }
      continue;
    }

    if (excludedMode) continue;
    if (skipNextBlankLine && line.trim() === '') continue;

    skipNextBlankLine = false;
    output.push(line.replace(/\s*<!-- dent:404 -->/g, ''));
  }

  return output.join('\n');
}

function copyDirectory(source, destination, provider = null) {
  if (!existsSync(source)) return;
  if (!provider) {
    cpSync(source, destination, { recursive: true });
    return;
  }
  ensureDir(destination);
  for (const entry of readdirSync(source)) {
    const sourceEntry = join(source, entry);
    const destinationEntry = join(destination, entry);
    const info = statSync(sourceEntry);
    if (info.isDirectory()) {
      copyDirectory(sourceEntry, destinationEntry, provider);
      continue;
    }
    const sourceText = readFileSync(sourceEntry, 'utf8');
    const markdown = customizeProviderFile(sourceText, provider, relative(source, sourceEntry).replaceAll('\\', '/'));
    writeFileSync(destinationEntry, markdown);
  }
}

function compileSkill(destination, provider) {
  ensureDir(destination);
  const source = readFileSync(sourcePath, 'utf8');
  const markdown = customizeProviderFile(source, provider, 'SKILL.md');
  writeFileSync(join(destination, 'SKILL.md'), markdown);
  copyDirectory(join(rootDir, 'skill', 'references'), join(destination, 'references'), provider);
  if (provider.mode === 'cli') copyDirectory(join(rootDir, 'skill', 'scripts'), join(destination, 'scripts'));
  for (const scriptName of ['context.js']) {
    const scriptPath = join(destination, 'scripts', scriptName);
    if (existsSync(scriptPath)) chmodSync(scriptPath, 0o755);
  }
}

function compilePointer(destination, provider) {
  ensureDir(destination);
  const source = readFileSync(sourcePath, 'utf8');
  const frontmatter = source.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n/)?.[0];
  if (!frontmatter) throw new Error('skill/Source.md has no frontmatter.');
  const pointer = readFileSync(pointerPath, 'utf8');
  writeFileSync(join(destination, 'SKILL.md'), replacePlaceholders(`${frontmatter}\n${pointer}`, provider));
}

function contentHash(root) {
  const hash = createHash('sha256');
  for (const file of walkFiles(root).sort()) {
    const relativePath = relative(root, file).replaceAll('\\', '/');
    if (relativePath === '.dent-skill.json') continue;
    hash.update(relativePath);
    hash.update('\0');
    hash.update(readFileSync(file));
    hash.update('\0');
  }
  return hash.digest('hex');
}

function writeManifest(destination, provider) {
  writeFileSync(join(destination, '.dent-skill.json'), `${JSON.stringify({
    package: packageJson.name,
    version: packageJson.version,
    provider: provider.name,
    contentHash: contentHash(destination),
  }, null, 2)}\n`);
}

function walkFiles(root) {
  const files = [];
  function walk(dir) {
    for (const entry of readdirSync(dir)) {
      const absolute = join(dir, entry);
      const info = statSync(absolute);
      if (info.isDirectory()) walk(absolute);
      else files.push(absolute);
    }
  }
  walk(root);
  return files;
}

const crcTable = new Uint32Array(256).map((_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

function crc32(buffer) {
  let value = 0xffffffff;
  for (const byte of buffer) value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function dosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { dosTime, dosDate };
}

function localHeader(nameBuffer, dataBuffer) {
  const { dosTime, dosDate } = dosDateTime();
  const header = Buffer.alloc(30);
  const checksum = crc32(dataBuffer);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0, 6);
  header.writeUInt16LE(0, 8);
  header.writeUInt16LE(dosTime, 10);
  header.writeUInt16LE(dosDate, 12);
  header.writeUInt32LE(checksum, 14);
  header.writeUInt32LE(dataBuffer.length, 18);
  header.writeUInt32LE(dataBuffer.length, 22);
  header.writeUInt16LE(nameBuffer.length, 26);
  header.writeUInt16LE(0, 28);
  return { header, checksum };
}

function centralHeader(nameBuffer, dataBuffer, checksum, offset) {
  const { dosTime, dosDate } = dosDateTime();
  const header = Buffer.alloc(46);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(20, 6);
  header.writeUInt16LE(0, 8);
  header.writeUInt16LE(0, 10);
  header.writeUInt16LE(dosTime, 12);
  header.writeUInt16LE(dosDate, 14);
  header.writeUInt32LE(checksum, 16);
  header.writeUInt32LE(dataBuffer.length, 20);
  header.writeUInt32LE(dataBuffer.length, 24);
  header.writeUInt16LE(nameBuffer.length, 28);
  header.writeUInt16LE(0, 30);
  header.writeUInt16LE(0, 32);
  header.writeUInt16LE(0, 34);
  header.writeUInt16LE(0, 36);
  header.writeUInt32LE(0, 38);
  header.writeUInt32LE(offset, 42);
  return header;
}

function endRecord(entryCount, centralSize, centralOffset) {
  const header = Buffer.alloc(22);
  header.writeUInt32LE(0x06054b50, 0);
  header.writeUInt16LE(0, 4);
  header.writeUInt16LE(0, 6);
  header.writeUInt16LE(entryCount, 8);
  header.writeUInt16LE(entryCount, 10);
  header.writeUInt32LE(centralSize, 12);
  header.writeUInt32LE(centralOffset, 16);
  header.writeUInt16LE(0, 20);
  return header;
}

function createZip(sourceRoot, destinationZip, archiveRoot = relative(dirname(sourceRoot), sourceRoot)) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const file of walkFiles(sourceRoot)) {
    const relativePath = join(archiveRoot, relative(sourceRoot, file)).replaceAll('\\', '/');
    const nameBuffer = Buffer.from(relativePath);
    const dataBuffer = readFileSync(file);
    const local = localHeader(nameBuffer, dataBuffer);
    localParts.push(local.header, nameBuffer, dataBuffer);
    centralParts.push(centralHeader(nameBuffer, dataBuffer, local.checksum, offset), nameBuffer);
    offset += local.header.length + nameBuffer.length + dataBuffer.length;
  }
  const centralOffset = offset;
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const zip = Buffer.concat([...localParts, ...centralParts, endRecord(centralParts.length / 2, centralSize, centralOffset)]);
  writeFileSync(destinationZip, zip);
}

function rewriteManifestVersions() {
  for (const manifestPath of manifestPaths) {
    const path = join(rootDir, manifestPath);
    const manifest = JSON.parse(readFileSync(path, 'utf8'));
    manifest.version = packageJson.version;
    if (manifest.metadata) manifest.metadata.version = packageJson.version;
    if (manifest.plugins) manifest.plugins.find(plugin => plugin.name === 'dent').version = packageJson.version;
    writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);
  }
}

rmSync(distDir, { recursive: true, force: true });
for (const provider of providers) {
  compileSkill(join(distDir, 'providers', provider.name, 'dent'), provider);
  writeManifest(join(distDir, 'providers', provider.name, 'dent'), provider);
  console.log(`Customized provider bundle through seam: ${provider.name}`);
}
rmSync(skillsDir, { recursive: true, force: true });
const pointerProvider = providers.find(provider => provider.mode === 'cli');
compilePointer(skillsDir, pointerProvider);
writeManifest(skillsDir, { name: 'pointer' });
rewriteManifestVersions();
const webProvider = providers.find(provider => provider.mode === 'web');
if (webProvider) {
  ensureDir(join(distDir, 'web'));
  createZip(join(distDir, 'providers', webProvider.name, 'dent'), join(distDir, 'web', 'dent.skill'));
}
const openaiDir = join(distDir, 'openai');
const openaiPluginDir = join(openaiDir, 'plugin');
ensureDir(openaiPluginDir);
cpSync(join(rootDir, 'plugin.json'), join(openaiPluginDir, 'plugin.json'));
ensureDir(join(openaiPluginDir, '.codex-plugin'));
cpSync(join(rootDir, '.codex-plugin', 'plugin.json'), join(openaiPluginDir, '.codex-plugin', 'plugin.json'));
cpSync(skillsDir, join(openaiPluginDir, 'skills', 'dent'), { recursive: true });
cpSync(join(rootDir, 'assets'), join(openaiPluginDir, 'assets'), { recursive: true });
cpSync(join(rootDir, 'LICENSE'), join(openaiPluginDir, 'LICENSE'));
createZip(openaiPluginDir, join(openaiDir, 'dent-plugin.zip'), '');

console.log(`Built Dent skill v${packageJson.version}`);
for (const provider of providers) {
  console.log(`  dist/providers/${provider.name}/dent`);
}
if (webProvider) console.log('  dist/web/dent.skill');
console.log('  dist/openai/dent-plugin.zip');
console.log(`  skills/dent (pointer v${packageJson.version})`);

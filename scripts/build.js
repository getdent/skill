#!/usr/bin/env node

import { Buffer } from 'node:buffer';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync, cpSync, chmodSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8'));
const sourcePath = join(rootDir, 'skill', 'SKILL.src.md');
const distDir = join(rootDir, 'dist');

const providers = [
  { name: 'claude-code', label: 'Claude Code', mode: 'cli' },
  { name: 'codex', label: 'Codex / Agents', mode: 'cli' },
];

function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

function replacePlaceholders(text, provider) {
  return text
    .replaceAll('{{VERSION}}', packageJson.version)
    .replaceAll('{{PROVIDER}}', provider?.label || 'Claude web');
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
    output.push(line);
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
    const markdown = filterBlocks(replacePlaceholders(sourceText, provider), provider.mode);
    writeFileSync(destinationEntry, markdown);
  }
}

function compileSkill(destination, provider) {
  ensureDir(destination);
  const source = readFileSync(sourcePath, 'utf8');
  const markdown = filterBlocks(replacePlaceholders(source, provider), provider.mode);
  writeFileSync(join(destination, 'SKILL.md'), markdown);
  copyDirectory(join(rootDir, 'skill', 'references'), join(destination, 'references'), provider);
  if (provider.mode === 'cli') copyDirectory(join(rootDir, 'skill', 'scripts'), join(destination, 'scripts'));
  for (const scriptName of ['context.js', 'staleness-check.js']) {
    const scriptPath = join(destination, 'scripts', scriptName);
    if (existsSync(scriptPath)) chmodSync(scriptPath, 0o755);
  }
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

function createZip(sourceRoot, destinationZip) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const file of walkFiles(sourceRoot)) {
    const relativePath = relative(dirname(sourceRoot), file).replaceAll('\\', '/');
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

rmSync(distDir, { recursive: true, force: true });
for (const provider of providers) {
  compileSkill(join(distDir, 'providers', provider.name, 'dent'), provider);
}
compileSkill(join(distDir, 'web', 'dent'), { label: 'Claude web', mode: 'web' });
createZip(join(distDir, 'web', 'dent'), join(distDir, 'web', 'dent.zip'));

console.log(`Built Dent skill v${packageJson.version}`);
console.log('  dist/providers/claude-code/dent');
console.log('  dist/providers/codex/dent');
console.log('  dist/web/dent.zip');

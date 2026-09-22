import { readdirSync } from 'node:fs';
import { join } from 'node:path';

export function walkMarkdownFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walkMarkdownFiles(path));
    else if (entry.name.endsWith('.md')) files.push(path);
  }
  return files;
}

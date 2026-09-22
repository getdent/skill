#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { apiRequestWithCredentials, loadCredentials } from '../cli/bin/dent.js';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const snapshotPath = process.env.DENT_SNAPSHOT_PATH || join(rootDir, 'scripts', 'schema-catalog.snapshot.json');

function projectCatalog(body) {
  const entities = body.entities || body;
  const catalog = {};
  for (const entity of Array.isArray(entities) ? entities : Object.values(entities)) {
    catalog[entity.entity] = { entity: entity.entity, route: entity.route, label: entity.label, actions: (entity.actions || []).map(({ name, target, mode }) => ({ name, target, mode })) };
  }
  return catalog;
}
function option(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}
function source(dentCommit, siteUrl, why) {
  return { kind: 'captured-schema-catalog-projection', schemaCapturedAt: new Date().toISOString(), schemaSource: 'GET /api/v1/schema/', siteUrl, dentCommit, why };
}
async function main() {
  const from = option('--from');
  const previous = JSON.parse(readFileSync(snapshotPath, 'utf8'));
  let body;
  let commit = null;
  let siteUrl;
  if (from) {
    body = JSON.parse(readFileSync(resolve(from), 'utf8'));
    commit = option('--commit') || null;
    siteUrl = option('--site-url');
  }
  else {
    const credentials = loadCredentials();
    const result = await apiRequestWithCredentials(credentials, '/api/v1/schema/');
    body = result.body || {};
    siteUrl = credentials.siteUrl;
    if (process.env.DENT_REPO) commit = execFileSync('git', ['-C', process.env.DENT_REPO, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  }
  const catalog = projectCatalog(body);
  writeFileSync(snapshotPath, `${JSON.stringify({ source: source(commit, siteUrl, previous.source.why), grammar: previous.grammar, routes: previous.routes, catalog }, null, 2)}\n`);
  console.log(`Snapshot written: ${Object.keys(catalog).length} entities.`);
}
main().catch(error => { console.error(error?.message || error); process.exit(1); });

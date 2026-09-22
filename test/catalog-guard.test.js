import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

const rootDir = resolve(import.meta.dirname, '..');

function run(script, env) {
  return spawnSync(process.execPath, [join(rootDir, 'scripts', script)], {
    cwd: rootDir,
    env: { ...process.env, ...env },
    encoding: 'utf8',
  });
}

async function fixture(t, text) {
  const directory = await mkdtemp(join(tmpdir(), 'dent-catalog-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(join(directory, 'starter.md'), text);
  return directory;
}

async function workflowFixture(t, text, catalog) {
  const directory = await fixture(t, text);
  const catalogPath = join(directory, 'catalog.json');
  await writeFile(catalogPath, JSON.stringify(catalog));
  return { directory, catalogPath };
}

function workflowEnv(directory, catalogPath) {
  return {
    DENT_WORKFLOW_SKILL_SOURCE: join(directory, 'starter.md'),
    DENT_WORKFLOW_SCHEMA_CATALOG: catalogPath,
  };
}

function catalog({ grammar = { singletons: [], nested: {} }, routes = [], entities }) {
  return { grammar, routes, catalog: entities };
}

test('design guard rejects unknown element keys', async t => {
  const directory = await fixture(t, '```json\n{"version":1,"elements":[{"key":"x","type":"section","classes":[]}]}\n```');
  const result = run('check-design-starters.js', { DENT_DESIGN_SKILL_DIR: directory });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /unknown key "classes"/);
});

test('design guard rejects a form without an id', async t => {
  const directory = await fixture(t, '```json\n{"version":1,"elements":[{"key":"form","type":"form"}]}\n```');
  const result = run('check-design-starters.js', { DENT_DESIGN_SKILL_DIR: directory });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /form has no id/);
});

test('design guard rejects unknown behavior inputs', async t => {
  const directory = await fixture(t, '```json\n{"version":1,"elements":[{"key":"form","type":"form","id":"x","behaviors":[{"behavior":"optin","config":{"firstName":"name"}}]}]}\n```');
  const result = run('check-design-starters.js', { DENT_DESIGN_SKILL_DIR: directory });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /behavior "optin" has no input "firstName"/);
});

test('design guard rejects non-list behaviors', async t => {
  const directory = await fixture(t, '```json\n{"version":1,"elements":[{"key":"form","type":"form","id":"x","behaviors":{}}]}\n```');
  const result = run('check-design-starters.js', { DENT_DESIGN_SKILL_DIR: directory });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /behaviors must be a list/);
});

test('design guard rejects an svg without its SVG tree tag', async t => {
  const directory = await fixture(t, '```json\n{"version":1,"elements":[{"key":"icon","type":"svg"}]}\n```');
  const result = run('check-design-starters.js', { DENT_DESIGN_SKILL_DIR: directory });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /svg needs config.tree.tag "svg"/);
});

test('design guard rejects a checkout without checkout-submit', async t => {
  const design = { version: 1, elements: [{ key: 'checkout', type: 'checkout', behaviors: [{ behavior: 'checkout', config: { gateway: 'x' } }], children: [{ key: 'payment', type: 'checkout-payment' }, { key: 'email', type: 'text-input', config: { kind: 'email', binding: 'billing.email' } }, { key: 'first', type: 'text-input', config: { kind: 'text', binding: 'billing.first_name' } }, { key: 'last', type: 'text-input', config: { kind: 'text', binding: 'billing.last_name' } }] }] };
  const directory = await fixture(t, `\`\`\`json\n${JSON.stringify(design)}\n\`\`\``);
  const result = run('check-design-starters.js', { DENT_DESIGN_SKILL_DIR: directory });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /checkout has no checkout-submit descendant/);
});

test('workflow guard resolves singleton settings actions', async t => {
  const catalog = { grammar: { singletons: ['settings'], nested: {} }, routes: [], catalog: { settings: { entity: 'settings', route: 'settings', actions: [{ name: 'get', target: 'member', mode: 'read' }, { name: 'update', target: 'member', mode: 'write' }] } } };
  const { directory, catalogPath } = await workflowFixture(t, 'GET /api/v1/settings/get\nPOST /api/v1/settings/update', catalog);
  const result = run('check-workflows.js', workflowEnv(directory, catalogPath));
  assert.equal(result.status, 0, result.stderr);
});

test('workflow guard resolves nested step actions', async t => {
  const catalog = { grammar: { singletons: [], nested: { step: 'funnel' } }, routes: [], catalog: { funnel: { entity: 'funnel', route: 'funnels', actions: [] }, step: { entity: 'step', route: 'steps', actions: [{ name: 'replace-design', target: 'member', mode: 'write' }] } } };
  const { directory, catalogPath } = await workflowFixture(t, 'POST /api/v1/funnels/{funnelId}/steps/{stepId}/replace-design', catalog);
  const result = run('check-workflows.js', workflowEnv(directory, catalogPath));
  assert.equal(result.status, 0, result.stderr);
});

test('workflow guard rejects singleton bare routes', async t => {
  const catalog = { grammar: { singletons: ['settings'], nested: {} }, routes: [], catalog: { settings: { entity: 'settings', route: 'settings', actions: [] } } };
  const { directory, catalogPath } = await workflowFixture(t, 'GET /api/v1/settings', catalog);
  const result = run('check-workflows.js', workflowEnv(directory, catalogPath));
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /singleton "settings" has no bare route/);
});

test('workflow guard rejects a child under the wrong parent', async t => {
  const catalog = { grammar: { singletons: [], nested: { step: 'funnel' } }, routes: [], catalog: { page: { entity: 'page', route: 'pages', actions: [] }, step: { entity: 'step', route: 'steps', actions: [] } } };
  const { directory, catalogPath } = await workflowFixture(t, 'GET /api/v1/pages/{pageId}/steps', catalog);
  const result = run('check-workflows.js', workflowEnv(directory, catalogPath));
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /answers only under "pages"/);
});

test('workflow guard rejects a singleton CLI command without an action', async t => {
  const catalog = { grammar: { singletons: ['settings'], nested: {} }, routes: [], catalog: { settings: { entity: 'settings', route: 'settings', actions: [{ name: 'get', target: 'member', mode: 'read' }] } } };
  const { directory, catalogPath } = await workflowFixture(t, 'dent api settings', catalog);
  const result = run('check-workflows.js', workflowEnv(directory, catalogPath));
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /singleton "settings" needs an action/);
});

test('workflow guard resolves member CLI actions', async t => {
  const fixtureCatalog = catalog({ entities: { page: { entity: 'page', route: 'pages', actions: [{ name: 'design', target: 'member', mode: 'read' }] } } });
  const { directory, catalogPath } = await workflowFixture(t, 'dent api pages 15 design', fixtureCatalog);
  const result = run('check-workflows.js', workflowEnv(directory, catalogPath));
  assert.equal(result.status, 0, result.stderr);
});

test('workflow guard rejects undeclared member CLI actions', async t => {
  const fixtureCatalog = catalog({ entities: { page: { entity: 'page', route: 'pages', actions: [] } } });
  const { directory, catalogPath } = await workflowFixture(t, 'dent api pages 15 design', fixtureCatalog);
  const result = run('check-workflows.js', workflowEnv(directory, catalogPath));
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Action page.design is not in the schema catalog/);
});

test('workflow guard accepts a marked 404 and rejects an unmarked route', async t => {
  const fixtureCatalog = catalog({ entities: { page: { entity: 'page', route: 'pages', actions: [] } } });
  const marked = await workflowFixture(t, 'GET /api/v1/missing <!-- dent:404 -->', fixtureCatalog);
  assert.equal(run('check-workflows.js', workflowEnv(marked.directory, marked.catalogPath)).status, 0);
  const unmarked = await workflowFixture(t, 'GET /api/v1/missing', fixtureCatalog);
  const result = run('check-workflows.js', workflowEnv(unmarked.directory, unmarked.catalogPath));
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /no schema entity route matches/);
});

test('workflow guard rejects CRUD action routes at members', async t => {
  const fixtureCatalog = catalog({ entities: { page: { entity: 'page', route: 'pages', actions: [{ name: 'update', target: 'member', mode: 'write' }] } } });
  const { directory, catalogPath } = await workflowFixture(t, 'POST /api/v1/pages/{id}/update', fixtureCatalog);
  const result = run('check-workflows.js', workflowEnv(directory, catalogPath));
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /only singletons serve update this way/);
});

test('workflow guard rejects platform routes not carried by the catalog', async t => {
  const fixtureCatalog = catalog({ entities: {} });
  const { directory, catalogPath } = await workflowFixture(t, 'GET /platform/api/v1/missing', fixtureCatalog);
  const result = run('check-workflows.js', workflowEnv(directory, catalogPath));
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /references platform route/);
});

test('workflow guard skips parameterized API route templates', async t => {
  const fixtureCatalog = catalog({ entities: {} });
  const { directory, catalogPath } = await workflowFixture(t, 'GET /api/v1/{entity}', fixtureCatalog);
  const result = run('check-workflows.js', workflowEnv(directory, catalogPath));
  assert.equal(result.status, 0, result.stderr);
});

test('workflow guard rejects a child without a declared parent', async t => {
  const fixtureCatalog = catalog({ entities: { funnel: { entity: 'funnel', route: 'funnels', actions: [] }, step: { entity: 'step', route: 'steps', actions: [] } } });
  const { directory, catalogPath } = await workflowFixture(t, 'GET /api/v1/funnels/{id}/steps', fixtureCatalog);
  const result = run('check-workflows.js', workflowEnv(directory, catalogPath));
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /"step" is not a nested entity/);
});

test('design guard ignores non-starter JSON blocks', async t => {
  const directory = await fixture(t, '```json\n{"version":2,"elements":[]}\n```\n```json\nnot json\n```');
  const result = run('check-design-starters.js', { DENT_DESIGN_SKILL_DIR: directory });
  assert.equal(result.status, 0, result.stderr);
});

test('snapshot projection from --from keeps workflow metadata and stamps flags', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'dent-snapshot-'));
  const snapshotPath = join(directory, 'snapshot.json');
  await writeFile(snapshotPath, await readFile(join(rootDir, 'scripts', 'schema-catalog.snapshot.json')));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const sourcePath = join(directory, 'catalog.json');
  await writeFile(sourcePath, JSON.stringify({ page: { entity: 'page', route: 'pages', label: 'Pages', actions: [] } }));
  const result = spawnSync(process.execPath, [join(rootDir, 'scripts', 'snapshot-catalog.js'), '--from', sourcePath, '--site-url', 'https://example.test', '--commit', 'test-commit'], { cwd: rootDir, env: { ...process.env, DENT_SNAPSHOT_PATH: snapshotPath }, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const snapshot = JSON.parse(await readFile(snapshotPath, 'utf8'));
  assert.equal(snapshot.source.siteUrl, 'https://example.test');
  assert.equal(snapshot.source.dentCommit, 'test-commit');
  assert.ok(snapshot.source.why);
  assert.ok(snapshot.routes.length > 0);
});

test('plugin version guard passes for the packaged plugin', () => {
  const result = run('check-plugin.js', {});
  assert.equal(result.status, 0, result.stderr);
});

test('plugin version guard fails on a drifted manifest', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'dent-plugin-check-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(join(directory, 'skills', 'dent'), { recursive: true });
  await mkdir(join(directory, '.claude-plugin'), { recursive: true });
  await mkdir(join(directory, '.codex-plugin'), { recursive: true });
  await mkdir(join(directory, '.cursor-plugin'), { recursive: true });
  await mkdir(join(directory, '.agents', 'plugins'), { recursive: true });
  await writeFile(join(directory, 'package.json'), JSON.stringify({ version: '0.2.0' }));
  await writeFile(join(directory, 'skills', 'dent', '.dent-skill.json'), JSON.stringify({ version: '0.2.0' }));
  await writeFile(join(directory, 'plugin.json'), JSON.stringify({ version: '0.2.0' }));
  await writeFile(join(directory, '.claude-plugin', 'plugin.json'), JSON.stringify({ version: '0.2.0' }));
  await writeFile(join(directory, '.claude-plugin', 'marketplace.json'), JSON.stringify({ version: '0.2.0', plugins: [{ name: 'dent', version: '0.2.0' }], metadata: { version: '0.2.0' } }));
  await writeFile(join(directory, '.codex-plugin', 'plugin.json'), JSON.stringify({ version: '0.1.9' }));
  await writeFile(join(directory, '.cursor-plugin', 'plugin.json'), JSON.stringify({ version: '0.2.0' }));
  await writeFile(join(directory, '.agents', 'plugins', 'marketplace.json'), JSON.stringify({ version: '0.2.0', plugins: [{ name: 'dent', version: '0.2.0' }] }));

  const result = run('check-plugin.js', { DENT_CHECK_ROOT: directory });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Plugin version mismatch: \.codex-plugin\/plugin\.json: expected 0\.2\.0, found 0\.1\.9/);
});

test('release archives pass unzip integrity checks', () => {
  for (const archive of ['dist/web/dent.skill', 'dist/openai/dent-plugin.zip']) {
    const result = spawnSync('unzip', ['-t', join(rootDir, archive)], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  }
  const web = spawnSync('unzip', ['-l', join(rootDir, 'dist/web/dent.skill')], { encoding: 'utf8' });
  const plugin = spawnSync('unzip', ['-l', join(rootDir, 'dist/openai/dent-plugin.zip')], { encoding: 'utf8' });
  assert.match(web.stdout, /dent\/SKILL\.md/);
  assert.match(plugin.stdout, /plugin\.json/);
  assert.match(plugin.stdout, /skills\/dent\/SKILL\.md/);
});

test('catalog guards pass against the repository', () => {
  for (const script of ['check-design-starters.js', 'check-workflows.js', 'check-plugin.js']) {
    const result = run(script, {});
    assert.equal(result.status, 0, result.stderr);
  }
});

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { access, cp, lstat, mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

const repoRoot = resolve(import.meta.dirname, '..');
const dentBin = join(repoRoot, 'cli', 'bin', 'dent.js');
const defaultCatalog = {
  entities: [
    {
      entity: 'contacts',
      route: 'contacts',
      actions: [
        { name: 'list', mode: 'read' },
        { name: 'get', mode: 'read' },
      ],
    },
  ],
};

function sendJson(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(body));
}

function sendText(response, status, body, headers) {
  response.writeHead(status, headers);
  response.end(body);
}

async function readJson(request) {
  let body = '';
  for await (const chunk of request) body += chunk;
  return body ? JSON.parse(body) : null;
}

async function startDentStub(options = {}) {
  const catalog = options.catalog || defaultCatalog;
  const validTokens = new Set(options.validTokens || ['test-token']);
  const oauthToken = options.oauthToken || 'oauth-token';
  validTokens.add(oauthToken);
  const requests = [];
  const schemaRequests = [];
  const apiRequests = [];
  const authorizations = [];
  const tokenExchanges = [];
  const deletedTokens = [];
  const fileResponses = options.fileResponses || {};
  let baseUrl;

  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url || '/', baseUrl);
      const body = request.method === 'POST' ? await readJson(request) : null;
      requests.push({ method: request.method, path: url.pathname, search: url.search, headers: request.headers, body });

      if (request.method === 'POST' && url.pathname === '/platform/api/v1/auth/cli-authorization') {
        authorizations.push(body);
        sendJson(response, 200, { authorizeUrl: `${baseUrl}/authorize?state=${encodeURIComponent(body.state)}` });
        return;
      }

      if (request.method === 'POST' && url.pathname === '/platform/api/v1/auth/cli-authorization/token') {
        tokenExchanges.push(body);
        sendJson(response, 200, { token: oauthToken, siteUrl: options.exchangeSiteUrl || baseUrl });
        return;
      }

      const token = String(request.headers.authorization || '').replace(/^Bearer\s+/i, '');
      if (!validTokens.has(token)) {
        sendJson(response, 401, { message: 'unauthorized' });
        return;
      }

      if (request.method === 'GET' && url.pathname === '/platform/api/v1/tokens') {
        if (options.tokenListStatus) {
          sendJson(response, options.tokenListStatus, { message: 'token list unavailable' });
          return;
        }
        sendJson(response, 200, { items: options.tokenItems || [{ id: 'dent-cli-token', name: 'Dent CLI', createdAt: '2026-09-21T00:00:00.000Z' }] });
        return;
      }

      if (request.method === 'DELETE' && url.pathname === '/platform/api/v1/tokens/dent-cli-token') {
        deletedTokens.push('dent-cli-token');
        sendJson(response, options.deleteStatus || 200, options.deleteStatus ? { message: 'failed' } : { ok: true });
        return;
      }

      if (request.method === 'GET' && url.pathname === '/api/v1/schema/') {
        schemaRequests.push({ token, search: url.search });
        if (options.schemaStatus) {
          sendJson(response, options.schemaStatus, { message: 'schema unavailable' });
          return;
        }
        sendJson(response, 200, catalog);
        return;
      }

      if (url.pathname.startsWith('/api/v1/')) {
        apiRequests.push({ method: request.method, path: url.pathname, search: url.search, headers: request.headers, token, body });
        if (Object.hasOwn(fileResponses, url.pathname)) {
          const fileResponse = fileResponses[url.pathname];
          sendText(response, 200, fileResponse.body, fileResponse.headers);
          return;
        }
        sendJson(response, 200, { ok: true, path: url.pathname, search: url.search, method: request.method, body });
        return;
      }

      sendJson(response, 404, { message: 'not found' });
    } catch (error) {
      sendJson(response, 500, { message: error.message });
    }
  });

  await new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      baseUrl = `http://127.0.0.1:${address.port}`;
      resolveListen();
    });
  });

  return {
    url: baseUrl,
    requests,
    schemaRequests,
    apiRequests,
    authorizations,
    tokenExchanges,
    deletedTokens,
    close: () => new Promise(resolveClose => server.close(resolveClose)),
  };
}

async function createConfigDir(t) {
  const directory = await mkdtemp(join(tmpdir(), 'dent-cli-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

async function readConfig(configDir) {
  return JSON.parse(await readFile(join(configDir, 'config.json'), 'utf8'));
}

async function assertNoConfig(configDir) {
  await assert.rejects(access(join(configDir, 'config.json')), { code: 'ENOENT' });
}

function spawnDent(args, options = {}) {
  const events = new EventEmitter();
  const child = spawn(process.execPath, [options.bin || dentBin, ...args], {
    cwd: options.cwd || repoRoot,
    env: {
      ...process.env,
      DENT_CONFIG_DIR: options.configDir,
      ...options.env,
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';

  child.stdout.on('data', chunk => {
    stdout += chunk;
    events.emit('stdout');
  });
  child.stderr.on('data', chunk => {
    stderr += chunk;
    events.emit('stderr');
  });

  const exit = new Promise(resolveExit => {
    child.on('close', code => resolveExit({ code, stdout, stderr }));
  });

  if (options.input !== undefined) {
    child.stdin.end(options.input);
  }

  return {
    child,
    events,
    exit,
    get stdout() {
      return stdout;
    },
    get stderr() {
      return stderr;
    },
  };
}

async function runDent(args, options = {}) {
  const run = spawnDent(args, options);
  return run.exit;
}

function waitForStdout(run, pattern) {
  return new Promise((resolveMatch, rejectMatch) => {
    const timeout = setTimeout(() => {
      cleanup();
      rejectMatch(new Error(`Timed out waiting for stdout pattern ${pattern}.\nstdout:\n${run.stdout}\nstderr:\n${run.stderr}`));
    }, 5000);

    function cleanup() {
      clearTimeout(timeout);
      run.events.off('stdout', check);
    }

    function check() {
      const match = run.stdout.match(pattern);
      if (!match) return;
      cleanup();
      resolveMatch(match);
    }

    run.events.on('stdout', check);
    check();
  });
}

function assertSuccess(result) {
  assert.equal(result.code, 0, `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
}

function codeChallenge(verifier) {
  return createHash('sha256').update(verifier).digest('base64url');
}

test('token login verifies schema access before saving credentials', async t => {
  const stub = await startDentStub({ validTokens: ['good-token'] });
  t.after(stub.close);
  const configDir = await createConfigDir(t);

  const failed = await runDent(['login', '--site-url', stub.url, '--stdin'], {
    configDir,
    input: 'bad-token\n',
  });

  assert.notEqual(failed.code, 0);
  assert.match(failed.stderr, /GET \/api\/v1\/schema\/ failed with HTTP 401/);
  await assertNoConfig(configDir);

  const passed = await runDent(['login', '--site-url', stub.url, '--stdin'], {
    configDir,
    input: 'good-token\n',
  });

  assertSuccess(passed);
  assert.match(passed.stdout, /Verified Dent API access/);
  const config = await readConfig(configDir);
  assert.equal(config.activeTarget, 'live');
  assert.equal(config.targets.live.siteUrl, stub.url);
  assert.equal(config.targets.live.apiKey, 'good-token');
});

test('copy-code login saves the exchanged credential when the schema read fails', async t => {
  const stub = await startDentStub({ schemaStatus: 404 });
  t.after(stub.close);
  const configDir = await createConfigDir(t);

  assertSuccess(await runDent(['login', '--site-url', stub.url, '--copy-code', '--start'], { configDir }));
  const completed = await runDent(['login', '--copy-code', '--stdin-code'], { configDir, input: 'copied-code\n' });

  assertSuccess(completed);
  assert.equal(stub.tokenExchanges.length, 1);
  assert.match(completed.stdout, /Saved the credential, but the Site did not answer the catalog read: GET \/api\/v1\/schema\/ failed with HTTP 404: .*Run dent whoami to retry\./);
  const credential = (await readConfig(configDir)).targets.live;
  assert.equal(credential.siteUrl, stub.url);
  assert.equal(credential.apiKey, 'oauth-token');
});

test('api command builds requests from the fetched schema catalog', async t => {
  const catalog = {
    entities: [
      {
        entity: 'ledger-records',
        label: 'Money Ledger',
        route: 'tenant-money',
        actions: [
          { name: 'list', mode: 'read' },
          { name: 'breakdown', target: 'collection', mode: 'read', parameters: { dimension: {}, period: {} } },
        ],
      },
    ],
  };
  const stub = await startDentStub({ catalog, validTokens: ['catalog-token'] });
  t.after(stub.close);
  const configDir = await createConfigDir(t);

  const login = await runDent(['login', '--site-url', stub.url, '--stdin'], {
    configDir,
    input: 'catalog-token\n',
  });
  assertSuccess(login);

  const result = await runDent(['api', 'money-ledger', 'breakdown', '--param', 'dimension=source', '--param', 'period=last_month'], {
    configDir,
  });

  assertSuccess(result);
  assert.equal(stub.apiRequests.length, 1);
  assert.equal(stub.apiRequests[0].method, 'GET');
  assert.equal(stub.apiRequests[0].path, '/api/v1/tenant-money/breakdown');
  assert.equal(stub.apiRequests[0].search, '?dimension=source&period=last_month');
  assert.equal(stub.apiRequests[0].headers.accept, 'application/json');
  assert.deepEqual(JSON.parse(result.stdout), {
    ok: true,
    path: '/api/v1/tenant-money/breakdown',
    search: '?dimension=source&period=last_month',
    method: 'GET',
    body: null,
  });
});

test('api command streams catalog file-return actions without parsing JSON', async t => {
  const catalog = {
    entities: [
      {
        entity: 'dent',
        route: 'dent',
        actions: [
          {
            name: 'export-breakdown',
            target: 'collection',
            mode: 'read',
            parameters: { dimension: {}, period: {} },
            returns: {
              type: 'filedownload',
              render: 'file',
              config: { download: true },
              data: true,
            },
          },
        ],
      },
    ],
  };
  const csv = 'period,start_date,end_date,dimension,value,visitors,revenue,share\nlast_30_days,2026-06-08,2026-07-08,source,newsletter,42,123.45,1\n';
  const stub = await startDentStub({
    catalog,
    validTokens: ['file-token'],
    fileResponses: {
      '/api/v1/dent/export-breakdown': {
        body: csv,
        headers: {
          'Content-Type': 'text/csv; charset=UTF-8',
          'Content-Disposition': 'attachment; filename=analytics-breakdown-source-last-30-days.csv',
        },
      },
    },
  });
  t.after(stub.close);
  const configDir = await createConfigDir(t);

  const login = await runDent(['login', '--site-url', stub.url, '--stdin'], {
    configDir,
    input: 'file-token\n',
  });
  assertSuccess(login);

  const result = await runDent(['api', 'dent', 'export-breakdown', '--param', 'dimension=source', '--param', 'period=last_month'], {
    configDir,
  });

  assertSuccess(result);
  assert.equal(result.stdout, csv);
  assert.equal(stub.apiRequests.length, 1);
  assert.equal(stub.apiRequests[0].method, 'GET');
  assert.equal(stub.apiRequests[0].path, '/api/v1/dent/export-breakdown');
  assert.equal(stub.apiRequests[0].search, '?dimension=source&period=last_month');
  assert.equal(stub.apiRequests[0].headers.accept, '*/*');
});

test('setup and reset switch targets while preserving live and local tokens', async t => {
  const live = await startDentStub({ validTokens: ['live-token'] });
  const local = await startDentStub({ validTokens: ['local-token'] });
  t.after(live.close);
  t.after(local.close);
  const configDir = await createConfigDir(t);

  assertSuccess(await runDent(['login', '--site-url', live.url, '--stdin'], {
    configDir,
    input: 'live-token\n',
  }));
  assertSuccess(await runDent(['setup', '--site-url', local.url, '--dent-repo', configDir], { configDir }));
  assertSuccess(await runDent(['login', '--stdin'], {
    configDir,
    input: 'local-token\n',
  }));
  assertSuccess(await runDent(['reset'], { configDir }));

  const config = await readConfig(configDir);
  assert.equal(config.activeTarget, 'live');
  assert.equal(config.targets.live.siteUrl, live.url);
  assert.equal(config.targets.live.apiKey, 'live-token');
  assert.equal(config.targets.local.siteUrl, local.url);
  assert.equal(config.targets.local.apiKey, 'local-token');

  const liveWhoami = await runDent(['whoami'], { configDir });
  assertSuccess(liveWhoami);
  assert.match(liveWhoami.stdout, new RegExp(`\\(live target\\) on ${live.url}\\.`));
  const localWhoami = await runDent(['whoami'], { configDir, env: { DENT_TARGET: 'local' } });
  assertSuccess(localWhoami);
  assert.match(localWhoami.stdout, new RegExp(`\\(local target\\) on ${local.url}\\.`));
  assert.equal(live.schemaRequests.at(-1).token, 'live-token');
  assert.equal(local.schemaRequests.at(-1).token, 'local-token');
});

test('install writes through a symlinked skill directory instead of replacing the link', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'dent-cli-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const harness = join(directory, '.claude');
  const linkTarget = join(directory, 'managed', 'dent');
  await mkdir(join(harness, 'skills'), { recursive: true });
  await mkdir(linkTarget, { recursive: true });
  await writeFile(join(linkTarget, 'SKILL.md'), 'old install');
  await writeFile(join(linkTarget, 'stale.md'), 'remove me');
  await symlink(linkTarget, join(harness, 'skills', 'dent'));
  const inode = (await stat(linkTarget)).ino;

  const result = await runDent(['install', '--target', harness, '--provider', 'claude-code', '--yes', '--force'], {
    configDir: join(directory, 'config'),
  });

  assertSuccess(result);
  const link = await lstat(join(harness, 'skills', 'dent'));
  assert.ok(link.isSymbolicLink(), 'skill directory symlink must survive install');
  const skill = await readFile(join(linkTarget, 'SKILL.md'), 'utf8');
  assert.match(skill, /name: dent/);
  assert.doesNotMatch(skill, /old install/);
  assert.equal((await stat(linkTarget)).ino, inode);
  await assert.rejects(access(join(linkTarget, 'stale.md')), { code: 'ENOENT' });
});

test('oauth loopback login sends PKCE authorization and exchanges the callback code', async t => {
  const stub = await startDentStub({ oauthToken: 'loopback-token' });
  t.after(stub.close);
  const configDir = await createConfigDir(t);
  const run = spawnDent(['login', '--site-url', stub.url, '--no-open'], { configDir });

  const [, redirectUri] = await waitForStdout(run, /Loopback callback: (http:\/\/127\.0\.0\.1:\d+\/oauth\/dent\/callback)/);
  const authorization = stub.authorizations[0];
  assert.equal(authorization.response_type, 'code');
  assert.equal(authorization.client_id, 'dent-cli');
  assert.equal(authorization.redirect_uri, redirectUri);
  assert.equal(authorization.code_challenge_method, 'S256');
  assert.match(authorization.state, /^[A-Za-z0-9_-]+$/);

  const callbackResponse = await fetch(`${redirectUri}?code=loopback-code&state=${encodeURIComponent(authorization.state)}`);
  assert.equal(callbackResponse.status, 200);

  const result = await run.exit;
  assertSuccess(result);
  const exchange = stub.tokenExchanges[0];
  assert.equal(exchange.grant_type, 'authorization_code');
  assert.equal(exchange.code, 'loopback-code');
  assert.equal(exchange.redirect_uri, redirectUri);
  assert.equal(codeChallenge(exchange.code_verifier), authorization.code_challenge);
  t.diagnostic(`loopback OAuth exercised: method=${authorization.code_challenge_method}; redirect_uri=${redirectUri}; code=${exchange.code}; verifier_matches_challenge=true`);
});

test('oauth copy-code login saves a pending exchange then completes it', async t => {
  const stub = await startDentStub({ oauthToken: 'copy-code-token' });
  t.after(stub.close);
  const configDir = await createConfigDir(t);

  const started = await runDent(['login', '--site-url', stub.url, '--copy-code', '--start'], { configDir });
  assertSuccess(started);
  const pending = (await readConfig(configDir)).pendingLogin;
  assert.equal(pending.redirectUri, `${stub.url}/platform/cli/code`);
  const result = await runDent(['login', '--copy-code', '--stdin-code'], { configDir, input: 'copied-code\n' });

  assertSuccess(result);
  const authorization = stub.authorizations[0];
  const exchange = stub.tokenExchanges[0];
  assert.equal(authorization.redirect_uri, `${stub.url}/platform/cli/code`);
  assert.equal(authorization.code_challenge_method, 'S256');
  assert.equal(exchange.code, 'copied-code');
  assert.equal(exchange.redirect_uri, `${stub.url}/platform/cli/code`);
  assert.equal(codeChallenge(exchange.code_verifier), authorization.code_challenge);
  t.diagnostic(`copy-code OAuth exercised: method=${authorization.code_challenge_method}; redirect_uri=${exchange.redirect_uri}; code=${exchange.code}; verifier_matches_challenge=true`);
});

test('expired copy-code login is refused', async t => {
  const configDir = await createConfigDir(t);
  await writeFile(join(configDir, 'config.json'), JSON.stringify({ activeTarget: 'live', targets: {}, pendingLogin: { startedAt: '2020-01-01T00:00:00.000Z' } }));
  const result = await runDent(['login', '--site-url', 'http://127.0.0.1:1', '--copy-code', '--code', 'spent'], { configDir });
  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /expired after 300 seconds/);
});

test('logout revokes the stored token and deletes local credentials after a failed revoke', async t => {
  const stub = await startDentStub({ deleteStatus: 500 });
  t.after(stub.close);
  const configDir = await createConfigDir(t);
  await writeFile(join(configDir, 'config.json'), JSON.stringify({ activeTarget: 'live', targets: { live: { siteUrl: stub.url, apiKey: 'test-token', tokenId: 'dent-cli-token' } } }));
  const result = await runDent(['logout'], { configDir });
  assertSuccess(result);
  assert.deepEqual(stub.deletedTokens, ['dent-cli-token']);
  assert.match(result.stdout, /Could not revoke Dent token dent-cli-token/);
  assert.equal(Object.hasOwn((await readConfig(configDir)).targets, 'live'), false);
});

test('api slash paths and singleton reads resolve through the catalog', async t => {
  const catalog = { entities: [
    { entity: 'pages', route: 'pages', actions: [{ name: 'list', mode: 'read' }, { name: 'get', mode: 'read' }] },
    { entity: 'settings', route: 'settings', actions: [{ name: 'get', target: 'collection', mode: 'read' }] },
  ] };
  const stub = await startDentStub({ catalog });
  t.after(stub.close);
  const configDir = await createConfigDir(t);
  await writeFile(join(configDir, 'config.json'), JSON.stringify({ activeTarget: 'live', targets: { live: { siteUrl: stub.url, apiKey: 'test-token' } } }));
  assertSuccess(await runDent(['api', 'pages/15'], { configDir }));
  assertSuccess(await runDent(['api', 'pages', '15'], { configDir }));
  assertSuccess(await runDent(['api', 'settings'], { configDir }));
  assert.deepEqual(stub.apiRequests.map(request => request.path), ['/api/v1/pages/15', '/api/v1/pages/15', '/api/v1/settings/get']);
});

test('status resolves account details from the catalog', async t => {
  const catalog = { entities: [{ entity: 'account', route: 'account', actions: [{ name: 'details', target: 'collection', mode: 'read' }] }] };
  const stub = await startDentStub({ catalog });
  t.after(stub.close);
  const configDir = await createConfigDir(t);
  await writeFile(join(configDir, 'config.json'), JSON.stringify({ activeTarget: 'live', targets: { live: { siteUrl: stub.url, apiKey: 'test-token' } } }));
  const result = await runDent(['status'], { configDir });
  assertSuccess(result);
  assert.equal(stub.apiRequests.at(-1).path, '/api/v1/account/details');
});

test('check compares the CLI and a plugin copy against the registry', async t => {
  const packageVersion = JSON.parse(await readFile(join(repoRoot, 'package.json'), 'utf8')).version;
  const [major, minor, patch] = packageVersion.split('.').map(Number);
  const newerVersion = `${major}.${minor}.${patch + 1}`;
  const registry = createServer((request, response) => sendJson(response, 200, { version: newerVersion }));
  await new Promise(resolveListen => registry.listen(0, '127.0.0.1', resolveListen));
  t.after(() => new Promise(resolveClose => registry.close(resolveClose)));
  const address = registry.address();
  const directory = await mkdtemp(join(tmpdir(), 'dent-cli-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(join(directory, 'skills', 'dent'), { recursive: true });
  await writeFile(join(directory, 'skills', 'dent', 'SKILL.md'), "---\nname: dent\nversion: '0.1.6'\n---\n");
  const result = await runDent(['check', '--quiet', '--plugin-root', directory], { configDir: join(directory, 'config'), env: { HOME: directory, DENT_REGISTRY_URL: `http://127.0.0.1:${address.port}/latest` } });
  assertSuccess(result);
  const escape = value => value.replaceAll('.', '\\.');
  assert.match(result.stdout, new RegExp(`Dent CLI v${escape(packageVersion)} is behind v${escape(newerVersion)}`));
  assert.match(result.stdout, new RegExp(`Dent skill \\(claude plugin at .*/skills/dent\\) v0\\.1\\.6 is behind v${escape(newerVersion)}\\. Run: /plugin update dent@getdent`));
});

test('skill prints the served skill body and its references, and refuses paths outside the bundle', async () => {
  const printed = await runDent(['skill']);
  assertSuccess(printed);
  assert.match(printed.stdout, /^Dent skill v\d+\.\d+\.\d+, served by the dent CLI\./);
  assert.doesNotMatch(printed.stdout, /^---\nname: dent/m);
  assert.match(printed.stdout, /\n# Dent\n/);
  assert.match(printed.stdout, /dent whoami/);

  const reference = await runDent(['skill', 'references/interview.md']);
  assertSuccess(reference);
  assert.equal(reference.stdout, await readFile(join(repoRoot, 'dist', 'providers', 'claude-code', 'dent', 'references', 'interview.md'), 'utf8'));

  const escaped = await runDent(['skill', '../../../package.json']);
  assert.equal(escaped.code, 1);
  assert.match(escaped.stderr, /Unknown skill reference: \.\.\/\.\.\/\.\.\/package\.json\. Available:\nreferences\/api\.md/);
});

test('the built skills/dent is a pointer that carries the source frontmatter and no references', async () => {
  const pointer = await readFile(join(repoRoot, 'skills', 'dent', 'SKILL.md'), 'utf8');
  const source = await readFile(join(repoRoot, 'skill', 'Source.md'), 'utf8');
  const description = text => text.match(/^description: (.*)$/m)[1];
  assert.equal(description(pointer), description(source));
  assert.match(pointer, /^```bash\ndent skill\n```$/m);
  assert.match(pointer, /npx @getdent\/skill@latest skill/);
  await assert.rejects(access(join(repoRoot, 'skills', 'dent', 'references')), { code: 'ENOENT' });
});

test('plugin-path prints the packaged plugin directory and stamps the daily registry read', async t => {
  const packageVersion = JSON.parse(await readFile(join(repoRoot, 'package.json'), 'utf8')).version;
  let registryHits = 0;
  const registry = createServer((request, response) => {
    registryHits += 1;
    sendJson(response, 200, { version: packageVersion });
  });
  await new Promise(resolveListen => registry.listen(0, '127.0.0.1', resolveListen));
  t.after(() => new Promise(resolveClose => registry.close(resolveClose)));
  const address = registry.address();
  const directory = await mkdtemp(join(tmpdir(), 'dent-cli-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const env = { DENT_REGISTRY_URL: `http://127.0.0.1:${address.port}/latest` };

  const first = await runDent(['plugin-path'], { configDir: join(directory, 'config'), env });
  assertSuccess(first);
  assert.equal(first.stdout, `${repoRoot}\n`);
  assert.equal(registryHits, 1);
  assert.equal((await readFile(join(directory, 'config', 'plugin-refresh'), 'utf8')).trim(), packageVersion);

  const second = await runDent(['plugin-path'], { configDir: join(directory, 'config'), env });
  assertSuccess(second);
  assert.equal(second.stdout, `${repoRoot}\n`);
  assert.equal(registryHits, 1);
});

test('plugin-path prints the path without the registry when the stamp is fresh or the registry is down', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'dent-cli-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const down = await runDent(['plugin-path'], { configDir: join(directory, 'config'), env: { DENT_REGISTRY_URL: 'http://127.0.0.1:1/latest' } });
  assertSuccess(down);
  assert.equal(down.stdout, `${repoRoot}\n`);
  await assert.rejects(access(join(directory, 'config', 'plugin-refresh')), { code: 'ENOENT' });
});

test('plugin-path re-runs npx online once a day when the registry is ahead', async t => {
  const registry = createServer((request, response) => sendJson(response, 200, { version: '99.0.0' }));
  await new Promise(resolveListen => registry.listen(0, '127.0.0.1', resolveListen));
  t.after(() => new Promise(resolveClose => registry.close(resolveClose)));
  const address = registry.address();
  const directory = await mkdtemp(join(tmpdir(), 'dent-cli-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const bin = join(directory, 'bin');
  const npxArgs = join(directory, 'npx-args');
  await mkdir(bin, { recursive: true });
  await writeFile(join(bin, 'npx'), `#!/bin/sh\nprintf '%s\\n' \"$@\" > ${npxArgs}\necho /fresh/plugin\n`, { mode: 0o755 });

  const result = await runDent(['plugin-path'], {
    configDir: join(directory, 'config'),
    env: { DENT_REGISTRY_URL: `http://127.0.0.1:${address.port}/latest`, PATH: `${bin}:${process.env.PATH}` },
  });

  assertSuccess(result);
  assert.equal(result.stdout, '/fresh/plugin\n');
  assert.deepEqual((await readFile(npxArgs, 'utf8')).trim().split('\n'), ['--yes', '--prefer-online', '@getdent/skill@latest', 'plugin-path', '--fresh']);

  const again = await runDent(['plugin-path'], {
    configDir: join(directory, 'config'),
    env: { DENT_REGISTRY_URL: `http://127.0.0.1:${address.port}/latest`, PATH: `${bin}:${process.env.PATH}` },
  });
  assertSuccess(again);
  assert.equal(again.stdout, `${repoRoot}\n`);
});

test('readInstalledVersion reads metadata.version and the legacy version', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'dent-cli-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const metadata = join(directory, '.claude', 'skills', 'dent');
  const legacy = join(directory, '.agents', 'skills', 'dent');
  await mkdir(metadata, { recursive: true });
  await mkdir(legacy, { recursive: true });
  await writeFile(join(metadata, 'SKILL.md'), '---\nname: dent\nmetadata:\n  version: "0.2.0"\n---\n');
  await writeFile(join(legacy, 'SKILL.md'), "---\nname: dent\nversion: '0.1.6'\n---\n");

  const result = await runDent(['check'], {
    cwd: directory,
    configDir: join(directory, 'config'),
    env: { HOME: directory, DENT_REGISTRY_URL: 'http://127.0.0.1:1/latest' },
  });

  assert.equal(result.code, 2);
  assert.match(result.stdout, /Registry unreachable; compared against the local package only\./);
  assert.match(result.stdout, /Found Claude Code(?:, Claude Code)?: .*\.claude\/skills\/dent \(installed v0\.2\.0\)/);
  assert.match(result.stdout, /Found Codex(?:, Codex)?: .*\.agents\/skills\/dent \(installed v0\.1\.6\)/);
});

test('check discovers a plugin install from installed_plugins.json', async t => {
  const registry = createServer((request, response) => sendJson(response, 200, { version: '0.1.8' }));
  await new Promise(resolveListen => registry.listen(0, '127.0.0.1', resolveListen));
  t.after(() => new Promise(resolveClose => registry.close(resolveClose)));
  const address = registry.address();
  const directory = await mkdtemp(join(tmpdir(), 'dent-cli-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const installPath = join(directory, 'plugin');
  await mkdir(join(installPath, 'skills', 'dent'), { recursive: true });
  await writeFile(join(installPath, 'skills', 'dent', 'SKILL.md'), "---\nname: dent\nversion: '0.1.6'\n---\n");
  await mkdir(join(directory, '.claude', 'plugins'), { recursive: true });
  await writeFile(join(directory, '.claude', 'plugins', 'installed_plugins.json'), JSON.stringify({
    version: 2,
    plugins: { 'dent@claude-plugins-official': [{ scope: 'user', installPath, version: '0.1.6' }] },
  }));

  const result = await runDent(['check'], {
    cwd: directory,
    configDir: join(directory, 'config'),
    env: { HOME: directory, DENT_REGISTRY_URL: `http://127.0.0.1:${address.port}/latest` },
  });

  assertSuccess(result);
  assert.match(result.stdout, new RegExp(`Found claude plugin: ${installPath}/skills/dent`));
  assert.match(result.stdout, /Run: \/plugin update dent@getdent/);
  assert.doesNotMatch(result.stdout, /Dent skill is not installed/);
});

test('update leaves a plugin-only install alone', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'dent-cli-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const installPath = join(directory, 'plugin');
  await mkdir(join(installPath, 'skills', 'dent'), { recursive: true });
  await writeFile(join(installPath, 'skills', 'dent', 'SKILL.md'), "---\nname: dent\nversion: '0.1.6'\n---\n");
  await mkdir(join(directory, '.claude', 'plugins'), { recursive: true });
  await writeFile(join(directory, '.claude', 'plugins', 'installed_plugins.json'), JSON.stringify({
    version: 2,
    plugins: { 'dent@getdent': [{ scope: 'user', installPath, version: '0.1.6' }] },
  }));

  const result = await runDent(['update', '--skip-upgrade'], {
    cwd: directory,
    configDir: join(directory, 'config'),
    env: { HOME: directory },
  });

  assertSuccess(result);
  await assert.rejects(access(join(directory, '.claude', 'skills', 'dent')), { code: 'ENOENT' });
  await assert.rejects(access(join(directory, 'skills', 'dent')), { code: 'ENOENT' });
  assert.match(result.stdout, /\/plugin update dent@getdent/);
  assert.doesNotMatch(result.stdout, /Installed for/);
});

test('update upgrades the CLI for a plugin-only install', async t => {
  const registry = createServer((request, response) => sendJson(response, 200, { version: '9.9.9' }));
  await new Promise(resolveListen => registry.listen(0, '127.0.0.1', resolveListen));
  t.after(() => new Promise(resolveClose => registry.close(resolveClose)));
  const address = registry.address();
  const directory = await mkdtemp(join(tmpdir(), 'dent-cli-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const installPath = join(directory, 'plugin');
  const bin = join(directory, 'bin');
  await mkdir(join(installPath, 'skills', 'dent'), { recursive: true });
  await writeFile(join(installPath, 'skills', 'dent', 'SKILL.md'), "version: '0.1.6'\n");
  await mkdir(join(directory, '.claude', 'plugins'), { recursive: true });
  await writeFile(join(directory, '.claude', 'plugins', 'installed_plugins.json'), JSON.stringify({
    version: 2,
    plugins: { 'dent@getdent': [{ scope: 'user', installPath, version: '0.1.6' }] },
  }));
  await mkdir(bin, { recursive: true });
  const npmArgs = join(directory, 'npm-args');
  const dentArgs = join(directory, 'dent-args');
  await writeFile(join(bin, 'npm'), `#!/bin/sh\nprintf '%s\\n' \"$@\" > ${npmArgs}\n`, { mode: 0o755 });
  await writeFile(join(bin, 'dent'), `#!/bin/sh\nprintf '%s\\n' \"$@\" > ${dentArgs}\n`, { mode: 0o755 });

  const result = await runDent(['update'], {
    cwd: directory,
    configDir: join(directory, 'config'),
    env: { HOME: directory, DENT_REGISTRY_URL: `http://127.0.0.1:${address.port}/latest`, PATH: `${bin}:${process.env.PATH}` },
  });

  assertSuccess(result);
  assert.deepEqual((await readFile(npmArgs, 'utf8')).trim().split('\n'), ['root', '-g']);
  await assert.rejects(access(dentArgs), { code: 'ENOENT' });
  await assert.rejects(access(join(directory, '.claude', 'skills', 'dent')), { code: 'ENOENT' });
  await assert.rejects(access(join(directory, 'skills', 'dent')), { code: 'ENOENT' });
});

test('check treats a plugin cache shared with copied installs as a plugin', async t => {
  const registry = createServer((request, response) => sendJson(response, 200, { version: '0.1.8' }));
  await new Promise(resolveListen => registry.listen(0, '127.0.0.1', resolveListen));
  t.after(() => new Promise(resolveClose => registry.close(resolveClose)));
  const address = registry.address();
  const directory = await mkdtemp(join(tmpdir(), 'dent-cli-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const shared = join(directory, 'dotfiles', 'dent');
  const plugin = join(directory, 'plugin');
  await mkdir(shared, { recursive: true });
  await writeFile(join(shared, 'SKILL.md'), "---\nname: dent\nversion: '0.1.6'\n---\n");
  await mkdir(join(directory, '.claude', 'skills'), { recursive: true });
  await mkdir(join(directory, '.agents', 'skills'), { recursive: true });
  await mkdir(join(plugin, 'skills'), { recursive: true });
  await symlink(shared, join(directory, '.claude', 'skills', 'dent'));
  await symlink(shared, join(directory, '.agents', 'skills', 'dent'));
  await symlink(shared, join(plugin, 'skills', 'dent'));

  const result = await runDent(['check', '--plugin-root', plugin], {
    cwd: directory,
    configDir: join(directory, 'config'),
    env: { HOME: directory, DENT_REGISTRY_URL: `http://127.0.0.1:${address.port}/latest` },
  });

  assertSuccess(result);
  assert.match(result.stdout, /Found claude plugin: .*\/plugin\/skills\/dent \(installed v0.1.6\)/);
  assert.equal((result.stdout.match(/Dent skill \(claude plugin at /g) || []).length, 1);
  assert.match(result.stdout, /Dent skill \(claude plugin at .*\/dotfiles\/dent\) v0.1.6 is behind v0.1.8. Run: \/plugin update dent@getdent/);
  assert.doesNotMatch(result.stdout, /Run: dent update/);
});

test('update refreshes copied installs before printing plugin guidance', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'dent-cli-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const copied = join(directory, '.claude', 'skills', 'dent');
  const plugin = join(directory, 'plugin');
  await mkdir(copied, { recursive: true });
  await mkdir(join(plugin, 'skills', 'dent'), { recursive: true });
  await writeFile(join(copied, 'SKILL.md'), "---\nname: dent\nversion: '0.1.6'\n---\n");
  await writeFile(join(plugin, 'skills', 'dent', 'SKILL.md'), "version: '0.1.6'\n");

  const result = await runDent(['update', '--skip-upgrade', '--plugin-root', plugin], {
    configDir: join(directory, 'config'),
    env: { HOME: directory },
  });

  assertSuccess(result);
  assert.match(await readFile(join(copied, 'SKILL.md'), 'utf8'), /name: dent/);
  assert.match(result.stdout, /Installed for Claude Code/);
  assert.match(result.stdout, /\/plugin update dent@getdent/);
  assert.ok(result.stdout.indexOf('Installed for Claude Code') < result.stdout.indexOf('/plugin update dent@getdent'));
});

test('npx update refreshes copied installs after finding a newer registry version', async t => {
  const registry = createServer((request, response) => sendJson(response, 200, { version: '9.9.9' }));
  await new Promise(resolveListen => registry.listen(0, '127.0.0.1', resolveListen));
  t.after(() => new Promise(resolveClose => registry.close(resolveClose)));
  const address = registry.address();
  const directory = await mkdtemp(join(tmpdir(), 'dent-cli-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const npxRoot = join(directory, '_npx', 'dent');
  const copied = join(directory, 'project', '.claude', 'skills', 'dent');
  const bin = join(directory, 'bin');
  const npxArgs = join(directory, 'npx-args');
  await cp(repoRoot, npxRoot, { recursive: true });
  await mkdir(copied, { recursive: true });
  await mkdir(bin, { recursive: true });
  await writeFile(join(copied, 'SKILL.md'), "version: '0.1.6'\n");
  await writeFile(join(bin, 'npx'), `#!/bin/sh\nprintf '%s\\n' \"$@\" > ${npxArgs}\nshift 3\nexec ${process.execPath} ${join(npxRoot, 'cli', 'bin', 'dent.js')} \"$@\"\n`, { mode: 0o755 });

  const result = await runDent(['update', '--dir', join(directory, 'project')], {
    bin: join(npxRoot, 'cli', 'bin', 'dent.js'),
    cwd: npxRoot,
    configDir: join(directory, 'config'),
    env: { HOME: directory, DENT_REGISTRY_URL: `http://127.0.0.1:${address.port}/latest`, PATH: `${bin}:${process.env.PATH}` },
  });

  assertSuccess(result);
  assert.deepEqual((await readFile(npxArgs, 'utf8')).trim().split('\n').slice(0, 5), ['--yes', '--prefer-online', '@getdent/skill@latest', 'update', '--skip-upgrade']);
  assert.doesNotMatch(result.stdout, /npx @getdent\/skill@latest install/);
  assert.match(await readFile(join(copied, 'SKILL.md'), 'utf8'), /name: dent/);
});

test('oauth login saves a credential when Dent does not return its token id', async t => {
  const stub = await startDentStub({ oauthToken: 'unlisted-token', tokenItems: [] });
  t.after(stub.close);
  const configDir = await createConfigDir(t);
  const result = await runDent(['login', '--site-url', stub.url, '--copy-code', '--start'], { configDir });
  assertSuccess(result);
  const completed = await runDent(['login', '--copy-code', '--stdin-code'], { configDir, input: 'copied-code\n' });

  assertSuccess(completed);
  assert.match(completed.stdout, /Token id unavailable; dent logout will not revoke this token on Dent\. Revoke it in Dent if needed\./);
  const credential = (await readConfig(configDir)).targets.live;
  assert.equal(credential.apiKey, 'unlisted-token');
  assert.equal(Object.hasOwn(credential, 'tokenId'), false);
});

test('oauth login saves a credential when the platform token list is unavailable', async t => {
  const tenant = await startDentStub({ oauthToken: 'tenant-token' });
  const platform = await startDentStub({ exchangeSiteUrl: tenant.url, oauthToken: 'tenant-token', tokenListStatus: 404 });
  t.after(tenant.close);
  t.after(platform.close);
  const configDir = await createConfigDir(t);

  assertSuccess(await runDent(['login', '--site-url', platform.url, '--copy-code', '--start'], { configDir }));
  const completed = await runDent(['login', '--copy-code', '--stdin-code'], { configDir, input: 'copied-code\n' });

  assertSuccess(completed);
  assert.match(completed.stdout, /Token id unavailable; dent logout will not revoke this token on Dent\. Revoke it in Dent if needed: GET \/platform\/api\/v1\/tokens failed with HTTP 404/);
  const credential = (await readConfig(configDir)).targets.live;
  assert.equal(credential.siteUrl, tenant.url);
  assert.equal(credential.platformUrl, platform.url);
  assert.equal(Object.hasOwn(credential, 'tokenId'), false);
});

test('oauth login saves a credential when the platform token list omits Dent CLI ids', async t => {
  const tenant = await startDentStub({ oauthToken: 'tenant-token' });
  const platform = await startDentStub({ exchangeSiteUrl: tenant.url, oauthToken: 'tenant-token', tokenItems: [{ _permission: {} }] });
  t.after(tenant.close);
  t.after(platform.close);
  const configDir = await createConfigDir(t);

  assertSuccess(await runDent(['login', '--site-url', platform.url, '--copy-code', '--start'], { configDir }));
  const completed = await runDent(['login', '--copy-code', '--stdin-code'], { configDir, input: 'copied-code\n' });

  assertSuccess(completed);
  assert.match(completed.stdout, /Token id unavailable; dent logout will not revoke this token on Dent\. Revoke it in Dent if needed\./);
  const credential = (await readConfig(configDir)).targets.live;
  assert.equal(credential.siteUrl, tenant.url);
  assert.equal(credential.platformUrl, platform.url);
  assert.equal(Object.hasOwn(credential, 'tokenId'), false);
});

test('oauth login stores its token id and logout revokes it at the platform origin', async t => {
  const tenant = await startDentStub({ oauthToken: 'tenant-token', tokenListStatus: 404 });
  const platform = await startDentStub({ exchangeSiteUrl: tenant.url, oauthToken: 'tenant-token' });
  t.after(tenant.close);
  t.after(platform.close);
  const configDir = await createConfigDir(t);

  assertSuccess(await runDent(['login', '--site-url', platform.url, '--copy-code', '--start'], { configDir }));
  assertSuccess(await runDent(['login', '--copy-code', '--stdin-code'], { configDir, input: 'copied-code\n' }));
  const credential = (await readConfig(configDir)).targets.live;
  assert.equal(credential.tokenId, 'dent-cli-token');
  assert.equal(credential.platformUrl, platform.url);

  assertSuccess(await runDent(['logout'], { configDir }));
  assert.deepEqual(platform.deletedTokens, ['dent-cli-token']);
  assert.deepEqual(tenant.deletedTokens, []);
});

test('a symlinked CLI runs and importing the CLI stays silent', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'dent-cli-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const bin = join(directory, 'dent');
  await symlink(dentBin, bin);

  const version = await new Promise(resolveExit => {
    const child = spawn(process.execPath, [bin, '--version'], { cwd: repoRoot, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => {
      stdout += chunk;
    });
    child.stderr.on('data', chunk => {
      stderr += chunk;
    });
    child.on('close', code => resolveExit({ code, stdout, stderr }));
  });
  assertSuccess(version);
  assert.equal(version.stdout.trim(), JSON.parse(await readFile(join(repoRoot, 'package.json'), 'utf8')).version);

  const imported = await new Promise(resolveExit => {
    const child = spawn(process.execPath, ['--input-type=module', '--eval', `await import(${JSON.stringify(dentBin)})`], {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    child.stdout.on('data', chunk => {
      stdout += chunk;
    });
    child.on('close', code => resolveExit({ code, stdout }));
  });

  assert.equal(imported.code, 0);
  assert.equal(imported.stdout, '');
});

test('check discovers a Codex plugin install without copying it on update', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'dent-cli-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const skill = join(directory, '.codex', 'plugins', 'cache', 'getdent', 'dent', '0.1.6', 'skills', 'dent');
  await mkdir(skill, { recursive: true });
  await writeFile(join(skill, 'SKILL.md'), "---\nname: dent\nversion: '0.1.6'\n---\n");

  const checked = await runDent(['check'], { cwd: directory, configDir: join(directory, 'config'), env: { HOME: directory, DENT_REGISTRY_URL: 'http://127.0.0.1:1/latest' } });
  assert.equal(checked.code, 2);
  assert.match(checked.stdout, /Registry unreachable; compared against the local package only\./);
  assert.match(checked.stdout, /Found codex plugin: .*installed v0\.1\.6/);
  assert.match(checked.stdout, /Run: codex plugin marketplace upgrade/);

  const updated = await runDent(['update', '--skip-upgrade'], { cwd: directory, configDir: join(directory, 'config'), env: { HOME: directory } });
  assertSuccess(updated);
  assert.equal(await readFile(join(skill, 'SKILL.md'), 'utf8'), "---\nname: dent\nversion: '0.1.6'\n---\n");
  assert.match(updated.stdout, /Run: codex plugin marketplace upgrade/);
});

test('check assigns a skills CLI lock owner without rewriting its copy', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'dent-cli-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const skill = join(directory, '.agents', 'skills', 'dent');
  await mkdir(skill, { recursive: true });
  await writeFile(join(skill, 'SKILL.md'), "---\nname: dent\nversion: '0.1.6'\n---\n");
  await writeFile(join(directory, '.agents', '.skill-lock.json'), JSON.stringify({ version: 3, skills: { dent: { source: 'getdent/skill', sourceType: 'github', sourceUrl: 'https://github.com/getdent/skill', skillFolderHash: 'fixture' } } }));

  const checked = await runDent(['check'], { cwd: directory, configDir: join(directory, 'config'), env: { HOME: directory, DENT_REGISTRY_URL: 'http://127.0.0.1:1/latest' } });
  assert.equal(checked.code, 2);
  assert.match(checked.stdout, /Registry unreachable; compared against the local package only\./);
  assert.match(checked.stdout, /Found skills CLI: .*installed v0\.1\.6/);
  assert.match(checked.stdout, /Run: npx skills update dent -g/);

  const updated = await runDent(['update', '--skip-upgrade'], { cwd: directory, configDir: join(directory, 'config'), env: { HOME: directory } });
  assertSuccess(updated);
  assert.equal(await readFile(join(skill, 'SKILL.md'), 'utf8'), "---\nname: dent\nversion: '0.1.6'\n---\n");
  assert.match(updated.stdout, /Run: npx skills update dent -g/);
});

test('update refreshes a copied install before Codex plugin guidance', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'dent-cli-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const copied = join(directory, '.claude', 'skills', 'dent');
  const plugin = join(directory, '.codex', 'plugins', 'cache', 'getdent', 'dent', '0.1.6', 'skills', 'dent');
  await mkdir(copied, { recursive: true });
  await mkdir(plugin, { recursive: true });
  await writeFile(join(copied, 'SKILL.md'), "version: '0.1.6'\n");
  await writeFile(join(plugin, 'SKILL.md'), "version: '0.1.6'\n");

  const result = await runDent(['update', '--skip-upgrade'], { cwd: directory, configDir: join(directory, 'config'), env: { HOME: directory } });
  assertSuccess(result);
  assert.match(await readFile(join(copied, 'SKILL.md'), 'utf8'), /name: dent/);
  assert.ok(result.stdout.indexOf('Installed for Claude Code') < result.stdout.indexOf('Run: codex plugin marketplace upgrade'));
});

test('update refreshes a copied install without rewriting a skills CLI install', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'dent-cli-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const copied = join(directory, '.claude', 'skills', 'dent');
  const locked = join(directory, '.agents', 'skills', 'dent');
  await mkdir(copied, { recursive: true });
  await mkdir(locked, { recursive: true });
  await writeFile(join(copied, 'SKILL.md'), "---\nname: dent\nversion: '0.1.6'\n---\n");
  await writeFile(join(locked, 'SKILL.md'), "---\nname: dent\nversion: '0.1.6'\n---\n");
  await writeFile(join(directory, '.agents', '.skill-lock.json'), JSON.stringify({ version: 3, skills: { dent: { source: 'getdent/skill', sourceType: 'github', sourceUrl: 'https://github.com/getdent/skill', skillFolderHash: 'fixture' } } }));

  const result = await runDent(['update', '--skip-upgrade'], { cwd: directory, configDir: join(directory, 'config'), env: { HOME: directory } });

  assertSuccess(result);
  assert.match(await readFile(join(copied, 'SKILL.md'), 'utf8'), /name: dent/);
  assert.equal(await readFile(join(locked, 'SKILL.md'), 'utf8'), "---\nname: dent\nversion: '0.1.6'\n---\n");
  assert.match(result.stdout, /Run: npx skills update dent -g/);
});

test('api command resolves the catalog nested chain recursively', async t => {
  const catalog = JSON.parse(await readFile(join(repoRoot, 'scripts', 'schema-catalog.snapshot.json'), 'utf8'));
  const stub = await startDentStub({ catalog });
  t.after(stub.close);
  const configDir = await createConfigDir(t);
  await writeFile(join(configDir, 'config.json'), JSON.stringify({ activeTarget: 'live', targets: { live: { siteUrl: stub.url, apiKey: 'test-token' } } }));
  for (const args of [
    ['courses', '1', 'sections'],
    ['courses', '1', 'sections', '2'],
    ['courses', '1', 'sections', '2', 'lessons'],
    ['courses', '1', 'sections', '2', 'lessons', '3'],
  ]) assertSuccess(await runDent(['api', ...args], { configDir }));
  assert.deepEqual(stub.apiRequests.map(request => request.path), [
    '/api/v1/courses/1/sections',
    '/api/v1/courses/1/sections/2',
    '/api/v1/courses/1/sections/2/lessons',
    '/api/v1/courses/1/sections/2/lessons/3',
  ]);
});

test('check reports a registry failure even when quiet', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'dent-cli-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const result = await runDent(['check', '--quiet'], { cwd: directory, configDir: join(directory, 'config'), env: { HOME: directory, DENT_REGISTRY_URL: 'http://127.0.0.1:1/latest' } });
  assert.equal(result.code, 2);
  assert.match(result.stdout, /Registry unreachable; compared against the local package only\./);
});

test('readInstalledVersion ignores body text without frontmatter', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'dent-cli-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const skill = join(directory, '.claude', 'skills', 'dent');
  await mkdir(skill, { recursive: true });
  await writeFile(join(skill, 'SKILL.md'), 'body\nversion: 9.9.9\n');
  const result = await runDent(['check'], { cwd: directory, configDir: join(directory, 'config'), env: { HOME: directory, DENT_REGISTRY_URL: 'http://127.0.0.1:1/latest' } });
  assert.match(result.stdout, /installed vunknown/);
});

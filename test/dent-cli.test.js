import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
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
        sendJson(response, 200, { token: oauthToken });
        return;
      }

      const token = String(request.headers.authorization || '').replace(/^Bearer\s+/i, '');
      if (!validTokens.has(token)) {
        sendJson(response, 401, { message: 'unauthorized' });
        return;
      }

      if (request.method === 'GET' && url.pathname === '/api/v1/schema/') {
        schemaRequests.push({ token, search: url.search });
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
  const child = spawn(process.execPath, [dentBin, ...args], {
    cwd: repoRoot,
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

  assertSuccess(await runDent(['whoami'], { configDir }));
  assertSuccess(await runDent(['whoami'], { configDir, env: { DENT_TARGET: 'local' } }));
  assert.equal(live.schemaRequests.at(-1).token, 'live-token');
  assert.equal(local.schemaRequests.at(-1).token, 'local-token');
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

test('oauth copy-code login exchanges stdin code with the PKCE verifier', async t => {
  const stub = await startDentStub({ oauthToken: 'copy-code-token' });
  t.after(stub.close);
  const configDir = await createConfigDir(t);

  const result = await runDent(['login', '--site-url', stub.url, '--copy-code', '--stdin-code', '--no-open'], {
    configDir,
    input: 'copied-code\n',
  });

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

#!/usr/bin/env node

import { createHash, randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync, chmodSync, cpSync, renameSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { dirname, join, resolve, relative } from 'node:path';
import { emitKeypressEvents } from 'node:readline';
import { fileURLToPath } from 'node:url';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const skillName = 'dent';
const liveTargetName = 'live';
const localTargetName = 'local';
const providerConfig = JSON.parse(readFileSync(join(packageRoot, 'providers.json'), 'utf8'));
const providers = providerConfig.providers;
const installableProviders = providers.filter(provider => provider.harnessDir);

const providerDefinitions = Object.fromEntries(providers.flatMap(provider => [
  [provider.name, provider],
  ...(provider.aliases || []).map(alias => [alias, provider]),
]));

const harnessOrder = installableProviders.map(provider => provider.name);

function readPackage() {
  return JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'));
}

function printHelp() {
  const version = readPackage().version;
  const providerNames = providers.map(provider => provider.name).join(', ');
  console.log(`Dent CLI v${version}

Usage:
  dent <command> [options]

Commands:
  install                 Install the Dent skill into a provider harness or target folder
  update                  Refresh installed Dent skill files from this package
  check                   Check installed skill version and print update guidance
  login                   Verify and store a Dent API credential
  logout                  Remove the stored Dent credential for the active target
  setup                   Point this checkout at a local Dent repo target
  reset                   Return this checkout to the live Dent target
  status                  Show the active target, credential state, and authenticated tenant
  whoami                  Fetch /api/v1/schema/ to prove the current credential works
  schema [entity]         Fetch and pretty-print the schema catalog or one entity
  api <entity> [id] [action]
                          Call generic Dent API routes and print JSON
  help                    Show this help

Install options:
  --dir <path>            Project root to inspect for provider harnesses
  --provider <name>       ${providerNames}
  --scope <project|global>
  --target <path>         Custom harness folder that contains or should contain skills/
  --yes                   Do not prompt; use detected defaults
  --force                 Recopy even when already current

Login options:
  --site-url <url>        Dent Site URL for the active target
  --copy-code             Use the browser copy-code fallback instead of loopback
  --stdin-code            Read the browser copy-code from standard input
  --no-open               Print the authorize URL without opening the browser
  --token-prompt          Prompt for a personal access token
  --stdin                 Read the token from standard input; never from argv

API options:
  --data <json|@file>     Request body. File form reads JSON from disk
  --method <verb>         Explicitly override the catalog-resolved HTTP method
  --param <name=value>    Query parameter for catalog actions that take parameters

Environment:
  DENT_TARGET selects live or local stored credentials.
  DENT_API_KEY and DENT_SITE_URL each override the matching active stored credential.
  DENT_CONFIG_DIR overrides the config directory for tests and automation.

Examples:
  dent install
  dent login
  dent login --copy-code
  dent setup
  dent reset
  echo "$DENT_PERSONAL_ACCESS_TOKEN" | dent login --site-url https://example.com --stdin
  dent whoami
  dent schema orders
  dent api contacts
  dent api contacts 123
  dent api contacts --data '{"email":"person@example.com"}'
  dent api contacts 123 enroll --data @payload.json
  dent api courses 9203 sections
  dent api dent breakdown --param dimension=source --param period=last_month`);
}

function parseArgs(argv) {
  const positionals = [];
  const options = {};
  function setOption(name, value) {
    if (options[name] === undefined) {
      options[name] = value;
      return;
    }
    if (Array.isArray(options[name])) options[name].push(value);
    else options[name] = [options[name], value];
  }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) {
      positionals.push(arg);
      continue;
    }
    const equalsIndex = arg.indexOf('=');
    if (equalsIndex !== -1) {
      setOption(arg.slice(2, equalsIndex), arg.slice(equalsIndex + 1));
      continue;
    }
    const name = arg.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith('--')) {
      setOption(name, next);
      index += 1;
    } else {
      setOption(name, true);
    }
  }
  return { positionals, options };
}

function resolveConfigDir() {
  if (process.env.DENT_CONFIG_DIR) return resolve(process.env.DENT_CONFIG_DIR);
  if (platform() === 'win32') return join(process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'), 'dent');
  if (platform() === 'darwin') return join(homedir(), 'Library', 'Application Support', 'dent');
  return join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'dent');
}

function configFilePath() {
  return join(resolveConfigDir(), 'config.json');
}

function normalizeTargetName(value) {
  const name = String(value || '').trim().toLowerCase();
  if (!name) return liveTargetName;
  if (![liveTargetName, localTargetName].includes(name)) throw new Error(`Unknown Dent target: ${value}. Use live or local.`);
  return name;
}

function activeTargetName(config = readStoredConfig()) {
  return normalizeTargetName(process.env.DENT_TARGET || config?.activeTarget || liveTargetName);
}

function normalizeBaseUrl(value) {
  const text = String(value || '').trim();
  if (!text) throw new Error('Dent site URL is required.');
  const url = new URL(text);
  return url.toString().replace(/\/$/, '');
}

function readStoredConfig() {
  const file = configFilePath();
  if (!existsSync(file)) return null;
  const stored = JSON.parse(readFileSync(file, 'utf8'));
  if (stored.targets) return stored;
  if (!stored.siteUrl && !stored.apiKey) return stored;
  return {
    activeTarget: liveTargetName,
    targets: {
      [liveTargetName]: {
        siteUrl: stored.siteUrl,
        apiKey: stored.apiKey,
        savedAt: stored.savedAt,
      },
    },
  };
}

function createEmptyConfig() {
  return {
    activeTarget: liveTargetName,
    targets: {},
  };
}

function readStoredSiteUrl(targetName = activeTargetName()) {
  const stored = readStoredConfig();
  return stored?.targets?.[normalizeTargetName(targetName)]?.siteUrl || '';
}

function writeStoredConfig(config) {
  const dir = resolveConfigDir();
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const file = configFilePath();
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  chmodSync(tmp, 0o600);
  rmSync(file, { force: true });
  renameSync(tmp, file);
  chmodSync(file, 0o600);
  return file;
}

function updateStoredConfig(updater) {
  const config = readStoredConfig() || createEmptyConfig();
  config.targets = config.targets || {};
  const next = updater(config) || config;
  return writeStoredConfig(next);
}

function storedCredential(config, targetName) {
  return config?.targets?.[normalizeTargetName(targetName)] || null;
}

function loadCredentials() {
  const envHasApiKey = process.env.DENT_API_KEY !== undefined && process.env.DENT_API_KEY !== '';
  const envHasSiteUrl = process.env.DENT_SITE_URL !== undefined && process.env.DENT_SITE_URL !== '';
  const stored = readStoredConfig();
  const targetName = activeTargetName(stored);
  const credential = storedCredential(stored, targetName);
  const siteUrl = envHasSiteUrl ? process.env.DENT_SITE_URL : credential?.siteUrl;
  const apiKey = envHasApiKey ? process.env.DENT_API_KEY : credential?.apiKey;
  if (!siteUrl || !apiKey) {
    if (!siteUrl && !apiKey) throw new Error(`Not logged in for the ${targetName} target. Run \`dent login\` or set DENT_API_KEY and DENT_SITE_URL.`);
    if (!siteUrl) throw new Error(`Dent site URL is missing for the ${targetName} target. Run \`dent login --site-url <url>\` or set DENT_SITE_URL.`);
    throw new Error(`Dent API key is missing for the ${targetName} target. Run \`dent login\` or set DENT_API_KEY.`);
  }
  const source = envHasApiKey && envHasSiteUrl
    ? 'environment'
    : envHasApiKey || envHasSiteUrl
      ? 'environment + stored config'
      : 'stored config';
  return {
    source,
    targetName,
    siteUrl: normalizeBaseUrl(siteUrl),
    apiKey,
  };
}

function readStdin() {
  return new Promise((resolveRead, rejectRead) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => { data += chunk; });
    process.stdin.on('end', () => resolveRead(data));
    process.stdin.on('error', rejectRead);
  });
}

function askLine(prompt) {
  return new Promise((resolveAnswer, rejectAnswer) => {
    process.stdout.write(prompt);
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.resume();
    process.stdin.on('data', function onData(chunk) {
      data += chunk;
      if (data.includes('\n')) {
        process.stdin.off('data', onData);
        process.stdin.pause();
        resolveAnswer(data.split(/\r?\n/)[0].trim());
      }
    });
    process.stdin.once('error', rejectAnswer);
  });
}

function askHidden(prompt) {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
    throw new Error('Hidden token prompt requires a terminal. Use `dent login --stdin` for piped setup.');
  }
  process.stdout.write(prompt);
  const input = process.stdin;
  const wasRaw = input.isRaw;
  let value = '';
  emitKeypressEvents(input);
  input.setRawMode(true);
  input.resume();
  return new Promise((resolveAnswer, rejectAnswer) => {
    function cleanup() {
      input.off('keypress', onKeypress);
      input.setRawMode(wasRaw);
      input.pause();
      process.stdout.write('\n');
    }
    function onKeypress(str, key = {}) {
      if (key.ctrl && key.name === 'c') {
        cleanup();
        rejectAnswer(new Error('Aborted.'));
        return;
      }
      if (key.name === 'return' || key.name === 'enter') {
        cleanup();
        resolveAnswer(value.trim());
        return;
      }
      if (key.name === 'backspace' || key.name === 'delete') {
        value = value.slice(0, -1);
        return;
      }
      if (str && !key.ctrl && !key.meta) value += str;
    }
    input.on('keypress', onKeypress);
  });
}

async function apiRequestWithCredentials(credentials, pathname, { method = 'GET', data, params, accept = 'application/json', raw = false } = {}) {
  const url = new URL(pathname, credentials.siteUrl);
  for (const [name, value] of params || []) {
    url.searchParams.append(name, value);
  }
  const headers = {
    Accept: accept,
    Authorization: `Bearer ${credentials.apiKey}`,
  };
  let body;
  if (data !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(data);
  }
  const response = await dentFetch(url, { method, headers, body });
  if (raw && response.ok) {
    const buffer = Buffer.from(await response.arrayBuffer());
    return { url: url.toString(), status: response.status, body: buffer, credentialSource: credentials.source };
  }
  const text = await response.text();
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  if (!response.ok) {
    const detail = typeof parsed === 'string' ? parsed : JSON.stringify(parsed);
    throw new Error(`${method} ${url.pathname} failed with HTTP ${response.status}${detail ? `: ${detail}` : ''}`);
  }
  return { url: url.toString(), status: response.status, body: parsed, credentialSource: credentials.source };
}

async function apiRequest(pathname, { method = 'GET', data, params, accept, raw } = {}) {
  return apiRequestWithCredentials(loadCredentials(), pathname, { method, data, params, accept, raw });
}

function collectErrorCauses(error) {
  const causes = [];
  let current = error?.cause;
  while (current) {
    causes.push(current);
    current = current.cause;
  }
  return causes;
}

function formatErrorCause(error) {
  const code = error?.code ? `${error.code}: ` : '';
  const message = error?.message || String(error);
  return `${code}${message}`;
}

function isCertificateCause(error) {
  const code = String(error?.code || '');
  const message = String(error?.message || '').toLowerCase();
  const certificateCodes = [
    'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
    'SELF_SIGNED_CERT_IN_CHAIN',
    'DEPTH_ZERO_SELF_SIGNED_CERT',
    'CERT_HAS_EXPIRED',
    'ERR_TLS_CERT_ALTNAME_INVALID',
  ];
  return certificateCodes.includes(code) || message.includes('certificate') || message.includes('self-signed');
}

function buildFetchError(error, url, method = 'GET') {
  const causes = collectErrorCauses(error);
  const lines = [
    `${method} ${url.toString()} failed before receiving a response: ${error?.message || error}`,
  ];
  if (causes.length > 0) lines.push(`Cause: ${causes.map(formatErrorCause).join(' <- ')}`);
  if (causes.some(isCertificateCause) || isCertificateCause(error)) {
    lines.push('Hint: this looks like a certificate trust failure. For local development, point NODE_EXTRA_CA_CERTS at the Lando CA certificate instead of disabling TLS verification.');
  }
  return new Error(lines.join('\n'), { cause: error });
}

async function dentFetch(url, options = {}) {
  try {
    return await fetch(url, options);
  } catch (error) {
    throw buildFetchError(error, url, options.method || 'GET');
  }
}

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

async function verifyCredential(siteUrl, apiKey) {
  const credentials = {
    source: 'login verification',
    targetName: 'login',
    siteUrl,
    apiKey,
  };
  const result = await apiRequestWithCredentials(credentials, '/api/v1/schema/');
  const catalog = result.body || {};
  const entities = Array.isArray(catalog.entities)
    ? catalog.entities.length
    : Object.keys(catalog.entities || catalog || {}).length;
  console.log(`Verified Dent API access (${entities} entities).`);
}

function defaultLoginSiteUrl() {
  return 'https://ondent.app';
}

function base64Url(buffer) {
  return Buffer.from(buffer).toString('base64url');
}

function createCodeVerifier() {
  return base64Url(randomBytes(48));
}

function createCodeChallenge(verifier) {
  return base64Url(createHash('sha256').update(verifier).digest());
}

function createState() {
  return base64Url(randomBytes(24));
}

function oauthRequest(redirectUri, state, verifier) {
  return {
    response_type: 'code',
    client_id: 'dent-cli',
    redirect_uri: redirectUri,
    code_challenge: createCodeChallenge(verifier),
    code_challenge_method: 'S256',
    state,
  };
}

async function jsonRequest(url, { method = 'GET', data, headers = {} } = {}) {
  const response = await dentFetch(url, {
    method,
    headers: {
      Accept: 'application/json',
      ...(data !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: data !== undefined ? JSON.stringify(data) : undefined,
  });
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!response.ok) {
    const detail = typeof body === 'string' ? body : JSON.stringify(body);
    throw new Error(`${method} ${url.pathname} failed with HTTP ${response.status}${detail ? `: ${detail}` : ''}`);
  }
  return body;
}

async function createCliAuthorization(siteUrl, request) {
  return jsonRequest(new URL('/platform/api/v1/auth/cli-authorization', siteUrl), {
    method: 'POST',
    data: request,
  });
}

async function exchangeCliAuthorization(siteUrl, code, redirectUri, verifier) {
  return jsonRequest(new URL('/platform/api/v1/auth/cli-authorization/token', siteUrl), {
    method: 'POST',
    data: {
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: verifier,
    },
  });
}

function openBrowser(url, options = {}) {
  if (options['no-open'] || process.env.DENT_NO_OPEN === '1') return false;

  const value = String(url);
  let command;
  let args;
  if (platform() === 'darwin') {
    command = 'open';
    args = [value];
  } else if (platform() === 'win32') {
    command = 'cmd';
    args = ['/c', 'start', '', value];
  } else {
    command = 'xdg-open';
    args = [value];
  }

  const result = spawnSync(command, args, { stdio: 'ignore' });
  return result.status === 0;
}

function createLoopbackServer(expectedState) {
  return new Promise((resolveListen, rejectListen) => {
    const server = createServer((request, response) => {
      try {
        const url = new URL(request.url || '/', 'http://127.0.0.1');
        if (url.pathname !== '/oauth/dent/callback') {
          response.writeHead(404, { 'Content-Type': 'text/plain' });
          response.end('Not found');
          return;
        }

        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        if (!code || state !== expectedState) {
          response.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
          response.end('<h1>Dent login failed</h1><p>The authorization response did not match this CLI session.</p>');
          server.emit('authorization-error', new Error('Authorization callback did not match this CLI session.'));
          return;
        }

        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        response.end('<h1>Dent login complete</h1><p>You can close this window and return to the terminal.</p>');
        server.emit('authorization-code', code);
      } catch (error) {
        server.emit('authorization-error', error);
      }
    });

    server.once('error', rejectListen);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        rejectListen(new Error('Could not start the Dent login callback server.'));
        return;
      }

      resolveListen({
        server,
        redirectUri: `http://127.0.0.1:${address.port}/oauth/dent/callback`,
      });
    });
  });
}

function waitForLoopbackCode(server) {
  return new Promise((resolveCode, rejectCode) => {
    const timeout = setTimeout(() => {
      server.close();
      rejectCode(new Error('Timed out waiting for browser authorization.'));
    }, 5 * 60 * 1000);

    server.once('authorization-code', code => {
      clearTimeout(timeout);
      server.close();
      resolveCode(code);
    });
    server.once('authorization-error', error => {
      clearTimeout(timeout);
      server.close();
      rejectCode(error);
    });
  });
}

function saveCredential(targetName, siteUrl, apiKey) {
  const file = updateStoredConfig(next => {
    next.activeTarget = targetName;
    next.targets[targetName] = {
      ...(next.targets[targetName] || {}),
      siteUrl,
      apiKey,
      savedAt: new Date().toISOString(),
    };
    return next;
  });
  console.log(`Saved Dent ${targetName} credential for ${siteUrl}`);
  console.log(`Config: ${file}`);
}

async function loginWithToken(options, targetName, siteUrl) {
  const apiKey = options.stdin
    ? (await readStdin()).trim()
    : await askHidden('Personal access token: ');
  if (!apiKey) throw new Error('Personal access token is required.');
  await verifyCredential(siteUrl, apiKey);
  saveCredential(targetName, siteUrl, apiKey);
}

async function oauthLogin(options, targetName, siteUrl) {
  const verifier = createCodeVerifier();
  const state = createState();
  let server;
  let redirectUri;

  if (options['copy-code']) {
    redirectUri = new URL('/platform/cli/code', siteUrl).toString();
  } else {
    const loopback = await createLoopbackServer(state);
    server = loopback.server;
    redirectUri = loopback.redirectUri;
  }

  const request = oauthRequest(redirectUri, state, verifier);
  const authorization = await createCliAuthorization(siteUrl, request);
  const authorizeUrl = authorization.authorizeUrl;

  console.log('Opening Dent in your browser...');
  console.log(`Authorize URL: ${authorizeUrl}`);
  if (!options['copy-code']) console.log(`Loopback callback: ${redirectUri}`);
  if (!openBrowser(authorizeUrl, options)) {
    console.log('Open the authorize URL above in your browser.');
  }

  let code;
  if (options['copy-code']) {
    if (options['stdin-code']) {
      code = (await readStdin()).trim();
    } else if (options.code) {
      code = String(options.code).trim();
    } else {
      if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error('Authorization code is required. Pass --stdin-code for piped copy-code login.');
      code = await askLine('Paste the authorization code from Dent: ');
    }
  } else {
    console.log(`Waiting for browser callback on ${redirectUri}`);
    code = await waitForLoopbackCode(server);
    console.log('Browser callback received.');
  }

  const token = await exchangeCliAuthorization(siteUrl, code, redirectUri, verifier);
  const storedSiteUrl = normalizeBaseUrl(token.siteUrl || siteUrl);
  await verifyCredential(storedSiteUrl, token.token);
  saveCredential(targetName, storedSiteUrl, token.token);
  console.log('Dent login complete.');
}

async function login(options) {
  const config = readStoredConfig() || createEmptyConfig();
  const targetName = activeTargetName(config);
  const storedSiteUrl = readStoredSiteUrl(targetName);
  let siteUrlInput = options['site-url'] || process.env.DENT_SITE_URL || storedSiteUrl || (targetName === liveTargetName ? defaultLoginSiteUrl() : '');
  if (!siteUrlInput) {
    if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error('Dent Site URL is required. Pass --site-url or set DENT_SITE_URL.');
    siteUrlInput = await askLine('Dent Site URL: ');
  }
  const siteUrl = normalizeBaseUrl(siteUrlInput);
  if (options.stdin || options['token-prompt']) return loginWithToken(options, targetName, siteUrl);
  return oauthLogin(options, targetName, siteUrl);
}

async function logout() {
  const file = configFilePath();
  const config = readStoredConfig();
  const targetName = activeTargetName(config);
  if (config?.targets?.[targetName]) {
    delete config.targets[targetName];
    writeStoredConfig(config);
    console.log(`Removed Dent ${targetName} credential from ${file}`);
  } else {
    console.log(`No stored Dent ${targetName} credential found.`);
  }
}

function defaultDentRepo() {
  const sibling = resolve(packageRoot, '..', 'creator-income-blueprint');
  if (existsSync(sibling)) return sibling;
  return process.cwd();
}

function localSiteUrlFromRepo(dentRepo) {
  const result = spawnSync('bun', ['site'], {
    cwd: dentRepo,
    encoding: 'utf8',
  });
  if (result.status === 0 && result.stdout.trim()) return normalizeBaseUrl(result.stdout.trim());
  const detail = (result.stderr || result.stdout || '').trim();
  throw new Error(`Could not read the local Dent Site URL from ${dentRepo} with \`bun site\`${detail ? `: ${detail}` : ''}. Pass --site-url explicitly.`);
}

function setup(options) {
  const dentRepo = resolve(options['dent-repo'] || process.env.DENT_REPO || defaultDentRepo());
  const siteUrl = normalizeBaseUrl(options['site-url'] || localSiteUrlFromRepo(dentRepo));
  const file = updateStoredConfig(config => {
    config.activeTarget = localTargetName;
    config.targets[localTargetName] = {
      ...(config.targets[localTargetName] || {}),
      siteUrl,
      dentRepo,
      savedAt: config.targets[localTargetName]?.savedAt,
    };
    return config;
  });
  const credential = storedCredential(readStoredConfig(), localTargetName);
  console.log(`Dent target: local`);
  console.log(`Local Dent repo: ${dentRepo}`);
  console.log(`Local Dent Site URL: ${siteUrl}`);
  console.log(credential?.apiKey ? 'Local credential preserved.' : 'Local credential missing. Run `dent login` while the local target is active.');
  console.log(`Config: ${file}`);
}

function reset() {
  const file = updateStoredConfig(config => {
    config.activeTarget = liveTargetName;
    config.targets[liveTargetName] = config.targets[liveTargetName] || {};
    return config;
  });
  const credential = storedCredential(readStoredConfig(), liveTargetName);
  console.log(`Dent target: live`);
  console.log(credential?.apiKey ? `Live credential preserved for ${credential.siteUrl}.` : 'Live credential missing. Run `dent login --site-url <live-site-url>`.');
  console.log(`Config: ${file}`);
}

function describeCredentialSources(credential) {
  return {
    siteUrl: process.env.DENT_SITE_URL ? 'DENT_SITE_URL' : credential?.siteUrl ? 'stored config' : 'missing',
    apiKey: process.env.DENT_API_KEY ? 'DENT_API_KEY' : credential?.apiKey ? 'stored config' : 'missing',
  };
}

function accountProfileSummary(body) {
  const profile = body?.data || body || {};
  const name = profile.name || [profile.first_name, profile.last_name].filter(Boolean).join(' ');
  const email = profile.email;
  if (name && email) return `${name} <${email}>`;
  if (name || email) return name || email;
  return JSON.stringify(profile);
}

async function status() {
  const stored = readStoredConfig();
  const targetName = activeTargetName(stored);
  const targetSource = process.env.DENT_TARGET ? 'DENT_TARGET' : stored?.activeTarget ? 'stored config' : 'default';
  const credential = storedCredential(stored, targetName);
  const sources = describeCredentialSources(credential);
  const siteUrl = process.env.DENT_SITE_URL || credential?.siteUrl || '';
  console.log(`Target:      ${targetName} (from ${targetSource})`);
  console.log(`Site URL:    ${siteUrl ? `${siteUrl} (from ${sources.siteUrl})` : 'missing'}`);
  console.log(`Credential:  ${sources.apiKey}${sources.apiKey === 'stored config' && credential?.savedAt ? ` (saved ${credential.savedAt})` : ''}`);
  if (targetName === localTargetName && credential?.dentRepo) console.log(`Local repo:  ${credential.dentRepo}`);
  console.log(`Config:      ${configFilePath()}`);
  const otherName = targetName === liveTargetName ? localTargetName : liveTargetName;
  const other = storedCredential(stored, otherName);
  if (other?.siteUrl || other?.apiKey) {
    console.log(`Other target: ${otherName} — ${other.apiKey ? 'credential stored' : 'no credential'}${other.siteUrl ? ` for ${other.siteUrl}` : ''}`);
  }

  try {
    loadCredentials();
  } catch (error) {
    console.log(`API:         not logged in — ${error.message}`);
    return;
  }

  let catalog;
  try {
    catalog = await loadSchemaCatalog();
  } catch (error) {
    console.log(`API:         unreachable — ${error.message}`);
    return;
  }
  const entities = catalogEntities(catalog);
  const entityCount = Array.isArray(entities) ? entities.length : Object.keys(entities).length;
  console.log(`API:         reachable — schema catalog OK (${entityCount} entities)`);

  try {
    const account = catalogEntity(catalog, 'account');
    const action = account && actionByNameAndTarget(account, 'profile', 'collection');
    if (!action) throw new Error('the schema catalog has no account profile action');
    // The live route is the entity name (/account/profile), not the label-derived plural.
    const result = await apiRequest(`/api/v1/${encodeSegment(account.entity || 'account')}/profile`, { method: methodForAction(action) });
    console.log(`Account:     ${accountProfileSummary(result.body)}`);
  } catch (error) {
    console.log(`Account:     unavailable — ${error.message}`);
  }
}

async function whoami() {
  const result = await apiRequest('/api/v1/schema/');
  const catalog = result.body || {};
  const entities = Array.isArray(catalog.entities)
    ? catalog.entities.length
    : Object.keys(catalog.entities || catalog || {}).length;
  const credentials = loadCredentials();
  console.log(`Authenticated with ${result.credentialSource} (${credentials.targetName} target).`);
  console.log(`Schema catalog reachable (${entities} entities).`);
}

async function schema(entity) {
  const result = await apiRequest('/api/v1/schema/');
  if (!entity) {
    printJson(result.body);
    return;
  }
  const catalog = result.body || {};
  const entities = catalog.entities || catalog;
  const value = resolveCatalogEntity(entities, entity);
  if (!value) throw new Error(`Entity not found in schema catalog: ${entity}`);
  printJson(value);
}

function normalizeCatalogText(value) {
  return String(value || '').trim().toLowerCase().replace(/[\s_]+/g, '-');
}

function matchesEntityName(item, name) {
  const normalized = normalizeCatalogText(name);
  return [
    item?.name,
    item?.key,
    item?.entity,
    item?.label,
  ].some(value => normalizeCatalogText(value) === normalized);
}

function resolveCatalogEntity(entities, entity) {
  const name = String(entity || '').trim();
  if (Array.isArray(entities)) return entities.find(item => matchesEntityName(item, name));
  if (entities[name]) return entities[name];
  for (const [key, item] of Object.entries(entities)) {
    if (normalizeCatalogText(key) === normalizeCatalogText(name) || matchesEntityName(item, name)) return item;
  }
  return undefined;
}

function routeSegmentForEntity(entity, fallback) {
  const route = entity?.route || entity?.path || entity?.slug || entity?.label || entity?.entity || fallback;
  return normalizeCatalogText(route);
}

function parseData(value) {
  if (value === undefined) return undefined;
  const source = String(value);
  const text = source.startsWith('@') ? readFileSync(source.slice(1), 'utf8') : source;
  return JSON.parse(text);
}

function valuesForOption(value) {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function parseParams(options) {
  const params = [];
  for (const entry of [...valuesForOption(options.param), ...valuesForOption(options.query)]) {
    const text = String(entry);
    const equalsIndex = text.indexOf('=');
    if (equalsIndex === -1) throw new Error(`Query parameter must be name=value: ${text}`);
    const name = text.slice(0, equalsIndex).trim();
    if (!name) throw new Error(`Query parameter name is required: ${text}`);
    params.push([name, text.slice(equalsIndex + 1)]);
  }
  return params;
}

function encodeSegment(value) {
  return String(value).split('/').map(segment => encodeURIComponent(segment)).join('/');
}

async function loadSchemaCatalog() {
  const result = await apiRequest('/api/v1/schema/');
  return result.body || {};
}

function catalogEntities(catalog) {
  return catalog.entities || catalog || {};
}

function catalogEntity(catalog, entity) {
  return resolveCatalogEntity(catalogEntities(catalog), entity);
}

function actionByName(entity, name) {
  return (entity?.actions || []).find(action => action?.name === name);
}

function actionByNameAndTarget(entity, name, target) {
  return (entity?.actions || []).find(action => action?.name === name && action?.target === target);
}

function actionForCrud(entity, name) {
  const action = actionByName(entity, name);
  if (!action) throw new Error(`Schema catalog does not define ${name} for ${entity?.entity || 'entity'}.`);
  return action;
}

function apiCall(action, pathSegments) {
  return { action, pathSegments };
}

function isCrudAction(action) {
  return ['list', 'get', 'create', 'update', 'delete'].includes(action?.name);
}

function methodForAction(action) {
  if (action.mode === 'read') return 'GET';
  if (action.mode === 'destroy') return 'DELETE';
  if (action.mode === 'write' || action.mode === 'remote') return 'POST';
  throw new Error(`Schema action ${action.name} has unsupported mode: ${action.mode}`);
}

function catalogParameterNames(action) {
  const parameters = action?.parameters;
  if (Array.isArray(parameters)) return parameters.map(parameter => parameter?.name || parameter?.key).filter(Boolean);
  if (parameters && typeof parameters === 'object') return Object.keys(parameters);
  return [];
}

function catalogFileResult(action) {
  const returns = action?.returns;
  if (returns && typeof returns === 'object' && returns.type === 'filedownload') return returns;
  return null;
}

function fileAcceptHeader() {
  return '*/*';
}

function validateQueryParameters(action, params) {
  const allowed = catalogParameterNames(action);
  if (allowed.length === 0 || params.length === 0) return;
  for (const [name] of params) {
    if (!allowed.includes(name)) {
      throw new Error(`Schema action ${action.name} does not define query parameter: ${name}`);
    }
  }
}

function isNumericSegment(value) {
  return /^\d+$/.test(String(value || ''));
}

function resolveApiCall(catalog, segments, hasData) {
  const [entitySegment, second, third, fourth, fifth] = segments;
  const entity = catalogEntity(catalog, entitySegment);
  if (!entity) throw new Error(`Entity not found in schema catalog: ${entitySegment}`);
  const entityRoute = routeSegmentForEntity(entity, entitySegment);

  if (segments.length === 1) {
    return apiCall(actionForCrud(entity, hasData ? 'create' : 'list'), [entityRoute]);
  }

  const collectionAction = actionByNameAndTarget(entity, second, 'collection');
  if (segments.length === 2 && collectionAction) {
    return apiCall(collectionAction, isCrudAction(collectionAction) ? [entityRoute] : [entityRoute, second]);
  }

  if (segments.length === 2) {
    return apiCall(actionForCrud(entity, hasData ? 'update' : 'get'), [entityRoute, second]);
  }

  const memberAction = actionByNameAndTarget(entity, third, 'member');
  if (segments.length === 3 && memberAction) {
    return apiCall(memberAction, isCrudAction(memberAction) ? [entityRoute, second] : [entityRoute, second, third]);
  }

  const nestedEntity = catalogEntity(catalog, third);
  const nestedRoute = nestedEntity ? routeSegmentForEntity(nestedEntity, third) : third;
  if (segments.length === 3 && nestedEntity) {
    return apiCall(actionForCrud(nestedEntity, hasData ? 'create' : 'list'), [entityRoute, second, nestedRoute]);
  }

  if (segments.length === 3 && collectionAction && isNumericSegment(third)) {
    return apiCall(collectionAction, isCrudAction(collectionAction) ? [entityRoute] : [entityRoute, second, third]);
  }

  if (segments.length === 4 && nestedEntity) {
    const nestedCollectionAction = actionByNameAndTarget(nestedEntity, fourth, 'collection');
    if (nestedCollectionAction) {
      return apiCall(nestedCollectionAction, isCrudAction(nestedCollectionAction) ? [entityRoute, second, nestedRoute] : [entityRoute, second, nestedRoute, fourth]);
    }

    return apiCall(actionForCrud(nestedEntity, hasData ? 'update' : 'get'), [entityRoute, second, nestedRoute, fourth]);
  }

  if (segments.length === 5 && nestedEntity) {
    const nestedAction = actionByNameAndTarget(nestedEntity, fifth, 'member');
    if (nestedAction) {
      return apiCall(nestedAction, isCrudAction(nestedAction) ? [entityRoute, second, nestedRoute, fourth] : [entityRoute, second, nestedRoute, fourth, fifth]);
    }
  }

  throw new Error(`Schema catalog cannot resolve an action for: ${segments.join(' ')}`);
}

async function resolveApiRequest(positionals, options, data) {
  const params = parseParams(options);
  if (options.method) {
    return { method: String(options.method).toUpperCase(), pathSegments: positionals, params, action: null };
  }

  const catalog = await loadSchemaCatalog();
  const call = resolveApiCall(catalog, positionals, data !== undefined);
  validateQueryParameters(call.action, params);
  return { method: methodForAction(call.action), pathSegments: call.pathSegments, params, action: call.action };
}

async function api(positionals, options) {
  if (positionals.length === 0) throw new Error('Usage: dent api <entity> [id] [action] [--data JSON|@file] [--method VERB]');
  const data = parseData(options.data);
  const request = await resolveApiRequest(positionals, options, data);
  const path = `/api/v1/${request.pathSegments.map(encodeSegment).join('/')}`;
  const fileResult = catalogFileResult(request.action);
  const result = await apiRequest(path, {
    method: request.method,
    data,
    params: request.params,
    accept: fileResult ? fileAcceptHeader() : undefined,
    raw: Boolean(fileResult),
  });
  if (fileResult) {
    process.stdout.write(result.body);
    return;
  }
  printJson(result.body);
}

function providerFromValue(value) {
  const key = String(value || '').trim().toLowerCase();
  const provider = providerDefinitions[key];
  if (!provider) throw new Error(`Unknown provider: ${value}. Use ${providers.map(item => item.name).join(', ')}.`);
  return { ...provider, key: provider.name };
}

function findProjectRoot(startDir) {
  let current = resolve(startDir || process.cwd());
  while (current !== dirname(current)) {
    if (existsSync(join(current, '.git'))) return current;
    current = dirname(current);
  }
  return resolve(startDir || process.cwd());
}

function detectHarnesses(projectRoot) {
  const detections = [];
  for (const key of harnessOrder) {
    const provider = providerFromValue(key);
    const projectHarness = join(projectRoot, provider.harnessDir);
    if (existsSync(projectHarness)) detections.push({ ...provider, key, scope: 'project', harnessPath: projectHarness, root: projectRoot });
  }
  for (const key of harnessOrder) {
    const provider = providerFromValue(key);
    const globalHarness = join(homedir(), provider.harnessDir);
    if (existsSync(globalHarness)) detections.push({ ...provider, key, scope: 'global', harnessPath: globalHarness, root: homedir() });
  }
  return detections;
}

function bundleSkillPath(provider) {
  return join(packageRoot, 'dist', 'providers', provider.name, skillName);
}

function ensureBuilt() {
  const expected = join(packageRoot, 'dist', 'providers', providers[0].name, skillName, 'SKILL.md');
  if (existsSync(expected)) return;
  throw new Error('Compiled skill bundle is missing. Run `npm run build`.');
}

function listFiles(root) {
  if (!existsSync(root)) return [];
  const files = [];
  function walk(dir) {
    for (const entry of readdirSync(dir)) {
      const absolute = join(dir, entry);
      const info = statSync(absolute);
      if (info.isDirectory()) walk(absolute);
      else files.push(relative(root, absolute).replaceAll('\\', '/'));
    }
  }
  walk(root);
  return files.sort();
}

function hashFile(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

function sameTree(left, right) {
  const leftFiles = listFiles(left);
  const rightFiles = listFiles(right);
  if (leftFiles.join('\n') !== rightFiles.join('\n')) return false;
  return leftFiles.every(file => hashFile(join(left, file)) === hashFile(join(right, file)));
}

function readSkillManifest(skillPath) {
  const file = join(skillPath, '.dent-skill.json');
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, 'utf8'));
}

function installedState(source, destination) {
  if (!existsSync(destination)) return { status: 'missing' };
  const sourceManifest = readSkillManifest(source);
  const destinationManifest = readSkillManifest(destination);
  if (sourceManifest && destinationManifest) {
    // Provider is informational, not compared: harness dirs can alias one physical
    // directory (symlinked setups), and contentHash already detects divergent bundles.
    if (
      sourceManifest.package === destinationManifest.package
      && sourceManifest.version === destinationManifest.version
      && sourceManifest.contentHash === destinationManifest.contentHash
    ) {
      return { status: 'current', source: 'manifest', manifest: destinationManifest };
    }
    return { status: 'stale', source: 'manifest', manifest: destinationManifest, expected: sourceManifest };
  }
  return { status: 'stale', source: 'manifest', manifest: destinationManifest, expected: sourceManifest };
}

function installedSkillPath(target) {
  return join(target.harnessPath, 'skills', skillName);
}

function readInstalledVersion(skillPath) {
  const file = join(skillPath, 'SKILL.md');
  if (!existsSync(file)) return null;
  const text = readFileSync(file, 'utf8');
  const match = text.match(/^version:\s*['"]?([^'"\n]+)['"]?$/m);
  return match ? match[1].trim() : null;
}

function copySkill(target, force = false) {
  const source = bundleSkillPath(target);
  if (!existsSync(source)) throw new Error(`No compiled skill bundle for ${target.name}. Run npm run build.`);
  let destination = installedSkillPath(target);
  if (!force && installedState(source, destination).status === 'current') {
    return { status: 'current', destination };
  }
  mkdirSync(dirname(destination), { recursive: true });
  // Symlink-managed installs (stow, dotfiles) own the link; write into its target so the link survives.
  if (lstatSync(destination, { throwIfNoEntry: false })?.isSymbolicLink() && existsSync(destination)) {
    destination = realpathSync(destination);
  }
  rmSync(destination, { recursive: true, force: true });
  cpSync(source, destination, { recursive: true });
  return { status: 'written', destination };
}

async function promptInstallChoice(detections) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) return detections;
  console.log('Detected harnesses:');
  detections.forEach((item, index) => {
    console.log(`  ${index + 1}. ${item.label} ${item.scope} (${item.harnessPath})`);
  });
  console.log('Press enter for detected targets, or type comma-separated numbers.');
  const answer = await askLine('Install target: ');
  if (!answer) return detections;
  const selected = answer.split(',').map(value => Number(value.trim()) - 1).filter(index => detections[index]);
  return selected.map(index => detections[index]);
}

async function installOrUpdate(command, options) {
  ensureBuilt();
  const projectRoot = findProjectRoot(options.dir || process.cwd());
  let targets = [];
  if (options.target) {
    const provider = providerFromValue(options.provider || 'claude-code');
    targets = [{ ...provider, scope: 'custom', harnessPath: resolve(options.target), root: dirname(resolve(options.target)) }];
  } else if (options.provider) {
    const provider = providerFromValue(options.provider);
    if (!provider.harnessDir) throw new Error(`${provider.label} has no local harness. Pass --target to copy its bundle to a folder.`);
    const scope = options.scope === 'global' ? 'global' : 'project';
    const root = scope === 'global' ? homedir() : projectRoot;
    targets = [{ ...provider, scope, harnessPath: join(root, provider.harnessDir), root }];
  } else {
    const detections = detectHarnesses(projectRoot);
    targets = detections.length > 0 ? detections : [{ ...providerFromValue('claude-code'), scope: 'project', harnessPath: join(projectRoot, '.claude'), root: projectRoot }];
    if (!options.yes && command === 'install') targets = await promptInstallChoice(targets);
  }
  let wrote = 0;
  let current = 0;
  for (const target of targets) {
    const result = copySkill(target, Boolean(options.force || command === 'update'));
    if (result.status === 'written') wrote += 1;
    else current += 1;
    const version = readInstalledVersion(result.destination) || readPackage().version;
    const action = result.status === 'written' ? 'Installed' : 'Dent skill is up to date';
    console.log(`${action} for ${target.label} at ${result.destination} (v${version}).`);
  }
  if (wrote === 0 && current > 0) console.log('Nothing to do.');
}

function findInstalledSkills(projectRoot) {
  const roots = [projectRoot, homedir()];
  const found = [];
  for (const root of roots) {
    for (const key of harnessOrder) {
      const provider = providerFromValue(key);
      const skillPath = join(root, provider.harnessDir, 'skills', skillName);
      if (existsSync(join(skillPath, 'SKILL.md'))) {
        found.push({ ...provider, key, root, skillPath, version: readInstalledVersion(skillPath) });
      }
    }
  }
  return found;
}

function check(options) {
  ensureBuilt();
  const projectRoot = findProjectRoot(options.dir || process.cwd());
  const installed = findInstalledSkills(projectRoot);
  if (installed.length === 0) {
    console.log('Dent skill is not installed. Run `dent install`.');
    return;
  }
  for (const item of installed) {
    const state = installedState(bundleSkillPath(item), item.skillPath);
    const expectedVersion = readSkillManifest(bundleSkillPath(item))?.version || readPackage().version;
    console.log(`Found ${item.label}: ${item.skillPath} (installed v${item.version || 'unknown'})`);
    if (state.status !== 'current') {
      const installedVersion = state.manifest?.version || item.version || 'unknown';
      const reason = installedVersion === expectedVersion
        ? `installed contents differ from package v${expectedVersion}`
        : `installed v${installedVersion}, package v${expectedVersion}`;
      console.log(`Update available from ${state.source}: ${reason}. Run \`dent update\`.`);
    } else {
      console.log(`Dent skill is up to date by ${state.source} (v${item.version}).`);
    }
  }
}

async function main() {
  const [command = 'help', ...rest] = process.argv.slice(2);
  const { positionals, options } = parseArgs(rest);
  if (command === 'help' || command === '--help' || command === '-h') return printHelp();
  if (command === '--version' || command === '-v') return console.log(readPackage().version);
  if (command === 'install') return installOrUpdate('install', options);
  if (command === 'update') return installOrUpdate('update', options);
  if (command === 'check') return check(options);
  if (command === 'login') return login(options);
  if (command === 'logout') return logout();
  if (command === 'setup') return setup(options);
  if (command === 'reset') return reset();
  if (command === 'status') return status();
  if (command === 'whoami') return whoami();
  if (command === 'schema') return schema(positionals[0]);
  if (command === 'api') return api(positionals, options);
  throw new Error(`Unknown command: ${command}. Run \`dent help\`.`);
}

main().catch(error => {
  console.error(error?.message || error);
  process.exit(1);
});

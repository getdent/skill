#!/usr/bin/env node

import { createHash, randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync, chmodSync, renameSync, unlinkSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { dirname, join, resolve, relative } from 'node:path';
import { emitKeypressEvents } from 'node:readline';
import { fileURLToPath } from 'node:url';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const skillName = 'dent';
const pluginName = 'dent';
const marketplaceName = 'getdent';
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
  update [--skip-upgrade] Refresh installed Dent skill files from this package
  check [--quiet] [--plugin-root <path>]
                          Check installed skill and CLI versions and print update guidance
  plugin-path             Print the plugin directory; once a day, fetch a newer release first
  skill [reference]       Print the Dent skill, or one of its references (references/<path>)
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
  --copy-code --start     Start browser copy-code login and save the pending exchange
  --copy-code --code <code>
                          Complete browser copy-code login with a typed code
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
  dent login --no-open
  dent login --copy-code --start
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
    scope: '*:own',
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

function saveCredential(targetName, siteUrl, platformUrl, apiKey, tokenId) {
  const file = updateStoredConfig(next => {
    next.activeTarget = targetName;
    next.targets[targetName] = {
      ...(next.targets[targetName] || {}),
      siteUrl,
      platformUrl,
      apiKey,
      ...(tokenId ? { tokenId } : {}),
      savedAt: new Date().toISOString(),
    };
    return next;
  });
  console.log(`Saved Dent ${targetName} credential for ${siteUrl}`);
  console.log(`Config: ${file}`);
}

async function tokenIdForCredential(platformUrl, apiKey) {
  try {
    const body = await apiRequestWithCredentials({ source: 'login token lookup', targetName: 'login', siteUrl: platformUrl, apiKey }, '/platform/api/v1/tokens');
    const tokens = body.body?.items || body.body?.data || body.body || [];
    const matches = Array.isArray(tokens) ? tokens.filter(token => token.name === 'Dent CLI') : [];
    const newest = matches.sort((left, right) => String(right.createdAt || right.created_at || '').localeCompare(String(left.createdAt || left.created_at || '')))[0];
    if (newest?.id) return newest.id;
  } catch (error) {
    console.log(`Token id unavailable; dent logout will not revoke this token on Dent. Revoke it in Dent if needed: ${error.message}`);
    return null;
  }
  console.log('Token id unavailable; dent logout will not revoke this token on Dent. Revoke it in Dent if needed.');
  return null;
}

async function loginWithToken(options, targetName, siteUrl) {
  const apiKey = options.stdin
    ? (await readStdin()).trim()
    : await askHidden('Personal access token: ');
  if (!apiKey) throw new Error('Personal access token is required.');
  await verifyCredential(siteUrl, apiKey);
  saveCredential(targetName, siteUrl, siteUrl, apiKey);
}

async function oauthLogin(options, targetName, siteUrl) {
  const verifier = createCodeVerifier();
  const state = createState();
  const loopback = await createLoopbackServer(state);
  const server = loopback.server;
  const redirectUri = loopback.redirectUri;

  const request = oauthRequest(redirectUri, state, verifier);
  const authorization = await createCliAuthorization(siteUrl, request);
  const authorizeUrl = authorization.authorizeUrl;

  console.log(`Authorize URL: ${authorizeUrl}`);
  console.log(`Loopback callback: ${redirectUri}`);
  if (openBrowser(authorizeUrl, options)) {
    console.log('Opening Dent in your browser...');
  } else {
    console.log('Open the authorize URL above in your browser.');
  }

  console.log(`Waiting for browser callback on ${redirectUri}`);
  const code = await waitForLoopbackCode(server);
  console.log('Browser callback received.');

  const token = await exchangeCliAuthorization(siteUrl, code, redirectUri, verifier);
  const storedSiteUrl = normalizeBaseUrl(token.siteUrl || siteUrl);
  saveCredential(targetName, storedSiteUrl, siteUrl, token.token, await tokenIdForCredential(siteUrl, token.token));
  try {
    await verifyCredential(storedSiteUrl, token.token);
  } catch (error) {
    console.log(`Saved the credential, but the Site did not answer the catalog read: ${error.message}. Run dent whoami to retry.`);
    return;
  }
  console.log('Dent login complete.');
}

async function startCopyCodeLogin(targetName, siteUrl) {
  const verifier = createCodeVerifier();
  const state = createState();
  const redirectUri = new URL('/platform/cli/code', siteUrl).toString();
  const authorization = await createCliAuthorization(siteUrl, oauthRequest(redirectUri, state, verifier));
  updateStoredConfig(config => {
    config.pendingLogin = { verifier, redirectUri, siteUrl, platformUrl: siteUrl, targetName, startedAt: new Date().toISOString() };
    return config;
  });
  console.log(`Authorize URL: ${authorization.authorizeUrl}`);
  console.log('Open this link, click Authorize, then read me the code on the page. It cannot be copied, so type it. It works once and for five minutes.');
}

async function completeCopyCodeLogin(options, targetName, siteUrl) {
  const config = readStoredConfig() || createEmptyConfig();
  const pending = config.pendingLogin;
  if (!pending) throw new Error('No pending copy-code login. Run `dent login --copy-code --start` first.');
  if (Date.now() - new Date(pending.startedAt).getTime() > 300000) throw new Error('The pending copy-code login expired after 300 seconds. Run `dent login --copy-code --start` again.');
  const code = options['stdin-code'] ? (await readStdin()).trim() : options.code ? String(options.code).trim() : await askLine('Type the authorization code from Dent: ');
  if (!code) throw new Error('Authorization code is required.');
  const platformUrl = pending.platformUrl || pending.siteUrl;
  const token = await exchangeCliAuthorization(platformUrl, code, pending.redirectUri, pending.verifier);
  const storedSiteUrl = normalizeBaseUrl(token.siteUrl || platformUrl);
  const tokenId = await tokenIdForCredential(platformUrl, token.token);
  saveCredential(pending.targetName || targetName, storedSiteUrl, platformUrl, token.token, tokenId);
  updateStoredConfig(next => { delete next.pendingLogin; return next; });
  try {
    await verifyCredential(storedSiteUrl, token.token);
  } catch (error) {
    console.log(`Saved the credential, but the Site did not answer the catalog read: ${error.message}. Run dent whoami to retry.`);
    return;
  }
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
  if (options['copy-code'] && options.start) return startCopyCodeLogin(targetName, siteUrl);
  if (options['copy-code']) return completeCopyCodeLogin(options, targetName, siteUrl);
  return oauthLogin(options, targetName, siteUrl);
}

async function logout() {
  const file = configFilePath();
  const config = readStoredConfig();
  const targetName = activeTargetName(config);
  const credential = config?.targets?.[targetName];
  if (credential) {
    let revokeError;
    if (credential.tokenId) {
      try {
        await apiRequestWithCredentials({ source: 'stored config', targetName, siteUrl: credential.platformUrl || credential.siteUrl, apiKey: credential.apiKey }, `/platform/api/v1/tokens/${credential.tokenId}`, { method: 'DELETE' });
      } catch (error) {
        revokeError = error;
      }
    }
    delete config.targets[targetName];
    writeStoredConfig(config);
    console.log(`Removed Dent ${targetName} credential from ${file}`);
    if (!credential.tokenId) console.log('Stored credential has no token id; revoke it in Dent if needed.');
    if (revokeError) console.log(`Could not revoke Dent token ${credential.tokenId}; revoke it in Dent. ${revokeError.message}`);
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

function accountSummary(body) {
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
    const call = resolveApiCall(catalog, ['account', 'details'], false);
    const result = await apiRequest(`/api/v1/${call.pathSegments.map(encodeSegment).join('/')}`, { method: methodForAction(call.action) });
    console.log(`Account:     ${accountSummary(result.body)}`);
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
  console.log(`Authenticated with ${result.credentialSource} (${credentials.targetName} target) on ${credentials.siteUrl}.`);
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
  return catalog.entities || catalog.catalog || catalog || {};
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
  const entity = catalogEntity(catalog, segments[0]);
  if (!entity) throw new Error(`Entity not found in schema catalog: ${segments[0]}`);
  const pathSegments = [routeSegmentForEntity(entity, segments[0])];
  let current = entity;
  let index = 1;
  if (index === segments.length) {
    if (!hasData && (catalog.grammar?.singletons || ['settings', 'dent', 'account']).includes(current.entity)) {
      const get = actionByNameAndTarget(current, 'get', 'collection') || actionByName(current, 'get');
      if (get) return apiCall(get, [...pathSegments, 'get']);
    }
    return apiCall(actionForCrud(current, hasData ? 'create' : 'list'), pathSegments);
  }
  while (index < segments.length) {
    const segment = segments[index];
    const collectionAction = actionByNameAndTarget(current, segment, 'collection');
    if (collectionAction && index === segments.length - 1) return apiCall(collectionAction, isCrudAction(collectionAction) ? pathSegments : [...pathSegments, segment]);
    if (!isNumericSegment(segment)) throw new Error(`Schema catalog cannot resolve an action for: ${segments.join(' ')}`);
    pathSegments.push(segment);
    index += 1;
    if (index === segments.length) return apiCall(actionForCrud(current, hasData ? 'update' : 'get'), pathSegments);
    const child = catalogEntity(catalog, segments[index]);
    if (child && catalog.grammar?.nested?.[child.entity] === current.entity) {
      pathSegments.push(routeSegmentForEntity(child, segments[index]));
      current = child;
      index += 1;
      if (index === segments.length) return apiCall(actionForCrud(current, hasData ? 'create' : 'list'), pathSegments);
      continue;
    }
    const memberAction = actionByNameAndTarget(current, segments[index], 'member');
    if (memberAction && index === segments.length - 1) return apiCall(memberAction, isCrudAction(memberAction) ? pathSegments : [...pathSegments, segments[index]]);
    throw new Error(`Schema catalog cannot resolve an action for: ${segments.join(' ')}`);
  }
}

async function resolveApiRequest(positionals, options, data) {
  const segments = positionals.flatMap(value => String(value).split('/').filter(Boolean));
  const params = parseParams(options);
  if (options.method) {
    return { method: String(options.method).toUpperCase(), pathSegments: segments, params, action: null };
  }

  const catalog = await loadSchemaCatalog();
  const call = resolveApiCall(catalog, segments, data !== undefined);
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

function bundleSkillPath() {
  return join(packageRoot, 'skills', skillName);
}

function servedSkillPath() {
  return join(packageRoot, 'dist', 'providers', providers.find(provider => provider.mode === 'cli').name, skillName);
}

function ensureBuilt() {
  if (existsSync(join(servedSkillPath(), 'SKILL.md')) && existsSync(join(bundleSkillPath(), 'SKILL.md'))) return;
  throw new Error('Compiled skill bundle is missing. Run `npm run build`.');
}

function skill(positionals) {
  ensureBuilt();
  const bundle = servedSkillPath();
  const name = positionals[0];
  if (!name) {
    const body = readFileSync(join(bundle, 'SKILL.md'), 'utf8').replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n\s*/, '');
    process.stdout.write(`Dent skill v${readPackage().version}, served by the dent CLI. A reference named below is printed by \`dent skill references/<path>\`.\n\n${body}`);
    return;
  }
  const file = resolve(bundle, name);
  if (!file.startsWith(`${bundle}/`) || !statSync(file, { throwIfNoEntry: false })?.isFile()) {
    const available = listFiles(bundle).filter(path => path.startsWith('references/'));
    throw new Error(`Unknown skill reference: ${name}. Available:\n${available.join('\n')}`);
  }
  process.stdout.write(readFileSync(file, 'utf8'));
}

function listFiles(root) {
  if (!existsSync(root)) return [];
  const files = [];
  function walk(dir) {
    for (const entry of readdirSync(dir)) {
      const absolute = join(dir, entry);
      const info = lstatSync(absolute);
      if (info.isSymbolicLink()) continue;
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
  const frontmatter = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
  if (frontmatter === undefined) return null;
  const lines = frontmatter.split(/\r?\n/);
  const value = line => line.replace(/\s+#.*$/, '').match(/:\s*['"]?([^'"\n]+)['"]?\s*$/)?.[1].trim() || null;
  const metadata = lines.findIndex(line => /^metadata:\s*$/.test(line));
  if (metadata !== -1) {
    for (const line of lines.slice(metadata + 1)) {
      if (/^\S/.test(line)) break;
      if (/^\s+version:/.test(line)) return value(line);
    }
  }
  return value(lines.find(line => /^version:/.test(line)) || '');
}

function copySkill(target, force = false) {
  const source = bundleSkillPath();
  if (!existsSync(source)) throw new Error('No compiled skill pointer. Run npm run build.');
  let destination = installedSkillPath(target);
  if (!force && installedState(source, destination).status === 'current') {
    return { status: 'current', destination };
  }
  mkdirSync(dirname(destination), { recursive: true });
  // Symlink-managed installs (stow, dotfiles) own the link; write into its target so the link survives.
  if (lstatSync(destination, { throwIfNoEntry: false })?.isSymbolicLink() && existsSync(destination)) {
    destination = realpathSync(destination);
  }
  syncTree(source, destination);
  return { status: 'written', destination };
}

function syncTree(source, destination) {
  mkdirSync(destination, { recursive: true });
  const sourceFiles = listFiles(source);
  const destinationFiles = new Set(listFiles(destination));
  for (const file of sourceFiles) {
    const from = join(source, file);
    const to = join(destination, file);
    let parent = destination;
    let linked = false;
    for (const part of file.split('/')) {
      parent = join(parent, part);
      if (lstatSync(parent, { throwIfNoEntry: false })?.isSymbolicLink()) linked = true;
    }
    if (linked) {
      console.log(`Skipped symlinked destination entry: ${to}`);
      destinationFiles.delete(file);
      continue;
    }
    mkdirSync(dirname(to), { recursive: true });
    const mode = statSync(from).mode & 0o777;
    if (!existsSync(to) || hashFile(from) !== hashFile(to) || (statSync(to).mode & 0o777) !== mode) {
      const temporary = `${to}.tmp`;
      writeFileSync(temporary, readFileSync(from), { mode });
      chmodSync(temporary, mode);
      renameSync(temporary, to);
    }
    destinationFiles.delete(file);
  }
  for (const file of destinationFiles) {
    const path = join(destination, file);
    if (lstatSync(path, { throwIfNoEntry: false })?.isSymbolicLink()) {
      console.log(`Skipped symlinked destination entry: ${path}`);
      continue;
    }
    unlinkSync(path);
  }
  const directories = new Set([...destinationFiles].flatMap(file => {
    const paths = [];
    let directory = dirname(join(destination, file));
    while (directory !== destination) {
      paths.push(directory);
      directory = dirname(directory);
    }
    return paths;
  }));
  for (const directory of [...directories].sort((left, right) => right.length - left.length)) {
    if (readdirSync(directory).length === 0) rmSync(directory);
  }
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

function findInstalledSkills(projectRoot, pluginRoot) {
  const found = new Map();
  function addInstalledSkill(item) {
    const realpath = realpathSync(item.skillPath);
    const installed = found.get(realpath);
    if (installed) {
      if (installed.owner !== 'copy' && item.owner === 'copy') return;
      installed.labels.push(item.label);
      installed.owners = new Set([...(installed.owners || [installed.owner]), ...(item.owner === 'copy' ? [] : [item.owner])]);
      if (installed.owner === 'copy' && item.owner !== 'copy') {
        installed.owner = item.owner;
        installed.labels = [item.label];
        installed.label = item.label;
        installed.global = item.global;
      }
      return;
    }
    found.set(realpath, { ...item, realpath, labels: [item.label], owners: new Set(item.owner === 'copy' ? [] : [item.owner]) });
  }
  if (pluginRoot) {
    const skillPath = join(resolve(pluginRoot), 'skills', skillName);
    if (existsSync(join(skillPath, 'SKILL.md'))) addInstalledSkill({ label: 'claude plugin', skillPath, version: readInstalledVersion(skillPath), owner: 'claude-plugin' });
  }
  const installedPlugins = join(homedir(), '.claude', 'plugins', 'installed_plugins.json');
  if (existsSync(installedPlugins)) {
    const plugins = JSON.parse(readFileSync(installedPlugins, 'utf8')).plugins;
    for (const [name, installations] of Object.entries(plugins)) {
      if (name.startsWith(`${pluginName}@`)) {
        for (const plugin of installations) {
          const skillPath = join(plugin.installPath, 'skills', skillName);
          if (existsSync(join(skillPath, 'SKILL.md'))) {
            addInstalledSkill({ label: 'claude plugin', skillPath, version: readInstalledVersion(skillPath), owner: 'claude-plugin' });
          }
        }
      }
    }
  }
  const codexCache = join(homedir(), '.codex', 'plugins', 'cache');
  if (existsSync(codexCache)) {
    for (const marketplace of readdirSync(codexCache)) {
      const marketplacePath = join(codexCache, marketplace, pluginName);
      if (!statSync(marketplacePath, { throwIfNoEntry: false })?.isDirectory()) continue;
      for (const version of readdirSync(marketplacePath)) {
        const skillPath = join(marketplacePath, version, 'skills', skillName);
        if (existsSync(join(skillPath, 'SKILL.md'))) addInstalledSkill({ label: 'codex plugin', skillPath, version: readInstalledVersion(skillPath), owner: 'codex-plugin' });
      }
    }
  }
  const skillLocks = [
    { path: process.env.XDG_STATE_HOME ? join(process.env.XDG_STATE_HOME, 'skills', '.skill-lock.json') : join(homedir(), '.agents', '.skill-lock.json'), root: homedir(), global: true },
    { path: join(projectRoot, 'skills-lock.json'), root: projectRoot, global: false },
  ].flatMap(lock => {
    if (!existsSync(lock.path)) return [];
    const entry = JSON.parse(readFileSync(lock.path, 'utf8')).skills?.[skillName];
    return entry ? [{ ...lock, entry }] : [];
  });
  const roots = [projectRoot, homedir()];
  for (const root of roots) {
    for (const key of harnessOrder) {
      const provider = providerFromValue(key);
      const skillPath = join(root, provider.harnessDir, 'skills', skillName);
      if (existsSync(join(skillPath, 'SKILL.md'))) {
        const lock = skillLocks.find(item => item.root === root && (!item.global || root !== projectRoot || provider.harnessDir === '.agents'));
        addInstalledSkill({ ...provider, key, root, skillPath, version: readInstalledVersion(skillPath), label: lock ? 'skills CLI' : provider.label, owner: lock ? 'skills-cli' : 'copy', global: lock?.global });
      }
    }
  }
  return [...found.values()];
}

function compareVersions(left, right) {
  const parts = value => String(value).split('.').map(part => Number(part.replace(/\D.*$/, '')) || 0);
  const a = parts(left);
  const b = parts(right);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) if ((a[index] || 0) !== (b[index] || 0)) return (a[index] || 0) - (b[index] || 0);
  return 0;
}

async function registryVersion() {
  const url = process.env.DENT_REGISTRY_URL || 'https://registry.npmjs.org/@getdent%2Fskill/latest';
  const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const body = await response.json();
  if (!body.version) throw new Error('Registry response has no version.');
  return body.version;
}

async function check(options) {
  ensureBuilt();
  const projectRoot = findProjectRoot(options.dir || process.cwd());
  const installed = options.target
    ? [{ ...providerFromValue(options.provider || 'claude-code'), skillPath: join(resolve(options.target), 'skills', skillName), label: providerFromValue(options.provider || 'claude-code').label, owner: 'copy', version: readInstalledVersion(join(resolve(options.target), 'skills', skillName)), realpath: resolve(join(resolve(options.target), 'skills', skillName)), labels: [providerFromValue(options.provider || 'claude-code').label], owners: new Set() }].filter(item => existsSync(join(item.skillPath, 'SKILL.md')))
    : findInstalledSkills(projectRoot, options['plugin-root']);
  let publishedVersion;
  try {
    publishedVersion = await registryVersion();
  } catch {
    console.log('Registry unreachable; compared against the local package only.');
    process.exitCode = 2;
  }
  const packageVersion = readPackage().version;
  if (publishedVersion && compareVersions(packageVersion, publishedVersion) < 0) console.log(`Dent CLI v${packageVersion} is behind v${publishedVersion}. Run: npm install -g @getdent/skill@latest`);
  if (installed.length === 0) {
    if (!options.quiet) console.log('Dent skill is not installed. Run `dent install`.');
    return;
  }
  for (const item of installed) {
    const state = item.owner === 'copy'
      ? installedState(bundleSkillPath(), item.skillPath)
      : { status: compareVersions(item.version || '0.0.0', publishedVersion || readPackage().version) < 0 ? 'stale' : 'current', source: 'manifest', manifest: readSkillManifest(item.skillPath) };
    const expectedVersion = item.owner !== 'copy' ? (publishedVersion || readPackage().version) : (readSkillManifest(bundleSkillPath())?.version || readPackage().version);
    if (!options.quiet) console.log(`Found ${item.labels.join(', ')}: ${item.skillPath} (installed v${item.version || 'unknown'})`);
    if (state.status !== 'current') {
      const installedVersion = state.manifest?.version || item.version || 'unknown';
      const newerVersion = publishedVersion && compareVersions(publishedVersion, expectedVersion) > 0 ? publishedVersion : expectedVersion;
      const reason = compareVersions(installedVersion, newerVersion) < 0 ? `v${installedVersion} is behind v${newerVersion}` : `v${installedVersion} differs from the package v${newerVersion} files`;
      console.log(`Dent skill (${item.labels.join(', ')} at ${item.realpath}) ${reason}. Run: ${updateCommandFor(item.owner, item.global)}`);
      for (const owner of [...(item.owners || [])].filter(owner => owner !== item.owner)) {
        console.log(`Run: ${updateCommandFor(owner, item.global)}`);
      }
    } else {
      if (!options.quiet) console.log(`Dent skill is up to date by ${state.source} (v${item.version}).`);
    }
  }
}

async function update(options) {
  const installed = findInstalledSkills(findProjectRoot(options.dir || process.cwd()), options['plugin-root']);
  const copied = installed.filter(item => item.owner === 'copy');
  const owners = [...new Set(installed.flatMap(item => [...(item.owners || [item.owner])]).filter(owner => owner !== 'copy'))];
  let publishedVersion;
  try {
    publishedVersion = await registryVersion();
  } catch {
    console.log('Registry unreachable; compared against the local package only.');
  }
  const cliBehind = Boolean(publishedVersion) && compareVersions(readPackage().version, publishedVersion) < 0;
  if (cliBehind && !options['skip-upgrade']) {
    if (packageRoot.includes('_npx')) {
      const args = ['--yes', '--prefer-online', '@getdent/skill@latest', 'update', '--skip-upgrade'];
      for (const name of ['plugin-root', 'dir', 'target', 'provider', 'scope']) if (options[name]) args.push(`--${name}`, options[name]);
      if (options.force) args.push('--force');
      const rerun = spawnSync('npx', args, { stdio: 'inherit', timeout: 120000 });
      if (rerun.error) {
        console.log(`Run: npx ${args.join(' ')}`);
        return;
      }
      if (rerun.status !== 0) process.exitCode = rerun.status || 1;
      return;
    } else {
      const installedPackage = spawnSync('npm', ['install', '-g', '@getdent/skill@latest'], { stdio: 'inherit', timeout: 300000 });
      if (installedPackage.error) throw new Error(`Could not upgrade the Dent CLI: ${installedPackage.error.message}`);
      if (installedPackage.status !== 0) throw new Error('Could not upgrade the Dent CLI.');
      const args = ['update', '--skip-upgrade'];
      for (const name of ['plugin-root', 'dir', 'target', 'provider', 'scope']) {
        if (options[name]) args.push(`--${name}`, options[name]);
      }
      if (options.force) args.push('--force');
      const globalRoot = spawnSync('npm', ['root', '-g'], { encoding: 'utf8', timeout: 30000 });
      if (globalRoot.error || globalRoot.status !== 0) throw new Error('Could not resolve the upgraded Dent CLI.');
      if (!globalRoot.stdout.trim()) return;
      const rerun = spawnSync(process.execPath, [join(globalRoot.stdout.trim(), '@getdent', 'skill', 'cli', 'bin', 'dent.js'), ...args], { stdio: 'inherit', timeout: 120000 });
      if (rerun.error) throw new Error(`Could not run dent to refresh the Dent skill: ${rerun.error.message}`);
      if (rerun.status !== 0) throw new Error('Could not update the Dent skill after upgrading the CLI.');
      return;
    }
  }
  if (installed.length === 0) {
    await installOrUpdate('update', options);
  } else {
    for (const item of copied) {
      const target = { ...item, harnessPath: dirname(dirname(item.skillPath)) };
      const result = copySkill(target, true);
      const version = readInstalledVersion(result.destination) || readPackage().version;
      const action = result.status === 'written' ? 'Installed' : 'Dent skill is up to date';
      console.log(`${action} for ${target.label} at ${result.destination} (v${version}).`);
    }
  }
  for (const owner of owners) console.log(`Run: ${updateCommandFor(owner, installed.find(item => (item.owners || new Set()).has(owner))?.global)}`);
}

async function pluginPath(options) {
  const stamp = join(resolveConfigDir(), 'plugin-refresh');
  const checkedAt = statSync(stamp, { throwIfNoEntry: false })?.mtimeMs || 0;
  const dayOld = Date.now() - checkedAt > 24 * 60 * 60 * 1000;
  if (dayOld && !options.fresh) {
    let publishedVersion;
    try {
      publishedVersion = await registryVersion();
    } catch {
      publishedVersion = undefined;
    }
    if (publishedVersion) {
      mkdirSync(dirname(stamp), { recursive: true, mode: 0o700 });
      writeFileSync(stamp, `${publishedVersion}\n`);
      if (compareVersions(readPackage().version, publishedVersion) < 0) {
        const rerun = spawnSync('npx', ['--yes', '--prefer-online', '@getdent/skill@latest', 'plugin-path', '--fresh'], { encoding: 'utf8', timeout: 55000 });
        if (!rerun.error && rerun.status === 0 && rerun.stdout.trim()) return console.log(rerun.stdout.trim());
      }
    }
  }
  console.log(packageRoot);
}

function updateCommandFor(owner, global) {
  if (owner === 'claude-plugin') return `/plugin update ${pluginName}@${marketplaceName}`;
  if (owner === 'codex-plugin') return 'codex plugin marketplace upgrade';
  if (owner === 'skills-cli') return global ? 'npx skills update dent -g' : 'npx skills update dent';
  return 'dent update';
}

async function main() {
  const [command = 'help', ...rest] = process.argv.slice(2);
  const { positionals, options } = parseArgs(rest);
  if (command === 'help' || command === '--help' || command === '-h') return printHelp();
  if (command === '--version' || command === '-v') return console.log(readPackage().version);
  if (command === 'plugin-path') return pluginPath(options);
  if (command === 'skill') return skill(positionals);
  if (command === 'install') return installOrUpdate('install', options);
  if (command === 'update') return update(options);
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

if (process.argv[1] && existsSync(process.argv[1]) && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  main().catch(error => {
    console.error(error?.message || error);
    process.exit(1);
  });
}

export { loadCredentials, apiRequestWithCredentials };

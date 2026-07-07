#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, chmodSync, cpSync, renameSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { dirname, join, resolve, relative } from 'node:path';
import { emitKeypressEvents } from 'node:readline';
import { fileURLToPath } from 'node:url';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const skillName = 'dent';
const packageName = 'dent-cli';
const defaultPlatformUrl = 'https://ondent.app';

const providerDefinitions = {
  'claude-code': { harnessDir: '.claude', bundle: 'claude-code', label: 'Claude Code' },
  claude: { harnessDir: '.claude', bundle: 'claude-code', label: 'Claude Code' },
  codex: { harnessDir: '.agents', bundle: 'codex', label: 'Codex / Agents' },
  agents: { harnessDir: '.agents', bundle: 'codex', label: 'Codex / Agents' },
  cursor: { harnessDir: '.cursor', bundle: 'claude-code', label: 'Cursor' },
};

const harnessOrder = ['claude-code', 'codex', 'cursor'];

function readPackage() {
  return JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'));
}

function printHelp() {
  const version = readPackage().version;
  console.log(`Dent CLI v${version}

Usage:
  dent <command> [options]

Commands:
  install                 Install the Dent skill into Claude Code, Codex, Agents, or Cursor
  update                  Refresh installed Dent skill files from this package
  check                   Check installed skill version and print update guidance
  login                   Open browser authorization and store a Dent API credential
  logout                  Revoke and remove the stored Dent credential
  whoami                  Fetch /api/v1/schema/ to prove the current credential works
  schema [entity]         Fetch and pretty-print the schema catalog or one entity
  api <entity> [id] [action]
                          Call generic Dent API routes and print JSON
  help                    Show this help

Install options:
  --dir <path>            Project root to inspect for .claude, .agents, .cursor
  --provider <name>       claude-code, codex, or cursor
  --scope <project|global>
  --target <path>         Custom harness folder that contains or should contain skills/
  --yes                   Do not prompt; use detected defaults
  --force                 Recopy even when already current

Login options:
  --site-url <url>        Dent platform or tenant URL (defaults to ${defaultPlatformUrl})
  --platform-url <url>    Dent platform URL for revoking stdin/token-prompt credentials
  --token-prompt          Prompt for a personal access token instead of opening the browser
  --stdin                 Read the token from standard input; never from argv

API options:
  --data <json|@file>     Request body. File form reads JSON from disk
  --method <verb>         Explicitly override the catalog-resolved HTTP method

Environment:
  DENT_API_KEY and DENT_SITE_URL each override the matching stored config field.
  DENT_PLATFORM_URL supplies the Platform host used for login/logout revocation.
  DENT_CONFIG_DIR overrides the config directory for tests and automation.

Examples:
  dent install
  dent login
  dent login --site-url https://example.com --stdin
  dent whoami
  dent schema orders
  dent api contacts
  dent api contacts 123
  dent api contacts --data '{"email":"person@example.com"}'
  dent api contacts 123 enroll --data @payload.json
  dent api courses 9203 sections`);
}

function parseArgs(argv) {
  const positionals = [];
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) {
      positionals.push(arg);
      continue;
    }
    const equalsIndex = arg.indexOf('=');
    if (equalsIndex !== -1) {
      options[arg.slice(2, equalsIndex)] = arg.slice(equalsIndex + 1);
      continue;
    }
    const name = arg.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith('--')) {
      options[name] = next;
      index += 1;
    } else {
      options[name] = true;
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
  if (!stored.siteUrl || !stored.apiKey) return null;
  return stored;
}

function readStoredSiteUrl() {
  const file = configFilePath();
  if (!existsSync(file)) return '';
  const stored = JSON.parse(readFileSync(file, 'utf8'));
  return stored.siteUrl || '';
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

function loadCredentials() {
  const envHasApiKey = process.env.DENT_API_KEY !== undefined && process.env.DENT_API_KEY !== '';
  const envHasSiteUrl = process.env.DENT_SITE_URL !== undefined && process.env.DENT_SITE_URL !== '';
  const stored = readStoredConfig();
  const siteUrl = envHasSiteUrl ? process.env.DENT_SITE_URL : stored?.siteUrl;
  const apiKey = envHasApiKey ? process.env.DENT_API_KEY : stored?.apiKey;
  if (!siteUrl || !apiKey) {
    if (!siteUrl && !apiKey) throw new Error('Not logged in. Run `dent login` or set DENT_API_KEY and DENT_SITE_URL.');
    if (!siteUrl) throw new Error('Dent site URL is missing. Run `dent login` or set DENT_SITE_URL.');
    throw new Error('Dent API key is missing. Run `dent login` or set DENT_API_KEY.');
  }
  const source = envHasApiKey && envHasSiteUrl
    ? 'environment'
    : envHasApiKey || envHasSiteUrl
      ? 'environment + stored config'
      : 'stored config';
  return {
    source,
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

async function apiRequest(pathname, { method = 'GET', data, catalog = false } = {}) {
  const credentials = loadCredentials();
  const prefix = catalog ? '' : '';
  const url = new URL(`${prefix}${pathname}`, credentials.siteUrl);
  const headers = {
    Accept: 'application/json',
    Authorization: `Bearer ${credentials.apiKey}`,
  };
  let body;
  if (data !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(data);
  }
  const response = await dentFetch(url, { method, headers, body });
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

function openBrowser(url) {
  const opener = platform() === 'darwin'
    ? { command: 'open', args: [url] }
    : platform() === 'win32'
      ? { command: 'cmd', args: ['/c', 'start', '', url] }
      : { command: 'xdg-open', args: [url] };

  const child = spawn(opener.command, opener.args, {
    detached: true,
    stdio: 'ignore',
  });
  child.on('error', () => {
    console.log(`Open this URL in your browser: ${url}`);
  });
  child.unref();
}

function sleep(ms) {
  return new Promise(resolveSleep => setTimeout(resolveSleep, ms));
}

async function publicPlatformRequest(siteUrl, pathname, { method = 'GET' } = {}) {
  const url = new URL(pathname, siteUrl);
  const response = await dentFetch(url, {
    method,
    headers: { Accept: 'application/json' },
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

async function bearerPlatformRequest(siteUrl, pathname, apiKey) {
  const url = new URL(pathname, siteUrl);
  const response = await dentFetch(url, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
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
    throw new Error(`GET ${url.pathname} failed with HTTP ${response.status}${detail ? `: ${detail}` : ''}`);
  }
  return body;
}

async function deleteBearerPlatformResource(siteUrl, pathname, apiKey) {
  const url = new URL(pathname, siteUrl);
  const response = await dentFetch(url, {
    method: 'DELETE',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
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
    throw new Error(`DELETE ${url.pathname} failed with HTTP ${response.status}${detail ? `: ${detail}` : ''}`);
  }
  return body;
}

async function createCliAuthorization(siteUrl) {
  return publicPlatformRequest(siteUrl, '/platform/api/v1/cli-authorizations', { method: 'POST' });
}

async function pollCliAuthorization(siteUrl, code, intervalSeconds) {
  const deadline = Date.now() + 6 * 60 * 1000;
  while (Date.now() < deadline) {
    const url = new URL(`/platform/api/v1/cli-authorizations/${encodeURIComponent(code)}`, siteUrl);
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    const text = await response.text();
    const result = text ? JSON.parse(text) : {};
    if (response.status === 410) {
      throw new Error('authorization expired');
    }
    if (!response.ok) {
      throw new Error(`GET ${url.pathname} failed with HTTP ${response.status}: ${text}`);
    }
    if (result.status === 'authorized') {
      if (!result.token) throw new Error('Authorization completed without a token.');
      return {
        token: result.token,
        siteUrl: result.siteUrl || '',
      };
    }
    if (result.status === 'declined') {
      throw new Error('authorization declined');
    }
    await sleep(Math.max(1, intervalSeconds || 2) * 1000);
  }
  throw new Error('Timed out waiting for browser authorization.');
}

async function browserLogin(siteUrl) {
  const authorization = await createCliAuthorization(siteUrl);
  const authorizeUrl = authorization.authorizeUrl;
  if (!authorization.code || !authorizeUrl || !authorization.userCode) {
    throw new Error('Dent did not return a CLI authorization code.');
  }

  console.log(`Opening browser for Dent authorization at ${siteUrl}`);
  console.log(`Verify this code in your browser: ${authorization.userCode}`);
  console.log(`If the browser does not open, visit: ${authorizeUrl}`);
  openBrowser(authorizeUrl);

  const result = await pollCliAuthorization(siteUrl, authorization.code, authorization.interval);
  return { ...result, platformUrl: siteUrl };
}

async function loadTenants(siteUrl, apiKey) {
  const data = await bearerPlatformRequest(siteUrl, '/platform/api/v1/cli/tenants', apiKey);
  return Array.isArray(data.items) ? data.items : [];
}

async function chooseTenant(tenants) {
  if (tenants.length === 0) {
    throw new Error('No Dent sites are available for this account.');
  }
  if (tenants.length === 1) return tenants[0];
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error('This account has multiple Dent sites. Run `dent login` in a terminal to choose one.');
  }

  console.log('Choose a Dent site:');
  tenants.forEach((tenant, index) => {
    console.log(`  ${index + 1}. ${tenant.name || tenant.slug || tenant.url} (${tenant.url})`);
  });

  while (true) {
    const answer = await askLine('Site number: ');
    const index = Number(answer) - 1;
    if (Number.isInteger(index) && tenants[index]) return tenants[index];
    console.log(`Enter a number from 1 to ${tenants.length}.`);
  }
}

async function login(options) {
  const credentialEntry = options.stdin || options['token-prompt'];
  const siteUrlInput = options['site-url'] || process.env.DENT_SITE_URL || (credentialEntry ? readStoredSiteUrl() : '') || defaultPlatformUrl;
  const siteUrl = normalizeBaseUrl(siteUrlInput);
  let apiKey;
  let savedSiteUrl = siteUrl;
  let savedPlatformUrl = normalizeBaseUrl(options['platform-url'] || process.env.DENT_PLATFORM_URL || siteUrl);
  if (options.stdin) {
    apiKey = (await readStdin()).trim();
  } else if (options['token-prompt']) {
    apiKey = await askHidden('Personal access token: ');
  } else {
    const authorization = await browserLogin(siteUrl);
    apiKey = authorization.token;
    savedPlatformUrl = normalizeBaseUrl(authorization.platformUrl);
    if (authorization.siteUrl) {
      savedSiteUrl = normalizeBaseUrl(authorization.siteUrl);
    } else {
      const tenant = await chooseTenant(await loadTenants(siteUrl, apiKey));
      savedSiteUrl = normalizeBaseUrl(tenant.url);
    }
  }
  if (!apiKey) throw new Error('Personal access token is required.');
  const file = writeStoredConfig({ siteUrl: savedSiteUrl, platformUrl: savedPlatformUrl, apiKey, savedAt: new Date().toISOString() });
  console.log(`Saved Dent credential for ${savedSiteUrl}`);
  console.log(`Config: ${file}`);
}

function tokenIdFromApiKey(apiKey) {
  const [id] = String(apiKey || '').split('|', 1);
  if (!/^\d+$/.test(id)) return null;
  return id;
}

async function revokeStoredCredential(config) {
  const tokenId = tokenIdFromApiKey(config.apiKey);
  if (!tokenId) {
    throw new Error('stored token does not include a revocable token id');
  }

  await deleteBearerPlatformResource(
    normalizeBaseUrl(process.env.DENT_PLATFORM_URL || config.platformUrl || config.siteUrl),
    `/platform/api/v1/tokens/${encodeURIComponent(tokenId)}`,
    config.apiKey,
  );
  console.log(`Revoked Dent token ${tokenId} server-side.`);
}

async function logout() {
  const file = configFilePath();
  const config = readStoredConfig();
  if (config) {
    try {
      await revokeStoredCredential(config);
    } catch (error) {
      console.error(`Could not revoke the Dent token server-side: ${error?.message || error}`);
      console.error('Removing the local Dent config anyway.');
    }
  } else {
    console.log('No stored Dent credential found.');
  }
  rmSync(file, { force: true });
  console.log(`Removed Dent config: ${file}`);
}

async function whoami() {
  const result = await apiRequest('/api/v1/schema/');
  const catalog = result.body || {};
  const entities = Array.isArray(catalog.entities)
    ? catalog.entities.length
    : Object.keys(catalog.entities || catalog || {}).length;
  console.log(`Authenticated with ${result.credentialSource}.`);
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

function singularEntityNames(entity) {
  const text = String(entity || '').trim();
  const names = [text];
  const suffixes = [
    { suffix: 'ies', replacement: 'y' },
    { suffix: 'ches', replacement: 'ch' },
    { suffix: 'shes', replacement: 'sh' },
    { suffix: 'sses', replacement: 'ss' },
    { suffix: 'xes', replacement: 'x' },
    { suffix: 'zes', replacement: 'z' },
  ];
  for (const { suffix, replacement } of suffixes) {
    if (text.endsWith(suffix)) names.push(`${text.slice(0, -suffix.length)}${replacement}`);
  }
  if (text.endsWith('s')) names.push(text.slice(0, -1));
  return [...new Set(names.filter(Boolean))];
}

function matchesEntityName(item, names) {
  return names.includes(item?.name) || names.includes(item?.key) || names.includes(item?.entity);
}

function resolveCatalogEntity(entities, entity) {
  const names = singularEntityNames(entity);
  if (Array.isArray(entities)) return entities.find(item => matchesEntityName(item, names));
  for (const name of names) {
    if (entities[name]) return entities[name];
  }
  return undefined;
}

function parseData(value) {
  if (value === undefined) return undefined;
  const source = String(value);
  const text = source.startsWith('@') ? readFileSync(source.slice(1), 'utf8') : source;
  return JSON.parse(text);
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

function isNumericSegment(value) {
  return /^\d+$/.test(String(value || ''));
}

function resolveApiCall(catalog, segments, hasData) {
  const [entitySegment, second, third, fourth, fifth] = segments;
  const entity = catalogEntity(catalog, entitySegment);
  if (!entity) throw new Error(`Entity not found in schema catalog: ${entitySegment}`);

  if (segments.length === 1) {
    return apiCall(actionForCrud(entity, hasData ? 'create' : 'list'), segments);
  }

  const collectionAction = actionByNameAndTarget(entity, second, 'collection');
  if (segments.length === 2 && collectionAction) {
    return apiCall(collectionAction, isCrudAction(collectionAction) ? [entitySegment] : segments);
  }

  if (segments.length === 2) {
    return apiCall(actionForCrud(entity, hasData ? 'update' : 'get'), segments);
  }

  const memberAction = actionByNameAndTarget(entity, third, 'member');
  if (segments.length === 3 && memberAction) {
    return apiCall(memberAction, isCrudAction(memberAction) ? [entitySegment, second] : segments);
  }

  const nestedEntity = catalogEntity(catalog, third);
  if (segments.length === 3 && nestedEntity) {
    return apiCall(actionForCrud(nestedEntity, hasData ? 'create' : 'list'), segments);
  }

  if (segments.length === 3 && collectionAction && isNumericSegment(third)) {
    return apiCall(collectionAction, isCrudAction(collectionAction) ? [entitySegment] : segments);
  }

  if (segments.length === 4 && nestedEntity) {
    const nestedCollectionAction = actionByNameAndTarget(nestedEntity, fourth, 'collection');
    if (nestedCollectionAction) {
      return apiCall(nestedCollectionAction, isCrudAction(nestedCollectionAction) ? [entitySegment, second, third] : segments);
    }

    return apiCall(actionForCrud(nestedEntity, hasData ? 'update' : 'get'), segments);
  }

  if (segments.length === 5 && nestedEntity) {
    const nestedAction = actionByNameAndTarget(nestedEntity, fifth, 'member');
    if (nestedAction) {
      return apiCall(nestedAction, isCrudAction(nestedAction) ? [entitySegment, second, third, fourth] : segments);
    }
  }

  throw new Error(`Schema catalog cannot resolve an action for: ${segments.join(' ')}`);
}

async function resolveApiRequest(positionals, options, data) {
  if (options.method) {
    return { method: String(options.method).toUpperCase(), pathSegments: positionals };
  }

  const catalog = await loadSchemaCatalog();
  const call = resolveApiCall(catalog, positionals, data !== undefined);
  return { method: methodForAction(call.action), pathSegments: call.pathSegments };
}

async function api(positionals, options) {
  if (positionals.length === 0) throw new Error('Usage: dent api <entity> [id] [action] [--data JSON|@file] [--method VERB]');
  const data = parseData(options.data);
  const request = await resolveApiRequest(positionals, options, data);
  const path = `/api/v1/${request.pathSegments.map(encodeSegment).join('/')}`;
  const result = await apiRequest(path, { method: request.method, data });
  printJson(result.body);
}

function providerFromValue(value) {
  const key = String(value || '').trim().toLowerCase();
  const provider = providerDefinitions[key];
  if (!provider) throw new Error(`Unknown provider: ${value}. Use claude-code, codex, or cursor.`);
  return { key, ...provider };
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
  return join(packageRoot, 'dist', 'providers', provider.bundle, skillName);
}

function ensureBuilt() {
  const expected = join(packageRoot, 'dist', 'providers', 'claude-code', skillName, 'SKILL.md');
  if (existsSync(expected)) return;
  const buildScript = join(packageRoot, 'scripts', 'build.js');
  if (!existsSync(buildScript)) throw new Error('Compiled skill bundle is missing. Run `npm run build`.');
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
  if (!existsSync(source)) throw new Error(`No compiled skill bundle for ${target.bundle}. Run npm run build.`);
  const destination = installedSkillPath(target);
  if (!force && existsSync(destination) && sameTree(source, destination)) {
    return { status: 'current', destination };
  }
  mkdirSync(dirname(destination), { recursive: true });
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

function compareVersions(left, right) {
  const a = String(left || '0').split(/[.-]/).map(part => Number.parseInt(part, 10) || 0);
  const b = String(right || '0').split(/[.-]/).map(part => Number.parseInt(part, 10) || 0);
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    if ((a[index] || 0) > (b[index] || 0)) return 1;
    if ((a[index] || 0) < (b[index] || 0)) return -1;
  }
  return 0;
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
  const projectRoot = findProjectRoot(options.dir || process.cwd());
  const installed = findInstalledSkills(projectRoot);
  if (installed.length === 0) {
    console.log('Dent skill is not installed. Run `dent install`.');
    return;
  }
  const latest = process.env.DENT_LATEST_VERSION || readPackage().version;
  for (const item of installed) {
    console.log(`Found ${item.label}: ${item.skillPath} (installed v${item.version || 'unknown'})`);
    if (!item.version || compareVersions(item.version, latest) < 0) {
      console.log(`Update available: installed v${item.version || 'unknown'}, package v${latest}. Run \`dent update\`.`);
    } else {
      console.log(`Dent skill is up to date (v${item.version}).`);
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
  if (command === 'whoami') return whoami();
  if (command === 'schema') return schema(positionals[0]);
  if (command === 'api') return api(positionals, options);
  throw new Error(`Unknown command: ${command}. Run \`dent help\`.`);
}

main().catch(error => {
  console.error(error?.message || error);
  process.exit(1);
});

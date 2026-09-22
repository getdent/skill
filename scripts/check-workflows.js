#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { walkMarkdownFiles } from './lib/markdown.js';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const crud = new Set(['list', 'get', 'create', 'update', 'delete']);

function normalizePath(value) {
  return String(value).split(/[?#]/)[0].replace(/[),.;:]+$/g, '').replace(/\/$/, '') || '/';
}

function isId(value) {
  return /^\{[^}]+\}$/.test(value) || /^<[^>]+>$/.test(value) || /^\d+$/.test(value) || /^[A-Za-z][A-Za-z0-9]*Id$/.test(value);
}

function actionMethod(action) {
  return { read: 'GET', write: 'POST', destroy: 'DELETE', remote: 'POST' }[action.mode];
}

function loadSnapshot() {
  const path = resolve(
    process.env.DENT_WORKFLOW_SCHEMA_CATALOG || join(rootDir, 'scripts', 'schema-catalog.snapshot.json'),
  );
  const snapshot = JSON.parse(readFileSync(path, 'utf8'));
  if (!snapshot.grammar) throw new Error(`Schema catalog ${path} has no grammar.`);
  return snapshot;
}

function createResolver(catalog) {
  const entities = new Map();
  for (const entity of Object.values(catalog)) {
    for (const name of [entity.entity, entity.route, entity.label]) {
      if (name) entities.set(String(name).toLowerCase(), entity);
    }
  }
  return segment => entities.get(String(segment).toLowerCase())
    || entities.get(String(segment).replace(/s$/, '').toLowerCase());
}

function fail(ref, message) {
  throw new Error(`${ref.file}:${ref.line} ${message}`);
}

function findAction(entity, name, target) {
  return entity.actions.find(action => action.name === name && (target === undefined || action.target === target));
}

function verifyAction(ref, action, method, label) {
  if (!action) fail(ref, `${label} is not in the schema catalog.`);
  if (actionMethod(action) !== method) {
    fail(ref, `${label} resolves to ${actionMethod(action)}, but the workflow documents ${method}.`);
  }
}

function assertNested(ref, child, parent, grammar) {
  if (!Object.hasOwn(grammar.nested, child.entity)) {
    fail(ref, `"${child.entity}" is not a nested entity.`);
  }
  if (grammar.nested[child.entity] !== parent.entity) {
    fail(ref, `answers only under "${parent.route}".`);
  }
}

function crudAction(method) {
  if (method === 'DELETE') return 'delete';
  if (method === 'POST') return 'update';
  return 'get';
}

function resolveRoute(ref, get, routes, grammar) {
  const path = normalizePath(ref.path);
  if (path.startsWith('/api/v1/{')) return;
  if (routes.has(`${ref.method} ${path.replace(/\{[^}]+\}/g, '{}')}`)) return;
  if (path.startsWith('/platform/api/v1/')) {
    fail(ref, `references platform route ${path}, but it is not explicit.`);
  }
  if (!path.startsWith('/api/v1/')) fail(ref, `is not a Dent API route: ${path}`);

  const parts = path.slice(8).split('/');
  const entity = get(parts[0]);
  if (!entity) {
    fail(ref, `references API route ${path}, but no schema entity route matches "${parts[0]}".`);
  }
  const singleton = grammar.singletons.includes(entity.entity);

  if (parts.length === 1) {
    if (singleton) fail(ref, `singleton "${entity.entity}" has no bare route.`);
    verifyAction(
      ref,
      findAction(entity, ref.method === 'POST' ? 'create' : 'list'),
      ref.method,
      `Route ${path}`,
    );
    return;
  }
  if (parts.length === 2 && !isId(parts[1])) {
    verifyAction(
      ref,
      findAction(entity, parts[1], singleton ? undefined : 'collection'),
      ref.method,
      `Action ${entity.entity}.${parts[1]}`,
    );
    return;
  }
  if (parts.length === 2) {
    verifyAction(ref, findAction(entity, crudAction(ref.method), 'member'), ref.method, `Route ${path}`);
    return;
  }
  if (!isId(parts[1])) {
    fail(ref, `references API route ${path}, but the schema catalog cannot resolve that route shape.`);
  }
  if (crud.has(parts[2])) {
    fail(ref, `only singletons serve ${parts[2]} this way.`);
  }
  const child = get(parts[2]);
  if (!child) {
    verifyAction(ref, findAction(entity, parts[2], 'member'), ref.method, `Action ${entity.entity}.${parts[2]}`);
    return;
  }
  assertNested(ref, child, entity, grammar);
  if (parts.length === 3) {
    verifyAction(ref, findAction(child, ref.method === 'POST' ? 'create' : 'list'), ref.method, `Nested route ${path}`);
    return;
  }
  if (parts.length === 4) {
    verifyAction(ref, findAction(child, crudAction(ref.method), 'member'), ref.method, `Nested route ${path}`);
    return;
  }
  if (crud.has(parts[4])) fail(ref, `only singletons serve ${parts[4]} this way.`);
  verifyAction(ref, findAction(child, parts[4], 'member'), ref.method, `Action ${child.entity}.${parts[4]}`);
}

function resolveCli(ref, get, grammar) {
  const parts = ref.path.split('/').filter(Boolean);
  const entity = get(parts[0]);
  if (!entity) {
    fail(ref, `references API command ${ref.path}, but no schema entity route matches "${parts[0]}".`);
  }
  const singleton = grammar.singletons.includes(entity.entity);
  if (parts.length === 1 && singleton) {
    fail(ref, `singleton "${entity.entity}" needs an action.`);
  }
  if (parts.length === 1) {
    if (!findAction(entity, 'list', 'collection')) fail(ref, `Action ${entity.entity}.list is not in the schema catalog.`);
    return;
  }
  if (singleton) {
    if (!findAction(entity, parts[1])) fail(ref, `Action ${entity.entity}.${parts[1]} is not in the schema catalog.`);
    return;
  }
  if (!isId(parts[1])) {
    if (!findAction(entity, parts[1], 'collection')) fail(ref, `Action ${entity.entity}.${parts[1]} is not in the schema catalog.`);
    return;
  }
  if (parts.length === 2) {
    if (!findAction(entity, 'get', 'member')) fail(ref, `Action ${entity.entity}.get is not in the schema catalog.`);
    return;
  }
  const child = get(parts[2]);
  if (!child) {
    if (!findAction(entity, parts[2], 'member')) fail(ref, `Action ${entity.entity}.${parts[2]} is not in the schema catalog.`);
    return;
  }
  assertNested(ref, child, entity, grammar);
  if (parts.length === 3) {
    if (!findAction(child, 'list', 'collection')) fail(ref, `Action ${child.entity}.list is not in the schema catalog.`);
    return;
  }
  if (parts.length === 4 && isId(parts[3])) {
    if (!findAction(child, 'get', 'member')) fail(ref, `Action ${child.entity}.get is not in the schema catalog.`);
    return;
  }
  if (!findAction(child, parts[3], 'member')) fail(ref, `Action ${child.entity}.${parts[3]} is not in the schema catalog.`);
  if (parts.length > 4) {
    fail(ref, `references API command ${ref.path}, but the schema catalog cannot resolve that command shape.`);
  }
}

function extractRouteRefs(text, file) {
  const refs = [];
  for (const [index, line] of text.split('\n').entries()) {
    if (line.endsWith('<!-- dent:404 -->')) continue;
    for (const match of line.matchAll(/\b((?:GET|POST|DELETE)(?:\|(?:GET|POST|DELETE))*)\s+(\/(?:api|platform\/api)\/v1\/[A-Za-z0-9_{}?&=./:-]+)/g)) {
      for (const method of match[1].split('|')) {
        refs.push({ method, path: match[2], file: relative(rootDir, file), line: index + 1 });
      }
    }
  }
  return refs;
}

function extractCliRefs(text, file) {
  const refs = [];
  for (const [index, line] of text.split('\n').entries()) {
    for (const match of line.matchAll(/\bdent api\s+([A-Za-z0-9_{}<>./-]+(?:\s+[A-Za-z0-9_{}<>./-]+){0,4})/g)) {
      refs.push({
        path: match[1].trim().replace(/\s+/g, '/'),
        file: relative(rootDir, file),
        line: index + 1,
      });
    }
  }
  return refs;
}

function main() {
  const snapshot = loadSnapshot();
  const get = createResolver(snapshot.catalog);
  const routes = new Set(
    snapshot.routes.map(route => `${route.method} ${normalizePath(route.path).replace(/\{[^}]+\}/g, '{}')}`),
  );
  const skillDirectory = resolve(process.env.DENT_WORKFLOW_SKILL_DIR || join(rootDir, 'skill'));
  const files = process.env.DENT_WORKFLOW_SKILL_SOURCE
    ? [resolve(process.env.DENT_WORKFLOW_SKILL_SOURCE)]
    : walkMarkdownFiles(skillDirectory);
  let count = 0;
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    for (const ref of extractRouteRefs(text, file)) {
      resolveRoute(ref, get, routes, snapshot.grammar);
      count += 1;
    }
    for (const ref of extractCliRefs(text, file)) {
      resolveCli(ref, get, snapshot.grammar);
      count += 1;
    }
  }
  console.log(
    `Workflow catalog check passed: ${count} references verified against ${Object.keys(snapshot.catalog).length} schema entities and ${snapshot.routes.length} explicit routes.`,
  );
}

try {
  main();
} catch (error) {
  console.error('Workflow catalog check failed.');
  console.error(error.message);
  process.exit(1);
}

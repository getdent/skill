#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const defaultSkillSource = join(rootDir, 'skill', 'Source.md');
const defaultCatalogSource = join(rootDir, 'scripts', 'schema-catalog.snapshot.json');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function normalizeCatalogText(value) {
  return String(value || '').trim().toLowerCase().replace(/[\s_]+/g, '-');
}

function normalizePath(path) {
  const withoutQuery = String(path || '').split(/[?#]/)[0].replace(/[),.;:]+$/g, '');
  if (withoutQuery === '/api/v1/schema') return '/api/v1/schema';
  if (withoutQuery.length > 1 && withoutQuery.endsWith('/')) return withoutQuery.slice(0, -1);
  return withoutQuery;
}

function methodForAction(action) {
  if (action.mode === 'read') return 'GET';
  if (action.mode === 'destroy') return 'DELETE';
  if (action.mode === 'write' || action.mode === 'remote') return 'POST';
  throw new Error(`Schema action ${action.name} has unsupported mode: ${action.mode}`);
}

function loadSnapshot(path) {
  const payload = readJson(path);
  const catalog = payload.catalog || payload.schema || payload;
  const routes = Array.isArray(payload.routes) ? payload.routes : [];
  return { catalog, routes, source: payload.source || {} };
}

function catalogEntities(catalog) {
  if (Array.isArray(catalog.entities)) return catalog.entities;
  return catalog.entities || catalog || {};
}

function entityValues(entities) {
  if (Array.isArray(entities)) return entities;
  return Object.values(entities);
}

function pluralEntityName(value) {
  const normalized = normalizeCatalogText(value);
  if (!normalized) return '';
  if (normalized.endsWith('y')) return `${normalized.slice(0, -1)}ies`;
  if (normalized.endsWith('s')) return normalized;
  return `${normalized}s`;
}

function routeSegmentForEntity(entity) {
  const direct = entity?.route || entity?.path || entity?.slug;
  if (direct) return normalizeCatalogText(direct);
  const label = normalizeCatalogText(entity?.label);
  if (label) return label;
  return pluralEntityName(entity?.entity || entity?.name || entity?.key);
}

function createEntityResolver(catalog) {
  const entities = catalogEntities(catalog);
  const byName = new Map();
  const byRoute = new Map();

  for (const [key, entity] of Array.isArray(entities) ? [] : Object.entries(entities)) {
    byName.set(normalizeCatalogText(key), entity);
  }

  for (const entity of entityValues(entities)) {
    for (const value of [entity?.entity, entity?.name, entity?.key, entity?.label]) {
      const normalized = normalizeCatalogText(value);
      if (normalized) byName.set(normalized, entity);
      const plural = pluralEntityName(value);
      if (plural) byRoute.set(plural, entity);
    }
    byRoute.set(routeSegmentForEntity(entity), entity);
  }

  return {
    bySegment(segment) {
      const normalized = normalizeCatalogText(segment);
      return byRoute.get(normalized) || byName.get(normalized);
    },
    byEntityName(name) {
      return byName.get(normalizeCatalogText(name));
    },
  };
}

function actionByNameAndTarget(entity, name, target) {
  return (entity?.actions || []).find(action => action?.name === name && action?.target === target);
}

function actionForCrud(entity, name) {
  return (entity?.actions || []).find(action => action?.name === name);
}

function isRouteId(segment) {
  return /^\{[^}]+\}$/.test(segment) || /^\d+$/.test(segment) || /^[A-Za-z][A-Za-z0-9]*Id$/.test(segment);
}

function locationFor(ref) {
  return `${ref.file}:${ref.line}`;
}

function checked(label, ref, detail = '') {
  return { label, ref, detail };
}

function drift(message, ref) {
  return `${locationFor(ref)} ${message}`;
}

function assertMethod(action, method, ref, subject) {
  const expected = methodForAction(action);
  if (method !== expected) {
    throw new Error(drift(`${subject} resolves to ${expected}, but the workflow documents ${method}.`, ref));
  }
}

function resolveRoute(ref, resolver, routeSet) {
  const method = ref.method;
  const path = normalizePath(ref.path);
  if (path.includes('{entities}')) return checked('generic grammar', ref, path);

  if (routeSet.has(`${method} ${path}`)) return checked('explicit route', ref, `${method} ${path}`);

  if (!path.startsWith('/api/v1/')) {
    throw new Error(drift(`is not a Dent API route: ${path}`, ref));
  }

  const segments = path.slice('/api/v1/'.length).split('/').filter(Boolean);
  const [first, second, third, fourth, fifth] = segments;
  const entity = resolver.bySegment(first);
  if (!entity) {
    throw new Error(drift(`references API route ${method} ${path}, but no schema entity route matches "${first}".`, ref));
  }

  if (segments.length === 1) {
    const action = actionForCrud(entity, method === 'POST' ? 'create' : 'list');
    if (!action) throw new Error(drift(`references ${method} ${path}, but entity "${entity.entity}" has no matching CRUD action.`, ref));
    assertMethod(action, method, ref, `Route ${path}`);
    return checked('entity route', ref, `${entity.entity}.${action.name}`);
  }

  if (segments.length === 2 && !isRouteId(second)) {
    const action = actionByNameAndTarget(entity, second, 'collection');
    if (!action) throw new Error(drift(`references collection action "${second}" on entity "${entity.entity}", but the schema catalog does not define it.`, ref));
    assertMethod(action, method, ref, `Action ${entity.entity}.${second}`);
    return checked('collection action', ref, `${entity.entity}.${action.name}`);
  }

  if (segments.length === 2 && isRouteId(second)) {
    const action = actionForCrud(entity, method === 'DELETE' ? 'delete' : method === 'POST' ? 'update' : 'get');
    if (!action) throw new Error(drift(`references member route ${method} ${path}, but entity "${entity.entity}" has no matching CRUD action.`, ref));
    assertMethod(action, method, ref, `Route ${path}`);
    return checked('member route', ref, `${entity.entity}.${action.name}`);
  }

  if (segments.length === 3 && isRouteId(second) && !isRouteId(third)) {
    const action = actionByNameAndTarget(entity, third, 'member');
    if (action) {
      assertMethod(action, method, ref, `Action ${entity.entity}.${third}`);
      return checked('member action', ref, `${entity.entity}.${action.name}`);
    }
    const nestedEntity = resolver.bySegment(third);
    if (nestedEntity) {
      const nestedAction = actionForCrud(nestedEntity, method === 'POST' ? 'create' : 'list');
      if (!nestedAction) throw new Error(drift(`references nested route ${method} ${path}, but nested entity "${nestedEntity.entity}" has no matching CRUD action.`, ref));
      assertMethod(nestedAction, method, ref, `Nested route ${path}`);
      return checked('nested collection', ref, `${nestedEntity.entity}.${nestedAction.name}`);
    }
    throw new Error(drift(`references member action or nested entity "${third}" under "${entity.entity}", but the schema catalog defines neither.`, ref));
  }

  if (segments.length === 4 && isRouteId(second) && !isRouteId(third) && isRouteId(fourth)) {
    const nestedEntity = resolver.bySegment(third);
    if (!nestedEntity) throw new Error(drift(`references nested entity route "${third}", but the schema catalog does not define it.`, ref));
    const nestedAction = actionForCrud(nestedEntity, method === 'DELETE' ? 'delete' : method === 'POST' ? 'update' : 'get');
    if (!nestedAction) throw new Error(drift(`references nested member route ${method} ${path}, but nested entity "${nestedEntity.entity}" has no matching CRUD action.`, ref));
    assertMethod(nestedAction, method, ref, `Nested route ${path}`);
    return checked('nested member', ref, `${nestedEntity.entity}.${nestedAction.name}`);
  }

  if (segments.length === 5 && isRouteId(second) && !isRouteId(third) && isRouteId(fourth)) {
    const nestedEntity = resolver.bySegment(third);
    if (!nestedEntity) throw new Error(drift(`references nested entity route "${third}", but the schema catalog does not define it.`, ref));
    const nestedAction = actionByNameAndTarget(nestedEntity, fifth, 'member');
    if (!nestedAction) throw new Error(drift(`references member action "${fifth}" on nested entity "${nestedEntity.entity}", but the schema catalog does not define it.`, ref));
    assertMethod(nestedAction, method, ref, `Action ${nestedEntity.entity}.${fifth}`);
    return checked('nested member action', ref, `${nestedEntity.entity}.${nestedAction.name}`);
  }

  throw new Error(drift(`references API route ${method} ${path}, but the schema catalog cannot resolve that route shape.`, ref));
}

function parseMethodList(text) {
  return text.split('|').map(method => method.trim().toUpperCase()).filter(Boolean);
}

function extractRouteRefs(markdown, file) {
  const refs = [];
  const seen = new Set();
  const lines = markdown.split('\n');
  const routePattern = /\b((?:GET|POST|DELETE)(?:\|(?:GET|POST|DELETE))*)\s+(\/api\/v1\/[A-Za-z0-9_{}?&=./:-]+)/g;

  lines.forEach((line, index) => {
    for (const match of line.matchAll(routePattern)) {
      const [, methods, rawPath] = match;
      for (const method of parseMethodList(methods)) {
        const path = normalizePath(rawPath);
        const key = `${method} ${path} ${index + 1}`;
        if (seen.has(key)) continue;
        seen.add(key);
        refs.push({ kind: 'route', method, path, file, line: index + 1, source: line.trim() });
      }
    }
  });

  return refs;
}

function extractCliRefs(markdown, file) {
  const refs = [];
  const seen = new Set();
  const lines = markdown.split('\n');
  const cliPattern = /\bdent api\s+([^`\n]+)/g;

  lines.forEach((line, index) => {
    for (const match of line.matchAll(cliPattern)) {
      const words = match[1].trim().split(/\s+/).filter(Boolean);
      const segments = [];
      for (const word of words) {
        if (word.startsWith('--')) break;
        segments.push(word);
      }
      if (segments.length === 0) continue;
      const key = `${segments.join(' ')} ${index + 1}`;
      if (seen.has(key)) continue;
      seen.add(key);
      refs.push({ kind: 'cli', segments, file, line: index + 1, source: line.trim() });
    }
  });

  return refs;
}

function resolveCli(ref, resolver) {
  const [entitySegment, second, third] = ref.segments;
  const entity = resolver.bySegment(entitySegment);
  if (!entity) {
    throw new Error(drift(`references dent api entity "${entitySegment}", but the schema catalog does not define it.`, ref));
  }
  if (ref.segments.length === 1) {
    const action = actionForCrud(entity, 'list');
    if (!action) throw new Error(drift(`references dent api ${entitySegment}, but entity "${entity.entity}" has no list action.`, ref));
    return checked('CLI entity', ref, `${entity.entity}.list`);
  }
  if (ref.segments.length === 2 && !isRouteId(second)) {
    const action = actionByNameAndTarget(entity, second, 'collection');
    if (!action) throw new Error(drift(`references dent api collection action "${second}" on entity "${entity.entity}", but the schema catalog does not define it.`, ref));
    return checked('CLI collection action', ref, `${entity.entity}.${action.name}`);
  }
  if (ref.segments.length === 3 && isRouteId(second)) {
    const nestedEntity = resolver.bySegment(third);
    if (!nestedEntity) throw new Error(drift(`references dent api nested entity "${third}", but the schema catalog does not define it.`, ref));
    const action = actionForCrud(nestedEntity, 'list');
    if (!action) throw new Error(drift(`references dent api nested entity "${nestedEntity.entity}", but it has no list action.`, ref));
    return checked('CLI nested collection', ref, `${nestedEntity.entity}.list`);
  }
  throw new Error(drift(`references dent api ${ref.segments.join(' ')}, but the schema catalog cannot resolve that CLI shape.`, ref));
}

function routeSetFrom(routes) {
  return new Set(routes.map(route => `${String(route.method || '').toUpperCase()} ${normalizePath(route.path)}`));
}

function main() {
  const skillSource = resolve(process.env.DENT_WORKFLOW_SKILL_SOURCE || defaultSkillSource);
  const catalogSource = resolve(process.env.DENT_WORKFLOW_SCHEMA_CATALOG || defaultCatalogSource);
  const markdown = readFileSync(skillSource, 'utf8');
  const { catalog, routes, source } = loadSnapshot(catalogSource);
  const resolver = createEntityResolver(catalog);
  const routeSet = routeSetFrom(routes);
  const routeRefs = extractRouteRefs(markdown, 'skill/Source.md');
  const cliRefs = extractCliRefs(markdown, 'skill/Source.md');
  const checks = [];

  for (const ref of routeRefs) checks.push(resolveRoute(ref, resolver, routeSet));
  for (const ref of cliRefs) checks.push(resolveCli(ref, resolver));

  const entityCount = entityValues(catalogEntities(catalog)).length;
  console.log(`Workflow catalog check passed: ${checks.length} references verified against ${entityCount} schema entities and ${routes.length} explicit routes.`);
  if (source.schemaSource) console.log(`Catalog: ${source.schemaSource}`);
}

try {
  main();
} catch (error) {
  console.error('Workflow catalog check failed.');
  console.error(error?.message || error);
  process.exit(1);
}

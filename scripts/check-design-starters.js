#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { walkMarkdownFiles } from './lib/markdown.js';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const contract = JSON.parse(readFileSync(join(rootDir, 'scripts', 'design-contract.json'), 'utf8'));
const fieldReference = /{{\s*fields\.([a-zA-Z0-9_-]+)\s*}}/g;

function addFailure(failures, source, message) {
  failures.push(`${source.file}:${source.line} ${message}`);
}

function validateStringList(value, name, source, failures) {
  if (value === undefined) return;
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string' || item === '')) {
    addFailure(failures, source, `${name} must be a list of non-empty strings.`);
  }
}

function descendantsOf(element) {
  const descendants = [];
  const visit = children => {
    for (const child of children || []) {
      descendants.push(child);
      visit(child.children);
    }
  };
  visit(element.children);
  return descendants;
}

function validateCheckout(element, source, failures) {
  const descendants = descendantsOf(element);
  const types = new Set(descendants.map(item => item.type));
  const bindings = new Set(descendants.filter(item => item.type === 'text-input').map(item => item.config?.binding));
  const hasBehavior = Array.isArray(element.behaviors) && element.behaviors.some(item => item.behavior === 'checkout');
  if (!hasBehavior) addFailure(failures, source, 'checkout has no checkout behavior.');
  if (!types.has('checkout-payment')) addFailure(failures, source, 'checkout has no checkout-payment descendant.');
  if (!types.has('checkout-submit')) addFailure(failures, source, 'checkout has no checkout-submit descendant.');
  for (const binding of ['billing.email', 'billing.first_name', 'billing.last_name']) {
    if (!bindings.has(binding)) addFailure(failures, source, `checkout has no input bound to "${binding}".`);
  }
}

function validateBehaviors(element, form, source, failures) {
  if (element.behaviors === undefined) return;
  if (!Array.isArray(element.behaviors)) {
    addFailure(failures, source, 'behaviors must be a list.');
    return;
  }
  for (const binding of element.behaviors) {
    const name = binding?.behavior;
    const rule = contract.behaviors[name];
    if (!rule) {
      addFailure(failures, source, `unknown behavior "${name}".`);
      continue;
    }
    const config = binding.config || {};
    for (const key of Object.keys(config)) {
      if (!rule.inputs.includes(key)) addFailure(failures, source, `behavior "${name}" has no input "${key}".`);
    }
    for (const key of rule.required) {
      if (config[key] === undefined || config[key] === '') addFailure(failures, source, `behavior "${name}" needs "${key}".`);
    }
    if (form) form.references.push(config);
  }
}

function validateElement(element, source, failures, keys, form) {
  const componentKeys = element.type === 'component' ? contract.componentKeys : [];
  const allowedKeys = new Set([...contract.elementKeys, ...componentKeys]);
  for (const key of Object.keys(element)) {
    if (!allowedKeys.has(key)) addFailure(failures, source, `unknown key "${key}".`);
  }
  if (!contract.elementTypes.includes(element.type)) addFailure(failures, source, `unknown type "${element.type}".`);
  if (!new RegExp(contract.keyPattern).test(element.key || '') || keys.has(element.key)) {
    addFailure(failures, source, `invalid or duplicate key "${element.key}".`);
  }
  keys.add(element.key);
  if (element.text !== undefined && element.content !== undefined) addFailure(failures, source, 'has both text and content.');
  validateStringList(element.utilities, 'utilities', source, failures);
  validateStringList(element.styles, 'styles', source, failures);
  if (element.type === 'svg' && element.config?.tree?.tag !== 'svg') addFailure(failures, source, 'svg needs config.tree.tag "svg".');

  const currentForm = element.type === 'form' ? { fields: new Set(), names: new Set(), hasSubmit: false, references: [] } : form;
  if (element.type === 'form' && (typeof element.id !== 'string' || element.id === '')) addFailure(failures, source, 'form has no id.');
  if (element.type === 'form-submit' && currentForm) currentForm.hasSubmit = true;
  if (element.type === 'text-input') {
    if (!contract.inputKinds.includes(element.config?.kind)) addFailure(failures, source, 'text-input has invalid kind.');
    if (currentForm) {
      const name = element.config?.name;
      if (typeof name !== 'string' || name === '' || currentForm.names.has(name)) addFailure(failures, source, 'form input has no unique config.name.');
      else {
        currentForm.names.add(name);
        currentForm.fields.add(name);
      }
    }
  }
  validateBehaviors(element, currentForm, source, failures);
  for (const child of element.children || []) validateElement(child, source, failures, keys, currentForm);
  if (element.type === 'form' && !currentForm.hasSubmit) addFailure(failures, source, 'form has no form-submit descendant.');
  if (element.type === 'form') validateFieldReferences(currentForm, source, failures);
  if (element.type === 'checkout') validateCheckout(element, source, failures);
}

function validateFieldReferences(form, source, failures) {
  for (const config of form.references) {
    for (const value of Object.values(config)) {
      for (const match of String(value).matchAll(fieldReference)) {
        if (!form.fields.has(match[1])) addFailure(failures, source, `behavior references unknown field "${match[1]}".`);
      }
    }
  }
}

function validateDocument(document, source, failures) {
  const allowedKeys = new Set(contract.documentKeys);
  for (const key of Object.keys(document || {})) {
    if (!allowedKeys.has(key)) addFailure(failures, source, `unknown document key "${key}".`);
  }
  if (document?.version !== 1 || !Array.isArray(document.elements)) {
    addFailure(failures, source, 'needs version 1 and elements.');
    return;
  }
  const keys = new Set();
  for (const element of document.elements) validateElement(element, source, failures, keys, null);
}

function startersIn(file) {
  const text = readFileSync(file, 'utf8');
  const starters = [];
  for (const match of text.matchAll(/```json\s*\n([\s\S]*?)```/g)) {
    starters.push({ line: text.slice(0, match.index).split('\n').length, json: match[1].replace(/^\s*[-*]\s?/gm, '') });
  }
  return starters;
}

function main() {
  const failures = [];
  const directory = resolve(process.env.DENT_DESIGN_SKILL_DIR || join(rootDir, 'skill'));
  let count = 0;
  for (const file of walkMarkdownFiles(directory)) {
    for (const starter of startersIn(file)) {
      const source = { file: relative(rootDir, file), line: starter.line };
      try {
        const document = JSON.parse(starter.json);
        if (document?.version !== 1 || !Array.isArray(document.elements)) continue;
        count += 1;
        validateDocument(document, source, failures);
      } catch (error) {
        continue;
      }
    }
  }
  if (failures.length > 0) throw new Error(failures.join('\n'));
  console.log(`Design starter check passed: ${count} starters`);
}

try {
  main();
} catch (error) {
  console.error('Design starter check failed.');
  console.error(error.message);
  process.exit(1);
}

import {
  isValidShortcut,
  isValidShortcutPrefix,
  normalizeShortcut,
} from '../lib/validation';
import type { Snippet, SnippetGroup, SnippetLibrary, TypadooSettings } from '../types';

export const LIBRARY_SCHEMA_VERSION = 1;
export const MAX_LIBRARY_SIZE_BYTES = 4 * 1024 * 1024;
export const MAX_SNIPPETS = 5_000;
export const MAX_GROUPS = 100;
export const MAX_TITLE_LENGTH = 120;
export const MAX_CONTENT_LENGTH = 20_000;
export const MAX_DESCRIPTION_LENGTH = 500;
export const MAX_TAGS = 20;
export const MAX_TAG_LENGTH = 40;

export class LibraryValidationError extends Error {
  constructor(
    public readonly field: string,
    message: string,
  ) {
    super(`${field}: ${message}`);
    this.name = 'LibraryValidationError';
  }
}

function invalid(field: string, message: string): never {
  throw new LibraryValidationError(field, message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertRecord(value: unknown, path: string): asserts value is Record<string, unknown> {
  if (!isRecord(value)) {
    invalid(path, 'must be an object');
  }
}

function assertKeys(
  value: Record<string, unknown>,
  required: string[],
  optional: string[],
  path: string,
): void {
  for (const key of required) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      invalid(`${path}.${key}`, 'is required');
    }
  }

  const allowed = new Set([...required, ...optional]);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      invalid(`${path}.${key}`, 'is not a recognized field');
    }
  }
}

function assertString(
  value: unknown,
  path: string,
  maxLength: number,
  options: { nonEmpty?: boolean } = {},
): asserts value is string {
  if (typeof value !== 'string') {
    invalid(path, 'must be a string');
  }
  if (value.length > maxLength) {
    invalid(path, `must be no longer than ${maxLength} characters`);
  }
  if (options.nonEmpty && value.trim().length === 0) {
    invalid(path, 'must not be empty');
  }
}

function assertTimestamp(value: unknown, path: string): asserts value is string {
  assertString(value, path, 40, { nonEmpty: true });
  const timestamp = new Date(value);
  if (!Number.isFinite(timestamp.getTime()) || timestamp.toISOString() !== value) {
    invalid(path, 'must be a valid ISO timestamp');
  }
}

function assertSnippet(value: unknown, path: string, prefix: string): asserts value is Snippet {
  assertRecord(value, path);
  assertKeys(
    value,
    [
      'id',
      'title',
      'shortcut',
      'content',
      'tags',
      'groupId',
      'status',
      'favorite',
      'createdAt',
      'updatedAt',
      'usageCount',
    ],
    ['description'],
    path,
  );
  assertString(value.id, `${path}.id`, 100, { nonEmpty: true });
  assertString(value.title, `${path}.title`, MAX_TITLE_LENGTH, { nonEmpty: true });
  assertString(value.shortcut, `${path}.shortcut`, 43, { nonEmpty: true });
  if (!isValidShortcut(value.shortcut, prefix)) {
    invalid(
      `${path}.shortcut`,
      `must start with "${prefix}" and contain 1-40 letters, numbers, _ or -`,
    );
  }
  assertString(value.content, `${path}.content`, MAX_CONTENT_LENGTH, { nonEmpty: true });
  if ('description' in value) {
    assertString(value.description, `${path}.description`, MAX_DESCRIPTION_LENGTH);
  }
  if (!Array.isArray(value.tags) || value.tags.length > MAX_TAGS) {
    invalid(`${path}.tags`, `must be an array with no more than ${MAX_TAGS} items`);
  }
  const tagSet = new Set<string>();
  value.tags.forEach((tag, index) => {
    assertString(tag, `${path}.tags[${index}]`, MAX_TAG_LENGTH, { nonEmpty: true });
    const normalizedTag = tag.trim().toLocaleLowerCase();
    if (tagSet.has(normalizedTag)) {
      invalid(`${path}.tags[${index}]`, 'duplicates another tag');
    }
    tagSet.add(normalizedTag);
  });
  assertString(value.groupId, `${path}.groupId`, 100, { nonEmpty: true });
  if (value.status !== 'enabled' && value.status !== 'disabled') {
    invalid(`${path}.status`, 'must be enabled or disabled');
  }
  if (typeof value.favorite !== 'boolean') {
    invalid(`${path}.favorite`, 'must be a boolean');
  }
  assertTimestamp(value.createdAt, `${path}.createdAt`);
  assertTimestamp(value.updatedAt, `${path}.updatedAt`);
  if (
    typeof value.usageCount !== 'number' ||
    !Number.isSafeInteger(value.usageCount) ||
    value.usageCount < 0
  ) {
    invalid(`${path}.usageCount`, 'must be a non-negative safe integer');
  }
}

function assertGroup(value: unknown, path: string): asserts value is SnippetGroup {
  assertRecord(value, path);
  assertKeys(
    value,
    ['id', 'name', 'sortOrder', 'createdAt', 'updatedAt', 'isDefault'],
    ['description', 'color'],
    path,
  );
  assertString(value.id, `${path}.id`, 100, { nonEmpty: true });
  assertString(value.name, `${path}.name`, 80, { nonEmpty: true });
  if ('description' in value) {
    assertString(value.description, `${path}.description`, MAX_DESCRIPTION_LENGTH);
  }
  if (
    'color' in value &&
    (typeof value.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(value.color))
  ) {
    invalid(`${path}.color`, 'must be a six-digit hexadecimal color');
  }
  if (!Number.isSafeInteger(value.sortOrder)) {
    invalid(`${path}.sortOrder`, 'must be an integer');
  }
  assertTimestamp(value.createdAt, `${path}.createdAt`);
  assertTimestamp(value.updatedAt, `${path}.updatedAt`);
  if (typeof value.isDefault !== 'boolean') {
    invalid(`${path}.isDefault`, 'must be a boolean');
  }
}

function assertSettings(value: unknown): asserts value is TypadooSettings {
  const path = 'settings';
  assertRecord(value, path);
  assertKeys(
    value,
    [
      'triggerMode',
      'expandOnSpace',
      'expandOnTab',
      'requireExplicitTrigger',
      'defaultGroupId',
      'shortcutPrefix',
      'debugMode',
      'theme',
    ],
    [],
    path,
  );
  if (
    value.triggerMode !== 'space' &&
    value.triggerMode !== 'tab' &&
    value.triggerMode !== 'manual'
  ) {
    invalid(`${path}.triggerMode`, 'must be space, tab, or manual');
  }
  for (const key of ['expandOnSpace', 'expandOnTab', 'requireExplicitTrigger', 'debugMode']) {
    if (typeof value[key] !== 'boolean') {
      invalid(`${path}.${key}`, 'must be a boolean');
    }
  }
  assertString(value.defaultGroupId, `${path}.defaultGroupId`, 100, { nonEmpty: true });
  assertString(value.shortcutPrefix, `${path}.shortcutPrefix`, 3, { nonEmpty: true });
  if (!isValidShortcutPrefix(value.shortcutPrefix)) {
    invalid(`${path}.shortcutPrefix`, 'must be 1-3 punctuation characters with no whitespace');
  }
  if (value.theme !== 'light' && value.theme !== 'dark' && value.theme !== 'system') {
    invalid(`${path}.theme`, 'must be light, dark, or system');
  }
}

export function assertValidLibrary(value: unknown): asserts value is SnippetLibrary {
  assertRecord(value, 'library');
  assertKeys(value, ['version', 'snippets', 'groups', 'settings'], [], 'library');
  if (value.version !== LIBRARY_SCHEMA_VERSION) {
    invalid('version', `unsupported schema version; expected ${LIBRARY_SCHEMA_VERSION}`);
  }
  if (!Array.isArray(value.snippets) || value.snippets.length > MAX_SNIPPETS) {
    invalid('snippets', `must be an array with no more than ${MAX_SNIPPETS} items`);
  }
  if (
    !Array.isArray(value.groups) ||
    value.groups.length === 0 ||
    value.groups.length > MAX_GROUPS
  ) {
    invalid('groups', `must contain between 1 and ${MAX_GROUPS} groups`);
  }

  assertSettings(value.settings);
  const prefix = value.settings.shortcutPrefix;
  value.snippets.forEach((snippet, index) => assertSnippet(snippet, `snippets[${index}]`, prefix));
  value.groups.forEach((group, index) => assertGroup(group, `groups[${index}]`));

  const groupIds = new Set<string>();
  const groupNames = new Set<string>();
  for (const [index, group] of value.groups.entries()) {
    if (groupIds.has(group.id)) {
      invalid(`groups[${index}].id`, 'duplicates another group id');
    }
    groupIds.add(group.id);
    const normalizedName = group.name.trim().toLocaleLowerCase();
    if (groupNames.has(normalizedName)) {
      invalid(`groups[${index}].name`, 'duplicates another group name');
    }
    groupNames.add(normalizedName);
  }
  if (!groupIds.has(value.settings.defaultGroupId)) {
    invalid('settings.defaultGroupId', 'must reference an existing group');
  }

  const snippetIds = new Set<string>();
  const shortcuts = new Set<string>();
  for (const [index, snippet] of value.snippets.entries()) {
    if (snippetIds.has(snippet.id)) {
      invalid(`snippets[${index}].id`, 'duplicates another snippet id');
    }
    snippetIds.add(snippet.id);
    if (!groupIds.has(snippet.groupId)) {
      invalid(`snippets[${index}].groupId`, 'must reference an existing group');
    }
    const shortcut = normalizeShortcut(snippet.shortcut);
    if (shortcuts.has(shortcut)) {
      invalid(`snippets[${index}].shortcut`, 'duplicates another shortcut');
    }
    shortcuts.add(shortcut);
  }

  const serialized = JSON.stringify(value);
  if (
    serialized === undefined ||
    new TextEncoder().encode(serialized).byteLength > MAX_LIBRARY_SIZE_BYTES
  ) {
    invalid('library', `must be no larger than ${MAX_LIBRARY_SIZE_BYTES} bytes`);
  }
}

export function migrateLibraryData(value: unknown): unknown {
  assertRecord(value, 'library');
  if (!Number.isInteger(value.version)) {
    invalid('version', 'must be an integer schema version');
  }

  switch (value.version) {
    case LIBRARY_SCHEMA_VERSION:
      return value;
    default:
      invalid('version', `unsupported schema version ${String(value.version)}`);
  }
}

export function parseLibraryData(value: unknown): SnippetLibrary {
  const migrated = migrateLibraryData(value);
  assertValidLibrary(migrated);
  return migrated;
}

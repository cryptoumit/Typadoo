import { describe, expect, it } from 'vitest';
import type { Snippet } from '../types';
import { createDefaultLibrary } from './defaults';
import {
  assertValidLibrary,
  LibraryValidationError,
  MAX_CONTENT_LENGTH,
  parseLibraryData,
} from './schema';

describe('library schema', () => {
  it('creates valid defaults with all built-in groups', () => {
    const library = createDefaultLibrary(new Date('2026-01-02T03:04:05.000Z'));

    expect(() => assertValidLibrary(library)).not.toThrow();
    expect(library.groups.map((group) => group.name)).toEqual([
      'General Support',
      'Troubleshooting',
      'Account & Security',
      'Payments & Billing',
      'Escalations',
      'Follow-ups',
      'Internal Notes',
    ]);
    expect(library.settings.shortcutPrefix).toBe(';');
  });

  it('rejects unknown fields and unsupported schema versions', () => {
    const library = createDefaultLibrary();

    expect(() => parseLibraryData({ ...library, unexpected: true })).toThrow(
      LibraryValidationError,
    );
    expect(() => parseLibraryData({ ...library, version: 99 })).toThrow(
      /unsupported schema version/,
    );
  });

  it('rejects invalid group references, duplicate shortcuts, and invalid fields', () => {
    const library = createDefaultLibrary();
    const firstGroup = library.groups[0].id;
    const snippet: Snippet = {
      id: 'snippet-1',
      title: 'Greeting',
      shortcut: ';greet',
      content: 'Hello there',
      tags: [],
      groupId: firstGroup,
      status: 'enabled',
      favorite: false,
      createdAt: '2026-01-02T03:04:05.000Z',
      updatedAt: '2026-01-02T03:04:05.000Z',
      usageCount: 0,
    };
    library.snippets = [{ ...snippet }];

    expect(() =>
      assertValidLibrary({
        ...library,
        snippets: [{ ...snippet, groupId: 'missing-group' }],
      }),
    ).toThrow(/must reference an existing group/);
    expect(() =>
      assertValidLibrary({
        ...library,
        snippets: [{ ...snippet }, { ...snippet, id: 'snippet-2' }],
      }),
    ).toThrow(/duplicates another shortcut/);
    expect(() =>
      assertValidLibrary({
        ...library,
        snippets: [{ ...snippet, title: '   ' }],
      }),
    ).toThrow(/must not be empty/);
  });

  it('rejects libraries larger than the local-storage safety limit', () => {
    const library = createDefaultLibrary();
    const timestamp = '2026-01-02T03:04:05.000Z';
    const content = 'x'.repeat(MAX_CONTENT_LENGTH);
    library.snippets = Array.from({ length: 215 }, (_, index) => ({
      id: `snippet-${index}`,
      title: 'Large snippet',
      shortcut: `;s${index}`,
      content,
      tags: [],
      groupId: library.groups[0].id,
      status: 'enabled',
      favorite: false,
      createdAt: timestamp,
      updatedAt: timestamp,
      usageCount: 0,
    }));

    expect(() => assertValidLibrary(library)).toThrow(/must be no larger than/);
  });
});

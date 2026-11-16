import { describe, expect, it } from 'vitest';
import { DataConflictError, EntityNotFoundError } from './errors';
import { GroupService } from './groups';
import { SettingsService } from './settings';
import { SnippetService } from './snippets';
import { LibraryRepository } from '../storage/repository';
import { MemoryStorage } from '../test/memory-storage';

function createServices() {
  const repository = new LibraryRepository(new MemoryStorage());
  return {
    repository,
    snippets: new SnippetService(repository),
    groups: new GroupService(repository),
    settings: new SettingsService(repository),
  };
}

describe('snippet and group services', () => {
  it('creates, reads, updates, and deletes snippets', async () => {
    const { snippets, groups } = createServices();
    const [group] = await groups.list();
    const created = await snippets.create({
      title: 'Greeting',
      shortcut: ';greet',
      content: 'Hello! Thanks for reaching out.',
      groupId: group.id,
      tags: ['welcome'],
    });

    expect(await snippets.getById(created.id)).toEqual(created);
    const updated = await snippets.update(created.id, { title: 'Welcome', favorite: true });
    expect(updated.title).toBe('Welcome');
    expect(updated.favorite).toBe(true);
    const disabled = await snippets.update(created.id, { status: 'disabled', favorite: false });
    expect(disabled.status).toBe('disabled');
    expect(disabled.favorite).toBe(false);

    await snippets.delete(created.id);
    expect(await snippets.getById(created.id)).toBeUndefined();
    await expect(snippets.delete(created.id)).rejects.toBeInstanceOf(EntityNotFoundError);
  });

  it('duplicates a snippet with a unique, valid shortcut and resets its usage count', async () => {
    const { snippets, groups, repository } = createServices();
    const [group] = await groups.list();
    const original = await snippets.create({
      title: 'Greeting',
      shortcut: `;${'a'.repeat(40)}`,
      content: 'Hello',
      groupId: group.id,
      tags: ['welcome'],
      favorite: true,
    });
    await snippets.create({
      title: 'Existing copy',
      shortcut: `;${'a'.repeat(35)}-copy`,
      content: 'Existing',
      groupId: group.id,
    });
    await repository.updateLibrary((library) => ({
      ...library,
      snippets: library.snippets.map((snippet) =>
        snippet.id === original.id ? { ...snippet, usageCount: 7 } : snippet,
      ),
    }));

    const duplicate = await snippets.duplicate(original.id);

    expect(duplicate).toMatchObject({
      title: 'Copy of Greeting',
      content: original.content,
      groupId: original.groupId,
      tags: original.tags,
      favorite: true,
      usageCount: 0,
    });
    expect(duplicate.id).not.toBe(original.id);
    expect(duplicate.shortcut).toBe(`;${'a'.repeat(33)}-copy-2`);
    expect(duplicate.shortcut.length).toBeLessThanOrEqual(41);
    await expect(snippets.duplicate('missing')).rejects.toBeInstanceOf(EntityNotFoundError);
  });

  it('validates shortcut format and rejects duplicate shortcuts case-insensitively', async () => {
    const { snippets, groups } = createServices();
    const [group] = await groups.list();
    const draft = {
      title: 'Greeting',
      shortcut: ';greet',
      content: 'Hello',
      groupId: group.id,
    };

    await snippets.create(draft);
    await expect(
      snippets.create({ ...draft, title: 'Duplicate', shortcut: ';GREET' }),
    ).rejects.toThrow(/duplicates another shortcut/);
    await expect(
      snippets.create({ ...draft, title: 'Invalid', shortcut: 'greet' }),
    ).rejects.toThrow(/must start with/);
  });

  it('creates and updates groups, and prevents deleting referenced groups', async () => {
    const { snippets, groups, settings } = createServices();
    const created = await groups.create({ name: 'Custom', color: '#123456' });
    expect(await groups.getById(created.id)).toEqual(created);
    await groups.update(created.id, { name: 'My Workflow' });

    await snippets.create({
      title: 'Reply',
      shortcut: ';reply',
      content: 'Reply text',
      groupId: created.id,
    });
    await expect(groups.delete(created.id)).rejects.toBeInstanceOf(DataConflictError);
    await snippets.delete((await snippets.list())[0].id);

    await settings.update({ defaultGroupId: created.id });
    await groups.delete(created.id);
    expect((await settings.get()).defaultGroupId).not.toBe(created.id);
    await expect(groups.getById(created.id)).resolves.toBeUndefined();
  });

  it('rejects invalid group names, colors, and settings references', async () => {
    const { groups, settings } = createServices();
    await expect(groups.create({ name: 'General Support' })).rejects.toThrow(
      /duplicates another group name/,
    );
    await expect(groups.create({ name: 'Broken', color: 'purple' })).rejects.toThrow(
      /six-digit hexadecimal color/,
    );
    await expect(settings.update({ defaultGroupId: 'missing' })).rejects.toThrow(
      /must reference an existing group/,
    );
  });

  it('moves group snippets to the chosen destination before deleting the group', async () => {
    const { snippets, groups, repository } = createServices();
    const [defaultGroup] = await groups.list();
    const source = await groups.create({ name: 'Temporary' });
    const snippet = await snippets.create({
      title: 'Reply',
      shortcut: ';reply',
      content: 'Keep this text',
      groupId: source.id,
    });

    await groups.delete(source.id, defaultGroup.id);

    const library = await repository.getLibrary();
    expect(library.groups.some((group) => group.id === source.id)).toBe(false);
    expect(library.snippets.find((item) => item.id === snippet.id)?.groupId).toBe(defaultGroup.id);
  });

  it('updates the configured shortcut prefix and rewrites existing shortcuts atomically', async () => {
    const { snippets, groups, settings, repository } = createServices();
    const [group] = await groups.list();
    await snippets.create({
      title: 'Greeting',
      shortcut: ';greet',
      content: 'Hello',
      groupId: group.id,
    });

    await settings.update({ shortcutPrefix: '!' });

    const library = await repository.getLibrary();
    expect(library.settings.shortcutPrefix).toBe('!');
    expect(library.snippets[0].shortcut).toBe('!greet');
  });
});

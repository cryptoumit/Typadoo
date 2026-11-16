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

    await snippets.delete(created.id);
    expect(await snippets.getById(created.id)).toBeUndefined();
    await expect(snippets.delete(created.id)).rejects.toBeInstanceOf(EntityNotFoundError);
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
});

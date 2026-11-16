import type { GroupDraft, SnippetGroup } from '../types';
import { LibraryRepository } from '../storage/repository';
import { DataConflictError, EntityNotFoundError } from './errors';

export class GroupService {
  constructor(private readonly repository: LibraryRepository) {}

  async list(): Promise<SnippetGroup[]> {
    return [...(await this.repository.getLibrary()).groups].sort(
      (left, right) => left.sortOrder - right.sortOrder,
    );
  }

  async getById(id: string): Promise<SnippetGroup | undefined> {
    return (await this.repository.getLibrary()).groups.find((group) => group.id === id);
  }

  create(draft: GroupDraft): Promise<SnippetGroup> {
    return this.repository
      .updateLibrary((library) => {
        const timestamp = new Date().toISOString();
        const group: SnippetGroup = {
          id: crypto.randomUUID(),
          name: draft.name,
          sortOrder:
            draft.sortOrder ?? Math.max(-1, ...library.groups.map((item) => item.sortOrder)) + 1,
          createdAt: timestamp,
          updatedAt: timestamp,
          isDefault: false,
        };
        if (draft.description !== undefined) {
          group.description = draft.description;
        }
        if (draft.color !== undefined) {
          group.color = draft.color;
        }
        return { ...library, groups: [...library.groups, group] };
      })
      .then((library) => library.groups[library.groups.length - 1]);
  }

  update(id: string, changes: Partial<GroupDraft>): Promise<SnippetGroup> {
    return this.repository
      .updateLibrary((library) => {
        const index = library.groups.findIndex((group) => group.id === id);
        if (index < 0) {
          throw new EntityNotFoundError('Group', id);
        }
        const current = library.groups[index];
        const updated: SnippetGroup = {
          ...current,
          ...changes,
          id: current.id,
          createdAt: current.createdAt,
          updatedAt: new Date().toISOString(),
        };
        if (
          Object.prototype.hasOwnProperty.call(changes, 'description') &&
          changes.description === undefined
        ) {
          delete updated.description;
        }
        if (Object.prototype.hasOwnProperty.call(changes, 'color') && changes.color === undefined) {
          delete updated.color;
        }
        const groups = [...library.groups];
        groups[index] = updated;
        return { ...library, groups };
      })
      .then((library) => {
        const group = library.groups.find((item) => item.id === id);
        if (!group) {
          throw new EntityNotFoundError('Group', id);
        }
        return group;
      });
  }

  async delete(id: string, moveSnippetsToGroupId?: string): Promise<void> {
    await this.repository.updateLibrary((library) => {
      const group = library.groups.find((item) => item.id === id);
      if (!group) {
        throw new EntityNotFoundError('Group', id);
      }
      if (library.groups.length === 1) {
        throw new DataConflictError('At least one group must remain');
      }
      const affectedSnippets = library.snippets.filter((snippet) => snippet.groupId === id);
      if (affectedSnippets.length > 0 && !moveSnippetsToGroupId) {
        throw new DataConflictError('Choose a destination group before deleting this group');
      }
      const groups = library.groups.filter((item) => item.id !== id);
      const destination = moveSnippetsToGroupId
        ? groups.find((item) => item.id === moveSnippetsToGroupId)
        : undefined;
      if (affectedSnippets.length > 0 && !destination) {
        throw new DataConflictError('The destination group does not exist');
      }
      const timestamp = new Date().toISOString();
      const snippets =
        affectedSnippets.length > 0 && destination
          ? library.snippets.map((snippet) =>
              snippet.groupId === id
                ? { ...snippet, groupId: destination.id, updatedAt: timestamp }
                : snippet,
            )
          : library.snippets;
      const defaultGroupId =
        library.settings.defaultGroupId === id
          ? (destination ?? groups.sort((left, right) => left.sortOrder - right.sortOrder)[0]).id
          : library.settings.defaultGroupId;
      return {
        ...library,
        groups,
        snippets,
        settings: { ...library.settings, defaultGroupId },
      };
    });
  }
}

import type { Snippet, SnippetDraft } from '../types';
import { LibraryRepository } from '../storage/repository';
import { MAX_TITLE_LENGTH } from '../storage/schema';
import { EntityNotFoundError } from './errors';

const MAX_SHORTCUT_BODY_LENGTH = 40;

export class SnippetService {
  constructor(private readonly repository: LibraryRepository) {}

  async list(): Promise<Snippet[]> {
    return (await this.repository.getLibrary()).snippets;
  }

  async getById(id: string): Promise<Snippet | undefined> {
    return (await this.repository.getLibrary()).snippets.find((snippet) => snippet.id === id);
  }

  create(draft: SnippetDraft): Promise<Snippet> {
    return this.repository
      .updateLibrary((library) => {
        const timestamp = new Date().toISOString();
        const snippet: Snippet = {
          id: crypto.randomUUID(),
          title: draft.title,
          shortcut: draft.shortcut,
          content: draft.content,
          tags: draft.tags ?? [],
          groupId: draft.groupId,
          status: draft.status ?? 'enabled',
          favorite: draft.favorite ?? false,
          createdAt: timestamp,
          updatedAt: timestamp,
          usageCount: 0,
        };
        if (draft.description !== undefined) {
          snippet.description = draft.description;
        }

        return { ...library, snippets: [...library.snippets, snippet] };
      })
      .then((library) => library.snippets[library.snippets.length - 1]);
  }

  duplicate(id: string): Promise<Snippet> {
    return this.repository
      .updateLibrary((library) => {
        const original = library.snippets.find((snippet) => snippet.id === id);
        if (!original) {
          throw new EntityNotFoundError('Snippet', id);
        }

        const prefix = library.settings.shortcutPrefix;
        const shortcutBody = original.shortcut.slice(prefix.length);
        let suffixIndex = 1;
        let shortcut: string;
        do {
          const suffix = suffixIndex === 1 ? '-copy' : `-copy-${suffixIndex}`;
          shortcut = `${prefix}${shortcutBody.slice(0, MAX_SHORTCUT_BODY_LENGTH - suffix.length)}${suffix}`;
          suffixIndex += 1;
        } while (
          library.snippets.some(
            (snippet) => snippet.shortcut.toLocaleLowerCase() === shortcut.toLocaleLowerCase(),
          )
        );

        const timestamp = new Date().toISOString();
        const duplicate: Snippet = {
          ...original,
          id: crypto.randomUUID(),
          title: `Copy of ${original.title}`.slice(0, MAX_TITLE_LENGTH),
          shortcut,
          createdAt: timestamp,
          updatedAt: timestamp,
          usageCount: 0,
        };
        return { ...library, snippets: [...library.snippets, duplicate] };
      })
      .then((library) => library.snippets[library.snippets.length - 1]);
  }

  update(id: string, changes: Partial<SnippetDraft>): Promise<Snippet> {
    return this.repository
      .updateLibrary((library) => {
        const index = library.snippets.findIndex((snippet) => snippet.id === id);
        if (index < 0) {
          throw new EntityNotFoundError('Snippet', id);
        }
        const current = library.snippets[index];
        const updated: Snippet = {
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
        const snippets = [...library.snippets];
        snippets[index] = updated;
        return { ...library, snippets };
      })
      .then((library) => {
        const snippet = library.snippets.find((item) => item.id === id);
        if (!snippet) {
          throw new EntityNotFoundError('Snippet', id);
        }
        return snippet;
      });
  }

  async delete(id: string): Promise<void> {
    await this.repository.updateLibrary((library) => {
      if (!library.snippets.some((snippet) => snippet.id === id)) {
        throw new EntityNotFoundError('Snippet', id);
      }
      return {
        ...library,
        snippets: library.snippets.filter((snippet) => snippet.id !== id),
      };
    });
  }
}

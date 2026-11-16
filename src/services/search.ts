import type { Snippet } from '../types';

export type SnippetFilter =
  | { type: 'all' }
  | { type: 'favorites' }
  | { type: 'enabled' }
  | { type: 'disabled' }
  | { type: 'group'; groupId: string };

export function searchSnippets(
  snippets: Snippet[],
  query: string,
  filter: SnippetFilter = { type: 'all' },
): Snippet[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();

  return snippets.filter((snippet) => {
    if (filter.type === 'favorites' && !snippet.favorite) return false;
    if (filter.type === 'enabled' && snippet.status !== 'enabled') return false;
    if (filter.type === 'disabled' && snippet.status !== 'disabled') return false;
    if (filter.type === 'group' && snippet.groupId !== filter.groupId) return false;
    if (!normalizedQuery) return true;

    return [
      snippet.title,
      snippet.shortcut,
      snippet.content,
      snippet.description ?? '',
      ...snippet.tags,
    ].some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
  });
}

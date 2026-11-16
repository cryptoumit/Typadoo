import { describe, expect, it } from 'vitest';
import type { Snippet } from '../types';
import { searchSnippets } from './search';

const snippets: Snippet[] = [
  {
    id: 'one',
    title: 'Refund update',
    shortcut: ';refund',
    content: 'Your payment has been returned.',
    description: 'Payment status',
    tags: ['billing'],
    groupId: 'payments',
    status: 'enabled',
    favorite: true,
    createdAt: '2026-01-02T03:04:05.000Z',
    updatedAt: '2026-01-02T03:04:05.000Z',
    usageCount: 0,
  },
  {
    id: 'two',
    title: 'Troubleshooting',
    shortcut: ';network',
    content: 'Please restart your router.',
    tags: ['connection'],
    groupId: 'support',
    status: 'disabled',
    favorite: false,
    createdAt: '2026-01-02T03:04:05.000Z',
    updatedAt: '2026-01-02T03:04:05.000Z',
    usageCount: 0,
  },
];

describe('snippet search and filtering', () => {
  it('searches title, shortcut, and content', () => {
    expect(searchSnippets(snippets, 'refund').map((snippet) => snippet.id)).toEqual(['one']);
    expect(searchSnippets(snippets, ';network').map((snippet) => snippet.id)).toEqual(['two']);
    expect(searchSnippets(snippets, 'restart your router').map((snippet) => snippet.id)).toEqual([
      'two',
    ]);
    expect(searchSnippets(snippets, 'payment status').map((snippet) => snippet.id)).toEqual([
      'one',
    ]);
    expect(searchSnippets(snippets, 'billing').map((snippet) => snippet.id)).toEqual(['one']);
    expect(searchSnippets(snippets, 'PAYMENT STATUS').map((snippet) => snippet.id)).toEqual([
      'one',
    ]);
  });

  it('combines group, favorite, and enabled filters with search', () => {
    expect(
      searchSnippets(snippets, 'payment', { type: 'group', groupId: 'payments' }),
    ).toHaveLength(1);
    expect(
      searchSnippets(snippets, '', { type: 'favorites' }).map((snippet) => snippet.id),
    ).toEqual(['one']);
    expect(searchSnippets(snippets, 'restart', { type: 'enabled' })).toEqual([]);
    expect(
      searchSnippets(snippets, 'router', { type: 'disabled' }).map((snippet) => snippet.id),
    ).toEqual(['two']);
  });
});

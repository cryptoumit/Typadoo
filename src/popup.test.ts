import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Snippet } from './types';
import { createDefaultLibrary } from './storage/defaults';
import { Popup } from './popup';

function stubChrome(storedData: Record<string, unknown> = {}) {
  const openOptionsPage = vi.fn().mockResolvedValue(undefined);
  const data = { ...storedData };
  vi.stubGlobal('chrome', {
    runtime: { openOptionsPage },
    storage: {
      local: {
        get: vi.fn(async (key: string) => ({ [key]: data[key] })),
        set: vi.fn(async (items: Record<string, unknown>) => Object.assign(data, items)),
        remove: vi.fn(async (key: string) => {
          delete data[key];
        }),
      },
    },
  });
  return { openOptionsPage };
}

describe('popup manager action', () => {
  let clipboardDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    clipboardDescriptor = undefined;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (clipboardDescriptor) {
      Object.defineProperty(navigator, 'clipboard', clipboardDescriptor);
    } else {
      Reflect.deleteProperty(navigator, 'clipboard');
    }
  });

  it('opens the extension options page when the manager button is clicked', async () => {
    const { openOptionsPage } = stubChrome();
    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(React.createElement(Popup));
    });

    await act(async () => {
      container.querySelector('button')?.click();
    });

    expect(openOptionsPage).toHaveBeenCalledOnce();
    await act(async () => {
      root.unmount();
    });
  });

  it('shows favorite snippets and copies their content', async () => {
    const library = createDefaultLibrary();
    const snippet: Snippet = {
      id: 'favorite-1',
      title: 'Welcome',
      shortcut: ';welcome',
      content: 'Hello! How can I help?',
      tags: [],
      groupId: library.groups[0].id,
      status: 'enabled',
      favorite: true,
      createdAt: '2026-01-02T03:04:05.000Z',
      updatedAt: '2026-01-02T03:04:05.000Z',
      usageCount: 0,
    };
    library.snippets.push(snippet);
    stubChrome({ 'typadoo.library': library });
    const writeText = vi.fn().mockResolvedValue(undefined);
    clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(React.createElement(Popup));
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(container.textContent).toContain('Welcome');

    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[aria-label="Copy Welcome"]')?.click();
    });

    expect(writeText).toHaveBeenCalledWith(snippet.content);
    await act(async () => {
      root.unmount();
    });
  });
});

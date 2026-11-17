import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Snippet } from './types';
import { createDefaultLibrary } from './storage/defaults';
import { Popup } from './popup';

function stubChrome(
  storedData: Record<string, unknown> = {},
  siteUrl = 'https://support.example.com/ticket/1',
  initialOrigins: string[] = [],
  grantRequest = false,
) {
  const openOptionsPage = vi.fn().mockResolvedValue(undefined);
  const sendMessage = vi.fn().mockResolvedValue({ ok: true });
  const origins = new Set(initialOrigins);
  const request = vi.fn(async ({ origins: requestedOrigins }: { origins: string[] }) => {
    if (grantRequest) requestedOrigins.forEach((origin) => origins.add(origin));
    return grantRequest;
  });
  const remove = vi.fn(async ({ origins: removedOrigins }: { origins: string[] }) => {
    removedOrigins.forEach((origin) => origins.delete(origin));
    return true;
  });
  const data = { ...storedData };
  vi.stubGlobal('chrome', {
    runtime: { openOptionsPage, sendMessage },
    tabs: { query: vi.fn().mockResolvedValue([{ id: 7, url: siteUrl }]) },
    permissions: {
      getAll: vi.fn(async () => ({ origins: [...origins] })),
      request,
      remove,
    },
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
  return { openOptionsPage, request, remove, sendMessage };
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
      container.querySelector<HTMLButtonElement>('.popup-manager-button')?.click();
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

  it('searches non-favorite snippets and copies the matching result', async () => {
    const library = createDefaultLibrary();
    const snippet: Snippet = {
      id: 'search-result',
      title: 'Invoice follow-up',
      shortcut: ';invoice',
      content: 'Your invoice is ready.',
      tags: [],
      groupId: library.groups[0].id,
      status: 'enabled',
      favorite: false,
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

    await act(async () => root.render(React.createElement(Popup)));
    await act(async () => {
      await Promise.resolve();
    });
    const search = container.querySelector<HTMLInputElement>('.popup-search input');
    expect(search).not.toBeNull();
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(search, 'invoice');
      search?.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(container.textContent).toContain('Invoice follow-up');
    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="Copy Invoice follow-up"]')
        ?.click();
    });

    expect(writeText).toHaveBeenCalledWith(snippet.content);
    await act(async () => root.unmount());
  });

  it('requests only the current site after the user enables it', async () => {
    const { request, sendMessage } = stubChrome(
      {},
      'https://support.example.com/tickets/1',
      [],
      true,
    );
    const container = document.createElement('div');
    const root = createRoot(container);
    await act(async () => root.render(React.createElement(Popup)));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(request).not.toHaveBeenCalled();
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[aria-label="Enable Typadoo on site"]')?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(request).toHaveBeenCalledWith({
      origins: ['https://support.example.com/*'],
    });
    expect(sendMessage).toHaveBeenCalledWith({
      type: 'typadoo:enable-current-site',
      tabId: 7,
      originPattern: 'https://support.example.com/*',
    });
    expect(container.textContent).toContain('Automatic expansion enabled');
    await act(async () => root.unmount());
  });

  it('reports denied website access and keeps manual copy available', async () => {
    const { request, sendMessage } = stubChrome();
    const container = document.createElement('div');
    const root = createRoot(container);
    await act(async () => root.render(React.createElement(Popup)));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[aria-label="Enable Typadoo on site"]')?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(request).toHaveBeenCalledWith({
      origins: ['https://support.example.com/*'],
    });
    expect(sendMessage).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Permission was not granted');
    expect(container.querySelector('.popup-manager-button')).not.toBeNull();
    await act(async () => root.unmount());
  });

  it('removes the current site permission and reports revoked access', async () => {
    const pattern = 'https://support.example.com/*';
    const { remove } = stubChrome({}, 'https://support.example.com/tickets/1', [pattern]);
    const container = document.createElement('div');
    const root = createRoot(container);
    await act(async () => root.render(React.createElement(Popup)));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[aria-label="Disable Typadoo on site"]')?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(remove).toHaveBeenCalledWith({ origins: [pattern] });
    expect(container.textContent).toContain('Website access revoked');
    await act(async () => root.unmount());
  });

  it('does not request access on browser pages or broaden existing permissions', async () => {
    const unsupported = stubChrome({}, 'chrome://extensions');
    const unsupportedContainer = document.createElement('div');
    const unsupportedRoot = createRoot(unsupportedContainer);
    await act(async () => unsupportedRoot.render(React.createElement(Popup)));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(unsupportedContainer.textContent).toContain('Open an HTTP or HTTPS website');
    expect(unsupported.request).not.toHaveBeenCalled();
    await act(async () => unsupportedRoot.unmount());

    const broad = stubChrome({}, 'https://support.example.com/tickets/1', ['https://*/*']);
    const broadContainer = document.createElement('div');
    const broadRoot = createRoot(broadContainer);
    await act(async () => broadRoot.render(React.createElement(Popup)));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(broadContainer.textContent).toContain('Enabled by a broader host permission');
    expect(broadContainer.querySelector('[aria-label="Disable Typadoo on site"]')).toBeNull();
    expect(broad.request).not.toHaveBeenCalled();
    await act(async () => broadRoot.unmount());
  });
});

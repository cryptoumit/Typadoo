import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SiteAccessSettings } from './SiteAccessSettings';

function installPermissions(origins: string[], removed = true, granted = true) {
  const getAll = vi.fn(async () => ({ origins }));
  const request = vi.fn(async ({ origins: requestedOrigins }: { origins: string[] }) => {
    if (granted) {
      for (const origin of requestedOrigins) {
        if (!origins.includes(origin)) origins.push(origin);
      }
    }
    return granted;
  });
  const remove = vi.fn(async ({ origins: removedOrigins }: { origins: string[] }) => {
    if (removed) {
      for (const origin of removedOrigins) {
        const index = origins.indexOf(origin);
        if (index >= 0) origins.splice(index, 1);
      }
    }
    return removed;
  });
  vi.stubGlobal('chrome', {
    permissions: {
      getAll,
      request,
      remove,
      onAdded: { addListener: vi.fn(), removeListener: vi.fn() },
      onRemoved: { addListener: vi.fn(), removeListener: vi.fn() },
    },
  });
  return { getAll, request, remove };
}

describe('site access settings', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('lists remembered site grants and their access scope', async () => {
    installPermissions(['https://support.example.com/*', 'https://*.example.org/*', 'http://*/*']);
    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(React.createElement(SiteAccessSettings));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(container.textContent).toContain('Enabled websites');
    expect(container.textContent).toContain('https://support.example.com (all paths and ports)');
    expect(container.textContent).toContain('https://*.example.org (domain and subdomains)');
    expect(container.textContent).toContain('All HTTP websites');
    expect(container.querySelectorAll('.site-permission-list li')).toHaveLength(3);

    await act(async () => root.unmount());
  });

  it('removes a site grant and updates the remembered list', async () => {
    const { remove } = installPermissions(['https://support.example.com/*']);
    const container = document.createElement('div');
    const root = createRoot(container);
    await act(async () => {
      root.render(React.createElement(SiteAccessSettings));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await act(async () => {
      container
        .querySelector<HTMLButtonElement>(
          '[aria-label="Remove access to https://support.example.com/*"]',
        )
        ?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(remove).toHaveBeenCalledWith({ origins: ['https://support.example.com/*'] });
    expect(container.textContent).toContain('Removed access for https://support.example.com/*.');
    expect(container.textContent).toContain('not enabled on any websites');

    await act(async () => root.unmount());
  });

  it('requests and remembers an exact site grant from Settings', async () => {
    const { request } = installPermissions([]);
    const container = document.createElement('div');
    const root = createRoot(container);
    await act(async () => {
      root.render(React.createElement(SiteAccessSettings));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await act(async () => {
      const input = container.querySelector<HTMLInputElement>('input[type="url"]')!;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, 'https://support.example.com/tickets/1');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      container
        .querySelector('.site-permission-add')
        ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(request).toHaveBeenCalledWith({
      origins: ['https://support.example.com/*'],
    });
    expect(container.textContent).toContain(
      'Access enabled for https://support.example.com/*. Chrome will remember this grant.',
    );
    expect(container.querySelector('.site-permission-list')?.textContent).toContain(
      'https://support.example.com/*',
    );

    await act(async () => root.unmount());
  });

  it('does not add a site when Chrome denies the permission request', async () => {
    const { request } = installPermissions([], true, false);
    const container = document.createElement('div');
    const root = createRoot(container);
    await act(async () => {
      root.render(React.createElement(SiteAccessSettings));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await act(async () => {
      const input = container.querySelector<HTMLInputElement>('input[type="url"]')!;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, 'https://support.example.com');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      container
        .querySelector('.site-permission-add')
        ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(request).toHaveBeenCalledOnce();
    expect(container.textContent).toContain(
      'Chrome did not grant access. No website permission was added.',
    );
    expect(container.querySelector('.site-permission-list')).toBeNull();

    await act(async () => root.unmount());
  });

  it('does not request a narrower grant when an existing permission already covers the site', async () => {
    const { request } = installPermissions(['https://*.example.com/*']);
    const container = document.createElement('div');
    const root = createRoot(container);
    await act(async () => {
      root.render(React.createElement(SiteAccessSettings));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await act(async () => {
      const input = container.querySelector<HTMLInputElement>('input[type="url"]')!;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, 'https://support.example.com/tickets/1');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      container
        .querySelector('.site-permission-add')
        ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(request).not.toHaveBeenCalled();
    expect(container.textContent).toContain(
      'This website is already covered by https://*.example.com/*.',
    );

    await act(async () => root.unmount());
  });

  it('rejects non-HTTP website URLs without asking Chrome for access', async () => {
    const { request } = installPermissions([]);
    const container = document.createElement('div');
    const root = createRoot(container);
    await act(async () => {
      root.render(React.createElement(SiteAccessSettings));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await act(async () => {
      const input = container.querySelector<HTMLInputElement>('input[type="url"]')!;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, 'chrome://extensions');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      container
        .querySelector('.site-permission-add')
        ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(request).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Enter a full HTTP or HTTPS website URL.');

    await act(async () => root.unmount());
  });

  it('keeps the grant visible and reports when Chrome refuses removal', async () => {
    const { remove } = installPermissions(['https://support.example.com/*'], false);
    const container = document.createElement('div');
    const root = createRoot(container);
    await act(async () => {
      root.render(React.createElement(SiteAccessSettings));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await act(async () => {
      container
        .querySelector<HTMLButtonElement>(
          '[aria-label="Remove access to https://support.example.com/*"]',
        )
        ?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(remove).toHaveBeenCalledOnce();
    expect(container.textContent).toContain('Chrome did not remove this website permission.');
    expect(container.textContent).toContain('https://support.example.com/*');

    await act(async () => root.unmount());
  });
});

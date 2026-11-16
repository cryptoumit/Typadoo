import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ManagerApp } from './ManagerApp';
import { createDefaultLibrary } from '../storage/defaults';

function installChromeStorage() {
  const data: Record<string, unknown> = {};
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('chrome', {
    runtime: { openOptionsPage: vi.fn().mockResolvedValue(undefined) },
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
  return data;
}

function setValue(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype =
    element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  setter?.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
}

function setSelectValue(element: HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
  setter?.call(element, value);
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('snippet management workspace', () => {
  let stored: Record<string, unknown>;

  beforeEach(() => {
    stored = installChromeStorage();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('shows required-field feedback and creates a snippet through the shared services', async () => {
    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(React.createElement(ManagerApp));
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>('.button-primary')?.click();
    });

    expect(container.textContent).toContain('Your library is ready for its first snippet');
    const dialog = container.querySelector('dialog');
    expect(dialog).not.toBeNull();
    await act(async () => {
      dialog
        ?.querySelector('form')
        ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(dialog?.textContent).toContain('Enter a title.');
    expect(dialog?.textContent).toContain('Enter snippet content.');

    await act(async () => {
      setValue(dialog!.querySelector<HTMLInputElement>('#snippet-title')!, 'Welcome');
      setValue(dialog!.querySelector<HTMLInputElement>('#snippet-shortcut')!, ';welcome');
      setValue(dialog!.querySelector<HTMLTextAreaElement>('#snippet-content')!, 'Hello there.');
    });
    await act(async () => {
      dialog
        ?.querySelector('form')
        ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(container.textContent).toContain('Welcome');
    expect(container.textContent).toContain(';welcome');
    expect(container.textContent).toContain('Hello there.');
    expect(stored['typadoo.library']).toMatchObject({
      snippets: [expect.objectContaining({ title: 'Welcome', shortcut: ';welcome' })],
    });

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[aria-label="Duplicate Welcome"]')?.click();
    });
    expect((stored['typadoo.library'] as { snippets: unknown[] }).snippets).toHaveLength(2);
    expect(container.textContent).toContain('Copy of Welcome');
    expect(container.textContent).toContain(';welcome-copy');

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const duplicateCard = Array.from(container.querySelectorAll<HTMLElement>('.snippet-card')).find(
      (card) => card.textContent?.includes('Copy of Welcome'),
    );
    await act(async () => {
      if (duplicateCard) {
        Array.from(duplicateCard.querySelectorAll<HTMLButtonElement>('button'))
          .find((button) => button.textContent === 'Delete')
          ?.click();
      }
    });
    expect((stored['typadoo.library'] as { snippets: unknown[] }).snippets).toHaveLength(1);
    expect(container.textContent).toContain('Welcome');
    expect(container.textContent).not.toContain('Copy of Welcome');

    await act(async () => {
      Array.from(container.querySelectorAll('button'))
        .find((button) => button.textContent?.includes('Add snippet'))
        ?.click();
    });
    const duplicateDialog = container.querySelector('dialog');
    await act(async () => {
      setValue(duplicateDialog!.querySelector<HTMLInputElement>('#snippet-title')!, 'Duplicate');
      setValue(duplicateDialog!.querySelector<HTMLInputElement>('#snippet-shortcut')!, ';welcome');
      setValue(
        duplicateDialog!.querySelector<HTMLTextAreaElement>('#snippet-content')!,
        'Another response',
      );
    });
    await act(async () => {
      duplicateDialog
        ?.querySelector('form')
        ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(duplicateDialog?.textContent).toContain('That shortcut is already in use.');
    expect((stored['typadoo.library'] as { snippets: unknown[] }).snippets).toHaveLength(1);

    await act(async () => root.unmount());
  });

  it('applies and persists a theme immediately when the appearance setting changes', async () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    await act(async () => root.render(React.createElement(ManagerApp)));
    await act(async () => {
      Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
        .find((button) => button.textContent === 'Settings')
        ?.click();
    });

    const appearance = container.querySelector<HTMLSelectElement>('.settings-form select');
    expect(appearance).not.toBeNull();
    await act(async () => setSelectValue(appearance!, 'dark'));

    expect(document.documentElement.dataset.theme).toBe('dark');
    expect((stored['typadoo.library'] as { settings: { theme: string } }).settings.theme).toBe(
      'dark',
    );
    await act(async () => root.unmount());
  });

  it('requires a destination choice and moves snippets to the selected group on group deletion', async () => {
    const library = createDefaultLibrary(new Date('2025-01-01T00:00:00.000Z'));
    library.snippets.push({
      id: 'snippet-to-move',
      title: 'Billing response',
      shortcut: ';billing',
      content: 'Billing help',
      tags: [],
      groupId: 'group-account-security',
      status: 'enabled',
      favorite: false,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      usageCount: 0,
    });
    stored['typadoo.library'] = library;

    const container = document.createElement('div');
    const root = createRoot(container);
    await act(async () => root.render(React.createElement(ManagerApp)));

    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('[aria-label="Delete Account & Security"]')
        ?.click();
    });
    const dialog = container.querySelector<HTMLDialogElement>('dialog');
    expect(dialog?.textContent).toContain('will move its 1 snippet');
    const destination = dialog?.querySelector<HTMLSelectElement>('select');
    expect(destination?.value).toBe('');
    expect(dialog?.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(false);

    await act(async () => {
      dialog
        ?.querySelector('form')
        ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(dialog?.textContent).toContain('Choose a destination group.');
    expect((stored['typadoo.library'] as typeof library).groups).toContainEqual(
      expect.objectContaining({ id: 'group-account-security' }),
    );

    await act(async () => setSelectValue(destination!, 'group-internal-notes'));
    await act(async () => {
      dialog
        ?.querySelector('form')
        ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    const updatedLibrary = stored['typadoo.library'] as typeof library;
    expect(updatedLibrary.groups).not.toContainEqual(
      expect.objectContaining({ id: 'group-account-security' }),
    );
    expect(updatedLibrary.snippets[0].groupId).toBe('group-internal-notes');

    await act(async () => root.unmount());
  });
});

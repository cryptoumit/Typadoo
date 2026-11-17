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
    permissions: {
      getAll: vi.fn(async () => ({ origins: [] })),
      remove: vi.fn().mockResolvedValue(true),
      onAdded: { addListener: vi.fn(), removeListener: vi.fn() },
      onRemoved: { addListener: vi.fn(), removeListener: vi.fn() },
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

    const originalCard = Array.from(container.querySelectorAll<HTMLElement>('.snippet-card')).find(
      (card) => card.textContent?.includes('Welcome'),
    );
    await act(async () => {
      Array.from(originalCard?.querySelectorAll<HTMLButtonElement>('button') ?? [])
        .find((button) => button.textContent === 'Edit')
        ?.click();
    });
    const editDialog = container.querySelector('dialog');
    await act(async () => {
      setValue(
        editDialog!.querySelector<HTMLTextAreaElement>('#snippet-content')!,
        'Updated greeting.',
      );
      editDialog
        ?.querySelector('form')
        ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(stored['typadoo.library']).toMatchObject({
      snippets: [expect.objectContaining({ title: 'Welcome', content: 'Updated greeting.' })],
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

  it('saves the selected automatic trigger and explicit-trigger preference', async () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    await act(async () => root.render(React.createElement(ManagerApp)));
    await act(async () => {
      Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
        .find((button) => button.textContent === 'Settings')
        ?.click();
    });

    const trigger = container.querySelectorAll<HTMLSelectElement>('.settings-form select')[1];
    expect(trigger).toBeDefined();
    await act(async () => setSelectValue(trigger, 'tab'));
    expect(trigger.value).toBe('tab');
    const explicitTrigger = container.querySelector<HTMLInputElement>(
      '.settings-form input[type="checkbox"]',
    );
    expect(explicitTrigger?.checked).toBe(true);
    await act(async () => {
      container
        .querySelector('.settings-form')
        ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(container.textContent).toContain('Settings saved.');
    expect(
      (stored['typadoo.library'] as { settings: Record<string, unknown> }).settings,
    ).toMatchObject({
      triggerMode: 'tab',
      expandOnSpace: false,
      expandOnTab: true,
      requireExplicitTrigger: true,
    });
    await act(async () => root.unmount());
  });

  it('requires a destination choice and moves snippets to the selected group on group deletion', async () => {
    const library = createDefaultLibrary(new Date('2025-01-01T00:00:00.000Z'));
    library.groups.push({
      id: 'group-custom',
      name: 'Temporary group',
      sortOrder: library.groups.length,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      isDefault: false,
    });
    library.snippets.push({
      id: 'snippet-to-move',
      title: 'Billing response',
      shortcut: ';billing',
      content: 'Billing help',
      tags: [],
      groupId: 'group-custom',
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
    expect(container.querySelector('[aria-label="Delete General Support"]')).toBeNull();
    expect(container.textContent).toContain("Can't delete");

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[aria-label="Delete Temporary group"]')?.click();
    });
    const dialog = container.querySelector<HTMLDialogElement>('dialog');
    expect(dialog?.textContent).toContain('will move its 1 snippet');
    const destination = dialog?.querySelector<HTMLSelectElement>('select');
    expect(destination?.value).toBe('group-general-support');
    expect(dialog?.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(false);

    await act(async () => setSelectValue(destination!, ''));
    await act(async () => {
      dialog
        ?.querySelector('form')
        ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(dialog?.textContent).toContain('Choose a destination group.');
    expect((stored['typadoo.library'] as typeof library).groups).toContainEqual(
      expect.objectContaining({ id: 'group-custom' }),
    );

    await act(async () => setSelectValue(destination!, 'group-internal-notes'));
    await act(async () => {
      dialog
        ?.querySelector('form')
        ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    const updatedLibrary = stored['typadoo.library'] as typeof library;
    expect(updatedLibrary.groups).not.toContainEqual(
      expect.objectContaining({ id: 'group-custom' }),
    );
    expect(updatedLibrary.snippets[0].groupId).toBe('group-internal-notes');

    await act(async () => root.unmount());
  });
});

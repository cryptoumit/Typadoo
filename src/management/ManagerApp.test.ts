import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ManagerApp } from './ManagerApp';

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

describe('snippet management workspace', () => {
  let stored: Record<string, unknown>;

  beforeEach(() => {
    stored = installChromeStorage();
  });

  afterEach(() => {
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
});

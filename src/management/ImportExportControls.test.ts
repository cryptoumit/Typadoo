import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultLibrary } from '../storage/defaults';
import { LibraryRepository } from '../storage/repository';
import { MemoryStorage } from '../test/memory-storage';
import { ImportExportControls } from './ImportExportControls';

describe('backup controls', () => {
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('exports the current library as a downloadable JSON file', async () => {
    const repository = new LibraryRepository(new MemoryStorage());
    await repository.getLibrary();
    const createObjectURL = vi.fn(() => 'blob:typadoo-backup');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(React.createElement(ImportExportControls, { repository }));
    });
    await act(async () => {
      container.querySelector('button')?.click();
    });

    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:typadoo-backup');
    expect(container.textContent).toContain('Backup exported.');
    await act(async () => root.unmount());
  });

  it('confirms replacement and routes JSON imports through the storage service', async () => {
    const repository = new LibraryRepository(new MemoryStorage());
    await repository.getLibrary();
    const imported = createDefaultLibrary();
    imported.settings.theme = 'dark';
    const onImported = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(React.createElement(ImportExportControls, { repository, onImported }));
    });
    const input = container.querySelector('input[type="file"]');
    expect(input).not.toBeNull();
    const mockFile = {
      text: vi.fn().mockResolvedValue(JSON.stringify(imported)),
    } as unknown as File;
    Object.defineProperty(input, 'files', { configurable: true, value: [mockFile] });
    await act(async () => {
      input?.dispatchEvent(new Event('change', { bubbles: true }));
      await Promise.resolve();
    });

    expect(window.confirm).toHaveBeenCalledOnce();
    expect(onImported).toHaveBeenCalledOnce();
    expect((await repository.getLibrary()).settings.theme).toBe('dark');
    expect(container.textContent).toContain('Imported 0 snippets');
    await act(async () => root.unmount());
  });

  it('shows import validation errors and leaves stored data untouched', async () => {
    const repository = new LibraryRepository(new MemoryStorage());
    const original = await repository.getLibrary();
    const onImported = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(React.createElement(ImportExportControls, { repository, onImported }));
    });
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).not.toBeNull();
    const mockFile = {
      text: vi.fn().mockResolvedValue(JSON.stringify({ version: 400, snippets: [], groups: [] })),
    } as unknown as File;
    Object.defineProperty(input, 'files', { configurable: true, value: [mockFile] });
    await act(async () => {
      input!.dispatchEvent(new Event('change', { bubbles: true }));
      await Promise.resolve();
    });

    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'unsupported schema version',
    );
    expect(onImported).not.toHaveBeenCalled();
    expect(await repository.getLibrary()).toEqual(original);
    await act(async () => root.unmount());
  });

  it('reports file-read errors without invoking the import callback', async () => {
    const repository = new LibraryRepository(new MemoryStorage());
    await repository.getLibrary();
    const onImported = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(React.createElement(ImportExportControls, { repository, onImported }));
    });
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    const mockFile = {
      text: vi.fn().mockRejectedValue(new Error('File could not be read')),
    } as unknown as File;
    Object.defineProperty(input, 'files', { configurable: true, value: [mockFile] });
    await act(async () => {
      input!.dispatchEvent(new Event('change', { bubbles: true }));
      await Promise.resolve();
    });

    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'File could not be read',
    );
    expect(onImported).not.toHaveBeenCalled();
    await act(async () => root.unmount());
  });
});

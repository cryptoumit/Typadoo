import { describe, expect, it } from 'vitest';
import { importLibraryJson } from './import-export';
import {
  LIBRARY_STORAGE_KEY,
  LibraryRepository,
  RECOVERY_STORAGE_KEY,
  StorageOperationError,
} from './repository';
import { createDefaultLibrary } from './defaults';
import { MemoryStorage } from '../test/memory-storage';
import { LibraryValidationError } from './schema';

describe('library repository', () => {
  it('initializes defaults and persists them locally', async () => {
    const storage = new MemoryStorage();
    const repository = new LibraryRepository(storage);

    const library = await repository.getLibrary();

    expect(library.snippets).toEqual([]);
    expect(library.groups).toHaveLength(7);
    expect(storage.values.get(LIBRARY_STORAGE_KEY)).toEqual(library);
  });

  it('propagates storage read and write failures', async () => {
    const readStorage = new MemoryStorage();
    readStorage.failNextGetFor = LIBRARY_STORAGE_KEY;
    await expect(new LibraryRepository(readStorage).getLibrary()).rejects.toBeInstanceOf(
      StorageOperationError,
    );

    const writeStorage = new MemoryStorage();
    writeStorage.failNextSetFor = LIBRARY_STORAGE_KEY;
    await expect(new LibraryRepository(writeStorage).getLibrary()).rejects.toBeInstanceOf(
      StorageOperationError,
    );
  });

  it('does not silently replace malformed stored data', async () => {
    const storage = new MemoryStorage();
    const malformed = { version: 1, snippets: [] };
    storage.values.set(LIBRARY_STORAGE_KEY, malformed);

    await expect(new LibraryRepository(storage).getLibrary()).rejects.toBeInstanceOf(
      LibraryValidationError,
    );
    expect(storage.values.get(LIBRARY_STORAGE_KEY)).toEqual(malformed);
  });

  it('backs up existing data before replacement and supports recovery', async () => {
    const storage = new MemoryStorage();
    const repository = new LibraryRepository(storage);
    const original = await repository.getLibrary();
    const imported = createDefaultLibrary();
    imported.settings.theme = 'dark';

    await importLibraryJson(JSON.stringify(imported), repository);
    expect((await repository.getLibrary()).settings.theme).toBe('dark');
    expect(storage.values.has(RECOVERY_STORAGE_KEY)).toBe(true);

    await repository.restoreRecoveryBackup();
    expect((await repository.getLibrary()).settings.theme).toBe(original.settings.theme);
    expect((await repository.getRecoveryBackup())?.data).toEqual(imported);
  });

  it('rolls back when the replacement write fails', async () => {
    const storage = new MemoryStorage();
    const repository = new LibraryRepository(storage);
    const original = await repository.getLibrary();
    const imported = createDefaultLibrary();
    imported.settings.theme = 'dark';
    storage.failNextSetFor = LIBRARY_STORAGE_KEY;

    await expect(importLibraryJson(JSON.stringify(imported), repository)).rejects.toBeInstanceOf(
      StorageOperationError,
    );
    expect(await repository.getLibrary()).toEqual(original);
  });

  it('leaves existing data unchanged if the recovery backup cannot be written', async () => {
    const storage = new MemoryStorage();
    const repository = new LibraryRepository(storage);
    const original = await repository.getLibrary();
    const imported = createDefaultLibrary();
    imported.settings.theme = 'dark';
    storage.failNextSetFor = RECOVERY_STORAGE_KEY;

    await expect(repository.replaceLibrary(imported)).rejects.toBeInstanceOf(StorageOperationError);
    expect(await repository.getLibrary()).toEqual(original);
  });
});

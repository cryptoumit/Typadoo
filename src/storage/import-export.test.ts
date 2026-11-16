import { describe, expect, it } from 'vitest';
import { createDefaultLibrary } from './defaults';
import { exportLibraryJson, importLibraryJson, ImportFileError } from './import-export';
import { LibraryRepository, LIBRARY_STORAGE_KEY } from './repository';
import { LibraryValidationError } from './schema';
import { MemoryStorage } from '../test/memory-storage';

describe('library JSON import/export', () => {
  it('round-trips an exported library through validated import', async () => {
    const library = createDefaultLibrary();
    const json = exportLibraryJson(library);
    const storage = new MemoryStorage();
    const repository = new LibraryRepository(storage);

    const result = await importLibraryJson(json, repository);

    expect(result).toEqual({ importedCount: 0, skippedCount: 0, issues: [] });
    expect(await repository.getLibrary()).toEqual(library);
  });

  it('rejects malformed, unsupported, or unknown imported data without changing storage', async () => {
    const storage = new MemoryStorage();
    const repository = new LibraryRepository(storage);
    const existing = await repository.getLibrary();

    await expect(importLibraryJson('{bad json', repository)).rejects.toBeInstanceOf(
      ImportFileError,
    );
    await expect(
      importLibraryJson(JSON.stringify({ ...existing, version: 2 }), repository),
    ).rejects.toBeInstanceOf(LibraryValidationError);
    await expect(
      importLibraryJson(JSON.stringify({ ...existing, surprise: 'data' }), repository),
    ).rejects.toBeInstanceOf(LibraryValidationError);

    expect(storage.values.get(LIBRARY_STORAGE_KEY)).toEqual(existing);
  });

  it('rejects an oversized import before parsing it', async () => {
    const repository = new LibraryRepository(new MemoryStorage());

    await expect(importLibraryJson(' '.repeat(8_000_001), repository)).rejects.toBeInstanceOf(
      ImportFileError,
    );
  });
});

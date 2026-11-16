import type { RecoveryBackup, SnippetLibrary } from '../types';
import { createDefaultLibrary } from './defaults';
import { assertValidLibrary, parseLibraryData } from './schema';

export const LIBRARY_STORAGE_KEY = 'typadoo.library';
export const RECOVERY_STORAGE_KEY = 'typadoo.recoveryBackup';

export interface StoragePort {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  remove(key: string): Promise<void>;
}

export class StorageOperationError extends Error {
  constructor(
    public readonly operation: string,
    public readonly cause: unknown,
  ) {
    super(`Chrome local storage ${operation} failed`);
    this.name = 'StorageOperationError';
  }
}

export function createChromeStoragePort(): StoragePort {
  return {
    async get(key) {
      try {
        const values = await chrome.storage.local.get(key);
        return values[key];
      } catch (error) {
        throw new StorageOperationError('read', error);
      }
    },
    async set(key, value) {
      try {
        await chrome.storage.local.set({ [key]: value });
      } catch (error) {
        throw new StorageOperationError('write', error);
      }
    },
    async remove(key) {
      try {
        await chrome.storage.local.remove(key);
      } catch (error) {
        throw new StorageOperationError('remove', error);
      }
    },
  };
}

export class LibraryRepository {
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly storage: StoragePort) {}

  getLibrary(): Promise<SnippetLibrary> {
    return this.enqueue(() => this.readLibrary());
  }

  updateLibrary(update: (library: SnippetLibrary) => SnippetLibrary): Promise<SnippetLibrary> {
    return this.enqueue(async () => {
      const current = await this.readLibrary();
      const updated = update(current);
      assertValidLibrary(updated);
      await this.writeValue(LIBRARY_STORAGE_KEY, updated);
      return updated;
    });
  }

  replaceLibrary(library: SnippetLibrary): Promise<SnippetLibrary> {
    assertValidLibrary(library);
    return this.enqueue(async () => {
      const previous = await this.readValue(LIBRARY_STORAGE_KEY);
      if (previous !== undefined) {
        const backup: RecoveryBackup = {
          version: 1,
          savedAt: new Date().toISOString(),
          data: previous,
        };
        await this.writeValue(RECOVERY_STORAGE_KEY, backup);
      }

      try {
        await this.writeValue(LIBRARY_STORAGE_KEY, library);
      } catch (writeError) {
        try {
          if (previous === undefined) {
            await this.removeValue(LIBRARY_STORAGE_KEY);
          } else {
            await this.writeValue(LIBRARY_STORAGE_KEY, previous);
          }
        } catch (rollbackError) {
          throw new StorageOperationError('replace and rollback', {
            writeError,
            rollbackError,
          });
        }
        throw writeError;
      }

      return library;
    });
  }

  getRecoveryBackup(): Promise<RecoveryBackup | null> {
    return this.enqueue(async () => {
      const backup = await this.readValue(RECOVERY_STORAGE_KEY);
      if (backup === undefined) {
        return null;
      }
      if (
        typeof backup !== 'object' ||
        backup === null ||
        Array.isArray(backup) ||
        !('version' in backup) ||
        !('savedAt' in backup) ||
        !('data' in backup) ||
        backup.version !== 1 ||
        typeof backup.savedAt !== 'string'
      ) {
        throw new StorageOperationError('read recovery backup', 'The backup record is malformed');
      }
      return backup as RecoveryBackup;
    });
  }

  async restoreRecoveryBackup(): Promise<SnippetLibrary> {
    const backup = await this.getRecoveryBackup();
    if (backup === null) {
      throw new StorageOperationError('restore recovery backup', 'No recovery backup is available');
    }
    const library = parseLibraryData(backup.data);
    return this.replaceLibrary(library);
  }

  private async readLibrary(): Promise<SnippetLibrary> {
    const stored = await this.readValue(LIBRARY_STORAGE_KEY);
    if (stored === undefined) {
      const defaults = createDefaultLibrary();
      await this.writeValue(LIBRARY_STORAGE_KEY, defaults);
      return defaults;
    }
    return parseLibraryData(stored);
  }

  private async readValue(key: string): Promise<unknown> {
    try {
      return await this.storage.get(key);
    } catch (error) {
      if (error instanceof StorageOperationError) {
        throw error;
      }
      throw new StorageOperationError('read', error);
    }
  }

  private async writeValue(key: string, value: unknown): Promise<void> {
    try {
      await this.storage.set(key, value);
    } catch (error) {
      if (error instanceof StorageOperationError) {
        throw error;
      }
      throw new StorageOperationError('write', error);
    }
  }

  private async removeValue(key: string): Promise<void> {
    try {
      await this.storage.remove(key);
    } catch (error) {
      if (error instanceof StorageOperationError) {
        throw error;
      }
      throw new StorageOperationError('remove', error);
    }
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation);
    this.queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}

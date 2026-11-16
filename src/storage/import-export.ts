import type { ImportReport, SnippetLibrary } from '../types';
import { LibraryRepository } from './repository';
import { parseLibraryData } from './schema';

export const MAX_IMPORT_SIZE = 8_000_000;

export class ImportFileError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'ImportFileError';
  }
}

export function exportLibraryJson(library: SnippetLibrary): string {
  parseLibraryData(library);
  return JSON.stringify(library, null, 2);
}

export async function exportStoredLibrary(repository: LibraryRepository): Promise<string> {
  return exportLibraryJson(await repository.getLibrary());
}

export async function importLibraryJson(
  json: string,
  repository: LibraryRepository,
): Promise<ImportReport> {
  if (json.length > MAX_IMPORT_SIZE) {
    throw new ImportFileError(`Import file exceeds the ${MAX_IMPORT_SIZE} character limit`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (error) {
    throw new ImportFileError('Import file is not valid JSON', error);
  }

  const library = parseLibraryData(parsed);
  await repository.replaceLibrary(library);
  return {
    importedCount: library.snippets.length,
    skippedCount: 0,
    issues: [],
  };
}

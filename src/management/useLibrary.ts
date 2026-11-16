import { useCallback, useEffect, useState } from 'react';
import type { SnippetLibrary } from '../types';
import { libraryRepository } from './client';

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

export function useLibrary() {
  const [library, setLibrary] = useState<SnippetLibrary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoadError(null);
    try {
      setLibrary(await libraryRepository.getLibrary());
    } catch (error) {
      setLoadError(getErrorMessage(error));
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void libraryRepository
      .getLibrary()
      .then((storedLibrary) => {
        if (active) {
          setLibrary(storedLibrary);
          setLoadError(null);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setLoadError(getErrorMessage(error));
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  return { library, loading, loadError, reload };
}

import React, { useRef, useState } from 'react';
import { exportStoredLibrary, importLibraryJson } from '../storage/import-export';
import type { LibraryRepository } from '../storage/repository';
import { libraryRepository } from './client';

interface ImportExportControlsProps {
  repository?: LibraryRepository;
  onImported?: () => Promise<void>;
}

export function ImportExportControls({
  repository = libraryRepository,
  onImported,
}: ImportExportControlsProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function exportBackup() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const json = await exportStoredLibrary(repository);
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `typadoo-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setMessage('Backup exported.');
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'Could not export a backup.');
    } finally {
      setBusy(false);
    }
  }

  async function importBackup(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    setMessage(null);
    setError(null);

    if (
      !window.confirm(
        'Importing replaces your current snippets, groups, and settings. A recovery backup will be saved first. Continue?',
      )
    ) {
      input.value = '';
      return;
    }

    setBusy(true);
    try {
      const report = await importLibraryJson(await file.text(), repository);
      await onImported?.();
      setMessage(`Imported ${report.importedCount} snippets and their groups and settings.`);
    } catch (importError) {
      setError(
        importError instanceof Error ? importError.message : 'Could not import this backup.',
      );
    } finally {
      input.value = '';
      setBusy(false);
    }
  }

  return (
    <section className="backup-panel" aria-labelledby="backup-title">
      <div>
        <h2 id="backup-title">Backup &amp; restore</h2>
        <p className="muted">
          Export a local JSON backup or replace this library from a validated backup.
        </p>
      </div>
      <div className="backup-actions">
        <button
          className="button button-secondary"
          type="button"
          onClick={() => void exportBackup()}
          disabled={busy}
        >
          {busy ? 'Working…' : 'Export JSON'}
        </button>
        <button
          className="button button-quiet"
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={busy}
        >
          Import JSON
        </button>
        <input
          ref={fileInput}
          className="visually-hidden"
          type="file"
          accept="application/json,.json"
          aria-label="Choose a Typadoo JSON backup to import"
          onChange={(event) => void importBackup(event)}
        />
      </div>
      {message && (
        <p className="notice notice-success" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

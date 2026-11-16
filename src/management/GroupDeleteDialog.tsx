import React, { useEffect, useRef, useState } from 'react';
import type { SnippetGroup } from '../types';

interface GroupDeleteDialogProps {
  group: SnippetGroup;
  groups: SnippetGroup[];
  defaultDestinationGroupId: string;
  snippetCount: number;
  onConfirm: (destinationGroupId: string) => Promise<void>;
  onCancel: () => void;
}

export function GroupDeleteDialog({
  group,
  groups,
  defaultDestinationGroupId,
  snippetCount,
  onConfirm,
  onCancel,
}: GroupDeleteDialogProps) {
  const [destinationGroupId, setDestinationGroupId] = useState(defaultDestinationGroupId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  function cancel() {
    if (!saving) onCancel();
  }

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    return () => {
      if (dialog.open) {
        if (typeof dialog.close === 'function') dialog.close();
        else dialog.removeAttribute('open');
      }
    };
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!destinationGroupId) {
      setError('Choose a destination group.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onConfirm(destinationGroupId);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not delete this group.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="dialog dialog-narrow"
      aria-labelledby="delete-group-title"
      aria-describedby="delete-group-description"
      onCancel={(event) => {
        event.preventDefault();
        cancel();
      }}
    >
      <form className="editor-form" onSubmit={(event) => void submit(event)} noValidate>
        <div className="dialog-heading">
          <div>
            <p className="eyebrow">Delete group</p>
            <h2 id="delete-group-title">Move snippets before deleting?</h2>
          </div>
          <button
            className="icon-button"
            type="button"
            onClick={cancel}
            aria-label="Cancel group deletion"
            disabled={saving}
          >
            ×
          </button>
        </div>
        <p id="delete-group-description" className="muted">
          Deleting “{group.name}” will move its {snippetCount} snippet
          {snippetCount === 1 ? '' : 's'} to the group you select below.
        </p>
        <label className="field">
          <span>Destination group</span>
          <select
            autoFocus
            value={destinationGroupId}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'delete-group-error' : undefined}
            onChange={(event) => {
              setDestinationGroupId(event.target.value);
              setError(null);
            }}
            disabled={saving}
          >
            <option value="">Choose a group…</option>
            {groups.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        {error && (
          <p id="delete-group-error" className="notice notice-error" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button className="button button-quiet" type="button" onClick={cancel} disabled={saving}>
            Cancel
          </button>
          <button className="button button-danger-quiet" type="submit" disabled={saving}>
            {saving ? 'Deleting…' : 'Delete group'}
          </button>
        </div>
      </form>
    </dialog>
  );
}

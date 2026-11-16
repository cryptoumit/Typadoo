import React, { useEffect, useRef, useState } from 'react';
import type { GroupDraft, SnippetGroup } from '../types';
import { LibraryValidationError, MAX_DESCRIPTION_LENGTH } from '../storage/schema';

interface GroupFormProps {
  group?: SnippetGroup;
  groups: SnippetGroup[];
  onSave: (draft: GroupDraft) => Promise<void>;
  onCancel: () => void;
}

export function GroupForm({ group, groups, onSave, onCancel }: GroupFormProps) {
  const [name, setName] = useState(group?.name ?? '');
  const [description, setDescription] = useState(group?.description ?? '');
  const [color, setColor] = useState(group?.color ?? '#6d5ce7');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [initialSnapshot] = useState(() =>
    JSON.stringify([group?.name ?? '', group?.description ?? '', group?.color ?? '#6d5ce7']),
  );
  const isDirty = JSON.stringify([name, description, color]) !== initialSnapshot;

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

  useEffect(() => {
    if (!isDirty) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [isDirty]);

  function cancel() {
    if (saving) return;
    if (!isDirty || window.confirm('Discard your unsaved group changes?')) onCancel();
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedName = name.trim();
    if (!normalizedName) {
      setError('Enter a group name.');
      return;
    }
    if (normalizedName.length > 80) {
      setError('Group names must be 80 characters or fewer.');
      return;
    }
    if (
      groups.some(
        (item) =>
          item.id !== group?.id &&
          item.name.trim().toLocaleLowerCase() === normalizedName.toLocaleLowerCase(),
      )
    ) {
      setError('A group with that name already exists.');
      return;
    }
    if (description.length > MAX_DESCRIPTION_LENGTH) {
      setError(`Descriptions must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.`);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave({ name: normalizedName, description: description.trim(), color });
    } catch (saveError) {
      setError(
        saveError instanceof LibraryValidationError
          ? saveError.message
          : saveError instanceof Error
            ? saveError.message
            : 'Could not save this group.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="dialog dialog-narrow"
      aria-labelledby="group-form-title"
      onCancel={(event) => {
        event.preventDefault();
        cancel();
      }}
    >
      <form className="editor-form" onSubmit={(event) => void submit(event)} noValidate>
        <div className="dialog-heading">
          <div>
            <p className="eyebrow">{group ? 'Edit group' : 'New group'}</p>
            <h2 id="group-form-title">{group ? 'Update your group' : 'Create a group'}</h2>
          </div>
          <button
            className="icon-button"
            type="button"
            onClick={cancel}
            aria-label="Close group form"
            disabled={saving}
          >
            ×
          </button>
        </div>

        <label className="field">
          <span>
            Group name <b aria-hidden="true">*</b>
          </span>
          <input
            autoFocus
            disabled={saving}
            maxLength={80}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className="field">
          <span>Description</span>
          <textarea
            maxLength={MAX_DESCRIPTION_LENGTH}
            disabled={saving}
            rows={3}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        <label className="field color-field">
          <span>Group color</span>
          <input
            type="color"
            value={color}
            disabled={saving}
            onChange={(event) => setColor(event.target.value)}
          />
        </label>

        {error && (
          <p className="notice notice-error" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button className="button button-quiet" type="button" disabled={saving} onClick={cancel}>
            Cancel
          </button>
          <button className="button button-primary" type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save group'}
          </button>
        </div>
      </form>
    </dialog>
  );
}

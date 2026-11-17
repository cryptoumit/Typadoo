import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Snippet, SnippetDraft, SnippetGroup } from '../types';
import { isValidShortcut, normalizeShortcut } from '../lib/validation';
import {
  LibraryValidationError,
  MAX_CONTENT_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MAX_TAGS,
  MAX_TAG_LENGTH,
  MAX_TITLE_LENGTH,
} from '../storage/schema';

interface SnippetFormProps {
  snippet?: Snippet;
  snippets: Snippet[];
  groups: SnippetGroup[];
  shortcutPrefix: string;
  onSave: (draft: SnippetDraft) => Promise<void>;
  onCancel: () => void;
}

interface FormValues {
  title: string;
  shortcut: string;
  content: string;
  description: string;
  groupId: string;
  tags: string;
  favorite: boolean;
  enabled: boolean;
}

type FormField = keyof FormValues;
type FieldErrors = Partial<Record<FormField | 'form', string>>;

function initialValues(snippet: Snippet | undefined, defaultGroupId: string): FormValues {
  return {
    title: snippet?.title ?? '',
    shortcut: snippet?.shortcut ?? '',
    content: snippet?.content ?? '',
    description: snippet?.description ?? '',
    groupId: snippet?.groupId ?? defaultGroupId,
    tags: snippet?.tags.join(', ') ?? '',
    favorite: snippet?.favorite ?? false,
    enabled: snippet?.status !== 'disabled',
  };
}

export function SnippetForm({
  snippet,
  snippets,
  groups,
  shortcutPrefix,
  onSave,
  onCancel,
}: SnippetFormProps) {
  const valuesAtOpen = useMemo(
    () => initialValues(snippet, groups[0]?.id ?? ''),
    [snippet, groups],
  );
  const [values, setValues] = useState(valuesAtOpen);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [initialSnapshot] = useState(() => JSON.stringify(valuesAtOpen));
  const isDirty = JSON.stringify(values) !== initialSnapshot;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
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

  function update<K extends FormField>(field: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined, form: undefined }));
  }

  function cancel() {
    if (saving) return;
    if (!isDirty || window.confirm('Discard your unsaved snippet changes?')) {
      onCancel();
    }
  }

  function validate(): { draft: SnippetDraft | null; fieldErrors: FieldErrors } {
    const fieldErrors: FieldErrors = {};
    const title = values.title.trim();
    const shortcut = values.shortcut.trim();
    const content = values.content;
    const tags = values.tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);

    if (!title) fieldErrors.title = 'Enter a title.';
    else if (title.length > MAX_TITLE_LENGTH) {
      fieldErrors.title = `Use ${MAX_TITLE_LENGTH} characters or fewer.`;
    }
    if (!shortcut) fieldErrors.shortcut = 'Enter a shortcut.';
    else if (!isValidShortcut(shortcut, shortcutPrefix)) {
      fieldErrors.shortcut = `Use ${shortcutPrefix} followed by letters, numbers, underscores, or hyphens.`;
    } else if (
      snippets.some(
        (item) =>
          item.id !== snippet?.id &&
          normalizeShortcut(item.shortcut) === normalizeShortcut(shortcut),
      )
    ) {
      fieldErrors.shortcut = 'That shortcut is already in use.';
    }
    if (!content.trim()) fieldErrors.content = 'Enter snippet content.';
    else if (content.length > MAX_CONTENT_LENGTH) {
      fieldErrors.content = `Use ${MAX_CONTENT_LENGTH.toLocaleString()} characters or fewer.`;
    }
    if (!groups.some((group) => group.id === values.groupId)) {
      fieldErrors.groupId = 'Choose a valid group.';
    }
    if (values.description.length > MAX_DESCRIPTION_LENGTH) {
      fieldErrors.description = `Use ${MAX_DESCRIPTION_LENGTH} characters or fewer.`;
    }
    if (tags.length > MAX_TAGS || tags.some((tag) => tag.length > MAX_TAG_LENGTH)) {
      fieldErrors.tags = `Use at most ${MAX_TAGS} tags, each no longer than ${MAX_TAG_LENGTH} characters.`;
    } else if (new Set(tags.map((tag) => tag.toLocaleLowerCase())).size !== tags.length) {
      fieldErrors.tags = 'Remove duplicate tags.';
    }

    if (Object.keys(fieldErrors).length > 0) return { draft: null, fieldErrors };
    return {
      draft: {
        title,
        shortcut,
        content,
        groupId: values.groupId,
        description: values.description.trim() || undefined,
        tags,
        favorite: values.favorite,
        status: values.enabled ? 'enabled' : 'disabled',
      },
      fieldErrors,
    };
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = validate();
    if (!result.draft) {
      setErrors(result.fieldErrors);
      return;
    }

    setSaving(true);
    setErrors({});
    try {
      await onSave(result.draft);
    } catch (error) {
      if (error instanceof LibraryValidationError && error.field.includes('shortcut')) {
        setErrors({ shortcut: error.message });
      } else {
        setErrors({
          form: error instanceof Error ? error.message : 'Could not save this snippet.',
        });
      }
    } finally {
      setSaving(false);
    }
  }

  const field = (name: FormField) => ({
    id: `snippet-${name}`,
    'aria-invalid': Boolean(errors[name]),
    'aria-describedby': errors[name] ? `snippet-${name}-error` : undefined,
  });

  return (
    <dialog
      ref={dialogRef}
      className="dialog"
      aria-labelledby="snippet-form-title"
      onCancel={(event) => {
        event.preventDefault();
        cancel();
      }}
    >
      <form className="editor-form" onSubmit={(event) => void submit(event)} noValidate>
        <div className="dialog-heading">
          <div>
            <p className="eyebrow">{snippet ? 'Edit snippet' : 'New snippet'}</p>
            <h2 id="snippet-form-title">{snippet ? 'Update your response' : 'Create a snippet'}</h2>
          </div>
          <button
            className="icon-button"
            type="button"
            onClick={cancel}
            aria-label="Close snippet form"
            disabled={saving}
          >
            ×
          </button>
        </div>

        <div className="form-grid">
          <label className="field">
            <span>
              Title <b aria-hidden="true">*</b>
            </span>
            <input
              autoFocus
              disabled={saving}
              {...field('title')}
              maxLength={MAX_TITLE_LENGTH}
              value={values.title}
              onChange={(event) => update('title', event.target.value)}
            />
            {errors.title && (
              <small id="snippet-title-error" className="field-error">
                {errors.title}
              </small>
            )}
          </label>

          <label className="field">
            <span>
              Shortcut <b aria-hidden="true">*</b>
            </span>
            <input
              {...field('shortcut')}
              disabled={saving}
              maxLength={43}
              value={values.shortcut}
              onChange={(event) => update('shortcut', event.target.value)}
              placeholder={`${shortcutPrefix}greet`}
            />
            {errors.shortcut && (
              <small id="snippet-shortcut-error" className="field-error">
                {errors.shortcut}
              </small>
            )}
          </label>

          <label className="field field-wide">
            <span>
              Content <b aria-hidden="true">*</b>
            </span>
            <textarea
              {...field('content')}
              disabled={saving}
              maxLength={MAX_CONTENT_LENGTH}
              rows={7}
              value={values.content}
              onChange={(event) => update('content', event.target.value)}
            />
            {errors.content && (
              <small id="snippet-content-error" className="field-error">
                {errors.content}
              </small>
            )}
          </label>

          <div className="field field-wide">
            <span>Preview</span>
            <pre className="content-preview">
              {values.content || 'Your snippet preview will appear here.'}
            </pre>
          </div>

          <label className="field">
            <span>
              Group <b aria-hidden="true">*</b>
            </span>
            <select
              {...field('groupId')}
              disabled={saving}
              value={values.groupId}
              onChange={(event) => update('groupId', event.target.value)}
            >
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
            {errors.groupId && (
              <small id="snippet-groupId-error" className="field-error">
                {errors.groupId}
              </small>
            )}
          </label>

          <label className="field">
            <span>Description</span>
            <input
              {...field('description')}
              disabled={saving}
              maxLength={MAX_DESCRIPTION_LENGTH}
              value={values.description}
              onChange={(event) => update('description', event.target.value)}
            />
            {errors.description && (
              <small id="snippet-description-error" className="field-error">
                {errors.description}
              </small>
            )}
          </label>

          <label className="field field-wide">
            <span>
              Tags <small className="muted">(comma separated)</small>
            </span>
            <input
              {...field('tags')}
              disabled={saving}
              value={values.tags}
              onChange={(event) => update('tags', event.target.value)}
              placeholder="billing, follow-up"
            />
            {errors.tags && (
              <small id="snippet-tags-error" className="field-error">
                {errors.tags}
              </small>
            )}
          </label>
        </div>

        <div className="toggle-row">
          <label className="check-label">
            <input
              type="checkbox"
              disabled={saving}
              checked={values.favorite}
              onChange={(event) => update('favorite', event.target.checked)}
            />
            Favorite
          </label>
          <label className="check-label">
            <input
              type="checkbox"
              disabled={saving}
              checked={values.enabled}
              onChange={(event) => update('enabled', event.target.checked)}
            />
            Enabled
          </label>
        </div>

        {errors.form && (
          <p className="notice notice-error" role="alert">
            {errors.form}
          </p>
        )}
        <div className="form-actions">
          <button className="button button-quiet" type="button" onClick={cancel} disabled={saving}>
            Cancel
          </button>
          <button className="button button-primary" type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save snippet'}
          </button>
        </div>
      </form>
    </dialog>
  );
}

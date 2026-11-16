import React, { useEffect, useState } from 'react';
import type { SnippetLibrary } from '../types';
import { isValidShortcutPrefix } from '../lib/validation';

interface SettingsPanelProps {
  library: SnippetLibrary;
  onSave: (changes: {
    shortcutPrefix: string;
    theme: SnippetLibrary['settings']['theme'];
  }) => Promise<void>;
}

export function SettingsPanel({ library, onSave }: SettingsPanelProps) {
  const [shortcutPrefix, setShortcutPrefix] = useState(library.settings.shortcutPrefix);
  const [theme, setTheme] = useState(library.settings.theme);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setShortcutPrefix(library.settings.shortcutPrefix);
    setTheme(library.settings.theme);
  }, [library.settings.shortcutPrefix, library.settings.theme]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isValidShortcutPrefix(shortcutPrefix)) {
      setError('Use one to three punctuation characters with no spaces.');
      return;
    }

    if (
      shortcutPrefix !== library.settings.shortcutPrefix &&
      library.snippets.length > 0 &&
      !window.confirm(
        `Change the prefix for all ${library.snippets.length} snippets from "${library.settings.shortcutPrefix}" to "${shortcutPrefix}"?`,
      )
    ) {
      return;
    }

    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await onSave({ shortcutPrefix, theme });
      setSaved(true);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save your settings.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="settings-content">
      <header className="section-heading">
        <div>
          <p className="eyebrow">Preferences</p>
          <h2>Settings</h2>
          <p className="muted">Personalize shortcuts and appearance for this browser.</p>
        </div>
      </header>

      <form className="settings-form card" onSubmit={(event) => void submit(event)}>
        <label className="field">
          <span>Shortcut prefix</span>
          <input
            value={shortcutPrefix}
            maxLength={3}
            aria-describedby="prefix-help"
            onChange={(event) => {
              setShortcutPrefix(event.target.value);
              setError(null);
              setSaved(false);
            }}
          />
          <small id="prefix-help" className="muted">
            Shortcuts use this prefix, for example {shortcutPrefix || ';'}greet. Changing it updates
            existing shortcut triggers.
          </small>
        </label>

        <label className="field">
          <span>Appearance</span>
          <select
            value={theme}
            onChange={(event) => {
              const nextTheme = event.target.value;
              if (nextTheme === 'system' || nextTheme === 'light' || nextTheme === 'dark') {
                setTheme(nextTheme);
              }
              setSaved(false);
            }}
          >
            <option value="system">Match device</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>

        <div className="privacy-note">
          <h3>Private by design</h3>
          <p>
            Snippets and preferences stay in this browser's local extension storage. Typadoo does
            not send them to a server.
          </p>
          <p>
            Website access is optional and user-managed through your browser's extension settings.
          </p>
        </div>

        {error && (
          <p className="notice notice-error" role="alert">
            {error}
          </p>
        )}
        {saved && (
          <p className="notice notice-success" role="status">
            Settings saved.
          </p>
        )}
        <div className="form-actions">
          <button className="button button-primary" type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      </form>
    </div>
  );
}

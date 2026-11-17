import React, { useState } from 'react';
import type { SnippetLibrary, TypadooSettings } from '../types';
import { isValidShortcutPrefix } from '../lib/validation';
import { SiteAccessSettings } from './SiteAccessSettings';

interface SettingsPanelProps {
  library: SnippetLibrary;
  onSave: (changes: Partial<TypadooSettings>) => Promise<void>;
  onThemeChange: (theme: SnippetLibrary['settings']['theme']) => Promise<void>;
}

export function SettingsPanel({ library, onSave, onThemeChange }: SettingsPanelProps) {
  const settingsKey = [
    library.settings.shortcutPrefix,
    library.settings.triggerMode,
    library.settings.expandOnSpace,
    library.settings.expandOnTab,
    library.settings.requireExplicitTrigger,
  ].join('\u0000');
  const [shortcutPrefix, setShortcutPrefix] = useState(library.settings.shortcutPrefix);
  const [triggerMode, setTriggerMode] = useState(library.settings.triggerMode);
  const [requireExplicitTrigger, setRequireExplicitTrigger] = useState(
    library.settings.requireExplicitTrigger,
  );
  const [theme, setTheme] = useState(library.settings.theme);
  const [syncedSettingsKey, setSyncedSettingsKey] = useState(settingsKey);
  const [syncedTheme, setSyncedTheme] = useState(library.settings.theme);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingTheme, setSavingTheme] = useState(false);

  if (syncedSettingsKey !== settingsKey) {
    setSyncedSettingsKey(settingsKey);
    setShortcutPrefix(library.settings.shortcutPrefix);
    setTriggerMode(library.settings.triggerMode);
    setRequireExplicitTrigger(library.settings.requireExplicitTrigger);
  }
  if (syncedTheme !== library.settings.theme) {
    setSyncedTheme(library.settings.theme);
    setTheme(library.settings.theme);
  }

  async function changeTheme(nextTheme: SnippetLibrary['settings']['theme']) {
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    setSavingTheme(true);
    setError(null);
    setSaved(false);
    try {
      await onThemeChange(nextTheme);
      setSaved(true);
    } catch (saveError) {
      setTheme(library.settings.theme);
      document.documentElement.dataset.theme = library.settings.theme;
      setError(saveError instanceof Error ? saveError.message : 'Could not save your theme.');
    } finally {
      setSavingTheme(false);
    }
  }

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
      await onSave({
        shortcutPrefix,
        triggerMode,
        expandOnSpace: triggerMode === 'space',
        expandOnTab: triggerMode === 'tab',
        requireExplicitTrigger,
      });
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
            disabled={savingTheme}
            onChange={(event) => {
              const nextTheme = event.target.value;
              if (nextTheme === 'system' || nextTheme === 'light' || nextTheme === 'dark') {
                void changeTheme(nextTheme);
              }
            }}
          >
            <option value="system">Match device</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>

        <label className="field">
          <span>Automatic expansion trigger</span>
          <select
            value={triggerMode}
            onChange={(event) => {
              const nextMode = event.target.value;
              if (nextMode === 'space' || nextMode === 'tab' || nextMode === 'manual') {
                setTriggerMode(nextMode);
                setSaved(false);
              }
            }}
          >
            <option value="space">After Space</option>
            <option value="tab">After Tab</option>
            <option value="manual">Manual copy only</option>
          </select>
          <small className="muted">
            Choose the key that confirms a shortcut, or turn off automatic expansion.
          </small>
        </label>

        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={requireExplicitTrigger}
            disabled={triggerMode === 'manual'}
            onChange={(event) => {
              setRequireExplicitTrigger(event.target.checked);
              setSaved(false);
            }}
          />
          <span>
            Require the trigger key
            <small className="muted">When off, expand as soon as the shortcut is completed.</small>
          </span>
        </label>

        <div className="privacy-note">
          <h3>Private by design</h3>
          <p>
            Snippets and preferences stay in this browser's local extension storage. Typadoo does
            not send them to a server.
          </p>
          <p>Website access is optional and can be managed from the list below.</p>
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
          <button className="button button-primary" type="submit" disabled={saving || savingTheme}>
            {saving || savingTheme ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      </form>
      <SiteAccessSettings />
    </div>
  );
}

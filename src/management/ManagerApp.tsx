import React, { useEffect, useMemo, useState } from 'react';
import type { GroupDraft, Snippet, SnippetDraft, SnippetGroup } from '../types';
import { searchSnippets, type SnippetFilter } from '../services/search';
import { GroupForm } from './GroupForm';
import { groupService, libraryRepository, settingsService, snippetService } from './client';
import { ImportExportControls } from './ImportExportControls';
import { SettingsPanel } from './SettingsPanel';
import { SnippetCard } from './SnippetCard';
import { SnippetForm } from './SnippetForm';
import { getErrorMessage, useLibrary } from './useLibrary';

type View = 'snippets' | 'settings';
type GroupDialogState = { mode: 'create' } | { mode: 'edit'; group: SnippetGroup } | null;

const ALL_FILTER: SnippetFilter = { type: 'all' };
const QUICK_FILTERS: Array<{ label: string; filter: SnippetFilter }> = [
  { label: 'All', filter: { type: 'all' } },
  { label: 'Favorites', filter: { type: 'favorites' } },
  { label: 'Enabled', filter: { type: 'enabled' } },
  { label: 'Disabled', filter: { type: 'disabled' } },
];

export function ManagerApp() {
  const { library, loading, loadError, reload } = useLibrary();
  const [view, setView] = useState<View>('snippets');
  const [filter, setFilter] = useState<SnippetFilter>(ALL_FILTER);
  const [query, setQuery] = useState('');
  const [editingSnippet, setEditingSnippet] = useState<Snippet | null>(null);
  const [snippetFormOpen, setSnippetFormOpen] = useState(false);
  const [groupDialog, setGroupDialog] = useState<GroupDialogState>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const theme = library?.settings.theme;

  useEffect(() => {
    if (theme) document.documentElement.dataset.theme = theme;
  }, [theme]);

  const filteredSnippets = useMemo(
    () => (library ? searchSnippets(library.snippets, query, filter) : []),
    [filter, library, query],
  );

  async function runAction(action: () => Promise<unknown>, successMessage: string) {
    setNotice(null);
    setActionError(null);
    try {
      await action();
      await reload();
      setNotice(successMessage);
    } catch (error) {
      setActionError(getErrorMessage(error));
    }
  }

  async function saveSnippet(draft: SnippetDraft) {
    if (editingSnippet) {
      await snippetService.update(editingSnippet.id, draft);
    } else {
      await snippetService.create(draft);
    }
    await reload();
    setSnippetFormOpen(false);
    setEditingSnippet(null);
    setNotice(editingSnippet ? 'Snippet updated.' : 'Snippet created.');
    setActionError(null);
  }

  function editSnippet(snippet: Snippet) {
    setEditingSnippet(snippet);
    setSnippetFormOpen(true);
  }

  function createSnippet() {
    setEditingSnippet(null);
    setSnippetFormOpen(true);
  }

  async function saveGroup(draft: GroupDraft) {
    if (!groupDialog) return;
    if (groupDialog.mode === 'edit') {
      await groupService.update(groupDialog.group.id, draft);
    } else {
      await groupService.create(draft);
    }
    await reload();
    setGroupDialog(null);
    setNotice(groupDialog.mode === 'edit' ? 'Group updated.' : 'Group created.');
    setActionError(null);
  }

  async function deleteGroup(group: SnippetGroup) {
    if (!library) return;
    const remaining = library.groups
      .filter((item) => item.id !== group.id)
      .sort((left, right) => left.sortOrder - right.sortOrder);
    const destination =
      remaining.find((item) => item.id === 'group-general-support') ?? remaining[0];
    if (!destination) {
      setActionError('At least one group must remain.');
      return;
    }
    const affectedCount = library.snippets.filter((snippet) => snippet.groupId === group.id).length;
    const confirmation =
      affectedCount > 0
        ? `Delete "${group.name}"? Its ${affectedCount} snippet${affectedCount === 1 ? '' : 's'} will be moved to "${destination.name}".`
        : `Delete the empty group "${group.name}"?`;
    if (!window.confirm(confirmation)) return;

    await runAction(
      () => groupService.delete(group.id, destination.id),
      affectedCount > 0
        ? `Group deleted; ${affectedCount} snippet${affectedCount === 1 ? '' : 's'} moved to ${destination.name}.`
        : 'Group deleted.',
    );
    if (filter.type === 'group' && filter.groupId === group.id) setFilter(ALL_FILTER);
  }

  async function copySnippet(snippet: Snippet) {
    await runAction(
      () => navigator.clipboard.writeText(snippet.content),
      `Copied "${snippet.title}" to the clipboard.`,
    );
  }

  if (loading) {
    return (
      <main className="loading-screen" role="status">
        Loading your local snippet library…
      </main>
    );
  }
  if (loadError || !library) {
    return (
      <main className="loading-screen">
        <section className="card load-error">
          <p className="eyebrow">Typadoo</p>
          <h1>We could not open your library</h1>
          <p role="alert">{loadError ?? 'Your local library is unavailable.'}</p>
          <button
            className="button button-primary"
            type="button"
            onClick={() => void reload().catch(() => undefined)}
          >
            Try again
          </button>
        </section>
      </main>
    );
  }

  const title =
    view === 'settings'
      ? 'Settings'
      : filter.type === 'group'
        ? (library.groups.find((group) => group.id === filter.groupId)?.name ?? 'Group')
        : filter.type === 'favorites'
          ? 'Favorites'
          : filter.type === 'enabled'
            ? 'Enabled snippets'
            : filter.type === 'disabled'
              ? 'Disabled snippets'
              : 'All snippets';

  return (
    <div className="manager-layout">
      <aside className="manager-sidebar">
        <a
          className="brand-lockup"
          href="#"
          onClick={(event) => {
            event.preventDefault();
            setView('snippets');
            setFilter(ALL_FILTER);
          }}
        >
          <span className="brand-mark" aria-hidden="true">
            t.
          </span>
          <span>
            <strong>Typadoo</strong>
            <small>Less typing. More doing.</small>
          </span>
        </a>

        <nav className="primary-nav" aria-label="Snippet views">
          <button
            className={`nav-item${filter.type === 'all' && view === 'snippets' ? ' is-active' : ''}`}
            type="button"
            onClick={() => {
              setView('snippets');
              setFilter(ALL_FILTER);
            }}
          >
            <span>All snippets</span>
            <span className="nav-count">{library.snippets.length}</span>
          </button>
          <button
            className={`nav-item${filter.type === 'favorites' ? ' is-active' : ''}`}
            type="button"
            onClick={() => {
              setView('snippets');
              setFilter({ type: 'favorites' });
            }}
          >
            <span>Favorites</span>
            <span className="nav-count">
              {library.snippets.filter((item) => item.favorite).length}
            </span>
          </button>
          <button
            className={`nav-item${filter.type === 'enabled' ? ' is-active' : ''}`}
            type="button"
            onClick={() => {
              setView('snippets');
              setFilter({ type: 'enabled' });
            }}
          >
            Enabled
          </button>
          <button
            className={`nav-item${filter.type === 'disabled' ? ' is-active' : ''}`}
            type="button"
            onClick={() => {
              setView('snippets');
              setFilter({ type: 'disabled' });
            }}
          >
            Disabled
          </button>
        </nav>

        <div className="sidebar-section-heading">
          <h2>Groups</h2>
          <button
            className="icon-button icon-button-small"
            type="button"
            onClick={() => setGroupDialog({ mode: 'create' })}
            aria-label="Add group"
            title="Add group"
          >
            +
          </button>
        </div>
        <nav className="group-nav" aria-label="Snippet groups">
          {library.groups
            .slice()
            .sort((left, right) => left.sortOrder - right.sortOrder)
            .map((group) => (
              <div
                className={`group-nav-row${filter.type === 'group' && filter.groupId === group.id ? ' is-active' : ''}`}
                key={group.id}
              >
                <button
                  className="group-nav-select"
                  type="button"
                  onClick={() => {
                    setView('snippets');
                    setFilter({ type: 'group', groupId: group.id });
                  }}
                  title={group.name}
                >
                  <span
                    className="group-color-dot"
                    style={{ backgroundColor: group.color ?? 'var(--color-primary)' }}
                  />
                  <span className="truncate">{group.name}</span>
                  <span className="nav-count">
                    {library.snippets.filter((item) => item.groupId === group.id).length}
                  </span>
                </button>
                <div className="group-quick-actions">
                  <button
                    className="icon-button icon-button-small"
                    type="button"
                    aria-label={`Edit ${group.name}`}
                    onClick={() => setGroupDialog({ mode: 'edit', group })}
                  >
                    Edit
                  </button>
                  <button
                    className="icon-button icon-button-small"
                    type="button"
                    aria-label={`Delete ${group.name}`}
                    onClick={() => void deleteGroup(group)}
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
        </nav>

        <button
          className={`nav-item sidebar-settings${view === 'settings' ? ' is-active' : ''}`}
          type="button"
          onClick={() => setView('settings')}
        >
          Settings
        </button>
        <p className="sidebar-local-note">
          <span aria-hidden="true">●</span> Stored locally in this browser
        </p>
      </aside>

      <main className="manager-main">
        <div className="manager-content">
          <header className="manager-header">
            <div className="manager-title-block">
              <p className="eyebrow">{view === 'settings' ? 'Preferences' : 'Your workspace'}</p>
              <h1>{title}</h1>
              <p className="muted">
                {view === 'settings'
                  ? 'Customize how Typadoo feels and how your shortcuts are written.'
                  : `${filteredSnippets.length} of ${library.snippets.length} snippet${library.snippets.length === 1 ? '' : 's'}`}
              </p>
            </div>
            <div className="header-actions">
              <details className="backup-disclosure">
                <summary className="button button-secondary">Backup &amp; restore</summary>
                <ImportExportControls repository={libraryRepository} onImported={reload} />
              </details>
              {view === 'snippets' && (
                <button className="button button-primary" type="button" onClick={createSnippet}>
                  <span aria-hidden="true">+</span> Add snippet
                </button>
              )}
            </div>
          </header>

          {actionError && (
            <p className="notice notice-error global-notice" role="alert">
              {actionError}
            </p>
          )}
          {notice && (
            <p className="notice notice-success global-notice" role="status">
              {notice}
            </p>
          )}

          {view === 'settings' ? (
            <SettingsPanel
              library={library}
              onSave={async (changes) => {
                await settingsService.update(changes);
                await reload();
              }}
            />
          ) : (
            <>
              <div className="filter-toolbar">
                <label className="search-field">
                  <span className="search-icon" aria-hidden="true">
                    ⌕
                  </span>
                  <span className="visually-hidden">Search snippets</span>
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search title, shortcut, content, or tag…"
                  />
                  {query && (
                    <button type="button" aria-label="Clear search" onClick={() => setQuery('')}>
                      ×
                    </button>
                  )}
                </label>
                <div className="filter-pills" role="group" aria-label="Quick filters">
                  {QUICK_FILTERS.map(({ label, filter: choice }) => (
                    <button
                      key={label}
                      className={`filter-pill${filter.type === choice.type ? ' is-selected' : ''}`}
                      type="button"
                      aria-pressed={filter.type === choice.type}
                      onClick={() => setFilter(choice)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {filteredSnippets.length > 0 ? (
                <div className="snippet-grid">
                  {filteredSnippets.map((snippet) => (
                    <SnippetCard
                      key={snippet.id}
                      snippet={snippet}
                      group={library.groups.find((group) => group.id === snippet.groupId)}
                      onCopy={(item) => void copySnippet(item)}
                      onEdit={editSnippet}
                      onDelete={(item) => {
                        if (window.confirm(`Delete "${item.title}"? This cannot be undone.`)) {
                          void runAction(() => snippetService.delete(item.id), 'Snippet deleted.');
                        }
                      }}
                      onToggleFavorite={(item) =>
                        void runAction(
                          () => snippetService.update(item.id, { favorite: !item.favorite }),
                          item.favorite ? 'Removed from favorites.' : 'Added to favorites.',
                        )
                      }
                      onToggleEnabled={(item) =>
                        void runAction(
                          () =>
                            snippetService.update(item.id, {
                              status: item.status === 'enabled' ? 'disabled' : 'enabled',
                            }),
                          item.status === 'enabled' ? 'Snippet disabled.' : 'Snippet enabled.',
                        )
                      }
                    />
                  ))}
                </div>
              ) : (
                <section className="empty-state card">
                  <span className="empty-orbit" aria-hidden="true">
                    ✦
                  </span>
                  <h2>{emptyTitle(library, query, filter)}</h2>
                  <p>{emptyDescription(library, query, filter)}</p>
                  {library.snippets.length === 0 && (
                    <button className="button button-primary" type="button" onClick={createSnippet}>
                      Create your first snippet
                    </button>
                  )}
                  {query && (
                    <button
                      className="button button-quiet"
                      type="button"
                      onClick={() => setQuery('')}
                    >
                      Clear search
                    </button>
                  )}
                </section>
              )}
            </>
          )}
        </div>
      </main>

      {snippetFormOpen && (
        <SnippetForm
          snippet={editingSnippet ?? undefined}
          snippets={library.snippets}
          groups={library.groups}
          shortcutPrefix={library.settings.shortcutPrefix}
          onSave={saveSnippet}
          onCancel={() => {
            setSnippetFormOpen(false);
            setEditingSnippet(null);
          }}
        />
      )}
      {groupDialog && (
        <GroupForm
          group={groupDialog.mode === 'edit' ? groupDialog.group : undefined}
          groups={library.groups}
          onSave={saveGroup}
          onCancel={() => setGroupDialog(null)}
        />
      )}
    </div>
  );
}

function emptyTitle(
  library: { snippets: Snippet[] },
  query: string,
  filter: SnippetFilter,
): string {
  if (query.trim()) return 'No matching snippets';
  if (filter.type === 'favorites') return 'No favorites yet';
  if (filter.type === 'group') return 'No snippets in this group';
  if (library.snippets.length === 0) return 'Your library is ready for its first snippet';
  return 'Nothing to show here';
}

function emptyDescription(
  library: { snippets: Snippet[] },
  query: string,
  filter: SnippetFilter,
): string {
  if (query.trim()) return 'Try another search term or clear your search.';
  if (filter.type === 'favorites')
    return 'Mark a snippet as a favorite and it will be easy to find here.';
  if (filter.type === 'group') return 'Add a snippet to this group or choose another group.';
  if (library.snippets.length === 0)
    return 'Create reusable replies and keep them organized in your local library.';
  return 'Try another filter to see more snippets.';
}

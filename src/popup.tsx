import React, { useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import type { Snippet, SnippetLibrary } from './types';
import { libraryRepository } from './management/client';
import { searchSnippets } from './services/search';
import './styles.css';

export function Popup() {
  const [library, setLibrary] = useState<SnippetLibrary | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const theme = library?.settings.theme;

  useEffect(() => {
    if (theme) document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    let active = true;
    void libraryRepository
      .getLibrary()
      .then((storedLibrary) => {
        if (active) setLibrary(storedLibrary);
      })
      .catch((loadError: unknown) => {
        if (active)
          setError(loadError instanceof Error ? loadError.message : 'Could not load snippets.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const visibleSnippets = useMemo(() => {
    if (!library) return [];
    return query.trim()
      ? searchSnippets(library.snippets, query).slice(0, 8)
      : library.snippets.filter((snippet) => snippet.favorite).slice(0, 5);
  }, [library, query]);

  async function copySnippet(snippet: Snippet) {
    setError(null);
    setNotice(null);
    try {
      await navigator.clipboard.writeText(snippet.content);
      setNotice(`Copied "${snippet.title}".`);
    } catch (copyError) {
      setError(copyError instanceof Error ? copyError.message : 'Could not copy this snippet.');
    }
  }

  async function openManager() {
    setError(null);
    try {
      await chrome.runtime.openOptionsPage();
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : 'Could not open the manager page.');
    }
  }

  return (
    <main className="popup-shell">
      <header className="popup-brand">
        <span className="brand-mark" aria-hidden="true">
          t.
        </span>
        <div>
          <strong>Typadoo</strong>
          <p>Less typing. More doing.</p>
        </div>
      </header>

      <label className="search-field popup-search">
        <span className="search-icon" aria-hidden="true">
          ⌕
        </span>
        <span className="visually-hidden">Search snippets</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Find a snippet…"
        />
        {query && (
          <button type="button" aria-label="Clear search" onClick={() => setQuery('')}>
            ×
          </button>
        )}
      </label>

      {loading ? (
        <p className="popup-state" role="status">
          Loading your snippets…
        </p>
      ) : error && !library ? (
        <p className="popup-state notice-error" role="alert">
          {error}
        </p>
      ) : visibleSnippets.length > 0 ? (
        <section
          className="popup-snippets"
          aria-label={query ? 'Search results' : 'Favorite snippets'}
        >
          <div className="popup-section-heading">
            <h2>{query ? 'Search results' : 'Favorites'}</h2>
            <span>{visibleSnippets.length}</span>
          </div>
          {visibleSnippets.map((snippet) => (
            <article className="popup-snippet" key={snippet.id}>
              <div className="popup-snippet-copy">
                <strong>{snippet.title}</strong>
                <code>{snippet.shortcut}</code>
                <p>{snippet.content}</p>
              </div>
              <button
                className="button button-small button-secondary"
                type="button"
                aria-label={`Copy ${snippet.title}`}
                onClick={() => void copySnippet(snippet)}
              >
                Copy
              </button>
            </article>
          ))}
        </section>
      ) : (
        <section className="popup-empty">
          <span className="empty-orbit" aria-hidden="true">
            ✦
          </span>
          <h2>{query ? 'No snippets found' : 'No favorites yet'}</h2>
          <p>
            {query
              ? 'Try another search.'
              : 'Favorite snippets in your manager to keep them close.'}
          </p>
        </section>
      )}

      {error && library && (
        <p className="notice notice-error popup-notice" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="notice notice-success popup-notice" role="status">
          {notice}
        </p>
      )}

      <footer className="popup-footer">
        <button
          className="button button-primary popup-manager-button"
          type="button"
          onClick={() => void openManager()}
        >
          Open full manager
        </button>
      </footer>
    </main>
  );
}

const mountNode = document.getElementById('root');
if (mountNode) {
  ReactDOM.createRoot(mountNode).render(
    <React.StrictMode>
      <Popup />
    </React.StrictMode>,
  );
}

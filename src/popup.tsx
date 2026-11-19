import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import type { Snippet, SnippetLibrary } from './types';
import { libraryRepository, settingsService } from './management/client';
import { searchSnippets } from './services/search';
import { getSiteAccess, originPatternIncludesSite } from './expansion/site-access';
import { ENABLE_CURRENT_SITE, type ExpansionResponse } from './expansion/protocol';
import './styles.css';

interface CurrentSite {
  tabId: number;
  origin: string;
  originPattern: string;
  granted: boolean;
  canRevoke: boolean;
}

async function readCurrentSite(): Promise<CurrentSite | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const siteAccess = typeof tab?.url === 'string' ? getSiteAccess(tab.url) : null;
  if (tab?.id === undefined || !siteAccess) return null;

  const permissions = await chrome.permissions.getAll();
  const origins = permissions.origins ?? [];
  return {
    tabId: tab.id,
    ...siteAccess,
    granted: origins.some((pattern) =>
      originPatternIncludesSite(pattern, siteAccess.originPattern),
    ),
    canRevoke: origins.includes(siteAccess.originPattern),
  };
}

export function Popup() {
  const [library, setLibrary] = useState<SnippetLibrary | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [currentSite, setCurrentSite] = useState<CurrentSite | null>(null);
  const [siteLoading, setSiteLoading] = useState(true);
  const [siteBusy, setSiteBusy] = useState(false);
  const [siteError, setSiteError] = useState<string | null>(null);
  const [siteNotice, setSiteNotice] = useState<string | null>(null);
  const theme = library?.settings.theme;

  useEffect(() => {
    if (theme) document.documentElement.dataset.theme = theme;
  }, [theme]);

  async function toggleTheme() {
    if (!library) return;
    const previousTheme = library.settings.theme;
    const nextTheme = previousTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = nextTheme;
    setLibrary({ ...library, settings: { ...library.settings, theme: nextTheme } });
    try {
      await settingsService.update({ theme: nextTheme });
    } catch (themeError) {
      document.documentElement.dataset.theme = previousTheme;
      setLibrary({ ...library, settings: { ...library.settings, theme: previousTheme } });
      setError(themeError instanceof Error ? themeError.message : 'Could not save your theme.');
    }
  }

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

  const refreshCurrentSite = useCallback(async () => {
    setSiteLoading(true);
    setSiteError(null);
    try {
      setCurrentSite(await readCurrentSite());
    } catch (siteLoadError) {
      setCurrentSite(null);
      setSiteError(
        siteLoadError instanceof Error ? siteLoadError.message : 'Could not check website access.',
      );
    } finally {
      setSiteLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void readCurrentSite()
      .then((site) => {
        if (active) setCurrentSite(site);
      })
      .catch((siteLoadError: unknown) => {
        if (active) {
          setCurrentSite(null);
          setSiteError(
            siteLoadError instanceof Error
              ? siteLoadError.message
              : 'Could not check website access.',
          );
        }
      })
      .finally(() => {
        if (active) setSiteLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function toggleCurrentSiteAccess() {
    if (!currentSite) return;
    setSiteBusy(true);
    setSiteError(null);
    setSiteNotice(null);

    try {
      if (currentSite.granted) {
        if (!currentSite.canRevoke) {
          setSiteError('This site is covered by broader access. Manage that permission in Chrome.');
          return;
        }
        const removed = await chrome.permissions.remove({
          origins: [currentSite.originPattern],
        });
        if (!removed) {
          setSiteError('Chrome did not remove this website permission.');
          return;
        }
        await refreshCurrentSite();
        setSiteNotice('Website access revoked. Automatic expansion is disabled here.');
        return;
      }

      const granted = await chrome.permissions.request({
        origins: [currentSite.originPattern],
      });
      if (!granted) {
        setSiteError('Permission was not granted. Manual copy is still available.');
        return;
      }

      const response: ExpansionResponse = await chrome.runtime.sendMessage({
        type: ENABLE_CURRENT_SITE,
        tabId: currentSite.tabId,
        originPattern: currentSite.originPattern,
      });
      if (!response?.ok) {
        const message = response?.error ?? 'Typadoo could not start on this website.';
        await refreshCurrentSite();
        setSiteError(message);
        return;
      }

      await refreshCurrentSite();
      setSiteNotice(`Automatic expansion enabled for ${currentSite.origin}.`);
    } catch (permissionError) {
      const message =
        permissionError instanceof Error
          ? permissionError.message
          : 'Could not update website access.';
      await refreshCurrentSite();
      setSiteError(message);
    } finally {
      setSiteBusy(false);
    }
  }

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
        <button
          className="popup-theme-toggle"
          type="button"
          role="switch"
          aria-label="Dark mode"
          aria-checked={theme === 'dark'}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          disabled={!library}
          onClick={() => void toggleTheme()}
        >
          <svg className="popup-theme-moon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20.2 15.4A8.5 8.5 0 0 1 8.6 3.8 8.6 8.6 0 1 0 20.2 15.4Z" />
          </svg>
          <span className="popup-theme-track" aria-hidden="true">
            <span className="popup-theme-thumb" />
          </span>
        </button>
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

      <section className="popup-site-access" aria-label="Automatic expansion website access">
        <div>
          <h2>Automatic expansion</h2>
          {siteLoading ? (
            <p role="status">Checking this website…</p>
          ) : currentSite ? (
            <>
              <p>{currentSite.origin}</p>
              <p className="site-access-status" role={siteError ? 'alert' : 'status'}>
                {siteError ??
                  (currentSite.granted
                    ? currentSite.canRevoke
                      ? 'Enabled on this site. Host access covers all ports.'
                      : 'Enabled by a broader host permission.'
                    : 'Not enabled on this site.')}
              </p>
              {siteNotice && <p role="status">{siteNotice}</p>}
            </>
          ) : (
            <p role={siteError ? 'alert' : 'status'}>
              {siteError ?? 'Open an HTTP or HTTPS website to manage access.'}
            </p>
          )}
        </div>
        {currentSite && !siteLoading && (currentSite.canRevoke || !currentSite.granted) && (
          <button
            className="button button-small button-secondary"
            type="button"
            aria-label={`${currentSite.granted ? 'Disable' : 'Enable'} Typadoo on site`}
            disabled={siteBusy}
            onClick={() => void toggleCurrentSiteAccess()}
          >
            {siteBusy ? 'Updating…' : currentSite.granted ? 'Disable' : 'Enable'}
          </button>
        )}
      </section>

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

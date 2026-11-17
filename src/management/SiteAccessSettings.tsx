import React, { useEffect, useState } from 'react';
import {
  getSiteAccess,
  isWebOriginPattern,
  originPatternIncludesSite,
} from '../expansion/site-access';

function describeSitePattern(pattern: string): string {
  if (pattern === 'http://*/*') return 'All HTTP websites';
  if (pattern === 'https://*/*') return 'All HTTPS websites';

  const match = /^(https?):\/\/(.+)\/\*$/.exec(pattern);
  if (!match) return pattern;
  if (match[2].startsWith('*.')) {
    return `${match[1]}://${match[2]} (domain and subdomains)`;
  }
  return `${match[1]}://${match[2]} (all paths and ports)`;
}

export function SiteAccessSettings() {
  const [sitePatterns, setSitePatterns] = useState<string[]>([]);
  const [siteUrl, setSiteUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [removingPattern, setRemovingPattern] = useState<string | null>(null);
  const [requestingAccess, setRequestingAccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      void chrome.permissions
        .getAll()
        .then((permissions) => {
          if (!active) return;
          setSitePatterns((permissions.origins ?? []).filter(isWebOriginPattern).sort());
          setError(null);
        })
        .catch((loadError: unknown) => {
          if (active) {
            setError(
              loadError instanceof Error
                ? loadError.message
                : 'Could not load website permissions.',
            );
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    };

    chrome.permissions.onAdded.addListener(refresh);
    chrome.permissions.onRemoved.addListener(refresh);
    refresh();
    return () => {
      active = false;
      chrome.permissions.onAdded.removeListener(refresh);
      chrome.permissions.onRemoved.removeListener(refresh);
    };
  }, []);

  async function addSiteAccess(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const siteAccess = getSiteAccess(siteUrl.trim());
    if (!siteAccess) {
      setError('Enter a full HTTP or HTTPS website URL.');
      setNotice(null);
      return;
    }

    const existingPattern = sitePatterns.find((pattern) =>
      originPatternIncludesSite(pattern, siteAccess.originPattern),
    );
    if (existingPattern) {
      setError(null);
      setNotice(`This website is already covered by ${existingPattern}.`);
      return;
    }

    setRequestingAccess(true);
    setError(null);
    setNotice(null);
    try {
      const granted = await chrome.permissions.request({
        origins: [siteAccess.originPattern],
      });
      if (!granted) {
        setNotice('Chrome did not grant access. No website permission was added.');
        return;
      }

      setSitePatterns((current) => [...new Set([...current, siteAccess.originPattern])].sort());
      setSiteUrl('');
      setNotice(`Access enabled for ${siteAccess.originPattern}. Chrome will remember this grant.`);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Could not request this website permission.',
      );
    } finally {
      setRequestingAccess(false);
    }
  }

  async function removeSiteAccess(pattern: string) {
    setRemovingPattern(pattern);
    setError(null);
    setNotice(null);
    try {
      const removed = await chrome.permissions.remove({ origins: [pattern] });
      if (!removed) throw new Error('Chrome did not remove this website permission.');
      setSitePatterns((current) => current.filter((sitePattern) => sitePattern !== pattern));
      setNotice(`Removed access for ${pattern}.`);
    } catch (removeError) {
      setError(
        removeError instanceof Error
          ? removeError.message
          : 'Could not remove this website permission.',
      );
    } finally {
      setRemovingPattern(null);
    }
  }

  return (
    <section className="site-permissions-card card" aria-labelledby="site-permissions-heading">
      <header>
        <div>
          <p className="eyebrow">Website access</p>
          <h3 id="site-permissions-heading">Enabled websites</h3>
          <p className="muted">
            Access is remembered by Chrome until you remove it here or in Chrome’s extension
            settings.
          </p>
        </div>
      </header>

      {loading ? (
        <p role="status">Loading website permissions…</p>
      ) : error && sitePatterns.length === 0 ? (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      ) : sitePatterns.length === 0 ? (
        <p role="status">
          Typadoo is not enabled on any websites. Add one below or enable access from the popup.
        </p>
      ) : (
        <ul className="site-permission-list">
          {sitePatterns.map((pattern) => (
            <li key={pattern}>
              <div>
                <strong>{describeSitePattern(pattern)}</strong>
                <code>{pattern}</code>
              </div>
              <button
                className="button button-small button-secondary"
                type="button"
                aria-label={`Remove access to ${pattern}`}
                disabled={removingPattern !== null}
                onClick={() => void removeSiteAccess(pattern)}
              >
                {removingPattern === pattern ? 'Removing…' : 'Remove'}
              </button>
            </li>
          ))}
        </ul>
      )}

      <form className="site-permission-add" onSubmit={(event) => void addSiteAccess(event)}>
        <label className="field">
          <span>Enable a website</span>
          <input
            type="url"
            value={siteUrl}
            placeholder="https://support.example.com"
            aria-describedby="site-permission-help"
            required
            onChange={(event) => setSiteUrl(event.target.value)}
          />
          <small id="site-permission-help" className="muted">
            Access covers this scheme and hostname on all paths and ports, but not subdomains.
          </small>
        </label>
        <button
          className="button button-small button-secondary"
          type="submit"
          disabled={loading || requestingAccess || removingPattern !== null}
        >
          {requestingAccess ? 'Requesting…' : 'Enable website'}
        </button>
      </form>

      {error && sitePatterns.length > 0 && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="notice notice-success" role="status">
          {notice}
        </p>
      )}
    </section>
  );
}

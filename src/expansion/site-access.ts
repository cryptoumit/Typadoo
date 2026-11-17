export interface SiteAccess {
  origin: string;
  originPattern: string;
}

export function getSiteAccess(urlValue: string): SiteAccess | null {
  try {
    const url = new URL(urlValue);
    if ((url.protocol !== 'http:' && url.protocol !== 'https:') || !url.hostname) return null;

    return {
      origin: url.origin,
      originPattern: `${url.protocol}//${url.hostname}/*`,
    };
  } catch {
    return null;
  }
}

export function isWebOriginPattern(pattern: string): boolean {
  return /^https?:\/\/(?:\*|\*\.[^/*]+|[^/*]+)\/\*$/.test(pattern);
}

export function originPatternIncludesSite(grantedPattern: string, sitePattern: string): boolean {
  const granted = /^(https?):\/\/([^/]+)\/\*$/.exec(grantedPattern);
  const site = /^(https?):\/\/([^/]+)\/\*$/.exec(sitePattern);
  if (!granted || !site || granted[1] !== site[1]) return false;

  const grantedHost = granted[2].toLowerCase();
  const siteHost = site[2].toLowerCase();
  if (grantedHost === '*') return true;
  if (grantedHost.startsWith('*.')) {
    const suffix = grantedHost.slice(2);
    return siteHost === suffix || siteHost.endsWith(`.${suffix}`);
  }
  return grantedHost === siteHost;
}

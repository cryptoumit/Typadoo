import { describe, expect, it } from 'vitest';
import { getSiteAccess, isWebOriginPattern, originPatternIncludesSite } from './site-access';

describe('site access patterns', () => {
  it('creates a scheme-and-host permission pattern for a website URL', () => {
    expect(getSiteAccess('https://support.example.com:8443/tickets/1')).toEqual({
      origin: 'https://support.example.com:8443',
      originPattern: 'https://support.example.com/*',
    });
  });

  it('rejects browser pages and invalid URLs', () => {
    expect(getSiteAccess('chrome://extensions')).toBeNull();
    expect(getSiteAccess('file:///tmp/page.html')).toBeNull();
    expect(getSiteAccess('not a URL')).toBeNull();
  });

  it('accepts only HTTP and HTTPS permission patterns', () => {
    expect(isWebOriginPattern('https://example.com/*')).toBe(true);
    expect(isWebOriginPattern('http://*.example.com/*')).toBe(true);
    expect(isWebOriginPattern('<all_urls>')).toBe(false);
    expect(isWebOriginPattern('chrome://extensions/*')).toBe(false);
  });

  it('matches granted hosts without crossing scheme or hostname boundaries', () => {
    expect(
      originPatternIncludesSite('https://*.example.com/*', 'https://support.example.com/*'),
    ).toBe(true);
    expect(originPatternIncludesSite('https://*.example.com/*', 'https://example.com/*')).toBe(
      true,
    );
    expect(originPatternIncludesSite('https://*.example.com/*', 'https://notexample.com/*')).toBe(
      false,
    );
    expect(originPatternIncludesSite('https://example.com/*', 'http://example.com/*')).toBe(false);
  });
});

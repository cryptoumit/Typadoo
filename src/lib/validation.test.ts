import { describe, expect, it } from 'vitest';
import { isValidShortcut, normalizeShortcutPrefix } from './validation';

describe('shortcut validation', () => {
  it('normalizes the configured prefix', () => {
    expect(normalizeShortcutPrefix('  !  ')).toBe('!');
    expect(normalizeShortcutPrefix('   ')).toBe(';');
  });

  it('accepts valid shortcuts with the active prefix', () => {
    expect(isValidShortcut(';greet', ';')).toBe(true);
    expect(isValidShortcut('!refund', '!')).toBe(true);
  });

  it('rejects invalid or empty shortcuts', () => {
    expect(isValidShortcut('', ';')).toBe(false);
    expect(isValidShortcut('greet', ';')).toBe(false);
    expect(isValidShortcut(';hello world', ';')).toBe(false);
  });
});

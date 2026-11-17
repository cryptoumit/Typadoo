export function normalizeShortcutPrefix(prefix: string): string {
  return prefix.trim() || ';';
}

export function normalizeShortcut(shortcut: string): string {
  return shortcut.toLowerCase();
}

export function isValidShortcutPrefix(prefix: string): boolean {
  return /^[^A-Za-z0-9\s]{1,3}$/.test(prefix);
}

export function isValidShortcut(shortcut: string, prefix: string): boolean {
  const trimmed = shortcut.trim();
  if (trimmed !== shortcut || !isValidShortcutPrefix(prefix)) {
    return false;
  }

  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escapedPrefix}[A-Za-z0-9_-]{1,40}$`, 'i').test(trimmed);
}

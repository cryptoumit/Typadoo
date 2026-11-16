export function normalizeShortcutPrefix(prefix: string): string {
  return prefix.trim() || ';';
}

export function isValidShortcut(shortcut: string, prefix: string): boolean {
  const trimmed = shortcut.trim();
  const normalizedPrefix = normalizeShortcutPrefix(prefix);

  if (!trimmed || trimmed.includes(' ')) {
    return false;
  }

  return trimmed.startsWith(normalizedPrefix) && trimmed.length > normalizedPrefix.length;
}

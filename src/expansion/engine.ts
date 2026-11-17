import { isValidShortcut, normalizeShortcut } from '../lib/validation';
import type { ShortcutTrigger, SnippetStatus } from '../types';

export interface ExpansionSettings {
  triggerMode: ShortcutTrigger;
  expandOnSpace: boolean;
  expandOnTab: boolean;
  requireExplicitTrigger: boolean;
  shortcutPrefix: string;
}

export interface ExpansionSnippet {
  shortcut: string;
  content: string;
  status: SnippetStatus;
}

export interface ExpansionMatch {
  start: number;
  end: number;
  content: string;
}

export interface ExpansionIndex {
  byShortcut: ReadonlyMap<string, ExpansionSnippet>;
  maxShortcutLength: number;
}

export function createExpansionIndex(
  snippets: readonly ExpansionSnippet[],
  shortcutPrefix: string,
): ExpansionIndex {
  const candidates = new Map<string, ExpansionSnippet[]>();
  let maxShortcutLength = 0;

  for (const snippet of snippets) {
    if (
      snippet.status !== 'enabled' ||
      !snippet.content ||
      !isValidShortcut(snippet.shortcut, shortcutPrefix)
    ) {
      continue;
    }

    const key = normalizeShortcut(snippet.shortcut);
    candidates.set(key, [...(candidates.get(key) ?? []), snippet]);
    maxShortcutLength = Math.max(maxShortcutLength, snippet.shortcut.length);
  }

  const byShortcut = new Map<string, ExpansionSnippet>();
  for (const [shortcut, matches] of candidates) {
    if (matches.length === 1) byShortcut.set(shortcut, matches[0]);
  }

  return { byShortcut, maxShortcutLength };
}

export function findExpansion(
  value: string,
  caret: number,
  index: ExpansionIndex,
): ExpansionMatch | null {
  if (!Number.isInteger(caret) || caret < 0 || caret > value.length) return null;

  const maximumLength = Math.min(caret, index.maxShortcutLength);
  for (let length = maximumLength; length > 0; length -= 1) {
    const start = caret - length;
    const snippet = index.byShortcut.get(normalizeShortcut(value.slice(start, caret)));
    if (snippet && isWordBoundary(value, start)) {
      return { start, end: caret, content: snippet.content };
    }
  }

  return null;
}

export function findTriggeredExpansion(
  value: string,
  caret: number,
  key: ' ' | 'Tab',
  index: ExpansionIndex,
  settings: ExpansionSettings,
): ExpansionMatch | null {
  if (settings.triggerMode === 'manual') return null;

  if (key === ' ' && (settings.triggerMode !== 'space' || !settings.expandOnSpace)) {
    return null;
  }
  if (key === 'Tab' && (settings.triggerMode !== 'tab' || !settings.expandOnTab)) {
    return null;
  }

  return findExpansion(value, caret, index);
}

export function findImmediateExpansion(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  typedKey: string,
  index: ExpansionIndex,
  settings: ExpansionSettings,
): ExpansionMatch | null {
  if (
    settings.requireExplicitTrigger ||
    settings.triggerMode === 'manual' ||
    selectionStart !== selectionEnd ||
    typedKey.length !== 1 ||
    !isAutomaticModeEnabled(settings)
  ) {
    return null;
  }

  const nextValue = value.slice(0, selectionStart) + typedKey + value.slice(selectionEnd);
  const match = findExpansion(nextValue, selectionStart + typedKey.length, index);
  return match ? { ...match, end: selectionStart } : null;
}

function isAutomaticModeEnabled(settings: ExpansionSettings): boolean {
  return (
    (settings.triggerMode === 'space' && settings.expandOnSpace) ||
    (settings.triggerMode === 'tab' && settings.expandOnTab)
  );
}

function isWordBoundary(value: string, start: number): boolean {
  if (start === 0) return true;

  let codePointStart = start - 1;
  const previous = value.charCodeAt(codePointStart);
  if (previous >= 0xdc00 && previous <= 0xdfff && codePointStart > 0) {
    codePointStart -= 1;
  }

  const previousCharacter = String.fromCodePoint(value.codePointAt(codePointStart)!);
  return !/[\p{L}\p{M}\p{N}_]/u.test(previousCharacter);
}

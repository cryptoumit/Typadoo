import { describe, expect, it } from 'vitest';
import {
  createExpansionIndex,
  findExpansion,
  findImmediateExpansion,
  findTriggeredExpansion,
  type ExpansionSettings,
} from './engine';

const settings: ExpansionSettings = {
  triggerMode: 'space',
  expandOnSpace: true,
  expandOnTab: false,
  requireExplicitTrigger: true,
  shortcutPrefix: ';',
};

describe('expansion engine', () => {
  it('matches an exact shortcut at the caret and rejects word interiors', () => {
    const index = createExpansionIndex(
      [{ shortcut: ';hello', content: 'Hello there.', status: 'enabled' }],
      ';',
    );

    expect(findExpansion(';hello', 6, index)).toEqual({
      start: 0,
      end: 6,
      content: 'Hello there.',
    });
    expect(findExpansion('word;hello', 10, index)).toBeNull();
    expect(findExpansion(';hello!', 6, index)).not.toBeNull();
    expect(findExpansion(';hello', 3, index)).toBeNull();
  });

  it('ignores disabled, empty, invalid, and conflicting shortcuts', () => {
    const index = createExpansionIndex(
      [
        { shortcut: ';off', content: 'Disabled', status: 'disabled' },
        { shortcut: ';empty', content: '', status: 'enabled' },
        { shortcut: 'missing-prefix', content: 'Invalid', status: 'enabled' },
        { shortcut: ';same', content: 'First', status: 'enabled' },
        { shortcut: ';SAME', content: 'Second', status: 'enabled' },
        { shortcut: ';ok', content: 'Valid', status: 'enabled' },
      ],
      ';',
    );

    expect(index.byShortcut.has(';off')).toBe(false);
    expect(index.byShortcut.has(';empty')).toBe(false);
    expect(index.byShortcut.has(';same')).toBe(false);
    expect(findExpansion(';ok', 3, index)?.content).toBe('Valid');
  });

  it('handles multiline and Unicode content while preserving trigger semantics', () => {
    const index = createExpansionIndex(
      [{ shortcut: ';hello', content: 'Hello 👋\nThanks!', status: 'enabled' }],
      ';',
    );

    expect(findTriggeredExpansion(';hello', 6, ' ', index, settings)).toEqual({
      start: 0,
      end: 6,
      content: 'Hello 👋\nThanks!',
    });
    expect(
      findTriggeredExpansion(';hello', 6, 'Tab', index, {
        ...settings,
        triggerMode: 'tab',
        expandOnTab: true,
      }),
    ).toEqual({
      start: 0,
      end: 6,
      content: 'Hello 👋\nThanks!',
    });
    expect(
      findTriggeredExpansion(';hello', 6, ' ', index, {
        ...settings,
        triggerMode: 'manual',
      }),
    ).toBeNull();
    expect(
      findTriggeredExpansion(';hello', 6, 'Tab', index, {
        ...settings,
        triggerMode: 'tab',
        expandOnTab: false,
      }),
    ).toBeNull();
  });

  it('expands immediately only when explicit triggers are disabled', () => {
    const index = createExpansionIndex(
      [{ shortcut: ';hi', content: 'Hello', status: 'enabled' }],
      ';',
    );

    expect(
      findImmediateExpansion(';h', 2, 2, 'i', index, {
        ...settings,
        requireExplicitTrigger: false,
      }),
    ).toEqual({ start: 0, end: 2, content: 'Hello' });
    expect(findImmediateExpansion(';h', 2, 2, 'i', index, settings)).toBeNull();
    expect(
      findImmediateExpansion(';h', 1, 2, 'i', index, {
        ...settings,
        requireExplicitTrigger: false,
      }),
    ).toBeNull();
  });
});

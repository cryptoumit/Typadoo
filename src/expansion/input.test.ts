import { afterEach, describe, expect, it } from 'vitest';
import { InputExpansionController, type ExpansionConfig } from './input';
import type { ExpansionSettings } from './engine';

const settings: ExpansionSettings = {
  triggerMode: 'space',
  expandOnSpace: true,
  expandOnTab: false,
  requireExplicitTrigger: true,
  shortcutPrefix: ';',
};

function createConfig(overrides: Partial<ExpansionSettings> = {}): ExpansionConfig {
  return {
    settings: { ...settings, ...overrides },
    snippets: [{ shortcut: ';hello', content: 'Hello!\nThanks.', status: 'enabled' }],
  };
}

function keyDown(target: Element, key: string, options: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...options,
  });
  target.dispatchEvent(event);
  return event;
}

describe('input expansion integration', () => {
  let controller: InputExpansionController | undefined;

  afterEach(() => {
    controller?.stop();
    controller = undefined;
    document.body.replaceChildren();
  });

  it('replaces a shortcut in a textarea and preserves the cursor and typed space', () => {
    const textarea = document.createElement('textarea');
    textarea.value = 'Before ;hello after';
    document.body.append(textarea);
    textarea.focus();
    textarea.setSelectionRange(13, 13);
    controller = new InputExpansionController(document);
    controller.setConfig(createConfig());
    const inputEvents: Event[] = [];
    textarea.addEventListener('input', (event) => inputEvents.push(event));

    const event = keyDown(textarea, ' ');

    expect(event.defaultPrevented).toBe(true);
    expect(textarea.value).toBe('Before Hello!\nThanks.  after');
    expect(textarea.selectionStart).toBe(22);
    expect(inputEvents).toHaveLength(1);
    expect(inputEvents[0].bubbles).toBe(true);
  });

  it('expands in supported inputs and replaces the selection boundary correctly', () => {
    const input = document.createElement('input');
    input.type = 'search';
    input.value = ';hello';
    document.body.append(input);
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
    controller = new InputExpansionController(document);
    controller.setConfig({
      settings: { ...settings, triggerMode: 'tab', expandOnSpace: false, expandOnTab: true },
      snippets: [{ shortcut: ';hello', content: 'Hello', status: 'enabled' }],
    });

    const event = keyDown(input, 'Tab');

    expect(event.defaultPrevented).toBe(true);
    expect(input.value).toBe('Hello');
    expect(input.selectionStart).toBe(5);
  });

  it('does not expand over a selected range or into a word interior', () => {
    const input = document.createElement('input');
    input.value = 'x;hello';
    document.body.append(input);
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
    controller = new InputExpansionController(document);
    controller.setConfig({
      settings,
      snippets: [{ shortcut: ';hello', content: 'Hello', status: 'enabled' }],
    });

    const wordInteriorEvent = keyDown(input, ' ');
    expect(wordInteriorEvent.defaultPrevented).toBe(false);
    expect(input.value).toBe('x;hello');

    input.value = ';hello';
    input.setSelectionRange(0, 2);
    const selectionEvent = keyDown(input, ' ');
    expect(selectionEvent.defaultPrevented).toBe(false);
    expect(input.value).toBe(';hello');
  });

  it('does not process disabled, read-only, password, email, or number fields', () => {
    const controllerInstance = new InputExpansionController(document);
    controller = controllerInstance;
    controllerInstance.setConfig({
      settings,
      snippets: [{ shortcut: ';hello', content: 'Hello', status: 'enabled' }],
    });

    const fields = [
      Object.assign(document.createElement('input'), { type: 'password' }),
      Object.assign(document.createElement('input'), { type: 'email' }),
      Object.assign(document.createElement('input'), { type: 'number' }),
      Object.assign(document.createElement('input'), { type: 'text', readOnly: true }),
      Object.assign(document.createElement('input'), { type: 'text', disabled: true }),
    ];

    for (const field of fields) {
      field.value = ';hello';
      const originalValue = field.value;
      document.body.append(field);
      field.focus();
      const event = keyDown(field, ' ');
      expect(event.defaultPrevented).toBe(false);
      expect(field.value).toBe(originalValue);
      field.remove();
    }
  });

  it('does not expand during IME composition or in response to paste', () => {
    const input = document.createElement('input');
    input.value = ';hello';
    document.body.append(input);
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
    controller = new InputExpansionController(document);
    controller.setConfig({
      settings,
      snippets: [{ shortcut: ';hello', content: 'Hello', status: 'enabled' }],
    });

    input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    expect(keyDown(input, ' ').defaultPrevented).toBe(false);
    input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
    const paste = new Event('paste', { bubbles: true, cancelable: true });
    input.dispatchEvent(paste);
    expect(paste.defaultPrevented).toBe(false);
    expect(input.value).toBe(';hello');
  });

  it('supports immediate expansion only when explicitly configured', () => {
    const input = document.createElement('input');
    input.value = ';hell';
    document.body.append(input);
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
    controller = new InputExpansionController(document);
    const config = createConfig({ requireExplicitTrigger: false });
    config.snippets[0].content = 'Hello!';
    controller.setConfig(config);

    const event = keyDown(input, 'o');

    expect(event.defaultPrevented).toBe(true);
    expect(input.value).toBe('Hello!');
    expect(input.selectionStart).toBe(input.value.length);
  });
});

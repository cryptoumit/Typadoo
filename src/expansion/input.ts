import {
  createExpansionIndex,
  findImmediateExpansion,
  findTriggeredExpansion,
  type ExpansionMatch,
  type ExpansionSettings,
  type ExpansionSnippet,
} from './engine';

export interface ExpansionConfig {
  settings: ExpansionSettings;
  snippets: ExpansionSnippet[];
}

type TextControl = HTMLInputElement | HTMLTextAreaElement;

export class InputExpansionController {
  private config: ExpansionConfig | null = null;
  private index = createExpansionIndex([], ';');
  private composingTarget: EventTarget | null = null;

  constructor(private readonly document: Document) {
    document.addEventListener('keydown', this.handleKeyDown, true);
    document.addEventListener('compositionstart', this.handleCompositionStart, true);
    document.addEventListener('compositionend', this.handleCompositionEnd, true);
  }

  setConfig(config: ExpansionConfig | null): void {
    this.config = config;
    this.index = config
      ? createExpansionIndex(config.snippets, config.settings.shortcutPrefix)
      : createExpansionIndex([], ';');
  }

  stop(): void {
    this.config = null;
    this.document.removeEventListener('keydown', this.handleKeyDown, true);
    this.document.removeEventListener('compositionstart', this.handleCompositionStart, true);
    this.document.removeEventListener('compositionend', this.handleCompositionEnd, true);
  }

  private readonly handleCompositionStart = (event: CompositionEvent): void => {
    this.composingTarget = event.target;
  };

  private readonly handleCompositionEnd = (): void => {
    this.composingTarget = null;
  };

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (
      event.defaultPrevented ||
      event.isComposing ||
      event.keyCode === 229 ||
      this.composingTarget !== null ||
      event.ctrlKey ||
      event.altKey ||
      event.metaKey
    ) {
      return;
    }

    const view = this.document.defaultView;
    if (!view) return;

    const config = this.config;
    const control = getTextControl(event.target, this.document);
    if (!config || !control || control.disabled || control.readOnly) return;
    if (this.document.activeElement !== control || !control.isConnected) return;

    const start = control.selectionStart;
    const end = control.selectionEnd;
    if (start === null || end === null || start !== end) return;

    let match: ExpansionMatch | null;
    let replacement = '';
    if (event.key === ' ' && !event.shiftKey) {
      match = findTriggeredExpansion(control.value, start, ' ', this.index, config.settings);
      if (match) replacement = `${match.content} `;
    } else if (event.key === 'Tab' && !event.shiftKey) {
      match = findTriggeredExpansion(control.value, start, 'Tab', this.index, config.settings);
      if (match) replacement = match.content;
    } else if (config.settings.requireExplicitTrigger) {
      return;
    } else {
      match = findImmediateExpansion(
        control.value,
        start,
        end,
        event.key,
        this.index,
        config.settings,
      );
      if (match) replacement = match.content;
    }

    if (!match) return;
    if (control instanceof view.HTMLInputElement && /[\r\n]/.test(replacement)) {
      return;
    }

    if (replaceRange(control, match.start, match.end, replacement)) {
      event.preventDefault();
    }
  };
}

function getTextControl(target: EventTarget | null, document: Document): TextControl | null {
  const view = document.defaultView;
  if (!view) return null;
  if (target instanceof view.HTMLTextAreaElement) return target;
  if (!(target instanceof view.HTMLInputElement)) return null;
  return ['text', 'search', 'url', 'tel'].includes(target.type) ? target : null;
}

function replaceRange(control: TextControl, start: number, end: number, text: string): boolean {
  const originalValue = control.value;
  const originalStart = control.selectionStart;
  const originalEnd = control.selectionEnd;

  try {
    control.setRangeText(text, start, end, 'end');
    const view = control.ownerDocument.defaultView;
    const event =
      view && typeof view.InputEvent === 'function'
        ? new view.InputEvent('input', {
            bubbles: true,
            composed: true,
            inputType: 'insertReplacementText',
            data: text,
          })
        : new Event('input', { bubbles: true, composed: true });
    control.dispatchEvent(event);
    return true;
  } catch (error) {
    if (control.value !== originalValue) {
      control.value = originalValue;
      if (originalStart !== null && originalEnd !== null) {
        control.setSelectionRange(originalStart, originalEnd);
      }
    }
    console.warn('Typadoo could not safely replace the shortcut.', error);
    return false;
  }
}

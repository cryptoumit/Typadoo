import { InputExpansionController } from './expansion/input';
import {
  GET_EXPANSION_CONFIG,
  REFRESH_EXPANSION_CONFIG,
  type ExpansionResponse,
} from './expansion/protocol';

interface ContentState {
  refresh(): void;
  stop(): void;
}

type ContentGlobal = typeof globalThis & {
  __typadooExpansionState?: ContentState;
};

const contentGlobal = globalThis as ContentGlobal;

if (contentGlobal.__typadooExpansionState) {
  contentGlobal.__typadooExpansionState.refresh();
} else {
  const controller = new InputExpansionController(document);
  let stopped = false;

  function applyResponse(response: ExpansionResponse | undefined): void {
    if (stopped) return;
    if (response?.ok && response.config) {
      controller.setConfig(response.config);
      return;
    }

    controller.setConfig(null);
    if (response?.errorCode === 'site-not-authorized') {
      state.stop();
    } else if (response?.error) {
      console.warn('Typadoo could not load expansion settings.');
    }
  }

  function onMessage(message: unknown): void {
    if (isRefreshMessage(message)) {
      state.refresh();
    }
  }

  const state: ContentState = {
    refresh() {
      if (stopped) return;
      void chrome.runtime
        .sendMessage({ type: GET_EXPANSION_CONFIG })
        .then((response: ExpansionResponse | undefined) => applyResponse(response))
        .catch(() => {
          if (stopped) return;
          controller.setConfig(null);
          console.warn('Typadoo could not load expansion settings.');
        });
    },
    stop() {
      if (stopped) return;
      stopped = true;
      controller.stop();
      chrome.runtime.onMessage.removeListener(onMessage);
      delete contentGlobal.__typadooExpansionState;
    },
  };

  contentGlobal.__typadooExpansionState = state;
  chrome.runtime.onMessage.addListener(onMessage);
  state.refresh();
}

function isRefreshMessage(message: unknown): boolean {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message.type === REFRESH_EXPANSION_CONFIG
  );
}

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET_EXPANSION_CONFIG } from '../expansion/protocol';
import { createDefaultLibrary } from '../storage/defaults';

type MessageListener = (
  message: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: unknown) => void,
) => boolean | void;

function pageSender(url: string, frameId = 0): chrome.runtime.MessageSender {
  return {
    id: 'typadoo-extension',
    tab: { id: 8 } as chrome.tabs.Tab,
    frameId,
    url,
  };
}

describe('expansion background authorization', () => {
  let messageListeners: MessageListener[];
  let storageGet: ReturnType<typeof vi.fn>;
  let executeScript: ReturnType<typeof vi.fn>;
  let permissions: string[];

  beforeEach(async () => {
    vi.resetModules();
    messageListeners = [];
    permissions = ['https://support.example.com/*'];
    const library = createDefaultLibrary();
    const timestamp = new Date().toISOString();
    library.snippets.push(
      {
        id: 'enabled-snippet',
        title: 'Enabled',
        shortcut: ';enabled',
        content: 'Enabled content',
        tags: [],
        groupId: library.groups[0].id,
        status: 'enabled',
        favorite: false,
        createdAt: timestamp,
        updatedAt: timestamp,
        usageCount: 0,
      },
      {
        id: 'disabled-snippet',
        title: 'Disabled',
        shortcut: ';disabled',
        content: 'Disabled content',
        tags: [],
        groupId: library.groups[0].id,
        status: 'disabled',
        favorite: false,
        createdAt: timestamp,
        updatedAt: timestamp,
        usageCount: 0,
      },
    );
    storageGet = vi.fn(async (key: string) => ({
      [key]: key === 'typadoo.library' ? library : undefined,
    }));
    executeScript = vi.fn().mockResolvedValue([]);

    vi.stubGlobal('navigator', {
      locks: { request: (_name: string, operation: () => Promise<unknown>) => operation() },
    });
    vi.stubGlobal('chrome', {
      runtime: {
        id: 'typadoo-extension',
        onMessage: {
          addListener: vi.fn((listener: MessageListener) => messageListeners.push(listener)),
        },
      },
      permissions: {
        getAll: vi.fn(async () => ({ origins: permissions })),
        onAdded: { addListener: vi.fn() },
        onRemoved: { addListener: vi.fn() },
      },
      storage: {
        local: {
          get: storageGet,
          set: vi.fn().mockResolvedValue(undefined),
          remove: vi.fn().mockResolvedValue(undefined),
          setAccessLevel: vi.fn().mockResolvedValue(undefined),
        },
        onChanged: { addListener: vi.fn() },
      },
      scripting: {
        getRegisteredContentScripts: vi.fn().mockResolvedValue([]),
        registerContentScripts: vi.fn().mockResolvedValue(undefined),
        unregisterContentScripts: vi.fn().mockResolvedValue(undefined),
        executeScript,
      },
      tabs: {
        get: vi.fn().mockResolvedValue({ id: 8, url: 'https://support.example.com/ticket/1' }),
        query: vi.fn().mockResolvedValue([]),
        sendMessage: vi.fn().mockResolvedValue(undefined),
      },
    });

    const { initializeExpansionBackground } = await import('./expansion');
    initializeExpansionBackground();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns only enabled snippet data to a permitted top-level page', async () => {
    const response = await sendMessage(
      { type: GET_EXPANSION_CONFIG },
      pageSender('https://support.example.com/ticket/1'),
    );

    expect(response).toMatchObject({
      ok: true,
      config: {
        snippets: [
          {
            shortcut: ';enabled',
            content: 'Enabled content',
            status: 'enabled',
          },
        ],
      },
    });
    expect(JSON.stringify(response)).not.toContain('Disabled content');
    expect(storageGet).toHaveBeenCalledWith('typadoo.library');
  });

  it('does not disclose configuration to an unpermitted site or subframe', async () => {
    const unauthorized = await sendMessage(
      { type: GET_EXPANSION_CONFIG },
      pageSender('https://other.example.com/ticket/1'),
    );
    const subframe = await sendMessage(
      { type: GET_EXPANSION_CONFIG },
      pageSender('https://support.example.com/ticket/1', 1),
    );

    expect(unauthorized).toEqual({ ok: false, errorCode: 'site-not-authorized' });
    expect(subframe).toEqual({ ok: false, errorCode: 'site-not-authorized' });
    expect(storageGet).not.toHaveBeenCalled();
  });

  it('does not inject content scripts for requests from website contexts', async () => {
    const response = await sendMessage(
      {
        type: 'typadoo:enable-current-site',
        tabId: 8,
        originPattern: 'https://support.example.com/*',
      },
      pageSender('https://support.example.com/ticket/1'),
    );

    expect(response).toEqual({ ok: false, error: 'The site request was not valid.' });
    expect(executeScript).not.toHaveBeenCalled();
  });

  async function sendMessage(
    message: unknown,
    sender: chrome.runtime.MessageSender,
  ): Promise<unknown> {
    const [listener] = messageListeners;
    if (!listener) throw new Error('Expansion message listener was not initialized.');
    return new Promise((resolve) => {
      expect(listener(message, sender, resolve)).toBe(true);
    });
  }
});

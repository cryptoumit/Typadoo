import {
  getSiteAccess,
  isWebOriginPattern,
  originPatternIncludesSite,
} from '../expansion/site-access';
import {
  ENABLE_CURRENT_SITE,
  GET_EXPANSION_CONFIG,
  REFRESH_EXPANSION_CONFIG,
  type EnableCurrentSiteMessage,
  type ExpansionResponse,
} from '../expansion/protocol';
import type { ExpansionConfig } from '../expansion/input';
import type { ExpansionSettings } from '../expansion/engine';
import {
  createChromeStoragePort,
  LibraryRepository,
  LIBRARY_STORAGE_KEY,
} from '../storage/repository';

const CONTENT_SCRIPT_ID = 'typadoo-expansion';
const repository = new LibraryRepository(createChromeStoragePort());

let cachedConfig: ExpansionConfig | null = null;
let registrationQueue: Promise<void> = Promise.resolve();
let storageAccessFailed = false;

const storageAccessReady =
  typeof chrome.storage.local.setAccessLevel === 'function'
    ? chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' }).catch(() => {
        storageAccessFailed = true;
        console.error('Typadoo could not restrict local storage to extension contexts.');
      })
    : Promise.resolve();

export function initializeExpansionBackground(): void {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (isEnableCurrentSiteMessage(message)) {
      void enableCurrentSite(message, sender)
        .then(sendResponse)
        .catch(() => {
          sendResponse({
            ok: false,
            error: 'Typadoo could not start on this website. Reload the page and try again.',
          } satisfies ExpansionResponse);
        });
      return true;
    }

    if (isGetExpansionConfigMessage(message)) {
      void getConfigForSender(sender)
        .then(sendResponse)
        .catch(() => {
          sendResponse({
            ok: false,
            error: 'Typadoo could not load your local snippets. Check the manager for errors.',
            errorCode: 'library-unavailable',
          } satisfies ExpansionResponse);
        });
      return true;
    }

    return false;
  });

  chrome.permissions.onAdded.addListener((permissions) => {
    const addedOrigins = (permissions.origins ?? []).filter(isWebOriginPattern);
    void synchronizeContentScripts()
      .then(() => injectGrantedTabs(addedOrigins))
      .catch(() => {
        console.error('Typadoo could not activate a newly enabled website.');
      });
  });

  chrome.permissions.onRemoved.addListener(() => {
    void synchronizeContentScripts()
      .then(refreshAllContentScripts)
      .catch(() => {
        console.error('Typadoo could not update website access after a permission change.');
      });
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local' || !(LIBRARY_STORAGE_KEY in changes)) return;
    cachedConfig = null;
    void refreshAllContentScripts().catch(() => {
      console.error('Typadoo could not refresh active website settings.');
    });
  });

  void synchronizeContentScripts().catch(() => {
    console.error('Typadoo could not synchronize enabled websites.');
  });
}

async function getConfigForSender(
  sender: chrome.runtime.MessageSender,
): Promise<ExpansionResponse> {
  const tabId = sender.tab?.id;
  if (
    sender.id !== chrome.runtime.id ||
    tabId === undefined ||
    sender.frameId !== 0 ||
    typeof sender.url !== 'string'
  ) {
    return { ok: false, errorCode: 'site-not-authorized' };
  }

  const siteAccess = getSiteAccess(sender.url);
  if (!siteAccess || !(await isSiteGranted(siteAccess.originPattern))) {
    return { ok: false, errorCode: 'site-not-authorized' };
  }

  await storageAccessReady;
  if (storageAccessFailed) {
    return {
      ok: false,
      error: 'Typadoo could not securely load your local snippets.',
      errorCode: 'library-unavailable',
    };
  }
  if (cachedConfig) return { ok: true, config: cachedConfig };

  const library = await repository.getLibrary();
  const settings: ExpansionSettings = {
    triggerMode: library.settings.triggerMode,
    expandOnSpace: library.settings.expandOnSpace,
    expandOnTab: library.settings.expandOnTab,
    requireExplicitTrigger: library.settings.requireExplicitTrigger,
    shortcutPrefix: library.settings.shortcutPrefix,
  };
  cachedConfig = {
    settings,
    snippets: library.snippets
      .filter((snippet) => snippet.status === 'enabled')
      .map(({ shortcut, content, status }) => ({ shortcut, content, status })),
  };
  return { ok: true, config: cachedConfig };
}

async function enableCurrentSite(
  message: EnableCurrentSiteMessage,
  sender: chrome.runtime.MessageSender,
): Promise<ExpansionResponse> {
  if (!isExtensionPageSender(sender) || !Number.isInteger(message.tabId)) {
    return { ok: false, error: 'The site request was not valid.' };
  }

  const tab = await chrome.tabs.get(message.tabId);
  const siteAccess = typeof tab.url === 'string' ? getSiteAccess(tab.url) : null;
  if (!siteAccess || siteAccess.originPattern !== message.originPattern) {
    return { ok: false, error: 'The active website changed. Reopen Typadoo and try again.' };
  }
  if (!(await isSiteGranted(siteAccess.originPattern))) {
    return { ok: false, error: 'Chrome has not granted access to this website.' };
  }

  await synchronizeContentScripts();
  await chrome.scripting.executeScript({
    target: { tabId: message.tabId },
    files: ['content.js'],
  });
  return { ok: true };
}

async function isSiteGranted(sitePattern: string): Promise<boolean> {
  const permissions = await chrome.permissions.getAll();
  return (permissions.origins ?? []).some((pattern) =>
    originPatternIncludesSite(pattern, sitePattern),
  );
}

function synchronizeContentScripts(): Promise<void> {
  const result = registrationQueue.then(async () => {
    const permissions = await chrome.permissions.getAll();
    const matches = (permissions.origins ?? []).filter(isWebOriginPattern).sort();
    const registered = await chrome.scripting.getRegisteredContentScripts({
      ids: [CONTENT_SCRIPT_ID],
    });
    const currentMatches = registered[0]?.matches?.slice().sort();
    if (currentMatches && JSON.stringify(currentMatches) === JSON.stringify(matches)) return;
    if (registered.length > 0) {
      await chrome.scripting.unregisterContentScripts({ ids: [CONTENT_SCRIPT_ID] });
    }
    if (matches.length > 0) {
      await chrome.scripting.registerContentScripts([
        {
          id: CONTENT_SCRIPT_ID,
          matches,
          js: ['content.js'],
          runAt: 'document_idle',
          persistAcrossSessions: true,
        },
      ]);
    }
  });
  registrationQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

async function injectGrantedTabs(grantedPatterns: string[]): Promise<void> {
  if (grantedPatterns.length === 0) return;
  const tabs = await chrome.tabs.query({});
  const matchingTabs = tabs.filter((tab): tab is chrome.tabs.Tab & { id: number; url: string } => {
    if (tab.id === undefined || typeof tab.url !== 'string') return false;
    const siteAccess = getSiteAccess(tab.url);
    return (
      siteAccess !== null &&
      grantedPatterns.some((pattern) =>
        originPatternIncludesSite(pattern, siteAccess.originPattern),
      )
    );
  });

  const results = await Promise.allSettled(
    matchingTabs.map((tab) =>
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js'],
      }),
    ),
  );
  if (results.some((result) => result.status === 'rejected')) {
    console.warn('Typadoo could not activate on every already-open permitted tab.');
  }
}

async function refreshAllContentScripts(): Promise<void> {
  const tabs = await chrome.tabs.query({});
  const results = await Promise.allSettled(
    tabs
      .filter((tab): tab is chrome.tabs.Tab & { id: number } => tab.id !== undefined)
      .map((tab) => chrome.tabs.sendMessage(tab.id, { type: REFRESH_EXPANSION_CONFIG })),
  );
  const unexpectedFailure = results.some(
    (result) => result.status === 'rejected' && !isMissingContentScriptError(result.reason),
  );
  if (unexpectedFailure) {
    console.warn('Typadoo could not refresh one or more active website scripts.');
  }
}

function isMissingContentScriptError(error: unknown): boolean {
  return error instanceof Error && error.message.includes('Receiving end does not exist');
}

function isExtensionPageSender(sender: chrome.runtime.MessageSender): boolean {
  if (sender.id !== chrome.runtime.id || typeof sender.url !== 'string') return false;
  try {
    const url = new URL(sender.url);
    return url.protocol === 'chrome-extension:' && url.host === chrome.runtime.id;
  } catch {
    return false;
  }
}

function isGetExpansionConfigMessage(message: unknown): boolean {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message.type === GET_EXPANSION_CONFIG
  );
}

function isEnableCurrentSiteMessage(message: unknown): message is EnableCurrentSiteMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message.type === ENABLE_CURRENT_SITE &&
    'tabId' in message &&
    typeof message.tabId === 'number' &&
    'originPattern' in message &&
    typeof message.originPattern === 'string' &&
    isWebOriginPattern(message.originPattern)
  );
}

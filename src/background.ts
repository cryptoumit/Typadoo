import { initializeExpansionBackground } from './background/expansion';

chrome.runtime.onInstalled.addListener(() => {
  console.info('Typadoo background service worker initialized.');
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'ping') {
    sendResponse({ ok: true, message: 'Typadoo background ready.' });
    return true;
  }

  return false;
});

initializeExpansionBackground();

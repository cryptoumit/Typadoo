import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Popup } from './popup';

describe('popup manager action', () => {
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('opens the extension options page when the manager button is clicked', async () => {
    const openOptionsPage = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('chrome', { runtime: { openOptionsPage } });
    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(React.createElement(Popup));
    });

    await act(async () => {
      container.querySelector('button')?.click();
    });

    expect(openOptionsPage).toHaveBeenCalledOnce();
    await act(async () => {
      root.unmount();
    });
  });
});

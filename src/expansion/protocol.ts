import type { ExpansionConfig } from './input';

export const GET_EXPANSION_CONFIG = 'typadoo:get-expansion-config';
export const ENABLE_CURRENT_SITE = 'typadoo:enable-current-site';
export const REFRESH_EXPANSION_CONFIG = 'typadoo:refresh-expansion-config';

export interface EnableCurrentSiteMessage {
  type: typeof ENABLE_CURRENT_SITE;
  tabId: number;
  originPattern: string;
}

export interface ExpansionResponse {
  ok: boolean;
  config?: ExpansionConfig;
  error?: string;
  errorCode?: 'site-not-authorized' | 'library-unavailable';
}

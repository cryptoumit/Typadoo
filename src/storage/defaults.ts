import type { SnippetGroup, SnippetLibrary, TypadooSettings } from '../types';
import { LIBRARY_SCHEMA_VERSION } from './schema';

const DEFAULT_GROUPS: Array<Pick<SnippetGroup, 'id' | 'name'>> = [
  { id: 'group-general-support', name: 'General Support' },
  { id: 'group-troubleshooting', name: 'Troubleshooting' },
  { id: 'group-account-security', name: 'Account & Security' },
  { id: 'group-payments-billing', name: 'Payments & Billing' },
  { id: 'group-escalations', name: 'Escalations' },
  { id: 'group-follow-ups', name: 'Follow-ups' },
  { id: 'group-internal-notes', name: 'Internal Notes' },
];

export function createDefaultLibrary(now = new Date()): SnippetLibrary {
  const timestamp = now.toISOString();
  const groups: SnippetGroup[] = DEFAULT_GROUPS.map((group, index) => ({
    ...group,
    sortOrder: index,
    createdAt: timestamp,
    updatedAt: timestamp,
    isDefault: true,
  }));
  const settings: TypadooSettings = {
    triggerMode: 'space',
    expandOnSpace: true,
    expandOnTab: false,
    requireExplicitTrigger: true,
    defaultGroupId: groups[0].id,
    shortcutPrefix: ';',
    debugMode: false,
    theme: 'system',
  };

  return {
    version: LIBRARY_SCHEMA_VERSION,
    snippets: [],
    groups,
    settings,
  };
}

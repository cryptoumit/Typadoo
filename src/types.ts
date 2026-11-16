export type ShortcutTrigger = 'space' | 'tab' | 'manual';

export type SnippetStatus = 'enabled' | 'disabled';

export interface Snippet {
  id: string;
  title: string;
  shortcut: string;
  content: string;
  description?: string;
  tags: string[];
  groupId: string;
  status: SnippetStatus;
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
  usageCount: number;
}

export interface SnippetGroup {
  id: string;
  name: string;
  description?: string;
  color?: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  isDefault: boolean;
}

export interface TypadooSettings {
  triggerMode: ShortcutTrigger;
  expandOnSpace: boolean;
  expandOnTab: boolean;
  requireExplicitTrigger: boolean;
  defaultGroupId: string;
  shortcutPrefix: string;
  debugMode: boolean;
  theme: 'light' | 'dark' | 'system';
}

export interface SnippetLibrary {
  version: number;
  snippets: Snippet[];
  groups: SnippetGroup[];
  settings: TypadooSettings;
}

export interface ValidationIssue {
  field: string;
  message: string;
}

export interface ImportReport {
  importedCount: number;
  skippedCount: number;
  issues: ValidationIssue[];
}

export type SnippetDraft = Pick<Snippet, 'title' | 'shortcut' | 'content' | 'groupId'> &
  Partial<Pick<Snippet, 'description' | 'tags' | 'status' | 'favorite'>>;

export type GroupDraft = Pick<SnippetGroup, 'name'> &
  Partial<Pick<SnippetGroup, 'description' | 'color' | 'sortOrder'>>;

export interface RecoveryBackup {
  version: 1;
  savedAt: string;
  data: unknown;
}

import type { TypadooSettings } from '../types';
import { LibraryRepository } from '../storage/repository';

export class SettingsService {
  constructor(private readonly repository: LibraryRepository) {}

  async get(): Promise<TypadooSettings> {
    return (await this.repository.getLibrary()).settings;
  }

  update(changes: Partial<TypadooSettings>): Promise<TypadooSettings> {
    return this.repository
      .updateLibrary((library) => {
        const shortcutPrefix = changes.shortcutPrefix ?? library.settings.shortcutPrefix;
        const prefixChanged = shortcutPrefix !== library.settings.shortcutPrefix;
        const timestamp = new Date().toISOString();
        return {
          ...library,
          snippets: prefixChanged
            ? library.snippets.map((snippet) => ({
                ...snippet,
                shortcut: snippet.shortcut.startsWith(library.settings.shortcutPrefix)
                  ? `${shortcutPrefix}${snippet.shortcut.slice(library.settings.shortcutPrefix.length)}`
                  : snippet.shortcut,
                updatedAt: timestamp,
              }))
            : library.snippets,
          settings: { ...library.settings, ...changes },
        };
      })
      .then((library) => library.settings);
  }

  updateShortcutPrefix(shortcutPrefix: string): Promise<TypadooSettings> {
    return this.update({ shortcutPrefix });
  }
}

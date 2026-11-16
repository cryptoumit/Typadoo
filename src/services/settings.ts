import type { TypadooSettings } from '../types';
import { LibraryRepository } from '../storage/repository';

export class SettingsService {
  constructor(private readonly repository: LibraryRepository) {}

  async get(): Promise<TypadooSettings> {
    return (await this.repository.getLibrary()).settings;
  }

  update(changes: Partial<TypadooSettings>): Promise<TypadooSettings> {
    return this.repository
      .updateLibrary((library) => ({
        ...library,
        settings: { ...library.settings, ...changes },
      }))
      .then((library) => library.settings);
  }
}

import { GroupService } from '../services/groups';
import { SettingsService } from '../services/settings';
import { SnippetService } from '../services/snippets';
import { createChromeStoragePort, LibraryRepository } from '../storage/repository';

export const libraryRepository = new LibraryRepository(createChromeStoragePort());
export const snippetService = new SnippetService(libraryRepository);
export const groupService = new GroupService(libraryRepository);
export const settingsService = new SettingsService(libraryRepository);

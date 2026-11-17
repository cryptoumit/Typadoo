# Typadoo

**Less typing. More doing.**

Typadoo is a lightweight text expansion and productivity tool for customer support professionals and other busy teams. It helps reduce repetitive typing and supports more consistent communication.

Users can create reusable text snippets, assign custom keyboard shortcuts, and expand them in supported fields on websites they explicitly allow. From customer support replies and troubleshooting instructions to internal notes, follow-ups, and everyday messages, Typadoo makes frequently used text accessible with just a few keystrokes.

### Planned Product Features

See the implementation backlog below for current status. Dynamic variables remain a planned feature.

- **Text Expansion:** Replace custom shortcuts with full text snippets.
- **Snippet Library:** Create, edit, organize, and manage reusable text.
- **Custom Shortcuts:** Assign memorable triggers to frequently used responses.
- **Dynamic Variables:** Personalize snippets with placeholders such as customer names, ticket IDs, and dates.
- **Categories & Tags:** Keep snippets organized by workflow, team, or topic.
- **Quick Search:** Find and insert the right snippet without interrupting your workflow.
- **Import & Export:** Back up and transfer your snippet collections.

### Built for

- Customer Support & Customer Success
- Technical Support Teams
- Sales & Operations Professionals
- Anyone who regularly types the same messages

Typadoo aims to make everyday communication faster, easier, and more consistent — without getting in the way of your workflow.

## Development Setup

This repository is a local-first Chrome Extension project built with Manifest V3, TypeScript, React, and Vite.

### Requirements

- Node.js 24.15+
- npm 10+
- Chrome or Chromium for unpacked extension testing

### Install dependencies

```bash
npm ci
```

### Development commands

```bash
npm run dev
npm run build
npm run test
npm run lint
npm run format
```

### Producing an unpacked Chrome extension

1. Run `npm run build`.
2. Confirm the `dist` directory contains the generated files.
3. Open `chrome://extensions` in Chrome.
4. Enable Developer Mode.
5. Click Load unpacked.
6. Select the `dist` directory.

### Downloading a packaged extension

1. In GitHub, open **Actions → Build automation → Run workflow** to create a downloadable build artifact.
2. Download the `typadoo-extension` artifact from the completed workflow run and extract the ZIP. Its root contains the unpacked extension files.
3. Alternatively, publish a GitHub Release whose tag matches the extension version in `public/manifest.json` (with or without a `v` prefix). The workflow attaches the ZIP and its SHA-256 checksum to that Release.

The workflow runs the test, lint, build, and dependency-audit checks before packaging. It does not publish to the Chrome Web Store.

### Project principles

- Local-first architecture only.
- No backend, accounts, cloud sync, telemetry, or remote analytics.
- Requests `storage` for the local library and `clipboardWrite` for user-triggered snippet copying.
- Uses `activeTab` and `scripting` to enable expansion only after the user grants access.
- Website access is optional and user-controlled; the popup requests the current host and scheme, not all websites.
- The popup provides search and snippet copying as a manual fallback.
- The data layer validates shortcut formats, configurable prefixes, and duplicates.
- The storage layer validates full-library JSON import/export and preserves a recovery backup.

## Storage foundation

The current data schema is version 1 and stores the complete library under the `typadoo.library`
key in `chrome.storage.local`. The library contains snippets, groups, and settings. The first
read initializes seven built-in groups and local settings; invalid stored data is reported rather
than silently replaced. A 4 MiB library limit leaves room for a recovery copy within Chrome's
local-storage quota.

Import is a validated full-library replacement, not a merge. Unsupported versions, unknown
fields, invalid records, and duplicate shortcuts are rejected before storage changes. Before a
valid replacement, the previous raw library is saved under `typadoo.recoveryBackup`. The
repository exposes recovery of a valid backup, and attempts to restore the previous library if a
replacement write fails.

The storage foundation is available in `src/storage/` and the typed snippet, group, and settings
services are in `src/services/`. The extension options page provides snippet and group management,
search and filtering, settings, and JSON backup/restore. The popup provides favorite and
search-based snippet copying.

## Text expansion

Automatic expansion is available in standard `<textarea>` elements and single-line
`text`, `search`, `url`, and `tel` inputs. Enable it from the popup on the current site or add a
website URL in the manager's Settings. Typadoo asks for an origin permission scoped to that scheme
and hostname (all paths and ports on that host);
it does not request access to subdomains or other websites. Chrome remembers the grant across
browser sessions until it is revoked. Add a site by URL, review granted website patterns, and
remove individual grants from the manager's **Settings → Enabled websites** list, or manage them
in Chrome's extension settings.

The manager's **Automatic expansion trigger** setting selects Space, Tab, or manual-only mode.
Space is the default, with the explicit trigger key required. Turning off that checkbox expands
as soon as the shortcut is completed. Tab is intercepted only when a configured shortcut matches.
Multiline snippets are supported in textareas; they are not inserted into single-line fields.
Expansion preserves the caret, dispatches a normal input event, and does not replace selected text.
Paste does not trigger expansion.

Password, email, number, date, and other specialized inputs are not supported. Neither are
`contenteditable` regions, rich-text editors, or fields inside frames. Use the popup's search and
copy workflow for those cases. Dynamic snippet variables are not implemented.

The extension registers a content script only for granted web origins. The background sends that
site's content script enabled snippets and the settings needed for matching; typed field contents
are processed locally in the page and are never sent to the background or an external service.
Browser-level verification on representative websites remains part of Milestone 5.

## Implementation backlog

### Milestone 1 — Foundation

- [x] Initialize TypeScript, React, and Vite project.
- [x] Configure Manifest V3 and Chrome extension build output.
- [x] Set up linting, formatting, and testing.
- [x] Create initial shared domain models.
- [x] Establish basic design tokens and UI foundation.

### Milestone 2 — Storage and schema

- [x] Add chrome.storage.local persistence layer.
- [x] Define versioned snippet/group/settings schema.
- [x] Add safe JSON import and export utilities.
- [x] Add validation and duplicate-shortcut checks.
- [x] Add typed snippet, group, and settings services.
- [x] Add default groups, failure handling, and recovery backup support.

### Milestone 3 — Management interface

- [x] Create dedicated extension settings/options page.
- [x] Build snippet list, search, create, edit, duplicate, and delete flows.
- [x] Add group management, snippet assignment, and destination selection when deleting populated groups.
- [x] Add favorites, enabled/disabled status, tags, and group filtering.
- [x] Add settings for shortcut prefix and appearance theme.
- [x] Keep popup lightweight with favorite/search-based snippet copying and manager navigation.
- [x] Integrate validated JSON backup and restore controls.

### Milestone 4 — Expansion engine

- [x] Implement Space, Tab, and optional immediate trigger handling in supported standard inputs and textareas.
- [x] Keep popup search and copy available as the manual fallback.
- [x] Support multiline textarea snippets and cursor-safe replacements.
- [x] Skip unsupported controls and editors without intercepting their input.

### Milestone 5 — Hardening and QA

- [ ] Verify permissions and privacy behavior in Chrome.
- [ ] Test real-world browser compatibility on representative pages.
- [ ] Add backup and recovery checks.
- [ ] Prepare production build and Chrome Web Store packaging shell.

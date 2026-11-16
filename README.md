# Typadoo

**Less typing. More doing.**

Typadoo is being built as a lightweight text expansion and productivity tool for customer support professionals and other busy teams. Its intended goal is to reduce repetitive typing and help teams communicate more consistently.

The planned experience lets users create reusable text snippets, assign custom keyboard shortcuts, and expand them while working. From customer support replies and troubleshooting instructions to internal notes, follow-ups, and everyday messages, Typadoo is intended to make frequently used text accessible with just a few keystrokes.

### Planned Product Features

These are product goals, not all currently implemented. See the implementation backlog below for current status.

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

- Node.js 22.13+ (or 24+)
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

### Project principles

- Local-first architecture only.
- No backend, accounts, cloud sync, telemetry, or remote analytics.
- Requests `storage` for the local library and `clipboardWrite` for user-triggered snippet copying.
- Website access remains optional and user-controlled.
- Popup search and snippet copying are available; direct insertion into unsupported editors remains planned.
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
services are in `src/services/`. The extension options page now provides snippet and group
management, search and filtering, settings, and JSON backup/restore. The popup provides favorite
and search-based snippet copying. Automatic expansion, content scripts, and variables are not
implemented yet.

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

- [ ] Implement trigger detection for standard inputs and textareas.
- [ ] Add manual search and insertion fallback workflow.
- [ ] Support multiline snippets and cursor-safe replacements.
- [ ] Handle unsupported editors gracefully.

### Milestone 5 — Hardening and QA

- [ ] Validate permissions and privacy behavior.
- [ ] Test real-world browser compatibility on representative pages.
- [ ] Add backup and recovery checks.
- [ ] Prepare production build and Chrome Web Store packaging shell.

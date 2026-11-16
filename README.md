# Typadoo
**Less typing. More doing.**

Typadoo is a lightweight text expansion and productivity tool designed to help customer support professionals and other busy teams save time, reduce repetitive typing, and communicate more consistently.

Create reusable text snippets, assign custom keyboard shortcuts, and instantly expand them wherever you work. From customer support replies and troubleshooting instructions to internal notes, follow-ups, and everyday messages, Typadoo makes frequently used text accessible with just a few keystrokes.

### Key Features

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

- Node.js 18+
- npm 9+
- Chrome or Chromium for unpacked extension testing

### Install dependencies

```bash
npm install
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
- User-controlled website permissions only.
- Manual search and insertion remain available for unsupported editors.
- Shortcuts use strict validation and configurable prefixes.
- JSON import/export is designed for safe backup and recovery.

## Implementation backlog

### Milestone 1 — Foundation

- [x] Initialize TypeScript, React, and Vite project.
- [x] Configure Manifest V3 and Chrome extension build output.
- [x] Set up linting, formatting, and testing.
- [x] Create initial shared domain models.
- [x] Establish basic design tokens and UI foundation.

### Milestone 2 — Storage and schema

- [ ] Add chrome.storage.local persistence layer.
- [ ] Define versioned snippet/group/settings schema.
- [ ] Add safe JSON import and export utilities.
- [ ] Add validation and duplicate-shortcut checks.

### Milestone 3 — Management interface

- [ ] Create dedicated extension settings/options page.
- [ ] Build snippet list, search, create, edit, and delete flows.
- [ ] Add grouping, favorites, tags, and default group behavior.
- [ ] Keep popup lightweight for quick actions only.

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

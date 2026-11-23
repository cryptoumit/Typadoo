# Agent instructions

## Project overview

- Typadoo is a local-first Chrome Manifest V3 extension for managing reusable text snippets and expanding shortcuts on websites the user enables.
- The popup and options entry points are `src/popup.tsx` and `src/options.tsx`; their management UI lives in `src/management/`. Persistence and library validation live in `src/storage/` and `src/services/`. Expansion runs across the background and content-script contexts; keep their messages aligned with `src/expansion/protocol.ts`.
- Keep typed field contents in the page's content script; do not send them to the background or any remote service. Do not add accounts, cloud services, telemetry, or remote analytics. Keep host permissions optional and scoped to sites the user enables, including in `public/manifest.json`.
- Preserve library validation and recovery behavior when changing storage or import/export. Expansion supports standard inputs and textareas; preserve existing trigger behavior and skip unsupported fields and editors.

## Environment and commands

- Consult `.nvmrc` and `package.json` for the required Node/npm versions and available scripts. Run the relevant checks for your changes.
- To verify extension behavior, build it and load `dist/` in Chrome; Vite preview does not emulate Chrome extension APIs.

## Code and tests

- Follow existing TypeScript and React patterns. Keep tests alongside the relevant code and update them when changing behavior.
- Keep `README.md` accurate when setup, permissions, supported fields, or user-facing behavior changes.

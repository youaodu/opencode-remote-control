# AGENTS.md

Guidance for coding agents operating in this repository.

## Project Snapshot

- Stack: Expo + React Native + TypeScript.
- Package manager: npm (`package-lock.json` present).
- TypeScript: strict mode enabled (`strict`, `noUncheckedIndexedAccess`).
- App entry: `App.tsx`.
- Core modules live under `src/` with navigation, screens, hooks, and utilities.

## Repository Layout

- `App.tsx`: app bootstrap, providers, root navigator, endpoint modal mount.
- `i18n.ts`: locale type, i18n key union, translation dictionaries, locale detection.
- `src/hooks/useAppController.ts`: central app state, networking, SSE flow, persistence.
- `src/screens/*.tsx`: `Home`, `Projects`, `Chat`, `Settings` screens.
- `src/components/EndpointModal.tsx`: endpoint create/edit modal.
- `src/navigation/*`: stack navigator and route param types.
- `src/utils/chatApi.ts`: URL builders, parsing helpers, normalization, ID helpers.
- `src/config/storage.ts`: AsyncStorage key constants and key helpers.
- `src/types/chat.ts`: domain types (`Message`, `Endpoint`, `ConnectionState`).

## Setup and Run Commands

- Install dependencies: `npm install`
- Start Expo dev server: `npm run start`
- Run Android target: `npm run android`
- Run iOS target: `npm run ios`
- Run web target: `npm run web`

## Build, Lint, Typecheck, and Test Commands

Current `package.json` has no dedicated `build`, `lint`, or `test` scripts.
Use these validation commands unless/until scripts are added.

- Typecheck (primary gate): `npx tsc --noEmit`
- Expo config sanity check: `npx expo config --type public`
- Clear Metro cache when needed: `npx expo start --clear`

If linting is introduced:

- Preferred script: `npm run lint`
- Suggested command: `eslint . --ext .ts,.tsx,.js,.jsx`

If Jest is introduced:

- All tests: `npx jest`
- Watch mode: `npx jest --watch`
- Coverage: `npx jest --coverage`
- One test file: `npx jest <path-to-test-file>`
- One test by name: `npx jest <path-to-test-file> -t "<name substring>"`
- Script form once available: `npm test -- <path-to-test-file> -t "<name substring>"`

## Single-Test Workflow (Important)

When asked to run a single test, use this order:

1. `npx jest <path-to-test-file>`
2. `npx jest <path-to-test-file> -t "<name substring>"`
3. If `npm test` exists: `npm test -- <path-to-test-file> -t "<name substring>"`

If tests are not configured, state that clearly and run `npx tsc --noEmit` instead.

## Code Style: General

- Use TypeScript everywhere for app logic and component code.
- Prefer functional components + hooks; avoid class components.
- Keep files ASCII unless existing content requires non-ASCII (i18n strings are valid).
- Use semicolons and single quotes.
- Use trailing commas in multiline literals/imports.
- Use 2-space indentation and readable line lengths.
- Prefer `const`; use `let` only when reassignment is required.

## Code Style: Imports

- Group imports in this order:
  1) third-party packages,
  2) React/React Native platform modules,
  3) local modules.
- Keep type-only imports explicit with `import type`.
- Keep imports consolidated per module when readable.
- Remove unused imports immediately.

## Code Style: Types and Data Modeling

- Use `type` aliases for domain models and unions (current convention).
- Model finite states with narrow unions (`'idle' | 'connecting' | ...`).
- Use explicit nullable returns (`string | null`) for parse/lookup helpers.
- Treat external JSON as `unknown`, then narrow with runtime checks.
- Prefer `Record<string, unknown>` for dynamic object payloads.
- Avoid `any`; if unavoidable, isolate it and keep scope small.

## Naming Conventions

- Components and types: `PascalCase`.
- Variables, functions, handlers: `camelCase`.
- Constants: `UPPER_SNAKE_CASE`.
- React state pairs: `[value, setValue]`.
- Refs should end with `Ref`.
- Translation keys use descriptive lower camelCase strings.

## React and UI Guidelines

- Keep hook calls at top-level and stable order.
- Prefer small handlers; move complex logic to helpers/hooks.
- Use `StyleSheet.create` for style objects.
- Preserve existing visual language and palette unless user requests redesign.
- Use safe-area aware layouts (`SafeAreaView`/`SafeAreaProvider`) consistently.

## Error Handling, Networking, and Concurrency

- Wrap async network flows in `try/catch`.
- Check `response.ok` before consuming payloads.
- Preserve compatibility fallbacks (example: alternate session endpoint path).
- Parse API payloads defensively and tolerate shape drift.
- Use `AbortController` for cancellable requests and cleanup on unmount.
- Only use `catch {}` for intentionally ignored, non-critical failures.

## State, Storage, and Side Effects

- Keep AsyncStorage keys in `src/config/storage.ts` constants.
- Centralize persistence reads/writes in controller-level logic when possible.
- Reset dependent state when endpoint/session context changes.
- Prevent race conditions using local request context and abort signaling.
- Keep side effects explicit in `useEffect` with cleanup functions.

## Internationalization Rules

- Add new user-facing copy to both `en` and `zh` dictionaries in `i18n.ts`.
- Update `I18nKey` union for every new key.
- Prefer `t('key')` lookups instead of inline strings in components.
- Keep translation meaning aligned across locales.

## Agent Working Rules

- Read relevant files fully before making non-trivial edits.
- Make minimal, scoped changes aligned with existing patterns.
- Do not add dependencies unless necessary for the requested task.
- Run `npx tsc --noEmit` after meaningful TypeScript changes.
- If you cannot run a check, explicitly state what was skipped and why.

## Cursor and Copilot Rules

- `.cursor/rules/`: not present.
- `.cursorrules`: not present.
- `.github/copilot-instructions.md`: not present.
- No additional Cursor or Copilot instruction files are currently applied.

## Recommended Tooling Defaults (If Added Later)

- Linting: ESLint + `@typescript-eslint` + React/React Native plugins.
- Formatting: Prettier with semicolon + single-quote style.
- Testing: Jest + `jest-expo` + React Native Testing Library.
- Helpful scripts: `lint`, `lint:fix`, `test`, `test:watch`, `typecheck`.

Keep this file updated when scripts, architecture, or coding conventions change.

# Developer Notes — cw.api.core.events

> Event bus internals, coding conventions, and release workflow reference.

## Architecture Overview
- **Module integration** (`src/module.ts`): `eventsModule` registers `EventBus`
  with the DI container as a singleton; `useEvents()` applies the same module
  to the default container and returns the shared instance.
- **EventBus** (`src/eventBus.ts`):
  - Holds a registry of `EventDefinition` objects and ordered subscriber sets.
  - `trigger` chooses sync vs async execution according to the definition and
    returns the shared invocation context.
  - Emits lifecycle hooks (`CORE_EVENTS`) for before/after trigger, subscriber
    errors, and subscription changes. Core events are flagged as `internal` so
    they do not recurse into one another.
- **EventInvocationContext** (`src/eventInvocationContext.ts`): mutable carrier
  that travels through the subscriber chain. Exposes payload, mutable result,
  metadata, stop flags, and captured errors.
- **Type helpers** (`src/types.ts`): `defineEvent`, `EventHandler` conditional
  types, trigger options, and convenience aliases for internal maps.
- **Core events** (`src/coreEvents.ts`): curated lifecycle definitions used by
  the bus. They are exported for consumers that want telemetry or logging.

## Behavioural Notes
- Synchronous events reject async subscribers at runtime. The handler returning
  a promise triggers a `TypeError`, marks the invocation as stopped-for-error,
  and raises `CORE_EVENTS.subscriberError`.
- `trigger` always builds an `EventInvocationContext` with the subscriber count
  snapshot so callers can see whether any handlers executed.
- Initial results resolve in the following order:
  1. `trigger`'s `initialResult` option (explicit override).
  2. `EventDefinition.createInitialResult()` if provided.
  3. `undefined`.
- `throwOnError` rethrows captured errors after lifecycle notifications fire.
  Use it when the caller wants to fail fast while still emitting telemetry.
- `removeEvent` does not allow removing core events to avoid breaking internal
  diagnostics. Regular events are removed together with their subscribers.

## Testing Strategy
- Jest suites live under `tests/` and rely on ts-jest in ESM mode.
- `tests/eventBus.test.ts` covers:
  - Sequential propagation of results for sync and async events.
  - Stop semantics and stop reasons.
  - Runtime rejection of invalid async handlers on sync events.
  - Error capture, `throwOnError`, core lifecycle emission, and metadata flow.
  - Subscriber bookkeeping (`unsubscribe`, `removeEvent`, `hasSubscribers`).
- `tests/module.test.ts` ensures `eventsModule` and `useEvents()` integrate
  with the container as expected, always returning the same singleton instance.
- Maintain coverage ≥90% (statements/lines/functions/branches) in line with the
  repository hooks by extending the suite when new behaviours appear.

## Tooling & Scripts
- `npm run lint` – ESLint 9 flat config over `src` and `tests`.
- `npm run test` / `npm run test:coverage` – Jest in `--experimental-vm-modules`
  mode; coverage command enforces repository thresholds.
- `npm run build` – TypeScript build via `tsconfig.build.json`, emitting ESM to
  `dist/` with declarations.
- `npm version <type>` – bumps the version and creates commit/tag (run `git push --follow-tags` afterwards).
- `npm run hooks:install` – activates `.githooks` (format → metadata validation → lint → coverage plus post-commit auto-tagging on version bumps).

## Release Checklist
1. Update `CHANGE_LOG.md`, `README.md`, and this file to reflect changes.
2. Run `npm run lint`, `npm run test:coverage`, and `npm run build`.
3. Ensure working tree is clean and commit only relevant files.
4. `npm version <type>` (prefer `minor` for feature additions, `patch` for fixes).
5. `git push --follow-tags`.
6. Publish via GitHub Actions or `npm publish --provenance` if needed.

## Future Ideas
- Optional child buses for scoped subscriber sets (kept in backlog until a
  concrete need arises).
- Utilities for composing multiple event buses or bridging to the DI container
  shortcut helpers.
- Richer diagnostics payloads (e.g., timing information) on core events once
  real-world usage dictates the shape.

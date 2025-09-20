# Changelog

## [1.0.0] - 2025-09-20
- Marked the event bus stable: sync/async chaining, lifecycle hooks, metadata checks,
  and automated tag pushes are now backed by semver guarantees.
- No API changes were required; packages already using 0.x can upgrade without code changes.

## [0.2.3] - 2025-09-20
- Documented automatic `git push --follow-tags` behaviour and ensured repository metadata stays in sync across commits.

## [0.2.2] - 2025-09-20
- Added package metadata validation hooks and post-commit auto-tagging when versions change on the default branch.
- Populated `repository`, `bugs`, and `homepage` fields to satisfy npm provenance requirements.

## [0.2.0] - 2025-09-20
- Introduced the fully typed `EventBus` with synchronous/asynchronous event modes, result piping, stop semantics, and trigger metadata.
- Added lifecycle core events (`CORE_EVENTS`) covering before/after trigger, subscriber errors, and subscription mutations for diagnostics.
- Expanded documentation and authored a comprehensive Jest suite for sync/async chains, error handling, metadata flow, and event removal.

## [0.1.1] - 2025-09-20
- Minor template maintenance after the initial scaffold.

## [0.1.0] - 2025-09-20
- Initial release scaffolded by cw.helper.package.generator.

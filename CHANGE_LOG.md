# Changelog

## [0.2.0] - 2025-09-20
- Introduced the fully typed `EventBus` with synchronous/asynchronous event
  modes, result piping, stop semantics, and trigger metadata.
- Added lifecycle core events (`CORE_EVENTS`) covering before/after trigger,
  subscriber errors, and subscription mutations for diagnostics.
- Expanded documentation and authored a comprehensive Jest suite for sync/async
  chains, error handling, metadata flow, and event removal.

## [0.1.1] - 2025-09-20
- Minor template maintenance after the initial scaffold.

## [0.1.0] - 2025-09-20
- Initial release scaffolded by cw.helper.package.generator.

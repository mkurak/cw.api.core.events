# cw.api.core.events

Small but opinionated event bus designed for the cw API ecosystem. It favours
explicit event definitions, deterministic subscriber execution, and full
control over the result that flows through a trigger chain.

## Highlights
- **Instance based** – create as many `EventBus` instances as you need and wire
  them into DI containers or standalone utilities.
- **Sync & async events** – every event declares whether subscribers may yield
  promises; accidental mismatches surface as runtime errors for easier
  debugging.
- **Result piping** – subscribers read and mutate a shared `result` value, so
  the caller always sees the final outcome of the chain.
- **Flow control** – `stop()` and `stopForError()` prevent further subscribers
  from executing and capture optional reasons or thrown errors.
- **Core lifecycle events** – built-in hooks expose trigger, error, and
  subscription activity for logging or telemetry without polluting your own
  event names.

## Installation

```bash
npm install cw.api.core.events
```

Target runtime: Node.js 18+ (pure ESM).

## Quick Start

```ts
import { EventBus, defineEvent } from 'cw.api.core.events';

const userCreated = defineEvent<{ id: string }, string, 'async'>({
    name: 'user.created',
    mode: 'async',
    description: 'Raised after a user entity is created.'
});

const bus = new EventBus();

bus.subscribe(userCreated, async (ctx) => {
    ctx.result = `welcome:${ctx.payload.id}`;
});

bus.subscribe(userCreated, async (ctx) => {
    await sendEmail(ctx.payload.id, ctx.result);
    ctx.stop('email-dispatched');
});

const context = await bus.trigger(userCreated, { id: '123' }, { initialResult: 'seed' });

console.log(context.result); // => "welcome:123"
console.log(context.stoppedReason); // => "email-dispatched"
```

## Defining Events

Use `defineEvent` to create strongly typed event descriptors. The descriptor
captures the payload, result type, and whether the event is synchronous or
asynchronous.

```ts
const requestFinished = defineEvent<{ duration: number }, void, 'sync'>({
    name: 'request.finished',
    mode: 'sync',
    createInitialResult: () => undefined
});
```

Pass descriptors to `EventBus.registerEvent`, `subscribe`, and `trigger`. The
bus automatically registers the event when you subscribe if it is not already
known.

## Working with Subscribers

- **Context data** – subscribers receive an `EventContext` with the payload,
  mutable `result`, optional metadata from the trigger call, and helper methods
  (`setResult`, `stop`, `stopForError`).
- **Result mutation** – assign to `ctx.result` or call `ctx.setResult(value)`;
  the final value is returned to the caller.
- **Stopping the chain** – call `ctx.stop('reason')` to skip remaining
  subscribers. When an error bubbles, the bus calls `stopForError(error,
  reason)` automatically.
- **Sync vs async** – synchronous events reject async subscribers; the bus
  marks the invocation as failed and records the `TypeError` on the context.

## Trigger Metadata & Flow Control

```ts
const context = await bus.trigger(event, payload, {
    initialResult: createDefaultResult(),
    metadata: { requestId },
    throwOnError: true
});

if (context.stoppedForError) {
    // the original error is available on context.error
}
```

- `initialResult` seeds the `result` that the first subscriber sees. You can
  also provide `createInitialResult` on the event definition for reusable
  defaults.
- `metadata` travels with the invocation and stays read-only for subscribers.
- `throwOnError` rethrows the captured error after the chain completes.

## Core Events

Every `EventBus` instance automatically registers the following lifecycle
events under the `CORE_EVENTS` export:

| Event | Payload | Use case |
|-------|---------|----------|
| `CORE_EVENTS.beforeTrigger` | `{ event, payload, options }` | Inspect upcoming triggers, start timers |
| `CORE_EVENTS.afterTrigger` | `{ event, result }` | Capture timing or final results |
| `CORE_EVENTS.subscriberError` | `{ event, error, context }` | Centralised error logging |
| `CORE_EVENTS.subscriberRegistered` | `{ event, handler }` | Diagnostics for wiring |
| `CORE_EVENTS.subscriberRemoved` | `{ event, handler }` | Diagnostics for cleanup |

They are flagged as internal, so the bus will not emit lifecycle notifications
when they trigger themselves—subscribe to them directly for logging or metrics.

## Integration Tips

- **Dependency Injection** – When pairing with `cw.api.core.di`, import either
  `eventsModule` or the `useEvents()` helper. The module registers `EventBus` as
  a singleton, while `useEvents()` attaches the module to the default container
  and returns the shared instance.
- **Testing** – use the returned invocation context to assert results, stop
  reasons, and error surfaces. The Jest suite in `tests/eventBus.test.ts`
  demonstrates common scenarios.
- **Extensibility** – prefer wrapping event creation in factory functions to
  keep event names consistent across packages.

## Development

```bash
npm install
npm run lint
npm run test:coverage
npm run build
```

Publish flow: update docs/changelog, run the full validation pipeline, then
`npm run release -- <type>` to bump the version, create a git tag, and push.

## License

MIT © 2025 Mert Kurak

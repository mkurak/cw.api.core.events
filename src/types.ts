export type EventMode = 'sync' | 'async';

export interface EventDefinition<
    TPayload = unknown,
    TResult = unknown,
    TMode extends EventMode = 'sync'
> {
    /**
     * Unique event name. Used as the subscription key.
     */
    readonly name: string;
    /**
     * Determines whether subscribers are allowed to run asynchronously.
     */
    readonly mode: TMode;
    /**
     * Optional human readable description.
     */
    readonly description?: string;
    /**
     * Additional metadata to help with diagnostics/discovery.
     */
    readonly metadata?: Record<string, unknown>;
    /**
     * When true, the bus skips emitting core lifecycle events to prevent recursion.
     */
    readonly internal?: boolean;
    /**
     * Provides an initial result value before the first subscriber runs.
     */
    readonly createInitialResult?: () => TResult;
    /**
     * Phantom property to preserve the payload/result generics at the type level only.
     * @internal
     */
    readonly __types?: {
        readonly payload: TPayload;
        readonly result: TResult;
    };
}

export interface EventTriggerOptions<TResult> {
    /**
     * Overrides the initial result for this trigger invocation.
     */
    readonly initialResult?: TResult;
    /**
     * When true, rethrows subscriber errors after the chain stops.
     */
    readonly throwOnError?: boolean;
    /**
     * Arbitrary metadata that travels with the invocation context.
     */
    readonly metadata?: Record<string, unknown>;
}

export interface EventSubscription {
    readonly event: string;
    unsubscribe(): void;
}

export interface EventContext<TPayload, TResult> {
    readonly event: EventDefinition<TPayload, TResult>;
    readonly payload: TPayload;
    /**
     * Mutable result value that travels between subscribers.
     */
    result: TResult | undefined;
    /**
     * User supplied metadata for this trigger invocation.
     */
    readonly metadata?: Record<string, unknown>;
    readonly stopped: boolean;
    readonly stoppedReason?: string;
    readonly stoppedForError: boolean;
    readonly error?: unknown;
    readonly hasSubscribers: boolean;
    setResult(value: TResult | undefined): void;
    stop(reason?: string): void;
    stopForError(error: unknown, reason?: string): void;
}

export type EventTriggerResult<TPayload, TResult> = Readonly<EventContext<TPayload, TResult>>;

export type EventHandler<TPayload, TResult, TMode extends EventMode> = TMode extends 'sync'
    ? (context: EventContext<TPayload, TResult>) => void | TResult | undefined
    : (
          context: EventContext<TPayload, TResult>
      ) => void | TResult | undefined | Promise<void | TResult | undefined>;

export type AnyEventDefinition = EventDefinition<unknown, unknown, EventMode>;

export type AnyEventHandler = EventHandler<unknown, unknown, EventMode>;

export const defineEvent = <
    TPayload = unknown,
    TResult = unknown,
    TMode extends EventMode = 'sync'
>(
    definition: EventDefinition<TPayload, TResult, TMode>
): EventDefinition<TPayload, TResult, TMode> => definition;

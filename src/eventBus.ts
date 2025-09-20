import { CORE_EVENTS } from './coreEvents.js';
import { EventInvocationContext } from './eventInvocationContext.js';
import type {
    AnyEventDefinition,
    AnyEventHandler,
    EventContext,
    EventDefinition,
    EventHandler,
    EventMode,
    EventSubscription,
    EventTriggerOptions,
    EventTriggerResult
} from './types.js';

type SubscriberSet = Set<AnyEventHandler>;

interface EventRecord {
    readonly definition: AnyEventDefinition;
    readonly subscribers: SubscriberSet;
}

function isPromiseLike(value: unknown): value is Promise<unknown> {
    return (
        typeof value === 'object' &&
        value !== null &&
        typeof (value as Promise<unknown>).then === 'function'
    );
}

const STOPPED_BY_ERROR = 'Subscriber threw an error';

export class EventBus {
    private readonly events = new Map<string, EventRecord>();

    constructor({ includeCoreEvents = true }: { includeCoreEvents?: boolean } = {}) {
        if (includeCoreEvents) {
            this.registerCoreEvents();
        }
    }

    registerEvent<TPayload, TResult, TMode extends EventMode>(
        definition: EventDefinition<TPayload, TResult, TMode>
    ): EventDefinition<TPayload, TResult, TMode> {
        const existing = this.events.get(definition.name);
        if (existing) {
            if (existing.definition !== definition) {
                if (existing.definition.mode !== definition.mode) {
                    throw new Error(
                        `Event "${definition.name}" already registered with mode "${existing.definition.mode}".`
                    );
                }
                return existing.definition as EventDefinition<TPayload, TResult, TMode>;
            }
            return definition;
        }

        this.events.set(definition.name, {
            definition,
            subscribers: new Set()
        });

        return definition;
    }

    hasEvent(event: AnyEventDefinition | string): boolean {
        const name = typeof event === 'string' ? event : event.name;
        return this.events.has(name);
    }

    getEvent(name: string): AnyEventDefinition | undefined {
        const record = this.events.get(name);
        return record?.definition;
    }

    listEvents(): ReadonlyArray<AnyEventDefinition> {
        return Array.from(this.events.values(), (record) => record.definition);
    }

    getSubscriberCount(event: EventDefinition | string): number {
        const record = this.tryGetRecord(event);
        return record?.subscribers.size ?? 0;
    }

    subscribe<TPayload, TResult, TMode extends EventMode>(
        definition: EventDefinition<TPayload, TResult, TMode>,
        handler: EventHandler<TPayload, TResult, TMode>
    ): EventSubscription {
        const record = this.ensureRecord(definition);
        const alreadyHad = record.subscribers.has(handler as AnyEventHandler);

        record.subscribers.add(handler as AnyEventHandler);

        if (!record.definition.internal && !alreadyHad) {
            void this.triggerInternal(CORE_EVENTS.subscriberRegistered, {
                event: record.definition,
                handler: handler as AnyEventHandler
            });
        }

        return {
            event: record.definition.name,
            unsubscribe: () => {
                this.unsubscribe(definition, handler);
            }
        };
    }

    unsubscribe<TPayload, TResult, TMode extends EventMode>(
        definition: EventDefinition<TPayload, TResult, TMode>,
        handler: EventHandler<TPayload, TResult, TMode>
    ): boolean {
        const record = this.tryGetRecord(definition);
        if (!record) {
            return false;
        }

        const removed = record.subscribers.delete(handler as AnyEventHandler);

        if (removed && !record.definition.internal) {
            void this.triggerInternal(CORE_EVENTS.subscriberRemoved, {
                event: record.definition,
                handler: handler as AnyEventHandler
            });
        }

        return removed;
    }

    removeEvent(definition: AnyEventDefinition | string): boolean {
        const record = this.tryGetRecord(definition);
        if (!record) {
            return false;
        }

        if (record.definition.internal) {
            throw new Error(`Core event "${record.definition.name}" cannot be removed.`);
        }

        return this.events.delete(record.definition.name);
    }

    trigger<TPayload, TResult, TMode extends EventMode>(
        definition: EventDefinition<TPayload, TResult, TMode>,
        payload?: TPayload,
        options?: EventTriggerOptions<TResult>
    ): TMode extends 'sync'
        ? EventTriggerResult<TPayload, TResult>
        : Promise<EventTriggerResult<TPayload, TResult>> {
        const record = this.ensureRecord(definition);
        const initialResult = this.resolveInitialResult(record.definition, options);
        const context = new EventInvocationContext<TPayload, TResult>(
            record.definition as EventDefinition<TPayload, TResult>,
            payload as TPayload,
            initialResult,
            options?.metadata,
            record.subscribers.size > 0
        );

        const skipLifecycle = record.definition.internal === true;

        if (!skipLifecycle) {
            void this.triggerInternal(CORE_EVENTS.beforeTrigger, {
                event: record.definition,
                payload,
                options: options as EventTriggerOptions<unknown>
            });
        }

        if (record.definition.mode === 'sync') {
            this.runSync(record, context);

            if (!skipLifecycle) {
                void this.triggerInternal(CORE_EVENTS.afterTrigger, {
                    event: record.definition,
                    result: context as EventTriggerResult<unknown, unknown>
                });
            }

            if (options?.throwOnError && context.stoppedForError && context.error) {
                throw context.error;
            }

            return context as unknown as TMode extends 'sync'
                ? EventTriggerResult<TPayload, TResult>
                : never;
        }

        return this.runAsync(record, context).then((asyncContext) => {
            if (!skipLifecycle) {
                void this.triggerInternal(CORE_EVENTS.afterTrigger, {
                    event: record.definition,
                    result: asyncContext as EventTriggerResult<unknown, unknown>
                });
            }

            if (options?.throwOnError && asyncContext.stoppedForError && asyncContext.error) {
                throw asyncContext.error;
            }

            return asyncContext as EventTriggerResult<TPayload, TResult>;
        }) as TMode extends 'sync'
            ? EventTriggerResult<TPayload, TResult>
            : Promise<EventTriggerResult<TPayload, TResult>>;
    }

    private runSync<TPayload, TResult>(
        record: EventRecord,
        context: EventInvocationContext<TPayload, TResult>
    ): void {
        for (const handler of record.subscribers) {
            if (context.stopped) {
                break;
            }

            try {
                const result = handler(context as unknown as EventContext<unknown, unknown>);
                if (isPromiseLike(result)) {
                    throw new TypeError(
                        `Event "${record.definition.name}" is synchronous but a subscriber returned a promise.`
                    );
                }

                if (typeof result !== 'undefined') {
                    context.setResult(result as TResult | undefined);
                }
            } catch (error) {
                context.stopForError(error, STOPPED_BY_ERROR);
                this.handleSubscriberError(record, context);
                break;
            }
        }
    }

    private async runAsync<TPayload, TResult>(
        record: EventRecord,
        context: EventInvocationContext<TPayload, TResult>
    ): Promise<EventInvocationContext<TPayload, TResult>> {
        for (const handler of record.subscribers) {
            if (context.stopped) {
                break;
            }

            try {
                const result = handler(context as unknown as EventContext<unknown, unknown>);
                const awaited = isPromiseLike(result) ? await result : result;

                if (typeof awaited !== 'undefined') {
                    context.setResult(awaited as TResult | undefined);
                }
            } catch (error) {
                context.stopForError(error, STOPPED_BY_ERROR);
                this.handleSubscriberError(record, context);
                break;
            }
        }

        return context;
    }

    private resolveInitialResult<TResult>(
        definition: AnyEventDefinition,
        options?: EventTriggerOptions<TResult>
    ): TResult | undefined {
        if (options && Object.prototype.hasOwnProperty.call(options, 'initialResult')) {
            return options.initialResult as TResult | undefined;
        }

        if (definition.createInitialResult) {
            return definition.createInitialResult() as TResult | undefined;
        }

        return undefined;
    }

    private handleSubscriberError<TPayload, TResult>(
        record: EventRecord,
        context: EventInvocationContext<TPayload, TResult>
    ): void {
        if (record.definition.internal) {
            return;
        }

        void this.triggerInternal(CORE_EVENTS.subscriberError, {
            event: record.definition,
            error: context.error,
            context: context as unknown as EventTriggerResult<unknown, unknown>
        });
    }

    private ensureRecord<TPayload, TResult, TMode extends EventMode>(
        definition: EventDefinition<TPayload, TResult, TMode>
    ): EventRecord {
        const existing = this.tryGetRecord(definition);
        if (existing) {
            return existing;
        }

        this.registerEvent(definition);
        const record = this.events.get(definition.name);
        if (!record) {
            throw new Error(`Failed to register event "${definition.name}".`);
        }
        return record;
    }

    private tryGetRecord(event: AnyEventDefinition | string): EventRecord | undefined {
        const name = typeof event === 'string' ? event : event.name;
        return this.events.get(name);
    }

    private registerCoreEvents(): void {
        for (const coreEvent of Object.values(CORE_EVENTS)) {
            this.registerEvent(coreEvent as AnyEventDefinition);
        }
    }

    private triggerInternal(
        definition: AnyEventDefinition,
        payload: unknown
    ): EventTriggerResult<unknown, unknown> | Promise<EventTriggerResult<unknown, unknown>> {
        return this.trigger(definition, payload as never, { throwOnError: false });
    }
}

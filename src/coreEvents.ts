import type {
    AnyEventDefinition,
    AnyEventHandler,
    EventTriggerOptions,
    EventTriggerResult
} from './types.js';
import { defineEvent } from './types.js';

export interface CoreBeforeTriggerPayload {
    readonly event: AnyEventDefinition;
    readonly payload: unknown;
    readonly options?: EventTriggerOptions<unknown>;
}

export interface CoreAfterTriggerPayload {
    readonly event: AnyEventDefinition;
    readonly result: EventTriggerResult<unknown, unknown>;
}

export interface CoreSubscriberErrorPayload {
    readonly event: AnyEventDefinition;
    readonly error: unknown;
    readonly context: EventTriggerResult<unknown, unknown>;
}

export interface CoreSubscriberMutationPayload {
    readonly event: AnyEventDefinition;
    readonly handler: AnyEventHandler;
}

export const CORE_EVENTS = {
    beforeTrigger: defineEvent<CoreBeforeTriggerPayload>({
        name: 'cw.events.core.beforeTrigger',
        mode: 'sync',
        description: 'Raised before an event starts iterating over subscribers.',
        internal: true
    }),
    afterTrigger: defineEvent<CoreAfterTriggerPayload>({
        name: 'cw.events.core.afterTrigger',
        mode: 'sync',
        description: 'Raised after an event finishes iterating over subscribers.',
        internal: true
    }),
    subscriberError: defineEvent<CoreSubscriberErrorPayload>({
        name: 'cw.events.core.subscriberError',
        mode: 'sync',
        description: 'Raised when a subscriber throws while handling an event.',
        internal: true
    }),
    subscriberRegistered: defineEvent<CoreSubscriberMutationPayload>({
        name: 'cw.events.core.subscriberRegistered',
        mode: 'sync',
        description: 'Raised when a subscriber is added to an event.',
        internal: true
    }),
    subscriberRemoved: defineEvent<CoreSubscriberMutationPayload>({
        name: 'cw.events.core.subscriberRemoved',
        mode: 'sync',
        description: 'Raised when a subscriber is removed from an event.',
        internal: true
    })
} as const;

export type CoreEventDefinition = (typeof CORE_EVENTS)[keyof typeof CORE_EVENTS];

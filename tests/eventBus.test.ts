import { jest } from '@jest/globals';

import { EventBus, CORE_EVENTS, defineEvent } from '../src/index.js';

const SyncEvent = defineEvent<{ value: number }, string | undefined, 'sync'>({
    name: 'tests.syncEvent',
    mode: 'sync'
});

const AsyncEvent = defineEvent<{ value: number }, number, 'async'>({
    name: 'tests.asyncEvent',
    mode: 'async'
});

const EventWithFactory = defineEvent<void, number, 'sync'>({
    name: 'tests.withFactory',
    mode: 'sync',
    createInitialResult: () => 5
});

describe('EventBus', () => {
    it('handles repeated registrations and mode conflicts', () => {
        const bus = new EventBus();
        const duplicate = defineEvent<{ id: string }, void, 'sync'>({
            name: 'tests.duplicate',
            mode: 'sync'
        });

        const first = bus.registerEvent(duplicate);
        const second = bus.registerEvent(duplicate);

        expect(first).toBe(duplicate);
        expect(second).toBe(duplicate);

        const conflicting = defineEvent<{ id: string }, void, 'async'>({
            name: 'tests.duplicate',
            mode: 'async'
        });

        expect(() => bus.registerEvent(conflicting)).toThrow('already registered');
    });

    it('propagates results sequentially for synchronous events', () => {
        const bus = new EventBus();
        bus.registerEvent(SyncEvent);

        const calls: string[] = [];

        bus.subscribe(SyncEvent, (ctx) => {
            calls.push('first');
            expect(ctx.result).toBeUndefined();
            ctx.result = `value:${ctx.payload.value}`;
        });

        bus.subscribe(SyncEvent, (ctx) => {
            calls.push('second');
            expect(ctx.result).toBe('value:1');
            ctx.setResult(`${ctx.result}-processed`);
        });

        const result = bus.trigger(SyncEvent, { value: 1 });

        expect(result.result).toBe('value:1-processed');
        expect(result.stopped).toBe(false);
        expect(result.stoppedForError).toBe(false);
        expect(result.hasSubscribers).toBe(true);
        expect(calls).toEqual(['first', 'second']);
    });

    it('stops the chain when stop is invoked', () => {
        const bus = new EventBus();
        bus.registerEvent(SyncEvent);

        const calls: string[] = [];

        bus.subscribe(SyncEvent, (ctx) => {
            calls.push('first');
            ctx.stop('done');
        });

        bus.subscribe(SyncEvent, () => {
            calls.push('second');
        });

        const result = bus.trigger(SyncEvent, { value: 10 });

        expect(result.stopped).toBe(true);
        expect(result.stoppedReason).toBe('done');
        expect(result.hasSubscribers).toBe(true);
        expect(calls).toEqual(['first']);
    });

    it('records errors and exposes them to the caller', () => {
        const bus = new EventBus();
        bus.registerEvent(SyncEvent);

        const errors: unknown[] = [];
        bus.subscribe(CORE_EVENTS.subscriberError, ({ payload }) => {
            errors.push(payload.error);
        });

        bus.subscribe(SyncEvent, () => {
            throw new Error('boom');
        });

        const result = bus.trigger(SyncEvent, { value: 42 });

        expect(result.stoppedForError).toBe(true);
        expect(result.error).toBeInstanceOf(Error);
        expect((result.error as Error).message).toBe('boom');
        expect(errors).toHaveLength(1);
        expect((errors[0] as Error).message).toBe('boom');
    });

    it('rethrows errors when throwOnError is enabled', () => {
        const bus = new EventBus();
        bus.registerEvent(SyncEvent);

        bus.subscribe(SyncEvent, () => {
            throw new Error('expected');
        });

        expect(() => bus.trigger(SyncEvent, { value: 1 }, { throwOnError: true })).toThrow(
            'expected'
        );
    });

    it('rejects async subscribers on synchronous events', () => {
        const bus = new EventBus();
        bus.registerEvent(SyncEvent);

        // @ts-expect-error intentionally subscribing async handler to sync event
        bus.subscribe(SyncEvent, async () => 'oops');

        const result = bus.trigger(SyncEvent, { value: 2 });

        expect(result.stoppedForError).toBe(true);
        expect(result.error).toBeInstanceOf(TypeError);
        expect(bus.trigger(SyncEvent, { value: 3 }).stoppedForError).toBe(true);
    });

    it('awaits sequential async subscribers', async () => {
        const bus = new EventBus();
        bus.registerEvent(AsyncEvent);

        const order: string[] = [];

        bus.subscribe(AsyncEvent, async (ctx) => {
            order.push('a');
            await new Promise((resolve) => setTimeout(resolve, 10));
            ctx.result = ctx.payload.value + 1;
        });

        bus.subscribe(AsyncEvent, async (ctx) => {
            order.push('b');
            await new Promise((resolve) => setTimeout(resolve, 5));
            ctx.setResult((ctx.result ?? 0) * 2);
        });

        const result = await bus.trigger(AsyncEvent, { value: 5 });

        expect(result.result).toBe(12);
        expect(order).toEqual(['a', 'b']);
    });

    it('supports unsubscribing subscribers', () => {
        const bus = new EventBus();
        bus.registerEvent(SyncEvent);

        const handler = jest.fn();
        const subscription = bus.subscribe(SyncEvent, handler);

        subscription.unsubscribe();

        bus.trigger(SyncEvent, { value: 1 });

        expect(handler).not.toHaveBeenCalled();
        expect(bus.getSubscriberCount(SyncEvent)).toBe(0);
    });

    it('provides metadata and initial results', () => {
        const bus = new EventBus();
        bus.registerEvent(EventWithFactory);

        const receivedMetadata: unknown[] = [];
        const seenResults: Array<number | undefined> = [];

        bus.subscribe(EventWithFactory, (ctx) => {
            receivedMetadata.push(ctx.metadata);
            seenResults.push(ctx.result);
            ctx.result = (ctx.result ?? 0) + 1;
        });

        const result = bus.trigger(EventWithFactory, undefined, {
            initialResult: 7,
            metadata: { requestId: 'abc' }
        });

        expect(result.result).toBe(8);
        expect(receivedMetadata).toEqual([{ requestId: 'abc' }]);

        const fallback = bus.trigger(EventWithFactory);
        expect(fallback.result).toBe(6);
        expect(receivedMetadata).toEqual([{ requestId: 'abc' }, undefined]);
        expect(seenResults).toEqual([7, 5]);
        expect(fallback.event).toBe(EventWithFactory);
    });

    it('allows removing events that are not core events', () => {
        const bus = new EventBus();
        bus.registerEvent(SyncEvent);
        expect(bus.hasEvent(SyncEvent)).toBe(true);

        const removed = bus.removeEvent(SyncEvent);

        expect(removed).toBe(true);
        expect(bus.hasEvent(SyncEvent)).toBe(false);
    });

    it('throws when attempting to remove core events', () => {
        const bus = new EventBus();
        expect(() => bus.removeEvent(CORE_EVENTS.beforeTrigger)).toThrow(
            'Core event "cw.events.core.beforeTrigger" cannot be removed.'
        );
    });

    it('marks context as having no subscribers when none are present', () => {
        const bus = new EventBus();
        bus.registerEvent(SyncEvent);

        const context = bus.trigger(SyncEvent, { value: 1 });

        expect(context.hasSubscribers).toBe(false);
        expect(context.result).toBeUndefined();
    });

    it('notifies core before/after trigger listeners', () => {
        const bus = new EventBus();
        bus.registerEvent(SyncEvent);

        const before = jest.fn();
        const after = jest.fn();

        bus.subscribe(CORE_EVENTS.beforeTrigger, ({ payload }) => {
            before(payload);
        });

        bus.subscribe(CORE_EVENTS.afterTrigger, ({ payload }) => {
            after(payload);
        });

        bus.trigger(SyncEvent, { value: 9 });

        expect(before).toHaveBeenCalledTimes(1);
        expect(before.mock.calls[0][0]).toMatchObject({ event: SyncEvent });
        expect(after).toHaveBeenCalledTimes(1);
        const afterPayload = after.mock.calls[0][0] as {
            event: typeof SyncEvent;
        };
        expect(afterPayload.event.name).toBe(SyncEvent.name);
    });

    it('exposes registry utilities', () => {
        const bus = new EventBus();
        bus.registerEvent(SyncEvent);

        expect(bus.hasEvent(SyncEvent.name)).toBe(true);
        expect(bus.getEvent(SyncEvent.name)).toBe(SyncEvent);
        expect(bus.listEvents().some((event) => event.name === SyncEvent.name)).toBe(true);
    });

    it('returns false when unsubscribing from unknown events', () => {
        const bus = new EventBus();
        bus.registerEvent(SyncEvent);

        const handler = () => undefined;
        expect(bus.unsubscribe(SyncEvent, handler)).toBe(false);
    });

    it('returns false when removing unknown events', () => {
        const bus = new EventBus();
        expect(bus.removeEvent('does.not.exist')).toBe(false);
    });

    it('supports async throwOnError semantics', async () => {
        const bus = new EventBus();
        bus.registerEvent(AsyncEvent);

        bus.subscribe(AsyncEvent, async () => {
            throw new Error('async-fail');
        });

        await expect(bus.trigger(AsyncEvent, { value: 3 }, { throwOnError: true })).rejects.toThrow(
            'async-fail'
        );
    });

    it('skips error reporting for internal events', () => {
        const bus = new EventBus();
        const internalEvent = defineEvent<void, void, 'sync'>({
            name: 'tests.internal',
            mode: 'sync',
            internal: true
        });

        bus.registerEvent(internalEvent);

        const subscriberError = jest.fn();
        bus.subscribe(CORE_EVENTS.subscriberError, ({ payload }) => {
            subscriberError(payload);
        });

        bus.subscribe(internalEvent, () => {
            throw new Error('internal-error');
        });

        const context = bus.trigger(internalEvent);

        expect(context.stoppedForError).toBe(true);
        expect(subscriberError).not.toHaveBeenCalled();
    });
});

import type { EventContext, EventDefinition } from './types.js';

export class EventInvocationContext<TPayload, TResult> implements EventContext<TPayload, TResult> {
    private _result: TResult | undefined;
    private _stopped = false;
    private _stoppedReason?: string;
    private _stoppedForError = false;
    private _error: unknown;
    private readonly _hasSubscribers: boolean;

    constructor(
        private readonly definition: EventDefinition<TPayload, TResult>,
        private readonly invocationPayload: TPayload,
        initialResult: TResult | undefined,
        readonly metadata?: Record<string, unknown>,
        hasSubscribers = false
    ) {
        this._result = initialResult;
        this._hasSubscribers = hasSubscribers;
    }

    get event(): EventDefinition<TPayload, TResult> {
        return this.definition;
    }

    get payload(): TPayload {
        return this.invocationPayload;
    }

    get result(): TResult | undefined {
        return this._result;
    }

    set result(value: TResult | undefined) {
        this._result = value;
    }

    get stopped(): boolean {
        return this._stopped;
    }

    get stoppedReason(): string | undefined {
        return this._stoppedReason;
    }

    get stoppedForError(): boolean {
        return this._stoppedForError;
    }

    get error(): unknown {
        return this._error;
    }

    get hasSubscribers(): boolean {
        return this._hasSubscribers;
    }

    setResult(value: TResult | undefined): void {
        this._result = value;
    }

    stop(reason?: string): void {
        this._stopped = true;
        this._stoppedReason = reason;
    }

    stopForError(error: unknown, reason?: string): void {
        this._stoppedForError = true;
        this._error = error;
        this.stop(reason);
    }
}

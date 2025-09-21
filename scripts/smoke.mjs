#!/usr/bin/env node
import { EventBus, defineEvent } from '../dist/index.js';

function fail(message, error) {
  console.error('[cw.api.core.events] Smoke test failed:', message);
  if (error) {
    console.error(error);
  }
  process.exit(1);
}

try {
  const bus = new EventBus({ includeCoreEvents: false });
  const smokeEvent = defineEvent<string, string, 'async'>({
    name: 'smoke.event',
    mode: 'async',
    description: 'Smoke test event'
  });

  let observedPayload = '';
  const subscription = bus.subscribe(smokeEvent, async (ctx) => {
    observedPayload = ctx.payload;
    ctx.setResult((ctx.result ?? '') + ctx.payload.toUpperCase());
  });

  const context = await bus.trigger(smokeEvent, 'ok', { initialResult: '' });
  if (observedPayload !== 'ok' || context.result !== 'OK') {
    fail('subscriber chain produced unexpected result');
  }

  subscription.unsubscribe();
  if (bus.getSubscriberCount(smokeEvent) !== 0) {
    fail('unsubscribe did not remove subscriber');
  }

  if (!bus.hasEvent('smoke.event')) {
    fail('event registration missing after trigger');
  }

  console.log('[cw.api.core.events] OK: smoke test passed');
} catch (error) {
  fail('unexpected error', error);
}

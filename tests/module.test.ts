import { Container, registerModules, resetContainer, getContainer } from 'cw.api.core.di';
import { EventBus } from '../src/eventBus.js';
import { eventsModule, useEvents } from '../src/module.js';

describe('eventsModule', () => {
    afterEach(() => {
        return resetContainer();
    });

    it('registers EventBus as singleton when used directly', () => {
        const container = new Container();
        registerModules(container, eventsModule);

        const first = container.resolve(EventBus);
        const second = container.resolve(EventBus);

        expect(first).toBeInstanceOf(EventBus);
        expect(first).toBe(second);
    });

    it('useEvents registers module on default container and returns the instance', () => {
        const instance = useEvents();
        const container = getContainer();

        expect(instance).toBeInstanceOf(EventBus);
        expect(container.resolve(EventBus)).toBe(instance);
    });
});

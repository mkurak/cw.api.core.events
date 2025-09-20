import {
    Lifecycle,
    createModule,
    getContainer,
    registerModules,
    type Container
} from 'cw.api.core.di';
import { EventBus } from './eventBus.js';

export const eventsModule = createModule({
    name: 'cw.api.core.events',
    providers: [
        {
            useClass: EventBus,
            options: {
                lifecycle: Lifecycle.Singleton
            }
        }
    ],
    exports: [EventBus]
});

export interface UseEventsOptions {
    container?: Container;
}

export function useEvents(options: UseEventsOptions = {}): EventBus {
    const container = options.container ?? getContainer();
    registerModules(container, eventsModule);
    return container.resolve(EventBus);
}

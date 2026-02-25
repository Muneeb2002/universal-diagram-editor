/**
 * @author Abigail Sotomayor <s205720@dtu.dk>
 */
import { Action, IActionHandler } from '@eclipse-glsp/client';
import { injectable } from 'inversify';
import { InstancesOverviewResponse } from '../ecore-client-actions';
import { getGlobalToolbar } from './load-metamodel-response-handler';

@injectable()
export class InstancesOverviewResponseHandler implements IActionHandler {
    handle(action: Action): void {
        if (this.isInstancesOverviewResponse(action)) {
            const toolbar = getGlobalToolbar();
            if (toolbar && typeof toolbar.handleInstancesOverviewResponse === 'function') {
                toolbar.handleInstancesOverviewResponse(action);
            } else {
                console.warn('InstancesOverviewResponse received but toolbar handler is unavailable');
            }
        }
    }

    private isInstancesOverviewResponse(action: Action): action is InstancesOverviewResponse {
        return action.kind === 'instancesOverviewResponse';
    }
}


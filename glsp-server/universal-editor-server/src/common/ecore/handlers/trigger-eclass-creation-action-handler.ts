/**
 * @author Abigail Sotomayor <s205720@dtu.dk>
 */
import { injectable } from 'inversify';
import { Action } from '@eclipse-glsp/protocol';
import { ActionHandler } from '@eclipse-glsp/server';
import { TriggerEClassCreationAction } from '../ecore-actions';

/**
 * Action handler that triggers the EClass creation dialog on the client.
 */
@injectable()
export class TriggerEClassCreationActionHandler implements ActionHandler {
    actionKinds = [TriggerEClassCreationAction.KIND];

    async execute(action: Action): Promise<Action[]> {
        if (TriggerEClassCreationAction.is(action)) {
            return [];
        }
        return [];
    }
}

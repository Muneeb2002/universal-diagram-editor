/**
 * @author Abigail Sotomayor <s205720@dtu.dk>
 */
import { injectable } from 'inversify';
import { Action } from '@eclipse-glsp/protocol';
import { ActionHandler } from '@eclipse-glsp/server';
import { TriggerEEnumCreationAction } from '../ecore-actions';

@injectable()
export class TriggerEEnumCreationActionHandler implements ActionHandler {
    actionKinds = [TriggerEEnumCreationAction.KIND];

    async execute(action: Action): Promise<Action[]> {
        if (TriggerEEnumCreationAction.is(action)) {
            return [];
        }
        return [];
    }
}


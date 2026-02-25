/**
 * @author Abigail Sotomayor <s205720@dtu.dk>
 */
import { injectable } from 'inversify';
import { ActionHandler } from '@eclipse-glsp/server';
import { Action } from '@eclipse-glsp/protocol';
import { LoadMetamodelResponse } from '../ecore-actions';

/**
 * Handler for LoadMetamodelResponse.
 * This is a pass-through handler that allows the response to be sent to the client
 * without server-side processing.
 */
@injectable()
export class LoadMetamodelResponseHandler implements ActionHandler {
    actionKinds = [LoadMetamodelResponse.KIND];

    async execute(action: LoadMetamodelResponse): Promise<Action[]> {
        console.log('LoadMetamodelResponse forwarded to client:', action.success ? 'Success' : 'Failed');
        return [];
    }
}


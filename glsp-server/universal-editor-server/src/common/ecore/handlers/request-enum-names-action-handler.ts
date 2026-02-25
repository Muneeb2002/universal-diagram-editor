/**
 * @author Abigail Sotomayor <s205720@dtu.dk>
 */
import { injectable, inject } from 'inversify';
import { Action, ActionHandler } from '@eclipse-glsp/server';
import { respond } from '@eclipse-glsp/server';
import { MetamodelRegistry } from '../metamodel-registry';
import {
    RequestEnumNamesAction,
    EnumNamesResponse
} from '../ecore-actions';

@injectable()
export class RequestEnumNamesActionHandler implements ActionHandler {
    actionKinds = [RequestEnumNamesAction.KIND];

    @inject(MetamodelRegistry)
    protected readonly metamodelRegistry: MetamodelRegistry;

    async execute(action: Action): Promise<Action[]> {
        if (!RequestEnumNamesAction.is(action)) {
            return [];
        }

        const requestAction = action as RequestEnumNamesAction;

        try {
            // Get all enum names from the active metamodel
            const allEnums = this.metamodelRegistry.getAllEEnums();
            const enumNames = allEnums.map(e => {
                const name = e.get ? e.get('name') : e.name;
                return name;
            }).filter((name): name is string => !!name);

            const response = EnumNamesResponse.create(
                requestAction.requestId,
                true,
                enumNames
            );
            
            return [respond(requestAction, response)];
        } catch (error) {
            console.error(`[RequestEnumNamesActionHandler] Error retrieving enum names:`, error);
            const errorResponse = EnumNamesResponse.create(
                requestAction.requestId,
                false,
                [],
                `Error retrieving enum names: ${error instanceof Error ? error.message : String(error)}`
            );
            return [respond(requestAction, errorResponse)];
        }
    }
}


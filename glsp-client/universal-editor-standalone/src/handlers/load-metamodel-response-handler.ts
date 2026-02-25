/**
 * @author Abigail Sotomayor <s205720@dtu.dk>
 */
import { Action, IActionHandler } from '@eclipse-glsp/client';
import { injectable } from 'inversify';
import { LoadMetamodelResponse } from '../ecore-client-actions';

let globalToolbar: any = null;

export function setGlobalToolbar(toolbar: any): void {
    globalToolbar = toolbar;

}

export function getGlobalToolbar(): any {
    return globalToolbar;
}

/**
 * Updates the toolbar with available class names when a metamodel is loaded.
 */
@injectable()
export class LoadMetamodelResponseHandler implements IActionHandler {
    handle(action: Action): void {
        if (this.isLoadMetamodelResponse(action)) {

            if (globalToolbar) {
                if (action.enumNames !== undefined) {
                    globalToolbar.updateEnumNames(action.enumNames);
                }

                if (action.success && action.classNames && action.classNames.length > 0) {

                    if (action.classInfo && action.classInfo.length > 0) {

                        globalToolbar.updateClassInfo(action.classInfo);
                    } else {
                        globalToolbar.updateAvailableClasses(action.classNames);
                    }
                }
            } else {
                console.warn('Global toolbar not set in handler');
            }
        }
    }

    private isLoadMetamodelResponse(action: Action): action is LoadMetamodelResponse {
        return action.kind === 'loadMetamodelResponse';
    }
}


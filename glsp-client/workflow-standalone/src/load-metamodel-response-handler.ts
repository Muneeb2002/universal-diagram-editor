/********************************************************************************
 * Copyright (c) 2024 Eclipse GLSP and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * SPDX-License-Identifier: EPL-2.0
 ********************************************************************************/

import { Action, IActionHandler } from '@eclipse-glsp/client';
import { injectable } from 'inversify';
import { LoadMetamodelResponse } from './ecore-client-actions';

// Global toolbar reference
let globalToolbar: any = null;

export function setGlobalToolbar(toolbar: any): void {
    globalToolbar = toolbar;
    console.log('Global toolbar reference set for LoadMetamodelResponseHandler');
}

/**
 * Client-side handler for LoadMetamodelResponse actions.
 * Updates the toolbar with available class names when a metamodel is loaded.
 */
@injectable()
export class LoadMetamodelResponseHandler implements IActionHandler {
    handle(action: Action): void {
        if (this.isLoadMetamodelResponse(action)) {
            console.log('LoadMetamodelResponseHandler received action:', action);
            
            if (action.success && action.classNames && action.classNames.length > 0) {
                console.log(`Updating toolbar with ${action.classNames.length} classes:`, action.classNames);
                if (globalToolbar) {
                    globalToolbar.updateAvailableClasses(action.classNames);
                    console.log('Toolbar updated successfully');
                } else {
                    console.warn('Global toolbar not set in handler');
                }
            } else {
                console.warn('LoadMetamodelResponse received but no classes found:', action);
            }
        }
    }

    private isLoadMetamodelResponse(action: Action): action is LoadMetamodelResponse {
        return action.kind === 'loadMetamodelResponse';
    }
}


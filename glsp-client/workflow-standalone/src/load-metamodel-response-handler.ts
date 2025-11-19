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
    
}

export function getGlobalToolbar(): any {
    return globalToolbar;
}

/**
 * Client-side handler for LoadMetamodelResponse actions.
 * Updates the toolbar with available class names when a metamodel is loaded.
 */
@injectable()
export class LoadMetamodelResponseHandler implements IActionHandler {
    handle(action: Action): void {
        if (this.isLoadMetamodelResponse(action)) {
            
            if (globalToolbar) {
                // Always update enum names if provided (even if empty array)
                if (action.enumNames !== undefined) {
                    globalToolbar.updateEnumNames(action.enumNames);
                }
                
                if (action.success && action.classNames && action.classNames.length > 0) {
                    // If we have full class info, use that (it has containment and abstract info)
                    if (action.classInfo && action.classInfo.length > 0) {
                        
                        globalToolbar.updateClassInfo(action.classInfo);
                    } else {
                        // Fallback to class names only (less filtering, but better than nothing)
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


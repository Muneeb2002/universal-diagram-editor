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
import { VisualConfigurationResponse } from './ecore-client-actions';
import { VisualConfigurationDialog } from './visual-configuration-dialog';

// Global dialog reference
let globalVisualConfigDialog: VisualConfigurationDialog | null = null;

export function setGlobalVisualConfigDialog(dialog: VisualConfigurationDialog): void {
    globalVisualConfigDialog = dialog;
    
}

/**
 * Client-side handler for VisualConfigurationResponse actions.
 * Shows the visual configuration dialog when the server responds with configuration data.
 */
@injectable()
export class VisualConfigurationResponseHandler implements IActionHandler {
    handle(action: Action): void {
        if (this.isVisualConfigurationResponse(action)) {
            
            
            if (action.success && action.configurations && action.configurations.length > 0) {
                
                
                if (globalVisualConfigDialog) {
                    globalVisualConfigDialog.show(
                        action.configurations,
                        action.availableShapes,
                        action.availableColors
                    );
                    
                } else {
                    console.warn('Global visual configuration dialog not set');
                    alert('Visual configuration dialog not available. Please try again.');
                }
            } else {
                console.warn('VisualConfigurationResponse received but no configurations found:', action);
                alert('No visual configurations available. Please load a metamodel first.');
            }
        }
    }

    private isVisualConfigurationResponse(action: Action): action is VisualConfigurationResponse {
        return action.kind === 'visualConfigurationResponse';
    }
}

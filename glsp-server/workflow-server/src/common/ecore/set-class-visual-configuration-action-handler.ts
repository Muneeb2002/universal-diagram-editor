/********************************************************************************
 * Copyright (c) 2024 Eclipse GLSP and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * SPDX-License-Identifier: EPL-2.0
 ********************************************************************************/

import { injectable, inject } from 'inversify';
import { ActionHandler, ModelState, GModelFactory, GModelRoot } from '@eclipse-glsp/server';
import { Action, MessageAction, SetModelAction } from '@eclipse-glsp/protocol';
import { SetClassVisualConfigurationAction } from './ecore-actions';
import { VisualConfigurationStorage } from './visual-configuration-storage';
import { ClassVisualConfiguration } from './visual-configuration-types';

/**
 * Server-side handler for setting class visual configuration.
 * This handler processes requests to update how a class should be visually represented.
 */
@injectable()
export class SetClassVisualConfigurationActionHandler implements ActionHandler {
    actionKinds = [SetClassVisualConfigurationAction.KIND];
    
    @inject(VisualConfigurationStorage)
    protected visualConfigStorage: VisualConfigurationStorage;
    
    @inject(ModelState)
    protected modelState: ModelState;
    
    @inject(GModelFactory)
    protected gmodelFactory: GModelFactory;
    
    async execute(action: SetClassVisualConfigurationAction): Promise<Action[]> {
        console.log('SetClassVisualConfigurationActionHandler.execute()', action);
        
        try {
            // Create the visual configuration object
            const classConfig: ClassVisualConfiguration = {
                className: action.className,
                shape: action.shape as any,
                color: action.color as any,
                border: action.border,
                size: action.size,
                showAttributes: action.showAttributes,
                showReferences: action.showReferences
            };

            // Set the configuration
            this.visualConfigStorage.setClassVisualConfiguration(action.className, classConfig);
            
            // Recreate the model to reflect visual changes
            this.gmodelFactory.createModel();
            const gmodel = this.modelState.get('gmodel') as GModelRoot;
            
            console.log(`Updated visual configuration for class ${action.className}:`, classConfig);
            
            return [
                SetModelAction.create(gmodel),
                MessageAction.create(
                    `Updated visual configuration for class ${action.className}`,
                    { severity: 'INFO' }
                )
            ];
        } catch (error) {
            console.error('Error setting class visual configuration:', error);
            return [
                MessageAction.create(
                    `Error setting visual configuration: ${error instanceof Error ? error.message : String(error)}`,
                    { severity: 'ERROR' }
                )
            ];
        }
    }
}

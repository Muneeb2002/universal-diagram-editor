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
import { ActionHandler } from '@eclipse-glsp/server';
import { Action, MessageAction } from '@eclipse-glsp/protocol';
import { OpenVisualConfigurationAction, VisualConfigurationResponse } from './ecore-actions';
import { VisualConfigurationStorage } from './visual-configuration-storage';
import { MetamodelRegistry } from './metamodel-registry';

/**
 * Server-side handler for opening visual configuration.
 * This handler responds to requests to open the visual configuration dialog.
 */
@injectable()
export class OpenVisualConfigurationActionHandler implements ActionHandler {
    actionKinds = [OpenVisualConfigurationAction.KIND];
    
    @inject(VisualConfigurationStorage)
    protected visualConfigStorage: VisualConfigurationStorage;
    
    @inject(MetamodelRegistry)
    protected metamodelRegistry: MetamodelRegistry;
    
    async execute(action: OpenVisualConfigurationAction): Promise<Action[]> {
        console.log('OpenVisualConfigurationActionHandler.execute()', action);
        
        try {
            // Check if there's an active metamodel
            const activeMetamodel = this.metamodelRegistry.getActiveMetamodel();
            if (!activeMetamodel) {
                return [
                    MessageAction.create(
                        'No active metamodel found. Please load a metamodel first.',
                        { severity: 'WARNING' }
                    )
                ];
            }

            // Get or create visual configuration for the active metamodel
            this.visualConfigStorage.getOrCreateActiveVisualConfiguration();
            
            // Get all class names from the active metamodel
            const classes = this.metamodelRegistry.getAllEClasses();
            const classNames = classes
                .filter(c => {
                    const isAbstract = c.get ? c.get('abstract') : c.abstract;
                    return !isAbstract;
                })
                .map(c => c.get ? c.get('name') : c.name);

            // Build configurations array
            const configurations = classNames.map(className => {
                const classConfig = this.visualConfigStorage.getClassVisualConfiguration(className);
                return {
                    className,
                    shape: classConfig.shape,
                    color: classConfig.color,
                    filled: classConfig.filled,
                    border: classConfig.border,
                    showAttributes: classConfig.showAttributes,
                    showReferences: classConfig.showReferences
                };
            });

            // Get available options
            const availableShapes = this.visualConfigStorage.getAvailableShapes();
            const availableColors = this.visualConfigStorage.getAvailableColors();

            console.log(`Opening visual configuration for ${classNames.length} classes`);
            
            return [
                VisualConfigurationResponse.create(
                    true,
                    configurations,
                    availableShapes,
                    availableColors
                ),
                MessageAction.create(
                    `Visual configuration opened for ${classNames.length} classes`,
                    { severity: 'INFO' }
                )
            ];
        } catch (error) {
            console.error('Error opening visual configuration:', error);
            return [
                MessageAction.create(
                    `Error opening visual configuration: ${error instanceof Error ? error.message : String(error)}`,
                    { severity: 'ERROR' }
                )
            ];
        }
    }
}

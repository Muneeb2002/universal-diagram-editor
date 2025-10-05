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
import { ActionHandler, ModelState, GModelFactory, GModelSerializer, GModelRoot } from '@eclipse-glsp/server';
import { Action, SetModelAction } from '@eclipse-glsp/protocol';
import { LoadMetamodelAction, LoadMetamodelResponse } from './ecore-actions';
import { EcoreParser } from './ecore-parser';
import { MetamodelRegistry } from './metamodel-registry';

@injectable()
export class LoadMetamodelActionHandler implements ActionHandler {
    actionKinds = [LoadMetamodelAction.KIND];

    @inject(EcoreParser)
    protected ecoreParser: EcoreParser;

    @inject(MetamodelRegistry)
    protected metamodelRegistry: MetamodelRegistry;

    @inject(ModelState)
    protected modelState: ModelState;

    @inject(GModelFactory)
    protected gmodelFactory: GModelFactory;

    @inject(GModelSerializer)
    protected gmodelSerializer: GModelSerializer;

    async execute(action: LoadMetamodelAction): Promise<Action[]> {
        console.log('LoadMetamodelActionHandler.execute()', action);

        try {
            // Parse as JSON metamodel (since we removed TypeScript support)
            const ecoreModel = JSON.parse(action.content);

            console.log('Parsed Ecore model:', ecoreModel);

            // Generate a key for the metamodel (use filename or nsURI)
            let metamodelKey = action.filename.replace(/\.json$/, ''); // Remove extension
            if (ecoreModel.ePackages.length > 0 && ecoreModel.ePackages[0].nsURI) {
                metamodelKey = ecoreModel.ePackages[0].nsURI;
            }

            // Register the metamodel
            this.metamodelRegistry.registerMetamodel(metamodelKey, ecoreModel);
            console.log(`Registered JSON metamodel with key: ${metamodelKey}`);

            // Set as active if requested
            if (action.setAsActive !== false) {
                this.metamodelRegistry.setActiveMetamodel(metamodelKey);

                // Update model state to trigger visualization
                this.modelState.set('ecoreModel', ecoreModel);
                this.modelState.set('sourceContent', action.content); // Store for future reloads
                this.modelState.set('sourceUri', action.filename);
                this.modelState.set('modelType', 'ecore');
                this.modelState.set('viewMode', 'metamodel');

                console.log('Set modelType to ecore, viewMode to metamodel');
            }

            // Get all class names
            const classNames = this.metamodelRegistry.getAllEClasses().map(c => c.name);

            // Create the GModel
            this.gmodelFactory.createModel();

            // Get the created model
            const gmodel = this.modelState.get('gmodel') as GModelRoot;
            if (gmodel) {
                // Return SetModelAction to update the client and LoadMetamodelResponse for feedback
                return [
                    SetModelAction.create(gmodel),
                    LoadMetamodelResponse.create(
                        true,
                        metamodelKey,
                        `Successfully loaded JSON metamodel '${metamodelKey}' with ${classNames.length} classes`,
                        classNames
                    )
                ];
            } else {
                throw new Error('Failed to create GModel');
            }
        } catch (error) {
            console.error('Error loading metamodel:', error);
            return [
                LoadMetamodelResponse.create(
                    false,
                    '',
                    `Error loading metamodel: ${error instanceof Error ? error.message : String(error)}`
                )
            ];
        }
    }
}

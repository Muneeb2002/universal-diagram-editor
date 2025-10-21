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
import { Action, SetModelAction } from '@eclipse-glsp/protocol';
import { ActionHandler, ModelState, GModelFactory, GModelRoot } from '@eclipse-glsp/server';
import { MetamodelRegistry } from './metamodel-registry';
import { DeleteAttributeAction } from './ecore-actions';

/**
 * Action handler for deleting attributes from existing EClasses.
 */
@injectable()
export class DeleteAttributeActionHandler implements ActionHandler {
    actionKinds = [DeleteAttributeAction.KIND];

    @inject(MetamodelRegistry)
    protected metamodelRegistry: MetamodelRegistry;

    @inject(ModelState)
    protected modelState: ModelState;

    @inject(GModelFactory)
    protected gmodelFactory: GModelFactory;

    async execute(action: Action): Promise<Action[]> {
        if (!DeleteAttributeAction.is(action)) {
            return [];
        }

        try {
            // Delete the attribute from the metamodel
            const result = this.metamodelRegistry.deleteAttribute(
                action.className,
                action.attributeName
            );

            if (result.success) {
                console.log(`Successfully deleted attribute: ${action.attributeName} from ${action.className}`);
                
                // Regenerate the model to reflect the changes
                this.gmodelFactory.createModel();
                const gmodel = this.modelState.get('gmodel') as GModelRoot;
                
                if (gmodel && gmodel.type && gmodel.id) {
                    return [SetModelAction.create(gmodel)];
                }
            } else {
                console.error(`Failed to delete attribute: ${result.message}`);
            }

            return [];
        } catch (error) {
            console.error('Error in DeleteAttributeActionHandler:', error);
            return [];
        }
    }
}


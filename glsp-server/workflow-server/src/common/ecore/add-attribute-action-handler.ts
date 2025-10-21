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
import { AddAttributeAction } from './ecore-actions';

/**
 * Action handler for adding attributes to existing EClasses.
 */
@injectable()
export class AddAttributeActionHandler implements ActionHandler {
    actionKinds = [AddAttributeAction.KIND];

    @inject(MetamodelRegistry)
    protected metamodelRegistry: MetamodelRegistry;

    @inject(ModelState)
    protected modelState: ModelState;

    @inject(GModelFactory)
    protected gmodelFactory: GModelFactory;

    async execute(action: Action): Promise<Action[]> {
        if (!AddAttributeAction.is(action)) {
            return [];
        }

        try {
            // Add the attribute to the metamodel
            const result = this.metamodelRegistry.addAttribute(
                action.className,
                action.attributeName,
                action.attributeType,
                action.lowerBound,
                action.upperBound
            );

            if (result.success) {
                console.log(`Successfully added attribute: ${action.attributeName} to ${action.className}`);
                
                // Regenerate the model to reflect the changes
                this.gmodelFactory.createModel();
                const gmodel = this.modelState.get('gmodel') as GModelRoot;
                
                if (gmodel && gmodel.type && gmodel.id) {
                    return [SetModelAction.create(gmodel)];
                }
            } else {
                console.error(`Failed to add attribute: ${result.message}`);
            }

            return [];
        } catch (error) {
            console.error('Error in AddAttributeActionHandler:', error);
            return [];
        }
    }
}


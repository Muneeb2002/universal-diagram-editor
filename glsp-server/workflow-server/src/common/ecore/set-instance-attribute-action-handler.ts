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
import { Action, MessageAction, SetModelAction } from '@eclipse-glsp/protocol';
import { SetInstanceAttributeAction } from './ecore-actions';
import { InstanceModelStorage } from './instance-model-storage';

@injectable()
export class SetInstanceAttributeActionHandler implements ActionHandler {
    actionKinds = [SetInstanceAttributeAction.KIND];

    @inject(InstanceModelStorage)
    protected instanceStorage: InstanceModelStorage;

    @inject(ModelState)
    protected modelState: ModelState;

    @inject(GModelFactory)
    protected gmodelFactory: GModelFactory;

    @inject(GModelSerializer)
    protected gmodelSerializer: GModelSerializer;

    async execute(action: SetInstanceAttributeAction): Promise<Action[]> {
        try {
            // Set the attribute value
            this.instanceStorage.setAttributeValue(
                action.instanceId,
                action.attributeName,
                action.value
            );

            // Ensure we're in instance mode
            const currentMode = this.modelState.get('viewMode') as string;
            if (currentMode !== 'instance') {
                this.modelState.set('viewMode', 'instance');
            }

            // Recreate the GModel to reflect changes
            this.gmodelFactory.createModel();

            // Get the created model
            const gmodel = this.modelState.get('gmodel') as GModelRoot;
            if (gmodel) {
                return [
                    SetModelAction.create(gmodel),
                    MessageAction.create(
                        `Set ${action.attributeName} = ${action.value}`,
                        { severity: 'INFO' }
                    )
                ];
            } else {
                return [
                    MessageAction.create('Failed to update instance visualization', { severity: 'ERROR' })
                ];
            }
        } catch (error) {
            console.error('Error setting instance attribute:', error);
            return [
                MessageAction.create(
                    `Error setting attribute: ${error instanceof Error ? error.message : String(error)}`,
                    { severity: 'ERROR' }
                )
            ];
        }
    }
    
}


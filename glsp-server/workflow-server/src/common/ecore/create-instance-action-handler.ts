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
import { CreateInstanceAction } from './ecore-actions';
import { InstanceModelStorage } from './instance-model-storage';

@injectable()
export class CreateInstanceActionHandler implements ActionHandler {
    actionKinds = [CreateInstanceAction.KIND];

    @inject(InstanceModelStorage)
    protected instanceStorage: InstanceModelStorage;

    @inject(ModelState)
    protected modelState: ModelState;

    @inject(GModelFactory)
    protected gmodelFactory: GModelFactory;

    @inject(GModelSerializer)
    protected gmodelSerializer: GModelSerializer;

    async execute(action: CreateInstanceAction): Promise<Action[]> {
        console.log('CreateInstanceActionHandler.execute()', action);

        try {
            // Create the instance
            const instance = this.instanceStorage.createInstance(action.eClassName, action.position);
            console.log(`Created instance: ${instance.id}`);

            // Ensure we're in instance mode
            const currentMode = this.modelState.get('viewMode') as string;
            if (currentMode !== 'instance') {
                this.modelState.set('viewMode', 'instance');
            }

            // Create the GModel with the new instance
            this.gmodelFactory.createModel();

            // Get the created model
            const gmodel = this.modelState.get('gmodel') as GModelRoot;
            if (gmodel) {
                return [
                    SetModelAction.create(gmodel),
                    MessageAction.create(`Created instance of ${action.eClassName}`, { severity: 'INFO' })
                ];
            } else {
                return [
                    MessageAction.create('Failed to create instance visualization', { severity: 'ERROR' })
                ];
            }
        } catch (error) {
            console.error('Error creating instance:', error);
            return [
                MessageAction.create(
                    `Error creating instance: ${error instanceof Error ? error.message : String(error)}`,
                    { severity: 'ERROR' }
                )
            ];
        }
    }
}

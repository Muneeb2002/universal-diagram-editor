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
import { SwitchModeAction } from './ecore-actions';
import { InstanceModelStorage } from './instance-model-storage';

@injectable()
export class SwitchModeActionHandler implements ActionHandler {
    actionKinds = [SwitchModeAction.KIND];

    @inject(ModelState)
    protected modelState: ModelState;

    @inject(GModelFactory)
    protected gmodelFactory: GModelFactory;

    @inject(GModelSerializer)
    protected gmodelSerializer: GModelSerializer;

    @inject(InstanceModelStorage)
    protected instanceStorage: InstanceModelStorage;

    async execute(action: SwitchModeAction): Promise<Action[]> {
        console.log('SwitchModeActionHandler.execute()', action);

        const currentMode = this.modelState.get('viewMode') as string;

        if (currentMode === action.mode) {
            console.log(`Already in ${action.mode} mode`);
            return [];
        }

        // Update the view mode
        this.modelState.set('viewMode', action.mode);
        console.log(`Switched to ${action.mode} mode`);

        if (action.mode === 'instance') {
            this.instanceStorage.ensureRootContainers();
        }

        // Create the GModel with the new mode
        this.gmodelFactory.createModel();

        // Get the created model
        const gmodel = this.modelState.get('gmodel') as GModelRoot;
        if (gmodel) {
            return [
                SetModelAction.create(gmodel),
                MessageAction.create(`Switched to ${action.mode} view mode`, { severity: 'INFO' })
            ];
        } else {
            return [
                MessageAction.create('Failed to switch mode', { severity: 'ERROR' })
            ];
        }
    }
}

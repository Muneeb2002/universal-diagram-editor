/********************************************************************************
 * Copyright (c) 2022-2024 STMicroelectronics and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/
import { injectable, inject } from 'inversify';
import { RequestModelAction, SaveModelAction } from '@eclipse-glsp/protocol';
import { ModelState, SOURCE_URI_ARG, SourceModelStorage } from '@eclipse-glsp/server';
import { GModelStorage } from '@eclipse-glsp/server/node';
import { EcoreModelStorage } from './ecore/ecore-model-storage';

/**
 * Unified model storage that delegates to the appropriate storage based on the model type
 */
@injectable()
export class UnifiedModelStorage implements SourceModelStorage {
    @inject(GModelStorage)
    protected workflowStorage: GModelStorage;

    @inject(EcoreModelStorage)
    protected ecoreStorage: EcoreModelStorage;

    @inject(ModelState)
    protected modelState: ModelState;

    async loadSourceModel(action: RequestModelAction): Promise<void> {
        const sourceUri = this.getSourceUri(action);

        // Determine which storage to use based on the source URI
        if (sourceUri === 'ecore:inline' || sourceUri.endsWith('.ecore')) {
            // Use Ecore storage for Ecore files
            await this.ecoreStorage.loadSourceModel(action);
        } else {
            // Use workflow storage for other files
            await this.workflowStorage.loadSourceModel(action);
        }
    }

    async saveSourceModel(action: SaveModelAction): Promise<void> {
        const modelType = this.modelState.get('modelType') as string;

        if (modelType === 'ecore') {
            // Use Ecore storage for saving Ecore models
            await this.ecoreStorage.saveSourceModel(action);
        } else {
            // Use workflow storage for saving workflow models
            await this.workflowStorage.saveSourceModel(action);
        }
    }

    private getSourceUri(action: RequestModelAction): string {
        const sourceUri = action.options?.[SOURCE_URI_ARG];
        if (typeof sourceUri !== 'string') {
            throw new Error(`Invalid RequestModelAction! Missing argument with key '${SOURCE_URI_ARG}'`);
        }
        return sourceUri;
    }
}

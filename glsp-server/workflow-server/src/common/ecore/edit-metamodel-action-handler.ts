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
import { Action } from '@eclipse-glsp/protocol';
import { ModelState, ActionHandler, GModelFactory, GModelSerializer, GModelRoot } from '@eclipse-glsp/server';
import { SetModelAction } from '@eclipse-glsp/protocol';
import { MetamodelRegistry } from './metamodel-registry';
import { 
    RenameClassAction,
    SaveMetamodelAction,
    ChangeClassTypeAction,
    DeleteClassAction,
    UpdateMetamodelPropertiesAction
} from './ecore-actions';

/**
 * Action handler for editing metamodel attributes and references.
 */
@injectable()
export class EditMetamodelActionHandler implements ActionHandler {
    actionKinds = [
        RenameClassAction.KIND,
        SaveMetamodelAction.KIND,
        ChangeClassTypeAction.KIND,
        DeleteClassAction.KIND,
        UpdateMetamodelPropertiesAction.KIND
    ];

    constructor() {
    }


    @inject(MetamodelRegistry)
    protected metamodelRegistry: MetamodelRegistry;

    @inject(ModelState)
    protected modelState: ModelState;

    @inject(GModelFactory)
    protected gmodelFactory: GModelFactory;

    @inject(GModelSerializer)
    protected gmodelSerializer: GModelSerializer;

    async execute(action: Action): Promise<Action[]> {
        try {
            let success = false;

            if (RenameClassAction.is(action)) {
                const result = await this.handleRenameClass(action);
                success = result.success;
            } else if (SaveMetamodelAction.is(action)) {
                const result = await this.handleSaveMetamodel(action);
                success = result.success;
                // For save actions, log the content to console
                if (success && result.content) {
                    console.log('=== SAVED METAMODEL CONTENT ===');
                    console.log(result.content);
                    console.log('=== END SAVED METAMODEL CONTENT ===');
                }
            } else if (ChangeClassTypeAction.is(action)) {
                const result = await this.handleChangeClassType(action);
                success = result.success;
            } else if (DeleteClassAction.is(action)) {
                const result = await this.handleDeleteClass(action);
                success = result.success;
            } else if (UpdateMetamodelPropertiesAction.is(action)) {
                const result = await this.handleUpdateMetamodelProperties(action);
                success = result.success;
            }

            // If successful, regenerate the model (except for save actions)
            if (success && !SaveMetamodelAction.is(action)) {
                this.gmodelFactory.createModel();
                const gmodel = this.modelState.get('gmodel') as GModelRoot;
                if (gmodel && gmodel.type && gmodel.id) {
                    return [SetModelAction.create(gmodel)];
                }
            }

            return [];

        } catch (error) {
            // Error in EditMetamodelActionHandler
            return [];
        }
    }



    private async handleRenameClass(action: RenameClassAction): Promise<{ success: boolean; message: string }> {
        try {
            this.metamodelRegistry.renameClass(action.oldClassName, action.newClassName);
            return {
                success: true,
                message: `Successfully renamed class from '${action.oldClassName}' to '${action.newClassName}' and updated all references`
            };
        } catch (error) {
            return {
                success: false,
                message: `Failed to rename class: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async handleSaveMetamodel(action: SaveMetamodelAction): Promise<{ success: boolean; message: string; content?: string }> {
        
        try {
            const result = this.metamodelRegistry.saveMetamodel(action.filename, action.format);
            if (result.success) {
                console.log(`Metamodel saved to ${result.filePath}`);
            }
            return result;
        } catch (error) {
            // Error in handleSaveMetamodel
            return {
                success: false,
                message: `Failed to save metamodel: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async handleChangeClassType(action: ChangeClassTypeAction): Promise<{ success: boolean; message: string }> {
        try {
            this.metamodelRegistry.changeClassType(action.className, action.classType);
            return {
                success: true,
                message: `Successfully changed class '${action.className}' to type '${action.classType}'`
            };
        } catch (error) {
            return {
                success: false,
                message: `Failed to change class type: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async handleDeleteClass(action: DeleteClassAction): Promise<{ success: boolean; message: string }> {
        try {
            this.metamodelRegistry.deleteClass(action.className, action.force);
            return {
                success: true,
                message: `Successfully deleted class '${action.className}'${action.force ? ' and all its references' : ''}`
            };
        } catch (error) {
            return {
                success: false,
                message: `Failed to delete class: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async handleUpdateMetamodelProperties(action: UpdateMetamodelPropertiesAction): Promise<{ success: boolean; message: string }> {
        try {
            this.metamodelRegistry.updateMetamodelProperties(action.name, action.nsURI, action.nsPrefix);
            return {
                success: true,
                message: 'Successfully updated metamodel properties'
            };
        } catch (error) {
            return {
                success: false,
                message: `Failed to update metamodel properties: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }
}

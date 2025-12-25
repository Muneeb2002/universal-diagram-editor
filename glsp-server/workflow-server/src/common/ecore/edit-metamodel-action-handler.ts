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
import { DiagramPositionStorage } from './diagram-position-storage';
import { 
    RenameClassAction,
    RenameEnumAction,
    AddEnumLiteralAction,
    UpdateEnumLiteralAction,
    DeleteEnumLiteralAction,
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
        RenameEnumAction.KIND,
        AddEnumLiteralAction.KIND,
        UpdateEnumLiteralAction.KIND,
        DeleteEnumLiteralAction.KIND,
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

    @inject(DiagramPositionStorage)
    protected diagramPositionStorage: DiagramPositionStorage;

    async execute(action: Action): Promise<Action[]> {
        try {
            let success = false;

            if (RenameClassAction.is(action)) {
                const result = await this.handleRenameClass(action);
                success = result.success;
            } else if (RenameEnumAction.is(action)) {
                const result = await this.handleRenameEnum(action);
                success = result.success;
            } else if (AddEnumLiteralAction.is(action)) {
                const result = await this.handleAddEnumLiteral(action);
                success = result.success;
            } else if (UpdateEnumLiteralAction.is(action)) {
                const result = await this.handleUpdateEnumLiteral(action);
                success = result.success;
            } else if (DeleteEnumLiteralAction.is(action)) {
                const result = await this.handleDeleteEnumLiteral(action);
                success = result.success;
            } else if (SaveMetamodelAction.is(action)) {
                const result = await this.handleSaveMetamodel(action);
                success = result.success;
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

    private async handleRenameEnum(action: RenameEnumAction): Promise<{ success: boolean; message: string }> {
        try {
            this.metamodelRegistry.renameEnum(action.oldEnumName, action.newEnumName);
            return {
                success: true,
                message: `Successfully renamed enum from '${action.oldEnumName}' to '${action.newEnumName}' and updated all references`
            };
        } catch (error) {
            return {
                success: false,
                message: `Failed to rename enum: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async handleAddEnumLiteral(action: AddEnumLiteralAction): Promise<{ success: boolean; message: string }> {
        try {
            this.metamodelRegistry.addEnumLiteral(action.enumName, action.literalName, action.literalValue);
            return {
                success: true,
                message: `Successfully added enum literal '${action.literalName}' to enum '${action.enumName}'`
            };
        } catch (error) {
            return {
                success: false,
                message: `Failed to add enum literal: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async handleUpdateEnumLiteral(action: UpdateEnumLiteralAction): Promise<{ success: boolean; message: string }> {
        try {
            this.metamodelRegistry.updateEnumLiteral(action.enumName, action.oldLiteralName, action.newLiteralName, action.newLiteralValue);
            return {
                success: true,
                message: `Successfully updated enum literal from '${action.oldLiteralName}' to '${action.newLiteralName}' in enum '${action.enumName}'`
            };
        } catch (error) {
            return {
                success: false,
                message: `Failed to update enum literal: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async handleDeleteEnumLiteral(action: DeleteEnumLiteralAction): Promise<{ success: boolean; message: string }> {
        try {
            this.metamodelRegistry.deleteEnumLiteral(action.enumName, action.literalName);
            return {
                success: true,
                message: `Successfully deleted enum literal '${action.literalName}' from enum '${action.enumName}'`
            };
        } catch (error) {
            return {
                success: false,
                message: `Failed to delete enum literal: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async handleSaveMetamodel(action: SaveMetamodelAction): Promise<{ success: boolean; message: string; content?: string }> {
        
        try {
            const result = this.metamodelRegistry.saveMetamodel(action.filename, action.format);
            if (result.success && result.filePath) {
                // Add diagram positions to the saved file
                const fs = require('fs');
                
                try {
                    const fileContent = fs.readFileSync(result.filePath, { encoding: 'utf8' });
                    const jsonObject = JSON.parse(fileContent);
                    
                    const diagramPositions = this.diagramPositionStorage.getAllPositions();
                    if (diagramPositions.size > 0) {
                        const positionsObj: any = {};
                        diagramPositions.forEach((value, key) => {
                            positionsObj[key] = value;
                        });
                        jsonObject.diagramPositions = positionsObj;
                        
                        const updatedContent = JSON.stringify(jsonObject, undefined, 2);
                        fs.writeFileSync(result.filePath, updatedContent, { encoding: 'utf8' });
                    }
                } catch (posError) {
                    // Don't fail the save operation if positions can't be added
                }
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
            const deleted = this.metamodelRegistry.deleteClass(action.className, action.force);
            if (deleted) {
                return {
                    success: true,
                    message: `Successfully deleted class '${action.className}'${action.force ? ' and all its references' : ''}`
                };
            } else {
                return {
                    success: false,
                    message: `Failed to delete class '${action.className}' - class not found or could not be removed`
                };
            }
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

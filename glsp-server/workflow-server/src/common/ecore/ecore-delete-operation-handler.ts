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
import { ActionDispatcher, ModelState, GModelOperationHandler, Command, MaybePromise, GModelFactory, GModelSerializer } from '@eclipse-glsp/server';
import { GModelRoot, GModelElement } from '@eclipse-glsp/server';
import { DeleteElementOperation, Operation, GModelRootSchema, SetModelAction } from '@eclipse-glsp/protocol';
import { DeleteEdgeAction } from './ecore-actions';
import { InstanceModelStorage } from './instance-model-storage';
import { AbstractRecordingCommand } from '@eclipse-glsp/server';

/**
 * Custom delete operation handler that intercepts edge deletions in metamodel context
 * and dispatches DeleteEdgeAction to properly update the underlying metamodel.
 * Also handles instance deletions in instance mode.
 */
@injectable()
export class EcoreDeleteOperationHandler extends GModelOperationHandler {
    readonly operationType = DeleteElementOperation.KIND;

    @inject(ActionDispatcher)
    protected actionDispatcher: ActionDispatcher;

    @inject(ModelState)
    protected override modelState: ModelState;

    @inject(InstanceModelStorage)
    protected instanceStorage: InstanceModelStorage;

    @inject(GModelFactory)
    protected gmodelFactory: GModelFactory;

    createCommand(operation: DeleteElementOperation): MaybePromise<Command | undefined> {
        const elementIds = operation.elementIds;
        
        if (!elementIds || elementIds.length === 0) {
            return undefined;
        }

        // Check if we're in metamodel mode and if any of the elements being deleted are edges
        const currentModel = this.modelState.get('gmodel') as GModelRoot;
        if (!currentModel) {
            return undefined;
        }

        const viewMode = this.modelState.get('viewMode') as string;
        const isInstanceMode = viewMode === 'instance';

        const edgeIds: string[] = [];
        const instanceIds: string[] = [];
        const otherElementIds: string[] = [];

        // Separate element IDs by type
        elementIds.forEach(elementId => {
            const element = this.findElementById(currentModel, elementId);
            if (!element) {
                // In instance mode, if element is not found, it might be an instance ID
                // First check if it's a valid instance ID in storage
                if (isInstanceMode) {
                    const allInstances = this.instanceStorage.getAllInstances();
                    const instance = allInstances.find(inst => inst.id === elementId);
                    if (instance) {
                        // This is a valid instance ID, check if it's an arc (edge) instance
                        // For arc instances, we need to find the edge element
                        if (instance.eClassName.toLowerCase().includes('arc') || 
                            instance.eClassName.toLowerCase().includes('edge')) {
                            // Try to find the edge element for this arc instance
                            const foundEdgeId = this.findEdgeIdForInstance(instance.id, currentModel);
                            if (foundEdgeId) {
                                // Recursively process the found edge ID
                                const edgeElement = this.findElementById(currentModel, foundEdgeId);
                                if (edgeElement && edgeElement.type === 'edge:instance') {
                                    const cleanElementId = foundEdgeId.startsWith('sprotty_') ? foundEdgeId.substring(8) : foundEdgeId;
                                    const foundInstanceId = this.findInstanceIdFromEdgeId(cleanElementId);
                                    if (foundInstanceId) {
                                        instanceIds.push(foundInstanceId);
                                        return;
                                    }
                                }
                            } else {
                                // If we can't find the edge, but it's a valid instance, delete it directly
                                instanceIds.push(instance.id);
                                return;
                            }
                        } else {
                            // Regular node instance, delete directly
                            instanceIds.push(instance.id);
                            return;
                        }
                    }
                    
                    // Try to find by class name (old behavior for backward compatibility)
                    const foundInstanceId = this.findInstanceIdByName(elementId, currentModel);
                    if (foundInstanceId) {
                        instanceIds.push(foundInstanceId);
                        return;
                    }
                }
                otherElementIds.push(elementId);
                return;
            }
            
            // In instance mode, arc instances are edges with type 'edge:instance'
            // They need to be deleted from instance storage, not as regular edges
            if (isInstanceMode && element.type === 'edge:instance') {
                // Extract instance ID from edge ID using the same logic as findInstanceIdByName
                // Edge ID format: `${instance.id}_${sourceId}_to_${targetId}`
                const cleanElementId = elementId.startsWith('sprotty_') ? elementId.substring(8) : elementId;
                const foundInstanceId = this.findInstanceIdFromEdgeId(cleanElementId);
                if (foundInstanceId) {
                    instanceIds.push(foundInstanceId);
                } else {
                    otherElementIds.push(elementId);
                }
            } else if (element.type?.startsWith('edge:')) {
                edgeIds.push(elementId);
            } else if (isInstanceMode && (element.type === 'ecore:instance' || element.type?.startsWith('inst:'))) {
                instanceIds.push(elementId);
            } else {
                otherElementIds.push(elementId);
            }
        });

        // If we have other elements, use the standard delete operation
        // BUT: In instance mode, we need to use our safe command to avoid root issues
        if (otherElementIds.length > 0) {
            if (isInstanceMode) {
            // Use safe command for instance mode to avoid root issues
            const currentGmodel = this.modelState.get('gmodel') as GModelRoot;
            if (!currentGmodel) {
                return undefined;
            }
            if (!currentGmodel.children) {
                currentGmodel.children = [];
            }
            this.modelState.updateRoot(currentGmodel);
            
            return new SafeInstanceDeleteCommand(
                this.modelState,
                this.serializer,
                this.actionDispatcher,
                () => this.deleteNonEdgeElements(otherElementIds)
            );
            } else {
                // For non-edge elements, we need to create a command that deletes them
                // Since we can't call super.createCommand, we'll create a simple command
                return this.commandOf(() => this.deleteNonEdgeElements(otherElementIds));
            }
        }

        // If we have instances to delete in instance mode
        if (instanceIds.length > 0) {
            // Store references for use in the command
            const instancesToDelete = [...instanceIds];
            
            // CRITICAL: Ensure modelState.root is set before creating any command
            // GModelRecordingCommand.getJsonObject() is called BEFORE doExecute(), so root must exist
            const currentGmodel = this.modelState.get('gmodel') as GModelRoot;
            if (!currentGmodel) {
                // If there's no current model, we can't delete
                return undefined;
            }
            
            // Ensure the model has a children array
            if (!currentGmodel.children) {
                currentGmodel.children = [];
            }
            
            // Update modelState.root with currentGmodel before creating command
            this.modelState.updateRoot(currentGmodel);
            
            // Verify root is set
            if (!this.modelState.root) {
                return undefined;
            }
            
            // Use custom command that gets root from gmodel instead of modelState.root
            const command = new SafeInstanceDeleteCommand(
                this.modelState,
                this.serializer,
                this.actionDispatcher,
                () => {
                    // Delete instances from storage synchronously
                    instancesToDelete.forEach(instanceId => {
                        this.instanceStorage.deleteInstance(instanceId);
                    });
                    
                    // Regenerate the model
                    this.gmodelFactory.createModel();
                    
                    // Update modelState.root with the new model
                    const gmodel = this.modelState.get('gmodel') as GModelRoot;
                    if (gmodel) {
                        if (!gmodel.children) {
                            gmodel.children = [];
                        }
                        this.modelState.updateRoot(gmodel);
                    }
                }
            );
            return command;
        }
        
        // If we have edges to delete, dispatch DeleteEdgeAction (for metamodel mode)
        if (edgeIds.length > 0) {
            edgeIds.forEach(edgeId => {
                this.actionDispatcher.dispatch(DeleteEdgeAction.create(edgeId));
            });
            // For edges, DeleteEdgeActionHandler will handle the model update
            return undefined;
        }

        return undefined;
    }

    private findElementById(root: GModelRoot, elementId: string): GModelElement | undefined {
        // Remove sprotty_ prefix if present
        const cleanElementId = elementId.startsWith('sprotty_') ? elementId.substring(8) : elementId;
        
        const findElement = (element: any): GModelElement | undefined => {
            if (element.id === elementId || element.id === cleanElementId) {
                return element as GModelElement;
            }
            if (element.children) {
                for (const child of element.children) {
                    const found = findElement(child);
                    if (found) return found;
                }
            }
            return undefined;
        };
        
        return findElement(root);
    }

    private findInstanceIdFromEdgeId(edgeId: string): string | undefined {
        // Edge ID format: `${instance.id}_${sourceId}_to_${targetId}`
        const toIndex = edgeId.indexOf('_to_');
        if (toIndex <= 0) {
            return undefined;
        }
        
        // The part before "_to_" is `${instance.id}_${sourceId}`
        const beforeTo = edgeId.substring(0, toIndex);
        
        // Get all instances from storage and find which one matches
        const allInstances = this.instanceStorage.getAllInstances();
        for (const instance of allInstances) {
            if (beforeTo.startsWith(instance.id + '_')) {
                return instance.id;
            }
        }
        
        return undefined;
    }

    private findEdgeIdForInstance(instanceId: string, root: GModelRoot): string | undefined {
        // Recursively search for an edge with type 'edge:instance' that starts with instanceId
        const findEdge = (element: any): string | undefined => {
            if (!element) return undefined;
            
            if (element.type === 'edge:instance' && element.id) {
                const cleanId = element.id.startsWith('sprotty_') ? element.id.substring(8) : element.id;
                if (cleanId.startsWith(instanceId + '_')) {
                    return element.id;
                }
            }
            
            if (element.children && Array.isArray(element.children)) {
                for (const child of element.children) {
                    const found = findEdge(child);
                    if (found) return found;
                }
            }
            
            return undefined;
        };
        
        return findEdge(root);
    }

    private findInstanceIdByName(instanceName: string, root: GModelRoot): string | undefined {
        // Get all instances of this class from storage
        const allInstances = this.instanceStorage.getAllInstances();
        const classInstances = allInstances.filter(inst => inst.eClassName === instanceName);
        
        // Find the edge in the model that matches the instance name
        // Edge ID format: `${instance.id}_${sourceId}_to_${targetId}`
        const findInstanceEdge = (element: any): string | undefined => {
            if (element.type === 'edge:instance' && element.id) {
                const cleanId = element.id.startsWith('sprotty_') ? element.id.substring(8) : element.id;
                if (cleanId.startsWith(instanceName + '_')) {
                    const toIndex = cleanId.indexOf('_to_');
                    if (toIndex > 0) {
                        // The part before "_to_" is `${instance.id}_${sourceId}`
                        const beforeTo = cleanId.substring(0, toIndex);
                        
                        // Try each instance ID to see which one matches the edge ID pattern
                        for (const instance of classInstances) {
                            if (beforeTo.startsWith(instance.id + '_')) {
                                return instance.id;
                            }
                        }
                    }
                }
            }
            if (element.children) {
                for (const child of element.children) {
                    const found = findInstanceEdge(child);
                    if (found) return found;
                }
            }
            return undefined;
        };
        
        return findInstanceEdge(root);
    }

    private deleteNonEdgeElements(elementIds: string[]): void {
        // Use the standard GLSP delete operation for non-edge elements
        // We'll delegate to the standard delete operation handler
        const deleteOperation = DeleteElementOperation.create(elementIds);
        // Dispatch the operation to be handled by the standard delete handler
        this.actionDispatcher.dispatch(deleteOperation);
    }

    override handles(operation: Operation): boolean {
        // Check if we can handle this operation type
        const isDeleteOperation = operation.kind === this.operationType;
        // Check if we have a model (either root or gmodel)
        const hasModel = this.modelState.root || this.modelState.get('gmodel');
        return isDeleteOperation && !!hasModel;
    }
}

/**
 * Custom command that safely handles instance deletion by getting the root from gmodel
 * instead of relying on modelState.root which might be undefined
 */
class SafeInstanceDeleteCommand extends AbstractRecordingCommand<GModelRootSchema> {
    constructor(
        protected modelState: ModelState,
        protected serializer: GModelSerializer,
        protected actionDispatcher: ActionDispatcher,
        protected executeFn: () => MaybePromise<void>
    ) {
        super();
    }

    protected override getJsonObject(): MaybePromise<GModelRootSchema> {
        // Get root from gmodel first (most reliable), fallback to modelState.root
        let root = this.modelState.get('gmodel') as GModelRoot | undefined;
        if (!root) {
            root = this.modelState.root;
        }
        
        if (!root) {
            // Last resort: create an empty root
            root = new GModelRoot();
            root.type = 'graph';
            root.id = 'sprotty';
            root.children = [];
        }
        
        // Ensure root has children array
        if (!root.children) {
            root.children = [];
        }
        
        return this.serializer.createSchema(root);
    }

    protected override async doExecute(): Promise<void> {
        await this.executeFn();
    }

    protected override postChange(newModel: GModelRootSchema): MaybePromise<void> {
        const newRoot = this.serializer.createRoot(newModel);
        this.modelState.updateRoot(newRoot);
        
        // Get the fresh model from gmodel (should be updated by doExecute calling createModel())
        const gmodel = this.modelState.get('gmodel') as GModelRoot;
        const modelToSend = gmodel || newRoot;
        
        // Dispatch SetModelAction to update the client
        this.actionDispatcher.dispatch(SetModelAction.create(modelToSend));
    }
}

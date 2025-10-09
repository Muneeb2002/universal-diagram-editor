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
import { ActionDispatcher, ModelState, GModelOperationHandler, Command, MaybePromise } from '@eclipse-glsp/server';
import { GModelRoot, GModelElement } from '@eclipse-glsp/server';
import { DeleteElementOperation } from '@eclipse-glsp/protocol';
import { DeleteEdgeAction } from './ecore-actions';

/**
 * Custom delete operation handler that intercepts edge deletions in metamodel context
 * and dispatches DeleteEdgeAction to properly update the underlying metamodel.
 */
@injectable()
export class EcoreDeleteOperationHandler extends GModelOperationHandler {
    readonly operationType = DeleteElementOperation.KIND;

    @inject(ActionDispatcher)
    protected actionDispatcher: ActionDispatcher;

    @inject(ModelState)
    protected override modelState: ModelState;

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

        const edgeIds: string[] = [];
        const otherElementIds: string[] = [];

        // Separate edge IDs from other element IDs
        elementIds.forEach(elementId => {
            const element = this.findElementById(currentModel, elementId);
            if (element && element.type?.startsWith('edge:')) {
                edgeIds.push(elementId);
            } else {
                otherElementIds.push(elementId);
            }
        });

        // If we have edges to delete, dispatch DeleteEdgeAction for each one
        if (edgeIds.length > 0) {
            edgeIds.forEach(edgeId => {
                this.actionDispatcher.dispatch(DeleteEdgeAction.create(edgeId));
            });
        }

        // If we have other elements, use the standard delete operation
        if (otherElementIds.length > 0) {
            // For non-edge elements, we need to create a command that deletes them
            // Since we can't call super.createCommand, we'll create a simple command
            return this.commandOf(() => this.deleteNonEdgeElements(otherElementIds));
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

    private deleteNonEdgeElements(elementIds: string[]): void {
        // Use the standard GLSP delete operation for non-edge elements
        // We'll delegate to the standard delete operation handler
        const deleteOperation = DeleteElementOperation.create(elementIds);
        // Dispatch the operation to be handled by the standard delete handler
        this.actionDispatcher.dispatch(deleteOperation);
    }
}

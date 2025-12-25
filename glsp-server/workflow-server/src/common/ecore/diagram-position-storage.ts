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
import { ModelState } from '@eclipse-glsp/server';

/**
 * Storage for diagram positions of metamodel elements.
 * This stores positions separately from the EcoreModel to ensure they persist
 * even when the model is regenerated or reloaded.
 */
@injectable()
export class DiagramPositionStorage {
    private readonly STORAGE_KEY = 'diagramPositions';

    @inject(ModelState)
    protected modelState: ModelState;

    /**
     * Gets the position storage map for the current model.
     */
    private getPositionMap(): Map<string, { position?: { x: number; y: number }; size?: { width: number; height: number } }> {
        let positions = this.modelState.get<Map<string, { position?: { x: number; y: number }; size?: { width: number; height: number } }>>(this.STORAGE_KEY);
        if (!positions) {
            positions = new Map();
            this.modelState.set(this.STORAGE_KEY, positions);
        }
        return positions;
    }

    /**
     * Updates the position and size for a metamodel element.
     * @param elementId The ID of the element (typically the classifier name)
     * @param position The new position
     * @param size The new size
     */
    updatePosition(elementId: string, position?: { x: number; y: number }, size?: { width: number; height: number }): void {
        const positions = this.getPositionMap();
        const current = positions.get(elementId) || {};
        
        if (position) {
            current.position = position;
        }
        if (size) {
            current.size = size;
        }
        
        positions.set(elementId, current);
    }

    /**
     * Gets the stored position for a metamodel element.
     * @param elementId The ID of the element
     * @returns The position and size, or undefined if not found
     */
    getPosition(elementId: string): { position?: { x: number; y: number }; size?: { width: number; height: number } } | undefined {
        const positions = this.getPositionMap();
        return positions.get(elementId);
    }

    /**
     * Removes the stored position for a metamodel element.
     * @param elementId The ID of the element
     */
    removePosition(elementId: string): void {
        const positions = this.getPositionMap();
        positions.delete(elementId);
    }

    /**
     * Gets all stored positions.
     * @returns A map of all element positions
     */
    getAllPositions(): Map<string, { position?: { x: number; y: number }; size?: { width: number; height: number } }> {
        return this.getPositionMap();
    }

    /**
     * Clears all stored positions.
     */
    clear(): void {
        const positions = this.getPositionMap();
        positions.clear();
    }

    /**
     * Restores positions from a map (used when loading from file).
     * @param positionsMap Map of element IDs to their positions and sizes
     */
    restorePositions(positionsMap: Map<string, { position?: { x: number; y: number }; size?: { width: number; height: number } }>): void {
        this.modelState.set(this.STORAGE_KEY, positionsMap);
    }
}

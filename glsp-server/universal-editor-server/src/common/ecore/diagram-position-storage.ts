/**
 * @author Abigail Sotomayor <s205720@dtu.dk>
 */

import { injectable, inject } from 'inversify';
import { ModelState } from '@eclipse-glsp/server';

@injectable()
export class DiagramPositionStorage {
    private readonly STORAGE_KEY = 'diagramPositions';

    @inject(ModelState)
    protected modelState: ModelState;

    private getPositionMap(): Map<string, { position?: { x: number; y: number }; size?: { width: number; height: number } }> {
        let positions = this.modelState.get<Map<string, { position?: { x: number; y: number }; size?: { width: number; height: number } }>>(this.STORAGE_KEY);
        if (!positions) {
            positions = new Map();
            this.modelState.set(this.STORAGE_KEY, positions);
        }
        return positions;
    }

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

    getPosition(elementId: string): { position?: { x: number; y: number }; size?: { width: number; height: number } } | undefined {
        const positions = this.getPositionMap();
        return positions.get(elementId);
    }

    removePosition(elementId: string): void {
        const positions = this.getPositionMap();
        positions.delete(elementId);
    }

    getAllPositions(): Map<string, { position?: { x: number; y: number }; size?: { width: number; height: number } }> {
        return this.getPositionMap();
    }

    clear(): void {
        const positions = this.getPositionMap();
        positions.clear();
    }

    restorePositions(positionsMap: Map<string, { position?: { x: number; y: number }; size?: { width: number; height: number } }>): void {
        this.modelState.set(this.STORAGE_KEY, positionsMap);
    }
}

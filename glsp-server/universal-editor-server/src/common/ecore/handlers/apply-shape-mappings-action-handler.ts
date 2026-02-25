/**
 * @author Abigail Sotomayor <s205720@dtu.dk>
 */
import { injectable, inject } from 'inversify';
import { ActionHandler } from '@eclipse-glsp/server';
import { Action, MessageAction } from '@eclipse-glsp/protocol';
import { ApplyShapeMappingsAction } from '../ecore-actions';
import { ShapeMappingStorage, ShapeMapping } from '../shape-mapping-storage';

@injectable()
export class ApplyShapeMappingsActionHandler implements ActionHandler {
    actionKinds = [ApplyShapeMappingsAction.KIND];

    @inject(ShapeMappingStorage)
    protected shapeMappingStorage: ShapeMappingStorage;

    async execute(action: Action): Promise<Action[]> {
        if (!ApplyShapeMappingsAction.is(action)) {
            return [];
        }

        try {
            const parsed = JSON.parse(action.content);
            const mappings = Array.isArray(parsed?.mappings) ? parsed.mappings as ShapeMapping[] : [];
            this.shapeMappingStorage.updateMappings(mappings);
            return [MessageAction.create('Shape mappings applied', { severity: 'INFO' })];
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error('[ApplyShapeMappings] Failed to apply mappings:', error);
            return [
                MessageAction.create(`Failed to apply shape mappings: ${message}`, { severity: 'ERROR' })
            ];
        }
    }
}


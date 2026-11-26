/**
 * @author Abigail Sotomayor <s205720@dtu.dk>
 */
import { injectable, inject } from 'inversify';
import { ActionHandler, GModelFactory, GModelRoot, ModelState } from '@eclipse-glsp/server';
import { Action, MessageAction, SetModelAction, UpdateModelAction } from '@eclipse-glsp/protocol';
import { ApplyShapeMappingsAction } from '../ecore-actions';
import { ShapeMappingStorage, ShapeMapping } from '../shape-mapping-storage';

@injectable()
export class ApplyShapeMappingsActionHandler implements ActionHandler {
    actionKinds = [ApplyShapeMappingsAction.KIND];

    @inject(ShapeMappingStorage)
    protected shapeMappingStorage: ShapeMappingStorage;

    @inject(ModelState)
    protected modelState: ModelState;

    @inject(GModelFactory)
    protected gmodelFactory: GModelFactory;

    async execute(action: Action): Promise<Action[]> {
        if (!ApplyShapeMappingsAction.is(action)) {
            return [];
        }

        try {
            const parsed = JSON.parse(action.content);
            const mappings = Array.isArray(parsed?.mappings) ? parsed.mappings as ShapeMapping[] : [];
            this.shapeMappingStorage.updateMappings(mappings);
            // Recreate the active graph so mapping changes appear without a mode switch or reload.
            this.gmodelFactory.createModel();
            const gmodel = this.modelState.get('gmodel') as GModelRoot;
            const message = MessageAction.create('Shape mappings applied', { severity: 'INFO' });
            if (!gmodel) return [message];
            const update = this.modelState.get('viewMode') === 'instance'
                ? UpdateModelAction.create(gmodel, { animate: false })
                : SetModelAction.create(gmodel);
            return [update, message];
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error('[ApplyShapeMappings] Failed to apply mappings:', error);
            return [
                MessageAction.create(`Failed to apply shape mappings: ${message}`, { severity: 'ERROR' })
            ];
        }
    }
}


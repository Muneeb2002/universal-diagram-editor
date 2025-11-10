import { injectable, inject } from 'inversify';
import { Action, SetModelAction } from '@eclipse-glsp/protocol';
import { ActionHandler, ModelState, GModelFactory, GModelRoot } from '@eclipse-glsp/server';
import { MetamodelRegistry } from './metamodel-registry';
import { UpdateAttributeAction } from './ecore-actions';

@injectable()
export class UpdateAttributeActionHandler implements ActionHandler {
    actionKinds = [UpdateAttributeAction.KIND];

    @inject(MetamodelRegistry)
    protected metamodelRegistry: MetamodelRegistry;

    @inject(ModelState)
    protected modelState: ModelState;

    @inject(GModelFactory)
    protected gmodelFactory: GModelFactory;

    async execute(action: Action): Promise<Action[]> {
        if (!UpdateAttributeAction.is(action)) {
            return [];
        }

        try {
            const result = this.metamodelRegistry.updateAttribute(
                action.className,
                action.originalAttributeName,
                action.attributeName,
                action.attributeType,
                action.lowerBound,
                action.upperBound
            );

            if (!result.success) {
                console.error(`Failed to update attribute: ${result.message}`);
                return [];
            }

            this.gmodelFactory.createModel();
            const gmodel = this.modelState.get('gmodel') as GModelRoot;

            if (gmodel && gmodel.type && gmodel.id) {
                return [SetModelAction.create(gmodel)];
            }

            return [];
        } catch (error) {
            console.error('Error in UpdateAttributeActionHandler:', error);
            return [];
        }
    }
}


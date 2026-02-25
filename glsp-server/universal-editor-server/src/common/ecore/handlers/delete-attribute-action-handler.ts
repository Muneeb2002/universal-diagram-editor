/**
 * @author Abigail Sotomayor <s205720@dtu.dk>
 */
import { injectable, inject } from 'inversify';
import { Action, SetModelAction } from '@eclipse-glsp/protocol';
import { ActionHandler, ModelState, GModelFactory, GModelRoot } from '@eclipse-glsp/server';
import { MetamodelRegistry } from '../metamodel-registry';
import { DeleteAttributeAction } from '../ecore-actions';

@injectable()
export class DeleteAttributeActionHandler implements ActionHandler {
    actionKinds = [DeleteAttributeAction.KIND];

    @inject(MetamodelRegistry)
    protected metamodelRegistry: MetamodelRegistry;

    @inject(ModelState)
    protected modelState: ModelState;

    @inject(GModelFactory)
    protected gmodelFactory: GModelFactory;

    async execute(action: Action): Promise<Action[]> {
        if (!DeleteAttributeAction.is(action)) {
            return [];
        }

        try {
            const result = this.metamodelRegistry.deleteAttribute(
                action.className,
                action.attributeName
            );

            if (result.success) {
                console.log(`Successfully deleted attribute: ${action.attributeName} from ${action.className}`);
                this.gmodelFactory.createModel();
                const gmodel = this.modelState.get('gmodel') as GModelRoot;
                
                if (gmodel && gmodel.type && gmodel.id) {
                    return [SetModelAction.create(gmodel)];
                }
            } else {
                console.error(`Failed to delete attribute: ${result.message}`);
            }

            return [];
        } catch (error) {
            console.error('Error in DeleteAttributeActionHandler:', error);
            return [];
        }
    }
}


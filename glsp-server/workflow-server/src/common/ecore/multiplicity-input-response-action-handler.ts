import { injectable, inject } from 'inversify';
import { Action, ActionHandler, GModelFactory, ModelState } from '@eclipse-glsp/server';
import { SetModelAction } from '@eclipse-glsp/protocol';
import { MetamodelRegistry } from './metamodel-registry';
import { MultiplicityInputResponseAction } from './ecore-server-actions';

/**
 * Action handler for multiplicity input responses from the client
 */
@injectable()
export class MultiplicityInputResponseActionHandler implements ActionHandler {
    actionKinds = ['multiplicityInputResponse'];

    @inject(MetamodelRegistry)
    protected metamodelRegistry: MetamodelRegistry;

    @inject(GModelFactory)
    protected gmodelFactory: GModelFactory;

    @inject(ModelState)
    protected modelState: ModelState;

    async execute(action: MultiplicityInputResponseAction): Promise<Action[]> {
        console.log('MultiplicityInputResponseActionHandler.execute() called with action:', action);
        console.log('Processing multiplicity response:', {
            referenceName: action.referenceName,
            lowerBound: action.lowerBound,
            upperBound: action.upperBound,
            sourceElementId: action.sourceElementId,
            targetElementId: action.targetElementId
        });

        try {
            // Create the containment reference with custom multiplicity
            this.metamodelRegistry.addContainmentReference(
                action.sourceElementId,
                action.targetElementId,
                action.referenceName,
                action.lowerBound,
                action.upperBound
            );

            console.log(`Added containment reference '${action.referenceName}' with multiplicity ${action.lowerBound}..${action.upperBound === -1 ? '*' : action.upperBound}`);

            // Refresh the model to show the new edge
            this.gmodelFactory.createModel();
            const gmodel = this.modelState.get('gmodel') as any;
            if (gmodel) {
                return [SetModelAction.create(gmodel)];
            }
        } catch (error) {
            console.error('Error creating containment reference with multiplicity:', error);
        }

        return [];
    }
}

import { injectable, inject } from 'inversify';
import { Action, SetModelAction } from '@eclipse-glsp/protocol';
import { ActionHandler, GModelFactory, ModelState } from '@eclipse-glsp/server';
import { MetamodelRegistry } from './metamodel-registry';
import { BidirectionalMultiplicityInputResponseAction } from './ecore-server-actions';

/**
 * Action handler for bidirectional multiplicity input responses from the client
 */
@injectable()
export class BidirectionalMultiplicityInputResponseActionHandler implements ActionHandler {
    actionKinds = ['bidirectionalMultiplicityInputResponse'];

    @inject(MetamodelRegistry)
    protected metamodelRegistry: MetamodelRegistry;

    @inject(GModelFactory)
    protected gmodelFactory: GModelFactory;

    @inject(ModelState)
    protected modelState: ModelState;

    async execute(action: BidirectionalMultiplicityInputResponseAction): Promise<Action[]> {
        console.log('BidirectionalMultiplicityInputResponseActionHandler.execute() called with action:', action);
        console.log('Processing bidirectional multiplicity response:', {
            sourceReferenceName: action.sourceReferenceName,
            sourceLowerBound: action.sourceLowerBound,
            sourceUpperBound: action.sourceUpperBound,
            targetReferenceName: action.targetReferenceName,
            targetLowerBound: action.targetLowerBound,
            targetUpperBound: action.targetUpperBound,
            sourceElementId: action.sourceElementId,
            targetElementId: action.targetElementId
        });

        try {
            // Create the bidirectional reference with custom multiplicities
            this.metamodelRegistry.addBidirectionalReference(
                action.sourceElementId,
                action.targetElementId,
                action.sourceReferenceName,
                action.targetReferenceName,
                false, // isContainment
                action.sourceLowerBound,
                action.sourceUpperBound,
                action.targetLowerBound,
                action.targetUpperBound
            );

            console.log(`Added bidirectional reference:`);
            console.log(`  ${action.sourceElementId}.${action.sourceReferenceName} (${action.sourceLowerBound}..${action.sourceUpperBound === -1 ? '*' : action.sourceUpperBound})`);
            console.log(`  ↔ ${action.targetElementId}.${action.targetReferenceName} (${action.targetLowerBound}..${action.targetUpperBound === -1 ? '*' : action.targetUpperBound})`);

            // Refresh the model to show the new edge
            this.gmodelFactory.createModel();
            const gmodel = this.modelState.get('gmodel') as any;
            if (gmodel) {
                return [SetModelAction.create(gmodel)];
            }
        } catch (error) {
            console.error('Error creating bidirectional reference with multiplicity:', error);
        }

        return [];
    }
}


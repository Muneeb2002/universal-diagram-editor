import { injectable, inject } from 'inversify';
import { Action, SetModelAction } from '@eclipse-glsp/protocol';
import { ActionHandler, GModelFactory, ModelState, ActionDispatcher } from '@eclipse-glsp/server';
import { MetamodelRegistry } from './metamodel-registry';
import { MultiplicityInputAction } from './ecore-server-actions';

/**
 * Action handler for createEdge actions
 */
@injectable()
export class EcoreCreateEdgeActionHandler implements ActionHandler {
    actionKinds = ['createEdge'];

    @inject(MetamodelRegistry)
    protected metamodelRegistry: MetamodelRegistry;

    @inject(GModelFactory)
    protected gmodelFactory: GModelFactory;

    @inject(ModelState)
    protected modelState: ModelState;

    @inject(ActionDispatcher)
    protected actionDispatcher: ActionDispatcher;

    async execute(action: Action): Promise<Action[]> {
        console.log('EcoreCreateEdgeActionHandler.execute() called with action:', action);
        
        // Parse the action to extract source, target, and edge type
        if (action.kind === 'createEdge' && 'elementTypeId' in action && 'sourceElementId' in action && 'targetElementId' in action) {
            const elementTypeId = action.elementTypeId as string;
            const sourceElementId = action.sourceElementId as string;
            const targetElementId = action.targetElementId as string;
            
            console.log(`Creating ${elementTypeId} edge from ${sourceElementId} to ${targetElementId}`);
            
            try {
                // Create the edge in the metamodel based on type
                switch (elementTypeId) {
                    case 'edge:ecore-inheritance':
                        this.metamodelRegistry.addInheritance(sourceElementId, targetElementId);
                        console.log(`Added inheritance: ${sourceElementId} extends ${targetElementId}`);
                        break;
                    case 'edge:ecore-containment':
                        console.log(`Triggering multiplicity dialog for containment edge: ${sourceElementId} -> ${targetElementId}`);
                        
                        // Dispatch action to show multiplicity dialog on client
                        const multiplicityAction = MultiplicityInputAction.create(
                            sourceElementId,
                            targetElementId,
                            'edge:ecore-containment',
                            sourceElementId,
                            targetElementId
                        );
                        
                        console.log('Dispatching MultiplicityInputAction:', multiplicityAction);
                        this.actionDispatcher.dispatch(multiplicityAction);
                        console.log('MultiplicityInputAction dispatched successfully');
                        
                        // Don't create the edge immediately - wait for user input
                        return [];
                    case 'edge:ecore-reference':
                        console.log(`Triggering multiplicity dialog for reference edge: ${sourceElementId} -> ${targetElementId}`);
                        
                        // Dispatch action to show multiplicity dialog on client
                        const referenceMultiplicityAction = MultiplicityInputAction.create(
                            sourceElementId,
                            targetElementId,
                            'edge:ecore-reference',
                            sourceElementId,
                            targetElementId
                        );
                        
                        console.log('Dispatching MultiplicityInputAction for reference:', referenceMultiplicityAction);
                        this.actionDispatcher.dispatch(referenceMultiplicityAction);
                        console.log('MultiplicityInputAction dispatched successfully');
                        
                        // Don't create the edge immediately - wait for user input
                        return [];
                    default:
                        console.error(`Unknown edge type: ${elementTypeId}`);
                        return [];
                }
                
                // Refresh the model to show the new edge
                this.gmodelFactory.createModel();
                const gmodel = this.modelState.get('gmodel') as any;
                if (gmodel) {
                    return [SetModelAction.create(gmodel)];
                }
            } catch (error) {
                console.error('Error creating edge:', error);
                return [];
            }
        }
        
        return [];
    }
}

import { injectable, inject } from 'inversify';
import { Action, SetModelAction } from '@eclipse-glsp/protocol';
import { ActionHandler, GModelFactory, ModelState } from '@eclipse-glsp/server';
import { MetamodelRegistry } from './metamodel-registry';

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
                        const containmentRefName = `${targetElementId.toLowerCase()}s`;
                        this.metamodelRegistry.addContainmentReference(sourceElementId, targetElementId, containmentRefName);
                        console.log(`Added containment: ${sourceElementId} contains ${targetElementId}`);
                        break;
                    case 'edge:ecore-reference':
                        const refName = `${targetElementId.toLowerCase()}`;
                        this.metamodelRegistry.addReference(sourceElementId, targetElementId, refName);
                        console.log(`Added reference: ${sourceElementId} refers to ${targetElementId}`);
                        break;
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

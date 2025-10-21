import { injectable, inject } from 'inversify';
import { GEdge, GModelElement, GLabel } from '@eclipse-glsp/graph';
import { CreateEdgeOperation } from '@eclipse-glsp/protocol';
import { GModelCreateEdgeOperationHandler, ModelState, ActionDispatcher } from '@eclipse-glsp/server';
import { MetamodelRegistry } from './metamodel-registry';
import { MultiplicityInputAction, BidirectionalMultiplicityInputAction } from './ecore-server-actions';

/**
 * Handler for creating Ecore edges (inheritance, containment, reference)
 */
@injectable()
export class EcoreEdgeCreationHandler extends GModelCreateEdgeOperationHandler {
    @inject(ModelState)
    protected override modelState: ModelState;

    @inject(MetamodelRegistry)
    protected metamodelRegistry: MetamodelRegistry;

    @inject(ActionDispatcher)
    protected actionDispatcher: ActionDispatcher;

    override readonly label = 'Create Ecore Edge';
    
    override readonly elementTypeIds = [
        'edge:ecore-inheritance',
        'edge:ecore-containment', 
        'edge:ecore-reference',
        'edge:ecore-bidirectional'
    ];

    constructor() {
        super();
        console.log('EcoreEdgeCreationHandler initialized with elementTypeIds:', this.elementTypeIds);
    }

    private currentOperation: CreateEdgeOperation | undefined;

    override executeCreation(operation: CreateEdgeOperation): void {
        console.log('EcoreEdgeCreationHandler.executeCreation() called with operation:', operation);
        this.currentOperation = operation;
        super.executeCreation(operation);
        
        // Refresh the model to show the new edge
        console.log('Edge creation completed, refreshing model...');
        this.currentOperation = undefined;
    }

    override createEdge(source: GModelElement, target: GModelElement): GEdge | undefined {
        const sourceClassName = source.id;
        const targetClassName = target.id;

        console.log(`Creating edge between ${sourceClassName} and ${targetClassName}`);

        // Validate that both source and target are valid classes in the metamodel
        const sourceClass = this.metamodelRegistry.findEClass(sourceClassName);
        const targetClass = this.metamodelRegistry.findEClass(targetClassName);
        
        if (!sourceClass || !targetClass) {
            console.error(`Cannot create edge: source class '${sourceClassName}' or target class '${targetClassName}' not found in metamodel`);
            return undefined;
        }

        // Determine edge type from current operation
        const edgeType = this.currentOperation?.elementTypeId;
        console.log(`Edge type: ${edgeType}`);

        // Create the edge based on type
        switch (edgeType) {
            case 'edge:ecore-inheritance':
                return this.createInheritanceEdge(sourceClassName, targetClassName);
            case 'edge:ecore-containment':
                return this.createContainmentEdgeWithMultiplicity(sourceClassName, targetClassName, source.id, target.id);
            case 'edge:ecore-reference':
                return this.createReferenceEdgeWithMultiplicity(sourceClassName, targetClassName, source.id, target.id);
            case 'edge:ecore-bidirectional':
                return this.createBidirectionalReferenceEdgeWithMultiplicity(sourceClassName, targetClassName, source.id, target.id);
            default:
                console.error(`Unknown edge type: ${edgeType}, defaulting to containment`);
                return this.createContainmentEdge(sourceClassName, targetClassName);
        }
    }

    private createInheritanceEdge(sourceClassName: string, targetClassName: string): GEdge {
        const edge = new GEdge();
        edge.type = 'edge:ecore-inheritance';
        edge.id = `${sourceClassName}_inherits_${targetClassName}`;
        edge.sourceId = sourceClassName;
        edge.targetId = targetClassName;
        edge.cssClasses = ['ecore-inheritance'];

        // Update the metamodel to reflect the inheritance relationship
        try {
            this.metamodelRegistry.addInheritance(sourceClassName, targetClassName);
            console.log(`Added inheritance: ${sourceClassName} extends ${targetClassName}`);
        } catch (error) {
            console.error(`Error adding inheritance: ${error}`);
        }

        return edge;
    }

    private createContainmentEdgeWithMultiplicity(sourceClassName: string, targetClassName: string, sourceElementId: string, targetElementId: string): GEdge | undefined {
        console.log(`Triggering multiplicity dialog for containment edge: ${sourceClassName} -> ${targetClassName}`);
        
        // Dispatch action to show multiplicity dialog on client
        const multiplicityAction = MultiplicityInputAction.create(
            sourceClassName,
            targetClassName,
            'edge:ecore-containment',
            sourceElementId,
            targetElementId
        );
        
        console.log('Dispatching MultiplicityInputAction:', multiplicityAction);
        this.actionDispatcher.dispatch(multiplicityAction);
        console.log('MultiplicityInputAction dispatched successfully');
        
        // Return undefined to prevent immediate edge creation
        // The edge will be created after user provides multiplicity input
        return undefined;
    }

    private createContainmentEdge(sourceClassName: string, targetClassName: string): GEdge {
        const edge = new GEdge();
        edge.type = 'edge:ecore-containment';
        edge.id = `${sourceClassName}_contains_${targetClassName}`;
        edge.sourceId = sourceClassName;
        edge.targetId = targetClassName;
        edge.cssClasses = ['ecore-containment'];

        // Add containment reference to the metamodel
        try {
            const referenceName = `${targetClassName.toLowerCase()}s`; // Pluralize target class name
            this.metamodelRegistry.addContainmentReference(sourceClassName, targetClassName, referenceName);
            console.log(`Added containment: ${sourceClassName} contains ${targetClassName}`);
        } catch (error) {
            console.error(`Error adding containment: ${error}`);
        }

        // Add label showing the reference name
        const label = new GLabel();
        label.type = 'label:text';
        label.id = `${edge.id}_label`;
        label.text = `${targetClassName.toLowerCase()}s`;
        edge.children.push(label);

        return edge;
    }

    private createReferenceEdgeWithMultiplicity(sourceClassName: string, targetClassName: string, sourceElementId: string, targetElementId: string): GEdge | undefined {
        console.log(`Triggering multiplicity dialog for reference edge: ${sourceClassName} -> ${targetClassName}`);
        
        // Dispatch action to show multiplicity dialog on client
        const multiplicityAction = MultiplicityInputAction.create(
            sourceClassName,
            targetClassName,
            'edge:ecore-reference',
            sourceElementId,
            targetElementId
        );
        
        console.log('Dispatching MultiplicityInputAction for reference:', multiplicityAction);
        this.actionDispatcher.dispatch(multiplicityAction);
        console.log('MultiplicityInputAction dispatched successfully');
        
        // Return undefined to prevent immediate edge creation
        // The edge will be created after user provides multiplicity input
        return undefined;
    }

    private createBidirectionalReferenceEdgeWithMultiplicity(sourceClassName: string, targetClassName: string, sourceElementId: string, targetElementId: string): GEdge | undefined {
        console.log(`Triggering bidirectional multiplicity dialog for: ${sourceClassName} <-> ${targetClassName}`);
        
        // Dispatch action to show bidirectional multiplicity dialog on client
        const bidirectionalAction = BidirectionalMultiplicityInputAction.create(
            sourceClassName,
            targetClassName,
            sourceElementId,
            targetElementId
        );
        
        console.log('Dispatching BidirectionalMultiplicityInputAction:', bidirectionalAction);
        this.actionDispatcher.dispatch(bidirectionalAction);
        console.log('BidirectionalMultiplicityInputAction dispatched successfully');
        
        // Return undefined to prevent immediate edge creation
        // The edge will be created after user provides multiplicity input
        return undefined;
    }

}

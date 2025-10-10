import { injectable, inject } from 'inversify';
import { GEdge, GModelElement, GLabel } from '@eclipse-glsp/graph';
import { CreateEdgeOperation } from '@eclipse-glsp/protocol';
import { GModelCreateEdgeOperationHandler, ModelState } from '@eclipse-glsp/server';
import { MetamodelRegistry } from './metamodel-registry';

/**
 * Handler for creating Ecore edges (inheritance, containment, reference)
 */
@injectable()
export class EcoreEdgeCreationHandler extends GModelCreateEdgeOperationHandler {
    @inject(ModelState)
    protected override modelState: ModelState;

    @inject(MetamodelRegistry)
    protected metamodelRegistry: MetamodelRegistry;

    override readonly label = 'Create Ecore Edge';
    
    override readonly elementTypeIds = [
        'edge:ecore-inheritance',
        'edge:ecore-containment', 
        'edge:ecore-reference'
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
                return this.createContainmentEdge(sourceClassName, targetClassName);
            case 'edge:ecore-reference':
                return this.createReferenceEdge(sourceClassName, targetClassName);
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

    private createReferenceEdge(sourceClassName: string, targetClassName: string): GEdge {
        const edge = new GEdge();
        edge.type = 'edge:ecore-reference';
        edge.id = `${sourceClassName}_refers_to_${targetClassName}`;
        edge.sourceId = sourceClassName;
        edge.targetId = targetClassName;
        edge.cssClasses = ['ecore-reference'];

        // Add reference to the metamodel
        try {
            const referenceName = `${targetClassName.toLowerCase()}`;
            this.metamodelRegistry.addReference(sourceClassName, targetClassName, referenceName);
            console.log(`Added reference: ${sourceClassName} refers to ${targetClassName}`);
        } catch (error) {
            console.error(`Error adding reference: ${error}`);
        }

        // Add label showing the reference name
        const label = new GLabel();
        label.type = 'label:text';
        label.id = `${edge.id}_label`;
        label.text = `${targetClassName.toLowerCase()}`;
        edge.children.push(label);

        return edge;
    }

}

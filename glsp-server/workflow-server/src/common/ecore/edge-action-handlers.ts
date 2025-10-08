import { injectable, inject } from 'inversify';
import { ActionHandler, Action, ModelState, SetModelAction } from '@eclipse-glsp/server';
import { GModelRoot, GEdge, GLabel } from '@eclipse-glsp/server';
import { ChangeEdgeTypeAction, DeleteEdgeAction } from './ecore-actions';

/**
 * Action handler for changing edge types.
 */
@injectable()
export class ChangeEdgeTypeActionHandler implements ActionHandler {
    readonly actionKinds = [ChangeEdgeTypeAction.KIND];

    @inject(ModelState)
    protected modelState: ModelState;

    async execute(action: ChangeEdgeTypeAction): Promise<Action[]> {
        console.log(`Changing edge type: ${action.edgeId} to ${action.newType}`);
        
        // Get the current model
        const currentModel = this.modelState.get('gmodel') as GModelRoot;
        if (!currentModel) {
            console.error('No current model available');
            return [];
        }

        // Debug: Log all edges in the model
        this.logAllEdges(currentModel);

        // Find the edge in the model
        const edge = this.findEdgeById(currentModel, action.edgeId);
        if (!edge) {
            console.error(`Edge not found: ${action.edgeId}`);
            return [];
        }

        // Update the edge type
        edge.type = action.newType;
        
        // Update the visual representation based on the new type
        this.updateEdgeVisuals(edge, action.newType);
        
        // Update the underlying Ecore model based on the edge type change
        this.updateEcoreModelForEdgeTypeChange(edge, action.sourceId, action.targetId, action.newType, action);

        console.log(`Edge type changed successfully: ${action.edgeId} -> ${action.newType}`);
        
        // Convert the modified ecore-ts model back to plain JavaScript objects for proper serialization
        const ecoreModel = this.modelState.get('ecoreModel');
        if (ecoreModel) {
            const serializableModel = this.convertEcoreTsToSerializable(ecoreModel);
            this.modelState.set('ecoreModel', serializableModel);
        }
        
        // Trigger model update to refresh the view
        return [SetModelAction.create(currentModel)];
    }

    private findEdgeById(root: GModelRoot, edgeId: string): GEdge | undefined {
        // Remove sprotty_ prefix if present
        const cleanEdgeId = edgeId.startsWith('sprotty_') ? edgeId.substring(8) : edgeId;
        
        const findEdge = (element: any): GEdge | undefined => {
            if (element.type?.startsWith('edge:')) {
                // Check both with and without sprotty_ prefix
                if (element.id === edgeId || element.id === cleanEdgeId) {
                    return element as GEdge;
                }
            }
            if (element.children) {
                for (const child of element.children) {
                    const found = findEdge(child);
                    if (found) return found;
                }
            }
            return undefined;
        };
        
        return findEdge(root);
    }

    private logAllEdges(root: GModelRoot): void {
        console.log('=== All edges in the model ===');
        const logEdges = (element: any, depth: number = 0) => {
            const indent = '  '.repeat(depth);
            if (element.type?.startsWith('edge:')) {
                console.log(`${indent}Edge: id="${element.id}", type="${element.type}", sourceId="${element.sourceId}", targetId="${element.targetId}"`);
            }
            if (element.children) {
                for (const child of element.children) {
                    logEdges(child, depth + 1);
                }
            }
        };
        logEdges(root);
        console.log('=== End of edges ===');
    }

    private updateEdgeVisuals(edge: GEdge, newType: string): void {
        // Update edge-specific properties based on type
        switch (newType) {
            case 'edge:ecore-containment':
                // Composition edge - solid line with filled diamond
                edge.cssClasses = ['ecore-containment'];
                break;
            case 'edge:ecore-reference':
                // Association edge - solid line
                edge.cssClasses = ['ecore-reference'];
                break;
            case 'edge:ecore-inheritance':
                // Generalization edge - solid line with hollow triangle
                edge.cssClasses = ['ecore-inheritance'];
                break;
            default:
                edge.cssClasses = [];
        }
    }

    private updateEcoreModelForEdgeTypeChange(edge: GEdge, sourceId: string, targetId: string, newType: string, action: ChangeEdgeTypeAction): void {
        try {
            // Get the current Ecore model from the model state
            const ecoreModel = this.modelState.get('ecoreModel');
            if (!ecoreModel) {
                console.warn('No Ecore model available for updating edge type');
                return;
            }

            console.log(`Updating Ecore model for edge type change: ${sourceId} -> ${targetId} to ${newType}`);
            
            // Find the source class in the Ecore model
            const sourceClass = this.findEClassByName(ecoreModel, sourceId);
            if (!sourceClass) {
                console.warn(`Source class not found: ${sourceId}`);
                return;
            }

            // Find the target class in the Ecore model
            const targetClass = this.findEClassByName(ecoreModel, targetId);
            if (!targetClass) {
                console.warn(`Target class not found: ${targetId}`);
                return;
            }

            const originalEdgeType = this.getOriginalEdgeType(edge);
            console.log(`Original edge type: ${originalEdgeType}, New edge type: ${newType}`);

            // Handle different edge type transitions
            if (newType === 'edge:ecore-inheritance') {
                this.handleInheritanceChange(sourceClass, targetClass, originalEdgeType);
            } else if (newType === 'edge:ecore-reference' || newType === 'edge:ecore-containment') {
                this.handleReferenceChange(sourceClass, targetClass, newType, originalEdgeType, edge, action);
            }

        } catch (error) {
            console.error('Error updating Ecore model for edge type change:', error);
        }
    }

    private getOriginalEdgeType(edge: GEdge): string {
        // Determine original edge type based on current properties
        if (edge.cssClasses?.includes('ecore-inheritance')) {
            return 'edge:ecore-inheritance';
        } else if (edge.cssClasses?.includes('ecore-containment')) {
            return 'edge:ecore-containment';
        } else {
            return 'edge:ecore-reference';
        }
    }

    private handleInheritanceChange(sourceClass: any, targetClass: any, originalType: string): void {
        console.log(`Converting to inheritance: ${sourceClass.name} -> ${targetClass.name}`);
        
        if (originalType !== 'edge:ecore-inheritance') {
            // Remove any existing reference if converting from reference/containment
            this.removeReferenceIfExists(sourceClass, targetClass.name);
        }

        // Add to superTypes if not already present
        const superTypes = sourceClass.get('eSuperTypes');
        const sourceClassName = sourceClass.get('name');
        const targetClassName = targetClass.get('name');
        
        // Check if inheritance already exists
        let hasInheritance = false;
        for (const superType of superTypes || []) {
            if (superType.get('name') === targetClassName) {
                hasInheritance = true;
                break;
            }
        }
        
        if (!hasInheritance) {
            // Create new super type reference
            const newSuperType = {
                name: targetClassName,
                get: function(prop: string): any {
                    return (this as any)[prop];
                }
            };
            superTypes.add(newSuperType);
            console.log(`Added inheritance: ${sourceClassName} inherits from ${targetClassName}`);
        }
    }

    private handleReferenceChange(sourceClass: any, targetClass: any, newType: string, originalType: string, edge: GEdge, action: ChangeEdgeTypeAction): void {
        const sourceClassName = sourceClass.get('name');
        const targetClassName = targetClass.get('name');
        console.log(`Converting to reference/containment: ${sourceClassName} -> ${targetClassName} (${newType})`);
        
        if (originalType === 'edge:ecore-inheritance') {
            // Remove from superTypes if converting from inheritance
            this.removeInheritanceIfExists(sourceClass, targetClassName);
        }

        // For containment: we want the target class to contain the source class
        // So we create a reference on the target class pointing to the source class
        const referenceName = this.generateReferenceName(sourceClassName);
        let reference = this.findEReferenceByName(targetClass, referenceName);
        
        if (!reference) {
            // Create new reference
            reference = this.createEReference(referenceName, sourceClassName);
            const eStructuralFeatures = targetClass.get('eStructuralFeatures');
            eStructuralFeatures.add(reference);
        }

        // Set reference properties based on type
        if (newType === 'edge:ecore-containment') {
            reference.set('containment', true);
            reference.set('container', false);
            // Use user-provided bounds or default to 0..1
            const lowerBound = action.lowerBound !== undefined ? action.lowerBound : 0;
            const upperBound = action.upperBound !== undefined ? action.upperBound : 1;
            reference.set('lowerBound', lowerBound);
            reference.set('upperBound', upperBound);
        } else {
            reference.set('containment', false);
            reference.set('container', false);
            // Use user-provided bounds or default to 1..1
            const lowerBound = action.lowerBound !== undefined ? action.lowerBound : 1;
            const upperBound = action.upperBound !== undefined ? action.upperBound : 1;
            reference.set('lowerBound', lowerBound);
            reference.set('upperBound', upperBound);
        }

        // Update or create edge label
        this.updateOrCreateEdgeLabel(edge, referenceName, reference.get('lowerBound'), reference.get('upperBound'));
    }

    private removeReferenceIfExists(sourceClass: any, targetClassName: string): void {
        const eStructuralFeatures = sourceClass.get('eStructuralFeatures');
        if (!eStructuralFeatures) return;
        
        // Use forEach method on ecore-ts collection
        (eStructuralFeatures as any).forEach((feature: any) => {
            const featureType = feature.get('eClass')?.get('name');
            if (featureType === 'EReference') {
                const refType = feature.get('eType');
                if (refType && refType.get('name') === targetClassName) {
                    eStructuralFeatures.remove(feature);
                }
            }
        });
    }

    private removeInheritanceIfExists(sourceClass: any, superTypeName: string): void {
        const superTypes = sourceClass.get('eSuperTypes');
        if (!superTypes) return;
        
        // Use forEach method on ecore-ts collection
        (superTypes as any).forEach((superType: any) => {
            if (superType.get('name') === superTypeName) {
                superTypes.remove(superType);
            }
        });
    }

    private generateReferenceName(targetClassName: string): string {
        // Generate a reference name based on the target class name
        // Convert to camelCase and make plural for containment
        const baseName = targetClassName.charAt(0).toLowerCase() + targetClassName.slice(1);
        return baseName + 's'; // Simple pluralization
    }


    private createEReference(name: string, targetTypeName: string): any {
        // Import EReference from ecore-ts
        const { EReference } = require('ecore-ts');
        
        // Find the target type in the ecore model
        const ecoreModel = this.modelState.get('ecoreModel');
        const targetType = this.findEClassByName(ecoreModel, targetTypeName);
        if (!targetType) {
            throw new Error(`Target type ${targetTypeName} not found`);
        }
        
        // Create a proper ecore-ts EReference object
        const reference = EReference.create({
            name: name,
            eType: targetType,
            lowerBound: 1,
            upperBound: 1,
            unique: true,
            ordered: false,
            containment: false,
            container: false,
            resolveProxies: true
        });
        
        return reference;
    }

    private findEClassByName(ecoreModel: any, className: string): any {
        // Use regular JavaScript object access
        const ePackages = ecoreModel.ePackages;
        
        for (const ePackage of ePackages || []) {
            // Use ecore-ts API for classifiers (they are ecore-ts instances)
            const eClassifiers = ePackage.get('eClassifiers');
            
            // Use forEach method on ecore-ts collection
            let foundClassifier = null;
            (eClassifiers as any).forEach((eClassifier: any) => {
                const classifierName = eClassifier.get('name');
                if (classifierName === className) {
                    foundClassifier = eClassifier;
                }
            });
            
            if (foundClassifier) {
                return foundClassifier;
            }
        }
        
        return null;
    }

    private findEReferenceByName(eClass: any, referenceName: string): any {
        const eStructuralFeatures = eClass.get('eStructuralFeatures');
        if (!eStructuralFeatures) return null;
        
        // Use forEach method on ecore-ts collection
        let foundReference = null;
        (eStructuralFeatures as any).forEach((feature: any) => {
            const featureName = feature.get('name');
            const featureType = feature.get('eClass')?.get('name');
            if (featureName === referenceName && featureType === 'EReference') {
                foundReference = feature;
            }
        });
        
        return foundReference;
    }



    private updateOrCreateEdgeLabel(edge: GEdge, referenceName: string, lowerBound: number, upperBound: number): void {
        // Update the edge label to show the new multiplicity
        const multiplicity = this.getMultiplicityString(lowerBound, upperBound);
        const labelText = multiplicity !== '[1]' ? `${multiplicity} ${referenceName}` : referenceName;
        
        // Find existing label child
        let label = edge.children?.find(child => child.type === 'label:text');
        
        if (label) {
            // Update existing label
            (label as any).text = labelText;
        } else {
            // Create new label if it doesn't exist
            const newLabel = new GLabel();
            newLabel.type = 'label:text';
            newLabel.id = `${edge.id}_label`;
            newLabel.text = labelText;
            
            // Ensure edge has children array
            if (!edge.children) {
                edge.children = [];
            }
            
                edge.children.push(newLabel);
        }
    }

    private getMultiplicityString(lowerBound: number, upperBound: number): string {
        if (lowerBound === upperBound) {
            return `[${lowerBound}]`;
        } else if (upperBound === -1) {
            return `[${lowerBound}..*]`;
        } else {
            return `[${lowerBound}..${upperBound}]`;
        }
    }

    private convertEcoreTsToSerializable(ecoreModel: any): any {
        // Convert ecore-ts objects back to plain JavaScript objects for JSON serialization
        const result: any = {
            ePackages: []
        };

        const ePackages = ecoreModel.ePackages;
        for (const ePackage of ePackages || []) {
            const packageObj: any = {
                name: ePackage.get('name'),
                nsURI: ePackage.get('nsURI'),
                nsPrefix: ePackage.get('nsPrefix'),
                eClassifiers: []
            };

            // Use forEach method on ecore-ts collection
            const eClassifiers = ePackage.get('eClassifiers');
            (eClassifiers as any).forEach((classifier: any) => {
                const classifierObj: any = {
                    name: classifier.get('name'),
                    abstract: classifier.get('abstract'),
                    interface: classifier.get('interface'),
                    eAttributes: [],
                    eReferences: [],
                    eSuperTypes: []
                };

                // Convert attributes
                const eAttributes = classifier.get('eAttributes');
                (eAttributes as any).forEach((attr: any) => {
                    classifierObj.eAttributes.push({
                        name: attr.get('name'),
                        eType: { name: attr.get('eType')?.get('name') },
                        lowerBound: attr.get('lowerBound'),
                        upperBound: attr.get('upperBound'),
                        unique: attr.get('unique'),
                        ordered: attr.get('ordered')
                    });
                });

                // Convert references
                const eStructuralFeatures = classifier.get('eStructuralFeatures');
                console.log(`Serializing structural features for class ${classifier.get('name')}:`);
                console.log(`  eStructuralFeatures size: ${eStructuralFeatures?.size?.() || eStructuralFeatures?.length || 0}`);
                
                // Handle both ecore-ts collections and plain JavaScript arrays
                if (Array.isArray(eStructuralFeatures)) {
                    eStructuralFeatures.forEach((feature: any) => {
                    const featureName = feature.get('name');
                    const featureType = feature.get('eClass')?.get('name');
                    const eType = feature.get('eType');
                    const containment = feature.get('containment');
                    const container = feature.get('container');
                    
                    console.log(`  - Feature: ${featureName}, Type: ${featureType}, eType: ${eType?.get('name')}, containment: ${containment}, container: ${container}`);
                    
                    // Check if it's a reference by looking for containment/container properties
                    // or if it has an eType that's not a primitive type (EString, EInt, etc.)
                    const isReference = containment !== undefined || container !== undefined || 
                                      (eType && !['EString', 'EInt', 'EDouble', 'EBoolean', 'EDate'].includes(eType.get('name')));
                    
                    if (isReference) {
                        console.log(`    Adding reference to eReferences: ${featureName}`);
                        classifierObj.eReferences.push({
                            name: feature.get('name'),
                            eType: eType ? { name: eType.get('name') } : undefined,
                            lowerBound: feature.get('lowerBound'),
                            upperBound: feature.get('upperBound'),
                            unique: feature.get('unique'),
                            ordered: feature.get('ordered'),
                            containment: containment,
                            container: container
                        });
                    } else {
                        console.log(`    Adding attribute to eAttributes: ${featureName}`);
                        classifierObj.eAttributes.push({
                            name: feature.get('name'),
                            eType: eType ? { name: eType.get('name') } : undefined,
                            lowerBound: feature.get('lowerBound'),
                            upperBound: feature.get('upperBound'),
                            unique: feature.get('unique'),
                            ordered: feature.get('ordered')
                        });
                    }
                    });
                } else {
                    // Handle ecore-ts collections
                    (eStructuralFeatures as any).forEach((feature: any) => {
                    const featureName = feature.get('name');
                    const featureType = feature.get('eClass')?.get('name');
                    const eType = feature.get('eType');
                    const containment = feature.get('containment');
                    const container = feature.get('container');
                    
                    console.log(`  - Feature: ${featureName}, Type: ${featureType}, eType: ${eType?.get('name')}, containment: ${containment}, container: ${container}`);
                    
                    // Check if it's a reference by looking for containment/container properties
                    // or if it has an eType that's not a primitive type (EString, EInt, etc.)
                    const isReference = containment !== undefined || container !== undefined || 
                                      (eType && !['EString', 'EInt', 'EDouble', 'EBoolean', 'EDate'].includes(eType.get('name')));
                    
                    if (isReference) {
                        console.log(`    Adding reference to eReferences: ${featureName}`);
                        classifierObj.eReferences.push({
                            name: feature.get('name'),
                            eType: eType ? { name: eType.get('name') } : undefined,
                            lowerBound: feature.get('lowerBound'),
                            upperBound: feature.get('upperBound'),
                            unique: feature.get('unique'),
                            ordered: feature.get('ordered'),
                            containment: containment,
                            container: container
                        });
                    } else {
                        console.log(`    Adding attribute to eAttributes: ${featureName}`);
                        classifierObj.eAttributes.push({
                            name: feature.get('name'),
                            eType: eType ? { name: eType.get('name') } : undefined,
                            lowerBound: feature.get('lowerBound'),
                            upperBound: feature.get('upperBound'),
                            unique: feature.get('unique'),
                            ordered: feature.get('ordered')
                        });
                    }
                    });
                }

                // Convert super types
                const eSuperTypes = classifier.get('eSuperTypes');
                (eSuperTypes as any).forEach((superType: any) => {
                    classifierObj.eSuperTypes.push({
                        name: superType.get('name')
                    });
                });

                packageObj.eClassifiers.push(classifierObj);
            });

            result.ePackages.push(packageObj);
        }

        return result;
    }
}

/**
 * Action handler for deleting edges.
 */
@injectable()
export class DeleteEdgeActionHandler implements ActionHandler {
    readonly actionKinds = [DeleteEdgeAction.KIND];

    @inject(ModelState)
    protected modelState: ModelState;

    async execute(action: DeleteEdgeAction): Promise<Action[]> {
        console.log(`Deleting edge: ${action.edgeId}`);
        
        // Get the current model
        const currentModel = this.modelState.get('gmodel') as GModelRoot;
        if (!currentModel) {
            console.error('No current model available');
            return [];
        }

        // Find and remove the edge from the model
        const removed = this.removeEdgeById(currentModel, action.edgeId);
        if (removed) {
            console.log(`Edge deleted successfully: ${action.edgeId}`);
            // Trigger model update to refresh the view
            return [SetModelAction.create(currentModel)];
        } else {
            console.error(`Edge not found for deletion: ${action.edgeId}`);
            return [];
        }
    }

    private removeEdgeById(root: GModelRoot, edgeId: string): boolean {
        // Remove sprotty_ prefix if present
        const cleanEdgeId = edgeId.startsWith('sprotty_') ? edgeId.substring(8) : edgeId;
        
        const removeEdge = (element: any): boolean => {
            if (element.children) {
                const childIndex = element.children.findIndex((child: any) => 
                    child.type?.startsWith('edge:') && 
                    (child.id === edgeId || child.id === cleanEdgeId)
                );
                
                if (childIndex !== -1) {
                    element.children.splice(childIndex, 1);
                    return true;
                }
                
                // Recursively search in children
                for (const child of element.children) {
                    if (removeEdge(child)) {
                        return true;
                    }
                }
            }
            return false;
        };
        
        return removeEdge(root);
    }
}

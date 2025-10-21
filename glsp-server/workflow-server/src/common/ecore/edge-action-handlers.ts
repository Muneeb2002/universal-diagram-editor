import { injectable, inject } from 'inversify';
import { ActionHandler, Action, ModelState, SetModelAction } from '@eclipse-glsp/server';
import { GModelRoot, GEdge } from '@eclipse-glsp/server';
import { DeleteEdgeAction } from './ecore-actions';

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

        // Find the edge before removing it to get its properties
        const edge = this.findEdgeById(currentModel, action.edgeId);
        if (!edge) {
            console.error(`Edge not found for deletion: ${action.edgeId}`);
            return [];
        }

        // Update the underlying Ecore model before removing the visual edge
        this.updateEcoreModelForEdgeDeletion(edge, action.edgeId);

        // Find and remove the edge from the visual model
        const removed = this.removeEdgeById(currentModel, action.edgeId);
        if (removed) {
            console.log(`Edge deleted successfully: ${action.edgeId}`);
            
            // Convert the modified ecore-ts model back to plain JavaScript objects for proper serialization
            const ecoreModel = this.modelState.get('ecoreModel');
            if (ecoreModel) {
                const serializableModel = this.convertEcoreTsToSerializable(ecoreModel);
                this.modelState.set('ecoreModel', serializableModel);
            }
            
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

    private updateEcoreModelForEdgeDeletion(edge: GEdge, edgeId: string): void {
        try {
            // Get the current Ecore model from the model state
            const ecoreModel = this.modelState.get('ecoreModel');
            if (!ecoreModel) {
                console.warn('No Ecore model available for updating edge deletion');
                return;
            }

            console.log(`Updating Ecore model for edge deletion: ${edgeId}`);
            
            // Parse the edge ID to determine the relationship type and parameters
            if (edgeId.includes('_inherits_')) {
                // This is an inheritance edge: ${subClass}_inherits_${superClass}
                this.handleInheritanceDeletion(edgeId, ecoreModel);
            } else {
                // This is likely a reference edge: ${sourceClass}_${referenceName}
                this.handleReferenceDeletion(edgeId, ecoreModel);
            }

        } catch (error) {
            console.error('Error updating Ecore model for edge deletion:', error);
        }
    }

    private handleInheritanceDeletion(edgeId: string, ecoreModel: any): void {
        // Parse edgeId: ${subClass}_inherits_${superClass}
        // Remove sprotty_ prefix if present
        const cleanEdgeId = edgeId.startsWith('sprotty_') ? edgeId.substring(8) : edgeId;
        const parts = cleanEdgeId.split('_inherits_');
        if (parts.length !== 2) {
            console.warn(`Invalid inheritance edge ID format: ${edgeId}`);
            return;
        }

        const subClassName = parts[0];
        const superClassName = parts[1];

        console.log(`Removing inheritance: ${subClassName} inherits from ${superClassName}`);

        // Find the subclass in the Ecore model
        const subClass = this.findEClassByName(ecoreModel, subClassName);
        if (!subClass) {
            console.warn(`Subclass not found: ${subClassName}`);
            return;
        }

        // Remove the supertype from the subclass
        this.removeInheritanceIfExists(subClass, superClassName);
    }

    private handleReferenceDeletion(edgeId: string, ecoreModel: any): void {
        // Parse edgeId: ${sourceClass}_${referenceName}
        // Remove sprotty_ prefix if present
        const cleanEdgeId = edgeId.startsWith('sprotty_') ? edgeId.substring(8) : edgeId;
        
        // We need to find the last underscore that separates source class from reference name
        // Since class names and reference names can contain underscores, we need to be careful
        
        // First, try to find the source class by checking which class exists in the model
        const ePackages = ecoreModel.ePackages;
        let sourceClass = null;
        let referenceName = null;
        
        for (const ePackage of ePackages || []) {
            const eClassifiers = ePackage.get('eClassifiers');
            (eClassifiers as any).forEach((eClassifier: any) => {
                const className = eClassifier.get('name');
                // Check if the cleanEdgeId starts with this class name followed by underscore
                if (cleanEdgeId.startsWith(className + '_')) {
                    const possibleRefName = cleanEdgeId.substring(className.length + 1);
                    // Check if this reference actually exists in the class
                    const eStructuralFeatures = eClassifier.get('eStructuralFeatures');
                    (eStructuralFeatures as any).forEach((feature: any) => {
                        if (feature.get('name') === possibleRefName) {
                            sourceClass = eClassifier;
                            referenceName = possibleRefName;
                        }
                    });
                }
            });
        }

        if (!sourceClass || !referenceName) {
            console.warn(`Could not parse reference edge ID: ${edgeId}`);
            return;
        }

        console.log(`Removing reference: ${referenceName} from class ${(sourceClass as any).get('name')}`);

        // Remove the reference from the source class
        this.removeReferenceIfExists(sourceClass, referenceName);
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

    private removeReferenceIfExists(eClass: any, referenceName: string): void {
        const eStructuralFeatures = eClass.get('eStructuralFeatures');
        if (!eStructuralFeatures) return;
        
        console.log(`Before removal - eStructuralFeatures size: ${eStructuralFeatures.size()}`);
        
        // Use forEach method on ecore-ts collection
        (eStructuralFeatures as any).forEach((feature: any) => {
            if (feature.get('name') === referenceName) {
                console.log(`Found reference to remove: ${feature.get('name')}`);
                eStructuralFeatures.remove(feature);
                console.log(`After removal - eStructuralFeatures size: ${eStructuralFeatures.size()}`);
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
                console.log(`Removed inheritance: ${sourceClass.get('name')} no longer inherits from ${superTypeName}`);
            }
        });
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

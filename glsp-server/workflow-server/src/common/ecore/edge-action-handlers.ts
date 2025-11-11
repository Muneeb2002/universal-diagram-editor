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
        
        const packagesArray = this.toArray(ePackages);
        for (const ePackage of packagesArray) {
            const eClassifiers = this.getProp<any>(ePackage, 'eClassifiers');
            const classifiersArray = this.toArray(eClassifiers);
            classifiersArray.forEach((eClassifier: any) => {
                const className = this.getProp<string>(eClassifier, 'name');
                // Check if the cleanEdgeId starts with this class name followed by underscore
                if (className && cleanEdgeId.startsWith(className + '_')) {
                    const possibleRefName = cleanEdgeId.substring(className.length + 1);
                    // Check if this reference actually exists in the class
                    const eStructuralFeatures = this.getProp<any>(eClassifier, 'eStructuralFeatures');
                    const featuresArray = this.toArray(eStructuralFeatures);
                    featuresArray.forEach((feature: any) => {
                        if (this.getProp<string>(feature, 'name') === possibleRefName) {
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

        // Remove the reference from the source class
        this.removeReferenceIfExists(sourceClass, referenceName);
    }

    private findEClassByName(ecoreModel: any, className: string): any {
        // Use regular JavaScript object access
        const ePackages = ecoreModel.ePackages;
        
        const packagesArray = this.toArray(ePackages);
        for (const ePackage of packagesArray) {
            const eClassifiers = this.getProp<any>(ePackage, 'eClassifiers');

            let foundClassifier = null;
            this.toArray(eClassifiers).forEach((eClassifier: any) => {
                const classifierName = this.getProp<string>(eClassifier, 'name');
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
        const eStructuralFeatures = this.getProp<any>(eClass, 'eStructuralFeatures');
        if (!eStructuralFeatures) return;
        
        this.removeFromCollection(eStructuralFeatures, (feature: any) => {
            if (this.getProp<string>(feature, 'name') === referenceName) {
                return true;
            }
            return false;
        });
    }

    private removeInheritanceIfExists(sourceClass: any, superTypeName: string): void {
        const superTypes = this.getProp<any>(sourceClass, 'eSuperTypes');
        if (!superTypes) return;
        
        this.removeFromCollection(superTypes, (superType: any) => {
        if (this.getProp<string>(superType, 'name') === superTypeName) {
                return true;
            }
            return false;
        });
    }

    private getProp<T>(obj: any, key: string): T | undefined {
        if (obj == null) {
            return undefined;
        }
        if (typeof obj.get === 'function') {
            return obj.get(key);
        }
        return (obj as Record<string, unknown>)[key] as T | undefined;
    }

    private toArray(collection: any): any[] {
        if (!collection) {
            return [];
        }
        if (Array.isArray(collection)) {
            return collection;
        }
        if (typeof collection.toArray === 'function') {
            return collection.toArray();
        }
        const result: any[] = [];
        if (typeof collection.forEach === 'function') {
            collection.forEach((item: any) => result.push(item));
            return result;
        }
        return result;
    }

    private removeFromCollection(collection: any, predicate: (item: any) => boolean): void {
        if (!collection) {
            return;
        }

        if (typeof collection.remove === 'function') {
            this.toArray(collection).forEach(item => {
                if (predicate(item)) {
                    collection.remove(item);
                }
            });
            return;
        }

        if (Array.isArray(collection)) {
            for (let i = collection.length - 1; i >= 0; i--) {
                if (predicate(collection[i])) {
                    collection.splice(i, 1);
                }
            }
            return;
        }

        if (typeof collection.delete === 'function') {
            const toDelete: any[] = [];
            collection.forEach((item: any) => {
                if (predicate(item)) {
                    toDelete.push(item);
                }
            });
            toDelete.forEach(item => collection.delete(item));
        }
    }
}

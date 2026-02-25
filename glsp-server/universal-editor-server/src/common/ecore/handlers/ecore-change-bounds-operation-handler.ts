/**
 * @author Abigail Sotomayor <s205720@dtu.dk>
 */
import { injectable, inject } from 'inversify';
import { GModelChangeBoundsOperationHandler, ModelState } from '@eclipse-glsp/server';
import { ChangeBoundsOperation } from '@eclipse-glsp/protocol';
import { Command } from '@eclipse-glsp/server';
import { GNode } from '@eclipse-glsp/graph';
import { InstanceModelStorage } from '../instance-model-storage';
import { MetamodelRegistry } from '../metamodel-registry';
import { DiagramPositionStorage } from '../diagram-position-storage';

@injectable()
export class EcoreChangeBoundsOperationHandler extends GModelChangeBoundsOperationHandler {
    @inject(InstanceModelStorage)
    protected instanceStorage: InstanceModelStorage;

    @inject(ModelState)
    protected override modelState: ModelState;

    @inject(MetamodelRegistry)
    protected metamodelRegistry: MetamodelRegistry;

    @inject(DiagramPositionStorage)
    protected diagramPositionStorage: DiagramPositionStorage;

    override handles(operation: any): boolean {
        return operation?.kind === this.operationType;
    }

    override async createCommand(operation: ChangeBoundsOperation): Promise<Command | undefined> {
        const root = this.modelState.root;
        const hasValidRoot = root && root.children !== undefined;
        
        if (hasValidRoot) {
            try {
                const parentCommand = await super.createCommand(operation);
                
                if (parentCommand) {
                    const originalExecute = parentCommand.execute.bind(parentCommand);
                    parentCommand.execute = async () => {
                        const currentRoot = this.modelState.root;
                        if (!currentRoot || currentRoot.children === undefined) {
                            this.updateGModelDirectly(operation);
                            this.updateInstanceModelDirectly(operation);
                            return;
                        }
                        
                        try {
                            await originalExecute();
                            this.updateInstanceModelDirectly(operation);
                        } catch (error: any) {
                            const errorMessage = error?.message || String(error);
                            const errorStack = error?.stack || '';
                            
                            const isRootError = 
                                errorMessage?.includes('children') || 
                                errorMessage?.includes('undefined') || 
                                errorMessage?.includes('Cannot read properties') ||
                                errorStack?.includes('getJsonObject') ||
                                errorStack?.includes('createSchema');
                            
                            if (isRootError) {
                                this.updateGModelDirectly(operation);
                                this.updateInstanceModelDirectly(operation);
                                return;
                            }
                            
                            this.updateInstanceModelDirectly(operation);
                            throw error;
                        }
                    };
                    return parentCommand;
                }
            } catch (error) {
                // Fall through to direct update
            }
        }
        
        this.updateGModelDirectly(operation);
        this.updateInstanceModelDirectly(operation);
        return undefined;
    }

    protected override executeChangeBounds(operation: ChangeBoundsOperation): void {
        try {
            super.executeChangeBounds(operation);
        } catch (error) {
            this.updateGModelDirectly(operation);
        }
    }

    protected updateGModelDirectly(operation: ChangeBoundsOperation): void {
        const index = this.modelState.index;
        if (!index) {
            return;
        }

        for (const element of operation.newBounds) {
            try {
                const node = index.findByClass(element.elementId, GNode);
                if (node) {
                    if (element.newPosition) {
                        node.position = element.newPosition;
                    }
                    if (element.newSize) {
                        node.size = element.newSize;
                    }
                }
            } catch (error) {
                // Ignore individual node update errors
            }
        }
    }

    protected updateInstanceModelDirectly(operation: ChangeBoundsOperation): void {
        const viewMode = this.modelState.get('viewMode') as string;
        
        if (viewMode === 'instance') {
            const index = this.modelState.index;
            
            for (const element of operation.newBounds) {
                const instance = this.instanceStorage.getInstance(element.elementId);
                if (instance) {
                    // Check if this is a nested instance (has a parent container in the GModel)
                    let position = element.newPosition;
                    if (position && index) {
                        const node = index.findByClass(element.elementId, GNode);
                        if (node && node.parent && node.parent.id !== 'sprotty') {
                            const parentNode = node.parent as GNode;
                            if (parentNode.position) {
                                position = {
                                    x: position.x - parentNode.position.x,
                                    y: position.y - parentNode.position.y
                                };
                            }
                        }
                    }
                    
                    if (position) {
                        instance.position = { x: position.x, y: position.y };
                    }
                    if (element.newSize) {
                        instance.size = { width: element.newSize.width, height: element.newSize.height };
                    }
                }
            }
        } else if (viewMode === 'metamodel') {
            for (const element of operation.newBounds) {
                this.diagramPositionStorage.updatePosition(
                    element.elementId,
                    element.newPosition,
                    element.newSize
                );
                
                const ecoreModel = this.modelState.get('ecoreModel') as any;
                if (ecoreModel && ecoreModel.ePackages) {
                    this.updateMetamodelElementPosition(ecoreModel, element);
                }
            }
            
            const activeKey = this.metamodelRegistry.getActiveMetamodelKey();
            if (activeKey) {
                const ecoreModel = this.modelState.get('ecoreModel') as any;
                if (ecoreModel) {
                    this.metamodelRegistry.registerMetamodel(activeKey, ecoreModel);
                }
            }
        }
    }

    protected updateMetamodelElementPosition(ecoreModel: any, element: any): void {
        const elementId = element.elementId;
        
        for (const pkg of ecoreModel.ePackages || []) {
            const classifiers = this.getProp(pkg, 'eClassifiers');
            const classifiersArray = this.toArray(classifiers);
            
            for (const classifier of classifiersArray) {
                const name = this.getProp<string>(classifier, 'name');
                if (name === elementId) {
                    if (element.newPosition) {
                        this.setPosition(classifier, element.newPosition);
                    }
                    if (element.newSize) {
                        this.setSize(classifier, element.newSize);
                    }
                    return;
                }
            }
        }
    }

    protected getProp<T>(obj: any, prop: string): T | undefined {
        if (!obj) return undefined;
        if (typeof obj.get === 'function') {
            try {
                return obj.get(prop) as T;
            } catch {
                return obj[prop] as T;
            }
        }
        return obj[prop] as T;
    }

    protected toArray(collection: any): any[] {
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
            try {
                collection.forEach((item: any) => result.push(item));
            } catch {
                try {
                    return Array.from(collection);
                } catch {
                    return [];
                }
            }
            return result;
        }
        if (typeof collection.length === 'number') {
            try {
                return Array.from(collection);
            } catch {
                return [];
            }
        }
        return [];
    }

    protected setPosition(classifier: any, position: { x: number; y: number }): void {
        classifier.diagramPosition = position;
        if (typeof classifier.set === 'function') {
            try {
                classifier.set('diagramPosition', position);
            } catch {
                // Ignore errors - plain property is already set
            }
        }
    }

    protected setSize(classifier: any, size: { width: number; height: number }): void {
        classifier.diagramSize = size;
        if (typeof classifier.set === 'function') {
            try {
                classifier.set('diagramSize', size);
            } catch {
                // Ignore errors - plain property is already set
            }
        }
    }
}

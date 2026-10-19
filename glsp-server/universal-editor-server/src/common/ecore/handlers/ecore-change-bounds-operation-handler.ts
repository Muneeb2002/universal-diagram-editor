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
        if (operation.newBounds.some(bound => bound.elementId.includes('::component::'))) {
            this.updateInstanceModelDirectly(operation);
            return undefined;
        }

        const constraintsChanged = (this.modelState.get('viewMode') as string) === 'instance'
            ? this.constrainInstanceBounds(operation)
            : false;

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
        
        if (constraintsChanged) {
            // A rejected drag can constrain back to the server's existing bounds. In that case
            // the base handler returns no command, but the client still needs a model submission
            // to replace its optimistic drag position with the authoritative constrained one.
            return this.createDirectUpdateCommand(operation);
        }

        this.updateGModelDirectly(operation);
        this.updateInstanceModelDirectly(operation);
        return undefined;
    }

    private constrainInstanceBounds(operation: ChangeBoundsOperation): boolean {
        let changed = false;
        for (const bound of operation.newBounds) {
            const instance = this.instanceStorage.getInstance(bound.elementId);
            if (!instance) continue;

            const requestedPosition = bound.newPosition ? { ...bound.newPosition } : undefined;
            const requestedSize = bound.newSize ? { ...bound.newSize } : undefined;
            // ChangeBoundsOperation positions use the element's parent coordinate system.
            // Instance positions use the same convention, including for nested elements.
            const storedPosition = bound.newPosition ?? instance.position;
            const constrained = this.instanceStorage.constrainInstanceBounds(
                bound.elementId,
                storedPosition,
                bound.newSize ?? instance.size
            );
            if (constrained.position) {
                bound.newPosition = constrained.position;
            }
            if (constrained.size) {
                bound.newSize = constrained.size;
            }

            changed ||= !!requestedPosition && !!bound.newPosition && (
                requestedPosition.x !== bound.newPosition.x || requestedPosition.y !== bound.newPosition.y
            );
            changed ||= !!requestedSize && (
                requestedSize.width !== bound.newSize.width || requestedSize.height !== bound.newSize.height
            );
        }
        return changed;
    }

    private createDirectUpdateCommand(operation: ChangeBoundsOperation): Command {
        const execute = (): void => {
            this.updateGModelDirectly(operation);
            this.updateInstanceModelDirectly(operation);
        };
        return {
            execute,
            redo: execute,
            undo: () => undefined,
            // This command only synchronizes rejected client feedback with the unchanged
            // authoritative model, so it should not create an undo-stack entry.
            canUndo: () => false
        };
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
            for (const element of operation.newBounds) {
                const instance = this.instanceStorage.getInstance(element.elementId);
                if (instance) {
                    if (element.newPosition) {
                        instance.position = { x: element.newPosition.x, y: element.newPosition.y };
                    }
                    if (element.newSize) {
                        instance.size = { width: element.newSize.width, height: element.newSize.height };
                    }
                } else {
                    const componentMarker = '::component::';
                    const markerIndex = element.elementId.lastIndexOf(componentMarker);
                    if (markerIndex > 0) {
                        const instanceId = element.elementId.substring(0, markerIndex);
                        const componentIndex = element.elementId.substring(markerIndex + componentMarker.length);
                        const parentInstance = this.instanceStorage.getInstance(instanceId);
                        if (parentInstance && element.newPosition && element.newSize) {
                            parentInstance.componentBounds ??= {};
                            parentInstance.componentBounds[componentIndex] = {
                                x: element.newPosition.x,
                                y: element.newPosition.y,
                                width: element.newSize.width,
                                height: element.newSize.height
                            };
                        }
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

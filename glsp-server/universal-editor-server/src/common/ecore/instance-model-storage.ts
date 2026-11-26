/**
 * @author Abigail Sotomayor <s205720@dtu.dk>
 */
import { injectable, inject } from 'inversify';
import { EcoreInstance, InstanceModel, InstanceFactory } from './instance-model-types';
import { MetamodelRegistry } from './metamodel-registry';
import { isEAttribute, isEReference } from './ecore-types';
import { ShapeConfig, ShapeMappingStorage } from './shape-mapping-storage';
import type { CreationContainerPath } from './ecore-actions';
import * as path from 'path';
import * as fs from 'fs';

const BPMN_COMMON_PACKAGE = 'http://www.omg.org/spec/BPMN/20100524/MODEL-XMI/common';

/**
 * Storage and management for Ecore instance models.
 */
@injectable()
export class InstanceModelStorage {
    private instanceModels: Map<string, InstanceModel> = new Map();
    private instanceFactory: InstanceFactory = new InstanceFactory();

    @inject(MetamodelRegistry)
    protected metamodelRegistry: MetamodelRegistry;

    @inject(ShapeMappingStorage)
    protected shapeMappingStorage: ShapeMappingStorage;


    createInstanceModel(metamodelKey: string): InstanceModel {
        if (!this.metamodelRegistry.hasMetamodel(metamodelKey)) {
            throw new Error(`Metamodel with key '${metamodelKey}' not found`);
        }

        const instanceModel: InstanceModel = {
            metamodelKey,
            instances: new Map(),
            rootInstances: new Set()
        };

        this.instanceModels.set(metamodelKey, instanceModel);
        return instanceModel;
    }

    getInstanceModel(metamodelKey: string): InstanceModel | undefined {
        return this.instanceModels.get(metamodelKey);
    }

    getActiveInstanceModel(): InstanceModel | undefined {
        const activeKey = this.metamodelRegistry.getActiveMetamodelKey();
        if (!activeKey) {
            return undefined;
        }
        return this.instanceModels.get(activeKey);
    }

    getOrCreateActiveInstanceModel(): InstanceModel {
        const activeKey = this.metamodelRegistry.getActiveMetamodelKey();
        if (!activeKey) {
            throw new Error('No active metamodel set');
        }

        let instanceModel = this.instanceModels.get(activeKey);
        if (!instanceModel) {
            instanceModel = this.createInstanceModel(activeKey);
        }

        return instanceModel;
    }

    ensureRootContainers(): void {
        const activeKey = this.metamodelRegistry.getActiveMetamodelKey();
        if (!activeKey) {
            return;
        }

        const instanceModel = this.getOrCreateActiveInstanceModel();
        const classes = this.metamodelRegistry.getAllEClasses();

        for (const eClass of classes) {
            const className = eClass.get ? eClass.get('name') : eClass.name;
            if (!className) {
                continue;
            }
            const isAbstract = eClass.get ? eClass.get('abstract') : eClass.abstract;
            const isInterface = eClass.get ? eClass.get('interface') : eClass.interface;
            if (isAbstract || isInterface) {
                continue;
            }
            const incoming = this.findIncomingContainmentRequirements(className);
            if (incoming.length > 0) {
                continue;
            }
            if (this.findRootInstance(className, instanceModel)) {
                continue;
            }

            const hasContainmentRefs = this.hasContainmentReferences(eClass);
            if (!hasContainmentRefs) {
                continue;
            }

            const rootInstance = this.instanceFactory.createInstance(
                className,
                activeKey,
                { x: 0, y: 0 },
                { hidden: true, isRoot: true }
            );
            this.initializeAttributes(rootInstance, eClass);
            rootInstance.size = { width: 0, height: 0 };

            instanceModel.instances.set(rootInstance.id, rootInstance);
            instanceModel.rootInstances.add(rootInstance.id);
        }
    }

    private hasContainmentReferences(eClass: any): boolean {
        const eReferences = eClass.get ? eClass.get('eReferences') : eClass.eReferences;
        if (!eReferences) {
            return false;
        }

        let refs: any[] = [];
        if (Array.isArray(eReferences)) {
            refs = eReferences;
        } else if (eReferences.forEach) {
            eReferences.forEach((ref: any) => refs.push(ref));
        }

        for (const ref of refs) {
            const containment = ref.get ? ref.get('containment') : ref.containment;
            if (containment === true) {
                return true;
            }
        }

        return false;
    }

    createInstance(
        eClassName: string,
        position?: { x: number; y: number },
        opts?: {
            containerInstanceId?: string;
            containmentReferenceName?: string;
            placementReferenceName?: string;
            placementTargetId?: string;
            defaultContainerPath?: CreationContainerPath;
            graphicalClasses?: string[];
        }
    ): EcoreInstance {
        const activeKey = this.metamodelRegistry.getActiveMetamodelKey();
        if (!activeKey) {
            throw new Error('No active metamodel set');
        }

        const eClass = this.metamodelRegistry.findEClass(eClassName);
        if (!eClass) {
            throw new Error(`EClass '${eClassName}' not found in active metamodel`);
        }

        if (eClass.abstract) {
            throw new Error(`Cannot instantiate abstract class '${eClassName}'`);
        }

        this.ensureRootContainers();
        const instanceModel = this.getOrCreateActiveInstanceModel();
        let containerInstanceId = opts?.containerInstanceId;
        let containmentReferenceName = opts?.containmentReferenceName;
        const graphicalClasses = opts?.graphicalClasses ? new Set(opts.graphicalClasses) : undefined;
        if (graphicalClasses && !graphicalClasses.has(eClassName)) {
            throw new Error(`'${eClassName}' is outside the selected graphical model.`);
        }
        const bpmnPlacement = this.getBpmnCreationPlacement(eClassName, containerInstanceId, graphicalClasses);
        const defaultPath = opts?.defaultContainerPath;
        const incomingContainments = this.findIncomingContainmentRequirements(eClassName);
        // A class targeted by a composition belongs to one of those containers even when the
        // container reference itself is optional (lowerBound 0). The lower bound describes how
        // many children the container needs; it does not make a contained child a valid root.
        const mustBeContained = incomingContainments.length > 0;
        const allFeatures = this.collectAllStructuralFeatures(eClass);
        const requiredPlacementRefs = allFeatures.filter(isEReference).filter((ref: any) => {
            const containment = ref.containment ?? ref.get?.('containment') ?? false;
            const lower = ref.lowerBound ?? ref.get?.('lowerBound') ?? 0;
            const upper = ref.upperBound ?? ref.get?.('upperBound') ?? 1;
            return !containment && lower > 0 && upper === 1;
        });
        const hasPlacement = !!opts?.placementReferenceName && !!opts?.placementTargetId;
        if (!!opts?.placementReferenceName !== !!opts?.placementTargetId) {
            throw new Error('Both placementReferenceName and placementTargetId are required for placement.');
        }
        if (requiredPlacementRefs.length === 1 && !hasPlacement) {
            const requiredName = requiredPlacementRefs[0].name || requiredPlacementRefs[0].get?.('name');
            throw new Error(`Creating '${eClassName}' requires selecting a target for '${requiredName}'.`);
        }
        if (!bpmnPlacement && !defaultPath && hasPlacement && !containerInstanceId && !containmentReferenceName && incomingContainments.length > 0) {
            const defaultContainer = this.findDefaultContainer(incomingContainments, instanceModel);
            if (defaultContainer) {
                containerInstanceId = defaultContainer.instance.id;
                containmentReferenceName = defaultContainer.referenceName;
            }
        }
        if (!bpmnPlacement && !defaultPath && mustBeContained && (!containerInstanceId || !containmentReferenceName)) {
            const defaultContainer = this.findDefaultContainer(incomingContainments, instanceModel);
            if (defaultContainer) {
                containerInstanceId = defaultContainer.instance.id;
                containmentReferenceName = defaultContainer.referenceName;
            }
        }
        if (!bpmnPlacement && !defaultPath && mustBeContained && (!containerInstanceId || !containmentReferenceName)) {
            const refs = incomingContainments
                .map(r => `${r.containerClassName}.${r.referenceName}[${r.lowerBound}..${this.boundToString(r.upperBound)}]`)
                .join(', ');
            throw new Error(
                `Instances of '${eClassName}' must be contained. Provide containerInstanceId and containmentReferenceName (one of: ${refs}).`
            );
        }

        const instance = this.instanceFactory.createInstance(eClassName, activeKey, position);

        this.initializeAttributes(instance, eClass);

        instanceModel.instances.set(instance.id, instance);
        const createdContainers: string[] = [];

        try {
            if (bpmnPlacement) {
                this.attachBpmnInstance(instance, bpmnPlacement.parent, instanceModel, createdContainers);
            } else if (defaultPath) {
                if (!containmentReferenceName) {
                    throw new Error('A default container path requires a containment reference.');
                }
                const selectedContainer = containerInstanceId ? this.getInstance(containerInstanceId) : undefined;
                if (containerInstanceId && (!selectedContainer || selectedContainer.hidden)) {
                    throw new Error('Select a visible container on the diagram.');
                }
                const hiddenClasses = [
                    ...(selectedContainer ? [] : [defaultPath.rootClass]),
                    ...defaultPath.steps.map(step => step.className)
                ];
                if (hiddenClasses.some(name => graphicalClasses?.has(name))) {
                    throw new Error('Select the graphical container before creating its child.');
                }
                containerInstanceId = this.prepareDefaultContainer(
                    defaultPath, containmentReferenceName, eClassName, instanceModel, createdContainers, selectedContainer
                ).id;
            }
            if (!bpmnPlacement && containerInstanceId && containmentReferenceName) {
                const containerInstance = this.getInstance(opts?.containerInstanceId ?? containerInstanceId);
                if (containerInstance && !containerInstance.hidden && containerInstance.position) {
                    const existingChildrenCount = this.getDiagramChildren(containerInstance.id).length;

                    instance.position = {
                        x: 10 + (existingChildrenCount % 4) * 120,
                        y: 10 + Math.floor(existingChildrenCount / 4) * 100
                    };
                }

                this.createReference(containerInstanceId, containmentReferenceName, instance.id);
            } else if (!bpmnPlacement) {
                instanceModel.rootInstances.add(instance.id);
            }

            if (hasPlacement) {
                this.createReference(instance.id, opts!.placementReferenceName!, opts!.placementTargetId!);
                const target = this.getInstance(opts!.placementTargetId!);
                if (!target) {
                    throw new Error(`Placement target '${opts!.placementTargetId}' not found.`);
                }
                const sourceConfig = this.shapeMappingStorage.getMapping(eClassName)?.shapeConfig;
                const targetConfig = this.shapeMappingStorage.getMapping(target.eClassName)?.shapeConfig;
                const sourceWidth = instance.size?.width ?? sourceConfig?.width ?? 20;
                const targetWidth = target.size?.width ?? targetConfig?.width ?? 120;
                instance.position = {
                    x: (target.position?.x ?? 0) + targetWidth / 2 - sourceWidth / 2,
                    y: position?.y ?? instance.position?.y ?? (target.position?.y ?? 0)
                };
            }

            if ((bpmnPlacement || defaultPath) && instance.eClassName !== 'SequenceFlow') {
                this.expandDiagramContainersFor(instance);
            }
            const constrained = this.constrainInstanceBounds(instance.id, instance.position, instance.size);
            instance.position = constrained.position;
            instance.size = constrained.size;
        } catch (error) {
            this.deleteInstance(instance.id);
            createdContainers.reverse().forEach(id => this.deleteInstance(id));
            throw error;
        }

        console.log(`Created instance ${instance.id} of class ${eClassName}`);
        return instance;
    }

    private usesBpmnMetamodel(): boolean {
        return !!this.metamodelRegistry.findEPackage(BPMN_COMMON_PACKAGE);
    }

    private getBpmnCreationPlacement(
        className: string, selectedId?: string, graphicalClasses?: ReadonlySet<string>
    ): { parent?: EcoreInstance } | undefined {
        if (!this.usesBpmnMetamodel()) return undefined;
        if (className === 'Participant') {
            if (selectedId) throw new Error('Clear the selected container before creating a pool.');
            return {};
        }

        const isLane = className === 'Lane';
        if (!isLane && className !== 'SequenceFlow' && !this.isSubtypeOf(className, 'FlowNode')) return undefined;
        const parent = selectedId ? this.getInstance(selectedId) : undefined;
        const laneIsHidden = graphicalClasses ? !graphicalClasses.has('Lane') : false;
        const parentClass = isLane || laneIsHidden ? 'Participant' : 'Lane';
        if (!parent || parent.hidden || parent.eClassName !== parentClass) {
            throw new Error(`Select a ${parentClass === 'Participant' ? 'pool' : 'lane'} before creating a ${className}.`);
        }
        if (parentClass === 'Lane' && !this.getBpmnPoolForLane(parent)) {
            throw new Error('The selected lane must belong to a pool before adding flow elements.');
        }
        return { parent };
    }

    private attachBpmnInstance(
        instance: EcoreInstance, parent: EcoreInstance | undefined, model: InstanceModel, created: string[]
    ): void {
        if (!parent) {
            const otherPools = this.getAllInstances().filter(pool =>
                pool.id !== instance.id && pool.eClassName === 'Participant' && !pool.hidden);
            if (otherPools.length) {
                instance.position = {
                    x: instance.position?.x ?? 50,
                    y: Math.max(...otherPools.map(pool =>
                        (pool.position?.y ?? 0) + (pool.size?.height ?? this.getMappedSize(pool).height))) + 35
                };
            }
            const collaboration = this.prepareDefaultContainer({
                rootClass: 'Definitions',
                steps: [{ referenceName: 'rootElements', className: 'Collaboration' }]
            }, 'participants', 'Participant', model, created);
            this.createReference(collaboration.id, 'participants', instance.id);
            this.getOrCreateBpmnPoolProcess(instance, model, created);
            return;
        }

        const siblings = this.getDiagramChildren(parent.id);
        if (instance.eClassName === 'Lane') {
            const laneSet = this.getOrCreateBpmnLaneSet(parent, model, created);
            instance.position = {
                x: 32,
                y: siblings.reduce((bottom, lane) => Math.max(bottom, (lane.position?.y ?? 0) +
                    (lane.size?.height ?? this.getMappedSize(lane).height) + 10), 10)
            };
            this.createReference(laneSet.id, 'lanes', instance.id);
        } else {
            let lane = parent;
            if (parent.eClassName === 'Participant') {
                const laneSet = this.getOrCreateBpmnLaneSet(parent, model, created);
                lane = this.getReferenceTargets(laneSet, 'lanes').find(target => target.hidden)
                    ?? this.createBpmnContainer('Lane', laneSet, 'lanes', model, created);
            }
            const process = this.getBpmnLaneProcess(lane);
            if (!process) throw new Error('The lane must belong to a process.');
            this.createReference(process.id, 'flowElements', instance.id);
            if (instance.eClassName !== 'SequenceFlow') {
                instance.position = {
                    x: 36 + (siblings.length % 4) * 145,
                    y: 20 + Math.floor(siblings.length / 4) * 85
                };
                this.createReference(lane.id, 'flowNodeRefs', instance.id);
            }
        }
    }

    private getOrCreateBpmnLaneSet(pool: EcoreInstance, model: InstanceModel, created: string[]): EcoreInstance {
        const process = this.getOrCreateBpmnPoolProcess(pool, model, created);
        return this.getReferenceTargets(process, 'laneSets').find(target => target.eClassName === 'LaneSet')
            ?? this.createBpmnContainer('LaneSet', process, 'laneSets', model, created);
    }

    private getOrCreateBpmnPoolProcess(pool: EcoreInstance, model: InstanceModel, created: string[]): EcoreInstance {
        const process = this.getReferenceTargets(pool, 'processRef').find(target => target.eClassName === 'Process');
        if (process) return process;
        const collaboration = this.getContainingInstance(pool.id);
        const definitions = collaboration && this.getContainingInstance(collaboration.id);
        if (definitions?.eClassName !== 'Definitions') {
            throw new Error('The pool must belong to a collaboration in Definitions.');
        }
        const createdProcess = this.createBpmnContainer('Process', definitions, 'rootElements', model, created);
        this.createReference(pool.id, 'processRef', createdProcess.id);
        return createdProcess;
    }

    private createBpmnContainer(
        className: string, parent: EcoreInstance, referenceName: string, model: InstanceModel, created: string[]
    ): EcoreInstance {
        const eClass = this.metamodelRegistry.findEClass(className);
        if (!eClass) throw new Error(`The BPMN metamodel is missing '${className}'.`);
        const instance = this.instanceFactory.createInstance(className, model.metamodelKey, { x: 0, y: 0 }, { hidden: true });
        this.initializeAttributes(instance, eClass);
        model.instances.set(instance.id, instance);
        created.push(instance.id);
        this.createReference(parent.id, referenceName, instance.id);
        return instance;
    }

    private getReferenceTargets(instance: EcoreInstance, name: string): EcoreInstance[] {
        const value = instance.references.get(name);
        const ids = Array.isArray(value) ? value : value ? [value] : [];
        return ids.map(id => this.getInstance(id)).filter((target): target is EcoreInstance => !!target);
    }

    private getBpmnLaneProcess(lane: EcoreInstance): EcoreInstance | undefined {
        const laneSet = this.getContainingInstance(lane.id);
        const process = laneSet?.eClassName === 'LaneSet' ? this.getContainingInstance(laneSet.id) : undefined;
        return process?.eClassName === 'Process' ? process : undefined;
    }

    private getBpmnPoolForLane(lane: EcoreInstance): EcoreInstance | undefined {
        const process = this.getBpmnLaneProcess(lane);
        return process && this.getAllInstances().find(candidate =>
            candidate.eClassName === 'Participant' && !candidate.hidden && candidate.references.get('processRef') === process.id
        );
    }

    private getBpmnDiagramChildren(instance: EcoreInstance): EcoreInstance[] {
        if (instance.eClassName === 'Participant') {
            return this.getReferenceTargets(instance, 'processRef')
                .flatMap(process => this.getReferenceTargets(process, 'laneSets'))
                .flatMap(laneSet => this.getReferenceTargets(laneSet, 'lanes'))
                .flatMap(lane => lane.hidden ? this.getBpmnDiagramChildren(lane) : [lane]);
        }
        return instance.eClassName === 'Lane' ? this.getReferenceTargets(instance, 'flowNodeRefs').filter(node => !node.hidden) : [];
    }

    private prepareDefaultContainer(
        path: CreationContainerPath,
        finalReference: string,
        targetClass: string,
        model: InstanceModel,
        created: string[],
        selectedContainer?: EcoreInstance
    ): EcoreInstance {
        if (typeof path.rootClass !== 'string' || !Array.isArray(path.steps) || path.steps.some(step =>
            !step || typeof step.referenceName !== 'string' || typeof step.className !== 'string')) {
            throw new Error('Invalid default container path.');
        }

        const classNames = [path.rootClass, ...path.steps.map(step => step.className)];
        if (selectedContainer && selectedContainer.eClassName !== path.rootClass) {
            throw new Error('The containment path must start at the selected container.');
        }
        if (new Set(classNames).size !== classNames.length) {
            throw new Error('A default container path cannot repeat a class.');
        }
        const classes = classNames.map(className => {
            const cls = this.metamodelRegistry.findEClass(className);
            if (!cls || (cls.get?.('abstract') ?? cls.abstract) || (cls.get?.('interface') ?? cls.interface)) {
                throw new Error(`Cannot create default container '${className}'.`);
            }
            return cls;
        });
        const links = [...path.steps, { referenceName: finalReference, className: targetClass }];
        links.forEach(({ referenceName, className }, index) => {
            const ref = this.collectAllStructuralFeatures(classes[index]).filter(isEReference).reverse()
                .find(feature => (feature.get?.('name') ?? feature.name) === referenceName);
            const type = ref?.get?.('eType') ?? ref?.eType;
            const typeName = type?.get?.('name') ?? type?.name;
            if (!(ref?.get?.('containment') ?? ref?.containment) ||
                (ref?.get?.('upperBound') ?? ref?.upperBound) === 0 ||
                !typeName || !this.isSubtypeOf(className, typeName)) {
                throw new Error(`'${classNames[index]}.${referenceName}' cannot contain '${className}'.`);
            }
        });

        const makeContainer = (index: number, isRoot: boolean): EcoreInstance => {
            const container = this.instanceFactory.createInstance(classNames[index], model.metamodelKey, { x: 0, y: 0 }, { hidden: true, isRoot });
            this.initializeAttributes(container, classes[index]);
            model.instances.set(container.id, container);
            created.push(container.id);
            if (isRoot) model.rootInstances.add(container.id);
            return container;
        };
        let container = selectedContainer ?? [...model.rootInstances].map(id => model.instances.get(id))
            .find(instance => instance?.hidden && instance.eClassName === path.rootClass) ?? makeContainer(0, true);

        path.steps.forEach((step, index) => {
            const value = container.references.get(step.referenceName);
            const ids = Array.isArray(value) ? value : value ? [value] : [];
            let child = ids.map(id => model.instances.get(id))
                .find(instance => instance?.hidden && instance.eClassName === step.className);
            if (!child) {
                child = makeContainer(index + 1, false);
                this.createReference(container.id, step.referenceName, child.id);
            }
            container = child;
        });
        return container;
    }

    constrainInstanceBounds(
        instanceId: string,
        proposedPosition?: { x: number; y: number },
        proposedSize?: { width: number; height: number }
    ): { position?: { x: number; y: number }; size?: { width: number; height: number } } {
        const instance = this.getInstance(instanceId);
        if (!instance) return { position: proposedPosition, size: proposedSize };

        const defaultSize = this.getMappedSize(instance);
        const size = {
            width: Math.max(1, proposedSize?.width ?? instance.size?.width ?? defaultSize.width),
            height: Math.max(1, proposedSize?.height ?? instance.size?.height ?? defaultSize.height)
        };
        let position = proposedPosition
            ? { ...proposedPosition }
            : instance.position
                ? { ...instance.position }
                : { x: 0, y: 0 };

        const placement = this.getSingleRequiredPlacement(instance);
        if (placement) {
            position = this.constrainToPlacementTarget(position, size, placement.target);
        }

        const container = this.getDiagramParent(instanceId);
        if (container) {
            const containerSize = this.getMappedSize(container);
            const width = container.size?.width ?? containerSize.width;
            const height = container.size?.height ?? containerSize.height;
            size.width = Math.min(size.width, width);
            size.height = Math.min(size.height, height);
            // Child coordinates are local to their visible container. For a composite with a
            // line (for example a lifeline), use that line as the placement path. Other shapes
            // fall back to their rectangular bounds.
            position = this.constrainToPlacementTarget(position, size, container, { x: 0, y: 0 });
        }

        const children = this.getDiagramChildren(instanceId);
        for (const child of children) {
            const childSize = this.getMappedSize(child);
            const width = child.size?.width ?? childSize.width;
            const height = child.size?.height ?? childSize.height;
            size.width = Math.max(size.width, (child.position?.x ?? 0) + width);
            size.height = Math.max(size.height, (child.position?.y ?? 0) + height);
        }

        return { position, size };
    }

    getContainingInstance(childInstanceId: string): EcoreInstance | undefined {
        for (const candidate of this.getAllInstances()) {
            const eClass = this.metamodelRegistry.findEClass(candidate.eClassName);
            if (!eClass) continue;
            for (const ref of this.collectAllStructuralFeatures(eClass).filter(isEReference)) {
                const containment = ref.containment ?? ref.get?.('containment') ?? false;
                if (!containment) continue;
                const name = ref.name || ref.get?.('name');
                const value = candidate.references.get(name);
                if (value === childInstanceId || (Array.isArray(value) && value.includes(childInstanceId))) {
                    return candidate;
                }
            }
        }
        return undefined;
    }

    getDiagramParent(instanceId: string): EcoreInstance | undefined {
        const instance = this.getInstance(instanceId);
        if (instance && this.usesBpmnMetamodel()) {
            if (instance.eClassName === 'Lane') {
                return this.getBpmnPoolForLane(instance);
            }
            if (this.isSubtypeOf(instance.eClassName, 'FlowNode')) {
                const process = this.getContainingInstance(instanceId);
                const lane = process && this.getAllInstances().find(candidate => candidate.eClassName === 'Lane' &&
                    this.getReferenceTargets(candidate, 'flowNodeRefs').some(node => node.id === instanceId) &&
                    this.getBpmnLaneProcess(candidate)?.id === process.id);
                if (lane) return lane.hidden ? this.getBpmnPoolForLane(lane) : lane;
            }
        }
        const visited = new Set([instanceId]);
        let parent = this.getContainingInstance(instanceId);
        while (parent?.hidden && !visited.has(parent.id)) {
            visited.add(parent.id);
            parent = this.getContainingInstance(parent.id);
        }
        return parent && !visited.has(parent.id) ? parent : undefined;
    }

    getDiagramChildren(containerId: string): EcoreInstance[] {
        const container = this.getInstance(containerId);
        if (!container) return [];
        const projected = this.usesBpmnMetamodel() ? this.getBpmnDiagramChildren(container) : [];
        const visited = new Set([containerId]);
        const visible: EcoreInstance[] = [];
        const visit = (parent: EcoreInstance): void => {
            for (const child of this.getContainedInstances(parent.id)) {
                if (visited.has(child.id)) continue;
                visited.add(child.id);
                if (child.hidden) visit(child);
                else visible.push(child);
            }
        };
        visit(container);
        return [...new Map([...visible, ...projected]
            .filter(child => this.getDiagramParent(child.id)?.id === containerId)
            .map(child => [child.id, child] as const)).values()];
    }

    private expandDiagramContainersFor(instance: EcoreInstance): void {
        const visited = new Set([instance.id]);
        let child = instance;
        let parent = this.getDiagramParent(child.id);
        while (parent && !visited.has(parent.id)) {
            visited.add(parent.id);
            const childSize = child.size ?? this.getMappedSize(child);
            const parentSize = parent.size ?? this.getMappedSize(parent);
            parent.size = {
                width: Math.max(parentSize.width, (child.position?.x ?? 0) + childSize.width),
                height: Math.max(parentSize.height, (child.position?.y ?? 0) + childSize.height)
            };
            child = parent;
            parent = this.getDiagramParent(child.id);
        }
    }

    hasBpmnChildren(instanceId: string): boolean {
        const instance = this.getInstance(instanceId);
        if (!instance || !this.usesBpmnMetamodel()) return false;
        return this.getBpmnDiagramChildren(instance).length > 0;
    }

    private getContainedInstances(containerInstanceId: string): EcoreInstance[] {
        const container = this.getInstance(containerInstanceId);
        if (!container) return [];
        const eClass = this.metamodelRegistry.findEClass(container.eClassName);
        if (!eClass) return [];
        const ids = new Set<string>();
        for (const ref of this.collectAllStructuralFeatures(eClass).filter(isEReference)) {
            const containment = ref.containment ?? ref.get?.('containment') ?? false;
            if (!containment) continue;
            const name = ref.name || ref.get?.('name');
            const value = container.references.get(name);
            if (typeof value === 'string') ids.add(value);
            else if (Array.isArray(value)) value.forEach(id => ids.add(id));
        }
        return [...ids].map(id => this.getInstance(id)).filter((child): child is EcoreInstance => !!child);
    }

    private getMappedSize(instance: EcoreInstance): { width: number; height: number } {
        const config = this.shapeMappingStorage.getMapping(instance.eClassName)?.shapeConfig;
        return {
            width: Math.max(1, config?.width ?? 120),
            height: Math.max(1, config?.height ?? 60)
        };
    }

    private getSingleRequiredPlacement(instance: EcoreInstance): { target: EcoreInstance } | undefined {
        const eClass = this.metamodelRegistry.findEClass(instance.eClassName);
        if (!eClass) return undefined;
        const refs = this.collectAllStructuralFeatures(eClass).filter(isEReference).filter((ref: any) => {
            const containment = ref.containment ?? ref.get?.('containment') ?? false;
            const lower = ref.lowerBound ?? ref.get?.('lowerBound') ?? 0;
            const upper = ref.upperBound ?? ref.get?.('upperBound') ?? 1;
            return !containment && lower > 0 && upper === 1;
        });
        if (refs.length !== 1) return undefined;
        const name = refs[0].name || refs[0].get?.('name');
        const targetId = instance.references.get(name);
        if (typeof targetId !== 'string') return undefined;
        const target = this.getInstance(targetId);
        return target ? { target } : undefined;
    }

    private constrainToPlacementTarget(
        position: { x: number; y: number },
        size: { width: number; height: number },
        target: EcoreInstance,
        targetOrigin: { x: number; y: number } = target.position ?? { x: 0, y: 0 }
    ): { x: number; y: number } {
        const mapping = this.shapeMappingStorage.getMapping(target.eClassName)?.shapeConfig;
        const targetDefaultSize = this.getMappedSize(target);
        const targetWidth = target.size?.width ?? targetDefaultSize.width;
        const targetHeight = target.size?.height ?? targetDefaultSize.height;
        const targets: Array<ShapeConfig & { x: number; y: number; rotation?: number }> = [];

        if (mapping?.type === 'composite') {
            mapping.components?.forEach((component, index) => {
                const configured = {
                    ...component,
                    ...(target.componentBounds?.[String(index)] ?? {})
                };
                if (this.getEffectiveChildBinding(configured, true) !== 'none') {
                    targets.push(configured);
                }
            });
        } else if (mapping) {
            if (this.getEffectiveChildBinding(mapping, false) !== 'none') {
                targets.push({ ...mapping, x: 0, y: 0, width: targetWidth, height: targetHeight, rotation: 0 });
            }
        } else {
            // Unmapped containers retain the historical rectangular containment behavior.
            targets.push({
                type: 'rectangle', x: 0, y: 0, width: targetWidth, height: targetHeight,
                childBinding: 'inside', color: '', fillColor: '', lineThickness: 1, lineStyle: 'solid'
            });
        }

        const candidates: Array<{ x: number; y: number }> = [];
        for (const bindingTarget of targets) {
            const mode = this.getEffectiveChildBinding(bindingTarget, mapping?.type === 'composite');
            if (mode === 'inside' || mode === 'both') {
                candidates.push(this.constrainInsideShape(position, size, bindingTarget, targetOrigin));
            }
            if (mode === 'on' || mode === 'both') {
                candidates.push(this.constrainOnShape(position, size, bindingTarget, targetOrigin));
            }
        }

        return candidates.reduce((closest, candidate) =>
            this.distanceSquared(candidate, position) < this.distanceSquared(closest, position) ? candidate : closest,
            candidates[0] ?? position
        );
    }

    private getEffectiveChildBinding(config: Pick<ShapeConfig, 'type' | 'childBinding'>, isSubcomponent: boolean): 'none' | 'inside' | 'on' | 'both' {
        if (config.type === 'line') {
            return config.childBinding === 'none' ? 'none' : 'on';
        }
        if (config.childBinding === 'none' || config.childBinding === 'inside' ||
            config.childBinding === 'on' || config.childBinding === 'both') {
            return config.childBinding;
        }
        return isSubcomponent ? 'none' : 'inside';
    }

    private constrainInsideShape(
        position: { x: number; y: number },
        size: { width: number; height: number },
        shape: ShapeConfig & { x: number; y: number; rotation?: number },
        origin: { x: number; y: number }
    ): { x: number; y: number } {
        const center = this.shapeCenter(shape, origin);
        const proposedCenter = { x: position.x + size.width / 2, y: position.y + size.height / 2 };
        const local = this.rotatePoint(proposedCenter, center, -(shape.rotation ?? 0));

        if (shape.type === 'circle') {
            const radius = Math.max(0.5, Math.min(shape.width, shape.height) / 2 - (Math.min(shape.width, shape.height) < 30 ? 0 : 10));
            const allowedRadius = Math.max(0, radius - Math.max(size.width, size.height) / 2);
            const dx = local.x - center.x;
            const dy = local.y - center.y;
            const length = Math.hypot(dx, dy);
            const bounded = length > allowedRadius && length > 0
                ? { x: center.x + dx / length * allowedRadius, y: center.y + dy / length * allowedRadius }
                : local;
            const world = this.rotatePoint(bounded, center, shape.rotation ?? 0);
            return { x: world.x - size.width / 2, y: world.y - size.height / 2 };
        }

        const halfWidth = Math.max(0, shape.width / 2 - size.width / 2);
        const halfHeight = Math.max(0, shape.height / 2 - size.height / 2);
        const bounded = {
            x: Math.min(Math.max(local.x, center.x - halfWidth), center.x + halfWidth),
            y: Math.min(Math.max(local.y, center.y - halfHeight), center.y + halfHeight)
        };
        const world = this.rotatePoint(bounded, center, shape.rotation ?? 0);
        return { x: world.x - size.width / 2, y: world.y - size.height / 2 };
    }

    private constrainOnShape(
        position: { x: number; y: number },
        size: { width: number; height: number },
        shape: ShapeConfig & { x: number; y: number; rotation?: number },
        origin: { x: number; y: number }
    ): { x: number; y: number } {
        const center = this.shapeCenter(shape, origin);
        const proposedCenter = { x: position.x + size.width / 2, y: position.y + size.height / 2 };
        const local = this.rotatePoint(proposedCenter, center, -(shape.rotation ?? 0));
        let edgePoint: { x: number; y: number };

        if (shape.type === 'line') {
            edgePoint = {
                x: Math.min(Math.max(local.x, center.x - shape.width / 2), center.x + shape.width / 2),
                y: center.y
            };
        } else if (shape.type === 'circle') {
            const radius = Math.max(0.5, Math.min(shape.width, shape.height) / 2 - (Math.min(shape.width, shape.height) < 30 ? 0 : 10));
            const dx = local.x - center.x;
            const dy = local.y - center.y;
            const length = Math.hypot(dx, dy);
            edgePoint = length > 0
                ? { x: center.x + dx / length * radius, y: center.y + dy / length * radius }
                : { x: center.x + radius, y: center.y };
        } else {
            const halfWidth = shape.width / 2;
            const halfHeight = shape.height / 2;
            const boundedX = Math.min(Math.max(local.x, center.x - halfWidth), center.x + halfWidth);
            const boundedY = Math.min(Math.max(local.y, center.y - halfHeight), center.y + halfHeight);
            const distances = [
                { distance: Math.abs(local.x - (center.x - halfWidth)), point: { x: center.x - halfWidth, y: boundedY } },
                { distance: Math.abs(local.x - (center.x + halfWidth)), point: { x: center.x + halfWidth, y: boundedY } },
                { distance: Math.abs(local.y - (center.y - halfHeight)), point: { x: boundedX, y: center.y - halfHeight } },
                { distance: Math.abs(local.y - (center.y + halfHeight)), point: { x: boundedX, y: center.y + halfHeight } }
            ];
            edgePoint = distances.reduce((closest, candidate) => candidate.distance < closest.distance ? candidate : closest).point;
        }

        const world = this.rotatePoint(edgePoint, center, shape.rotation ?? 0);
        return { x: world.x - size.width / 2, y: world.y - size.height / 2 };
    }

    private shapeCenter(
        shape: { x: number; y: number; width: number; height: number },
        origin: { x: number; y: number }
    ): { x: number; y: number } {
        return { x: origin.x + shape.x + shape.width / 2, y: origin.y + shape.y + shape.height / 2 };
    }

    private rotatePoint(point: { x: number; y: number }, center: { x: number; y: number }, degrees: number): { x: number; y: number } {
        if (degrees === 0) return point;
        const radians = degrees * Math.PI / 180;
        const cos = Math.cos(radians);
        const sin = Math.sin(radians);
        const dx = point.x - center.x;
        const dy = point.y - center.y;
        return { x: center.x + dx * cos - dy * sin, y: center.y + dx * sin + dy * cos };
    }

    private distanceSquared(a: { x: number; y: number }, b: { x: number; y: number }): number {
        return (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
    }

    private boundToString(ub: number | undefined): string {
        if (ub === undefined) return '1';
        return ub === -1 ? '*' : String(ub);
    }

    private findDefaultContainer(
        requirements: Array<{ containerClassName: string; referenceName: string; lowerBound: number; upperBound: number }>,
        instanceModel: InstanceModel
    ): { instance: EcoreInstance; referenceName: string } | undefined {
        for (const requirement of requirements) {
            const existing = this.findInstanceByClass(requirement.containerClassName, instanceModel);
            if (existing) {
                return { instance: existing, referenceName: requirement.referenceName };
            }

            const rootInstance = this.findRootInstance(requirement.containerClassName, instanceModel);
            if (rootInstance) {
                return { instance: rootInstance, referenceName: requirement.referenceName };
            }
        }
        return undefined;
    }

    private findIncomingContainmentRequirements(targetClassName: string): Array<{
        containerClassName: string;
        referenceName: string;
        lowerBound: number;
        upperBound: number;
    }> {
        const activeMetamodel = this.metamodelRegistry.getActiveMetamodel();
        const results: Array<{ containerClassName: string; referenceName: string; lowerBound: number; upperBound: number }> = [];
        if (!activeMetamodel) return results;

        for (const pkg of activeMetamodel.ePackages ?? []) {
            const classifiers = (pkg as any).eClassifiers ?? (pkg as any).get?.('eClassifiers');
            let classifierArray: any[] = [];
            if (Array.isArray(classifiers)) classifierArray = classifiers;
            else if (classifiers?.forEach) classifiers.forEach((c: any) => classifierArray.push(c));

            for (const cls of classifierArray) {
                if (!cls) continue;
                const isClass = typeof (cls as any).get === 'function'
                    ? (cls as any).eClass?.values?.name === 'EClass' || true
                    : true;
                if (!isClass) continue;

                const className = (cls as any).name || (cls as any).get?.('name');
                const features = (cls as any).eStructuralFeatures || (cls as any).get?.('eStructuralFeatures') || [];
                let featureArray: any[] = [];
                if (Array.isArray(features)) featureArray = features;
                else if (features?.forEach) features.forEach((f: any) => featureArray.push(f));

                for (const ref of featureArray.filter(isEReference)) {
                    const containment = ref.containment ?? ref.get?.('containment');
                    const eType = ref.eType || ref.get?.('eType');
                    const typeName = eType?.name || eType?.get?.('name');
                    const matchesType =
                        containment &&
                        typeName &&
                        (typeName === targetClassName || this.isSubtypeOf(targetClassName, typeName));
                    if (matchesType) {
                        results.push({
                            containerClassName: className,
                            referenceName: ref.name || ref.get?.('name'),
                            lowerBound: ref.lowerBound ?? ref.get?.('lowerBound') ?? 0,
                            upperBound: ref.upperBound ?? ref.get?.('upperBound') ?? -1
                        });
                    }
                }
            }
        }
        return results;
    }

    private countRefValue(value: string | string[] | undefined): number {
        if (!value) return 0;
        if (Array.isArray(value)) return value.length;
        return value ? 1 : 0;
    }

    private initializeAttributes(instance: EcoreInstance, eClass: any): void {
        let structuralFeatures: any[] = [];
        
        if (eClass.eStructuralFeatures) {
            if (Array.isArray(eClass.eStructuralFeatures)) {
                structuralFeatures = eClass.eStructuralFeatures;
            } else if (typeof eClass.eStructuralFeatures.forEach === 'function') {
                eClass.eStructuralFeatures.forEach((feature: any) => {
                    if (feature) structuralFeatures.push(feature);
                });
            } else if (eClass.eStructuralFeatures.size && typeof eClass.eStructuralFeatures.size === 'function') {
                for (let i = 0; i < eClass.eStructuralFeatures.size(); i++) {
                    const feature = eClass.eStructuralFeatures.get(i);
                    if (feature) structuralFeatures.push(feature);
                }
            }
        }

        console.log(`Initializing attributes for ${instance.eClassName}, found ${structuralFeatures.length} structural features`);

        const attributes = structuralFeatures.filter(isEAttribute);
        for (const attr of attributes) {
            let defaultValue: any = null;

            const eType = attr.eType || attr.get?.('eType');
            const typeName = eType?.name || eType?.get?.('name') || 'EString';
            const lowerTypeName = typeName.toLowerCase();
            
            if (lowerTypeName.includes('string')) {
                defaultValue = '';
            } else if (lowerTypeName.includes('int') || lowerTypeName.includes('long')) {
                defaultValue = 0;
            } else if (lowerTypeName.includes('boolean')) {
                defaultValue = false;
            } else if (lowerTypeName.includes('double') || lowerTypeName.includes('float')) {
                defaultValue = 0.0;
            }

            const attrName = attr.name || attr.get?.('name');
            if (attrName) {
                instance.attributes.set(attrName, defaultValue);
                console.log(`Set default value for attribute ${attrName}: ${defaultValue}`);
            }
        }

        const references = structuralFeatures.filter(isEReference);
        for (const ref of references) {
            const refName = ref.name || ref.get?.('name');
            const upperBound = ref.upperBound || ref.get?.('upperBound') || 1;
            
            if (refName) {
                if (upperBound === 1) {
                    instance.references.set(refName, '');
                } else {
                    instance.references.set(refName, []);
                }
                console.log(`Initialized reference ${refName} with upperBound ${upperBound}`);
            }
        }
    }

    getInstance(instanceId: string): EcoreInstance | undefined {
        const instanceModel = this.getActiveInstanceModel();
        if (!instanceModel) {
            return undefined;
        }
        return instanceModel.instances.get(instanceId);
    }

    private findInstanceByClass(className: string, instanceModel: InstanceModel): EcoreInstance | undefined {
        for (const instance of instanceModel.instances.values()) {
            if (instance.eClassName === className && !instance.hidden) {
                return instance;
            }
        }
        return undefined;
    }

    private findRootInstance(className: string, instanceModel: InstanceModel): EcoreInstance | undefined {
        for (const instance of instanceModel.instances.values()) {
            if (instance.eClassName === className && instance.isRoot) {
                return instance;
            }
        }
        return undefined;
    }

    private collectAllStructuralFeatures(eClass: any, visited: Set<string> = new Set()): any[] {
        if (!eClass) {
            return [];
        }

        const className = eClass.get ? eClass.get('name') : eClass.name;
        if (!className || visited.has(className)) {
            return [];
        }
        visited.add(className);

        const allFeatures: any[] = [];

        const eSuperTypes = eClass.get ? eClass.get('eSuperTypes') : eClass.eSuperTypes;
        if (eSuperTypes) {
            let superTypes: any[] = [];
            if (Array.isArray(eSuperTypes)) {
                superTypes = eSuperTypes;
            } else if (eSuperTypes.forEach) {
                eSuperTypes.forEach((st: any) => superTypes.push(st));
            }

            for (const superType of superTypes) {
                const superTypeName = superType.get ? superType.get('name') : superType.name;
                if (superTypeName) {
                    const superEClass = this.metamodelRegistry.findEClass(superTypeName);
                    if (superEClass) {
                        const inheritedFeatures = this.collectAllStructuralFeatures(superEClass, visited);
                        allFeatures.push(...inheritedFeatures);
                    }
                }
            }
        }

        let structuralFeatures: any[] = [];
        if (eClass.eStructuralFeatures) {
            if (Array.isArray(eClass.eStructuralFeatures)) {
                structuralFeatures = eClass.eStructuralFeatures;
            } else if (typeof eClass.eStructuralFeatures.forEach === 'function') {
                eClass.eStructuralFeatures.forEach((feature: any) => {
                    structuralFeatures.push(feature);
                });
            } else if (eClass.eStructuralFeatures.size && typeof eClass.eStructuralFeatures.size === 'function') {
                for (let i = 0; i < eClass.eStructuralFeatures.size(); i++) {
                    const feature = eClass.eStructuralFeatures.get(i);
                    if (feature) structuralFeatures.push(feature);
                }
            }
        } else if (eClass.get && typeof eClass.get === 'function') {
            const features = eClass.get('eStructuralFeatures');
            if (features) {
                if (Array.isArray(features)) {
                    structuralFeatures = features;
                } else if (typeof features.forEach === 'function') {
                    features.forEach((feature: any) => {
                        structuralFeatures.push(feature);
                    });
                }
            }
        }

        allFeatures.push(...structuralFeatures);
        return allFeatures;
    }

    setAttributeValue(instanceId: string, attributeName: string, value: any): void {
        const instance = this.getInstance(instanceId);
        if (!instance) {
            throw new Error(`Instance '${instanceId}' not found`);
        }

        const eClass = this.metamodelRegistry.findEClass(instance.eClassName);
        if (!eClass) {
            throw new Error(`EClass '${instance.eClassName}' not found in metamodel`);
        }

        const allStructuralFeatures = this.collectAllStructuralFeatures(eClass);

        const attributes = allStructuralFeatures.filter(isEAttribute);
        const attr = attributes.find((a: any) => {
            const attrName = a.name || a.get?.('name');
            return attrName === attributeName;
        });
        if (!attr) {
            throw new Error(`Attribute '${attributeName}' not found in class '${instance.eClassName}' (including inherited attributes)`);
        }

        if (value === null || value === undefined) {
            instance.attributes.delete(attributeName);
            console.log(`Cleared attribute ${attributeName} on instance ${instanceId} to use base mapping`);
        } else {
            instance.attributes.set(attributeName, value);
            console.log(`Set attribute ${attributeName} = ${value} on instance ${instanceId}`);
        }
        
        const verifyValue = instance.attributes.get(attributeName);
        console.log(`[InstanceStorage] Verified attribute ${attributeName} on instance ${instanceId}:`, verifyValue);
        console.log(`[InstanceStorage] All attributes for instance ${instanceId}:`, Array.from(instance.attributes.entries()));
    }

    createReference(sourceInstanceId: string, referenceName: string, targetInstanceId: string): void {
        const sourceInstance = this.getInstance(sourceInstanceId);
        if (!sourceInstance) {
            throw new Error(`Source instance '${sourceInstanceId}' not found`);
        }

        const targetInstance = this.getInstance(targetInstanceId);
        if (!targetInstance) {
            throw new Error(`Target instance '${targetInstanceId}' not found`);
        }

        const eClass = this.metamodelRegistry.findEClass(sourceInstance.eClassName);
        if (!eClass) {
            throw new Error(`EClass '${sourceInstance.eClassName}' not found in metamodel`);
        }

        const references = this.collectAllStructuralFeatures(eClass).filter(isEReference).reverse();
        
        console.log(`Found ${references.length} references in class '${sourceInstance.eClassName}':`, references.map(r => {
            const name = r.get ? r.get('name') : r.name;
            return name;
        }));
        const ref = references.find((r: any) => {
            const name = r.get ? r.get('name') : r.name;
            return name === referenceName;
        });
        if (!ref) {
            const availableRefs = references.map(r => {
                const name = r.get ? r.get('name') : r.name;
                return name;
            });
            console.error(`Reference '${referenceName}' not found in class '${sourceInstance.eClassName}'. Available references:`, availableRefs);
            throw new Error(`Reference '${referenceName}' not found in class '${sourceInstance.eClassName}'. Available references: ${availableRefs.join(', ')}`);
        }

        const refEType = ref.get ? ref.get('eType') : ref.eType;
        const refTypeName = refEType ? (refEType.get ? refEType.get('name') : refEType.name) : null;
        if (refTypeName && refTypeName !== targetInstance.eClassName) {
            if (!this.isSubtypeOf(targetInstance.eClassName, refTypeName)) {
                throw new Error(
                    `Type mismatch: reference '${referenceName}' expects type '${refTypeName}' but got '${targetInstance.eClassName}'`
                );
            }
        }

        const lower = ref.get ? (ref.get('lowerBound') ?? 0) : (ref.lowerBound ?? 0);
        const upper = ref.get ? (ref.get('upperBound') ?? 1) : (ref.upperBound ?? 1);
        const currentValue = sourceInstance.references.get(referenceName);
        const currentCount = this.countRefValue(currentValue);

        if (upper === 1) {
            if (currentCount === 1) {
                throw new Error(`Reference '${referenceName}' on '${sourceInstance.eClassName}' already has a target (upperBound=1).`);
            }
            sourceInstance.references.set(referenceName, targetInstanceId);
        } else {
            if (upper !== -1 && currentCount >= upper) {
                throw new Error(`Reference '${referenceName}' exceeds upperBound (${upper}).`);
            }
            if (Array.isArray(currentValue)) {
                currentValue.push(targetInstanceId);
            } else {
                sourceInstance.references.set(referenceName, [targetInstanceId]);
            }
        }

        if (ref.containment) {
            const instanceModel = this.getActiveInstanceModel();
            if (instanceModel) {
                instanceModel.rootInstances.delete(targetInstanceId);
            }
        }

        const opposite = ref.eOpposite || ref.get?.('eOpposite');
        if (opposite) {
            const oppositeName = opposite.name || opposite.get?.('name');
            if (oppositeName) {
                const targetEClass = this.metamodelRegistry.findEClass(targetInstance.eClassName);
                const targetRefs = targetEClass ? this.collectAllStructuralFeatures(targetEClass).filter(isEReference).reverse() : [];
                const targetOppRef = targetRefs.find((r: any) => (r.name || r.get?.('name')) === oppositeName);
                if (targetOppRef) {
                    const tUpper = targetOppRef.upperBound ?? targetOppRef.get?.('upperBound') ?? 1;
                    const targetCurrent = targetInstance.references.get(oppositeName);
                    const targetCount = this.countRefValue(targetCurrent);
                    if (tUpper === 1 && targetCount === 1) {
                        throw new Error(`Opposite reference '${oppositeName}' on '${targetInstance.eClassName}' already has a target (upperBound=1).`);
                    }
                    if (tUpper !== -1 && targetCount >= tUpper) {
                        throw new Error(`Opposite reference '${oppositeName}' exceeds upperBound (${tUpper}).`);
                    }
                    if (tUpper === 1) {
                        targetInstance.references.set(oppositeName, sourceInstanceId);
                    } else {
                        if (Array.isArray(targetCurrent)) {
                            targetCurrent.push(sourceInstanceId);
                        } else {
                            targetInstance.references.set(oppositeName, [sourceInstanceId]);
                        }
                    }
                }
            }
        }

        console.log(`Created reference ${referenceName} from ${sourceInstanceId} to ${targetInstanceId}`);

        if (lower === 1 && upper === 1) {
            const afterCount = this.countRefValue(sourceInstance.references.get(referenceName));
            if (afterCount !== 1) {
                throw new Error(`Reference '${referenceName}' must have exactly one target ([1..1]).`);
            }
        }
    }

    validateActiveModel(): string[] {
        const errors: string[] = [];
        const model = this.getActiveInstanceModel();
        if (!model) return errors;

        for (const inst of model.instances.values()) {
            const eClass = this.metamodelRegistry.findEClass(inst.eClassName);
            if (!eClass) continue;
            const refs = (eClass.eStructuralFeatures || []).filter(isEReference);
            for (const ref of refs) {
                const name = ref.name || ref.get?.('name');
                const lower = ref.lowerBound ?? ref.get?.('lowerBound') ?? 0;
                const upper = ref.upperBound ?? ref.get?.('upperBound') ?? 1;
                const cnt = this.countRefValue(inst.references.get(name));
                if (lower > 0 && cnt < lower) {
                    errors.push(`Instance ${inst.id} (${inst.eClassName}) violates lowerBound ${lower} on reference '${name}'.`);
                }
                if (upper !== -1 && cnt > upper) {
                    errors.push(`Instance ${inst.id} (${inst.eClassName}) exceeds upperBound ${upper} on reference '${name}'.`);
                }
            }
        }
        return errors;
    }

    deleteInstance(instanceId: string): boolean {
        const instanceModel = this.getActiveInstanceModel();
        if (!instanceModel) {
            return false;
        }

        const deleted = instanceModel.instances.delete(instanceId);
        if (deleted) {
            instanceModel.rootInstances.delete(instanceId);
            for (const instance of instanceModel.instances.values()) {
                for (const [referenceName, value] of instance.references.entries()) {
                    if (value === instanceId) {
                        instance.references.delete(referenceName);
                    } else if (Array.isArray(value)) {
                        const remaining = value.filter(targetId => targetId !== instanceId);
                        if (remaining.length === 0) {
                            instance.references.delete(referenceName);
                        } else if (remaining.length !== value.length) {
                            instance.references.set(referenceName, remaining);
                        }
                    }
                }
            }
        }

        return deleted;
    }

    getAllInstances(): EcoreInstance[] {
        const instanceModel = this.getActiveInstanceModel();
        if (!instanceModel) {
            return [];
        }
        return Array.from(instanceModel.instances.values());
    }

    getRootInstances(): EcoreInstance[] {
        const instanceModel = this.getActiveInstanceModel();
        if (!instanceModel) {
            return [];
        }

        const rootInstances: EcoreInstance[] = [];
        for (const rootId of instanceModel.rootInstances) {
            const instance = instanceModel.instances.get(rootId);
            if (instance) {
                rootInstances.push(instance);
            }
        }

        return rootInstances;
    }

    clearInstanceModel(metamodelKey: string): void {
        this.instanceModels.delete(metamodelKey);
        console.log(`Cleared instance model for metamodel ${metamodelKey}`);
    }

    clearAll(): void {
        this.instanceModels.clear();
        this.instanceFactory.resetCounter();
        console.log('Cleared all instance models');
    }

    private isSubtypeOf(className: string, superTypeName: string): boolean {
        if (className === superTypeName) {
            return true;
        }

        const eClass = this.metamodelRegistry.findEClass(className);
        if (!eClass) {
            return false;
        }

        const eSuperTypes = eClass.get ? eClass.get('eSuperTypes') : eClass.eSuperTypes;
        if (!eSuperTypes) {
            return false;
        }

        let superTypes: any[] = [];
        if (Array.isArray(eSuperTypes)) {
            superTypes = eSuperTypes;
        } else if (eSuperTypes.forEach) {
            eSuperTypes.forEach((st: any) => superTypes.push(st));
        }

        for (const superType of superTypes) {
            const stName = superType.get ? superType.get('name') : superType.name;
            if (stName === superTypeName) {
                return true;
            }   
            if (this.isSubtypeOf(stName, superTypeName)) {
                return true;
            }
        }

        return false;
    }

    saveInstanceModel(filename?: string): { success: boolean; message: string; filePath?: string } {
        const instanceModel = this.getActiveInstanceModel();
        console.log('instanceModel', instanceModel);
        
        if (!instanceModel) {
            return {
                success: false,
                message: 'No active instance model to save'
            };
        }

        try {
            const serialized: any = {
                metamodelKey: instanceModel.metamodelKey,
                instances: [],
                rootInstances: Array.from(instanceModel.rootInstances)
            };

            for (const instance of instanceModel.instances.values()) {
                const instanceObj: any = {
                    id: instance.id,
                    eClassName: instance.eClassName,
                    metamodelKey: instance.metamodelKey,
                    attributes: {},
                    references: {},
                    position: instance.position,
                    size: instance.size,
                    componentBounds: instance.componentBounds,
                    hidden: instance.hidden,
                    isRoot: instance.isRoot
                };

                if (instance.attributes) {
                    instance.attributes.forEach((value, key) => {
                        instanceObj.attributes[key] = value;
                    });
                }

                if (instance.references) {
                    instance.references.forEach((value, key) => {
                        instanceObj.references[key] = value;
                    });
                }

                serialized.instances.push(instanceObj);
            }

            const content = JSON.stringify(serialized, null, 2);
            const defaultFilename = 'instances.json';
            const finalFilename = filename || defaultFilename;
            
            const targetPath = path.isAbsolute(finalFilename)
                ? finalFilename
                : path.resolve(process.cwd(), 'samples', 'instances', finalFilename);

            fs.mkdirSync(path.dirname(targetPath), { recursive: true });
            fs.writeFileSync(targetPath, content, { encoding: 'utf8' });

            return {
                success: true,
                message: `Instance model saved successfully to ${targetPath}`,
                filePath: targetPath
            };
        } catch (error) {
            return {
                success: false,
                message: `Failed to save instance model: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    loadInstanceModel(content: string, filename: string): { success: boolean; message: string } {
        try {
            const parsed = JSON.parse(content);
            
            if (!parsed.metamodelKey || !parsed.instances || !Array.isArray(parsed.instances)) {
                return {
                    success: false,
                    message: 'Invalid instance model format: missing required fields'
                };
            }

            const metamodelKey = parsed.metamodelKey;
            
            if (!this.metamodelRegistry.hasMetamodel(metamodelKey)) {
                return {
                    success: false,
                    message: `Metamodel '${metamodelKey}' not found. Please load the metamodel first.`
                };
            }

            let instanceModel = this.instanceModels.get(metamodelKey);
            if (!instanceModel) {
                instanceModel = this.createInstanceModel(metamodelKey);
            } else {
                instanceModel.instances.clear();
                instanceModel.rootInstances.clear();
            }

            for (const instanceObj of parsed.instances) {
                if (!instanceObj.id || !instanceObj.eClassName) {
                    console.warn('Skipping invalid instance:', instanceObj);
                    continue;
                }

                const instance: EcoreInstance = {
                    id: instanceObj.id,
                    eClassName: instanceObj.eClassName,
                    metamodelKey: instanceObj.metamodelKey || metamodelKey,
                    attributes: new Map(),
                    references: new Map(),
                    position: instanceObj.position,
                    size: instanceObj.size,
                    componentBounds: instanceObj.componentBounds,
                    hidden: instanceObj.hidden ?? false,
                    isRoot: instanceObj.isRoot ?? false
                };

                if (instanceObj.attributes && typeof instanceObj.attributes === 'object') {
                    for (const [key, value] of Object.entries(instanceObj.attributes)) {
                        instance.attributes.set(key, value);
                    }
                }

                if (instanceObj.references && typeof instanceObj.references === 'object') {
                    for (const [key, value] of Object.entries(instanceObj.references)) {
                        if (typeof value === 'string' || (Array.isArray(value) && value.every(v => typeof v === 'string'))) {
                            instance.references.set(key, value as string | string[]);
                        } else {
                            console.warn(`Skipping invalid reference value for key '${key}':`, value);
                        }
                    }
                }

                instanceModel.instances.set(instance.id, instance);
                this.instanceFactory.reserveId(instance.id);
            }

            if (parsed.rootInstances && Array.isArray(parsed.rootInstances)) {
                for (const rootId of parsed.rootInstances) {
                    if (instanceModel.instances.has(rootId)) {
                        instanceModel.rootInstances.add(rootId);
                    }
                }
            }

            return {
                success: true,
                message: `Instance model loaded successfully from ${filename}`
            };
        } catch (error) {
            return {
                success: false,
                message: `Failed to load instance model: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }
}

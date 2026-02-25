/**
 * @author Abigail Sotomayor <s205720@dtu.dk>
 */
import { injectable, inject } from 'inversify';
import { EcoreInstance, InstanceModel, InstanceFactory } from './instance-model-types';
import { MetamodelRegistry } from './metamodel-registry';
import { isEAttribute, isEReference } from './ecore-types';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Storage and management for Ecore instance models.
 */
@injectable()
export class InstanceModelStorage {
    private instanceModels: Map<string, InstanceModel> = new Map();
    private instanceFactory: InstanceFactory = new InstanceFactory();

    @inject(MetamodelRegistry)
    protected metamodelRegistry: MetamodelRegistry;


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
        opts?: { containerInstanceId?: string; containmentReferenceName?: string }
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
        const incomingContainments = this.findIncomingContainmentRequirements(eClassName);
        const mustBeContained = incomingContainments.some(r => (r.lowerBound ?? 0) > 0);
        if (mustBeContained && (!containerInstanceId || !containmentReferenceName)) {
            const defaultContainer = this.findDefaultContainer(incomingContainments, instanceModel);
            if (defaultContainer) {
                containerInstanceId = defaultContainer.instance.id;
                containmentReferenceName = defaultContainer.referenceName;
            }
        }
        if (mustBeContained && (!containerInstanceId || !containmentReferenceName)) {
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

        if (containerInstanceId && containmentReferenceName) {
            const containerInstance = this.getInstance(containerInstanceId);
            if (containerInstance && !containerInstance.hidden && containerInstance.position) {
                const containmentRef = containerInstance.references.get(containmentReferenceName);
                let existingChildrenCount = 0;
                if (containmentRef) {
                    if (Array.isArray(containmentRef)) {
                        existingChildrenCount = containmentRef.length;
                    } else if (containmentRef) {
                        existingChildrenCount = 1;
                    }
                }
                
                const childOffsetX = 300;
                const childOffsetY = existingChildrenCount * 150;
                
                instance.position = {
                    x: containerInstance.position.x + childOffsetX,
                    y: containerInstance.position.y + childOffsetY
                };
            }
            
            this.createReference(containerInstanceId, containmentReferenceName, instance.id);
        } else {
            instanceModel.rootInstances.add(instance.id);
        }

        console.log(`Created instance ${instance.id} of class ${eClassName}`);
        return instance;
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

        let references: any[] = [];
        const eStructuralFeatures = eClass.get ? eClass.get('eStructuralFeatures') : eClass.eStructuralFeatures;
        const eReferences = eClass.get ? eClass.get('eReferences') : eClass.eReferences;
        
        if (eReferences) {
            if (Array.isArray(eReferences)) {
                references = eReferences;
            } else if (eReferences.forEach) {
                eReferences.forEach((f: any) => references.push(f));
            }
        }
        
        if (references.length === 0 && eStructuralFeatures) {
            let structuralFeatures: any[] = [];
            if (Array.isArray(eStructuralFeatures)) {
                structuralFeatures = eStructuralFeatures;
            } else if (eStructuralFeatures.forEach) {
                eStructuralFeatures.forEach((f: any) => structuralFeatures.push(f));
            }
            references = structuralFeatures.filter(isEReference);
        }
        
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
                const targetRefs = targetEClass?.eStructuralFeatures?.filter(isEReference) || [];
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

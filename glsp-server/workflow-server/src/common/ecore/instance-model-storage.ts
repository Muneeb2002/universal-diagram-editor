/********************************************************************************
 * Copyright (c) 2024 Eclipse GLSP and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * SPDX-License-Identifier: EPL-2.0
 ********************************************************************************/

import { injectable, inject } from 'inversify';
import { EcoreInstance, InstanceModel, InstanceFactory } from './instance-model-types';
import { MetamodelRegistry } from './metamodel-registry';
import { isEAttribute, isEReference } from './ecore-types';

/**
 * Storage and management for Ecore instance models.
 */
@injectable()
export class InstanceModelStorage {
    private instanceModels: Map<string, InstanceModel> = new Map();
    private instanceFactory: InstanceFactory = new InstanceFactory();

    @inject(MetamodelRegistry)
    protected metamodelRegistry: MetamodelRegistry;

    /**
     * Creates a new instance model for the specified metamodel.
     * @param metamodelKey The key of the metamodel
     * @returns The created instance model
     */
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

    /**
     * Gets the instance model for the specified metamodel.
     * @param metamodelKey The key of the metamodel
     * @returns The instance model or undefined if not found
     */
    getInstanceModel(metamodelKey: string): InstanceModel | undefined {
        return this.instanceModels.get(metamodelKey);
    }

    /**
     * Gets the instance model for the active metamodel.
     * @returns The instance model or undefined if not found
     */
    getActiveInstanceModel(): InstanceModel | undefined {
        const activeKey = this.metamodelRegistry.getActiveMetamodelKey();
        if (!activeKey) {
            return undefined;
        }
        return this.instanceModels.get(activeKey);
    }

    /**
     * Gets or creates the instance model for the active metamodel.
     * @returns The instance model
     */
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

    /**
     * Creates a new instance of the specified EClass.
     * @param eClassName The name of the EClass
     * @param position Optional initial position
     * @returns The created instance
     */
    createInstance(
        eClassName: string,
        position?: { x: number; y: number },
        opts?: { containerInstanceId?: string; containmentReferenceName?: string }
    ): EcoreInstance {
        const activeKey = this.metamodelRegistry.getActiveMetamodelKey();
        if (!activeKey) {
            throw new Error('No active metamodel set');
        }

        // Validate that the EClass exists in the metamodel
        const eClass = this.metamodelRegistry.findEClass(eClassName);
        if (!eClass) {
            throw new Error(`EClass '${eClassName}' not found in active metamodel`);
        }

        // Check if the class is abstract
        if (eClass.abstract) {
            throw new Error(`Cannot instantiate abstract class '${eClassName}'`);
        }

        // If this class requires containment, ensure container information is provided
        const incomingContainments = this.findIncomingContainmentRequirements(eClassName);
        const mustBeContained = incomingContainments.some(r => (r.lowerBound ?? 0) > 0);
        if (mustBeContained && (!opts?.containerInstanceId || !opts?.containmentReferenceName)) {
            const refs = incomingContainments
                .map(r => `${r.containerClassName}.${r.referenceName}[${r.lowerBound}..${this.boundToString(r.upperBound)}]`)
                .join(', ');
            throw new Error(
                `Instances of '${eClassName}' must be contained. Provide containerInstanceId and containmentReferenceName (one of: ${refs}).`
            );
        }

        // Create the instance
        const instance = this.instanceFactory.createInstance(eClassName, activeKey, position);

        // Initialize default attribute values
        this.initializeAttributes(instance, eClass);

        // Add to instance model
        const instanceModel = this.getOrCreateActiveInstanceModel();
        instanceModel.instances.set(instance.id, instance);

        // If container info provided, immediately create containment reference
        // But first, adjust position relative to container
        if (opts?.containerInstanceId && opts?.containmentReferenceName) {
            // Get container instance to calculate relative position
            const containerInstance = this.getInstance(opts.containerInstanceId);
            if (containerInstance && containerInstance.position) {
                // Count existing children BEFORE creating the reference
                const containmentRef = containerInstance.references.get(opts.containmentReferenceName);
                let existingChildrenCount = 0;
                if (containmentRef) {
                    if (Array.isArray(containmentRef)) {
                        existingChildrenCount = containmentRef.length;
                    } else if (containmentRef) {
                        existingChildrenCount = 1;
                    }
                }
                
                // Always position child instances relative to container
                const childOffsetX = 300; // Offset to the right
                const childOffsetY = existingChildrenCount * 150; // Stack vertically
                
                instance.position = {
                    x: containerInstance.position.x + childOffsetX,
                    y: containerInstance.position.y + childOffsetY
                };
            }
            
            this.createReference(opts.containerInstanceId, opts.containmentReferenceName, instance.id);
        } else {
            // Only add to root instances if it's not contained
            instanceModel.rootInstances.add(instance.id);
        }

        console.log(`Created instance ${instance.id} of class ${eClassName}`);
        return instance;
    }

    private boundToString(ub: number | undefined): string {
        if (ub === undefined) return '1';
        return ub === -1 ? '*' : String(ub);
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
                    if (containment && typeName === targetClassName) {
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

    /**
     * Initializes default attribute values for an instance based on its EClass.
     * @param instance The instance to initialize
     * @param eClass The EClass definition
     */
    private initializeAttributes(instance: EcoreInstance, eClass: any): void {
        // Get structural features safely
        let structuralFeatures: any[] = [];
        
        if (eClass.eStructuralFeatures) {
            if (Array.isArray(eClass.eStructuralFeatures)) {
                structuralFeatures = eClass.eStructuralFeatures;
            } else if (typeof eClass.eStructuralFeatures.forEach === 'function') {
                eClass.eStructuralFeatures.forEach((feature: any) => {
                    if (feature) structuralFeatures.push(feature);
                });
            } else if (eClass.eStructuralFeatures.size && typeof eClass.eStructuralFeatures.size === 'function') {
                // It's an EList
                for (let i = 0; i < eClass.eStructuralFeatures.size(); i++) {
                    const feature = eClass.eStructuralFeatures.get(i);
                    if (feature) structuralFeatures.push(feature);
                }
            }
        }

        console.log(`Initializing attributes for ${instance.eClassName}, found ${structuralFeatures.length} structural features`);

        // Initialize attributes
        const attributes = structuralFeatures.filter(isEAttribute);
        for (const attr of attributes) {
            // Set default values based on type
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

        // Initialize references as empty
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

    /**
     * Gets an instance by its ID.
     * @param instanceId The ID of the instance
     * @returns The instance or undefined if not found
     */
    getInstance(instanceId: string): EcoreInstance | undefined {
        const instanceModel = this.getActiveInstanceModel();
        if (!instanceModel) {
            return undefined;
        }
        return instanceModel.instances.get(instanceId);
    }

    /**
     * Sets an attribute value on an instance.
     * @param instanceId The ID of the instance
     * @param attributeName The name of the attribute
     * @param value The value to set
     */
    setAttributeValue(instanceId: string, attributeName: string, value: any): void {
        const instance = this.getInstance(instanceId);
        if (!instance) {
            throw new Error(`Instance '${instanceId}' not found`);
        }

        const eClass = this.metamodelRegistry.findEClass(instance.eClassName);
        if (!eClass) {
            throw new Error(`EClass '${instance.eClassName}' not found in metamodel`);
        }

        // Validate attribute exists
        const attributes = eClass.eStructuralFeatures.filter(isEAttribute);
        const attr = attributes.find((a: any) => a.name === attributeName);
        if (!attr) {
            throw new Error(`Attribute '${attributeName}' not found in class '${instance.eClassName}'`);
        }

        // TODO: Add type validation

        instance.attributes.set(attributeName, value);
        console.log(`Set attribute ${attributeName} = ${value} on instance ${instanceId}`);
    }

    /**
     * Creates a reference between two instances.
     * @param sourceInstanceId The ID of the source instance
     * @param referenceName The name of the reference
     * @param targetInstanceId The ID of the target instance
     */
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

        // Validate reference exists
        let references: any[] = [];
        const eStructuralFeatures = eClass.get ? eClass.get('eStructuralFeatures') : eClass.eStructuralFeatures;
        const eReferences = eClass.get ? eClass.get('eReferences') : eClass.eReferences;
        
        // First try to get references from eReferences array (JSON format)
        if (eReferences) {
            if (Array.isArray(eReferences)) {
                references = eReferences; // Already references, no need to filter
            } else if (eReferences.forEach) {
                eReferences.forEach((f: any) => references.push(f));
            }
        }
        
        // Fallback to eStructuralFeatures if eReferences not available
        if (references.length === 0 && eStructuralFeatures) {
            let structuralFeatures: any[] = [];
            if (Array.isArray(eStructuralFeatures)) {
                structuralFeatures = eStructuralFeatures;
            } else if (eStructuralFeatures.forEach) {
                eStructuralFeatures.forEach((f: any) => structuralFeatures.push(f));
            }
            // Filter to get only references
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

        // Validate target type matches reference type
        const refEType = ref.get ? ref.get('eType') : ref.eType;
        const refTypeName = refEType ? (refEType.get ? refEType.get('name') : refEType.name) : null;
        if (refTypeName && refTypeName !== targetInstance.eClassName) {
            // Check if target type is a subtype of reference type
            if (!this.isSubtypeOf(targetInstance.eClassName, refTypeName)) {
                throw new Error(
                    `Type mismatch: reference '${referenceName}' expects type '${refTypeName}' but got '${targetInstance.eClassName}'`
                );
            }
        }

        // Enforce multiplicity
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

        // Handle containment
        if (ref.containment) {
            const instanceModel = this.getActiveInstanceModel();
            if (instanceModel) {
                instanceModel.rootInstances.delete(targetInstanceId);
            }
        }

        // Maintain eOpposite if present and enforce its multiplicity
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

        // For [1..1], ensure exactly one after creation
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

    /**
     * Deletes an instance.
     * @param instanceId The ID of the instance to delete
     * @returns True if the instance was deleted, false if it didn't exist
     */
    deleteInstance(instanceId: string): boolean {
        const instanceModel = this.getActiveInstanceModel();
        if (!instanceModel) {
            return false;
        }

        const deleted = instanceModel.instances.delete(instanceId);
        if (deleted) {
            instanceModel.rootInstances.delete(instanceId);

            // TODO: Clean up references to this instance from other instances
            console.log(`Deleted instance ${instanceId}`);
        }

        return deleted;
    }

    /**
     * Gets all instances in the active instance model.
     * @returns Array of all instances
     */
    getAllInstances(): EcoreInstance[] {
        const instanceModel = this.getActiveInstanceModel();
        if (!instanceModel) {
            return [];
        }
        return Array.from(instanceModel.instances.values());
    }

    /**
     * Gets all root instances in the active instance model.
     * @returns Array of root instances
     */
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

    /**
     * Clears the instance model for the specified metamodel.
     * @param metamodelKey The key of the metamodel
     */
    clearInstanceModel(metamodelKey: string): void {
        this.instanceModels.delete(metamodelKey);
        console.log(`Cleared instance model for metamodel ${metamodelKey}`);
    }

    /**
     * Clears all instance models.
     */
    clearAll(): void {
        this.instanceModels.clear();
        this.instanceFactory.resetCounter();
        console.log('Cleared all instance models');
    }

    /**
     * Checks if a class is a subtype of (or same as) another class.
     * @param className The name of the class to check
     * @param superTypeName The name of the potential supertype
     * @returns True if className is a subtype of or equal to superTypeName
     */
    private isSubtypeOf(className: string, superTypeName: string): boolean {
        // If they're the same, it's valid
        if (className === superTypeName) {
            return true;
        }

        // Find the class in the metamodel
        const eClass = this.metamodelRegistry.findEClass(className);
        if (!eClass) {
            return false;
        }

        // Get supertypes
        const eSuperTypes = eClass.get ? eClass.get('eSuperTypes') : eClass.eSuperTypes;
        if (!eSuperTypes) {
            return false;
        }

        // Check direct supertypes
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
            // Recursively check supertypes of supertypes
            if (this.isSubtypeOf(stName, superTypeName)) {
                return true;
            }
        }

        return false;
    }
}

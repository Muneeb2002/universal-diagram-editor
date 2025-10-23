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
    createInstance(eClassName: string, position?: { x: number; y: number }): EcoreInstance {
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

        // Create the instance
        const instance = this.instanceFactory.createInstance(eClassName, activeKey, position);

        // Initialize default attribute values
        this.initializeAttributes(instance, eClass);

        // Add to instance model
        const instanceModel = this.getOrCreateActiveInstanceModel();
        instanceModel.instances.set(instance.id, instance);
        instanceModel.rootInstances.add(instance.id);

        console.log(`Created instance ${instance.id} of class ${eClassName}`);
        return instance;
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
        const references = eClass.eStructuralFeatures.filter(isEReference);
        const ref = references.find((r: any) => r.name === referenceName);
        if (!ref) {
            throw new Error(`Reference '${referenceName}' not found in class '${sourceInstance.eClassName}'`);
        }

        // Validate target type matches reference type
        if (ref.eType.name !== targetInstance.eClassName) {
            throw new Error(
                `Type mismatch: reference '${referenceName}' expects type '${ref.eType.name}' but got '${targetInstance.eClassName}'`
            );
        }

        // Check if it's a single or multi-valued reference
        if (ref.upperBound === 1) {
            sourceInstance.references.set(referenceName, targetInstanceId);
        } else {
            const currentValue = sourceInstance.references.get(referenceName);
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

        console.log(`Created reference ${referenceName} from ${sourceInstanceId} to ${targetInstanceId}`);
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
}

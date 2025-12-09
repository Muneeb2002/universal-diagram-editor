/********************************************************************************
 * Copyright (c) 2024 Eclipse GLSP and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * SPDX-License-Identifier: EPL-2.0
 ********************************************************************************/

import { injectable } from 'inversify';
import { EcoreModel, isEClass, isEAttribute, isEReference, isEEnum, EClass, EAttribute, EReference, EString, EEnum } from './ecore-types';
import * as fs from 'fs';
import * as path from 'path';

function toArray(collection: any): any[] {
    if (!collection) {
        return [];
    }
    if (Array.isArray(collection)) {
        return collection;
    }
    
    // Handle ecore-ts EList objects - they have a toArray() method or can be iterated
    if (typeof collection.toArray === 'function') {
        try {
            return collection.toArray();
        } catch {
            // fall through
        }
    }
    
    // Try forEach for iterable objects (including EList)
    if (typeof collection.forEach === 'function') {
        const result: any[] = [];
        try {
            collection.forEach((item: any) => result.push(item));
            return result;
        } catch {
            // fall through
        }
    }
    
    // Try Array.from for array-like objects
    if (typeof collection.length === 'number') {
        try {
            return Array.from(collection);
        } catch {
            // ignore
        }
    }
    
    // Try accessing internal array (for some ecore-ts implementations)
    const internal = (collection as any)._internal;
    if (Array.isArray(internal)) {
        return internal;
    }
    
    // Try accessing _elements (another possible internal structure)
    const elements = (collection as any)._elements;
    if (Array.isArray(elements)) {
        return elements;
    }
    
    return [];
}

/**
 * Registry for storing and managing loaded Ecore metamodels.
 * This is a singleton service that maintains all metamodels loaded during the session.
 */
@injectable()
export class MetamodelRegistry {
    private metamodels: Map<string, EcoreModel> = new Map();
    private activeMetamodelKey: string | null = null;

    /**
     * Registers a new metamodel in the registry.
     * @param key Unique identifier for the metamodel (typically nsURI or filename)
     * @param metamodel The Ecore metamodel to register
     */
    registerMetamodel(key: string, metamodel: EcoreModel): void {
        this.metamodels.set(key, metamodel);
        
        // Set as active if it's the first one
        if (!this.activeMetamodelKey) {
            this.activeMetamodelKey = key;
        }
    }

    /**
     * Retrieves a metamodel by its key.
     * @param key The unique identifier of the metamodel
     * @returns The metamodel or undefined if not found
     */
    getMetamodel(key: string): EcoreModel | undefined {
        return this.metamodels.get(key);
    }

    /**
     * Gets the currently active metamodel.
     * @returns The active metamodel or undefined if none is set
     */
    getActiveMetamodel(): EcoreModel | undefined {
        if (!this.activeMetamodelKey) {
            return undefined;
        }
        return this.metamodels.get(this.activeMetamodelKey);
    }

    /**
     * Gets the key of the currently active metamodel.
     * @returns The active metamodel key or null if none is set
     */
    getActiveMetamodelKey(): string | null {
        return this.activeMetamodelKey;
    }

    /**
     * Sets the active metamodel.
     * @param key The key of the metamodel to set as active
     * @throws Error if the metamodel key doesn't exist
     */
    setActiveMetamodel(key: string): void {
        if (!this.metamodels.has(key)) {
            throw new Error(`Metamodel with key '${key}' not found in registry`);
        }
        this.activeMetamodelKey = key;
    }

    /**
     * Gets all registered metamodel keys.
     * @returns Array of all metamodel keys
     */
    getAllMetamodelKeys(): string[] {
        return Array.from(this.metamodels.keys());
    }

    /**
     * Checks if a metamodel with the given key exists.
     * @param key The key to check
     * @returns True if the metamodel exists, false otherwise
     */
    hasMetamodel(key: string): boolean {
        return this.metamodels.has(key);
    }

    /**
     * Removes a metamodel from the registry.
     * @param key The key of the metamodel to remove
     * @returns True if the metamodel was removed, false if it didn't exist
     */
    removeMetamodel(key: string): boolean {
        const removed = this.metamodels.delete(key);
        
        // If the active metamodel was removed, set a new active one
        if (removed && this.activeMetamodelKey === key) {
            const keys = this.getAllMetamodelKeys();
            this.activeMetamodelKey = keys.length > 0 ? keys[0] : null;
        }
        
        return removed;
    }

    /**
     * Clears all metamodels from the registry.
     */
    clear(): void {
        this.metamodels.clear();
        this.activeMetamodelKey = null;
    }

    /**
     * Finds an EClass by name in the active metamodel.
     * @param className The name of the class to find
     * @returns The EClass or undefined if not found
     */
    findEClass(className: string): any | undefined {
        const activeMetamodel = this.getActiveMetamodel();
        if (!activeMetamodel) {
            return undefined;
        }

        for (const pkg of activeMetamodel.ePackages) {
            const classifiers = pkg.get('eClassifiers') as any;
            if (!classifiers) {
                continue;
            }
            
            // Convert to array using robust method
            let classifierArray: any[] = [];
            if (Array.isArray(classifiers)) {
                classifierArray = classifiers;
            } else if (classifiers.size && typeof classifiers.size === 'function') {
                // It's an EList - try different iteration methods
                if (typeof classifiers.forEach === 'function') {
                    classifiers.forEach((item: any) => {
                        if (item) classifierArray.push(item);
                    });
                } else if (typeof classifiers[Symbol.iterator] === 'function') {
                    try {
                        for (const item of classifiers) {
                            if (item) classifierArray.push(item);
                        }
                    } catch (e) {
                        // Iterator failed, continue with other methods
                    }
                } else if (classifiers._internal && Array.isArray(classifiers._internal)) {
                    classifierArray = classifiers._internal.filter((item: any) => item != null);
                } else if (classifiers.get && typeof classifiers.get === 'function') {
                    for (let i = 0; i < classifiers.size(); i++) {
                        const item = classifiers.get(i);
                        if (item) classifierArray.push(item);
                    }
                } else {
                    try {
                        classifierArray = Array.from(classifiers).filter((item: any) => item != null);
                    } catch (e) {
                        classifierArray = [];
                    }
                }
            } else {
                try {
                    classifierArray = Array.from(classifiers);
                } catch (e) {
                    classifierArray = [];
                }
            }
            
            for (const classifier of classifierArray) {
                if (classifier && isEClass(classifier)) {
                    const name = classifier.get('name');
                    if (name === className) {
                        return classifier;
                    }
                }
            }
        }

        return undefined;
    }

    /**
     * Finds an EClass by name in a specific metamodel.
     * @param metamodelKey The key of the metamodel to search in
     * @param className The name of the class to find
     * @returns The EClass or undefined if not found
     */
    findEClassInMetamodel(metamodelKey: string, className: string): any | undefined {
        const metamodel = this.getMetamodel(metamodelKey);
        if (!metamodel) {
            return undefined;
        }

        for (const pkg of metamodel.ePackages) {
            const classifiers = pkg.get('eClassifiers') as any;
            for (let i = 0; i < classifiers.size; i++) {
                const classifier = classifiers.get(i);
                if (isEClass(classifier) && classifier.get('name') === className) {
                    return classifier;
                }
            }
        }

        return undefined;
    }

    /**
     * Gets all EClasses from the active metamodel.
     * @returns Array of all EClasses
     */
    getAllEClasses(): any[] {
        const activeMetamodel = this.getActiveMetamodel();
        if (!activeMetamodel) {
            return [];
        }

        const eClasses: any[] = [];
        for (const pkg of activeMetamodel.ePackages) {
            // Handle both ecore-ts objects (with .get()) and plain JS objects
            let classifiers: any;
            if (typeof (pkg as any).get === 'function') {
                classifiers = (pkg as any).get('eClassifiers');
            } else {
                classifiers = (pkg as any).eClassifiers;
            }
            
            if (!classifiers) {
                continue;
            }
            
            // Handle both array-like and collection-like objects
            if (Array.isArray(classifiers)) {
                classifiers.forEach((classifier: any) => {
                    if (isEClass(classifier)) {
                        eClasses.push(classifier);
                    }
                });
            } else if (classifiers.forEach) {
                classifiers.forEach((classifier: any) => {
                    if (isEClass(classifier)) {
                        eClasses.push(classifier);
                    }
                });
            }
        }

        return eClasses;
    }

    /**
     * Gets all packages from the active metamodel.
     * @returns Array of all packages
     */
    getAllPackages(): any[] {
        const activeMetamodel = this.getActiveMetamodel();
        if (!activeMetamodel) {
            return [];
        }

        return activeMetamodel.ePackages;
    }

    /**
     * Adds an inheritance relationship between two classes.
     * @param subClassName The name of the subclass
     * @param superClassName The name of the superclass
     */
    addInheritance(subClassName: string, superClassName: string): void {
        const subClass = this.findEClass(subClassName);
        const superClass = this.findEClass(superClassName);
        
        if (!subClass) {
            throw new Error(`Subclass '${subClassName}' not found in active metamodel`);
        }
        
        if (!superClass) {
            throw new Error(`Superclass '${superClassName}' not found in active metamodel`);
        }

        // Get current super types
        let superTypes: any;
        const isEcoreTs = !!(subClass && (subClass as any).eClass && (subClass as any).eClass.values && (subClass as any).eClass.values.name === 'EClass');
        if (isEcoreTs) {
            superTypes = subClass.get('eSuperTypes');
        } else {
            superTypes = subClass.eSuperTypes;
        }

        // Check if inheritance already exists
        const alreadyExists = Array.isArray(superTypes) 
            ? superTypes.some((st: any) => {
                const stName = typeof st.get === 'function' ? st.get('name') : st.name;
                return stName === superClassName;
            })
            : false;

        if (alreadyExists) {
            throw new Error(`Inheritance relationship from '${subClassName}' to '${superClassName}' already exists`);
        }

        // Add the superclass to the subclass's eSuperTypes
        if (isEcoreTs) {
            // ecore-ts EClass object - use .add() on the EList (if available)
            const eList = (subClass as any).get('eSuperTypes');
            if (eList && typeof eList.add === 'function') {
                eList.add(superClass);
            } else {
                // Fallback: if EList doesn't expose add, try pushing
                try {
                    eList.push?.(superClass);
                } catch (_) {
                    throw new Error("eSuperTypes collection does not support 'add' for this EClass instance");
                }
            }
        } else {
            // Plain JavaScript object - use .push()
            if (!Array.isArray(subClass.eSuperTypes)) {
                subClass.eSuperTypes = [];
            }
            subClass.eSuperTypes.push(superClass);
        }
    }

    /**
     * Adds a containment reference from source class to target class.
     * @param sourceClassName The name of the source class
     * @param targetClassName The name of the target class
     * @param referenceName The name of the reference
     */
    addContainmentReference(sourceClassName: string, targetClassName: string, referenceName: string, lowerBound?: number, upperBound?: number): void {
        this.addReference(sourceClassName, targetClassName, referenceName, true, lowerBound, upperBound);
    }

    /**
     * Adds a reference from source class to target class.
     * @param sourceClassName The name of the source class
     * @param targetClassName The name of the target class
     * @param referenceName The name of the reference
     * @param isContainment Whether this is a containment reference
     * @param lowerBound The lower bound for multiplicity (default: 0)
     * @param upperBound The upper bound for multiplicity (default: -1 for containment, 1 for reference)
     */
    addReference(sourceClassName: string, targetClassName: string, referenceName: string, isContainment: boolean = false, lowerBound?: number, upperBound?: number): void {
        const sourceClass = this.findEClass(sourceClassName);
        const targetClass = this.findEClass(targetClassName);
        
        if (!sourceClass) {
            throw new Error(`Source class '${sourceClassName}' not found in active metamodel`);
        }
        
        if (!targetClass) {
            throw new Error(`Target class '${targetClassName}' not found in active metamodel`);
        }

        // Check if reference already exists
        let references: any[];
        const isEcoreTs = !!(sourceClass && (sourceClass as any).eClass && (sourceClass as any).eClass.values && (sourceClass as any).eClass.values.name === 'EClass');
        if (isEcoreTs) {
            references = sourceClass.get('eStructuralFeatures') || [];
        } else {
            references = sourceClass.eReferences || [];
        }

        const existingRef = references.find((ref: any) => {
            const refName = typeof ref.get === 'function' ? ref.get('name') : ref.name;
            return refName === referenceName;
        });

        if (existingRef) {
            throw new Error(`Reference '${referenceName}' already exists in class '${sourceClassName}'`);
        }

        // Create the reference with custom multiplicity if provided
        const finalLowerBound = lowerBound !== undefined ? lowerBound : 0;
        const finalUpperBound = upperBound !== undefined ? upperBound : (isContainment ? -1 : 1);
        
        let eReference: any;
        
        // Add the reference to the source class
        if (isEcoreTs) {
            // ecore-ts EClass object - create proper ecore-ts EReference
            eReference = EReference.create({
                name: referenceName,
                eType: targetClass,
                containment: isContainment,
                lowerBound: finalLowerBound,
                upperBound: finalUpperBound,
                unique: true,
                ordered: false
            });
            // Add using .add() on the EList
            (sourceClass as any).get('eStructuralFeatures').add(eReference);
        } else {
            // Plain JavaScript object - create plain JS reference with get/set
            eReference = {
                name: referenceName,
                eType: targetClass,
                containment: isContainment,
                lowerBound: finalLowerBound,
                upperBound: finalUpperBound,
                unique: true,
                ordered: false,
                get: function(key: string) {
                    return (this as any)[key];
                },
                set: function(key: string, value: any) {
                    (this as any)[key] = value;
                }
            };
            // Add using .push()
            if (!Array.isArray(sourceClass.eReferences)) {
                sourceClass.eReferences = [];
            }
            sourceClass.eReferences.push(eReference);
            // Ensure structural features also include references so renderers find them
            if (Array.isArray(sourceClass.eStructuralFeatures)) {
                sourceClass.eStructuralFeatures.push(eReference);
            }
        }
    }

    /**
     * Adds a bidirectional reference between two classes.
     * @param sourceClassName The name of the source class
     * @param targetClassName The name of the target class
     * @param sourceRefName The name of the reference in the source class
     * @param targetRefName The name of the reference in the target class
     * @param isContainment Whether this is a containment reference
     * @param sourceLowerBound Lower bound for source reference (default: 0)
     * @param sourceUpperBound Upper bound for source reference (default: 1)
     * @param targetLowerBound Lower bound for target reference (default: 0)
     * @param targetUpperBound Upper bound for target reference (default: -1)
     */
    addBidirectionalReference(
        sourceClassName: string, 
        targetClassName: string, 
        sourceRefName: string, 
        targetRefName: string, 
        isContainment: boolean = false,
        sourceLowerBound?: number,
        sourceUpperBound?: number,
        targetLowerBound?: number,
        targetUpperBound?: number
    ): void {
        const sourceClass = this.findEClass(sourceClassName);
        const targetClass = this.findEClass(targetClassName);
        
        if (!sourceClass) {
            throw new Error(`Source class '${sourceClassName}' not found in active metamodel`);
        }
        
        if (!targetClass) {
            throw new Error(`Target class '${targetClassName}' not found in active metamodel`);
        }

        // Set default multiplicity values if not provided
        const finalSourceLowerBound = sourceLowerBound !== undefined ? sourceLowerBound : 0;
        const finalSourceUpperBound = sourceUpperBound !== undefined ? sourceUpperBound : (isContainment ? -1 : 1);
        const finalTargetLowerBound = targetLowerBound !== undefined ? targetLowerBound : 0;
        const finalTargetUpperBound = targetUpperBound !== undefined ? targetUpperBound : -1;

        let sourceReference: any;
        let targetReference: any;
        
        // Check if we're working with ecore-ts objects
        const isEcoreTs = !!(sourceClass && (sourceClass as any).eClass && (sourceClass as any).eClass.values && (sourceClass as any).eClass.values.name === 'EClass');
        
        if (isEcoreTs) {
            // Create proper ecore-ts EReference objects
            sourceReference = EReference.create({
                name: sourceRefName,
                eType: targetClass,
                containment: isContainment,
                lowerBound: finalSourceLowerBound,
                upperBound: finalSourceUpperBound,
                unique: true,
                ordered: false
            });
            
            targetReference = EReference.create({
                name: targetRefName,
                eType: sourceClass,
                containment: false, // Opposite is never containment
                lowerBound: finalTargetLowerBound,
                upperBound: finalTargetUpperBound,
                unique: true,
                ordered: false
            });
            
            // Set the eOpposite relationships
            sourceReference.set('eOpposite', targetReference);
            targetReference.set('eOpposite', sourceReference);
        } else {
            // Create plain JavaScript objects with get/set
            sourceReference = {
                name: sourceRefName,
                eType: targetClass,
                containment: isContainment,
                lowerBound: finalSourceLowerBound,
                upperBound: finalSourceUpperBound,
                unique: true,
                ordered: false,
                eOpposite: null, // Will be set after target reference is created
                get: function(key: string) {
                    return (this as any)[key];
                },
                set: function(key: string, value: any) {
                    (this as any)[key] = value;
                }
            };

            targetReference = {
                name: targetRefName,
                eType: sourceClass,
                containment: false, // Opposite is never containment
                lowerBound: finalTargetLowerBound,
                upperBound: finalTargetUpperBound,
                unique: true,
                ordered: false,
                eOpposite: null, // Will be set after source reference is created
                get: function(key: string) {
                    return (this as any)[key];
                },
                set: function(key: string, value: any) {
                    (this as any)[key] = value;
                }
            };
            
            // Set the eOpposite relationships
            sourceReference.eOpposite = targetReference;
            targetReference.eOpposite = sourceReference;
        }

        // Add the source reference to the source class
        if (isEcoreTs) {
            // ecore-ts EClass object - use .add() on the EList
            (sourceClass as any).get('eStructuralFeatures').add(sourceReference);
        } else {
            // Plain JavaScript object - use .push()
            if (!Array.isArray(sourceClass.eReferences)) {
                sourceClass.eReferences = [];
            }
            sourceClass.eReferences.push(sourceReference);
            if (Array.isArray(sourceClass.eStructuralFeatures)) {
                sourceClass.eStructuralFeatures.push(sourceReference);
            }
        }

        // Add the target reference to the target class
        if (isEcoreTs) {
            // ecore-ts EClass object - use .add() on the EList
            (targetClass as any).get('eStructuralFeatures').add(targetReference);
        } else {
            // Plain JavaScript object - use .push()
            if (!Array.isArray(targetClass.eReferences)) {
                targetClass.eReferences = [];
            }
            targetClass.eReferences.push(targetReference);
            if (Array.isArray(targetClass.eStructuralFeatures)) {
                targetClass.eStructuralFeatures.push(targetReference);
            }
        }

        console.log(`Added bidirectional reference: ${sourceClassName}.${sourceRefName} <-> ${targetClassName}.${targetRefName}`);
    }

    /**
     * Gets information about all registered metamodels.
     * @returns Array of metamodel info objects
     */
    getMetamodelsInfo(): Array<{ key: string; nsURI: string; name: string; classCount: number }> {
        const infos: Array<{ key: string; nsURI: string; name: string; classCount: number }> = [];

        this.metamodels.forEach((metamodel, key) => {
            let classCount = 0;
            let nsURI = '';
            let name = '';

            if (metamodel.ePackages.length > 0) {
                const firstPackage = metamodel.ePackages[0];
                nsURI = firstPackage.nsURI;
                name = firstPackage.name;

                for (const pkg of metamodel.ePackages) {
                    classCount += pkg.eClassifiers.filter(isEClass).length;
                }
            }

            infos.push({ key, nsURI, name, classCount });
        });

        return infos;
    }


    /**
     * Validates attribute/reference name
     */
    private validateName(name: string): void {
        if (!name || name.trim().length === 0) {
            throw new Error('Name cannot be empty');
        }
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name.trim())) {
            throw new Error('Name must start with a letter or underscore and contain only letters, numbers, and underscores');
        }
    }





    /**
     * Finds all references to a class in the active metamodel.
     */
    private findAllReferencesToClass(className: string): Array<{class: any, reference: any}> {
        const references: Array<{class: any, reference: any}> = [];
        
        const activeMetamodel = this.getActiveMetamodel();
        if (!activeMetamodel) {
            return references;
        }

        // Iterate through all packages in the metamodel
        for (const pkg of activeMetamodel.ePackages) {
            const eClassifiers = pkg.get('eClassifiers') as any;
            if (!eClassifiers) {
                continue;
            }

            // Convert classifiers to array using robust method
            let classifierArray: any[] = [];
            if (Array.isArray(eClassifiers)) {
                classifierArray = eClassifiers;
            } else if (eClassifiers.size && typeof eClassifiers.size === 'function') {
                // It's an EList - try different iteration methods
                if (typeof eClassifiers.forEach === 'function') {
                    eClassifiers.forEach((item: any) => {
                        if (item) classifierArray.push(item);
                    });
                } else if (typeof eClassifiers[Symbol.iterator] === 'function') {
                    try {
                        for (const item of eClassifiers) {
                            if (item) classifierArray.push(item);
                        }
                    } catch (e) {
                        // Classifiers iterator failed
                    }
                } else if (eClassifiers._internal && Array.isArray(eClassifiers._internal)) {
                    classifierArray = eClassifiers._internal.filter((item: any) => item != null);
                } else if (eClassifiers.get && typeof eClassifiers.get === 'function') {
                    for (let i = 0; i < eClassifiers.size(); i++) {
                        const item = eClassifiers.get(i);
                        if (item) classifierArray.push(item);
                    }
                } else {
                    try {
                        classifierArray = Array.from(eClassifiers).filter((item: any) => item != null);
                    } catch (e) {
                        // Classifiers Array.from failed
                        classifierArray = [];
                    }
                }
            } else {
                try {
                    classifierArray = Array.from(eClassifiers);
                } catch (e) {
                    // Could not convert classifiers to array
                    classifierArray = [];
                }
            }

            // Iterate through all classes
            for (const eClass of classifierArray) {
                if (!eClass || !isEClass(eClass)) {
                    continue;
                }

                const structuralFeatures = eClass.get('eStructuralFeatures') as any;
                if (!structuralFeatures) {
                    continue;
                }

                // Convert features to array using robust method
                let featureArray: any[] = [];
                if (Array.isArray(structuralFeatures)) {
                    featureArray = structuralFeatures;
                } else if (structuralFeatures.size && typeof structuralFeatures.size === 'function') {
                    // It's an EList - try different iteration methods
                    if (typeof structuralFeatures.forEach === 'function') {
                        structuralFeatures.forEach((item: any) => {
                            if (item) featureArray.push(item);
                        });
                    } else if (typeof structuralFeatures[Symbol.iterator] === 'function') {
                        try {
                            for (const item of structuralFeatures) {
                                if (item) featureArray.push(item);
                            }
                        } catch (e) {
                            // Features iterator failed
                        }
                    } else if (structuralFeatures._internal && Array.isArray(structuralFeatures._internal)) {
                        featureArray = structuralFeatures._internal.filter((item: any) => item != null);
                    } else if (structuralFeatures.get && typeof structuralFeatures.get === 'function') {
                        for (let i = 0; i < structuralFeatures.size(); i++) {
                            const item = structuralFeatures.get(i);
                            if (item) featureArray.push(item);
                        }
                    } else {
                        try {
                            featureArray = Array.from(structuralFeatures).filter((item: any) => item != null);
                        } catch (e) {
                            // Features Array.from failed
                            featureArray = [];
                        }
                    }
                } else {
                    try {
                        featureArray = Array.from(structuralFeatures);
                    } catch (e) {
                        // Could not convert features to array
                        featureArray = [];
                    }
                }

                // Check all structural features (attributes and references)
                for (const feature of featureArray) {
                    if (!feature) {
                        continue;
                    }

                    // Check if this is a reference that points to the target class
                    if (isEReference(feature)) {
                        const eType = feature.get('eType');
                        if (eType && eType.get('name') === className) {
                            references.push({
                                class: eClass,
                                reference: feature
                            });
                        }
                    }
                }
            }
        }

        return references;
    }

    /**
     * Renames a class in the active metamodel and updates all references.
     */
    renameClass(oldClassName: string, newClassName: string): boolean {
        const eClass = this.findEClass(oldClassName);
        if (!eClass) {
            throw new Error(`Class '${oldClassName}' not found in active metamodel`);
        }

        // Check if new name already exists
        const existingClass = this.findEClass(newClassName);
        if (existingClass) {
            throw new Error(`Class '${newClassName}' already exists in the metamodel`);
        }

        try {
            // Validate the new name
            this.validateName(newClassName);

            // Find all references to this class before renaming
            const referencesToUpdate = this.findAllReferencesToClass(oldClassName);

            // Update the class name
            eClass.set('name', newClassName);

            // Update all references to point to the new class name
            for (const {reference} of referencesToUpdate) {
                const newType = this.findEClass(newClassName);
                if (newType) {
                    reference.set('eType', newType);
                }
            }

            return true;
        } catch (error) {
            throw error;
        }
    }

    renameEnum(oldEnumName: string, newEnumName: string): boolean {
        const eEnum = this.findEEnum(oldEnumName);
        if (!eEnum) {
            throw new Error(`Enum '${oldEnumName}' not found in active metamodel`);
        }

        // Check if new name already exists
        const existingEnum = this.findEEnum(newEnumName);
        if (existingEnum) {
            throw new Error(`Enum '${newEnumName}' already exists in the metamodel`);
        }

        try {
            // Validate the new name
            this.validateName(newEnumName);

            // Find all references to this enum before renaming
            const referencesToUpdate = this.findAllReferencesToEnum(oldEnumName);

            // Update the enum name
            eEnum.set('name', newEnumName);

            // Update all references to point to the new enum name
            for (const {reference} of referencesToUpdate) {
                const newType = this.findEEnum(newEnumName);
                if (newType) {
                    reference.set('eType', newType);
                }
            }

            return true;
        } catch (error) {
            console.error(`Error renaming enum '${oldEnumName}' to '${newEnumName}':`, error);
            throw error;
        }
    }

    private findAllReferencesToEnum(enumName: string): Array<{reference: any; className: string; attributeName: string}> {
        const references: Array<{reference: any; className: string; attributeName: string}> = [];
        const activeMetamodel = this.getActiveMetamodel();
        if (!activeMetamodel) {
            return references;
        }

        const allClasses = this.getAllEClasses();
        for (const eClass of allClasses) {
            const className = eClass.get ? eClass.get('name') : eClass.name;
            const eAttributes = eClass.get ? eClass.get('eAttributes') : eClass.eAttributes;
            const attributes = toArray(eAttributes);
            
            for (const attr of attributes) {
                const eType = attr.get ? attr.get('eType') : attr.eType;
                if (eType) {
                    const typeName = eType.get ? eType.get('name') : eType.name;
                    if (typeName === enumName) {
                        references.push({
                            reference: attr,
                            className: className || 'Unknown',
                            attributeName: (attr.get ? attr.get('name') : attr.name) || 'Unknown'
                        });
                    }
                }
            }
        }

        return references;
    }

    addEnumLiteral(enumName: string, literalName: string, literalValue?: number): boolean {
        const eEnum = this.findEEnum(enumName);
        if (!eEnum) {
            throw new Error(`Enum '${enumName}' not found in active metamodel`);
        }

        try {
            // Validate the literal name
            this.validateName(literalName);

            // Check if literal already exists
            const eLiterals = eEnum.get ? eEnum.get('eLiterals') : eEnum.eLiterals;
            const literalArray = toArray(eLiterals);
            
            for (const literal of literalArray) {
                const existingName = literal.get ? literal.get('name') : literal.name;
                if (existingName === literalName) {
                    throw new Error(`Enum literal '${literalName}' already exists in enum '${enumName}'`);
                }
            }

            // Create new enum literal
            const { EEnumLiteral } = require('ecore-ts');
            const enumLiteral = EEnumLiteral.create({
                name: literalName,
                value: literalValue !== undefined ? literalValue : literalArray.length,
                literal: literalName
            });

            // Add to enum's eLiterals
            const eLiteralsCollection = eEnum.get ? eEnum.get('eLiterals') : eEnum.eLiterals;
            if (eLiteralsCollection && typeof eLiteralsCollection.add === 'function') {
                eLiteralsCollection.add(enumLiteral);
            } else if (Array.isArray(eLiteralsCollection)) {
                eLiteralsCollection.push(enumLiteral);
            } else {
                // For plain objects, create array if needed
                if (!eEnum.eLiterals) {
                    eEnum.eLiterals = [];
                }
                eEnum.eLiterals.push({
                    name: literalName,
                    value: literalValue !== undefined ? literalValue : literalArray.length,
                    literal: literalName
                });
            }

            return true;
        } catch (error) {
            console.error(`Error adding enum literal '${literalName}' to enum '${enumName}':`, error);
            throw error;
        }
    }

    updateEnumLiteral(enumName: string, oldLiteralName: string, newLiteralName: string, newLiteralValue?: number): boolean {
        const eEnum = this.findEEnum(enumName);
        if (!eEnum) {
            throw new Error(`Enum '${enumName}' not found in active metamodel`);
        }

        try {
            // Validate the new literal name
            this.validateName(newLiteralName);

            // Find the literal to update
            const eLiterals = eEnum.get ? eEnum.get('eLiterals') : eEnum.eLiterals;
            const literalArray = toArray(eLiterals);
            
            let foundLiteral: any = null;
            for (const literal of literalArray) {
                const literalName = literal.get ? literal.get('name') : literal.name;
                if (literalName === oldLiteralName) {
                    foundLiteral = literal;
                    break;
                }
            }

            if (!foundLiteral) {
                throw new Error(`Enum literal '${oldLiteralName}' not found in enum '${enumName}'`);
            }

            // Check if new name already exists (and it's not the same literal)
            for (const literal of literalArray) {
                const literalName = literal.get ? literal.get('name') : literal.name;
                if (literalName === newLiteralName && literal !== foundLiteral) {
                    throw new Error(`Enum literal '${newLiteralName}' already exists in enum '${enumName}'`);
                }
            }

            // Update the literal
            if (foundLiteral.set) {
                foundLiteral.set('name', newLiteralName);
                if (newLiteralValue !== undefined) {
                    foundLiteral.set('value', newLiteralValue);
                }
                foundLiteral.set('literal', newLiteralName);
            } else {
                foundLiteral.name = newLiteralName;
                if (newLiteralValue !== undefined) {
                    foundLiteral.value = newLiteralValue;
                }
                foundLiteral.literal = newLiteralName;
            }

            return true;
        } catch (error) {
            console.error(`Error updating enum literal '${oldLiteralName}' in enum '${enumName}':`, error);
            throw error;
        }
    }

    deleteEnumLiteral(enumName: string, literalName: string): boolean {
        const eEnum = this.findEEnum(enumName);
        if (!eEnum) {
            throw new Error(`Enum '${enumName}' not found in active metamodel`);
        }

        try {
            // Find the literal to delete
            const eLiterals = eEnum.get ? eEnum.get('eLiterals') : eEnum.eLiterals;
            const literalArray = toArray(eLiterals);
            
            let foundIndex = -1;
            for (let i = 0; i < literalArray.length; i++) {
                const literal = literalArray[i];
                const currentName = literal.get ? literal.get('name') : literal.name;
                if (currentName === literalName) {
                    foundIndex = i;
                    break;
                }
            }

            if (foundIndex === -1) {
                throw new Error(`Enum literal '${literalName}' not found in enum '${enumName}'`);
            }

            // Remove the literal
            if (eLiterals && typeof eLiterals.remove === 'function') {
                eLiterals.remove(literalArray[foundIndex]);
            } else if (Array.isArray(eLiterals)) {
                eLiterals.splice(foundIndex, 1);
            } else if (Array.isArray(eEnum.eLiterals)) {
                eEnum.eLiterals.splice(foundIndex, 1);
            } else {
                throw new Error(`Cannot remove enum literal from enum '${enumName}' - eLiterals collection not supported`);
            }

            return true;
        } catch (error) {
            console.error(`Error deleting enum literal '${literalName}' from enum '${enumName}':`, error);
            throw error;
        }
    }

    /**
     * Changes the type of a class (abstract, concrete, interface, abstract-interface).
     */
    changeClassType(className: string, classType: 'abstract' | 'concrete' | 'interface' | 'abstract-interface'): boolean {
        const eClass = this.findEClass(className);
        if (!eClass) {
            throw new Error(`Class '${className}' not found in active metamodel`);
        }

        try {
            // Update the class properties based on the new type
            switch (classType) {
                case 'abstract':
                    eClass.set('abstract', true);
                    eClass.set('interface', false);
                    break;
                case 'concrete':
                    eClass.set('abstract', false);
                    eClass.set('interface', false);
                    break;
                case 'interface':
                    eClass.set('abstract', false);
                    eClass.set('interface', true);
                    break;
                case 'abstract-interface':
                    eClass.set('abstract', true);
                    eClass.set('interface', true);
                    break;
                default:
                    throw new Error(`Invalid class type: ${classType}`);
            }

            console.log(`Changed class '${className}' to type '${classType}'`);
            return true;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Deletes a class from the metamodel and handles all references.
     */
    deleteClass(className: string, force = false): boolean {
        const eClass = this.findEClass(className);
        if (!eClass) {
            throw new Error(`Class '${className}' not found in active metamodel`);
        }

        try {
            // Find all references to this class
            const referencesToClass = this.findAllReferencesToClass(className);
            
            if (referencesToClass.length > 0 && !force) {
                const referenceList = referencesToClass.map(({class: refClass, reference}) => 
                    `${refClass.get('name')}.${reference.get('name')}`
                ).join(', ');
                throw new Error(`Cannot delete class '${className}' because it is referenced by: ${referenceList}. Use force=true to delete anyway.`);
            }

            // If force is true, remove all references to this class
            if (force && referencesToClass.length > 0) {
                console.log(`Force deleting class '${className}' and removing ${referencesToClass.length} references`);
                
                for (const {class: refClass, reference} of referencesToClass) {
                    // Remove the reference from the class
                    const structuralFeatures = refClass.get('eStructuralFeatures') as any;
                    if (structuralFeatures && structuralFeatures.remove) {
                        structuralFeatures.remove(reference);
                        console.log(`Removed reference '${reference.get('name')}' from class '${refClass.get('name')}'`);
                    }
                }
            }

            // Find the package containing this class and remove it
            const activeMetamodel = this.getActiveMetamodel();
            if (!activeMetamodel) {
                throw new Error('No active metamodel found');
            }

            for (const pkg of activeMetamodel.ePackages) {
                const eClassifiers = pkg.get('eClassifiers') as any;
                if (eClassifiers && eClassifiers.remove) {
                    // Try to remove the class from the package
                    if (eClassifiers.contains && eClassifiers.contains(eClass)) {
                        eClassifiers.remove(eClass);
                        console.log(`Deleted class '${className}' from metamodel`);
                        return true;
                    }
                }
            }

            throw new Error(`Could not remove class '${className}' from its package`);
        } catch (error) {
            throw error;
        }
    }

    /**
     * Gets all attributes of a class.
     */
    getClassAttributes(className: string): any[] {
        const eClass = this.findEClass(className);
        if (!eClass) {
            throw new Error(`Class '${className}' not found in active metamodel`);
        }

        const structuralFeatures = eClass.get('eStructuralFeatures') as any;
        return structuralFeatures.filter((feature: any) => isEAttribute(feature));
    }

    /**
     * Gets all references that point to a specific class.
     */
    getReferencesToClass(className: string): Array<{className: string, referenceName: string}> {
        const references = this.findAllReferencesToClass(className);
        return references.map(({class: eClass, reference}) => ({
            className: eClass.get('name'),
            referenceName: reference.get('name')
        }));
    }

    /**
     * Gets all references of a class.
     */
    getClassReferences(className: string): any[] {
        const eClass = this.findEClass(className);
        if (!eClass) {
            throw new Error(`Class '${className}' not found in active metamodel`);
        }

        const structuralFeatures = eClass.get('eStructuralFeatures') as any;
        return structuralFeatures.filter((feature: any) => isEReference(feature));
    }

    /**
     * Save the active metamodel to a file.
     */
    saveMetamodel(filename?: string, format: 'json' | 'ecore' = 'json'): { success: boolean; message: string; filePath?: string } {
        
        const activeMetamodel = this.getActiveMetamodel();
        
        if (!activeMetamodel) {
            return {
                success: false,
                message: 'No active metamodel to save'
            };
        }

        try {
            let content: string;
            let defaultFilename: string;

            if (format === 'json') {
                // Convert to JSON format using a custom serializer that handles circular references
                content = this.serializeMetamodelToJSON(activeMetamodel);
                defaultFilename = 'metamodel.json';
            } else {
                // For now, we'll convert to JSON format even for 'ecore' format
                // In a full implementation, you'd convert to proper Ecore XML format
                content = this.serializeMetamodelToJSON(activeMetamodel);
                defaultFilename = 'metamodel.ecore';
            }

            const finalFilename = filename || defaultFilename;
            const targetPath = path.isAbsolute(finalFilename)
                ? finalFilename
                : path.resolve(process.cwd(), 'samples', 'metamodels', finalFilename);

            fs.mkdirSync(path.dirname(targetPath), { recursive: true });
            fs.writeFileSync(targetPath, content, { encoding: 'utf8' });

            return {
                success: true,
                message: `Metamodel saved successfully to ${targetPath}`,
                filePath: targetPath
            };
        } catch (error) {
            return {
                success: false,
                message: `Failed to save metamodel: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    /**
     * Creates a custom metamodel with a new EPackage.
     */
    createCustomMetamodel(packageName: string, nsURI: string, nsPrefix: string): { success: boolean; message?: string; metamodel?: any } {
        try {
            // Validate package name
            this.validateName(packageName);

            // Create a new Ecore model
            const ecoreModel = {
                ePackages: [] as any[]
            };

            // Create the EPackage with proper Ecore-like structure
            const ePackage = {
                name: packageName,
                nsURI: nsURI,
                nsPrefix: nsPrefix,
                eClassifiers: [] as any[],
                get: function(key: string) {
                    return (this as any)[key];
                }
            };

            // Add the package to the model
            ecoreModel.ePackages.push(ePackage);

            // Register the metamodel
            const metamodelKey = nsURI; // Use nsURI as the key
            this.registerMetamodel(metamodelKey, ecoreModel);
            
            // Set as active metamodel
            this.setActiveMetamodel(metamodelKey);

            console.log(`Created custom metamodel: ${packageName} (${nsURI})`);

            return {
                success: true,
                message: `Successfully created custom metamodel '${packageName}'`,
                metamodel: ecoreModel
            };
        } catch (error) {
            return {
                success: false,
                message: `Failed to create custom metamodel: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    updateMetamodelProperties(name: string, nsURI: string, nsPrefix: string): void {
        const activeMetamodel = this.getActiveMetamodel();
        if (!activeMetamodel) {
            throw new Error('No active metamodel found');
        }

        if (!activeMetamodel.ePackages || activeMetamodel.ePackages.length === 0) {
            throw new Error('Active metamodel has no packages');
        }

        const trimmedName = name?.trim() ?? '';
        const trimmedNsURI = nsURI?.trim() ?? '';
        const trimmedNsPrefix = nsPrefix?.trim() ?? '';

        if (!trimmedName) {
            throw new Error('Metamodel name cannot be empty');
        }
        if (!trimmedNsURI) {
            throw new Error('Metamodel nsURI cannot be empty');
        }
        if (!trimmedNsPrefix) {
            throw new Error('Metamodel nsPrefix cannot be empty');
        }

        const pkg = activeMetamodel.ePackages[0];
        const setProp = (obj: any, key: string, value: string) => {
            if (!obj) {
                return;
            }
            if (typeof obj.set === 'function') {
                obj.set(key, value);
            } else {
                obj[key] = value;
            }
        };

        const originalKey = this.activeMetamodelKey;
        const newKeyCandidate = trimmedNsURI.length > 0 ? trimmedNsURI : originalKey ?? trimmedName;

        if (originalKey && newKeyCandidate && originalKey !== newKeyCandidate) {
            const existing = this.metamodels.get(newKeyCandidate);
            if (existing && existing !== activeMetamodel) {
                throw new Error(`A metamodel with nsURI '${newKeyCandidate}' already exists`);
            }
        }

        setProp(pkg, 'name', trimmedName);
        setProp(pkg, 'nsURI', trimmedNsURI);
        setProp(pkg, 'nsPrefix', trimmedNsPrefix);

        if (originalKey && newKeyCandidate && originalKey !== newKeyCandidate) {
            const metamodel = activeMetamodel;
            this.metamodels.delete(originalKey);
            this.metamodels.set(newKeyCandidate, metamodel);
            this.activeMetamodelKey = newKeyCandidate;
        } else if (!originalKey && newKeyCandidate) {
            this.metamodels.set(newKeyCandidate, activeMetamodel);
            this.activeMetamodelKey = newKeyCandidate;
        }
    }

    /**
     * Creates a new EClass in the active custom metamodel.
     */
    createEClass(className: string, position?: { x: number; y: number }): { success: boolean; message?: string } {
        try {
            const activeMetamodel = this.getActiveMetamodel();
            if (!activeMetamodel) {
                return {
                    success: false,
                    message: 'No active metamodel found. Please create a custom metamodel first.'
                };
            }

            // Validate class name
            this.validateName(className);

            // Check if class already exists
            const existingClass = this.findEClass(className);
            if (existingClass) {
                return {
                    success: false,
                    message: `Class '${className}' already exists in the metamodel`
                };
            }

            // Add the class to the first package
            if (activeMetamodel.ePackages.length > 0) {
                const pkg = activeMetamodel.ePackages[0];
                let eClass: any;
                
                if (typeof (pkg as any).get === 'function' && typeof (pkg as any).get('eClassifiers').add === 'function') {
                    // ecore-ts EPackage object - create proper ecore-ts EClass
                    eClass = EClass.create({
                        name: className,
                        abstract: false,
                        interface: false
                    });
                    // Add to ecore-ts EPackage using .add()
                    (pkg as any).get('eClassifiers').add(eClass);
                } else {
                    // Plain JavaScript object - create plain JS object with get/set
                    eClass = {
                        name: className,
                        abstract: false,
                        interface: false,
                        eStructuralFeatures: [] as any[],
                        eSuperTypes: [] as any[],
                        get: function(key: string) {
                            return (this as any)[key];
                        },
                        set: function(key: string, value: any) {
                            (this as any)[key] = value;
                        }
                    };
                    // Add to plain JS package using .push()
                    pkg.eClassifiers.push(eClass);
                }
            }

            return {
                success: true,
                message: `Successfully created EClass '${className}'`
            };
        } catch (error) {
            return {
                success: false,
                message: `Failed to create EClass: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    createEEnum(enumName: string, position?: { x: number; y: number }, enumLiterals?: Array<{ name: string; value?: number }>): { success: boolean; message?: string } {
        try {
            const activeMetamodel = this.getActiveMetamodel();
            if (!activeMetamodel) {
                return {
                    success: false,
                    message: 'No active metamodel found. Please create a custom metamodel first.'
                };
            }

            // Validate enum name
            this.validateName(enumName);

            // Check if enum already exists
            const existingEnum = this.findEEnum(enumName);
            if (existingEnum) {
                return {
                    success: false,
                    message: `Enum '${enumName}' already exists in the metamodel`
                };
            }

            // Add the enum to the first package
            if (activeMetamodel.ePackages.length > 0) {
                const pkg = activeMetamodel.ePackages[0];
                let eEnum: any;
                
                if (typeof (pkg as any).get === 'function' && typeof (pkg as any).get('eClassifiers').add === 'function') {
                    // ecore-ts EPackage object - create proper ecore-ts EEnum
                    eEnum = EEnum.create({
                        name: enumName
                    });
                    
                    // Verify the enum structure for isEEnum check
                    // EEnum.create() should already set eClass correctly, but verify and fix if needed
                    if (!isEEnum(eEnum)) {
                        // Ensure the eClass structure exists for isEEnum check
                        if (!eEnum.eClass) {
                            eEnum.eClass = {};
                        }
                        if (!eEnum.eClass.values) {
                            eEnum.eClass.values = {};
                        }
                        eEnum.eClass.values.name = 'EEnum';
                    }
                    
                    // Add enum literals if provided
                    if (enumLiterals && enumLiterals.length > 0) {
                        try {
                            const { EEnumLiteral } = require('ecore-ts');
                            enumLiterals.forEach((literal, index) => {
                                const enumLiteral = EEnumLiteral.create({
                                    name: literal.name || `LITERAL_${index}`,
                                    value: literal.value !== undefined ? literal.value : index,
                                    literal: literal.name || `LITERAL_${index}`
                                });
                                (eEnum as any).get('eLiterals').add(enumLiteral);
                            });
                        } catch (error) {
                            console.warn(`[MetamodelRegistry.createEEnum] Failed to add literals using ecore-ts:`, error);
                        }
                    }
                    
                    // Add to ecore-ts EPackage using .add()
                    (pkg as any).get('eClassifiers').add(eEnum);
                } else {
                    // Plain JavaScript object - create plain JS object with eClass property for isEEnum check
                    const literals: any[] = [];
                    
                    // Add enum literals if provided
                    if (enumLiterals && enumLiterals.length > 0) {
                        enumLiterals.forEach((literal, index) => {
                            literals.push({
                                name: literal.name || `LITERAL_${index}`,
                                value: literal.value !== undefined ? literal.value : index,
                                literal: literal.name || `LITERAL_${index}`,
                                get: function(key: string) {
                                    return (this as any)[key];
                                },
                                set: function(key: string, value: any) {
                                    (this as any)[key] = value;
                                }
                            });
                        });
                    }
                    
                    eEnum = {
                        name: enumName,
                        eLiterals: literals,
                        eClass: {
                            values: {
                                name: 'EEnum'
                            }
                        },
                        get: function(key: string) {
                            return (this as any)[key];
                        },
                        set: function(key: string, value: any) {
                            (this as any)[key] = value;
                        }
                    };
                    // Add to plain JS package using .push()
                    pkg.eClassifiers.push(eEnum);
                }
            }

            return {
                success: true,
                message: `Successfully created EEnum '${enumName}'`
            };
        } catch (error) {
            return {
                success: false,
                message: `Failed to create EEnum: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    findEEnum(enumName: string): any {
        const activeMetamodel = this.getActiveMetamodel();
        if (!activeMetamodel) {
            return null;
        }

        for (const pkg of activeMetamodel.ePackages) {
            // Use the same method as findEClass - check for ecore-ts objects first
            const classifiersRaw = typeof (pkg as any).get === 'function' 
                ? (pkg as any).get('eClassifiers') 
                : (pkg as any).eClassifiers;
            
            if (!classifiersRaw) {
                continue;
            }
            
            // Use the same robust conversion method as findEClass
            let classifierArray: any[] = [];
            if (Array.isArray(classifiersRaw)) {
                classifierArray = classifiersRaw;
            } else if (classifiersRaw.size && typeof classifiersRaw.size === 'function') {
                // It's an EList - try different iteration methods
                if (typeof classifiersRaw.forEach === 'function') {
                    classifiersRaw.forEach((item: any) => {
                        if (item) classifierArray.push(item);
                    });
                } else if (typeof classifiersRaw[Symbol.iterator] === 'function') {
                    try {
                        for (const item of classifiersRaw) {
                            if (item) classifierArray.push(item);
                        }
                    } catch (e) {
                        // Iterator failed, continue with other methods
                    }
                } else if (classifiersRaw._internal && Array.isArray(classifiersRaw._internal)) {
                    classifierArray = classifiersRaw._internal.filter((item: any) => item != null);
                } else if (classifiersRaw.get && typeof classifiersRaw.get === 'function') {
                    for (let i = 0; i < classifiersRaw.size(); i++) {
                        const item = classifiersRaw.get(i);
                        if (item) classifierArray.push(item);
                    }
                } else {
                    try {
                        classifierArray = Array.from(classifiersRaw).filter((item: any) => item != null);
                    } catch (e) {
                        classifierArray = [];
                    }
                }
            } else {
                try {
                    classifierArray = Array.from(classifiersRaw);
                } catch (e) {
                    classifierArray = [];
                }
            }
            
            for (const classifier of classifierArray) {
                if (!classifier) continue;
                
                if (isEEnum(classifier)) {
                    const name = classifier.get ? classifier.get('name') : classifier.name;
                    if (name === enumName) {
                        return classifier;
                    }
                }
            }
        }

        return null;
    }

    /**
     * Adds an attribute to an existing EClass.
     * @param className The name of the class to add the attribute to
     * @param attributeName The name of the attribute
     * @param attributeType The type of the attribute (EString, EInt, EBoolean, etc.)
     * @param lowerBound The lower bound for multiplicity (default: 0)
     * @param upperBound The upper bound for multiplicity (default: 1)
     * @returns Success status and message
     */
    addAttribute(
        className: string,
        attributeName: string,
        attributeType: string,
        lowerBound: number = 0,
        upperBound: number = 1
    ): { success: boolean; message?: string } {
        try {
            // Find the class
            const eClass = this.findEClass(className);
            if (!eClass) {
                return {
                    success: false,
                    message: `Class '${className}' not found in active metamodel`
                };
            }

            const structuralFeatures = typeof eClass.get === 'function'
                ? eClass.get('eStructuralFeatures')
                : eClass.eStructuralFeatures;
            const isEcoreTs = !!structuralFeatures && typeof structuralFeatures.add === 'function';

            // Validate attribute name
            this.validateName(attributeName);

            // Check if attribute already exists
            let existingFeatures: any[];
            if (isEcoreTs) {
                existingFeatures = toArray(structuralFeatures);
            } else {
                existingFeatures = [...(eClass.eAttributes || []), ...(eClass.eReferences || [])];
            }

            const existingAttr = existingFeatures.find((feature: any) => {
                const featureName = typeof feature.get === 'function' ? feature.get('name') : feature.name;
                return featureName === attributeName;
            });

            if (existingAttr) {
                return {
                    success: false,
                    message: `Attribute or reference '${attributeName}' already exists in class '${className}'`
                };
            }

            // IMPORTANT: Check for enum FIRST, before calling mapAttributeTypeToEcoreType
            // because mapAttributeTypeToEcoreType defaults to EString if enum not found
            let finalEType: any = null;
            const foundEnum = this.findEEnum(attributeType);
            
            if (foundEnum) {
                // Found the enum! Use it directly
                finalEType = foundEnum;
            } else {
                // No enum found, use mapAttributeTypeToEcoreType (which will return EString if not recognized)
                finalEType = this.mapAttributeTypeToEcoreType(attributeType);
                
                // Double-check: if it returned EString (default), try one more time to find the enum
                // EString from ecore-ts has values.name === 'EString'
                const isEString = finalEType === EString || 
                                 (finalEType && finalEType.values && finalEType.values.name === 'EString') ||
                                 (finalEType && typeof finalEType.get === 'function' && finalEType.get('name') === 'EString');
                
                if (isEString && attributeType !== 'EString') {
                    // It defaulted to EString but we wanted an enum - try finding it one more time
                    const doubleCheckEnum = this.findEEnum(attributeType);
                    if (doubleCheckEnum) {
                        finalEType = doubleCheckEnum;
                    }
                }
            }
            
            // Create the attribute
            let attribute: any;
            
            if (isEcoreTs) {
                attribute = EAttribute.create({
                    name: attributeName,
                    eType: finalEType,
                    lowerBound: lowerBound,
                    upperBound: upperBound,
                    unique: true,
                    ordered: false
                });
                if (structuralFeatures && typeof structuralFeatures.add === 'function') {
                    structuralFeatures.add(attribute);
                }
            } else {
                // For plain JS objects, determine the eTypeValue based on what we found
                let eTypeValue: any;
                
                if (isEEnum(finalEType)) {
                    // It's an enum object, use it directly
                    eTypeValue = finalEType;
                } else if (typeof finalEType === 'object' && finalEType.name) {
                    // It's a built-in type or has a name property
                    const builtInTypes = ['EString', 'EInt', 'EBoolean', 'EDouble', 'EFloat', 'ELong', 'EDate'];
                    if (builtInTypes.includes(finalEType.name)) {
                        eTypeValue = { name: finalEType.name };
                    } else {
                        // Might be an enum that wasn't recognized - try finding it one more time
                        const enumCheck = this.findEEnum(finalEType.name);
                        if (enumCheck) {
                            eTypeValue = enumCheck;
                        } else {
                            eTypeValue = { name: finalEType.name };
                        }
                    }
                } else {
                    // Final fallback
                    eTypeValue = { name: attributeType };
                }
                
                attribute = {
                    name: attributeName,
                    eType: eTypeValue,
                    lowerBound: lowerBound,
                    upperBound: upperBound,
                    unique: true,
                    ordered: false,
                    get: function(key: string) {
                        return (this as any)[key];
                    },
                    set: function(key: string, value: any) {
                        (this as any)[key] = value;
                    }
                };
                if (!Array.isArray(eClass.eAttributes)) {
                    eClass.eAttributes = [];
                }
                eClass.eAttributes.push(attribute);
                if (Array.isArray(eClass.eStructuralFeatures)) {
                    eClass.eStructuralFeatures.push(attribute);
                }
            }

            console.log(`Added attribute '${attributeName}' (${attributeType}) to class '${className}'`);

            return {
                success: true,
                message: `Successfully added attribute '${attributeName}' to class '${className}'`
            };
        } catch (error) {
            return {
                success: false,
                message: `Failed to add attribute: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    updateAttribute(
        className: string,
        originalAttributeName: string,
        attributeName: string,
        attributeType: string,
        lowerBound: number,
        upperBound: number
    ): { success: boolean; message?: string } {
        try {
            const eClass = this.findEClass(className);
            if (!eClass) {
                return {
                    success: false,
                    message: `Class '${className}' not found in active metamodel`
                };
            }

            const trimmedName = attributeName.trim();
            if (!trimmedName) {
                return {
                    success: false,
                    message: 'Attribute name cannot be empty'
                };
            }

            if (trimmedName !== originalAttributeName) {
                this.validateName(trimmedName);
            }

            if (!Number.isFinite(lowerBound) || !Number.isFinite(upperBound)) {
                return {
                    success: false,
                    message: 'Attribute bounds must be numbers'
                };
            }

            const featuresSource = typeof eClass.get === 'function'
                ? eClass.get('eStructuralFeatures')
                : eClass.eStructuralFeatures || [];

            const featureArray: any[] = [];
            if (featuresSource) {
                if (Array.isArray(featuresSource)) {
                    featureArray.push(...featuresSource);
                } else if (typeof featuresSource.forEach === 'function') {
                    featuresSource.forEach((item: any) => {
                        if (item) {
                            featureArray.push(item);
                        }
                    });
                } else {
                    try {
                        featureArray.push(...Array.from(featuresSource));
                    } catch {
                        // ignore if conversion fails
                    }
                }
            }

            const targetAttr = featureArray.find(feature => {
                if (!feature || !isEAttribute(feature)) {
                    return false;
                }
                const featureName = typeof feature.get === 'function' ? feature.get('name') : feature.name;
                return featureName === originalAttributeName;
            });

            if (!targetAttr) {
                return {
                    success: false,
                    message: `Attribute '${originalAttributeName}' not found in class '${className}'`
                };
            }

            const hasConflict = featureArray.some(feature => {
                if (!feature || feature === targetAttr || !isEAttribute(feature)) {
                    return false;
                }
                const featureName = typeof feature.get === 'function' ? feature.get('name') : feature.name;
                return featureName === trimmedName;
            });

            if (hasConflict) {
                return {
                    success: false,
                    message: `Another attribute named '${attributeName}' already exists in class '${className}'`
                };
            }

            const eType = this.mapAttributeTypeToEcoreType(attributeType);

            if (typeof targetAttr.set === 'function') {
                targetAttr.set('name', trimmedName);
                targetAttr.set('eType', eType);
                targetAttr.set('lowerBound', lowerBound);
                targetAttr.set('upperBound', upperBound);
            } else {
                // For plain JS objects, use the eType returned from mapAttributeTypeToEcoreType
                // This ensures enum types are properly set instead of just using { name: attributeType }
                let eTypeValue: any;
                if (isEEnum(eType)) {
                    // If it's an enum, use the actual enum object
                    eTypeValue = eType;
                } else if (typeof eType === 'object' && eType.name) {
                    // If it's a built-in type with a name property, use it
                    eTypeValue = { name: eType.name };
                } else {
                    // Fallback to just the name
                    eTypeValue = { name: attributeType };
                }
                
                const originalNameNormalized = targetAttr.name;
                targetAttr.name = trimmedName;
                targetAttr.eType = eTypeValue;
                targetAttr.lowerBound = lowerBound;
                targetAttr.upperBound = upperBound;

                if (Array.isArray((eClass as any).eAttributes)) {
                    const attrEntry = (eClass as any).eAttributes.find((entry: any) => entry.name === originalNameNormalized);
                    if (attrEntry) {
                        attrEntry.name = trimmedName;
                        attrEntry.eType = eTypeValue;
                        attrEntry.lowerBound = lowerBound;
                        attrEntry.upperBound = upperBound;
                    }
                }
            }

            return {
                success: true,
                message: `Updated attribute '${originalAttributeName}' in class '${className}'`
            };
        } catch (error) {
            return {
                success: false,
                message: `Failed to update attribute: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    /**
     * Maps attribute type name to ecore-ts type object.
     */
    private mapAttributeTypeToEcoreType(typeName: string): any {
        // First check for built-in types
        switch (typeName) {
            case 'EString':
                return EString;
            case 'EInt':
                const { EInt } = require('ecore-ts');
                return EInt;
            case 'EBoolean':
                const { EBoolean } = require('ecore-ts');
                return EBoolean;
            case 'EDouble':
                const { EDouble } = require('ecore-ts');
                return EDouble;
            case 'EFloat':
                const { EFloat } = require('ecore-ts');
                return EFloat;
            case 'ELong':
                const { ELong } = require('ecore-ts');
                return ELong;
            case 'EDate':
                const { EDate } = require('ecore-ts');
                return EDate;
            default:
                // Check if it's an enum type in the metamodel
                const enumType = this.findEEnum(typeName);
                if (enumType) {
                    return enumType;
                }
                // Default to EString if type not recognized
                return EString;
        }
    }

    /**
     * Gets all EEnums from the active metamodel.
     * @returns Array of all EEnums
     */
    getAllEEnums(): any[] {
        const activeMetamodel = this.getActiveMetamodel();
        if (!activeMetamodel) {
            return [];
        }

        const enums: any[] = [];
        for (const pkg of activeMetamodel.ePackages) {
            // Handle both ecore-ts EList and plain arrays
            let classifiers: any[];
            if (typeof (pkg as any).get === 'function') {
                // ecore-ts EPackage - get eClassifiers using get()
                const eClassifiers = (pkg as any).get('eClassifiers');
                classifiers = toArray(eClassifiers);
            } else {
                // Plain JS package
                classifiers = toArray(pkg.eClassifiers);
            }
            
            for (const classifier of classifiers) {
                let isEnumCheck = isEEnum(classifier);
                
                // Check if this might be an enum that's missing eClass structure
                // This can happen if enums were created incorrectly or loaded from JSON
                if (!isEnumCheck) {
                    // Check if it has eLiterals (indicating it might be an enum)
                    const hasELiterals = classifier.eLiterals || (classifier.get && classifier.get('eLiterals'));
                    if (hasELiterals) {
                        // Fix the structure
                        if (!classifier.eClass) {
                            classifier.eClass = {};
                        }
                        if (!classifier.eClass.values) {
                            classifier.eClass.values = {};
                        }
                        classifier.eClass.values.name = 'EEnum';
                        isEnumCheck = true;
                    }
                }
                
                if (isEnumCheck) {
                    enums.push(classifier);
                }
            }
        }
        
        return enums;
    }

    /**
     * Deletes an attribute from an existing EClass.
     * @param className The name of the class to delete the attribute from
     * @param attributeName The name of the attribute to delete
     * @returns Success status and message
     */
    deleteAttribute(className: string, attributeName: string): { success: boolean; message?: string } {
        try {
            // Find the class
            const eClass = this.findEClass(className);
            if (!eClass) {
                return {
                    success: false,
                    message: `Class '${className}' not found in active metamodel`
                };
            }

            const structuralFeatures = typeof eClass.get === 'function'
                ? eClass.get('eStructuralFeatures')
                : eClass.eStructuralFeatures;
            const isEcoreTs = !!structuralFeatures && typeof structuralFeatures.add === 'function';

            if (isEcoreTs) {
                const list = toArray(structuralFeatures);
                const attributeToRemove = list.find((feature: any) => {
                    const featureName = feature.get?.('name');
                    const isAttr = feature.eClass?.values?.name === 'EAttribute';
                    return featureName === attributeName && isAttr;
                });

                if (!attributeToRemove) {
                    return {
                        success: false,
                        message: `Attribute '${attributeName}' not found in class '${className}'`
                    };
                }

                if (typeof structuralFeatures.remove === 'function') {
                    structuralFeatures.remove(attributeToRemove);
                    console.log(`Removed attribute using EList.remove()`);
                } else {
                    const remaining = list.filter((feature: any) => feature !== attributeToRemove);
                    if (typeof structuralFeatures.clear === 'function') {
                        structuralFeatures.clear();
                        remaining.forEach((item: any) => structuralFeatures.add?.(item));
                    }
                }
            } else {
                let removed = false;
                if (Array.isArray(eClass.eAttributes)) {
                    const attributeIndex = eClass.eAttributes.findIndex((f: any) => f.name === attributeName);
                    if (attributeIndex !== -1) {
                        eClass.eAttributes.splice(attributeIndex, 1);
                        removed = true;
                    }
                }

                if (Array.isArray(eClass.eStructuralFeatures)) {
                    const sfIndex = eClass.eStructuralFeatures.findIndex((f: any) => f.name === attributeName);
                    if (sfIndex !== -1) {
                        eClass.eStructuralFeatures.splice(sfIndex, 1);
                        removed = true;
                    }
                }

                if (!removed) {
                    return {
                        success: false,
                        message: `Attribute '${attributeName}' not found in class '${className}'`
                    };
                }
            }

            console.log(`Deleted attribute '${attributeName}' from class '${className}'`);

            return {
                success: true,
                message: `Successfully deleted attribute '${attributeName}' from class '${className}'`
            };
        } catch (error) {
            return {
                success: false,
                message: `Failed to delete attribute: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    /**
     * Serialize metamodel to JSON, handling circular references.
     */
    private serializeMetamodelToJSON(metamodel: any): string {
        // Skip the complex serialization and go directly to simplified version
        // since the Ecore objects have a complex structure that's hard to serialize
        return this.serializeSimplifiedMetamodel(metamodel);
    }

    /**
     * Fallback serialization that creates a simplified version of the metamodel.
     */
    private serializeSimplifiedMetamodel(metamodel: any): string {
        const simplified: any = {
            ePackages: []
        };
        const globalEnumNames = new Set<string>();

        try {
            // Extract packages - use direct property access instead of .get()
            if (metamodel.ePackages) {
                for (const pkg of metamodel.ePackages) {
                    const packageData: any = {
                        name: pkg.name || pkg.get?.('name'),
                        nsURI: pkg.nsURI || pkg.get?.('nsURI'),
                        nsPrefix: pkg.nsPrefix || pkg.get?.('nsPrefix'),
                        eClassifiers: []
                    };

                    // Extract classifiers - handle both array and EList
                    const classifiers = pkg.eClassifiers || pkg.get?.('eClassifiers');
                    if (classifiers) {
                        
                        let classifierArray: any[] = [];
                        if (Array.isArray(classifiers)) {
                            classifierArray = classifiers;
                        } else if (classifiers.size && typeof classifiers.size === 'function') {
                            // It's an EList - try different iteration methods
                            
                            // Method 1: Try forEach if available
                            if (typeof classifiers.forEach === 'function') {
                                classifiers.forEach((item: any) => {
                                    if (item) classifierArray.push(item);
                                });
                            }
                            // Method 2: Try iterator if available
                            else if (typeof classifiers[Symbol.iterator] === 'function') {
                                try {
                                    for (const item of classifiers) {
                                        if (item) classifierArray.push(item);
                                    }
                                } catch (e) {
                                    // Iterator failed, continue with other methods
                                }
                            }
                            // Method 3: Try accessing internal array if available
                            else if (classifiers._internal && Array.isArray(classifiers._internal)) {
                                classifierArray = classifiers._internal.filter((item: any) => item != null);
                            }
                            // Method 4: Try get method (fallback)
                            else if (classifiers.get && typeof classifiers.get === 'function') {
                                for (let i = 0; i < classifiers.size(); i++) {
                                    const item = classifiers.get(i);
                                    if (item) classifierArray.push(item);
                                }
                            }
                            // Method 5: Try to iterate as an iterable
                            else {
                                try {
                                    classifierArray = Array.from(classifiers).filter((item: any) => item != null);
                                } catch (e) {
                                    // Array.from failed, continue with other methods
                                    classifierArray = [];
                                }
                            }
                        } else {
                            // Try to iterate as an iterable
                            try {
                                classifierArray = Array.from(classifiers);
                            } catch (e) {
                                // Could not convert classifiers to array
                                classifierArray = [];
                            }
                        }
                        
                        
                        for (let i = 0; i < classifierArray.length; i++) {
                            const classifier = classifierArray[i];
                            
                            if (!classifier) {
                                continue;
                            }
                            
                            // Check if this is an EEnum
                            const isEnumCheck = isEEnum(classifier);
                            
                            if (isEnumCheck) {
                                // Serialize as EEnum with the proper structure
                                const enumName = classifier.get?.('name') || classifier.name;
                                if (enumName) {
                                    globalEnumNames.add(enumName);
                                }
                                const eLiterals = classifier.eLiterals || classifier.get?.('eLiterals');
                                
                                const enumData: any = {
                                    eClass: 'ecore:EEnum',
                                    name: enumName,
                                    eLiterals: []
                                };
                                
                                // Extract enum literals
                                if (eLiterals) {
                                    let literalArray: any[] = [];
                                    if (Array.isArray(eLiterals)) {
                                        literalArray = eLiterals;
                                    } else if (typeof eLiterals.forEach === 'function') {
                                        eLiterals.forEach((item: any) => {
                                            if (item) literalArray.push(item);
                                        });
                                    } else if (eLiterals.size && typeof eLiterals.size === 'function') {
                                        for (let j = 0; j < eLiterals.size(); j++) {
                                            const item = eLiterals.get(j);
                                            if (item) literalArray.push(item);
                                        }
                                    } else {
                                        try {
                                            literalArray = Array.from(eLiterals).filter((item: any) => item != null);
                                        } catch (e) {
                                            literalArray = [];
                                        }
                                    }
                                    
                                    // Serialize each literal with name, value, and literal properties
                                    for (const literal of literalArray) {
                                        if (!literal) continue;
                                        
                                        const literalName = literal.name || literal.get?.('name') || '';
                                        const literalValue = literal.value !== undefined 
                                            ? (literal.value !== null ? literal.value : (literal.get?.('value') ?? literal.value))
                                            : (literal.get?.('value') ?? undefined);
                                        const literalString = literal.literal || literal.get?.('literal') || literalName;
                                        
                                        enumData.eLiterals.push({
                                            name: literalName,
                                            value: literalValue !== undefined ? literalValue : enumData.eLiterals.length,
                                            literal: literalString
                                        });
                                    }
                                }
                                
                                packageData.eClassifiers.push(enumData);
                                continue;
                            }
                            
                            // Serialize as EClass
                            const classifierData: any = {
                                name: classifier.get?.('name') || classifier.name,
                                abstract: classifier.get?.('abstract') || classifier.abstract,
                                interface: classifier.get?.('interface') || classifier.interface
                            };
                            

                            // Extract structural features and separate into attributes and references
                            const features = classifier.eStructuralFeatures || classifier.get?.('eStructuralFeatures');
                            if (features) {
                                classifierData.eAttributes = [];
                                classifierData.eReferences = [];
                                
                                let featureArray: any[] = [];
                                if (Array.isArray(features)) {
                                    featureArray = features;
                                } else if (features.size && typeof features.size === 'function') {
                                    // It's an EList - try different iteration methods
                                    // Method 1: Try forEach if available
                                    if (typeof features.forEach === 'function') {
                                        features.forEach((item: any) => {
                                            if (item) featureArray.push(item);
                                        });
                                    }
                                    // Method 2: Try iterator if available
                                    else if (typeof features[Symbol.iterator] === 'function') {
                                        try {
                                            for (const item of features) {
                                                if (item) featureArray.push(item);
                                            }
                                        } catch (e) {
                                            // Features iterator failed
                                        }
                                    }
                                    // Method 3: Try accessing internal array if available
                                    else if (features._internal && Array.isArray(features._internal)) {
                                        featureArray = features._internal.filter((item: any) => item != null);
                                    }
                                    // Method 4: Try get method (fallback)
                                    else if (features.get && typeof features.get === 'function') {
                                        for (let i = 0; i < features.size(); i++) {
                                            const item = features.get(i);
                                            if (item) featureArray.push(item);
                                        }
                                    }
                                    // Method 5: Try to iterate as an iterable
                                    else {
                                        try {
                                            featureArray = Array.from(features).filter((item: any) => item != null);
                                        } catch (e) {
                                            // Features Array.from failed
                                            featureArray = [];
                                        }
                                    }
                                } else {
                                    // Try to iterate as an iterable
                                    try {
                                        featureArray = Array.from(features);
                                    } catch (e) {
                                        // Could not convert features to array
                                        featureArray = [];
                                    }
                                }
                                
                                for (const feature of featureArray) {
                                    if (!feature) continue;
                                    
                                    const featureData: any = {
                                        name: feature.name || feature.get?.('name'),
                                        lowerBound: feature.lowerBound || feature.get?.('lowerBound'),
                                        upperBound: feature.upperBound || feature.get?.('upperBound'),
                                        unique: feature.unique || feature.get?.('unique'),
                                        ordered: feature.ordered || feature.get?.('ordered')
                                    };

                                    // Handle eType
                                    const eType = feature.eType || feature.get?.('eType');
                                    if (eType) {
                                        featureData.eType = {
                                            name: eType.name || eType.get?.('name')
                                        };
                                    }

                                    // Handle containment and container
                                    if (feature.containment !== undefined) {
                                        featureData.containment = feature.containment;
                                    } else if (feature.get?.('containment') !== undefined) {
                                        featureData.containment = feature.get('containment');
                                    }
                                    
                                    if (feature.container !== undefined) {
                                        featureData.container = feature.container;
                                    } else if (feature.get?.('container') !== undefined) {
                                        featureData.container = feature.get('container');
                                    }

                                    // Handle eOpposite for bidirectional references
                                    const eOpposite = feature.eOpposite || feature.get?.('eOpposite');
                                    if (eOpposite) {
                                        const oppositeName = eOpposite.name || eOpposite.get?.('name');
                                        if (oppositeName) {
                                            featureData.eOpposite = {
                                                name: oppositeName
                                            };
                                        }
                                    }

                                    // Determine if it's an attribute or reference based on eType
                                    const typeName = eType?.name || eType?.get?.('name');
                                    const isPrimitive =
                                        typeName &&
                                        (typeName.startsWith('E') || ['String', 'Integer', 'Boolean', 'Double'].includes(typeName));

                                    const isEnumType =
                                        (eType && (isEEnum(eType) || eType.eClass === 'ecore:EEnum' || Array.isArray(eType.eLiterals))) ||
                                        (typeName ? globalEnumNames.has(typeName) : false);

                                    if (isPrimitive || isEnumType) {
                                        // Attribute (primitives or enums)
                                        classifierData.eAttributes.push(featureData);
                                    } else {
                                        // Reference
                                        classifierData.eReferences.push(featureData);
                                    }
                                }
                            } else {
                                // No features found, initialize empty arrays
                                classifierData.eAttributes = [];
                                classifierData.eReferences = [];
                            }

                            // Extract super types
                            const superTypes = classifier.eSuperTypes || classifier.get?.('eSuperTypes');
                            if (superTypes) {
                                classifierData.eSuperTypes = [];
                                
                                let superTypeArray: any[] = [];
                                if (Array.isArray(superTypes)) {
                                    superTypeArray = superTypes;
                                } else if (superTypes.size && typeof superTypes.size === 'function') {
                                    // It's an EList - try different iteration methods
                                    // Method 1: Try forEach if available
                                    if (typeof superTypes.forEach === 'function') {
                                        superTypes.forEach((item: any) => {
                                            if (item) superTypeArray.push(item);
                                        });
                                    }
                                    // Method 2: Try iterator if available
                                    else if (typeof superTypes[Symbol.iterator] === 'function') {
                                        try {
                                            for (const item of superTypes) {
                                                if (item) superTypeArray.push(item);
                                            }
                                        } catch (e) {
                                            // SuperTypes iterator failed
                                        }
                                    }
                                    // Method 3: Try accessing internal array if available
                                    else if (superTypes._internal && Array.isArray(superTypes._internal)) {
                                        superTypeArray = superTypes._internal.filter((item: any) => item != null);
                                    }
                                    // Method 4: Try get method (fallback)
                                    else if (superTypes.get && typeof superTypes.get === 'function') {
                                        for (let i = 0; i < superTypes.size(); i++) {
                                            const item = superTypes.get(i);
                                            if (item) superTypeArray.push(item);
                                        }
                                    }
                                    // Method 5: Try to iterate as an iterable
                                    else {
                                        try {
                                            superTypeArray = Array.from(superTypes).filter((item: any) => item != null);
                                        } catch (e) {
                                            // SuperTypes Array.from failed
                                            superTypeArray = [];
                                        }
                                    }
                                } else {
                                    // Try to iterate as an iterable
                                    try {
                                        superTypeArray = Array.from(superTypes);
                                    } catch (e) {
                                        // Could not convert superTypes to array
                                        superTypeArray = [];
                                    }
                                }
                                
                                for (const superType of superTypeArray) {
                                    if (superType) {
                                        classifierData.eSuperTypes.push({
                                            name: superType.name || superType.get?.('name')
                                        });
                                    }
                                }
                            } else {
                                // No super types found, initialize empty array
                                classifierData.eSuperTypes = [];
                            }

                            packageData.eClassifiers.push(classifierData);
                        }
                        
                    }

                    simplified.ePackages.push(packageData);
                }
            }

            return JSON.stringify(simplified, null, 2);
        } catch (error) {
            // Failed to create simplified metamodel
            return JSON.stringify({ error: 'Failed to serialize metamodel', details: error instanceof Error ? error.message : String(error) }, null, 2);
        }
    }
}

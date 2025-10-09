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
import { EcoreModel, isEClass, isEAttribute, isEReference } from './ecore-types';

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
            (pkg.get('eClassifiers') as any).forEach((classifier: any) => {
                if (isEClass(classifier)) {
                    eClasses.push(classifier);
                }
            });
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
    saveMetamodel(filename?: string, format: 'json' | 'ecore' = 'json'): { success: boolean; message: string; content?: string } {
        
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

            return {
                success: true,
                message: `Metamodel saved successfully as ${finalFilename}`,
                content: content
            };
        } catch (error) {
            return {
                success: false,
                message: `Failed to save metamodel: ${error instanceof Error ? error.message : String(error)}`
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

                                    // Determine if it's an attribute or reference based on eType
                                    // If eType is a primitive type (EString, EInt, etc.), it's an attribute
                                    // If eType is a class, it's a reference
                                    const typeName = eType?.name || eType?.get?.('name');
                                    if (typeName && (typeName.startsWith('E') || ['String', 'Integer', 'Boolean', 'Double'].includes(typeName))) {
                                        // It's an attribute
                                        classifierData.eAttributes.push(featureData);
                                    } else {
                                        // It's a reference
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

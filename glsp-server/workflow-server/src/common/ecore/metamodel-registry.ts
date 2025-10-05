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
import { EcoreModel, EPackage, EClass, isEClass } from './ecore-types';

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
        console.log(`Registering metamodel with key: ${key}`);
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
    findEClass(className: string): EClass | undefined {
        const activeMetamodel = this.getActiveMetamodel();
        if (!activeMetamodel) {
            return undefined;
        }

        for (const pkg of activeMetamodel.ePackages) {
            for (const classifier of pkg.eClassifiers) {
                if (isEClass(classifier) && classifier.name === className) {
                    return classifier;
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
    findEClassInMetamodel(metamodelKey: string, className: string): EClass | undefined {
        const metamodel = this.getMetamodel(metamodelKey);
        if (!metamodel) {
            return undefined;
        }

        for (const pkg of metamodel.ePackages) {
            for (const classifier of pkg.eClassifiers) {
                if (isEClass(classifier) && classifier.name === className) {
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
    getAllEClasses(): EClass[] {
        const activeMetamodel = this.getActiveMetamodel();
        if (!activeMetamodel) {
            return [];
        }

        const eClasses: EClass[] = [];
        for (const pkg of activeMetamodel.ePackages) {
            for (const classifier of pkg.eClassifiers) {
                if (isEClass(classifier)) {
                    eClasses.push(classifier);
                }
            }
        }

        return eClasses;
    }

    /**
     * Gets all packages from the active metamodel.
     * @returns Array of all packages
     */
    getAllPackages(): EPackage[] {
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
}

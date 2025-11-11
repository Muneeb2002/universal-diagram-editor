/********************************************************************************
 * Copyright (c) 2024 Eclipse GLSP and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * SPDX-License-Identifier: EPL-2.0
 ********************************************************************************/

/**
 * Re-export types from ecore-ts library
 * This provides the complete Ecore metamodel implementation
 */

// Re-export all from ecore-ts
export * from 'ecore-ts';

// Additional convenience types for our implementation
export interface EcoreModel {
    ePackages: any[]; // Using any[] since ecore-ts instances are complex
}

// Type guards using ecore-ts instances and custom objects
export function isEClass(classifier: any): boolean {
    // Check for real Ecore objects
    if (classifier && classifier.eClass && classifier.eClass.values && classifier.eClass.values.name === 'EClass') {
        return true;
    }
    
    // Check for custom EClass objects (created by our custom metamodel creation)
    // Custom EClass objects have name, abstract, interface properties and get/set methods
    if (classifier && 
        typeof classifier.name === 'string' && 
        typeof classifier.abstract === 'boolean' && 
        typeof classifier.interface === 'boolean' &&
        typeof classifier.get === 'function' &&
        typeof classifier.set === 'function') {
        return true;
    }
    
    // Check for JSON-loaded EClass objects (from metamodel files)
    // JSON-loaded classes have name, abstract, interface properties but no get/set methods
    if (classifier && 
        typeof classifier.name === 'string' && 
        typeof classifier.abstract === 'boolean' && 
        typeof classifier.interface === 'boolean' &&
        Array.isArray(classifier.eAttributes) &&
        Array.isArray(classifier.eReferences) &&
        Array.isArray(classifier.eSuperTypes)) {
        return true;
    }
    
    return false;
}

export function isEDataType(classifier: any): boolean {
    return classifier && classifier.eClass && classifier.eClass.values && classifier.eClass.values.name === 'EDataType';
}

export function isEEnum(classifier: any): boolean {
    return classifier && classifier.eClass && classifier.eClass.values && classifier.eClass.values.name === 'EEnum';
}

export function isEAttribute(feature: any): boolean {
    // Check for real Ecore objects
    if (feature && feature.eClass && feature.eClass.values && feature.eClass.values.name === 'EAttribute') {
        return true;
    }
    
    // Check for custom EAttribute objects (created by our custom metamodel creation)
    // Custom EAttribute objects have name, eType, lowerBound, upperBound properties and get/set methods
    // BUT they should NOT have a containment property (that's for references)
    if (feature && 
        typeof feature.name === 'string' && 
        feature.eType && 
        typeof feature.lowerBound === 'number' && 
        typeof feature.upperBound === 'number' &&
        typeof feature.get === 'function' &&
        typeof feature.set === 'function' &&
        !('containment' in feature)) {  // Exclude references which have containment property
        return true;
    }
    
    // Check for plain JSON objects
    if (
        feature &&
        typeof feature.name === 'string' &&
        feature.eType !== undefined &&
        typeof feature.lowerBound === 'number' &&
        typeof feature.upperBound === 'number' &&
        !('containment' in feature)
    ) {
        return true;
    }

    return false;
}

export function isEReference(feature: any): boolean {
    // Check for real Ecore EReference objects
    if (feature && feature.eClass && feature.eClass.values && feature.eClass.values.name === 'EReference') {
        return true;
    }
    
    // Check for custom EReference objects (created by our metamodel registry)
    if (feature && 
        typeof feature.name === 'string' && 
        feature.eType && 
        typeof feature.containment === 'boolean' &&
        typeof feature.get === 'function' &&
        typeof feature.set === 'function') {
        return true;
    }
    
    // Check for plain JSON objects
    if (
        feature &&
        typeof feature.name === 'string' &&
        feature.eType !== undefined &&
        (typeof feature.containment === 'boolean' || feature.containment === undefined)
    ) {
        return true;
    }

    return false;
}

export function isEStructuralFeature(element: any): boolean {
    return element && element.eClass && element.eClass.values && 
           (element.eClass.values.name === 'EStructuralFeature' || 
            element.eClass.values.name === 'EAttribute' || 
            element.eClass.values.name === 'EReference');
}


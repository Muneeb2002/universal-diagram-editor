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

// Type guards using ecore-ts instances
export function isEClass(classifier: any): boolean {
    return classifier && classifier.eClass && classifier.eClass.values && classifier.eClass.values.name === 'EClass';
}

export function isEDataType(classifier: any): boolean {
    return classifier && classifier.eClass && classifier.eClass.values && classifier.eClass.values.name === 'EDataType';
}

export function isEEnum(classifier: any): boolean {
    return classifier && classifier.eClass && classifier.eClass.values && classifier.eClass.values.name === 'EEnum';
}

export function isEAttribute(feature: any): boolean {
    return feature && feature.eClass && feature.eClass.values && feature.eClass.values.name === 'EAttribute';
}

export function isEReference(feature: any): boolean {
    return feature && feature.eClass && feature.eClass.values && feature.eClass.values.name === 'EReference';
}

export function isEStructuralFeature(element: any): boolean {
    return element && element.eClass && element.eClass.values && 
           (element.eClass.values.name === 'EStructuralFeature' || 
            element.eClass.values.name === 'EAttribute' || 
            element.eClass.values.name === 'EReference');
}


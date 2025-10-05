/********************************************************************************
 * Copyright (c) 2024 Eclipse GLSP and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * SPDX-License-Identifier: EPL-2.0
 ********************************************************************************/

export interface EcoreModel {
    ePackages: EPackage[];
}

export interface EPackage {
    name: string;
    nsURI: string;
    nsPrefix: string;
    eClassifiers: EClassifier[];
}

export interface EClassifier {
    name: string;
}

export interface EClass extends EClassifier {
    eAttributes: EAttribute[];
    eReferences: EReference[];
    eSuperTypes: EClass[];
    abstract: boolean;
    interface: boolean;
}

export interface EAttribute {
    name: string;
    eType: EDataType;
    lowerBound: number;
    upperBound: number;
    unique: boolean;
    ordered: boolean;
}

export interface EReference {
    name: string;
    eType: EClass;
    eContainingClass: EClass;
    containment: boolean;
    container: boolean;
    opposite?: EReference;
    lowerBound: number;
    upperBound: number;
}

export interface EDataType extends EClassifier {
    instanceClassName: string;
}

export interface EEnum extends EClassifier {
    eLiterals: EEnumLiteral[];
}

export interface EEnumLiteral {
    name: string;
    value: number;
}

export interface EOperation extends EClassifier {
    eParameters: EParameter[];
    eType: EClassifier;
}

export interface EParameter {
    name: string;
    eType: EClassifier;
}

export function isEClass(classifier: EClassifier): classifier is EClass {
    return 'eAttributes' in classifier && 'eReferences' in classifier;
}

export function isEDataType(classifier: EClassifier): classifier is EDataType {
    return 'instanceClassName' in classifier;
}

export function isEEnum(classifier: EClassifier): classifier is EEnum {
    return 'eLiterals' in classifier;
}


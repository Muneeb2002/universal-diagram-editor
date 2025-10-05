/********************************************************************************
 * Copyright (c) 2024 Eclipse GLSP and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * SPDX-License-Identifier: EPL-2.0
 ********************************************************************************/

import { parseString } from 'xml2js';
import { injectable } from 'inversify';
import {
    EcoreModel,
    EPackage,
    EClass,
    EAttribute,
    EReference,
    EDataType,
    EEnum
} from './ecore-types';

@injectable()
export class EcoreParser {
    async parseEcoreFile(filePath: string): Promise<EcoreModel> {
        const fs = require('fs');
        const xmlContent = fs.readFileSync(filePath, 'utf8');
        return this.parseEcoreXml(xmlContent);
    }

    async parseEcoreXml(xmlContent: string): Promise<EcoreModel> {
        return new Promise((resolve, reject) => {
            parseString(xmlContent, { explicitArray: false }, (err: any, result: any) => {
                if (err) {
                    reject(err);
                    return;
                }
                try {
                    const ecoreModel = this.convertToEcoreModel(result);
                    resolve(ecoreModel);
                } catch (error) {
                    reject(error);
                }
            });
        });
    }

    private convertToEcoreModel(xmlResult: any): EcoreModel {
        console.log('XML parsing result:', JSON.stringify(xmlResult, null, 2));

        const ecoreModel: EcoreModel = {
            ePackages: []
        };

        // Check for different possible XML structures
        let packages: any[] = [];

        if (xmlResult['ecore:EPackage']) {
            // Namespaced ePackage (most common case)
            packages = Array.isArray(xmlResult['ecore:EPackage'])
                ? xmlResult['ecore:EPackage']
                : [xmlResult['ecore:EPackage']];
        } else if (xmlResult.ePackage) {
            // Direct ePackage at root level
            packages = Array.isArray(xmlResult.ePackage)
                ? xmlResult.ePackage
                : [xmlResult.ePackage];
        } else if (xmlResult.ecore && xmlResult.ecore.ePackage) {
            packages = Array.isArray(xmlResult.ecore.ePackage)
                ? xmlResult.ecore.ePackage
                : [xmlResult.ecore.ePackage];
        }

        console.log('Found packages:', packages);
        ecoreModel.ePackages = packages.map((pkg: any) => this.convertToEPackage(pkg));

        return ecoreModel;
    }

    private convertToEPackage(pkgXml: any): EPackage {
        const pkg: EPackage = {
            name: pkgXml.$.name || '',
            nsURI: pkgXml.$.nsURI || '',
            nsPrefix: pkgXml.$.nsPrefix || '',
            eClassifiers: []
        };

        if (pkgXml.eClassifiers) {
            let classifiers: any[] = [];

            if (Array.isArray(pkgXml.eClassifiers)) {
                // eClassifiers is directly an array
                classifiers = pkgXml.eClassifiers;
            } else if (pkgXml.eClassifiers.eClassifier) {
                // eClassifiers contains eClassifier elements
                classifiers = Array.isArray(pkgXml.eClassifiers.eClassifier)
                    ? pkgXml.eClassifiers.eClassifier
                    : [pkgXml.eClassifiers.eClassifier];
            }

            pkg.eClassifiers = classifiers.map((classifier: any) => this.convertToEClassifier(classifier));
        }

        return pkg;
    }

    private convertToEClassifier(classifierXml: any): any {
        if (classifierXml.$.xsiType === 'ecore:EClass' || classifierXml.eAttributes || classifierXml.eReferences) {
            return this.convertToEClass(classifierXml);
        } else if (classifierXml.$.xsiType === 'ecore:EDataType' || classifierXml.$.instanceClassName) {
            return this.convertToEDataType(classifierXml);
        } else if (classifierXml.$.xsiType === 'ecore:EEnum' || classifierXml.eLiterals) {
            return this.convertToEEnum(classifierXml);
        } else {
            // Default to EClass if type is unclear
            return this.convertToEClass(classifierXml);
        }
    }

    private convertToEClass(classXml: any): EClass {
        const eClass: EClass = {
            name: classXml.$.name || '',
            eAttributes: [],
            eReferences: [],
            eSuperTypes: [],
            abstract: classXml.$.abstract === 'true',
            interface: classXml.$.interface === 'true'
        };

        // Parse structural features (attributes and references)
        if (classXml.eStructuralFeatures) {
            const features = Array.isArray(classXml.eStructuralFeatures)
                ? classXml.eStructuralFeatures
                : [classXml.eStructuralFeatures];

            features.forEach((feature: any) => {
                if (feature.$ && feature.$.xsiType === 'ecore:EAttribute') {
                    eClass.eAttributes.push(this.convertToEAttribute(feature));
                } else if (feature.$ && feature.$.xsiType === 'ecore:EReference') {
                    eClass.eReferences.push(this.convertToEReference(feature));
                }
            });
        }

        // Parse attributes (legacy support)
        if (classXml.eAttributes && classXml.eAttributes.eAttribute) {
            const attributes = Array.isArray(classXml.eAttributes.eAttribute)
                ? classXml.eAttributes.eAttribute
                : [classXml.eAttributes.eAttribute];

            eClass.eAttributes = attributes.map((attr: any) => this.convertToEAttribute(attr));
        }

        // Parse references (legacy support)
        if (classXml.eReferences && classXml.eReferences.eReference) {
            const references = Array.isArray(classXml.eReferences.eReference)
                ? classXml.eReferences.eReference
                : [classXml.eReferences.eReference];

            eClass.eReferences = references.map((ref: any) => this.convertToEReference(ref));
        }

        // Parse super types
        if (classXml.eSuperTypes && classXml.eSuperTypes.eClass) {
            const superTypes = Array.isArray(classXml.eSuperTypes.eClass)
                ? classXml.eSuperTypes.eClass
                : [classXml.eSuperTypes.eClass];

            eClass.eSuperTypes = superTypes.map((superType: any) => ({
                name: superType.$.href ? this.extractClassNameFromHref(superType.$.href) : superType.$.name || '',
                eAttributes: [],
                eReferences: [],
                eSuperTypes: [],
                abstract: false,
                interface: false
            }));
        }

        return eClass;
    }

    private convertToEAttribute(attrXml: any): EAttribute {
        return {
            name: attrXml.$.name || '',
            eType: {
                name: attrXml.$.eType ? this.extractClassNameFromHref(attrXml.$.eType) : 'EString',
                instanceClassName: 'java.lang.String'
            },
            lowerBound: parseInt(attrXml.$.lowerBound) || 0,
            upperBound: parseInt(attrXml.$.upperBound) || 1,
            unique: attrXml.$.unique !== 'false',
            ordered: attrXml.$.ordered !== 'false'
        };
    }

    private convertToEReference(refXml: any): EReference {
        return {
            name: refXml.$.name || '',
            eType: {
                name: refXml.$.eType ? this.extractClassNameFromHref(refXml.$.eType) : 'EClass',
                eAttributes: [],
                eReferences: [],
                eSuperTypes: [],
                abstract: false,
                interface: false
            },
            eContainingClass: {
                name: '',
                eAttributes: [],
                eReferences: [],
                eSuperTypes: [],
                abstract: false,
                interface: false
            },
            containment: refXml.$.containment === 'true',
            container: refXml.$.container === 'true',
            lowerBound: parseInt(refXml.$.lowerBound) || 0,
            upperBound: parseInt(refXml.$.upperBound) || 1
        };
    }

    private convertToEDataType(dataTypeXml: any): EDataType {
        return {
            name: dataTypeXml.$.name || '',
            instanceClassName: dataTypeXml.$.instanceClassName || 'java.lang.Object'
        };
    }

    private convertToEEnum(enumXml: any): EEnum {
        const eEnum: EEnum = {
            name: enumXml.$.name || '',
            eLiterals: []
        };

        if (enumXml.eLiterals && enumXml.eLiterals.eEnumLiteral) {
            const literals = Array.isArray(enumXml.eLiterals.eEnumLiteral)
                ? enumXml.eLiterals.eEnumLiteral
                : [enumXml.eLiterals.eEnumLiteral];

            eEnum.eLiterals = literals.map((literal: any) => ({
                name: literal.$.name || '',
                value: parseInt(literal.$.value) || 0
            }));
        }

        return eEnum;
    }

    private extractClassNameFromHref(href: string): string {
        // Extract class name from href like "#//MyClass" or "ecore:EClass"
        if (href.startsWith('#//')) {
            return href.substring(3);
        } else if (href.startsWith('ecore:')) {
            return href.substring(6);
        }
        return href;
    }

}

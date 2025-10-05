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
import { parseString } from 'xml2js';
import { EcoreModel, EPackage, EClass, EAttribute, EReference, EDataType, EEnum } from './ecore-types';

/**
 * Ecore Parser with reliable JSON parsing and XML support
 * Provides comprehensive validation and normalization
 */
@injectable()
export class EcoreParser {

    /**
     * Parse Ecore JSON content using ecore-ts library
     */
    async parseEcoreJson(jsonContent: string): Promise<EcoreModel> {
        try {
            // Parse JSON content
            const jsonObject = JSON.parse(jsonContent);

            // Validate basic structure
            this.validateBasicStructure(jsonObject);

            // Convert to our internal EcoreModel format
            return this.convertJsonToEcoreModel(jsonObject);

        } catch (error) {
            throw new Error(`Failed to parse Ecore JSON: ${error}`);
        }
    }

    /**
     * Parse Ecore XML file (maintains backward compatibility)
     */
    async parseEcoreFile(filePath: string): Promise<EcoreModel> {
        const fs = require('fs');
        const xmlContent = fs.readFileSync(filePath, 'utf8');
        return this.parseEcoreXml(xmlContent);
    }

    /**
     * Parse Ecore XML content (maintains backward compatibility)
     */
    async parseEcoreXml(xmlContent: string): Promise<EcoreModel> {
        return new Promise((resolve, reject) => {
            parseString(xmlContent, { explicitArray: false }, (err: any, result: any) => {
                if (err) {
                    reject(err);
                    return;
                }
                try {
                    const ecoreModel = this.convertXmlToEcoreModel(result);
                    resolve(ecoreModel);
                } catch (error) {
                    reject(error);
                }
            });
        });
    }

    /**
     * Validate that JSON object has basic Ecore structure
     */
    private validateBasicStructure(jsonObject: any): void {
        if (!jsonObject || typeof jsonObject !== 'object') {
            throw new Error('Root object must be a valid JSON object');
        }

        if (!jsonObject.ePackages) {
            throw new Error('Missing required property: ePackages');
        }

        if (!Array.isArray(jsonObject.ePackages)) {
            throw new Error('ePackages must be an array');
        }

        // Validate each package
        jsonObject.ePackages.forEach((pkg: any, index: number) => {
            this.validateEPackage(pkg, index);
        });
    }

    /**
     * Validate EPackage structure
     */
    private validateEPackage(pkg: any, index: number): void {
        if (!pkg.name || typeof pkg.name !== 'string') {
            throw new Error(`ePackages[${index}]: Missing or invalid name`);
        }

        if (!pkg.nsURI || typeof pkg.nsURI !== 'string') {
            throw new Error(`ePackages[${index}]: Missing or invalid nsURI`);
        }

        if (!pkg.nsPrefix || typeof pkg.nsPrefix !== 'string') {
            throw new Error(`ePackages[${index}]: Missing or invalid nsPrefix`);
        }

        // Validate classifiers if present
        if (pkg.eClassifiers) {
            if (!Array.isArray(pkg.eClassifiers)) {
                throw new Error(`ePackages[${index}]: eClassifiers must be an array`);
            }

            pkg.eClassifiers.forEach((classifier: any, cIndex: number) => {
                this.validateEClassifier(classifier, index, cIndex);
            });
        }
    }

    /**
     * Validate EClassifier structure
     */
    private validateEClassifier(classifier: any, pkgIndex: number, cIndex: number): void {
        if (!classifier.name || typeof classifier.name !== 'string') {
            throw new Error(`ePackages[${pkgIndex}].eClassifiers[${cIndex}]: Missing or invalid name`);
        }

        // Validate attributes if present
        if (classifier.eAttributes) {
            if (!Array.isArray(classifier.eAttributes)) {
                throw new Error(`ePackages[${pkgIndex}].eClassifiers[${cIndex}]: eAttributes must be an array`);
            }

            classifier.eAttributes.forEach((attr: any, aIndex: number) => {
                this.validateEAttribute(attr, pkgIndex, cIndex, aIndex);
            });
        }

        // Validate references if present
        if (classifier.eReferences) {
            if (!Array.isArray(classifier.eReferences)) {
                throw new Error(`ePackages[${pkgIndex}].eClassifiers[${cIndex}]: eReferences must be an array`);
            }

            classifier.eReferences.forEach((ref: any, rIndex: number) => {
                this.validateEReference(ref, pkgIndex, cIndex, rIndex);
            });
        }
    }

    /**
     * Validate EAttribute structure
     */
    private validateEAttribute(attr: any, pkgIndex: number, cIndex: number, aIndex: number): void {
        if (!attr.name || typeof attr.name !== 'string') {
            throw new Error(`ePackages[${pkgIndex}].eClassifiers[${cIndex}].eAttributes[${aIndex}]: Missing or invalid name`);
        }

        if (!attr.eType) {
            throw new Error(`ePackages[${pkgIndex}].eClassifiers[${cIndex}].eAttributes[${aIndex}]: Missing eType`);
        }

        if (typeof attr.lowerBound !== 'number' || attr.lowerBound < 0) {
            throw new Error(`ePackages[${pkgIndex}].eClassifiers[${cIndex}].eAttributes[${aIndex}]: Invalid lowerBound`);
        }

        if (typeof attr.upperBound !== 'number' || (attr.upperBound < -1 && attr.upperBound !== -1)) {
            throw new Error(`ePackages[${pkgIndex}].eClassifiers[${cIndex}].eAttributes[${aIndex}]: Invalid upperBound`);
        }
    }

    /**
     * Validate EReference structure
     */
    private validateEReference(ref: any, pkgIndex: number, cIndex: number, rIndex: number): void {
        if (!ref.name || typeof ref.name !== 'string') {
            throw new Error(`ePackages[${pkgIndex}].eClassifiers[${cIndex}].eReferences[${rIndex}]: Missing or invalid name`);
        }

        if (!ref.eType) {
            throw new Error(`ePackages[${pkgIndex}].eClassifiers[${cIndex}].eReferences[${rIndex}]: Missing eType`);
        }

        if (typeof ref.lowerBound !== 'number' || ref.lowerBound < 0) {
            throw new Error(`ePackages[${pkgIndex}].eClassifiers[${cIndex}].eReferences[${rIndex}]: Invalid lowerBound`);
        }

        if (typeof ref.upperBound !== 'number' || (ref.upperBound < -1 && ref.upperBound !== -1)) {
            throw new Error(`ePackages[${pkgIndex}].eClassifiers[${cIndex}].eReferences[${rIndex}]: Invalid upperBound`);
        }
    }

    /**
     * Convert JSON object to EcoreModel format
     */
    private convertJsonToEcoreModel(jsonObject: any): EcoreModel {
        const ecoreModel: EcoreModel = {
            ePackages: []
        };

        if (jsonObject.ePackages && Array.isArray(jsonObject.ePackages)) {
            ecoreModel.ePackages = jsonObject.ePackages.map((pkg: any) => this.convertJsonToEPackage(pkg));
        }

        return ecoreModel;
    }

    /**
     * Convert JSON package to EPackage format
     */
    private convertJsonToEPackage(pkg: any): EPackage {
        return {
            name: pkg.name || '',
            nsURI: pkg.nsURI || '',
            nsPrefix: pkg.nsPrefix || '',
            eClassifiers: pkg.eClassifiers ? pkg.eClassifiers.map((c: any) => this.convertJsonToEClassifier(c)) : []
        };
    }

    /**
     * Convert JSON classifier to EClassifier format
     */
    private convertJsonToEClassifier(classifier: any): any {
        const normalized: any = {
            name: classifier.name || '',
            abstract: classifier.abstract === true,
            interface: classifier.interface === true
        };

        // Add type-specific properties
        if (classifier.eAttributes) {
            normalized.eAttributes = classifier.eAttributes.map((attr: any) => this.convertJsonToEAttribute(attr));
        }

        if (classifier.eReferences) {
            normalized.eReferences = classifier.eReferences.map((ref: any) => this.convertJsonToEReference(ref));
        }

        if (classifier.eSuperTypes) {
            normalized.eSuperTypes = classifier.eSuperTypes.map((superType: any) => this.normalizeClassifierReference(superType));
        }

        if (classifier.instanceClassName) {
            normalized.instanceClassName = classifier.instanceClassName;
        }

        if (classifier.eLiterals) {
            normalized.eLiterals = classifier.eLiterals.map((literal: any) => ({
                name: literal.name || ''
            }));
        }

        return normalized;
    }

    /**
     * Convert JSON attribute to EAttribute format
     */
    private convertJsonToEAttribute(attr: any): EAttribute {
        return {
            name: attr.name || '',
            eType: this.normalizeClassifierReference(attr.eType),
            lowerBound: typeof attr.lowerBound === 'number' ? attr.lowerBound : 0,
            upperBound: typeof attr.upperBound === 'number' ? attr.upperBound : 1,
            unique: attr.unique !== false,
            ordered: attr.ordered !== false
        };
    }

    /**
     * Convert JSON reference to EReference format
     */
    private convertJsonToEReference(ref: any): EReference {
        return {
            name: ref.name || '',
            eType: this.normalizeClassifierReference(ref.eType),
            eContainingClass: ref.eContainingClass ? this.normalizeClassifierReference(ref.eContainingClass) : undefined,
            containment: ref.containment === true,
            container: ref.container === true,
            lowerBound: typeof ref.lowerBound === 'number' ? ref.lowerBound : 0,
            upperBound: typeof ref.upperBound === 'number' ? ref.upperBound : 1
        };
    }

    /**
     * Normalize classifier reference (handles both full objects and simple name references)
     */
    private normalizeClassifierReference(ref: any): any {
        if (!ref || typeof ref !== 'object') {
            return { name: 'Unknown' };
        }

        return {
            name: ref.name || 'Unknown',
            // Include other properties if they exist
            ...(ref.instanceClassName && { instanceClassName: ref.instanceClassName }),
            ...(ref.eAttributes && { eAttributes: ref.eAttributes }),
            ...(ref.eReferences && { eReferences: ref.eReferences }),
            ...(ref.eSuperTypes && { eSuperTypes: ref.eSuperTypes }),
            ...(ref.abstract !== undefined && { abstract: ref.abstract }),
            ...(ref.interface !== undefined && { interface: ref.interface })
        };
    }

    /**
     * Convert XML result to EcoreModel (maintains backward compatibility)
     */
    private convertXmlToEcoreModel(xmlResult: any): EcoreModel {
        console.log('XML parsing result:', JSON.stringify(xmlResult, null, 2));

        const ecoreModel: EcoreModel = {
            ePackages: []
        };

        // Check for different possible XML structures
        let packages: any[] = [];

        if (xmlResult['ecore:EPackage']) {
            packages = Array.isArray(xmlResult['ecore:EPackage'])
                ? xmlResult['ecore:EPackage']
                : [xmlResult['ecore:EPackage']];
        } else if (xmlResult.ePackage) {
            packages = Array.isArray(xmlResult.ePackage)
                ? xmlResult.ePackage
                : [xmlResult.ePackage];
        } else if (xmlResult.ecore && xmlResult.ecore.ePackage) {
            packages = Array.isArray(xmlResult.ecore.ePackage)
                ? xmlResult.ecore.ePackage
                : [xmlResult.ecore.ePackage];
        }

        console.log('Found packages:', packages);
        ecoreModel.ePackages = packages.map((pkg: any) => this.convertXmlToEPackage(pkg));

        return ecoreModel;
    }

    /**
     * Convert XML package to EPackage (maintains backward compatibility)
     */
    private convertXmlToEPackage(pkgXml: any): EPackage {
        const pkg: EPackage = {
            name: pkgXml.$.name || '',
            nsURI: pkgXml.$.nsURI || '',
            nsPrefix: pkgXml.$.nsPrefix || '',
            eClassifiers: []
        };

        if (pkgXml.eClassifiers) {
            let classifiers: any[] = [];

            if (Array.isArray(pkgXml.eClassifiers)) {
                classifiers = pkgXml.eClassifiers;
            } else if (pkgXml.eClassifiers.eClassifier) {
                classifiers = Array.isArray(pkgXml.eClassifiers.eClassifier)
                    ? pkgXml.eClassifiers.eClassifier
                    : [pkgXml.eClassifiers.eClassifier];
            }

            pkg.eClassifiers = classifiers.map((classifier: any) => this.convertXmlToEClassifier(classifier));
        }

        return pkg;
    }

    /**
     * Convert XML classifier to EClassifier (maintains backward compatibility)
     */
    private convertXmlToEClassifier(classifierXml: any): any {
        if (classifierXml.$.xsiType === 'ecore:EClass' || classifierXml.eAttributes || classifierXml.eReferences) {
            return this.convertXmlToEClass(classifierXml);
        } else if (classifierXml.$.xsiType === 'ecore:EDataType' || classifierXml.$.instanceClassName) {
            return this.convertXmlToEDataType(classifierXml);
        } else if (classifierXml.$.xsiType === 'ecore:EEnum' || classifierXml.eLiterals) {
            return this.convertXmlToEEnum(classifierXml);
        } else {
            return this.convertXmlToEClass(classifierXml);
        }
    }

    /**
     * Convert XML class to EClass (maintains backward compatibility)
     */
    private convertXmlToEClass(classXml: any): EClass {
        const eClass: EClass = {
            name: classXml.$.name || '',
            eAttributes: [],
            eReferences: [],
            eSuperTypes: [],
            abstract: classXml.$.abstract === 'true',
            interface: classXml.$.interface === 'true'
        };

        // Parse structural features
        if (classXml.eStructuralFeatures) {
            const features = Array.isArray(classXml.eStructuralFeatures)
                ? classXml.eStructuralFeatures
                : [classXml.eStructuralFeatures];

            features.forEach((feature: any) => {
                if (feature.$ && feature.$.xsiType === 'ecore:EAttribute') {
                    eClass.eAttributes.push(this.convertXmlToEAttribute(feature));
                } else if (feature.$ && feature.$.xsiType === 'ecore:EReference') {
                    eClass.eReferences.push(this.convertXmlToEReference(feature));
                }
            });
        }

        // Parse attributes (legacy support)
        if (classXml.eAttributes && classXml.eAttributes.eAttribute) {
            const attributes = Array.isArray(classXml.eAttributes.eAttribute)
                ? classXml.eAttributes.eAttribute
                : [classXml.eAttributes.eAttribute];

            eClass.eAttributes = attributes.map((attr: any) => this.convertXmlToEAttribute(attr));
        }

        // Parse references (legacy support)
        if (classXml.eReferences && classXml.eReferences.eReference) {
            const references = Array.isArray(classXml.eReferences.eReference)
                ? classXml.eReferences.eReference
                : [classXml.eReferences.eReference];

            eClass.eReferences = references.map((ref: any) => this.convertXmlToEReference(ref));
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

    /**
     * Convert XML attribute to EAttribute (maintains backward compatibility)
     */
    private convertXmlToEAttribute(attrXml: any): EAttribute {
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

    /**
     * Convert XML reference to EReference (maintains backward compatibility)
     */
    private convertXmlToEReference(refXml: any): EReference {
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

    /**
     * Convert XML data type to EDataType (maintains backward compatibility)
     */
    private convertXmlToEDataType(dataTypeXml: any): EDataType {
        return {
            name: dataTypeXml.$.name || '',
            instanceClassName: dataTypeXml.$.instanceClassName || 'java.lang.Object'
        };
    }

    /**
     * Convert XML enum to EEnum (maintains backward compatibility)
     */
    private convertXmlToEEnum(enumXml: any): EEnum {
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

    /**
     * Extract class name from href (maintains backward compatibility)
     */
    private extractClassNameFromHref(href: string): string {
        if (href.startsWith('#//')) {
            return href.substring(3);
        } else if (href.startsWith('ecore:')) {
            return href.substring(6);
        }
        return href;
    }
}

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
import { EcoreModel, EPackage, EClass, EAttribute, EReference, EDataType, EEnum, EString, EBoolean, EInt, EDouble } from './ecore-types';

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
        // Check if this is an EEnum (has eClass: 'ecore:EEnum' or eLiterals)
        const isEnum = classifier.eClass === 'ecore:EEnum' || (classifier.eLiterals && Array.isArray(classifier.eLiterals));
        
        if (isEnum) {
            // For EEnums, validate name and eLiterals
            if (!classifier.name || typeof classifier.name !== 'string') {
                throw new Error(`ePackages[${pkgIndex}].eClassifiers[${cIndex}]: EEnum missing or invalid name`);
            }
            
            // Validate eLiterals if present
            if (classifier.eLiterals) {
                if (!Array.isArray(classifier.eLiterals)) {
                    throw new Error(`ePackages[${pkgIndex}].eClassifiers[${cIndex}]: eLiterals must be an array`);
                }
                
                classifier.eLiterals.forEach((literal: any, lIndex: number) => {
                    if (!literal.name || typeof literal.name !== 'string') {
                        throw new Error(`ePackages[${pkgIndex}].eClassifiers[${cIndex}].eLiterals[${lIndex}]: Missing or invalid name`);
                    }
                });
            }
            return; // Skip EClass validation for enums
        }
        
        // For EClasses, validate name
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

        // Validate eOpposite if present
        if (ref.eOpposite) {
            if (!ref.eOpposite.name || typeof ref.eOpposite.name !== 'string') {
                throw new Error(`ePackages[${pkgIndex}].eClassifiers[${cIndex}].eReferences[${rIndex}]: eOpposite must have a valid name`);
            }
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
     * Convert JSON package to EPackage format using ecore-ts
     */
    private convertJsonToEPackage(pkg: any): any {
        const epackage = EPackage.create({
            name: pkg.name || '',
            nsURI: pkg.nsURI || '',
            nsPrefix: pkg.nsPrefix || ''
        });

        // First pass: create all classifiers
        const classifierMap = new Map<string, any>();
        if (pkg.eClassifiers && Array.isArray(pkg.eClassifiers)) {
            pkg.eClassifiers.forEach((classifier: any) => {
                const eclassifier = this.convertJsonToEClassifier(classifier, classifierMap);
                if (eclassifier) {
                    classifierMap.set(classifier.name, eclassifier);
                    (epackage as any).get('eClassifiers').add(eclassifier);
                }
            });
        }

        // Second pass: resolve type references
        if (pkg.eClassifiers && Array.isArray(pkg.eClassifiers)) {
            pkg.eClassifiers.forEach((classifier: any) => {
                const eclassifier = classifierMap.get(classifier.name);
                if (eclassifier) {
                    this.resolveTypeReferences(eclassifier, classifier, classifierMap);
                }
            });
        }

        // Third pass: resolve eOpposite relationships
        this.resolveEOppositeRelationships(classifierMap);

        return epackage;
    }

    /**
     * Convert JSON classifier to EClassifier format using ecore-ts
     */
    private convertJsonToEClassifier(classifier: any, classifierMap?: Map<string, any>): any {
        // Determine if this is an EClass, EDataType, or EEnum
        if (classifier.eAttributes || classifier.eReferences || classifier.eSuperTypes || classifier.abstract !== undefined || classifier.interface !== undefined) {
            // This is an EClass
            const eclass = EClass.create({
                name: classifier.name || '',
                abstract: classifier.abstract === true,
                interface: classifier.interface === true
            });

            // Add super types (without resolution for now, will resolve in second pass)
            if (classifier.eSuperTypes && Array.isArray(classifier.eSuperTypes)) {
                classifier.eSuperTypes.forEach((superType: any) => {
                    console.log(`Super type: ${superType.name}`);
                    // Store original super type name for later resolution
                    if (!(eclass as any)._originalSuperTypes) {
                        (eclass as any)._originalSuperTypes = [];
                    }
                    (eclass as any)._originalSuperTypes.push(superType.name);
                });
            }

            // Add structural features (attributes and references) without type resolution
            if (classifier.eAttributes && Array.isArray(classifier.eAttributes)) {
                classifier.eAttributes.forEach((attr: any) => {
                    const eattribute = this.convertJsonToEAttribute(attr, false);
                    if (eattribute) {
                        (eclass as any).get('eStructuralFeatures').add(eattribute);
                    }
                });
            }

            if (classifier.eReferences && Array.isArray(classifier.eReferences)) {
                classifier.eReferences.forEach((ref: any) => {
                    const ereference = this.convertJsonToEReference(ref, false);
                    if (ereference) {
                        (eclass as any).get('eStructuralFeatures').add(ereference);
                    }
                });
            }

            return eclass;
        } else if (classifier.eLiterals) {
            // This is an EEnum
            const eenum = EEnum.create({
                name: classifier.name || ''
            });

            // Add enum literals
            if (classifier.eLiterals && Array.isArray(classifier.eLiterals)) {
                classifier.eLiterals.forEach((literal: any) => {
                    const eenumLiteral = this.convertJsonToEEnumLiteral(literal);
                    if (eenumLiteral) {
                        (eenum as any).get('eLiterals').add(eenumLiteral);
                    }
                });
            }

            return eenum;
        } else {
            // This is an EDataType
            return EDataType.create({
                name: classifier.name || '',
                instanceClassName: classifier.instanceClassName || 'java.lang.String'
            });
        }
    }

    /**
     * Convert JSON attribute to EAttribute format using ecore-ts
     */
    private convertJsonToEAttribute(attr: any, resolveTypes: boolean = true): any {
        // Map type names to ecore-ts types
        const eType = resolveTypes ? this.mapTypeNameToEcoreType(attr.eType?.name) : EString;
        
        const eattribute = EAttribute.create({
            name: attr.name || '',
            eType: eType,
            lowerBound: typeof attr.lowerBound === 'number' ? attr.lowerBound : 0,
            upperBound: typeof attr.upperBound === 'number' ? attr.upperBound : 1,
            unique: attr.unique !== false,
            ordered: attr.ordered !== false
        });

        // Store original type name for later resolution
        if (!resolveTypes && attr.eType?.name) {
            (eattribute as any)._originalTypeName = attr.eType.name;
        }

        return eattribute;
    }

    /**
     * Convert JSON reference to EReference format using ecore-ts
     */
    private convertJsonToEReference(ref: any, resolveTypes: boolean = true): any {
        // Map type names to ecore-ts types
        const eType = resolveTypes ? this.mapTypeNameToEcoreType(ref.eType?.name) : EString;
        
        const ereference = EReference.create({
            name: ref.name || '',
            eType: eType,
            lowerBound: typeof ref.lowerBound === 'number' ? ref.lowerBound : 0,
            upperBound: typeof ref.upperBound === 'number' ? ref.upperBound : 1,
            unique: ref.unique !== false,
            ordered: ref.ordered !== false,
            containment: ref.containment === true,
            container: ref.container === true,
            resolveProxies: ref.resolveProxies !== false
        });

        // Store original type name for later resolution
        if (!resolveTypes && ref.eType?.name) {
            (ereference as any)._originalTypeName = ref.eType.name;
        }

        // Store eOpposite information for later resolution
        if (ref.eOpposite) {
            (ereference as any)._eOpposite = {
                name: ref.eOpposite.name
            };
        }

        return ereference;
    }

    /**
     * Resolve eOpposite relationships between references
     */
    private resolveEOppositeRelationships(classifierMap: Map<string, any>): void {
        const allReferences: Array<{ reference: any; sourceClass: any; sourceClassName: string }> = [];

        // Collect all references with their source classes
        classifierMap.forEach((eclass, className) => {
            if (eclass && typeof eclass.get === 'function') {
                const structuralFeatures = eclass.get('eStructuralFeatures');
                if (structuralFeatures) {
                    structuralFeatures.forEach((feature: any) => {
                        if (feature && typeof feature.get === 'function') {
                            // Check if it's a reference (has _eOpposite or has containment/eType that's not a primitive)
                            const eOpposite = (feature as any)._eOpposite;
                            if (eOpposite) {
                                console.log(`Found reference with eOpposite: ${className}.${feature.get('name')} -> ${eOpposite.name}`);
                                allReferences.push({
                                    reference: feature,
                                    sourceClass: eclass,
                                    sourceClassName: className
                                });
                            }
                        }
                    });
                }
            }
        });

        // Resolve eOpposite relationships
        allReferences.forEach(({ reference, sourceClass, sourceClassName }) => {
            const eOpposite = (reference as any)._eOpposite;
            if (eOpposite && eOpposite.name) {
                try {
                    // Find the target class
                    const eType = reference.get('eType');
                    if (!eType) {
                        console.warn(`No eType found for reference ${sourceClassName}.${reference.get('name')}`);
                        return;
                    }
                    
                    const targetClassName = eType.get('name');
                    const targetClass = classifierMap.get(targetClassName);
                    
                    if (targetClass) {
                        // Find the opposite reference in the target class
                        const structuralFeatures = targetClass.get('eStructuralFeatures');
                        if (structuralFeatures) {
                            let oppositeFound = false;
                            structuralFeatures.forEach((feature: any) => {
                                if (feature && typeof feature.get === 'function' && 
                                    feature.get('name') === eOpposite.name) {
                                    
                                    // Set the eOpposite relationship
                                    reference.set('eOpposite', feature);
                                    feature.set('eOpposite', reference);
                                    oppositeFound = true;
                                    
                                    console.log(`✓ Resolved eOpposite: ${sourceClassName}.${reference.get('name')} <-> ${targetClassName}.${feature.get('name')}`);
                                }
                            });
                            
                            if (!oppositeFound) {
                                console.warn(`Could not find opposite reference '${eOpposite.name}' in class '${targetClassName}' for ${sourceClassName}.${reference.get('name')}`);
                            }
                        }
                    } else {
                        console.warn(`Could not find target class '${targetClassName}' for resolving eOpposite`);
                    }
                } catch (error) {
                    console.error(`Error resolving eOpposite for ${sourceClassName}.${reference.get('name')}:`, error);
                }
            }
        });
    }

    /**
     * Convert JSON enum literal to EEnumLiteral format using ecore-ts
     */
    private convertJsonToEEnumLiteral(literal: any): any {
        const { EEnumLiteral } = require('ecore-ts');
        return EEnumLiteral.create({
            name: literal.name || '',
            value: literal.value || 0,
            literal: literal.literal || literal.name || ''
        });
    }

    /**
     * Resolve type references to actual classifier instances
     */
    private resolveTypeReferences(eclassifier: any, originalClassifier: any, classifierMap: Map<string, any>): void {
        if (!eclassifier) return;

        // Check if this is an EEnum - enums don't have structural features
        const eLiterals = eclassifier.get('eLiterals');
        if (eLiterals) {
            // This is an EEnum, skip structural feature resolution
            return;
        }

        // Resolve super types
        const originalSuperTypes = (eclassifier as any)._originalSuperTypes;
        if (originalSuperTypes && Array.isArray(originalSuperTypes)) {
            originalSuperTypes.forEach((superTypeName: string) => {
                const targetClassifier = classifierMap.get(superTypeName);
                if (targetClassifier) {
                    // Add the resolved super type
                    eclassifier.get('eSuperTypes').add(targetClassifier);
                    console.log(`Resolved super type: ${eclassifier.get('name')} -> ${superTypeName}`);
                } else {
                    console.log(`Could not resolve super type: ${superTypeName}`);
                }
            });
            // Clean up the temporary property
            delete (eclassifier as any)._originalSuperTypes;
        }

        // Resolve structural feature types (only for EClasses)
        const structuralFeatures = eclassifier.get('eStructuralFeatures');
        if (structuralFeatures && typeof structuralFeatures.forEach === 'function') {
            structuralFeatures.forEach((feature: any) => {
                const originalTypeName = (feature as any)._originalTypeName;
                if (originalTypeName) {
                    // Try to find the classifier in our map
                    const targetClassifier = classifierMap.get(originalTypeName);
                    if (targetClassifier) {
                        // Set the resolved type
                        feature.set('eType', targetClassifier);
                        console.log(`Resolved type reference: ${feature.get('name')} -> ${originalTypeName}`);
                    } else {
                        // Fall back to built-in type
                        const builtinType = this.mapTypeNameToEcoreType(originalTypeName);
                        feature.set('eType', builtinType);
                        console.log(`Using built-in type for ${feature.get('name')}: ${originalTypeName}`);
                    }
                    // Clean up the temporary property
                    delete (feature as any)._originalTypeName;
                }
            });
        }
    }

    /**
     * Map type names to ecore-ts built-in types
     */
    private mapTypeNameToEcoreType(typeName?: string): any {
        if (!typeName) {
            return EString; // Default to String
        }

        switch (typeName.toLowerCase()) {
            case 'estring':
            case 'string':
                return EString;
            case 'eboolean':
            case 'boolean':
                return EBoolean;
            case 'eint':
            case 'int':
            case 'integer':
                return EInt;
            case 'edouble':
            case 'double':
                return EDouble;
            default:
                // For custom types, we'll need to resolve them later
                // For now, return a placeholder
                console.log(`Unknown type: ${typeName}, using EString as fallback`);
                return EString;
        }
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
    private convertXmlToEPackage(pkgXml: any): any {
        const pkg: any = {
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
    private convertXmlToEClass(classXml: any): any {
        const eClass: any = {
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
    private convertXmlToEAttribute(attrXml: any): any {
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
    private convertXmlToEReference(refXml: any): any {
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
    private convertXmlToEDataType(dataTypeXml: any): any {
        return {
            name: dataTypeXml.$.name || '',
            instanceClassName: dataTypeXml.$.instanceClassName || 'java.lang.Object'
        };
    }

    /**
     * Convert XML enum to EEnum (maintains backward compatibility)
     */
    private convertXmlToEEnum(enumXml: any): any {
        const eEnum: any = {
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

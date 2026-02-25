/**
 * @author Abigail Sotomayor <s205720@dtu.dk>
 */
import { injectable } from 'inversify';
import { EcoreModel, EPackage, EClass, EAttribute, EReference, EDataType, EEnum, EString, EBoolean, EInt, EDouble } from './ecore-types';

@injectable()
export class EcoreParser {

    async parseEcoreJson(jsonContent: string): Promise<EcoreModel> {
        try {
            const jsonObject = JSON.parse(jsonContent);

            this.validateBasicStructure(jsonObject);

            return this.convertJsonToEcoreModel(jsonObject);

        } catch (error) {
            throw new Error(`Failed to parse Ecore JSON: ${error}`);
        }
    }

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

        jsonObject.ePackages.forEach((pkg: any, index: number) => {
            this.validateEPackage(pkg, index);
        });
    }

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

        if (pkg.eClassifiers) {
            if (!Array.isArray(pkg.eClassifiers)) {
                throw new Error(`ePackages[${index}]: eClassifiers must be an array`);
            }

            pkg.eClassifiers.forEach((classifier: any, cIndex: number) => {
                this.validateEClassifier(classifier, index, cIndex);
            });
        }
    }

    private validateEClassifier(classifier: any, pkgIndex: number, cIndex: number): void {
        const isEnum = classifier.eClass === 'ecore:EEnum' || (classifier.eLiterals && Array.isArray(classifier.eLiterals));
        
        if (isEnum) {
            if (!classifier.name || typeof classifier.name !== 'string') {
                throw new Error(`ePackages[${pkgIndex}].eClassifiers[${cIndex}]: EEnum missing or invalid name`);
            }
            
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
            return;
        }
        
        if (!classifier.name || typeof classifier.name !== 'string') {
            throw new Error(`ePackages[${pkgIndex}].eClassifiers[${cIndex}]: Missing or invalid name`);
        }

        if (classifier.eAttributes) {
            if (!Array.isArray(classifier.eAttributes)) {
                throw new Error(`ePackages[${pkgIndex}].eClassifiers[${cIndex}]: eAttributes must be an array`);
            }

            classifier.eAttributes.forEach((attr: any, aIndex: number) => {
                this.validateEAttribute(attr, pkgIndex, cIndex, aIndex);
            });
        }

        if (classifier.eReferences) {
            if (!Array.isArray(classifier.eReferences)) {
                throw new Error(`ePackages[${pkgIndex}].eClassifiers[${cIndex}]: eReferences must be an array`);
            }

            classifier.eReferences.forEach((ref: any, rIndex: number) => {
                this.validateEReference(ref, pkgIndex, cIndex, rIndex);
            });
        }
    }

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

        if (ref.eOpposite) {
            if (!ref.eOpposite.name || typeof ref.eOpposite.name !== 'string') {
                throw new Error(`ePackages[${pkgIndex}].eClassifiers[${cIndex}].eReferences[${rIndex}]: eOpposite must have a valid name`);
            }
        }
    }

    private convertJsonToEcoreModel(jsonObject: any): EcoreModel {
        const ecoreModel: EcoreModel = {
            ePackages: []
        };

        if (jsonObject.ePackages && Array.isArray(jsonObject.ePackages)) {
            ecoreModel.ePackages = jsonObject.ePackages.map((pkg: any) => this.convertJsonToEPackage(pkg));
        }

        return ecoreModel;
    }

    private convertJsonToEPackage(pkg: any): any {
        const epackage = EPackage.create({
            name: pkg.name || '',
            nsURI: pkg.nsURI || '',
            nsPrefix: pkg.nsPrefix || ''
        });

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

        if (pkg.eClassifiers && Array.isArray(pkg.eClassifiers)) {
            pkg.eClassifiers.forEach((classifier: any) => {
                const eclassifier = classifierMap.get(classifier.name);
                if (eclassifier) {
                    this.resolveTypeReferences(eclassifier, classifier, classifierMap);
                }
            });
        }

        this.resolveEOppositeRelationships(classifierMap);

        return epackage;
    }

    private convertJsonToEClassifier(classifier: any, classifierMap?: Map<string, any>): any {
        if (classifier.eAttributes || classifier.eReferences || classifier.eSuperTypes || classifier.abstract !== undefined || classifier.interface !== undefined) {
            const eclass = EClass.create({
                name: classifier.name || '',
                abstract: classifier.abstract === true,
                interface: classifier.interface === true
            });

            if (classifier.eSuperTypes && Array.isArray(classifier.eSuperTypes)) {
                classifier.eSuperTypes.forEach((superType: any) => {
                    console.log(`Super type: ${superType.name}`);
                    if (!(eclass as any)._originalSuperTypes) {
                        (eclass as any)._originalSuperTypes = [];
                    }
                    (eclass as any)._originalSuperTypes.push(superType.name);
                });
            }

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
            const eenum = EEnum.create({
                name: classifier.name || ''
            });

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
            return EDataType.create({
                name: classifier.name || '',
                instanceClassName: classifier.instanceClassName || 'java.lang.String'
            });
        }
    }

    private convertJsonToEAttribute(attr: any, resolveTypes: boolean = true): any {
        const eType = resolveTypes ? this.mapTypeNameToEcoreType(attr.eType?.name) : EString;
        
        const eattribute = EAttribute.create({
            name: attr.name || '',
            eType: eType,
            lowerBound: typeof attr.lowerBound === 'number' ? attr.lowerBound : 0,
            upperBound: typeof attr.upperBound === 'number' ? attr.upperBound : 1,
            unique: attr.unique !== false,
            ordered: attr.ordered !== false
        });

        if (!resolveTypes && attr.eType?.name) {
            (eattribute as any)._originalTypeName = attr.eType.name;
        }

        return eattribute;
    }

    private convertJsonToEReference(ref: any, resolveTypes: boolean = true): any {
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

        if (!resolveTypes && ref.eType?.name) {
            (ereference as any)._originalTypeName = ref.eType.name;
        }

        if (ref.eOpposite) {
            (ereference as any)._eOpposite = {
                name: ref.eOpposite.name
            };
        }

        return ereference;
    }

    private resolveEOppositeRelationships(classifierMap: Map<string, any>): void {
        const allReferences: Array<{ reference: any; sourceClass: any; sourceClassName: string }> = [];

        classifierMap.forEach((eclass, className) => {
            if (eclass && typeof eclass.get === 'function') {
                const structuralFeatures = eclass.get('eStructuralFeatures');
                if (structuralFeatures) {
                    structuralFeatures.forEach((feature: any) => {
                        if (feature && typeof feature.get === 'function') {
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

        allReferences.forEach(({ reference, sourceClass, sourceClassName }) => {
            const eOpposite = (reference as any)._eOpposite;
            if (eOpposite && eOpposite.name) {
                try {
                    const eType = reference.get('eType');
                    if (!eType) {
                        console.warn(`No eType found for reference ${sourceClassName}.${reference.get('name')}`);
                        return;
                    }
                    
                    const targetClassName = eType.get('name');
                    const targetClass = classifierMap.get(targetClassName);
                    
                    if (targetClass) {
                        const structuralFeatures = targetClass.get('eStructuralFeatures');
                        if (structuralFeatures) {
                            let oppositeFound = false;
                            structuralFeatures.forEach((feature: any) => {
                                if (feature && typeof feature.get === 'function' && 
                                    feature.get('name') === eOpposite.name) {
                                    
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

    private convertJsonToEEnumLiteral(literal: any): any {
        const { EEnumLiteral } = require('ecore-ts');
        return EEnumLiteral.create({
            name: literal.name || '',
            value: literal.value || 0,
            literal: literal.literal || literal.name || ''
        });
    }

    private resolveTypeReferences(eclassifier: any, originalClassifier: any, classifierMap: Map<string, any>): void {
        if (!eclassifier) return;

        const eLiterals = eclassifier.get('eLiterals');
        if (eLiterals) {
            return;
        }

        const originalSuperTypes = (eclassifier as any)._originalSuperTypes;
        if (originalSuperTypes && Array.isArray(originalSuperTypes)) {
            originalSuperTypes.forEach((superTypeName: string) => {
                const targetClassifier = classifierMap.get(superTypeName);
                if (targetClassifier) {
                    eclassifier.get('eSuperTypes').add(targetClassifier);
                    console.log(`Resolved super type: ${eclassifier.get('name')} -> ${superTypeName}`);
                } else {
                    console.log(`Could not resolve super type: ${superTypeName}`);
                }
            });     
            delete (eclassifier as any)._originalSuperTypes;
        }

        const structuralFeatures = eclassifier.get('eStructuralFeatures');
        if (structuralFeatures && typeof structuralFeatures.forEach === 'function') {
            structuralFeatures.forEach((feature: any) => {
                const originalTypeName = (feature as any)._originalTypeName;
                if (originalTypeName) {
                    const targetClassifier = classifierMap.get(originalTypeName);
                    if (targetClassifier) {
                        feature.set('eType', targetClassifier);
                        console.log(`Resolved type reference: ${feature.get('name')} -> ${originalTypeName}`);
                    } else {
                        const builtinType = this.mapTypeNameToEcoreType(originalTypeName);
                        feature.set('eType', builtinType);
                        console.log(`Using built-in type for ${feature.get('name')}: ${originalTypeName}`);
                    }
                    delete (feature as any)._originalTypeName;
                }
            });
        }
    }

    private mapTypeNameToEcoreType(typeName?: string): any {
        if (!typeName) {
            return EString;
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
                console.log(`Unknown type: ${typeName}, using EString as fallback`);
                return EString;
        }
    }
}

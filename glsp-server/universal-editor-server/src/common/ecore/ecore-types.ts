/**
 * @author Abigail Sotomayor <s205720@dtu.dk>
 */
export * from 'ecore-ts';

export interface EcoreModel {
    ePackages: any[];
}

export function isEClass(classifier: any): boolean {
    if (classifier && classifier.eClass && classifier.eClass.values && classifier.eClass.values.name === 'EClass') {
        return true;
    }
    
    if (classifier && 
        typeof classifier.name === 'string' && 
        typeof classifier.abstract === 'boolean' && 
        typeof classifier.interface === 'boolean' &&
        typeof classifier.get === 'function' &&
        typeof classifier.set === 'function') {
        return true;
    }
    
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
    if (classifier && classifier.eClass && classifier.eClass.values && classifier.eClass.values.name === 'EEnum') {
        return true;
    }
    
    if (classifier && typeof classifier === 'object') {
        if (classifier.eClass === 'ecore:EEnum') {
            return true;
        }
        if (typeof classifier.name === 'string' && Array.isArray(classifier.eLiterals)) {
            return true;
        }
    }
    
    return false;
}

export function isEAttribute(feature: any): boolean {
    if (feature && feature.eClass && feature.eClass.values && feature.eClass.values.name === 'EAttribute') {
        return true;
    }
    
    if (feature && 
        typeof feature.name === 'string' && 
        feature.eType && 
        typeof feature.lowerBound === 'number' && 
        typeof feature.upperBound === 'number' &&
        typeof feature.get === 'function' &&
        typeof feature.set === 'function' &&
        !('containment' in feature)) {
        return true;
    }
    
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
    if (isEAttribute(feature)) {
        return false;
    }
    
    if (feature && feature.eClass && feature.eClass.values && feature.eClass.values.name === 'EReference') {
        return true;
    }
    
    if (feature && 
        typeof feature.name === 'string' && 
        feature.eType && 
        typeof feature.containment === 'boolean' &&
        typeof feature.get === 'function' &&
        typeof feature.set === 'function') {
        return true;
    }
    
    if (
        feature &&
        typeof feature.name === 'string' &&
        feature.eType !== undefined &&
        'containment' in feature
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


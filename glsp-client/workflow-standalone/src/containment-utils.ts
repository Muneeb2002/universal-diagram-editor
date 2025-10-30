/********************************************************************************
 * Copyright (c) 2024 Eclipse GLSP and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * SPDX-License-Identifier: EPL-2.0
 ********************************************************************************/

import { ClassInfo } from './ecore-client-actions';


export interface ContainmentRequirement {
    containerClassName: string;
    referenceName: string;
    lowerBound: number;
    upperBound: number;
}


function isSubtypeOf(className: string, superTypeName: string, allClasses: ClassInfo[]): boolean {
    if (className === superTypeName) {
        return true;
    }
    
    const cls = allClasses.find(c => c.className === className);
    if (!cls || !cls.eSuperTypes || cls.eSuperTypes.length === 0) {
        return false;
    }
    
    // Check direct supertypes
    if (cls.eSuperTypes.includes(superTypeName)) {
        return true;
    }
    
    // Recursively check supertypes of supertypes
    return cls.eSuperTypes.some(st => isSubtypeOf(st, superTypeName, allClasses));
}


export function getContainmentRequirements(className: string, allClasses: ClassInfo[]): ContainmentRequirement[] {
    const requirements: ContainmentRequirement[] = [];
    const concreteType = findFirstConcreteSupertype(className, allClasses);
    const targetType = concreteType || className;
        
    for (const cls of allClasses) {
        for (const ref of cls.references) {
            const isDirectMatch = ref.type === targetType;
            const isSubtypeMatch = isSubtypeOf(targetType, ref.type, allClasses);
            
            if ((isDirectMatch || isSubtypeMatch) && ref.containment) {
                requirements.push({
                    containerClassName: cls.className,
                    referenceName: ref.name,
                    lowerBound: ref.lowerBound,
                    upperBound: ref.upperBound
                });
            }
        }
    }
    
    return requirements;
}


export function mustBeContained(className: string, allClasses: ClassInfo[]): boolean {
    const requirements = getContainmentRequirements(className, allClasses);
    return requirements.length > 0;
}


export function getContainmentDescription(className: string, allClasses: ClassInfo[]): string | null {
    const requirements = getContainmentRequirements(className, allClasses);
    
    if (requirements.length === 0) {
        return null;
    }
    

    const descriptions = requirements.map(req => 
        `${req.containerClassName}.${req.referenceName}[${req.lowerBound}..${req.upperBound === -1 ? '*' : req.upperBound}]`
    );
    
    return `Can be contained by: ${descriptions.join(', ')}`;
}


export function getCreatableClasses(allClasses: ClassInfo[]): ClassInfo[] {
    return allClasses.filter(cls => 
        !cls.isAbstract && 
        !cls.isInterface && 
        !mustBeContained(cls.className, allClasses)
    );
}


export function getCreatableChildren(containerClassName: string, allClasses: ClassInfo[]): ClassInfo[] {
    const containerClass = allClasses.find(cls => cls.className === containerClassName);
    if (!containerClass) {
        console.warn(`Container class '${containerClassName}' not found in allClasses`);
        return [];
    }
      
    const creatableChildren: ClassInfo[] = [];
    const addedClassNames = new Set<string>();
    
    for (const ref of containerClass.references) {
        if (ref.containment) {
            
            
            // Add the directly referenced type
            const directChildClass = allClasses.find(cls => cls.className === ref.type);
            if (directChildClass && !addedClassNames.has(directChildClass.className)) {
                creatableChildren.push(directChildClass);
                addedClassNames.add(directChildClass.className);
            }
            
            // Add all subtypes of the referenced type
            for (const cls of allClasses) {
                if (isSubtypeOf(cls.className, ref.type, allClasses) && !addedClassNames.has(cls.className)) {
                    creatableChildren.push(cls);
                    addedClassNames.add(cls.className);
                }
            }
        }
    }
    return creatableChildren;
}


export function getContainmentReferenceName(containerClassName: string, childClassName: string, allClasses: ClassInfo[]): string | null {
    const containerClass = allClasses.find(cls => cls.className === containerClassName);
    if (!containerClass) {
        return null;
    }

    const concreteType = findFirstConcreteSupertype(childClassName, allClasses);
    const targetType = concreteType || childClassName;
    
    for (const ref of containerClass.references) {
        if (ref.containment) {
            // Check direct match or if child is a subtype of the reference type
            if (ref.type === targetType || isSubtypeOf(targetType, ref.type, allClasses)) {
                return ref.name;
            }
        }
    }
    return null;
}


function findFirstConcreteSupertype(className: string, allClasses: ClassInfo[]): string | null {
    const cls = allClasses.find(c => c.className === className);
    if (!cls) {
        return null;
    }
    
    // If the class itself is concrete, return it
    if (!cls.isAbstract && !cls.isInterface) {
        return className;
    }
    
    // Check all supertypes recursively
    if (cls.eSuperTypes) {
        for (const superTypeName of cls.eSuperTypes) {
            const concreteSuperType = findFirstConcreteSupertype(superTypeName, allClasses);
            if (concreteSuperType) {
                return concreteSuperType;
            }
        }
    }
    
    return null;
}

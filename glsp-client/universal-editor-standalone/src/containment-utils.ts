/**
 * @author Abigail Sotomayor <s205720@dtu.dk>
 */
import { ClassInfo } from './ecore-client-actions';


export interface ContainmentRequirement {
    containerClassName: string;
    referenceName: string;
    lowerBound: number;
    upperBound: number;
}


export function isSubtypeOf(className: string, superTypeName: string, allClasses: ClassInfo[]): boolean {
    if (className === superTypeName) {
        return true;
    }

    const cls = allClasses.find(c => c.className === className);
    if (!cls || !cls.eSuperTypes || cls.eSuperTypes.length === 0) {
        return false;
    }

    if (cls.eSuperTypes.includes(superTypeName)) {
        return true;
    }

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

            const directChildClass = allClasses.find(cls => cls.className === ref.type);
            if (directChildClass && !addedClassNames.has(directChildClass.className)) {
                creatableChildren.push(directChildClass);
                addedClassNames.add(directChildClass.className);
            }

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

export function getRequiredPlacementReferences(className: string, allClasses: ClassInfo[]): ClassInfo['references'] {
    const cls = allClasses.find(candidate => candidate.className === className);
    if (!cls) return [];
    return cls.references.filter(ref => !ref.containment && ref.lowerBound > 0 && ref.upperBound === 1);
}

export function getCreatablePlacementChildren(targetClassName: string, allClasses: ClassInfo[]): ClassInfo[] {
    return allClasses.filter(candidate => {
        const required = getRequiredPlacementReferences(candidate.className, allClasses);
        return required.length === 1 && (
            required[0].type === targetClassName || isSubtypeOf(targetClassName, required[0].type, allClasses)
        );
    });
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

    if (!cls.isAbstract && !cls.isInterface) {
        return className;
    }

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

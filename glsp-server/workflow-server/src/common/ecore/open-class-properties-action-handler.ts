import { injectable, inject } from 'inversify';
import { Action, ActionHandler } from '@eclipse-glsp/server';
import { ClassPropertiesResponse, OpenClassPropertiesAction } from './ecore-actions';
import { MetamodelRegistry } from './metamodel-registry';
import { isEAttribute } from './ecore-types';

function toArray(value: any): any[] {
    if (!value) {
        return [];
    }
    if (Array.isArray(value)) {
        return value;
    }
    if (typeof value.forEach === 'function') {
        const tmp: any[] = [];
        try {
            value.forEach((item: any) => tmp.push(item));
            return tmp;
        } catch {
            // ignore fallthrough
        }
    }
    try {
        return Array.from(value);
    } catch {
        return [];
    }
}

function isAttributeLike(feature: any): boolean {
    if (!feature) {
        return false;
    }
    if (isEAttribute(feature)) {
        return true;
    }

    const containment = typeof feature.get === 'function' ? feature.get('containment') : feature.containment;
    if (typeof containment === 'boolean' && containment) {
        return false;
    }

    const eType = typeof feature.get === 'function' ? feature.get('eType') : feature.eType;
    if (!eType) {
        return false;
    }

    const typeName = typeof eType === 'string'
        ? eType
        : (typeof eType.get === 'function' ? eType.get('name') : eType.name);

    if (!typeName) {
        return false;
    }

    const normalized = typeName.toString();
    const primitivePrefixes = ['EString', 'EInt', 'EBoolean', 'EDouble', 'EFloat', 'ELong', 'EShort', 'EByte', 'EDate', 'EChar'];
    if (primitivePrefixes.some(prefix => normalized === prefix || normalized.startsWith(prefix))) {
        return true;
    }

    const javaPrimitives = ['String', 'Integer', 'Boolean', 'Double', 'Float', 'Long', 'Short', 'Byte', 'Date', 'Char'];
    return javaPrimitives.includes(normalized);
}

@injectable()
export class OpenClassPropertiesActionHandler implements ActionHandler {
	actionKinds = [OpenClassPropertiesAction.KIND];

	@inject(MetamodelRegistry)
	protected metamodelRegistry: MetamodelRegistry;

	async execute(action: Action): Promise<Action[]> {
		try {
			const activeMetamodel = this.metamodelRegistry.getActiveMetamodel();
			let metamodelInfo = {
				name: '',
				nsURI: '',
				nsPrefix: '',
				classCount: 0
			};

			const classes = this.metamodelRegistry.getAllEClasses().map(eClass => {
				const rawName = eClass.get ? eClass.get('name') : eClass.name;
				const name = typeof rawName === 'string' ? rawName : '';
				const isAbstract = eClass.get ? !!eClass.get('abstract') : !!eClass.abstract;
				const isInterface = eClass.get ? !!eClass.get('interface') : !!eClass.interface;
				// supertypes
				let superTypes: string[] = [];
				const st = eClass.get ? eClass.get('eSuperTypes') : eClass.eSuperTypes;
				if (st) {
					if (typeof st.forEach === 'function') {
						const tmp: string[] = [];
						st.forEach((t: any) => tmp.push(t.get ? t.get('name') : t.name));
						superTypes = tmp.filter(Boolean);
					} else if (Array.isArray(st)) {
						superTypes = st.map((t: any) => (t.get ? t.get('name') : t.name)).filter(Boolean);
					}
				}
				// attributes
				const features = eClass.get ? eClass.get('eStructuralFeatures') : eClass.eStructuralFeatures || [];
				const featureArray = toArray(features);
				const attrs = featureArray
					.filter(isAttributeLike)
					.map((attr: any) => {
						const typeObj = attr.get ? attr.get('eType') : attr.eType;
						let typeName: string | undefined;
						if (typeof typeObj === 'string') {
							typeName = typeObj;
						} else if (typeObj) {
							typeName = typeObj.get ? typeObj.get('name') : typeObj.name;
						}
						const lowerRaw = attr.get ? attr.get('lowerBound') : attr.lowerBound;
						const upperRaw = attr.get ? attr.get('upperBound') : attr.upperBound;
						return {
							name: attr.get ? attr.get('name') : attr.name,
							type: typeName,
							lowerBound: typeof lowerRaw === 'number' ? lowerRaw : 0,
							upperBound: typeof upperRaw === 'number' ? upperRaw : (upperRaw === '*' ? -1 : 1)
						};
					})
					.filter((attr): attr is { name: string; type: string; lowerBound: number; upperBound: number } => !!attr.name && !!attr.type);
				return { className: name, isAbstract, isInterface, eSuperTypes: superTypes, attributes: attrs };
			});
			metamodelInfo.classCount = classes.length;

			if (activeMetamodel && Array.isArray(activeMetamodel.ePackages) && activeMetamodel.ePackages.length > 0) {
				const pkg = activeMetamodel.ePackages[0];
				const read = (obj: any, key: string) => {
					if (!obj) {
						return '';
					}
					if (typeof obj.get === 'function') {
						try {
							return obj.get(key) ?? '';
						} catch {
							// ignore
						}
					}
					return obj[key] ?? '';
				};
				metamodelInfo = {
					name: (read(pkg, 'name') || '').toString(),
					nsURI: (read(pkg, 'nsURI') || '').toString(),
					nsPrefix: (read(pkg, 'nsPrefix') || '').toString(),
					classCount: classes.length
				};
			}

			// Get all enums with their literals
			const allEnums = this.metamodelRegistry.getAllEEnums();
			const enums = allEnums.map(eEnum => {
				const enumName = eEnum.get ? eEnum.get('name') : eEnum.name;
				const eLiterals = eEnum.get ? eEnum.get('eLiterals') : eEnum.eLiterals;
				const literalArray = toArray(eLiterals);
				
				const literals = literalArray.map((literal: any) => {
					const literalName = literal.get ? literal.get('name') : literal.name;
					const literalValue = literal.get ? literal.get('value') : literal.value;
					return {
						name: literalName || '',
						value: literalValue !== undefined ? literalValue : undefined
					};
				}).filter((lit: any) => !!lit.name);
				
				return {
					enumName: enumName || '',
					literals
				};
			}).filter((e: any) => !!e.enumName);

			return [ClassPropertiesResponse.create(metamodelInfo, classes, enums)];
		} catch (e) {
			return [];
		}
	}
}

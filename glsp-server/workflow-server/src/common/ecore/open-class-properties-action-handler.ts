import { injectable, inject } from 'inversify';
import { Action, ActionHandler } from '@eclipse-glsp/server';
import { ClassPropertiesResponse, OpenClassPropertiesAction } from './ecore-actions';
import { MetamodelRegistry } from './metamodel-registry';
import { isEAttribute } from './ecore-types';

@injectable()
export class OpenClassPropertiesActionHandler implements ActionHandler {
	actionKinds = [OpenClassPropertiesAction.KIND];

	@inject(MetamodelRegistry)
	protected metamodelRegistry: MetamodelRegistry;

	async execute(action: Action): Promise<Action[]> {
		try {
			const classes = this.metamodelRegistry.getAllEClasses().map(eClass => {
				const name = eClass.get ? eClass.get('name') : eClass.name;
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
				const attrs = (Array.isArray(features) ? features : Array.from(features || [])).filter(isEAttribute).map((attr: any) => {
					const type = (attr.get ? attr.get('eType') : attr.eType);
					return {
						name: attr.get ? attr.get('name') : attr.name,
						type: type?.get ? type.get('name') : type?.name,
						lowerBound: attr.get ? attr.get('lowerBound') : attr.lowerBound,
						upperBound: attr.get ? attr.get('upperBound') : attr.upperBound
					};
				});
				return { className: name, isAbstract, isInterface, eSuperTypes: superTypes, attributes: attrs };
			});
			return [ClassPropertiesResponse.create(classes)];
		} catch (e) {
			return [];
		}
	}
}

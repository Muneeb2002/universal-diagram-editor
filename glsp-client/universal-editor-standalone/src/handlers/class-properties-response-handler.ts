/**
 * @author Abigail Sotomayor <s205720@dtu.dk>
 */
import { Action, IActionHandler, GLSPActionDispatcher } from '@eclipse-glsp/client';
import { injectable } from 'inversify';
import { ClassPropertiesResponse, ClassInfo } from '../ecore-client-actions';
import { ClassPropertiesPanel } from '../class-properties-panel';

declare global {
	interface Window {
		classPropertiesPanel?: ClassPropertiesPanel;
	}
}

@injectable()
export class ClassPropertiesResponseHandler implements IActionHandler {
	private panel: ClassPropertiesPanel | null = null;
	constructor(private readonly dispatcher: GLSPActionDispatcher) {
		this.panel = new ClassPropertiesPanel(this.dispatcher);
		window.classPropertiesPanel = this.panel;
	}

	handle(action: Action): void {
		if (action.kind === 'classPropertiesResponse') {
			const a = action as ClassPropertiesResponse;
			if (a.success) {
				this.panel!.show(a);
				const toolbar = (window as any).globalToolbar;
				if (toolbar) {
					if (a.enums && typeof toolbar.updateEnums === 'function') {
						toolbar.updateEnums(a.enums);
					}
					if (a.classes && Array.isArray(a.classes) && a.classes.length > 0 && typeof toolbar.updateClassInfo === 'function') {
						const updatedClassInfo: ClassInfo[] = a.classes.map(cls => ({
							className: cls.className,
							isAbstract: cls.isAbstract || false,
							isInterface: cls.isInterface || false,
							eSuperTypes: cls.eSuperTypes || undefined,
							attributes: cls.attributes.map(attr => ({
								name: attr.name,
								type: attr.type,
								lowerBound: attr.lowerBound,
								upperBound: attr.upperBound,
								unique: true,
								ordered: false
							})),
							references: (cls as any).references?.map((r: any) => ({
								name: r.name,
								type: r.type,
								lowerBound: r.lowerBound ?? 0,
								upperBound: r.upperBound ?? 1,
								containment: r.containment === true,
								container: false,
								unique: true,
								ordered: false
							})) ?? []
						}));

						toolbar.updateClassInfo(updatedClassInfo);
					}
				}
			}
		}
	}
}



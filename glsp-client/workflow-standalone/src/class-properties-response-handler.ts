import { Action, IActionHandler, GLSPActionDispatcher } from '@eclipse-glsp/client';
import { injectable } from 'inversify';
import { ClassPropertiesResponse } from './ecore-client-actions';
import { ClassPropertiesPanel } from './class-properties-panel';

@injectable()
export class ClassPropertiesResponseHandler implements IActionHandler {
	private panel: ClassPropertiesPanel | null = null;
    constructor(private readonly dispatcher: GLSPActionDispatcher) {
        this.panel = new ClassPropertiesPanel(this.dispatcher);
	}

	handle(action: Action): void {
		if (action.kind === 'classPropertiesResponse') {
			const a = action as ClassPropertiesResponse;
			if (a.success) {
				this.panel!.show(a.classes);
			}
		}
	}
}



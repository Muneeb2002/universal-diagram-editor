/**
 * @author Abigail Sotomayor <s205720@dtu.dk>
 */
import { injectable, inject } from 'inversify';
import { ActionHandler, ModelState, GModelFactory, GModelSerializer, GModelRoot } from '@eclipse-glsp/server';
import { Action, MessageAction, SetModelAction } from '@eclipse-glsp/protocol';
import { SwitchModeAction } from '../ecore-actions';
import { InstanceModelStorage } from '../instance-model-storage';

@injectable()
export class SwitchModeActionHandler implements ActionHandler {
    actionKinds = [SwitchModeAction.KIND];

    @inject(ModelState)
    protected modelState: ModelState;

    @inject(GModelFactory)
    protected gmodelFactory: GModelFactory;

    @inject(GModelSerializer)
    protected gmodelSerializer: GModelSerializer;

    @inject(InstanceModelStorage)
    protected instanceStorage: InstanceModelStorage;

    async execute(action: SwitchModeAction): Promise<Action[]> {
        console.log('SwitchModeActionHandler.execute()', action);

        const currentMode = this.modelState.get('viewMode') as string;

        if (currentMode === action.mode) {
            console.log(`Already in ${action.mode} mode`);
            return [];
        }

        this.modelState.set('viewMode', action.mode);
        console.log(`Switched to ${action.mode} mode`);

        if (action.mode === 'instance') {
            this.instanceStorage.ensureRootContainers();
        }

        this.gmodelFactory.createModel();

        const gmodel = this.modelState.get('gmodel') as GModelRoot;
        if (gmodel) {
            return [
                SetModelAction.create(gmodel),
                MessageAction.create(`Switched to ${action.mode} view mode`, { severity: 'INFO' })
            ];
        } else {
            return [
                MessageAction.create('Failed to switch mode', { severity: 'ERROR' })
            ];
        }
    }
}

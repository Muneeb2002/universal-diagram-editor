/**
 * @author Abigail Sotomayor <s205720@dtu.dk>
 */
import { injectable, inject } from 'inversify';
import { ActionHandler, ModelState, GModelFactory, GModelSerializer, GModelRoot } from '@eclipse-glsp/server';
import { Action, MessageAction, SetModelAction } from '@eclipse-glsp/protocol';
import { SetInstanceAttributeAction } from '../ecore-actions';
import { InstanceModelStorage } from '../instance-model-storage';

@injectable()
export class SetInstanceAttributeActionHandler implements ActionHandler {
    actionKinds = [SetInstanceAttributeAction.KIND];

    @inject(InstanceModelStorage)
    protected instanceStorage: InstanceModelStorage;

    @inject(ModelState)
    protected modelState: ModelState;

    @inject(GModelFactory)
    protected gmodelFactory: GModelFactory;

    @inject(GModelSerializer)
    protected gmodelSerializer: GModelSerializer;

    async execute(action: SetInstanceAttributeAction): Promise<Action[]> {
        try {
            this.instanceStorage.setAttributeValue(
                action.instanceId,
                action.attributeName,
                action.value
            );

            const currentMode = this.modelState.get('viewMode') as string;
            if (currentMode !== 'instance') {
                this.modelState.set('viewMode', 'instance');
            }

            this.gmodelFactory.createModel();

            const gmodel = this.modelState.get('gmodel') as GModelRoot;
            if (gmodel) {
                return [
                    SetModelAction.create(gmodel),
                    MessageAction.create(
                        `Set ${action.attributeName} = ${action.value}`,
                        { severity: 'INFO' }
                    )
                ];
            } else {
                return [
                    MessageAction.create('Failed to update instance visualization', { severity: 'ERROR' })
                ];
            }
        } catch (error) {
            console.error('Error setting instance attribute:', error);
            return [
                MessageAction.create(
                    `Error setting attribute: ${error instanceof Error ? error.message : String(error)}`,
                    { severity: 'ERROR' }
                )
            ];
        }
    }
    
}


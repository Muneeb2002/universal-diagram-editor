/**
 * @author Abigail Sotomayor <s205720@dtu.dk>
 */
import { injectable, inject } from 'inversify';
import { ActionHandler, ModelState, GModelFactory, GModelSerializer, GModelRoot } from '@eclipse-glsp/server';
import { Action, MessageAction, SetModelAction } from '@eclipse-glsp/protocol';
import { CreateInstanceAction } from '../ecore-actions';
import { InstanceModelStorage } from '../instance-model-storage';

@injectable()
export class CreateInstanceActionHandler implements ActionHandler {
    actionKinds = [CreateInstanceAction.KIND];

    @inject(InstanceModelStorage)
    protected instanceStorage: InstanceModelStorage;

    @inject(ModelState)
    protected modelState: ModelState;

    @inject(GModelFactory)
    protected gmodelFactory: GModelFactory;

    @inject(GModelSerializer)
    protected gmodelSerializer: GModelSerializer;

    async execute(action: CreateInstanceAction): Promise<Action[]> {
        console.log('CreateInstanceActionHandler.execute()', action);

        try {
            const instance = this.instanceStorage.createInstance(
                action.eClassName,
                action.position,
                {
                    containerInstanceId: action.containerInstanceId,
                    containmentReferenceName: action.containmentReferenceName
                }
            );
            console.log(`Created instance: ${instance.id}`);

            const currentMode = this.modelState.get('viewMode') as string;
            if (currentMode !== 'instance') {
                this.modelState.set('viewMode', 'instance');
            }

            this.gmodelFactory.createModel();

            const gmodel = this.modelState.get('gmodel') as GModelRoot;
            if (gmodel) {
                return [
                    SetModelAction.create(gmodel),
                    MessageAction.create(`Created instance of ${action.eClassName}`, { severity: 'INFO' })
                ];
            } else {
                return [
                    MessageAction.create('Failed to create instance visualization', { severity: 'ERROR' })
                ];
            }
        } catch (error) {
            console.error('Error creating instance:', error);
            return [
                MessageAction.create(
                    `Error creating instance: ${error instanceof Error ? error.message : String(error)}`,
                    { severity: 'ERROR' }
                )
            ];
        }
    }
}

/**
 * @author Abigail Sotomayor <s205720@dtu.dk>
 */
import { injectable, inject } from 'inversify';
import { ActionHandler, ModelState, GModelFactory, GModelSerializer, GModelRoot } from '@eclipse-glsp/server';
import { Action, MessageAction, SetModelAction } from '@eclipse-glsp/protocol';
import { CreateInstanceReferenceAction } from '../ecore-actions';
import { InstanceModelStorage } from '../instance-model-storage';

@injectable()
export class CreateInstanceReferenceActionHandler implements ActionHandler {
    actionKinds = [CreateInstanceReferenceAction.KIND];

    @inject(InstanceModelStorage)
    protected instanceStorage: InstanceModelStorage;

    @inject(ModelState)
    protected modelState: ModelState;

    @inject(GModelFactory)
    protected gmodelFactory: GModelFactory;

    @inject(GModelSerializer)
    protected gmodelSerializer: GModelSerializer;

    async execute(action: CreateInstanceReferenceAction): Promise<Action[]> {
        console.log('CreateInstanceReferenceActionHandler.execute()', action);

        try {
            this.instanceStorage.createReference(
                action.sourceInstanceId,
                action.referenceName,
                action.targetInstanceId
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
                        `Created reference ${action.referenceName} from ${action.sourceInstanceId} to ${action.targetInstanceId}`,
                        { severity: 'INFO' }
                    )
                ];
            } else {
                return [
                    MessageAction.create('Failed to update instance visualization', { severity: 'ERROR' })
                ];
            }
        } catch (error) {
            console.error('Error creating instance reference:', error);
            return [
                MessageAction.create(
                    `Error creating reference: ${error instanceof Error ? error.message : String(error)}`,
                    { severity: 'ERROR' }
                )
            ];
        }
    }
}


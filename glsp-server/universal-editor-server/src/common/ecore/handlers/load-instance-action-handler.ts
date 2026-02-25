/**
 * @author Abigail Sotomayor <s205720@dtu.dk>
 */
import { injectable, inject } from 'inversify';
import { ActionHandler, ModelState, GModelFactory, GModelRoot } from '@eclipse-glsp/server';
import { Action, SetModelAction, MessageAction } from '@eclipse-glsp/protocol';
import { LoadInstanceAction } from '../ecore-actions';
import { InstanceModelStorage } from '../instance-model-storage';

@injectable()
export class LoadInstanceActionHandler implements ActionHandler {
    actionKinds = [LoadInstanceAction.KIND];

    @inject(InstanceModelStorage)
    protected instanceStorage: InstanceModelStorage;

    @inject(ModelState)
    protected modelState: ModelState;

    @inject(GModelFactory)
    protected gmodelFactory: GModelFactory;

    async execute(action: LoadInstanceAction): Promise<Action[]> {

        try {
            // Set view mode to instance
            this.modelState.set('viewMode', 'instance');

            // Load the instance model
            const result = this.instanceStorage.loadInstanceModel(action.content, action.filename);
            
            if (result.success) {
                console.log(`Instance model loaded from ${action.filename}`);
                
                // Regenerate the graphical model to show the loaded instances
                this.gmodelFactory.createModel();
                const gmodel = this.modelState.get('gmodel') as GModelRoot;
                
                if (gmodel && gmodel.type && gmodel.id) {
                    return [
                        SetModelAction.create(gmodel),
                        MessageAction.create(
                            result.message,
                            { severity: 'INFO' }
                        )
                    ];
                } else {
                    return [
                        MessageAction.create(
                            result.message,
                            { severity: 'INFO' }
                        )
                    ];
                }
            } else {
                return [
                    MessageAction.create(
                        result.message,
                        { severity: 'ERROR' }
                    )
                ];
            }
        } catch (error) {
            console.error('Error loading instance model:', error);
            return [
                MessageAction.create(
                    `Error loading instance model: ${error instanceof Error ? error.message : String(error)}`,
                    { severity: 'ERROR' }
                )
            ];
        }
    }
}


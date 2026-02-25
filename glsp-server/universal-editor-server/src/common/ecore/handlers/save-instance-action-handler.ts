/**
 * @author Abigail Sotomayor <s205720@dtu.dk>
 */
import { injectable, inject } from 'inversify';
import { ActionHandler } from '@eclipse-glsp/server';
import { Action, MessageAction } from '@eclipse-glsp/protocol';
import { SaveInstanceAction } from '../ecore-actions';
import { InstanceModelStorage } from '../instance-model-storage';

@injectable()
export class SaveInstanceActionHandler implements ActionHandler {
    actionKinds = [SaveInstanceAction.KIND];

    @inject(InstanceModelStorage)
    protected instanceStorage: InstanceModelStorage;

    async execute(action: SaveInstanceAction): Promise<Action[]> {
        console.log('SaveInstanceActionHandler.execute()', action);

        try {
            const result = this.instanceStorage.saveInstanceModel(action.filename);
            if (result.success) {
                console.log(`Instance model saved to ${result.filePath}`);
                return [
                    MessageAction.create(
                        `Instance model saved successfully to ${result.filePath}`,
                        { severity: 'INFO' }
                    )
                ];
            } else {
                return [
                    MessageAction.create(
                        result.message,
                        { severity: 'ERROR' }
                    )
                ];
            }
        } catch (error) {
            console.error('Error saving instance model:', error);
            return [
                MessageAction.create(
                    `Error saving instance model: ${error instanceof Error ? error.message : String(error)}`,
                    { severity: 'ERROR' }
                )
            ];
        }
    }
}


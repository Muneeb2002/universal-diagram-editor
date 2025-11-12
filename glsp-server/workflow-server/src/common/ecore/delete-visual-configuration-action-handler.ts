import { injectable, inject } from 'inversify';
import { ActionHandler } from '@eclipse-glsp/server';
import { Action, MessageAction } from '@eclipse-glsp/protocol';
import { DeleteVisualConfigurationAction } from './ecore-actions';
import { MetamodelRegistry } from './metamodel-registry';
import { VisualConfigurationStorage } from './visual-configuration-storage';

@injectable()
export class DeleteVisualConfigurationActionHandler implements ActionHandler {
    actionKinds = [DeleteVisualConfigurationAction.KIND];

    @inject(MetamodelRegistry)
    protected metamodelRegistry: MetamodelRegistry;

    @inject(VisualConfigurationStorage)
    protected visualConfigStorage: VisualConfigurationStorage;

    async execute(action: Action): Promise<Action[]> {
        if (!DeleteVisualConfigurationAction.is(action)) {
            return [];
        }

        try {
            const normalizedName = action.filename.trim();
            if (normalizedName.length === 0) {
                return [
                    MessageAction.create('No visual configuration name provided to remove.', { severity: 'WARNING' })
                ];
            }

            const removed = this.visualConfigStorage.removeClassConfiguration(normalizedName);
            if (!removed) {
                return [
                    MessageAction.create(
                        `Visual configuration for '${normalizedName}' not found in cache.`,
                        { severity: 'WARNING' }
                    )
                ];
            }

            return [
                MessageAction.create(
                    `Removed cached visual configuration for '${normalizedName}'.`,
                    { severity: 'INFO' }
                )
            ];
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error('Error deleting visual configuration file:', error);
            return [
                MessageAction.create(
                    `Failed to delete visual configuration: ${message}`,
                    { severity: 'ERROR' }
                )
            ];
        }
    }
}


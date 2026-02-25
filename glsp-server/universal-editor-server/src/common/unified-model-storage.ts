/**
 * @author Abigail Sotomayor <s205720@dtu.dk>
 */
import { injectable, inject } from 'inversify';
import { RequestModelAction, SaveModelAction } from '@eclipse-glsp/protocol';
import { ModelState, SourceModelStorage } from '@eclipse-glsp/server';
import { EcoreModelStorage } from './ecore/ecore-model-storage';

/**
 * Unified model storage that delegates to the appropriate storage based on the model type
 */
@injectable()
export class UnifiedModelStorage implements SourceModelStorage {
    @inject(EcoreModelStorage)
    protected ecoreStorage: EcoreModelStorage;

    @inject(ModelState)
    protected modelState: ModelState;

    async loadSourceModel(action: RequestModelAction): Promise<void> {
        await this.ecoreStorage.loadSourceModel(action);
    }

    async saveSourceModel(action: SaveModelAction): Promise<void> {
        await this.ecoreStorage.saveSourceModel(action);
    }
}

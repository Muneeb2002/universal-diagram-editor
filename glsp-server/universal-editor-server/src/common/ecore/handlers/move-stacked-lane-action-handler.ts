import { Action, UpdateModelAction } from '@eclipse-glsp/protocol';
import { ActionHandler, GModelFactory, GModelRoot, ModelState } from '@eclipse-glsp/server';
import { inject, injectable } from 'inversify';
import { InstanceModelStorage } from '../instance-model-storage';

interface MoveStackedLaneAction extends Action {
    laneId: string;
    direction: 'up' | 'down';
}

@injectable()
export class MoveStackedLaneActionHandler implements ActionHandler {
    readonly actionKinds = ['moveStackedLane'];

    @inject(ModelState)
    protected modelState: ModelState;

    @inject(GModelFactory)
    protected gmodelFactory: GModelFactory;

    @inject(InstanceModelStorage)
    protected instanceStorage: InstanceModelStorage;

    execute(action: MoveStackedLaneAction): Action[] {
        if (this.modelState.isReadonly || this.modelState.get('viewMode') !== 'instance' || typeof action.laneId !== 'string' ||
            (action.direction !== 'up' && action.direction !== 'down') ||
            !this.instanceStorage.moveStackedLane(action.laneId, action.direction)) return [];

        this.gmodelFactory.createModel();
        const graph = this.modelState.get<GModelRoot>('gmodel');
        return graph ? [UpdateModelAction.create(graph, { animate: false })] : [];
    }
}

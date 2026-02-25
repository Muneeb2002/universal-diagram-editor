/**
 * @author Abigail Sotomayor <s205720@dtu.dk>
 */
import { injectable, inject } from 'inversify';
import { Action, ActionHandler } from '@eclipse-glsp/server';
import { InstanceModelStorage } from '../instance-model-storage';
import {
    RequestInstancesOverviewAction,
    InstancesOverviewResponse
} from '../ecore-actions';

@injectable()
export class RequestInstancesOverviewActionHandler implements ActionHandler {
    actionKinds = [RequestInstancesOverviewAction.KIND];

    @inject(InstanceModelStorage)
    protected readonly instanceStorage: InstanceModelStorage;

    async execute(action: Action): Promise<Action[]> {
        if (!RequestInstancesOverviewAction.is(action)) {
            return [];
        }

        const activeModel = this.instanceStorage.getActiveInstanceModel();
        if (!activeModel) {
            return [
                InstancesOverviewResponse.create(
                    action.requestId,
                    false,
                    [],
                    'No active instance model'
                )
            ];
        }

        const allowed = new Set(
            (action.classNames ?? []).map(name => name.trim()).filter(name => !!name)
        );

        const instances = this.instanceStorage
            .getAllInstances()
            .filter(instance => !instance.hidden)
            .filter(instance => {
                if (allowed.size === 0) {
                    return true;
                }
                return allowed.has(instance.eClassName);
            })
            .map(instance => {
                // Convert attributes Map to plain object
                const attrsObj: Record<string, any> = {};
                if (instance.attributes && instance.attributes.size > 0) {
                    instance.attributes.forEach((value, key) => {
                        attrsObj[key] = value;
                    });
                }
                return {
                    id: instance.id,
                    className: instance.eClassName,
                    hidden: instance.hidden,
                    attributes: attrsObj
                };
            });

        return [
            InstancesOverviewResponse.create(
                action.requestId,
                true,
                instances
            )
        ];
    }
}


import { Action, CommandExecutionContext, CommandReturn, TYPES } from '@eclipse-glsp/sprotty';
import { inject, injectable } from 'inversify';
import { FeedbackCommand, GNode, addResizeHandles, removeResizeHandles } from '@eclipse-glsp/client';

export interface SetCompositeComponentAction extends Action {
    kind: typeof SetCompositeComponentAction.KIND;
    nodeId: string;
    componentIndex: number;
    bounds?: { x: number; y: number; width: number; height: number };
}

export namespace SetCompositeComponentAction {
    export const KIND = 'setCompositeComponent';

    export function create(
        nodeId: string,
        componentIndex: number,
        bounds?: { x: number; y: number; width: number; height: number }
    ): SetCompositeComponentAction {
        return { kind: KIND, nodeId, componentIndex, bounds };
    }
}

@injectable()
export class SetCompositeComponentCommand extends FeedbackCommand {
    static readonly KIND = SetCompositeComponentAction.KIND;

    @inject(TYPES.Action) protected action: SetCompositeComponentAction;

    execute(context: CommandExecutionContext): CommandReturn {
        const node = context.root.index.getById(this.action.nodeId) as GNode | undefined;
        if (!node) return context.root;

        (node as any).selectedComponentIndex = this.action.componentIndex;
        if (this.action.componentIndex >= 0) {
            removeResizeHandles(node);
        } else {
            addResizeHandles(node, (node as any).resizeLocations);
        }
        const component = (node as any).shapeConfig?.components?.[this.action.componentIndex];
        if (component && this.action.bounds) {
            Object.assign(component, this.action.bounds);
        }
        return context.root;
    }
}

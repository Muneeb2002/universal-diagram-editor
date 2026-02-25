/**
 * @author Abigail Sotomayor <s205720@dtu.dk>
 */
import { injectable, inject } from 'inversify';
import { IActionHandler, Action, TYPES, IActionDispatcher } from '@eclipse-glsp/client';
import { MultiplicityDialog } from '../ui/dialogs/multiplicity-dialog';
import { MultiplicityInputAction, MultiplicityInputResponseAction } from '../ecore-client-actions';

@injectable()
export class MultiplicityInputActionHandler implements IActionHandler {
    actionKinds = [MultiplicityInputAction.KIND];

    @inject(TYPES.IActionDispatcher)
    protected actionDispatcher: IActionDispatcher;

    private multiplicityDialog: MultiplicityDialog | undefined;

    private getDialog(): MultiplicityDialog {
        if (!this.multiplicityDialog) {
            this.multiplicityDialog = new MultiplicityDialog();
        }
        return this.multiplicityDialog;
    }

    handle(action: Action): void {

        if (action.kind !== MultiplicityInputAction.KIND) {
            return;
        }

        const multiplicityAction = action as MultiplicityInputAction;

        this.getDialog().show(
            multiplicityAction.sourceClassName,
            multiplicityAction.targetClassName,
            multiplicityAction.edgeType
        ).then((multiplicityOptions) => {

            const response = MultiplicityInputResponseAction.create(
                multiplicityOptions.referenceName,
                multiplicityOptions.lowerBound,
                multiplicityOptions.upperBound,
                multiplicityAction.sourceElementId,
                multiplicityAction.targetElementId,
                multiplicityAction.edgeType
            );

            this.actionDispatcher.dispatch(response);

        }).catch(() => {
        });

        return;
    }
}

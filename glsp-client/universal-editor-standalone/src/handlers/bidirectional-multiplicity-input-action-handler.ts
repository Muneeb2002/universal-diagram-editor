/**
 * @author Abigail Sotomayor <s205720@dtu.dk>
 */
import { injectable, inject } from 'inversify';
import { IActionHandler, Action, TYPES, IActionDispatcher } from '@eclipse-glsp/client';
import { BidirectionalMultiplicityDialog } from '../ui/dialogs/bidirectional-multiplicity-dialog';
import { BidirectionalMultiplicityInputAction, BidirectionalMultiplicityInputResponseAction } from '../ecore-client-actions';

@injectable()
export class BidirectionalMultiplicityInputActionHandler implements IActionHandler {
    actionKinds = [BidirectionalMultiplicityInputAction.KIND];

    @inject(TYPES.IActionDispatcher)
    protected actionDispatcher: IActionDispatcher;

    private bidirectionalDialog: BidirectionalMultiplicityDialog | undefined;

    private getDialog(): BidirectionalMultiplicityDialog {
        if (!this.bidirectionalDialog) {
            this.bidirectionalDialog = new BidirectionalMultiplicityDialog();
        }
        return this.bidirectionalDialog;
    }

    handle(action: Action): void {

        if (action.kind !== BidirectionalMultiplicityInputAction.KIND) {
            return;
        }

        const bidirectionalAction = action as BidirectionalMultiplicityInputAction;

        this.getDialog().show(
            bidirectionalAction.sourceClassName,
            bidirectionalAction.targetClassName
        ).then((options) => {

            const response = BidirectionalMultiplicityInputResponseAction.create(
                options.sourceReferenceName,
                options.sourceLowerBound,
                options.sourceUpperBound,
                options.targetReferenceName,
                options.targetLowerBound,
                options.targetUpperBound,
                bidirectionalAction.sourceElementId,
                bidirectionalAction.targetElementId
            );

            this.actionDispatcher.dispatch(response);

        }).catch(() => {
        });

        return;
    }
}


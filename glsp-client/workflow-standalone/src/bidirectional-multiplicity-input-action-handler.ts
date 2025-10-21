import { injectable, inject } from 'inversify';
import { IActionHandler, Action, TYPES, IActionDispatcher } from '@eclipse-glsp/client';
import { BidirectionalMultiplicityDialog } from './bidirectional-multiplicity-dialog';
import { BidirectionalMultiplicityInputAction, BidirectionalMultiplicityInputResponseAction } from './ecore-client-actions';

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
        console.log('BidirectionalMultiplicityInputActionHandler.handle() called with action:', action);

        // Type guard to ensure we have the right action type
        if (action.kind !== BidirectionalMultiplicityInputAction.KIND) {
            console.log('Action kind mismatch, ignoring action');
            return;
        }

        const bidirectionalAction = action as BidirectionalMultiplicityInputAction;

        // Show dialog asynchronously and handle response
        console.log('About to show bidirectional dialog for:', bidirectionalAction.sourceClassName, '<->', bidirectionalAction.targetClassName);
        this.getDialog().show(
            bidirectionalAction.sourceClassName,
            bidirectionalAction.targetClassName
        ).then((options) => {
            console.log('User selected bidirectional multiplicity options:', options);

            // Create response action with user input
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

            console.log('Dispatching BidirectionalMultiplicityInputResponseAction:', response);
            // Dispatch the response action
            this.actionDispatcher.dispatch(response);
            console.log('BidirectionalMultiplicityInputResponseAction dispatched successfully');
        }).catch((error) => {
            console.log('User cancelled bidirectional multiplicity input:', error);
            // User cancelled - don't send any response
        });

        // Return void since we're handling the response asynchronously
        return;
    }
}


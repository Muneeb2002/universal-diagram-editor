import { injectable, inject } from 'inversify';
import { IActionHandler, Action, TYPES, IActionDispatcher } from '@eclipse-glsp/client';
import { MultiplicityDialog } from './multiplicity-dialog';
import { MultiplicityInputAction, MultiplicityInputResponseAction } from './ecore-client-actions';

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
        console.log('MultiplicityInputActionHandler.handle() called with action:', action);
        console.log('Action kind:', action.kind);
        console.log('Expected kind:', MultiplicityInputAction.KIND);

        // Type guard to ensure we have the right action type
        if (action.kind !== MultiplicityInputAction.KIND) {
            console.log('Action kind mismatch, ignoring action');
            return;
        }

        const multiplicityAction = action as MultiplicityInputAction;

        // Show dialog asynchronously and handle response
        console.log('About to show dialog for:', multiplicityAction.sourceClassName, '->', multiplicityAction.targetClassName);
        this.getDialog().show(
            multiplicityAction.sourceClassName,
            multiplicityAction.targetClassName
        ).then((multiplicityOptions) => {
            console.log('User selected multiplicity options:', multiplicityOptions);

            // Create response action with user input
            const response = MultiplicityInputResponseAction.create(
                multiplicityOptions.referenceName,
                multiplicityOptions.lowerBound,
                multiplicityOptions.upperBound,
                multiplicityAction.sourceElementId,
                multiplicityAction.targetElementId,
                multiplicityAction.edgeType
            );

            console.log('Dispatching MultiplicityInputResponseAction:', response);
            // Dispatch the response action
            this.actionDispatcher.dispatch(response);
            console.log('MultiplicityInputResponseAction dispatched successfully');
        }).catch((error) => {
            console.log('User cancelled multiplicity input:', error);
            // User cancelled - don't send any response
        });

        // Return void since we're handling the response asynchronously
        return;
    }
}

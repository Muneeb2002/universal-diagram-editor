 /********************************************************************************
  * Copyright (c) 2024 Eclipse GLSP and others.
  *
  * This program and the accompanying materials are made available under the
  * terms of the Eclipse Public License v. 2.0 which is available at
  * http://www.eclipse.org/legal/epl-2.0.
  *
  * SPDX-License-Identifier: EPL-2.0
  ********************************************************************************/

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
        

        // Type guard to ensure we have the right action type
        if (action.kind !== BidirectionalMultiplicityInputAction.KIND) {
            
            return;
        }

        const bidirectionalAction = action as BidirectionalMultiplicityInputAction;

        // Show dialog asynchronously and handle response
        
        this.getDialog().show(
            bidirectionalAction.sourceClassName,
            bidirectionalAction.targetClassName
        ).then((options) => {
            

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

            
            // Dispatch the response action
            this.actionDispatcher.dispatch(response);
            
        }).catch((error) => {
            
            // User cancelled - don't send any response
        });

        // Return void since we're handling the response asynchronously
        return;
    }
}


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
        

        // Type guard to ensure we have the right action type
        if (action.kind !== MultiplicityInputAction.KIND) {
            
            return;
        }

        const multiplicityAction = action as MultiplicityInputAction;

        // Show dialog asynchronously and handle response
        
        this.getDialog().show(
            multiplicityAction.sourceClassName,
            multiplicityAction.targetClassName,
            multiplicityAction.edgeType
        ).then((multiplicityOptions) => {
            

            // Create response action with user input
            const response = MultiplicityInputResponseAction.create(
                multiplicityOptions.referenceName,
                multiplicityOptions.lowerBound,
                multiplicityOptions.upperBound,
                multiplicityAction.sourceElementId,
                multiplicityAction.targetElementId,
                multiplicityAction.edgeType
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

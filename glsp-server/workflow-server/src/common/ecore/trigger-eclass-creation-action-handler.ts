/********************************************************************************
 * Copyright (c) 2024 Eclipse GLSP and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * SPDX-License-Identifier: EPL-2.0
 ********************************************************************************/

import { injectable } from 'inversify';
import { Action } from '@eclipse-glsp/protocol';
import { ActionHandler } from '@eclipse-glsp/server';
import { TriggerEClassCreationAction } from './ecore-actions';

/**
 * Action handler that triggers the EClass creation dialog on the client.
 */
@injectable()
export class TriggerEClassCreationActionHandler implements ActionHandler {
    actionKinds = [TriggerEClassCreationAction.KIND];

    async execute(action: Action): Promise<Action[]> {
        // For now, we'll just return an empty array
        // The client-side palette action handling will trigger the dialog directly
        if (TriggerEClassCreationAction.is(action)) {
            // No server-side processing needed - client handles the dialog
            return [];
        }
        return [];
    }
}

/********************************************************************************
 * Copyright (c) 2024 Eclipse GLSP and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * SPDX-License-Identifier: EPL-2.0
 ********************************************************************************/

import { Action, IActionHandler } from '@eclipse-glsp/client';
import { injectable } from 'inversify';
import { InstancesOverviewResponse } from './ecore-client-actions';
import { getGlobalToolbar } from './load-metamodel-response-handler';

@injectable()
export class InstancesOverviewResponseHandler implements IActionHandler {
    handle(action: Action): void {
        if (this.isInstancesOverviewResponse(action)) {
            const toolbar = getGlobalToolbar();
            if (toolbar && typeof toolbar.handleInstancesOverviewResponse === 'function') {
                toolbar.handleInstancesOverviewResponse(action);
            } else {
                console.warn('InstancesOverviewResponse received but toolbar handler is unavailable');
            }
        }
    }

    private isInstancesOverviewResponse(action: Action): action is InstancesOverviewResponse {
        return action.kind === 'instancesOverviewResponse';
    }
}


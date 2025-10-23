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
import { ActionHandler } from '@eclipse-glsp/server';
import { Action } from '@eclipse-glsp/protocol';
import { LoadMetamodelResponse } from './ecore-actions';

/**
 * Handler for LoadMetamodelResponse.
 * This is a pass-through handler that allows the response to be sent to the client
 * without server-side processing.
 */
@injectable()
export class LoadMetamodelResponseHandler implements ActionHandler {
    actionKinds = [LoadMetamodelResponse.KIND];

    async execute(action: LoadMetamodelResponse): Promise<Action[]> {
        // This is a response action meant for the client
        // No server-side processing needed, just return empty array
        console.log('LoadMetamodelResponse forwarded to client:', action.success ? 'Success' : 'Failed');
        return [];
    }
}


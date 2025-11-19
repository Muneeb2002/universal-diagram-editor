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
import { Action, IActionHandler } from '@eclipse-glsp/client';
import { EnumNamesResponse } from './ecore-client-actions';

// Global storage for pending enum name requests
const pendingEnumNameRequests = new Map<string, {
    resolve: (enumNames: string[]) => void;
    reject: (error: any) => void;
    timeoutHandle: number;
}>();

export function getPendingEnumNameRequest(requestId: string) {
    return pendingEnumNameRequests.get(requestId);
}

export function setPendingEnumNameRequest(
    requestId: string,
    resolve: (enumNames: string[]) => void,
    reject: (error: any) => void,
    timeoutHandle: number
) {
    pendingEnumNameRequests.set(requestId, { resolve, reject, timeoutHandle });
}

export function clearPendingEnumNameRequest(requestId: string) {
    pendingEnumNameRequests.delete(requestId);
}

/**
 * Client-side handler for EnumNamesResponse actions.
 */
@injectable()
export class EnumNamesResponseHandler implements IActionHandler {
    handle(action: Action): void {
        if (this.isEnumNamesResponse(action)) {
            const pending = getPendingEnumNameRequest(action.responseId);
            if (!pending) {
                return;
            }

            window.clearTimeout(pending.timeoutHandle);
            clearPendingEnumNameRequest(action.responseId);

            if (!action.success) {
                pending.reject(new Error(action.message ?? 'Failed to retrieve enum names'));
                return;
            }

            pending.resolve(action.enumNames || []);
        }
    }

    private isEnumNamesResponse(action: Action): action is EnumNamesResponse {
        return action.kind === 'enumNamesResponse' && 'responseId' in action;
    }
}


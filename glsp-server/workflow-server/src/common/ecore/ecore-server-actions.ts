/********************************************************************************
 * Copyright (c) 2024 Eclipse GLSP and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * SPDX-License-Identifier: EPL-2.0
 ********************************************************************************/

import { Action } from '@eclipse-glsp/protocol';

// Multiplicity Input Actions for Containment Edges
export interface MultiplicityInputAction extends Action {
    kind: typeof MultiplicityInputAction.KIND;
    sourceClassName: string;
    targetClassName: string;
    edgeType: string;
    sourceElementId: string;
    targetElementId: string;
}

export namespace MultiplicityInputAction {
    export const KIND = 'multiplicityInput';
    
    export function create(
        sourceClassName: string, 
        targetClassName: string, 
        edgeType: string,
        sourceElementId: string,
        targetElementId: string
    ): MultiplicityInputAction {
        return {
            kind: KIND,
            sourceClassName,
            targetClassName,
            edgeType,
            sourceElementId,
            targetElementId
        };
    }
}

export interface MultiplicityInputResponseAction extends Action {
    kind: typeof MultiplicityInputResponseAction.KIND;
    referenceName: string;
    lowerBound: number;
    upperBound: number;
    sourceElementId: string;
    targetElementId: string;
    edgeType: string;
}

export namespace MultiplicityInputResponseAction {
    export const KIND = 'multiplicityInputResponse';
    
    export function create(
        referenceName: string,
        lowerBound: number,
        upperBound: number,
        sourceElementId: string,
        targetElementId: string,
        edgeType: string
    ): MultiplicityInputResponseAction {
        return {
            kind: KIND,
            referenceName,
            lowerBound,
            upperBound,
            sourceElementId,
            targetElementId,
            edgeType
        };
    }
}

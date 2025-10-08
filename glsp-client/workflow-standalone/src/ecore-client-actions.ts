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

/**
 * Client-side action type definitions for Ecore metamodel operations.
 * These should match the server-side action definitions.
 */

export interface LoadMetamodelAction {
    kind: 'loadMetamodel';
    content: string;
    filename: string;
    setAsActive?: boolean;
}

export interface LoadMetamodelResponse {
    kind: 'loadMetamodelResponse';
    success: boolean;
    metamodelKey: string;
    message?: string;
    classNames?: string[];
}

export interface SwitchModeAction {
    kind: 'switchMode';
    mode: 'metamodel' | 'instance';
}

export interface CreateInstanceAction {
    kind: 'createInstance';
    eClassName: string;
    position?: { x: number; y: number };
}

export interface SetInstanceAttributeAction {
    kind: 'setInstanceAttribute';
    instanceId: string;
    attributeName: string;
    value: any;
}

export interface CreateInstanceReferenceAction {
    kind: 'createInstanceReference';
    sourceInstanceId: string;
    targetInstanceId: string;
    referenceName: string;
}

// Metamodel editing actions
export interface RenameClassAction {
    kind: 'renameClass';
    oldClassName: string;
    newClassName: string;
}

export interface ChangeClassTypeAction {
    kind: 'changeClassType';
    className: string;
    classType: 'abstract' | 'concrete' | 'interface';
}

export interface DeleteClassAction {
    kind: 'deleteClass';
    className: string;
    force?: boolean;
}




// Helper functions to create actions
export function createLoadMetamodelAction(
    content: string,
    filename: string,
    setAsActive = true
): LoadMetamodelAction {
    return {
        kind: 'loadMetamodel',
        content,
        filename,
        setAsActive
    };
}

export function createSwitchModeAction(mode: 'metamodel' | 'instance'): SwitchModeAction {
    return {
        kind: 'switchMode',
        mode
    };
}

export function createCreateInstanceAction(
    eClassName: string,
    position?: { x: number; y: number }
): CreateInstanceAction {
    return {
        kind: 'createInstance',
        eClassName,
        position
    };
}

// Helper functions for metamodel editing actions
export function createRenameClassAction(
    oldClassName: string,
    newClassName: string
): RenameClassAction {
    return {
        kind: 'renameClass',
        oldClassName,
        newClassName
    };
}

export function createChangeClassTypeAction(
    className: string,
    classType: 'abstract' | 'concrete' | 'interface'
): ChangeClassTypeAction {
    return {
        kind: 'changeClassType',
        className,
        classType
    };
}

export function createDeleteClassAction(
    className: string,
    force = false
): DeleteClassAction {
    return {
        kind: 'deleteClass',
        className,
        force
    };
}


export interface SaveMetamodelAction extends Action {
    kind: typeof SaveMetamodelAction.KIND;
    filename?: string;
    format?: 'json' | 'ecore';
}

export namespace SaveMetamodelAction {
    export const KIND = 'saveMetamodel';

    export function is(object: any): object is SaveMetamodelAction {
        return Action.hasKind(object, KIND);
    }

    export function create(filename?: string, format: 'json' | 'ecore' = 'json'): SaveMetamodelAction {
        return {
            kind: KIND,
            filename,
            format
        };
    }
}

export function createSaveMetamodelAction(filename?: string, format: 'json' | 'ecore' = 'json'): SaveMetamodelAction {
    return SaveMetamodelAction.create(filename, format);
}

// Edge Actions
export interface ChangeEdgeTypeAction extends Action {
    kind: 'changeEdgeType';
    edgeId: string;
    newType: string;
    sourceId: string;
    targetId: string;
}

export interface DeleteEdgeAction extends Action {
    kind: 'deleteEdge';
    edgeId: string;
}

export namespace ChangeEdgeTypeAction {
    export const KIND = 'changeEdgeType';

    export function create(edgeId: string, newType: string, sourceId: string, targetId: string): ChangeEdgeTypeAction {
        return {
            kind: KIND,
            edgeId,
            newType,
            sourceId,
            targetId
        };
    }
}

export namespace DeleteEdgeAction {
    export const KIND = 'deleteEdge';

    export function create(edgeId: string): DeleteEdgeAction {
        return {
            kind: KIND,
            edgeId
        };
    }
}

export function createChangeEdgeTypeAction(edgeId: string, newType: string, sourceId: string, targetId: string): ChangeEdgeTypeAction {
    return ChangeEdgeTypeAction.create(edgeId, newType, sourceId, targetId);
}

export function createDeleteEdgeAction(edgeId: string): DeleteEdgeAction {
    return DeleteEdgeAction.create(edgeId);
}


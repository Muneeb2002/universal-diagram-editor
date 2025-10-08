/********************************************************************************
 * Copyright (c) 2024 Eclipse GLSP and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * SPDX-License-Identifier: EPL-2.0
 ********************************************************************************/

import { Action, hasStringProp, hasBooleanProp } from '@eclipse-glsp/protocol';

/**
 * Action to load a JSON metamodel.
 */
export interface LoadMetamodelAction extends Action {
    kind: typeof LoadMetamodelAction.KIND;
    content: string;
    filename: string;
    setAsActive?: boolean;
}

export namespace LoadMetamodelAction {
    export const KIND = 'loadMetamodel';

    export function is(object: any): object is LoadMetamodelAction {
        return Action.hasKind(object, KIND) && hasStringProp(object, 'content') && hasStringProp(object, 'filename');
    }

    export function create(content: string, filename: string, setAsActive = true): LoadMetamodelAction {
        return {
            kind: KIND,
            content,
            filename,
            setAsActive
        };
    }
}

/**
 * Response action after loading a metamodel.
 */
export interface LoadMetamodelResponse extends Action {
    kind: typeof LoadMetamodelResponse.KIND;
    success: boolean;
    metamodelKey: string;
    message?: string;
    classNames?: string[];
}

export namespace LoadMetamodelResponse {
    export const KIND = 'loadMetamodelResponse';

    export function is(object: any): object is LoadMetamodelResponse {
        return Action.hasKind(object, KIND) && hasBooleanProp(object, 'success') && hasStringProp(object, 'metamodelKey');
    }

    export function create(success: boolean, metamodelKey: string, message?: string, classNames?: string[]): LoadMetamodelResponse {
        return {
            kind: KIND,
            success,
            metamodelKey,
            message,
            classNames
        };
    }
}

/**
 * Action to switch between metamodel and instance view modes.
 */
export interface SwitchModeAction extends Action {
    kind: typeof SwitchModeAction.KIND;
    mode: 'metamodel' | 'instance';
}

export namespace SwitchModeAction {
    export const KIND = 'switchMode';

    export function is(object: any): object is SwitchModeAction {
        return Action.hasKind(object, KIND) && hasStringProp(object, 'mode');
    }

    export function create(mode: 'metamodel' | 'instance'): SwitchModeAction {
        return {
            kind: KIND,
            mode
        };
    }
}

/**
 * Action to create an instance of an EClass.
 */
export interface CreateInstanceAction extends Action {
    kind: typeof CreateInstanceAction.KIND;
    eClassName: string;
    position?: { x: number; y: number };
}

export namespace CreateInstanceAction {
    export const KIND = 'createInstance';

    export function is(object: any): object is CreateInstanceAction {
        return Action.hasKind(object, KIND) && hasStringProp(object, 'eClassName');
    }

    export function create(eClassName: string, position?: { x: number; y: number }): CreateInstanceAction {
        return {
            kind: KIND,
            eClassName,
            position
        };
    }
}

/**
 * Action to set an attribute value on an instance.
 */
export interface SetInstanceAttributeAction extends Action {
    kind: typeof SetInstanceAttributeAction.KIND;
    instanceId: string;
    attributeName: string;
    value: any;
}

export namespace SetInstanceAttributeAction {
    export const KIND = 'setInstanceAttribute';

    export function is(object: any): object is SetInstanceAttributeAction {
        return Action.hasKind(object, KIND) && hasStringProp(object, 'instanceId') && hasStringProp(object, 'attributeName');
    }

    export function create(instanceId: string, attributeName: string, value: any): SetInstanceAttributeAction {
        return {
            kind: KIND,
            instanceId,
            attributeName,
            value
        };
    }
}

/**
 * Action to create a reference between two instances.
 */
export interface CreateInstanceReferenceAction extends Action {
    kind: typeof CreateInstanceReferenceAction.KIND;
    sourceInstanceId: string;
    targetInstanceId: string;
    referenceName: string;
}

export namespace CreateInstanceReferenceAction {
    export const KIND = 'createInstanceReference';

    export function is(object: any): object is CreateInstanceReferenceAction {
        return (
            Action.hasKind(object, KIND) &&
            hasStringProp(object, 'sourceInstanceId') &&
            hasStringProp(object, 'targetInstanceId') &&
            hasStringProp(object, 'referenceName')
        );
    }

    export function create(sourceInstanceId: string, targetInstanceId: string, referenceName: string): CreateInstanceReferenceAction {
        return {
            kind: KIND,
            sourceInstanceId,
            targetInstanceId,
            referenceName
        };
    }
}




/**
 * Action to rename a class in a metamodel.
 */
export interface RenameClassAction extends Action {
    kind: typeof RenameClassAction.KIND;
    oldClassName: string;
    newClassName: string;
}

export namespace RenameClassAction {
    export const KIND = 'renameClass';

    export function is(object: any): object is RenameClassAction {
        return Action.hasKind(object, KIND) && hasStringProp(object, 'oldClassName') && hasStringProp(object, 'newClassName');
    }

    export function create(oldClassName: string, newClassName: string): RenameClassAction {
        return {
            kind: KIND,
            oldClassName,
            newClassName
        };
    }
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

/**
 * Action to change the type of a class (abstract, concrete, interface).
 */
export interface ChangeClassTypeAction extends Action {
    kind: typeof ChangeClassTypeAction.KIND;
    className: string;
    classType: 'abstract' | 'concrete' | 'interface';
}

export namespace ChangeClassTypeAction {
    export const KIND = 'changeClassType';

    export function is(object: any): object is ChangeClassTypeAction {
        return Action.hasKind(object, KIND) && hasStringProp(object, 'className') && hasStringProp(object, 'classType');
    }

    export function create(className: string, classType: 'abstract' | 'concrete' | 'interface'): ChangeClassTypeAction {
        return {
            kind: KIND,
            className,
            classType
        };
    }
}

/**
 * Action to delete a class from the metamodel.
 */
export interface DeleteClassAction extends Action {
    kind: typeof DeleteClassAction.KIND;
    className: string;
    force?: boolean; // If true, delete even if there are references (removes references too)
}

export namespace DeleteClassAction {
    export const KIND = 'deleteClass';

    export function is(object: any): object is DeleteClassAction {
        return Action.hasKind(object, KIND) && hasStringProp(object, 'className');
    }

    export function create(className: string, force = false): DeleteClassAction {
        return {
            kind: KIND,
            className,
            force
        };
    }
}

/**
 * Action to change the type of an edge.
 */
export interface ChangeEdgeTypeAction extends Action {
    kind: typeof ChangeEdgeTypeAction.KIND;
    edgeId: string;
    newType: string;
    sourceId: string;
    targetId: string;
    lowerBound?: number;
    upperBound?: number;
}

export namespace ChangeEdgeTypeAction {
    export const KIND = 'changeEdgeType';

    export function is(object: any): object is ChangeEdgeTypeAction {
        return Action.hasKind(object, KIND) && 
               hasStringProp(object, 'edgeId') && 
               hasStringProp(object, 'newType') &&
               hasStringProp(object, 'sourceId') &&
               hasStringProp(object, 'targetId');
    }

    export function create(edgeId: string, newType: string, sourceId: string, targetId: string, lowerBound?: number, upperBound?: number): ChangeEdgeTypeAction {
        return {
            kind: KIND,
            edgeId,
            newType,
            sourceId,
            targetId,
            lowerBound,
            upperBound
        };
    }
}

/**
 * Action to delete an edge.
 */
export interface DeleteEdgeAction extends Action {
    kind: typeof DeleteEdgeAction.KIND;
    edgeId: string;
}

export namespace DeleteEdgeAction {
    export const KIND = 'deleteEdge';

    export function is(object: any): object is DeleteEdgeAction {
        return Action.hasKind(object, KIND) && hasStringProp(object, 'edgeId');
    }

    export function create(edgeId: string): DeleteEdgeAction {
        return {
            kind: KIND,
            edgeId
        };
    }
}
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
    classType: 'abstract' | 'concrete' | 'interface' | 'abstract-interface';
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

export function createSetInstanceAttributeAction(
    instanceId: string,
    attributeName: string,
    value: any
): SetInstanceAttributeAction {
    return {
        kind: 'setInstanceAttribute',
        instanceId,
        attributeName,
        value
    };
}

export function createCreateInstanceReferenceAction(
    sourceInstanceId: string,
    targetInstanceId: string,
    referenceName: string
): CreateInstanceReferenceAction {
    return {
        kind: 'createInstanceReference',
        sourceInstanceId,
        targetInstanceId,
        referenceName
    };
}

// Visual Configuration Actions
export interface OpenVisualConfigurationAction extends Action {
    kind: 'openVisualConfiguration';
}

export interface SetClassVisualConfigurationAction extends Action {
    kind: 'setClassVisualConfiguration';
    className: string;
    shape: string;
    color: string;
    showAttributes: boolean;
    showReferences: boolean;
}

export interface VisualConfigurationResponse extends Action {
    kind: 'visualConfigurationResponse';
    success: boolean;
    configurations: Array<{
        className: string;
        shape: string;
        color: string;
        showAttributes: boolean;
        showReferences: boolean;
    }>;
    availableShapes: string[];
    availableColors: string[];
}

export function createOpenVisualConfigurationAction(): OpenVisualConfigurationAction {
    return {
        kind: 'openVisualConfiguration'
    };
}

export function createSetClassVisualConfigurationAction(
    className: string,
    shape: string,
    color: string,
    showAttributes: boolean,
    showReferences: boolean
): SetClassVisualConfigurationAction {
    return {
        kind: 'setClassVisualConfiguration',
        className,
        shape,
        color,
        showAttributes,
        showReferences
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
    classType: 'abstract' | 'concrete' | 'interface' | 'abstract-interface'
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

// Custom Metamodel Creation Actions
export interface CreateCustomMetamodelAction {
    kind: 'createCustomMetamodel';
    packageName: string;
    nsURI: string;
    nsPrefix: string;
}

export interface CreateEClassAction {
    kind: 'createEClass';
    className: string;
    isAbstract: boolean;
    isInterface: boolean;
    hasAttributes: boolean;
    position?: { x: number; y: number };
}

export function createCreateCustomMetamodelAction(
    packageName: string,
    nsURI: string,
    nsPrefix: string
): CreateCustomMetamodelAction {
    return {
        kind: 'createCustomMetamodel',
        packageName,
        nsURI,
        nsPrefix
    };
}

export function createCreateEClassAction(
    className: string,
    isAbstract: boolean,
    isInterface: boolean,
    hasAttributes: boolean,
    position?: { x: number; y: number }
): CreateEClassAction {
    return {
        kind: 'createEClass',
        className,
        isAbstract,
        isInterface,
        hasAttributes,
        position
    };
}

/**
 * Action to add an attribute to an existing EClass.
 */
export interface AddAttributeAction extends Action {
    kind: 'addAttribute';
    className: string;
    attributeName: string;
    attributeType: string;
    lowerBound: number;
    upperBound: number;
}

export function createAddAttributeAction(
    className: string,
    attributeName: string,
    attributeType: string,
    lowerBound: number = 0,
    upperBound: number = 1
): AddAttributeAction {
    return {
        kind: 'addAttribute',
        className,
        attributeName,
        attributeType,
        lowerBound,
        upperBound
    };
}

/**
 * Action to delete an attribute from an existing EClass.
 */
export interface DeleteAttributeAction extends Action {
    kind: 'deleteAttribute';
    className: string;
    attributeName: string;
}

export function createDeleteAttributeAction(
    className: string,
    attributeName: string
): DeleteAttributeAction {
    return {
        kind: 'deleteAttribute',
        className,
        attributeName
    };
}

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

// Bidirectional Reference Actions
export interface BidirectionalMultiplicityInputAction extends Action {
    kind: typeof BidirectionalMultiplicityInputAction.KIND;
    sourceClassName: string;
    targetClassName: string;
    sourceElementId: string;
    targetElementId: string;
}

export namespace BidirectionalMultiplicityInputAction {
    export const KIND = 'bidirectionalMultiplicityInput';
    
    export function create(
        sourceClassName: string,
        targetClassName: string,
        sourceElementId: string,
        targetElementId: string
    ): BidirectionalMultiplicityInputAction {
        return {
            kind: KIND,
            sourceClassName,
            targetClassName,
            sourceElementId,
            targetElementId
        };
    }
}

export interface BidirectionalMultiplicityInputResponseAction extends Action {
    kind: typeof BidirectionalMultiplicityInputResponseAction.KIND;
    sourceReferenceName: string;
    sourceLowerBound: number;
    sourceUpperBound: number;
    targetReferenceName: string;
    targetLowerBound: number;
    targetUpperBound: number;
    sourceElementId: string;
    targetElementId: string;
}

export namespace BidirectionalMultiplicityInputResponseAction {
    export const KIND = 'bidirectionalMultiplicityInputResponse';
    
    export function create(
        sourceReferenceName: string,
        sourceLowerBound: number,
        sourceUpperBound: number,
        targetReferenceName: string,
        targetLowerBound: number,
        targetUpperBound: number,
        sourceElementId: string,
        targetElementId: string
    ): BidirectionalMultiplicityInputResponseAction {
        return {
            kind: KIND,
            sourceReferenceName,
            sourceLowerBound,
            sourceUpperBound,
            targetReferenceName,
            targetLowerBound,
            targetUpperBound,
            sourceElementId,
            targetElementId
        };
    }
}


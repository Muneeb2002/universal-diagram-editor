/********************************************************************************
 * Copyright (c) 2024 Eclipse GLSP and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * SPDX-License-Identifier: EPL-2.0
 ********************************************************************************/

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

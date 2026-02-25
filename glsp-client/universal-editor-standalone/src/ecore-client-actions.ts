/**
 * @author Abigail Sotomayor <s205720@dtu.dk>
 */
import { Action, RequestAction, ResponseAction, hasStringProp } from '@eclipse-glsp/protocol';

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

export interface ClassInfo {
    className: string;
    isAbstract: boolean;
    isInterface: boolean;
    eSuperTypes?: string[];
    attributes: Array<{
        name: string;
        type: string;
        lowerBound: number;
        upperBound: number;
        unique: boolean;
        ordered: boolean;
    }>;
    references: Array<{
        name: string;
        type: string;
        lowerBound: number;
        upperBound: number;
        containment: boolean;
        container: boolean;
        unique: boolean;
        ordered: boolean;
    }>;
}

export interface LoadMetamodelResponse {
    kind: 'loadMetamodelResponse';
    success: boolean;
    metamodelKey: string;
    message?: string;
    classNames?: string[];
    classInfo?: ClassInfo[];
    enumNames?: string[];
}

export interface SwitchModeAction {
    kind: 'switchMode';
    mode: 'metamodel' | 'instance';
}

export interface CreateInstanceAction {
    kind: 'createInstance';
    eClassName: string;
    position?: { x: number; y: number };
    containerInstanceId?: string;
    containmentReferenceName?: string;
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

export interface RequestInstancesOverviewAction {
    kind: 'requestInstancesOverview';
    requestId: string;
    classNames?: string[];
}

export interface InstancesOverviewResponse extends Action {
    kind: 'instancesOverviewResponse';
    requestId: string;
    success: boolean;
    instances: Array<{ id: string; className: string; hidden?: boolean; attributes?: Record<string, any> }>;
    message?: string;
}

export interface RequestEnumNamesAction extends RequestAction<EnumNamesResponse> {
    kind: 'requestEnumNames';
}

export interface EnumNamesResponse extends ResponseAction {
    kind: 'enumNamesResponse';
    success: boolean;
    enumNames: string[];
    message?: string;
}

export interface RenameClassAction {
    kind: 'renameClass';
    oldClassName: string;
    newClassName: string;
}

export interface RenameEnumAction {
    kind: 'renameEnum';
    oldEnumName: string;
    newEnumName: string;
}

export interface AddEnumLiteralAction {
    kind: 'addEnumLiteral';
    enumName: string;
    literalName: string;
    literalValue?: number;
}

export interface UpdateEnumLiteralAction {
    kind: 'updateEnumLiteral';
    enumName: string;
    oldLiteralName: string;
    newLiteralName: string;
    newLiteralValue?: number;
}

export interface DeleteEnumLiteralAction {
    kind: 'deleteEnumLiteral';
    enumName: string;
    literalName: string;
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

export interface SaveInstanceAction extends Action {
    kind: typeof SaveInstanceAction.KIND;
    filename: string;
}

export namespace SaveInstanceAction {
    export const KIND = 'saveInstance';

    export function is(object: any): object is SaveInstanceAction {
        return Action.hasKind(object, KIND) && hasStringProp(object, 'filename');
    }

    export function create(filename: string): SaveInstanceAction {
        return {
            kind: KIND,
            filename
        };
    }
}

export interface LoadInstanceAction extends Action {
    kind: typeof LoadInstanceAction.KIND;
    content: string;
    filename: string;
}

export namespace LoadInstanceAction {
    export const KIND = 'loadInstance';

    export function is(object: any): object is LoadInstanceAction {
        return Action.hasKind(object, KIND) && hasStringProp(object, 'content') && hasStringProp(object, 'filename');
    }

    export function create(content: string, filename: string): LoadInstanceAction {
        return {
            kind: KIND,
            content,
            filename
        };
    }
}

export function createCreateInstanceAction(
    eClassName: string,
    position?: { x: number; y: number },
    containerInstanceId?: string,
    containmentReferenceName?: string
): CreateInstanceAction {
    return {
        kind: 'createInstance',
        eClassName,
        position,
        containerInstanceId,
        containmentReferenceName
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

export function createRequestInstancesOverviewAction(
    requestId: string,
    classNames?: string[]
): RequestInstancesOverviewAction {
    return {
        kind: 'requestInstancesOverview',
        requestId,
        classNames
    };
}

export function createRequestEnumNamesAction(
    requestId: string
): RequestEnumNamesAction {
    return {
        kind: 'requestEnumNames',
        requestId
    };
}



export interface ClassPropertiesResponse extends Action {
    kind: 'classPropertiesResponse';
    success: boolean;
    metamodel: {
        name: string;
        nsURI: string;
        nsPrefix: string;
        classCount: number;
    };
    classes: Array<{
        className: string;
        isAbstract: boolean;
        isInterface: boolean;
        eSuperTypes: string[];
        attributes: Array<{ name: string; type: string; lowerBound: number; upperBound: number }>;
        references?: Array<{ name: string; type: string; lowerBound: number; upperBound: number; containment?: boolean }>;
    }>;
    enums?: Array<{
        enumName: string;
        literals: Array<{ name: string; value?: number }>;
    }>;
}

export function createOpenClassPropertiesAction(): Action {
    return { kind: 'openClassProperties' };
}

export interface SaveGraphicalModelAction extends Action {
    kind: typeof SaveGraphicalModelAction.KIND;
    filename: string;
    content: string;
}

export namespace SaveGraphicalModelAction {
    export const KIND = 'saveGraphicalModel';

    export function create(filename: string, content: string): SaveGraphicalModelAction {
        return {
            kind: KIND,
            filename,
            content
        };
    }

    export function is(object: any): object is SaveGraphicalModelAction {
        return Action.hasKind(object, KIND);
    }
}

export function createSaveGraphicalModelAction(filename: string, content: string): SaveGraphicalModelAction {
    return SaveGraphicalModelAction.create(filename, content);
}

export interface SaveShapeMappingsAction extends Action {
    kind: typeof SaveShapeMappingsAction.KIND;
    filename: string;
    content: string;
}

export namespace SaveShapeMappingsAction {
    export const KIND = 'saveShapeMappings';

    export function create(filename: string, content: string): SaveShapeMappingsAction {
        return {
            kind: KIND,
            filename,
            content
        };
    }

    export function is(object: any): object is SaveShapeMappingsAction {
        return Action.hasKind(object, KIND);
    }
}

export function createSaveShapeMappingsAction(filename: string, content: string): SaveShapeMappingsAction {
    return SaveShapeMappingsAction.create(filename, content);
}

export interface ApplyShapeMappingsAction extends Action {
    kind: 'applyShapeMappings';
    content: string;
}

export function createApplyShapeMappingsAction(content: string): ApplyShapeMappingsAction {
    return {
        kind: 'applyShapeMappings',
        content
    };
}


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

export function createRenameEnumAction(
    oldEnumName: string,
    newEnumName: string
): RenameEnumAction {
    return {
        kind: 'renameEnum',
        oldEnumName,
        newEnumName
    };
}

export function createAddEnumLiteralAction(
    enumName: string,
    literalName: string,
    literalValue?: number
): AddEnumLiteralAction {
    return {
        kind: 'addEnumLiteral',
        enumName,
        literalName,
        literalValue
    };
}

export function createUpdateEnumLiteralAction(
    enumName: string,
    oldLiteralName: string,
    newLiteralName: string,
    newLiteralValue?: number
): UpdateEnumLiteralAction {
    return {
        kind: 'updateEnumLiteral',
        enumName,
        oldLiteralName,
        newLiteralName,
        newLiteralValue
    };
}

export function createDeleteEnumLiteralAction(
    enumName: string,
    literalName: string
): DeleteEnumLiteralAction {
    return {
        kind: 'deleteEnumLiteral',
        enumName,
        literalName
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

export interface UpdateMetamodelPropertiesAction extends Action {
    kind: 'updateMetamodelProperties';
    name: string;
    nsURI: string;
    nsPrefix: string;
}

export function createUpdateMetamodelPropertiesAction(
    name: string,
    nsURI: string,
    nsPrefix: string
): UpdateMetamodelPropertiesAction {
    return {
        kind: 'updateMetamodelProperties',
        name,
        nsURI,
        nsPrefix
    };
}

export interface UpdateAttributeAction extends Action {
    kind: 'updateAttribute';
    className: string;
    originalAttributeName: string;
    attributeName: string;
    attributeType: string;
    lowerBound: number;
    upperBound: number;
}

export function createUpdateAttributeAction(
    className: string,
    originalAttributeName: string,
    attributeName: string,
    attributeType: string,
    lowerBound: number,
    upperBound: number
): UpdateAttributeAction {
    return {
        kind: 'updateAttribute',
        className,
        originalAttributeName,
        attributeName,
        attributeType,
        lowerBound,
        upperBound
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


export interface DeleteEdgeAction extends Action {
    kind: 'deleteEdge';
    edgeId: string;
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


export function createDeleteEdgeAction(edgeId: string): DeleteEdgeAction {
    return DeleteEdgeAction.create(edgeId);
}

export interface CreateCustomMetamodelAction {
    kind: 'createCustomMetamodel';
    packageName: string;
    nsURI: string;
    nsPrefix: string;
}

export interface CreateEClassAction {
    kind: 'createEClass';
    className: string;
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
    position?: { x: number; y: number }
): CreateEClassAction {
    return {
        kind: 'createEClass',
        className,
        position
    };
}

export interface CreateEEnumAction {
    kind: 'createEEnum';
    enumName: string;
    position?: { x: number; y: number };
    enumLiterals?: Array<{ name: string; value?: number }>;
}

export function createCreateEEnumAction(
    enumName: string,
    position?: { x: number; y: number },
    enumLiterals?: Array<{ name: string; value?: number }>
): CreateEEnumAction {
    return {
        kind: 'createEEnum',
        enumName,
        position,
        enumLiterals
    };
}

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


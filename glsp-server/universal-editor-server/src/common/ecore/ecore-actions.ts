/**
 * @author Abigail Sotomayor <s205720@dtu.dk>
 */
import { Action, RequestAction, ResponseAction, hasStringProp, hasBooleanProp } from '@eclipse-glsp/protocol';

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

export interface LoadMetamodelResponse extends Action {
    kind: typeof LoadMetamodelResponse.KIND;
    success: boolean;
    metamodelKey: string;
    message?: string;
    classNames?: string[];
    classInfo?: ClassInfo[];
    enumNames?: string[];
}

export namespace LoadMetamodelResponse {
    export const KIND = 'loadMetamodelResponse';

    export function is(object: any): object is LoadMetamodelResponse {
        return Action.hasKind(object, KIND) && hasBooleanProp(object, 'success') && hasStringProp(object, 'metamodelKey');
    }

    export function create(success: boolean, metamodelKey: string, message?: string, classNames?: string[], classInfo?: ClassInfo[], enumNames?: string[]): LoadMetamodelResponse {
        return {
            kind: KIND,
            success,
            metamodelKey,
            message,
            classNames,
            classInfo,
            enumNames
        };
    }
}

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

export interface CreateInstanceAction extends Action {
    kind: typeof CreateInstanceAction.KIND;
    eClassName: string;
    position?: { x: number; y: number };
    containerInstanceId?: string;
    containmentReferenceName?: string;
    placementReferenceName?: string;
    placementTargetId?: string;
}

export namespace CreateInstanceAction {
    export const KIND = 'createInstance';

    export function is(object: any): object is CreateInstanceAction {
        return Action.hasKind(object, KIND) && hasStringProp(object, 'eClassName');
    }

    export function create(
        eClassName: string,
        position?: { x: number; y: number },
        containerInstanceId?: string,
        containmentReferenceName?: string,
        placementReferenceName?: string,
        placementTargetId?: string
    ): CreateInstanceAction {
        return {
            kind: KIND,
            eClassName,
            position,
            containerInstanceId,
            containmentReferenceName,
            placementReferenceName,
            placementTargetId
        };
    }
}


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

export interface RequestInstancesOverviewAction extends Action {
    kind: typeof RequestInstancesOverviewAction.KIND;
    requestId: string;
    classNames?: string[];
}

export namespace RequestInstancesOverviewAction {
    export const KIND = 'requestInstancesOverview';

    export function is(object: any): object is RequestInstancesOverviewAction {
        return Action.hasKind(object, KIND) && hasStringProp(object, 'requestId');
    }

    export function create(requestId: string, classNames?: string[]): RequestInstancesOverviewAction {
        return {
            kind: KIND,
            requestId,
            classNames
        };
    }
}

export interface InstancesOverviewResponse extends Action {
    kind: typeof InstancesOverviewResponse.KIND;
    requestId: string;
    success: boolean;
    instances: Array<{ id: string; className: string; hidden?: boolean; attributes?: Record<string, any> }>;
    message?: string;
}

export namespace InstancesOverviewResponse {
    export const KIND = 'instancesOverviewResponse';

    export function is(object: any): object is InstancesOverviewResponse {
        return Action.hasKind(object, KIND) && hasStringProp(object, 'requestId');
    }

    export function create(
        requestId: string,
        success: boolean,
        instances: Array<{ id: string; className: string; hidden?: boolean; attributes?: Record<string, any> }> = [],
        message?: string
    ): InstancesOverviewResponse {
        return {
            kind: KIND,
            requestId,
            success,
            instances,
            message
        };
    }
}

export interface RequestEnumNamesAction extends RequestAction<EnumNamesResponse> {
    kind: typeof RequestEnumNamesAction.KIND;
}

export namespace RequestEnumNamesAction {
    export const KIND = 'requestEnumNames';

    export function is(object: any): object is RequestEnumNamesAction {
        return Action.hasKind(object, KIND) && hasStringProp(object, 'requestId');
    }

    export function create(requestId: string): RequestEnumNamesAction {
        return {
            kind: KIND,
            requestId
        };
    }
}

export interface EnumNamesResponse extends ResponseAction {
    kind: typeof EnumNamesResponse.KIND;
    success: boolean;
    enumNames: string[];
    message?: string;
}

export namespace EnumNamesResponse {
    export const KIND = 'enumNamesResponse';

    export function is(object: any): object is EnumNamesResponse {
        return Action.hasKind(object, KIND) && hasStringProp(object, 'responseId');
    }

    export function create(
        requestId: string,
        success: boolean,
        enumNames: string[] = [],
        message?: string
    ): EnumNamesResponse {
        return {
            kind: KIND,
            responseId: requestId,
            success,
            enumNames,
            message
        };
    }
}

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

export interface RenameEnumAction extends Action {
    kind: typeof RenameEnumAction.KIND;
    oldEnumName: string;
    newEnumName: string;
}

export namespace RenameEnumAction {
    export const KIND = 'renameEnum';

    export function is(object: any): object is RenameEnumAction {
        return Action.hasKind(object, KIND) && hasStringProp(object, 'oldEnumName') && hasStringProp(object, 'newEnumName');
    }

    export function create(oldEnumName: string, newEnumName: string): RenameEnumAction {
        return {
            kind: KIND,
            oldEnumName,
            newEnumName
        };
    }
}

export interface AddEnumLiteralAction extends Action {
    kind: typeof AddEnumLiteralAction.KIND;
    enumName: string;
    literalName: string;
    literalValue?: number;
}

export namespace AddEnumLiteralAction {
    export const KIND = 'addEnumLiteral';

    export function is(object: any): object is AddEnumLiteralAction {
        return Action.hasKind(object, KIND) && hasStringProp(object, 'enumName') && hasStringProp(object, 'literalName');
    }

    export function create(enumName: string, literalName: string, literalValue?: number): AddEnumLiteralAction {
        return {
            kind: KIND,
            enumName,
            literalName,
            literalValue
        };
    }
}

export interface UpdateEnumLiteralAction extends Action {
    kind: typeof UpdateEnumLiteralAction.KIND;
    enumName: string;
    oldLiteralName: string;
    newLiteralName: string;
    newLiteralValue?: number;
}

export namespace UpdateEnumLiteralAction {
    export const KIND = 'updateEnumLiteral';

    export function is(object: any): object is UpdateEnumLiteralAction {
        return Action.hasKind(object, KIND) && hasStringProp(object, 'enumName') && hasStringProp(object, 'oldLiteralName') && hasStringProp(object, 'newLiteralName');
    }

    export function create(enumName: string, oldLiteralName: string, newLiteralName: string, newLiteralValue?: number): UpdateEnumLiteralAction {
        return {
            kind: KIND,
            enumName,
            oldLiteralName,
            newLiteralName,
            newLiteralValue
        };
    }
}

export interface DeleteEnumLiteralAction extends Action {
    kind: typeof DeleteEnumLiteralAction.KIND;
    enumName: string;
    literalName: string;
}

export namespace DeleteEnumLiteralAction {
    export const KIND = 'deleteEnumLiteral';

    export function is(object: any): object is DeleteEnumLiteralAction {
        return Action.hasKind(object, KIND) && hasStringProp(object, 'enumName') && hasStringProp(object, 'literalName');
    }

    export function create(enumName: string, literalName: string): DeleteEnumLiteralAction {
        return {
            kind: KIND,
            enumName,
            literalName
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

export interface ChangeClassTypeAction extends Action {
    kind: typeof ChangeClassTypeAction.KIND;
    className: string;
    classType: 'abstract' | 'concrete' | 'interface' | 'abstract-interface';
}

export namespace ChangeClassTypeAction {
    export const KIND = 'changeClassType';

    export function is(object: any): object is ChangeClassTypeAction {
        return Action.hasKind(object, KIND) && hasStringProp(object, 'className') && hasStringProp(object, 'classType');
    }

    export function create(className: string, classType: 'abstract' | 'concrete' | 'interface' | 'abstract-interface'): ChangeClassTypeAction {
        return {
            kind: KIND,
            className,
            classType
        };
    }
}

export interface DeleteClassAction extends Action {
    kind: typeof DeleteClassAction.KIND;
    className: string;
    force?: boolean;
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

export interface UpdateMetamodelPropertiesAction extends Action {
    kind: typeof UpdateMetamodelPropertiesAction.KIND;
    name: string;
    nsURI: string;
    nsPrefix: string;
}

export namespace UpdateMetamodelPropertiesAction {
    export const KIND = 'updateMetamodelProperties';

    export function is(object: any): object is UpdateMetamodelPropertiesAction {
        return Action.hasKind(object, KIND) &&
            hasStringProp(object, 'name') &&
            hasStringProp(object, 'nsURI') &&
            hasStringProp(object, 'nsPrefix');
    }

    export function create(name: string, nsURI: string, nsPrefix: string): UpdateMetamodelPropertiesAction {
        return {
            kind: KIND,
            name,
            nsURI,
            nsPrefix
        };
    }
}

export interface UpdateAttributeAction extends Action {
    kind: typeof UpdateAttributeAction.KIND;
    className: string;
    originalAttributeName: string;
    attributeName: string;
    attributeType: string;
    lowerBound: number;
    upperBound: number;
}

export namespace UpdateAttributeAction {
    export const KIND = 'updateAttribute';

    export function is(object: any): object is UpdateAttributeAction {
        const candidate = object as any;
        const lowerBound = (candidate as { lowerBound?: unknown }).lowerBound;
        const upperBound = (candidate as { upperBound?: unknown }).upperBound;
        return Action.hasKind(candidate as Action, KIND) &&
            hasStringProp(candidate, 'className') &&
            hasStringProp(candidate, 'originalAttributeName') &&
            hasStringProp(candidate, 'attributeName') &&
            hasStringProp(candidate, 'attributeType') &&
            typeof lowerBound === 'number' &&
            typeof upperBound === 'number';
    }

    export function create(
        className: string,
        originalAttributeName: string,
        attributeName: string,
        attributeType: string,
        lowerBound: number,
        upperBound: number
    ): UpdateAttributeAction {
        return {
            kind: KIND,
            className,
            originalAttributeName,
            attributeName,
            attributeType,
            lowerBound,
            upperBound
        };
    }
}

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

export interface CreateCustomMetamodelAction extends Action {
    kind: typeof CreateCustomMetamodelAction.KIND;
    packageName: string;
    nsURI: string;
    nsPrefix: string;
}

export namespace CreateCustomMetamodelAction {
    export const KIND = 'createCustomMetamodel';

    export function is(object: any): object is CreateCustomMetamodelAction {
        return Action.hasKind(object, KIND) &&
            hasStringProp(object, 'packageName') &&
            hasStringProp(object, 'nsURI') &&
            hasStringProp(object, 'nsPrefix');
    }

    export function create(packageName: string, nsURI: string, nsPrefix: string): CreateCustomMetamodelAction {
        return {
            kind: KIND,
            packageName,
            nsURI,
            nsPrefix
        };
    }
}

export interface CreateEClassAction extends Action {
    kind: typeof CreateEClassAction.KIND;
    className: string;
    position?: { x: number; y: number };
}

export namespace CreateEClassAction {
    export const KIND = 'createEClass';

    export function is(object: any): object is CreateEClassAction {
        return Action.hasKind(object, KIND) &&
            hasStringProp(object, 'className');
    }

    export function create(
        className: string,
        position?: { x: number; y: number }
    ): CreateEClassAction {
        return {
            kind: KIND,
            className,
            position
        };
    }
}

export interface TriggerEClassCreationAction extends Action {
    kind: typeof TriggerEClassCreationAction.KIND;
}

export namespace TriggerEClassCreationAction {
    export const KIND = 'triggerEClassCreation';

    export function is(object: any): object is TriggerEClassCreationAction {
        return Action.hasKind(object, KIND);
    }

    export function create(): TriggerEClassCreationAction {
        return {
            kind: KIND
        };
    }
}

export interface TriggerEEnumCreationAction extends Action {
    kind: typeof TriggerEEnumCreationAction.KIND;
}

export namespace TriggerEEnumCreationAction {
    export const KIND = 'triggerEEnumCreation';

    export function is(object: any): object is TriggerEEnumCreationAction {
        return Action.hasKind(object, KIND);
    }

    export function create(): TriggerEEnumCreationAction {
        return {
            kind: KIND
        };
    }
}

export interface CreateEEnumAction extends Action {
    kind: typeof CreateEEnumAction.KIND;
    enumName: string;
    position?: { x: number; y: number };
    enumLiterals?: Array<{ name: string; value?: number }>;
}

export namespace CreateEEnumAction {
    export const KIND = 'createEEnum';

    export function is(object: any): object is CreateEEnumAction {
        return Action.hasKind(object, KIND) &&
            hasStringProp(object, 'enumName');
    }

    export function create(
        enumName: string,
        position?: { x: number; y: number },
        enumLiterals?: Array<{ name: string; value?: number }>
    ): CreateEEnumAction {
        return {
            kind: KIND,
            enumName,
            position,
            enumLiterals
        };
    }
}

export interface AddAttributeAction extends Action {
    kind: typeof AddAttributeAction.KIND;
    className: string;
    attributeName: string;
    attributeType: string;
    lowerBound: number;
    upperBound: number;
}

export namespace AddAttributeAction {
    export const KIND = 'addAttribute';

    export function is(object: any): object is AddAttributeAction {
        return Action.hasKind(object, KIND) &&
            hasStringProp(object, 'className') &&
            hasStringProp(object, 'attributeName') &&
            hasStringProp(object, 'attributeType');
    }

    export function create(
        className: string,
        attributeName: string,
        attributeType: string,
        lowerBound: number = 0,
        upperBound: number = 1
    ): AddAttributeAction {
        return {
            kind: KIND,
            className,
            attributeName,
            attributeType,
            lowerBound,
            upperBound
        };
    }
}

export interface DeleteAttributeAction extends Action {
    kind: typeof DeleteAttributeAction.KIND;
    className: string;
    attributeName: string;
}

export namespace DeleteAttributeAction {
    export const KIND = 'deleteAttribute';

    export function is(object: any): object is DeleteAttributeAction {
        return Action.hasKind(object, KIND) &&
            hasStringProp(object, 'className') &&
            hasStringProp(object, 'attributeName');
    }

    export function create(className: string, attributeName: string): DeleteAttributeAction {
        return {
            kind: KIND,
            className,
            attributeName
        };
    }
}

    
export interface SaveGraphicalModelAction extends Action {
    kind: typeof SaveGraphicalModelAction.KIND;
    filename: string;
    content: string;
}

export namespace SaveGraphicalModelAction {
    export const KIND = 'saveGraphicalModel';

    export function is(object: any): object is SaveGraphicalModelAction {
        return Action.hasKind(object, KIND);
    }

    export function create(filename: string, content: string): SaveGraphicalModelAction {
        return {
            kind: KIND,
            filename,
            content
        };
    }
}

export interface SaveShapeMappingsAction extends Action {
    kind: typeof SaveShapeMappingsAction.KIND;
    filename: string;
    content: string;
}

export namespace SaveShapeMappingsAction {
    export const KIND = 'saveShapeMappings';

    export function is(object: any): object is SaveShapeMappingsAction {
        return Action.hasKind(object, KIND);
    }

    export function create(filename: string, content: string): SaveShapeMappingsAction {
        return {
            kind: KIND,
            filename,
            content
        };
    }
}

export interface ApplyShapeMappingsAction extends Action {
    kind: typeof ApplyShapeMappingsAction.KIND;
    content: string;
}

export namespace ApplyShapeMappingsAction {
    export const KIND = 'applyShapeMappings';

    export function is(object: any): object is ApplyShapeMappingsAction {
        return Action.hasKind(object, KIND);
    }

    export function create(content: string): ApplyShapeMappingsAction {
        return {
            kind: KIND,
            content
        };
    }
}

export interface OpenClassPropertiesAction extends Action {
    kind: typeof OpenClassPropertiesAction.KIND;
}

export namespace OpenClassPropertiesAction {
    export const KIND = 'openClassProperties';
    export function create(): OpenClassPropertiesAction {
        return { kind: KIND };
    }
}

export interface ClassPropertiesResponse extends Action {
    kind: typeof ClassPropertiesResponse.KIND;
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

export namespace ClassPropertiesResponse {
    export const KIND = 'classPropertiesResponse';
    export function create(
        metamodel: ClassPropertiesResponse['metamodel'],
        classes: ClassPropertiesResponse['classes'],
        enums?: ClassPropertiesResponse['enums']
    ): ClassPropertiesResponse {
        return { kind: KIND, success: true, metamodel, classes, enums };
    }
}

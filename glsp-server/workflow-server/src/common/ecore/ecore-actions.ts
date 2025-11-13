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
export interface ClassInfo {
    className: string;
    isAbstract: boolean;
    isInterface: boolean;
    eSuperTypes?: string[]; // Array of supertype class names
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
}

export namespace LoadMetamodelResponse {
    export const KIND = 'loadMetamodelResponse';

    export function is(object: any): object is LoadMetamodelResponse {
        return Action.hasKind(object, KIND) && hasBooleanProp(object, 'success') && hasStringProp(object, 'metamodelKey');
    }

    export function create(success: boolean, metamodelKey: string, message?: string, classNames?: string[], classInfo?: ClassInfo[]): LoadMetamodelResponse {
        return {
            kind: KIND,
            success,
            metamodelKey,
            message,
            classNames,
            classInfo
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
    // Optional container info to immediately establish containment
    containerInstanceId?: string;
    containmentReferenceName?: string;
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
        containmentReferenceName?: string
    ): CreateInstanceAction {
        return {
            kind: KIND,
            eClassName,
            position,
            containerInstanceId,
            containmentReferenceName
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
    instances: Array<{ id: string; className: string; hidden?: boolean }>;
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
        instances: Array<{ id: string; className: string; hidden?: boolean }> = [],
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
 * Action to change the type of a class (abstract, concrete, interface, abstract-interface).
 */
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

/**
 * Action to create a custom metamodel with a new EPackage.
 */
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

/**
 * Action to create a new EClass in the custom metamodel.
 */
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

/**
 * Action to trigger EClass creation dialog on the client.
 */
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

/**
 * Action to add an attribute to an existing EClass.
 */
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

/**
 * Action to delete an attribute from an existing EClass.
 */
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

// Visual Configuration Actions
export interface OpenVisualConfigurationAction extends Action {
    kind: typeof OpenVisualConfigurationAction.KIND;
}

export namespace OpenVisualConfigurationAction {
    export const KIND = 'openVisualConfiguration';
    
    export function create(): OpenVisualConfigurationAction {
        return {
            kind: KIND
        };
    }
}

export interface SetClassVisualConfigurationAction extends Action {
    kind: typeof SetClassVisualConfigurationAction.KIND;
    className: string;
    shape: string;
    color: string;
    border?: {
        style: 'solid' | 'dashed' | 'dotted';
    };
    filled?: boolean;
    showAttributes: boolean;
    showReferences: boolean;
}

export namespace SetClassVisualConfigurationAction {
    export const KIND = 'setClassVisualConfiguration';
    
    export function create(className: string, shape: string, color: string, showAttributes: boolean, showReferences: boolean, border?: { style: 'solid' | 'dashed' | 'dotted' }, filled?: boolean): SetClassVisualConfigurationAction {
        return {
            kind: KIND,
            className,
            shape,
            color,
            border,
            filled,
            showAttributes,
            showReferences
        };
    }
}

export interface LoadVisualConfigurationAction extends Action {
    kind: typeof LoadVisualConfigurationAction.KIND;
    filename?: string;
    content?: string;
}

export namespace LoadVisualConfigurationAction {
    export const KIND = 'loadVisualConfiguration';

    export function is(object: any): object is LoadVisualConfigurationAction {
        return Action.hasKind(object, KIND);
    }

    export function create(filename?: string, content?: string): LoadVisualConfigurationAction {
        return {
            kind: KIND,
            filename,
            content
        };
    }
}

export interface DeleteVisualConfigurationAction extends Action {
    kind: typeof DeleteVisualConfigurationAction.KIND;
    filename: string;
}

export namespace DeleteVisualConfigurationAction {
    export const KIND = 'deleteVisualConfiguration';

    export function is(object: any): object is DeleteVisualConfigurationAction {
        return Action.hasKind(object, KIND) && typeof (object as any).filename === 'string';
    }

    export function create(filename: string): DeleteVisualConfigurationAction {
        return {
            kind: KIND,
            filename
        };
    }
}

export interface SaveVisualConfigurationAction extends Action {
    kind: typeof SaveVisualConfigurationAction.KIND;
    filename?: string;
}

export namespace SaveVisualConfigurationAction {
    export const KIND = 'saveVisualConfiguration';

    export function is(object: any): object is SaveVisualConfigurationAction {
        return Action.hasKind(object, KIND);
    }

    export function create(filename?: string): SaveVisualConfigurationAction {
        return {
            kind: KIND,
            filename
        };
    }
}

export interface GetVisualConfigurationAction extends Action {
    kind: typeof GetVisualConfigurationAction.KIND;
}

export namespace GetVisualConfigurationAction {
    export const KIND = 'getVisualConfiguration';
    
    export function create(): GetVisualConfigurationAction {
        return {
            kind: KIND
        };
    }
}

export interface VisualConfigurationResponse extends Action {
    kind: typeof VisualConfigurationResponse.KIND;
    success: boolean;
    configurations: Array<{
        className: string;
        shape: string;
        color: string;
        filled?: boolean;
        showAttributes: boolean;
        showReferences: boolean;
    }>;
    availableShapes: string[];
    availableColors: string[];
}

export namespace VisualConfigurationResponse {
    export const KIND = 'visualConfigurationResponse';
    
    export function create(
        success: boolean,
        configurations: Array<{
            className: string;
            shape: string;
            color: string;
            showAttributes: boolean;
            showReferences: boolean;
        }>,
        availableShapes: string[],
        availableColors: string[]
    ): VisualConfigurationResponse {
        return {
            kind: KIND,
            success,
            configurations,
            availableShapes,
            availableColors
        };
    }
}

// Class Properties Panel Actions ------------------------------------------

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
    }>;
}

export namespace ClassPropertiesResponse {
    export const KIND = 'classPropertiesResponse';
    export function create(
        metamodel: ClassPropertiesResponse['metamodel'],
        classes: ClassPropertiesResponse['classes']
    ): ClassPropertiesResponse {
        return { kind: KIND, success: true, metamodel, classes };
    }
}
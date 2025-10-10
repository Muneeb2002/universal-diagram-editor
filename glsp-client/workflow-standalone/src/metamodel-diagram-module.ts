/********************************************************************************
 * Copyright (c) 2019-2024 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * SPDX-License-Identifier: EPL-2.0
 ********************************************************************************/

import {
    configureActionHandler,
    configureDefaultModelElements,
    configureModelElement,
    ContainerConfiguration,
    debugModule,
    DEFAULT_ALIGNABLE_ELEMENT_FILTER,
    DefaultTypes,
    editLabelFeature,
    FeatureModule,
    GCompartment,
    GEdge,
    GEdgeView,
    GGraph,
    GLabel,
    GLabelView,
    GLSPProjectionView,
    GNode,
    gridModule,
    helperLineModule,
    initializeDiagramContainer,
    overrideModelElement,
    TYPES
} from '@eclipse-glsp/client';
import { Container } from 'inversify';
import { EcoreClassNodeView, EcoreDataTypeNodeView, EcoreEnumNodeView, EcoreInstanceNodeView, EcoreCompartmentView } from './ecore-views';
import { EcoreEdgeView } from './ecore-edge-views';
import { MultiplicityInputActionHandler } from './multiplicity-input-action-handler';
import { MultiplicityInputAction } from './ecore-client-actions';

// Define Ecore-specific model elements
export class EcoreClassNode extends GNode {
    static readonly TYPE = 'ecore:class';
}

export class EcoreDataTypeNode extends GNode {
    static readonly TYPE = 'ecore:datatype';
}

export class EcoreEnumNode extends GNode {
    static readonly TYPE = 'ecore:enum';
}

export class EcoreReferenceEdge extends GEdge {
    static readonly TYPE = 'edge:ecore-reference';
}

export class EcoreInheritanceEdge extends GEdge {
    static readonly TYPE = 'edge:ecore-inheritance';
}

export class EcoreContainmentEdge extends GEdge {
    static readonly TYPE = 'edge:ecore-containment';
}

export class EcoreBidirectionalEdge extends GEdge {
    static readonly TYPE = 'edge:ecore-bidirectional';
}

// Define instance model elements
export class EcoreInstanceNode extends GNode {
    static readonly TYPE = 'ecore:instance';
}

export class EcoreInstanceEdge extends GEdge {
    static readonly TYPE = 'edge:inst-reference';
}

export const metamodelDiagramModule = new FeatureModule(
    (bind, unbind, isBound, rebind) => {
        const context = { bind, unbind, isBound, rebind };
        configureDefaultModelElements(context);

        // Configure Ecore metamodel elements with custom views
        configureModelElement(context, 'ecore:class', EcoreClassNode, EcoreClassNodeView);
        configureModelElement(context, 'ecore:datatype', EcoreDataTypeNode, EcoreDataTypeNodeView);
        configureModelElement(context, 'ecore:enum', EcoreEnumNode, EcoreEnumNodeView);

        // Configure edges with custom arrow markers
        configureModelElement(context, 'edge:ecore-reference', EcoreReferenceEdge, EcoreEdgeView);
        configureModelElement(context, 'edge:ecore-inheritance', EcoreInheritanceEdge, EcoreEdgeView);
        configureModelElement(context, 'edge:ecore-containment', EcoreContainmentEdge, EcoreEdgeView);
        configureModelElement(context, 'edge:ecore-bidirectional', EcoreBidirectionalEdge, EcoreEdgeView);

        // Configure Ecore instance elements with custom views
        configureModelElement(context, 'ecore:instance', EcoreInstanceNode, EcoreInstanceNodeView);
        configureModelElement(context, 'edge:inst-reference', EcoreInstanceEdge, EcoreEdgeView);

        // Configure generic elements
        configureModelElement(context, 'edge', GEdge, EcoreEdgeView);
        configureModelElement(context, 'graph', GGraph, GLSPProjectionView);

        // Configure labels and compartments
        configureModelElement(context, 'label:heading', GLabel, GLabelView, { enable: [editLabelFeature] });
        configureModelElement(context, 'label:text', GLabel, GLabelView, { enable: [editLabelFeature] });
        configureModelElement(context, 'comp:header', GCompartment, EcoreCompartmentView);
        configureModelElement(context, 'comp:attributes', GCompartment, EcoreCompartmentView);
        configureModelElement(context, 'comp:references', GCompartment, EcoreCompartmentView);

        // Override default elements
        overrideModelElement(context, DefaultTypes.EDGE, GEdge, GEdgeView);
        overrideModelElement(context, DefaultTypes.GRAPH, GGraph, GLSPProjectionView);

        bind(TYPES.IHelperLineOptions).toDynamicValue(ctx => {
            const options: any = {};
            options.alignmentElementFilter = (element: any) =>
                DEFAULT_ALIGNABLE_ELEMENT_FILTER(element) &&
                !(element instanceof GCompartment);
            return options;
        });

        // Bind no-op context menu service to resolve warning
        bind(TYPES.IContextMenuService).toConstantValue({
            show: () => { }
        });

        // Configure multiplicity input action handler
        configureActionHandler(context, MultiplicityInputAction.KIND, MultiplicityInputActionHandler);
    },
    { featureId: Symbol('metamodelDiagram') }
);

export function createMetamodelDiagramContainer(...containerConfiguration: ContainerConfiguration): Container {
    return initializeDiagramContainer(
        new Container(),
        metamodelDiagramModule,
        helperLineModule,
        gridModule,
        debugModule,
        ...containerConfiguration
    );
}

export function initializeMetamodelDiagramContainer(
    container: Container,
    ...containerConfiguration: ContainerConfiguration
): Container {
    return initializeDiagramContainer(
        container,
        metamodelDiagramModule,
        helperLineModule,
        gridModule,
        debugModule,
        ...containerConfiguration
    );
}

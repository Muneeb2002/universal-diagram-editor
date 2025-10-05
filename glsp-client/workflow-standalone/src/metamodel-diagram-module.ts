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
    configureDefaultModelElements,
    configureModelElement,
    overrideModelElement,
    FeatureModule,
    GNode,
    GEdge,
    GLabel,
    GCompartment,
    GGraph,
    RoundedCornerNodeView,
    GLabelView,
    GCompartmentView,
    GLSPProjectionView,
    GEdgeView,
    DefaultTypes,
    TYPES,
    DEFAULT_ALIGNABLE_ELEMENT_FILTER,
    helperLineModule,
    gridModule,
    debugModule,
    initializeDiagramContainer,
    ContainerConfiguration,
    editLabelFeature
} from '@eclipse-glsp/client';
import { Container } from 'inversify';

// Define Ecore-specific model elements
export class EcoreClassNode extends GNode {
    static readonly TYPE = 'ecore:class';
}

export class EcoreReferenceEdge extends GEdge {
    static readonly TYPE = 'edge:ecore-reference';
}

// Define instance model elements
export class EcoreInstanceNode extends GNode {
    // Type is dynamic: inst:ClassName
}

export class EcoreInstanceEdge extends GEdge {
    static readonly TYPE = 'edge:inst-reference';
}

export const metamodelDiagramModule = new FeatureModule(
    (bind, unbind, isBound, rebind) => {
        const context = { bind, unbind, isBound, rebind };
        configureDefaultModelElements(context);

        // Configure Ecore metamodel elements
        configureModelElement(context, 'ecore:class', EcoreClassNode, RoundedCornerNodeView);
        configureModelElement(context, 'edge:ecore-reference', EcoreReferenceEdge, GEdgeView);

        // Configure Ecore instance elements
        configureModelElement(context, 'ecore:instance', EcoreInstanceNode, RoundedCornerNodeView);
        configureModelElement(context, 'edge:inst-reference', EcoreInstanceEdge, GEdgeView);

        // Configure generic elements
        configureModelElement(context, 'edge', GEdge, GEdgeView);
        configureModelElement(context, 'graph', GGraph, GLSPProjectionView);

        // Configure labels and compartments
        configureModelElement(context, 'label:heading', GLabel, GLabelView, { enable: [editLabelFeature] });
        configureModelElement(context, 'label:text', GLabel, GLabelView, { enable: [editLabelFeature] });
        configureModelElement(context, 'comp:header', GCompartment, GCompartmentView);
        configureModelElement(context, 'comp:attributes', GCompartment, GCompartmentView);
        configureModelElement(context, 'comp:references', GCompartment, GCompartmentView);

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

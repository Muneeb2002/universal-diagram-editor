/**
 * @author Abigail Sotomayor <s205720@dtu.dk>
 */
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
import { MultiplicityInputActionHandler } from './handlers/multiplicity-input-action-handler';
import { BidirectionalMultiplicityInputActionHandler } from './handlers/bidirectional-multiplicity-input-action-handler';
import { LoadMetamodelResponseHandler } from './handlers/load-metamodel-response-handler';
import { InstancesOverviewResponseHandler } from './handlers/instances-overview-response-handler';
import { MultiplicityInputAction, BidirectionalMultiplicityInputAction } from './ecore-client-actions';
import { ClassPropertiesResponseHandler } from './handlers/class-properties-response-handler';

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

export class EcoreInstanceNode extends GNode {
    static readonly TYPE = 'ecore:instance';
}

export class EcoreInstanceEdge extends GEdge {
    static readonly TYPE = 'edge:instance';
}

export const metamodelDiagramModule = new FeatureModule(
    (bind, unbind, isBound, rebind) => {
        const context = { bind, unbind, isBound, rebind };
        configureDefaultModelElements(context);

        configureModelElement(context, 'ecore:class', EcoreClassNode, EcoreClassNodeView);
        configureModelElement(context, 'ecore:datatype', EcoreDataTypeNode, EcoreDataTypeNodeView);
        configureModelElement(context, 'ecore:enum', EcoreEnumNode, EcoreEnumNodeView);

        configureModelElement(context, 'edge:ecore-reference', EcoreReferenceEdge, EcoreEdgeView);
        configureModelElement(context, 'edge:ecore-inheritance', EcoreInheritanceEdge, EcoreEdgeView);
        configureModelElement(context, 'edge:ecore-containment', EcoreContainmentEdge, EcoreEdgeView);
        configureModelElement(context, 'edge:ecore-bidirectional', EcoreBidirectionalEdge, EcoreEdgeView);

        configureModelElement(context, 'ecore:instance', EcoreInstanceNode, EcoreInstanceNodeView);
        configureModelElement(context, 'edge:instance', EcoreInstanceEdge, EcoreEdgeView);

        configureModelElement(context, 'edge', GEdge, EcoreEdgeView);
        configureModelElement(context, 'graph', GGraph, GLSPProjectionView);

        configureModelElement(context, 'label:heading', GLabel, GLabelView, { enable: [editLabelFeature] });
        configureModelElement(context, 'label:text', GLabel, GLabelView, { enable: [editLabelFeature] });
        configureModelElement(context, 'comp:header', GCompartment, EcoreCompartmentView);
        configureModelElement(context, 'comp:attributes', GCompartment, EcoreCompartmentView);
        configureModelElement(context, 'comp:references', GCompartment, EcoreCompartmentView);

        overrideModelElement(context, DefaultTypes.EDGE, GEdge, GEdgeView);
        overrideModelElement(context, DefaultTypes.GRAPH, GGraph, GLSPProjectionView);

        bind(TYPES.IHelperLineOptions).toDynamicValue(ctx => {
            const options: any = {};
            options.alignmentElementFilter = (element: any) =>
                DEFAULT_ALIGNABLE_ELEMENT_FILTER(element) &&
                !(element instanceof GCompartment);
            return options;
        });

        bind(TYPES.IContextMenuService).toConstantValue({
            show: () => { }
        });

        configureActionHandler(context, MultiplicityInputAction.KIND, MultiplicityInputActionHandler);
        configureActionHandler(context, BidirectionalMultiplicityInputAction.KIND, BidirectionalMultiplicityInputActionHandler);

        configureActionHandler(context, 'loadMetamodelResponse', LoadMetamodelResponseHandler);

        configureActionHandler(context, 'classPropertiesResponse', ClassPropertiesResponseHandler);
        configureActionHandler(context, 'instancesOverviewResponse', InstancesOverviewResponseHandler);
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

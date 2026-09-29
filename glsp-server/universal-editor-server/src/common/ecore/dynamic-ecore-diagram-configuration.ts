/**
 * @author Abigail Sotomayor <s205720@dtu.dk>
 */

import { injectable } from 'inversify';
import {
    DiagramConfiguration,
    GNode,
    GEdge,
    GCompartment,
    GLabel,
    GModelRoot,
    getDefaultMapping,
    ServerLayoutKind,
    ShapeTypeHint,
    EdgeTypeHint
} from '@eclipse-glsp/server';

@injectable()
export class DynamicEcoreDiagramConfiguration implements DiagramConfiguration {

    get typeMapping(): Map<string, any> {
        const mapping = getDefaultMapping();
        this.addEcoreTypeMappings(mapping);

        return mapping;
    }

    private addEcoreTypeMappings(mapping: Map<string, any>): void {
        mapping.set('graph', GModelRoot);
        mapping.set('comp:header', GCompartment);
        mapping.set('comp:attributes', GCompartment);
        mapping.set('comp:references', GCompartment);
        mapping.set('label:heading', GLabel);
        mapping.set('label:text', GLabel);
        mapping.set('ecore:instance', GNode);
        mapping.set('edge:ecore-reference', GEdge);
        mapping.set('edge:ecore-bidirectional', GEdge);
        mapping.set('edge:instance', GEdge);

    }

    get shapeTypeHints(): ShapeTypeHint[] {
        return this.getEcoreShapeTypeHints();
    }

    private getEcoreShapeTypeHints(): ShapeTypeHint[] {
        return [
            {
                elementTypeId: 'ecore:class',
                repositionable: true,
                deletable: true,
                resizable: true,
                reparentable: false,
                containableElementTypeIds: []
            },
            {
                elementTypeId: 'ecore:enum',
                repositionable: true,
                deletable: true,
                resizable: true,
                reparentable: false,
                containableElementTypeIds: []
            },
            {
                elementTypeId: 'ecore:datatype',
                repositionable: true,
                deletable: true,
                resizable: true,
                reparentable: false,
                containableElementTypeIds: []
            },
            {
                elementTypeId: 'ecore:instance',
                repositionable: true,
                deletable: true,
                resizable: true,
                reparentable: false,
                containableElementTypeIds: []
            }
        ];
    }

    get edgeTypeHints(): EdgeTypeHint[] {
        return this.getEcoreEdgeTypeHints();
    }

    private getEcoreEdgeTypeHints(): EdgeTypeHint[] {
        return [
            {
                elementTypeId: 'edge:ecore-reference',
                dynamic: true,
                sourceElementTypeIds: ['ecore:class'],
                targetElementTypeIds: ['ecore:class'],
                repositionable: true,
                deletable: true,
                routable: true
            },
            {
                elementTypeId: 'edge:ecore-containment',
                dynamic: true,
                sourceElementTypeIds: ['ecore:class'],
                targetElementTypeIds: ['ecore:class'],
                repositionable: true,
                deletable: true,
                routable: true
            },
            {
                elementTypeId: 'edge:ecore-inheritance',
                dynamic: true,
                sourceElementTypeIds: ['ecore:class'],
                targetElementTypeIds: ['ecore:class'],
                repositionable: true,
                deletable: true,
                routable: true
            },
            {
                elementTypeId: 'edge:ecore-bidirectional',
                dynamic: true,
                sourceElementTypeIds: ['ecore:class'],
                targetElementTypeIds: ['ecore:class'],
                repositionable: true,
                deletable: true,
                routable: true
            },
            {
                elementTypeId: 'edge:instance',
                dynamic: true,
                sourceElementTypeIds: [],
                targetElementTypeIds: [],
                repositionable: true,
                deletable: true,
                routable: true
            }
        ];
    }

    layoutKind = ServerLayoutKind.MANUAL;
    needsClientLayout = true;
    animatedUpdate = true;
}

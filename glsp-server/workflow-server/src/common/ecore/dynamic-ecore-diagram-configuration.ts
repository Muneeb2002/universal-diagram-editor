/********************************************************************************
 * Copyright (c) 2024 Eclipse GLSP and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * SPDX-License-Identifier: EPL-2.0
 ********************************************************************************/

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
        // Add Ecore type mappings
        this.addEcoreTypeMappings(mapping);

        return mapping;
    }

    private addEcoreTypeMappings(mapping: Map<string, any>): void {
        // Add static Ecore type mappings - dynamic ones will be added by the GModel factory

        // Add mappings for Ecore elements
        mapping.set('graph', GModelRoot);
        mapping.set('comp:header', GCompartment);
        mapping.set('comp:attributes', GCompartment);
        mapping.set('comp:references', GCompartment);
        mapping.set('label:heading', GLabel);
        mapping.set('label:text', GLabel);
        mapping.set('ecore:instance', GNode); // Add mapping for instance nodes (including nested nodes)
        mapping.set('edge:ecore-reference', GEdge);
        mapping.set('edge:ecore-bidirectional', GEdge);
        mapping.set('edge:instance', GEdge);

        // Add dynamic instance type patterns - these will match any inst:* type
        // Note: Actual types are created dynamically based on metamodel
    }

    get shapeTypeHints(): ShapeTypeHint[] {
        // Return Ecore shape type hints
        return this.getEcoreShapeTypeHints();
    }

    private getEcoreShapeTypeHints(): ShapeTypeHint[] {
        // Return static Ecore shape type hints
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
            }
        ];
    }

    get edgeTypeHints(): EdgeTypeHint[] {
        // Return Ecore edge type hints
        return this.getEcoreEdgeTypeHints();
    }

    private getEcoreEdgeTypeHints(): EdgeTypeHint[] {
        // Return static Ecore edge type hints
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
                sourceElementTypeIds: [], // Will be filled dynamically with inst:* types
                targetElementTypeIds: [], // Will be filled dynamically with inst:* types
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

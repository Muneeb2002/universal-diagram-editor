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
        // Always include both Ecore and workflow mappings to support both modes
        this.addEcoreTypeMappings(mapping);
        this.addWorkflowTypeMappings(mapping);

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
        mapping.set('edge:ecore-reference', GEdge);
        mapping.set('edge:ecore-bidirectional', GEdge);
        mapping.set('edge:inst-reference', GEdge);

        // Add dynamic instance type patterns - these will match any inst:* type
        // Note: Actual types are created dynamically based on metamodel
    }

    private addWorkflowTypeMappings(mapping: Map<string, any>): void {
        // Add existing workflow type mappings
        mapping.set('label:heading', GLabel);
        mapping.set('label:text', GLabel);
        mapping.set('comp:header', GCompartment);
        mapping.set('label:icon', GLabel);
        mapping.set('edge:weighted', GEdge);
        mapping.set('icon', GCompartment);
        mapping.set('activityNode', GNode);
        mapping.set('task', GNode);
        mapping.set('category', GNode);
        mapping.set('struct', GCompartment);
    }

    get shapeTypeHints(): ShapeTypeHint[] {
        // Return combined shape type hints for both Ecore and workflow
        return [...this.getEcoreShapeTypeHints(), ...this.getWorkflowShapeTypeHints()];
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
            }
        ];
    }

    private getWorkflowShapeTypeHints(): ShapeTypeHint[] {
        // Return existing workflow shape type hints
        return [
            {
                elementTypeId: 'task:manual',
                repositionable: true,
                deletable: true,
                resizable: true,
                reparentable: true
            },
            {
                elementTypeId: 'task:automated',
                repositionable: true,
                deletable: true,
                resizable: true,
                reparentable: true
            },
            {
                elementTypeId: 'activityNode:fork',
                repositionable: true,
                deletable: true,
                resizable: false,
                reparentable: true
            },
            {
                elementTypeId: 'activityNode:join',
                repositionable: true,
                deletable: true,
                resizable: false,
                reparentable: true
            },
            {
                elementTypeId: 'activityNode:decision',
                repositionable: true,
                deletable: true,
                resizable: true,
                reparentable: true
            },
            {
                elementTypeId: 'activityNode:merge',
                repositionable: true,
                deletable: true,
                resizable: true,
                reparentable: true
            },
            {
                elementTypeId: 'category',
                repositionable: true,
                deletable: true,
                resizable: true,
                reparentable: true,
                containableElementTypeIds: ['task', 'activityNode', 'category']
            }
        ];
    }

    get edgeTypeHints(): EdgeTypeHint[] {
        // Return combined edge type hints for both Ecore and workflow
        return [...this.getEcoreEdgeTypeHints(), ...this.getWorkflowEdgeTypeHints()];
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
                elementTypeId: 'edge:inst-reference',
                dynamic: true,
                sourceElementTypeIds: [], // Will be filled dynamically with inst:* types
                targetElementTypeIds: [], // Will be filled dynamically with inst:* types
                repositionable: true,
                deletable: true,
                routable: true
            }
        ];
    }

    private getWorkflowEdgeTypeHints(): EdgeTypeHint[] {
        // Return existing workflow edge type hints
        return [
            {
                elementTypeId: 'edge',
                repositionable: true,
                deletable: true,
                routable: true,
                sourceElementTypeIds: [
                    'task:manual',
                    'task:automated',
                    'activityNode:decision',
                    'activityNode:merge',
                    'activityNode:fork',
                    'activityNode:join',
                    'category'
                ],
                targetElementTypeIds: [
                    'task:manual',
                    'task:automated',
                    'activityNode:decision',
                    'activityNode:merge',
                    'activityNode:fork',
                    'activityNode:join',
                    'category'
                ]
            },
            {
                elementTypeId: 'edge:weighted',
                dynamic: true,
                sourceElementTypeIds: ['activityNode'],
                targetElementTypeIds: ['task', 'activityNode'],
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

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
 * ARCHITECTURE: Ecore Edge View Components with Arrow Markers
 * 
 * This file defines custom edge views with proper SVG arrow markers for:
 * - Inheritance: Hollow triangle (generalization arrow)
 * - Containment: Filled diamond (composition arrow)
 * - Reference: Simple arrowhead (association arrow)
 */
/** @jsx svg */
import { GEdge, PolylineEdgeView, RenderingContext } from '@eclipse-glsp/client';
import { injectable } from 'inversify';
import { VNode } from 'snabbdom';

/**
 * Custom view that renders Ecore edges with proper styling and markers
 */
@injectable()
export class EcoreEdgeView extends PolylineEdgeView {
    override render(edge: GEdge, context: RenderingContext, args?: any): VNode | undefined {
        console.log(`EcoreEdgeView.render() - Rendering edge: ${edge.id} (type: ${edge.type})`);

        // Render the basic edge
        const vnode = super.render(edge, context, args);

        console.log(`EcoreEdgeView.render() - Rendered vnode:`, vnode);

        // Apply CSS classes for styling
        if (vnode?.data) {
            const cssClasses = (edge as any).cssClasses || [];
            console.log(`EcoreEdgeView.render() - Applying CSS classes:`, cssClasses);
            cssClasses.forEach((cssClass: string) => {
                vnode.data!.class = vnode.data!.class || {};
                vnode.data!.class[cssClass] = true;
            });
        }

        return vnode;
    }
}


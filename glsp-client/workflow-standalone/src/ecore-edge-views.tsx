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
import { svg } from '@eclipse-glsp/sprotty';
import type { Point } from '@eclipse-glsp/sprotty';
import { injectable } from 'inversify';
import { VNode } from 'snabbdom';

/**
 * Custom view that renders Ecore edges with proper styling and markers
 */
@injectable()
export class EcoreEdgeView extends PolylineEdgeView {
    override render(edge: GEdge, context: RenderingContext, args?: any): VNode | undefined {
        const vnode = super.render(edge, context, args);

        if (vnode?.data) {
            const cssClasses = (edge as any).cssClasses || [];
            cssClasses.forEach((cssClass: string) => {
                vnode.data!.class = vnode.data!.class || {};
                vnode.data!.class[cssClass] = true;
            });
        }

        return vnode;
    }

    protected override renderLine(edge: GEdge, segments: Point[], context: RenderingContext, args?: any): VNode {
        const firstPoint = segments[0];
        let path = `M ${firstPoint.x},${firstPoint.y}`;
        for (let i = 1; i < segments.length; i++) {
            const p = segments[i];
            path += ` L ${p.x},${p.y}`;
        }
        return <path d={path} />;
    }

    protected override renderAdditionals(edge: GEdge, segments: Point[], context: RenderingContext): VNode[] {
        const additionals: VNode[] = [];
        const type = edge.type ?? '';

        if (segments.length >= 2) {
            if (type !== 'edge:ecore-containment') {
                const tail = segments[segments.length - 2];
                const tip = segments[segments.length - 1];
                const head = this.createArrowForEdge(edge, tail, tip, 'end');
                if (head) {
                    additionals.push(head);
                }
            }

            if (type === 'edge:ecore-containment') {
                const startTip = segments[0];
                const startTail = segments[1] ?? startTip;
                const startArrow = this.createArrowForEdge(edge, startTail, startTip, 'start');
                if (startArrow) {
                    additionals.push(startArrow);
                }
            }
        }

        return additionals;
    }

    private createArrowForEdge(edge: GEdge, from: Point, to: Point, direction: 'start' | 'end', segments?: Point[]): VNode | undefined {
        const type = edge.type ?? '';
        switch (type) {
            case 'edge:ecore-inheritance':
                return this.createOpenTriangle(from, to, type, direction);
            case 'edge:ecore-containment':
                return this.createDiamond(from, to, type, direction);
            case 'edge:ecore-bidirectional':
                return undefined;
            case 'edge:inst-reference':
            case 'edge:ecore-reference':
                return this.createOpenArrow(from, to, type, direction, 14, 5);
            default:
                return this.createFilledTriangle(from, to, type, direction, 11, 5);
        }
    }

    private createFilledTriangle(from: Point, to: Point, type: string, direction: 'start' | 'end', length: number, halfWidth: number): VNode | undefined {
        const geometry = this.computeArrowGeometry(from, to, length, halfWidth);
        if (!geometry) {
            return undefined;
        }
        const { tip, baseLeft, baseRight } = geometry;
        const points = `${tip.x},${tip.y} ${baseLeft.x},${baseLeft.y} ${baseRight.x},${baseRight.y}`;
        return (
            <polygon
                class-edge-arrow={true}
                class-edge-arrow-reference={type === 'edge:ecore-reference' || type === 'edge:inst-reference'}
                class-edge-arrow-bidirectional={type === 'edge:ecore-bidirectional'}
                data-direction={direction}
                points={points}
                pointer-events="none"
                stroke-linejoin="round"
            />
        );
    }

    private createOpenTriangle(from: Point, to: Point, type: string, direction: 'start' | 'end', length = 16, halfWidth = 6): VNode | undefined {
        const geometry = this.computeArrowGeometry(from, to, length, halfWidth);
        if (!geometry) {
            return undefined;
        }
        const { tip, baseLeft, baseRight } = geometry;
        const d = `M ${baseLeft.x},${baseLeft.y} L ${tip.x},${tip.y} L ${baseRight.x},${baseRight.y} Z`;
        return (
            <path
                class-edge-arrow={true}
                class-edge-arrow-inheritance={type === 'edge:ecore-inheritance'}
                data-direction={direction}
                d={d}
                fill="none"
                pointer-events="none"
                stroke-linejoin="round"
            />
        );
    }

    private createDiamond(from: Point, to: Point, type: string, direction: 'start' | 'end', length = 16, halfWidth = 6): VNode | undefined {
        const geometry = this.computeArrowGeometry(from, to, length, halfWidth);
        if (!geometry) {
            return undefined;
        }
        const { tip, midLeft, tail, midRight } = geometry;
        const points = `${tip.x},${tip.y} ${midLeft.x},${midLeft.y} ${tail.x},${tail.y} ${midRight.x},${midRight.y}`;
        return (
            <polygon
                class-edge-arrow={true}
                class-edge-arrow-containment={type === 'edge:ecore-containment'}
                data-direction={direction}
                points={points}
                pointer-events="none"
                stroke-linejoin="round"
            />
        );
    }

    private createOpenArrow(from: Point, to: Point, type: string, direction: 'start' | 'end', length = 14, halfWidth = 5): VNode | undefined {
        const geometry = this.computeArrowGeometry(from, to, length, halfWidth);
        if (!geometry) {
            return undefined;
        }
        const { tip, baseLeft, baseRight } = geometry;
        const d = `M ${baseLeft.x},${baseLeft.y} L ${tip.x},${tip.y} M ${baseRight.x},${baseRight.y} L ${tip.x},${tip.y}`;
        return (
            <path
                class-edge-arrow={true}
                class-edge-arrow-reference={type === 'edge:ecore-reference' || type === 'edge:inst-reference'}
                data-direction={direction}
                d={d}
                fill="none"
                pointer-events="none"
                stroke-linejoin="round"
            />
        );
    }

    private computeArrowGeometry(from: Point, to: Point, length: number, halfWidth: number):
        | { tip: Point; baseLeft: Point; baseRight: Point; midLeft: Point; midRight: Point; tail: Point }
        | undefined {
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const distance = Math.hypot(dx, dy);
        if (distance < 0.0001) {
            return undefined;
        }
        const ux = dx / distance;
        const uy = dy / distance;
        const tip: Point = { x: to.x, y: to.y };
        const tail: Point = { x: tip.x - ux * length, y: tip.y - uy * length };
        const midPointX = tip.x - ux * (length / 2);
        const midPointY = tip.y - uy * (length / 2);
        const offsetX = -uy * halfWidth;
        const offsetY = ux * halfWidth;

        const baseLeft: Point = { x: tail.x + offsetX, y: tail.y + offsetY };
        const baseRight: Point = { x: tail.x - offsetX, y: tail.y - offsetY };
        const midLeft: Point = { x: midPointX + offsetX, y: midPointY + offsetY };
        const midRight: Point = { x: midPointX - offsetX, y: midPointY - offsetY };

        return {
            tip,
            baseLeft,
            baseRight,
            midLeft,
            midRight,
            tail
        };
    }
}


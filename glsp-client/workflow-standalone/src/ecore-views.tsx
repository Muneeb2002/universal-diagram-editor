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
 * ARCHITECTURE: Ecore View Components
 * 
 * This file defines custom view components for rendering Ecore metamodel entities.
 * 
 * SEPARATION OF CONCERNS:
 * - View components (this file): Define SVG structure, assign CSS classes
 * - CSS file (ecore-styles.css): Define all visual styling (colors, borders, etc.)
 * 
 * PRINCIPLE: Views should NOT contain inline styles (fill, stroke, etc.)
 * Instead, they assign appropriate CSS classes and let CSS handle the styling.
 * 
 * This approach:
 * - Makes styling easy to change without touching TypeScript code
 * - Follows standard web development best practices
 * - Keeps view logic clean and focused on structure
 */
/** @jsx svg */
import { injectable } from 'inversify';
import { VNode } from 'snabbdom';
import {
    GNode,
    GCompartment,
    Hoverable,
    Selectable,
    RenderingContext,
    RectangularNodeView,
    ShapeView,
    svg,
    setAttr,
    setClass,
    Dimension
} from '@eclipse-glsp/sprotty';

/**
 * Custom view for Ecore classes - renders as a rectangle with rounded corners
 * Differentiates between regular classes, abstract classes, and interfaces
 * All visual styling is handled via CSS classes in ecore-styles.css
 */
@injectable()
export class EcoreClassNodeView extends RectangularNodeView {
    override render(node: Readonly<GNode & Hoverable & Selectable>, context: RenderingContext): VNode | undefined {
        if (!this.isVisible(node, context)) {
            return undefined;
        }

        // Check CSS classes to determine class type
        const cssClasses = (node as any).cssClasses || [];
        const isAbstract = cssClasses.includes('abstract');
        const isInterface = cssClasses.includes('interface');

        // Calculate compartment separator line positions
        const nodeWidth = Math.max(0, node.size.width);
        const nodeHeight = Math.max(0, node.size.height);
        
        // Find compartment children to determine separator positions
        const compartments = node.children?.filter(child => child.type?.startsWith('comp:')) || [];
        let separatorLines: VNode[] = [];
        
        if (compartments.length > 1) {
            // Calculate positions for separator lines
            let currentY = 0;
            for (let i = 0; i < compartments.length - 1; i++) {
                const compartment = compartments[i];
                const compartmentHeight = (compartment as any).size?.height || 30; // Default height if not specified
                currentY += compartmentHeight;
                
                separatorLines.push(
                    <line
                        class-compartment-separator={true}
                        x1="0"
                        y1={currentY}
                        x2={nodeWidth}
                        y2={currentY}
                    />
                );
            }
        }

        const vnode = (
            <g class-node={true} class-ecore-class={true} class-abstract={isAbstract} class-interface={isInterface}>
                <rect
                    class-sprotty-node={true}
                    class-selected={node.selected}
                    class-mouseover={node.hoverFeedback}
                    x="0"
                    y="0"
                    width={nodeWidth}
                    height={nodeHeight}
                    rx="5"
                    ry="5"
                />
                {context.renderChildren(node)}
                {/* Compartment separator lines */}
                {separatorLines}
                {/* Edit button in top-right corner */}
                <g class-edit-button={true} class-edit-button-visible={node.hoverFeedback || node.selected}>
                    <rect
                        x={nodeWidth - 20}
                        y="2"
                        width="16"
                        height="16"
                        rx="2"
                        ry="2"
                        class-edit-button-bg={true}
                    />
                    <text
                        x={nodeWidth - 12}
                        y="12"
                        class-edit-button-icon={true}
                        text-anchor="middle"
                        dominant-baseline="middle"
                    >
                        ✎
                    </text>
                </g>
            </g>
        );

        setAttr(vnode, 'data-svg-metadata-type', node.type);
        setClass(vnode, 'ecore-class', true);
        if (isAbstract) {
            setClass(vnode, 'abstract', true);
        }
        if (isInterface) {
            setClass(vnode, 'interface', true);
        }
        return vnode;
    }
}

/**
 * Custom view for Ecore data types - renders as a rectangle with different styling
 * All visual styling is handled via CSS classes in ecore-styles.css
 */
@injectable()
export class EcoreDataTypeNodeView extends RectangularNodeView {
    override render(node: Readonly<GNode & Hoverable & Selectable>, context: RenderingContext): VNode | undefined {
        if (!this.isVisible(node, context)) {
            return undefined;
        }

        const vnode = (
            <g class-node={true} class-ecore-datatype={true}>
                <rect
                    class-sprotty-node={true}
                    class-selected={node.selected}
                    class-mouseover={node.hoverFeedback}
                    x="0"
                    y="0"
                    width={Math.max(0, node.size.width)}
                    height={Math.max(0, node.size.height)}
                    rx="3"
                    ry="3"
                />
                {context.renderChildren(node)}
            </g>
        );

        setAttr(vnode, 'data-svg-metadata-type', node.type);
        setClass(vnode, 'ecore-datatype', true);
        return vnode;
    }
}

/**
 * Custom view for Ecore enumerations - renders as a rectangle with diamond-like styling
 * All visual styling is handled via CSS classes in ecore-styles.css
 */
@injectable()
export class EcoreEnumNodeView extends RectangularNodeView {
    override render(node: Readonly<GNode & Hoverable & Selectable>, context: RenderingContext): VNode | undefined {
        if (!this.isVisible(node, context)) {
            return undefined;
        }

        const vnode = (
            <g class-node={true} class-ecore-enum={true}>
                <rect
                    class-sprotty-node={true}
                    class-selected={node.selected}
                    class-mouseover={node.hoverFeedback}
                    x="0"
                    y="0"
                    width={Math.max(0, node.size.width)}
                    height={Math.max(0, node.size.height)}
                    rx="8"
                    ry="8"
                />
                {context.renderChildren(node)}
            </g>
        );

        setAttr(vnode, 'data-svg-metadata-type', node.type);
        setClass(vnode, 'ecore-enum', true);
        return vnode;
    }
}

/**
 * Custom view for Ecore instances - renders different shapes based on visual configuration
 * All visual styling is handled via CSS classes in visual-configuration.css
 */
@injectable()
export class EcoreInstanceNodeView extends RectangularNodeView {
    override render(node: Readonly<GNode & Hoverable & Selectable>, context: RenderingContext): VNode | undefined {
        if (!this.isVisible(node, context)) {
            return undefined;
        }

        // Get CSS classes to determine shape and color
        const cssClasses = (node as any).cssClasses || [];
        const shapeClass = cssClasses.find((cls: string) => cls.startsWith('shape-'));
        

        // Check if custom size is configured
        const customSize = (node as any).customSize;
        const nodeWidth = customSize?.width || Math.max(0, node.size.width);
        const nodeHeight = customSize?.height || Math.max(0, node.size.height);

        // Render different shapes based on configuration
        let shapeElement: VNode;
        
        if (shapeClass === 'shape-circle') {
            shapeElement = this.renderCircle(node, nodeWidth, nodeHeight);
        } else if (shapeClass === 'shape-ellipse') {
            shapeElement = this.renderEllipse(node, nodeWidth, nodeHeight);
        } else if (shapeClass === 'shape-arrow') {
            shapeElement = this.renderArrow(node, nodeWidth, nodeHeight);
        } else {
            // Default rectangle
            shapeElement = this.renderRectangle(node, nodeWidth, nodeHeight);
        }

        const vnode = (
            <g class-node={true} class-ecore-instance={true}>
                {shapeElement}
                {node.selected ? this.renderResizeHandles(node, nodeWidth, nodeHeight) : null}
                {context.renderChildren(node)}
            </g>
        );

        setAttr(vnode, 'data-svg-metadata-type', node.type);
        setClass(vnode, 'ecore-instance', true);
        return vnode;
    }

    private renderResizeHandles(node: Readonly<GNode & Hoverable & Selectable>, width: number, height: number): VNode {
        const handleSize = 8;
        const halfHandle = handleSize / 2;
        
        return (
            <g class-resize-handles={true}>
                {/* Corner handles */}
                <rect
                    class-resize-handle={true}
                    class-resize-nw={true}
                    x={-halfHandle}
                    y={-halfHandle}
                    width={handleSize}
                    height={handleSize}
                    fill="#1976D2"
                    stroke="#ffffff"
                    strokeWidth={1}
                    cursor="nw-resize"
                    data-resize-direction="nw"
                />
                <rect
                    class-resize-handle={true}
                    class-resize-ne={true}
                    x={width - halfHandle}
                    y={-halfHandle}
                    width={handleSize}
                    height={handleSize}
                    fill="#1976D2"
                    stroke="#ffffff"
                    strokeWidth={1}
                    cursor="ne-resize"
                    data-resize-direction="ne"
                />
                <rect
                    class-resize-handle={true}
                    class-resize-sw={true}
                    x={-halfHandle}
                    y={height - halfHandle}
                    width={handleSize}
                    height={handleSize}
                    fill="#1976D2"
                    stroke="#ffffff"
                    strokeWidth={1}
                    cursor="sw-resize"
                    data-resize-direction="sw"
                />
                <rect
                    class-resize-handle={true}
                    class-resize-se={true}
                    x={width - halfHandle}
                    y={height - halfHandle}
                    width={handleSize}
                    height={handleSize}
                    fill="#1976D2"
                    stroke="#ffffff"
                    strokeWidth={1}
                    cursor="se-resize"
                    data-resize-direction="se"
                />
                
                {/* Edge handles */}
                <rect
                    class-resize-handle={true}
                    class-resize-n={true}
                    x={width / 2 - halfHandle}
                    y={-halfHandle}
                    width={handleSize}
                    height={handleSize}
                    fill="#1976D2"
                    stroke="#ffffff"
                    strokeWidth={1}
                    cursor="n-resize"
                    data-resize-direction="n"
                />
                <rect
                    class-resize-handle={true}
                    class-resize-s={true}
                    x={width / 2 - halfHandle}
                    y={height - halfHandle}
                    width={handleSize}
                    height={handleSize}
                    fill="#1976D2"
                    stroke="#ffffff"
                    strokeWidth={1}
                    cursor="s-resize"
                    data-resize-direction="s"
                />
                <rect
                    class-resize-handle={true}
                    class-resize-w={true}
                    x={-halfHandle}
                    y={height / 2 - halfHandle}
                    width={handleSize}
                    height={handleSize}
                    fill="#1976D2"
                    stroke="#ffffff"
                    strokeWidth={1}
                    cursor="w-resize"
                    data-resize-direction="w"
                />
                <rect
                    class-resize-handle={true}
                    class-resize-e={true}
                    x={width - halfHandle}
                    y={height / 2 - halfHandle}
                    width={handleSize}
                    height={handleSize}
                    fill="#1976D2"
                    stroke="#ffffff"
                    strokeWidth={1}
                    cursor="e-resize"
                    data-resize-direction="e"
                />
            </g>
        );
    }

    private renderRectangle(node: Readonly<GNode & Hoverable & Selectable>, width: number, height: number): VNode {
        const cssClasses = (node as any).cssClasses || [];
        const borderClass = cssClasses.find((cls: string) => cls.startsWith('border-'));
        let strokeDasharray = "none";
        
        if (borderClass === 'border-dashed') {
            strokeDasharray = "5,5";
        } else if (borderClass === 'border-dotted') {
            strokeDasharray = "2,2";
        }
        
        return (
            <rect
                class-sprotty-node={true}
                class-selected={node.selected}
                class-mouseover={node.hoverFeedback}
                x="0"
                y="0"
                width={width}
                height={height}
                rx="5"
                ry="5"
                strokeDasharray={strokeDasharray}
            />
        );
    }

    private renderCircle(node: Readonly<GNode & Hoverable & Selectable>, width: number, height: number): VNode {
        const radius = Math.min(width, height) / 2 - 10; // Leave more margin for circle
        const centerX = width / 2;
        const centerY = height / 2;
        
        const cssClasses = (node as any).cssClasses || [];
        const borderClass = cssClasses.find((cls: string) => cls.startsWith('border-'));
        let strokeDasharray = "none";
        
        if (borderClass === 'border-dashed') {
            strokeDasharray = "5,5";
        } else if (borderClass === 'border-dotted') {
            strokeDasharray = "2,2";
        }
        
        return (
            <circle
                class-sprotty-node={true}
                class-selected={node.selected}
                class-mouseover={node.hoverFeedback}
                cx={centerX}
                cy={centerY}
                r={radius}
                strokeDasharray={strokeDasharray}
            />
        );
    }

    private renderEllipse(node: Readonly<GNode & Hoverable & Selectable>, width: number, height: number): VNode {
        const centerX = width / 2;
        const centerY = height / 2;
        const radiusX = width / 2 - 10; // Leave more margin for ellipse
        const radiusY = height / 2 - 10; // Leave more margin for ellipse
        
        const cssClasses = (node as any).cssClasses || [];
        const borderClass = cssClasses.find((cls: string) => cls.startsWith('border-'));
        let strokeDasharray = "none";
        
        if (borderClass === 'border-dashed') {
            strokeDasharray = "5,5";
        } else if (borderClass === 'border-dotted') {
            strokeDasharray = "2,2";
        }
        
        return (
            <ellipse
                class-sprotty-node={true}
                class-selected={node.selected}
                class-mouseover={node.hoverFeedback}
                cx={centerX}
                cy={centerY}
                rx={radiusX}
                ry={radiusY}
                strokeDasharray={strokeDasharray}
            />
        );
    }

    private renderArrow(node: Readonly<GNode & Hoverable & Selectable>, width: number, height: number): VNode {
        // Create a line with an open arrowhead
        const lineY = height / 2;
        const lineStart = width * 0.1;
        const lineEnd = width * 0.8;
        const arrowheadSize = height * 0.3;
        const arrowheadX = lineEnd;
        const arrowheadY = lineY;
        
        // Create the main line and open arrowhead
        const arrowPath = `M ${lineStart},${lineY} L ${lineEnd},${lineY} M ${arrowheadX},${arrowheadY} L ${arrowheadX - arrowheadSize},${arrowheadY - arrowheadSize/2} M ${arrowheadX},${arrowheadY} L ${arrowheadX - arrowheadSize},${arrowheadY + arrowheadSize/2}`;
        
        // Check for border style configuration
        const cssClasses = (node as any).cssClasses || [];
        const borderClass = cssClasses.find((cls: string) => cls.startsWith('border-'));
        let strokeDasharray = "none";
        
        if (borderClass === 'border-dashed') {
            strokeDasharray = "5,5";
        } else if (borderClass === 'border-dotted') {
            strokeDasharray = "2,2";
        }
        
        return (
            <path
                class-sprotty-node={true}
                class-selected={node.selected}
                class-mouseover={node.hoverFeedback}
                d={arrowPath}
                stroke="black"
                strokeWidth={3}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={strokeDasharray}
            />
        );
    }
}

/**
 * Custom view for Ecore compartments - sets data-type attribute for CSS styling
 * This allows different styling for header, attributes, and references compartments
 */
@injectable()
export class EcoreCompartmentView extends ShapeView {
    override render(model: Readonly<GCompartment>, context: RenderingContext): VNode | undefined {
        if (!this.isVisible(model, context)) {
            return undefined;
        }
        
        const rectSize = Dimension.isValid(model.size) ? model.size : Dimension.ZERO;
        const rect = (
            <rect 
                class-sprotty-comp={true} 
                x='0' 
                y='0' 
                width={rectSize.width} 
                height={rectSize.height}
            />
        );
        
        // Set data-type attribute on the rect for CSS styling
        setAttr(rect, 'data-type', model.type);
        
        const vnode = (
            <g>
                {rect}
                {context.renderChildren(model)}
            </g>
        );
        
        return vnode;
    }
}

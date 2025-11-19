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

interface NodeShapeConfig {
    type: string;
    width: number;
    height: number;
    color: string;
    fillColor: string;
    lineThickness: number;
    lineStyle: 'solid' | 'dashed' | 'dotted';
}

interface ShapeRenderStyle {
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    lineStyle?: 'solid' | 'dashed' | 'dotted';
}

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

        const cssClasses = (node as any).cssClasses || [];
        const shapeConfig = this.getShapeConfig(node);
        const cssShapeClass = cssClasses.find((cls: string) => cls.startsWith('shape-'));

        const customSize = (node as any).customSize || (shapeConfig ? { width: shapeConfig.width, height: shapeConfig.height } : undefined);
        const nodeWidth = customSize?.width || Math.max(0, node.size.width);
        const nodeHeight = customSize?.height || Math.max(0, node.size.height);

        let shapeType = shapeConfig?.type;
        if (!shapeType && cssShapeClass) {
            shapeType = cssShapeClass.replace('shape-', '');
        }

        const shapeStyle = this.getShapeRenderStyle(shapeConfig);

        let shapeElement: VNode;
        switch (shapeType) {
            case 'circle':
                shapeElement = this.renderCircle(node, nodeWidth, nodeHeight, shapeStyle);
                break;
            case 'ellipse':
                shapeElement = this.renderEllipse(node, nodeWidth, nodeHeight, shapeStyle);
                break;
            case 'arrow':
                shapeElement = this.renderArrow(node, nodeWidth, nodeHeight, shapeStyle);
                break;
            case 'triangle':
                shapeElement = this.renderTriangle(node, nodeWidth, nodeHeight, shapeStyle);
                break;
            case 'diamond':
                shapeElement = this.renderDiamond(node, nodeWidth, nodeHeight, shapeStyle);
                break;
            case 'hexagon':
                shapeElement = this.renderHexagon(node, nodeWidth, nodeHeight, shapeStyle);
                break;
            default:
                shapeElement = this.renderRectangle(node, nodeWidth, nodeHeight, shapeStyle);
                break;
        }

        const hasMapping = cssClasses.includes('color-mapped');
        
        // Set CSS variables on the parent group if node has mapping
        const groupAttrs: any = {
            'class-node': true,
            'class-ecore-instance': true
        };
        
        if (hasMapping && shapeConfig) {
            groupAttrs.style = {
                '--instance-node-fill': shapeConfig.fillColor || 'transparent',
                '--instance-node-stroke': shapeConfig.color || '#444',
                '--instance-node-stroke-width': (shapeConfig.lineThickness || 2) + 'px'
            };
        }
        
        const vnode = (
            <g {...groupAttrs}>
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

    private renderRectangle(node: Readonly<GNode & Hoverable & Selectable>, width: number, height: number, style: ShapeRenderStyle): VNode {
        const cssClasses = (node as any).cssClasses || [];
        const borderClass = cssClasses.find((cls: string) => cls.startsWith('border-'));
        const strokeDasharray = this.resolveDashArray(style.lineStyle, borderClass);
        const attrs: any = {
            'class-sprotty-node': true,
            'class-selected': node.selected,
            'class-mouseover': node.hoverFeedback,
            x: "0",
            y: "0",
            width: width,
            height: height,
            rx: "5",
            ry: "5",
            strokeDasharray: strokeDasharray
        };
        
        // Set fill and stroke as inline attributes to override CSS !important rules
        if (style.fill) {
            attrs.fill = style.fill;
            // Also set as CSS variable for nodes with mapping
            attrs.style = { '--instance-node-fill': style.fill };
        }
        if (style.stroke) {
            attrs.stroke = style.stroke;
            attrs.style = attrs.style || {};
            attrs.style['--instance-node-stroke'] = style.stroke;
        }
        if (style.strokeWidth !== undefined) {
            attrs.strokeWidth = style.strokeWidth;
            attrs.style = attrs.style || {};
            attrs.style['--instance-node-stroke-width'] = style.strokeWidth + 'px';
        }
        
        return <rect {...attrs} />;
    }

    private renderCircle(node: Readonly<GNode & Hoverable & Selectable>, width: number, height: number, style: ShapeRenderStyle): VNode {
        const radius = Math.min(width, height) / 2 - 10; // Leave more margin for circle
        const centerX = width / 2;
        const centerY = height / 2;
        
        const cssClasses = (node as any).cssClasses || [];
        const borderClass = cssClasses.find((cls: string) => cls.startsWith('border-'));
        const strokeDasharray = this.resolveDashArray(style.lineStyle, borderClass);
        
        const attrs: any = {
            'class-sprotty-node': true,
            'class-selected': node.selected,
            'class-mouseover': node.hoverFeedback,
            cx: centerX,
            cy: centerY,
            r: radius,
            strokeDasharray: strokeDasharray
        };
        
        // Set fill and stroke as inline attributes to override CSS !important rules
        if (style.fill) {
            attrs.fill = style.fill;
            attrs.style = { '--instance-node-fill': style.fill };
        }
        if (style.stroke) {
            attrs.stroke = style.stroke;
            attrs.style = attrs.style || {};
            attrs.style['--instance-node-stroke'] = style.stroke;
        }
        if (style.strokeWidth !== undefined) {
            attrs.strokeWidth = style.strokeWidth;
            attrs.style = attrs.style || {};
            attrs.style['--instance-node-stroke-width'] = style.strokeWidth + 'px';
        }
        
        return <circle {...attrs} />;
    }

    private renderEllipse(node: Readonly<GNode & Hoverable & Selectable>, width: number, height: number, style: ShapeRenderStyle): VNode {
        const centerX = width / 2;
        const centerY = height / 2;
        const radiusX = Math.max(0, width / 2 - 5);
        const radiusY = Math.max(0, height / 2 - 5);
        
        const cssClasses = (node as any).cssClasses || [];
        const borderClass = cssClasses.find((cls: string) => cls.startsWith('border-'));
        const strokeDasharray = this.resolveDashArray(style.lineStyle, borderClass);
        
        const attrs: any = {
            'class-sprotty-node': true,
            'class-selected': node.selected,
            'class-mouseover': node.hoverFeedback,
            cx: centerX,
            cy: centerY,
            rx: radiusX,
            ry: radiusY,
            strokeDasharray: strokeDasharray
        };
        
        if (style.fill) {
            attrs.fill = style.fill;
            attrs.style = { '--instance-node-fill': style.fill };
        }
        if (style.stroke) {
            attrs.stroke = style.stroke;
            attrs.style = attrs.style || {};
            attrs.style['--instance-node-stroke'] = style.stroke;
        }
        if (style.strokeWidth !== undefined) {
            attrs.strokeWidth = style.strokeWidth;
            attrs.style = attrs.style || {};
            attrs.style['--instance-node-stroke-width'] = style.strokeWidth + 'px';
        }
        
        return <ellipse {...attrs} />;
    }

    private renderArrow(node: Readonly<GNode & Hoverable & Selectable>, width: number, height: number, style: ShapeRenderStyle): VNode {
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
        const strokeDasharray = this.resolveDashArray(style.lineStyle, borderClass);
        
        return (
            <path
                class-sprotty-node={true}
                class-selected={node.selected}
                class-mouseover={node.hoverFeedback}
                d={arrowPath}
                stroke={style.stroke || 'black'}
                strokeWidth={style.strokeWidth || 3}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={strokeDasharray}
            />
        );
    }

    private renderTriangle(node: Readonly<GNode & Hoverable & Selectable>, width: number, height: number, style: ShapeRenderStyle): VNode {
        const padding = 10;
        const points = [
            `${width / 2},${padding}`,
            `${width - padding},${height - padding}`,
            `${padding},${height - padding}`
        ].join(' ');
        const strokeDasharray = this.resolveDashArray(style.lineStyle);
        const attrs: any = {
            'class-sprotty-node': true,
            'class-selected': node.selected,
            'class-mouseover': node.hoverFeedback,
            points: points,
            strokeDasharray: strokeDasharray
        };
        
        if (style.fill) {
            attrs.fill = style.fill;
            attrs.style = { '--instance-node-fill': style.fill };
        }
        if (style.stroke) {
            attrs.stroke = style.stroke;
            attrs.style = attrs.style || {};
            attrs.style['--instance-node-stroke'] = style.stroke;
        }
        if (style.strokeWidth !== undefined) {
            attrs.strokeWidth = style.strokeWidth;
            attrs.style = attrs.style || {};
            attrs.style['--instance-node-stroke-width'] = style.strokeWidth + 'px';
        }
        
        return <polygon {...attrs} />;
    }

    private renderDiamond(node: Readonly<GNode & Hoverable & Selectable>, width: number, height: number, style: ShapeRenderStyle): VNode {
        const padding = 10;
        const cx = width / 2;
        const cy = height / 2;
        const points = [
            `${cx},${padding}`,
            `${width - padding},${cy}`,
            `${cx},${height - padding}`,
            `${padding},${cy}`
        ].join(' ');
        const strokeDasharray = this.resolveDashArray(style.lineStyle);
        const attrs: any = {
            'class-sprotty-node': true,
            'class-selected': node.selected,
            'class-mouseover': node.hoverFeedback,
            points: points,
            strokeDasharray: strokeDasharray
        };
        
        if (style.fill) {
            attrs.fill = style.fill;
            attrs.style = { '--instance-node-fill': style.fill };
        }
        if (style.stroke) {
            attrs.stroke = style.stroke;
            attrs.style = attrs.style || {};
            attrs.style['--instance-node-stroke'] = style.stroke;
        }
        if (style.strokeWidth !== undefined) {
            attrs.strokeWidth = style.strokeWidth;
            attrs.style = attrs.style || {};
            attrs.style['--instance-node-stroke-width'] = style.strokeWidth + 'px';
        }
        
        return <polygon {...attrs} />;
    }

    private renderHexagon(node: Readonly<GNode & Hoverable & Selectable>, width: number, height: number, style: ShapeRenderStyle): VNode {
        const padding = 10;
        const w = width - padding * 2;
        const h = height - padding * 2;
        const x = padding;
        const y = padding;
        const points = [
            `${x + w * 0.25},${y}`,
            `${x + w * 0.75},${y}`,
            `${x + w},${y + h / 2}`,
            `${x + w * 0.75},${y + h}`,
            `${x + w * 0.25},${y + h}`,
            `${x},${y + h / 2}`
        ].join(' ');
        const strokeDasharray = this.resolveDashArray(style.lineStyle);
        return (
            <polygon
                class-sprotty-node={true}
                class-selected={node.selected}
                class-mouseover={node.hoverFeedback}
                points={points}
                fill={style.fill}
                stroke={style.stroke}
                strokeWidth={style.strokeWidth}
                strokeDasharray={strokeDasharray}
            />
        );
    }

    private getShapeConfig(node: any): NodeShapeConfig | undefined {
        return node?.shapeConfig as NodeShapeConfig | undefined;
    }

    private getShapeRenderStyle(shapeConfig?: NodeShapeConfig): ShapeRenderStyle {
        if (!shapeConfig) {
            return {};
        }
        return {
            fill: shapeConfig.fillColor,
            stroke: shapeConfig.color,
            strokeWidth: shapeConfig.lineThickness,
            lineStyle: shapeConfig.lineStyle
        };
    }

    private resolveDashArray(lineStyle?: string, cssBorderClass?: string): string | undefined {
        if (lineStyle === 'dashed' || cssBorderClass === 'border-dashed') {
            return '5,5';
        }
        if (lineStyle === 'dotted' || cssBorderClass === 'border-dotted') {
            return '2,2';
        }
        return undefined;
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

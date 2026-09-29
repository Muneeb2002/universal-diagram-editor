/**
 * @author Abigail Sotomayor <s205720@dtu.dk>
 */
/** @jsx svg */
import { inject, injectable } from 'inversify';
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
    , IActionDispatcher
    , TYPES
    , on
} from '@eclipse-glsp/sprotty';
import { ChangeBoundsOperation } from '@eclipse-glsp/client';
import { SetCompositeComponentAction } from './composite-component-actions';

interface NodeShapeConfig {
    type: string;
    width: number;
    height: number;
    resizeHorizontal?: boolean;
    resizeVertical?: boolean;
    color: string;
    fillColor: string;
    filled?: boolean;
    lineThickness: number;
    lineStyle: 'solid' | 'dashed' | 'dotted';
    svgContent?: string;
    components?: NodeShapeComponent[];
}

interface NodeShapeComponent extends NodeShapeConfig {
    x: number;
    y: number;
    rotation?: number;
}

interface ShapeRenderStyle {
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    lineStyle?: 'solid' | 'dashed' | 'dotted';
}


@injectable()
export class EcoreClassNodeView extends RectangularNodeView {
    override render(node: Readonly<GNode & Hoverable & Selectable>, context: RenderingContext): VNode | undefined {
        if (!this.isVisible(node, context)) {
            return undefined;
        }


        const cssClasses = (node as any).cssClasses || [];
        const isAbstract = cssClasses.includes('abstract');
        const isInterface = cssClasses.includes('interface');
        const nodeWidth = Math.max(0, node.size.width);
        const nodeHeight = Math.max(0, node.size.height);

        const compartments = node.children?.filter(child => child.type?.startsWith('comp:')) || [];
        let separatorLines: VNode[] = [];

        if (compartments.length > 1) {
            let currentY = 0;
            for (let i = 0; i < compartments.length - 1; i++) {
                const compartment = compartments[i];
                const compartmentHeight = (compartment as any).size?.height || 30;
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

@injectable()
export class EcoreInstanceNodeView extends RectangularNodeView {
    @inject(TYPES.IActionDispatcher) protected actionDispatcher: IActionDispatcher;

    override render(node: Readonly<GNode & Hoverable & Selectable>, context: RenderingContext): VNode | undefined {
        if (!this.isVisible(node, context)) {
            return undefined;
        }
        if (!node.selected && (node as any).selectedComponentIndex !== undefined) {
            (node as any).selectedComponentIndex = -1;
        }

        const cssClasses = (node as any).cssClasses || [];
        const shapeConfig = this.getShapeConfig(node);
        const cssShapeClass = cssClasses.find((cls: string) => cls.startsWith('shape-'));

        const customSize = (node as any).customSize || (shapeConfig ? { width: shapeConfig.width, height: shapeConfig.height } : undefined);
        // VBox layout can temporarily replace a new node's bounds with its label bounds. GLSP's
        // resize feedback and the server both maintain prefWidth/prefHeight, so those values are
        // the stable source for defaults as well as interactive and persisted resizing.
        const preferredWidth = Number((node as any).layoutOptions?.prefWidth);
        const preferredHeight = Number((node as any).layoutOptions?.prefHeight);
        const nodeWidth = preferredWidth > 0 ? preferredWidth : (Math.max(0, node.size.width) || customSize?.width || 0);
        const nodeHeight = preferredHeight > 0 ? preferredHeight : (Math.max(0, node.size.height) || customSize?.height || 0);

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
            case 'arrow':
                shapeElement = this.renderArrow(node, nodeWidth, nodeHeight, shapeStyle);
                break;
            case 'line':
                shapeElement = this.renderLine(node, nodeWidth, nodeHeight, shapeStyle);
                break;
            case 'custom-svg':
                shapeElement = this.renderCustomSvg(node, nodeWidth, nodeHeight, shapeConfig);
                break;
            case 'composite':
                shapeElement = this.renderComposite(node, nodeWidth, nodeHeight, shapeConfig);
                break;
            default:
                shapeElement = this.renderRectangle(node, nodeWidth, nodeHeight, shapeStyle);
                break;
        }

        const hasMapping = cssClasses.includes('color-mapped');

        const groupAttrs: any = {
            'class-node': true,
            'class-ecore-instance': true
        };

        if (hasMapping && shapeConfig) {
            const fillValue = (shapeConfig.filled === false) ? 'none' : (shapeConfig.fillColor || 'transparent');
            groupAttrs.style = {
                '--instance-node-fill': fillValue,
                '--instance-node-stroke': shapeConfig.color || '#444',
                '--instance-node-stroke-width': (shapeConfig.lineThickness || 2) + 'px'
            };
        } else {
            groupAttrs.style = {
                '--instance-node-fill': 'initial',
                '--instance-node-stroke': 'initial',
                '--instance-node-stroke-width': 'initial'
            };
        }

        const vnode = (
            <g {...groupAttrs}>
                {shapeElement}
                {node.selected ? (
                    <rect
                        class-instance-selection-border={true}
                        x="-3"
                        y="-3"
                        width={nodeWidth + 6}
                        height={nodeHeight + 6}
                        rx="6"
                        ry="6"
                        fill="none"
                        pointer-events="none"
                    />
                ) : undefined}
                {context.renderChildren(node)}
            </g>
        );

        setAttr(vnode, 'data-svg-metadata-type', node.type);
        setClass(vnode, 'ecore-instance', true);
        return vnode;
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

        return <rect {...attrs} />;
    }

    private renderCircle(node: Readonly<GNode & Hoverable & Selectable>, width: number, height: number, style: ShapeRenderStyle): VNode {
        const safeWidth = Math.max(1, width);
        const safeHeight = Math.max(1, height);
        const smallerDim = Math.min(safeWidth, safeHeight);
        const padding = smallerDim < 30 ? 0 : 10;
        const radius = Math.max(0.5, smallerDim / 2 - padding);
        const centerX = safeWidth / 2;
        const centerY = safeHeight / 2;

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

        let fillValue = style.fill;
        if (fillValue === undefined || fillValue === null || fillValue === '') {
            const nodeShapeConfig = (node as any).shapeConfig;
            if (nodeShapeConfig) {
                const isFilled = nodeShapeConfig.filled !== false;
                fillValue = isFilled ? (nodeShapeConfig.fillColor || 'transparent') : 'none';
            } else {
                fillValue = 'none';
            }
        }
        attrs.fill = fillValue;
        attrs.style = attrs.style || {};
        attrs.style['--instance-node-fill'] = fillValue;
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


    private renderArrow(node: Readonly<GNode & Hoverable & Selectable>, width: number, height: number, style: ShapeRenderStyle): VNode {
        const lineY = height / 2;
        const lineStart = width * 0.1;
        const lineEnd = width * 0.8;
        const arrowheadSize = height * 0.3;
        const arrowheadX = lineEnd;
        const arrowheadY = lineY;

        const arrowPath = `M ${lineStart},${lineY} L ${lineEnd},${lineY} M ${arrowheadX},${arrowheadY} L ${arrowheadX - arrowheadSize},${arrowheadY - arrowheadSize / 2} M ${arrowheadX},${arrowheadY} L ${arrowheadX - arrowheadSize},${arrowheadY + arrowheadSize / 2}`;

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

    private renderLine(node: Readonly<GNode & Hoverable & Selectable>, width: number, height: number, style: ShapeRenderStyle): VNode {
        const lineY = height / 2;
        const margin = Math.max(style.strokeWidth || 2, 4);
        const x1 = margin;
        const x2 = width - margin;
        const cssClasses = (node as any).cssClasses || [];
        const borderClass = cssClasses.find((cls: string) => cls.startsWith('border-'));
        const strokeDasharray = this.resolveDashArray(style.lineStyle, borderClass);
        return (
            <line
                class-sprotty-node={true}
                class-selected={node.selected}
                class-mouseover={node.hoverFeedback}
                x1={x1}
                y1={lineY}
                x2={x2}
                y2={lineY}
                stroke={style.stroke || 'black'}
                strokeWidth={style.strokeWidth || 2}
                strokeDasharray={strokeDasharray}
            />
        );
    }

    private renderComposite(
        node: Readonly<GNode & Hoverable & Selectable>,
        width: number,
        height: number,
        shapeConfig?: NodeShapeConfig
    ): VNode {
        const components = shapeConfig?.components ?? [];
        const componentNode = { ...node, selected: false, hoverFeedback: false } as Readonly<GNode & Hoverable & Selectable>;
        const background = <rect x="0" y="0" width={width} height={height} fill="none" stroke="none" pointer-events="none" />;

        return (
            <g>
                {background}
                {components.map((component, componentIndex) => {
                    const rotation = component.rotation ?? 0;
                    const quarterTurn = Math.abs(Math.round(rotation / 90)) % 2 === 1;
                    const baseVisualWidth = quarterTurn ? component.height : component.width;
                    const baseVisualHeight = quarterTurn ? component.width : component.height;
                    const baseCenterX = component.x + component.width / 2;
                    const baseCenterY = component.y + component.height / 2;
                    const visualLeft = baseCenterX - baseVisualWidth / 2;
                    const visualTop = baseCenterY - baseVisualHeight / 2;
                    // A composite's outer instance bounds may come from an older saved model.
                    // Keep each component at its own configured or persisted bounds instead of
                    // subtracting the outer size difference from the component's dimensions.
                    const visualWidth = baseVisualWidth;
                    const visualHeight = baseVisualHeight;
                    const centerX = visualLeft + visualWidth / 2;
                    const centerY = visualTop + visualHeight / 2;
                    const componentWidth = quarterTurn ? visualHeight : visualWidth;
                    const componentHeight = quarterTurn ? visualWidth : visualHeight;
                    const x = centerX - componentWidth / 2;
                    const y = centerY - componentHeight / 2;
                    const child = this.renderComponent(componentNode, component, componentWidth, componentHeight);
                    const componentGroup = (
                        <g transform={`translate(${x} ${y}) rotate(${rotation} ${componentWidth / 2} ${componentHeight / 2})`}>
                            {child}
                        </g>
                    );
                    setAttr(componentGroup, 'data-composite-component-index', String(componentIndex));
                    on(componentGroup, 'mousedown', event => this.selectCompositeComponent(event, node, componentIndex));

                    const isComponentSelected = node.selected && (node as any).selectedComponentIndex === componentIndex;
                    const selectionLeft = centerX - visualWidth / 2;
                    const selectionTop = centerY - visualHeight / 2;
                    return (
                        <g>
                            {componentGroup}
                            {isComponentSelected ? (
                                <g>
                                    <rect
                                        class-composite-component-selection={true}
                                        x={selectionLeft - 2}
                                        y={selectionTop - 2}
                                        width={visualWidth + 4}
                                        height={visualHeight + 4}
                                        fill="none"
                                        pointer-events="none"
                                    />
                                    {component.resizeHorizontal !== false
                                        ? this.renderComponentResizeHandle(node, componentIndex, component, 'left', selectionLeft, centerY)
                                        : undefined}
                                    {component.resizeHorizontal !== false
                                        ? this.renderComponentResizeHandle(node, componentIndex, component, 'right', selectionLeft + visualWidth, centerY)
                                        : undefined}
                                    {component.resizeVertical !== false
                                        ? this.renderComponentResizeHandle(node, componentIndex, component, 'top', centerX, selectionTop)
                                        : undefined}
                                    {component.resizeVertical !== false
                                        ? this.renderComponentResizeHandle(node, componentIndex, component, 'bottom', centerX, selectionTop + visualHeight)
                                        : undefined}
                                </g>
                            ) : undefined}
                        </g>
                    );
                })}
            </g>
        );
    }

    private selectCompositeComponent(event: Event, node: Readonly<GNode & Hoverable & Selectable>, componentIndex: number): void {
        if (!node.selected) return;
        event.preventDefault();
        event.stopPropagation();
        const selectedIndex = (node as any).selectedComponentIndex;
        this.actionDispatcher.dispatch(SetCompositeComponentAction.create(
            node.id,
            selectedIndex === componentIndex ? -1 : componentIndex
        ));
    }

    private renderComponentResizeHandle(
        node: Readonly<GNode & Hoverable & Selectable>,
        componentIndex: number,
        component: NodeShapeComponent,
        direction: 'left' | 'right' | 'top' | 'bottom',
        x: number,
        y: number
    ): VNode {
        const zoom = Math.max(0.01, Number((node.root as any).zoom) || 1);
        const handle = (
            <circle
                class-composite-component-resize-handle={true}
                cx={x}
                cy={y}
                r={6 / zoom}
            />
        );
        setAttr(handle, 'data-component-resize-handle', direction);
        on(handle, 'mousedown', event => this.startComponentResize(event as MouseEvent, node, componentIndex, component, direction));
        return handle;
    }

    private startComponentResize(
        event: MouseEvent,
        node: Readonly<GNode & Hoverable & Selectable>,
        componentIndex: number,
        component: NodeShapeComponent,
        direction: 'left' | 'right' | 'top' | 'bottom'
    ): void {
        event.preventDefault();
        event.stopPropagation();
        const startX = event.clientX;
        const startY = event.clientY;
        const rotation = component.rotation ?? 0;
        const quarterTurn = Math.abs(Math.round(rotation / 90)) % 2 === 1;
        const initialVisualWidth = quarterTurn ? component.height : component.width;
        const initialVisualHeight = quarterTurn ? component.width : component.height;
        const initialCenterX = component.x + component.width / 2;
        const initialCenterY = component.y + component.height / 2;
        const visualLeft = initialCenterX - initialVisualWidth / 2;
        const visualTop = initialCenterY - initialVisualHeight / 2;
        const rootZoom = Math.max(0.01, Number((node.root as any).zoom) || 1);
        let latest = { x: component.x, y: component.y, width: component.width, height: component.height };

        const onMouseMove = (moveEvent: MouseEvent): void => {
            const visualWidth = direction === 'right'
                ? Math.max(1, initialVisualWidth + (moveEvent.clientX - startX) / rootZoom)
                : direction === 'left'
                    ? Math.max(1, initialVisualWidth + (startX - moveEvent.clientX) / rootZoom)
                    : initialVisualWidth;
            const visualHeight = direction === 'bottom'
                ? Math.max(1, initialVisualHeight + (moveEvent.clientY - startY) / rootZoom)
                : direction === 'top'
                    ? Math.max(1, initialVisualHeight + (startY - moveEvent.clientY) / rootZoom)
                    : initialVisualHeight;
            const nextVisualLeft = direction === 'left'
                ? visualLeft + initialVisualWidth - visualWidth
                : visualLeft;
            const nextVisualTop = direction === 'top'
                ? visualTop + initialVisualHeight - visualHeight
                : visualTop;
            const localWidth = quarterTurn ? visualHeight : visualWidth;
            const localHeight = quarterTurn ? visualWidth : visualHeight;
            const centerX = nextVisualLeft + visualWidth / 2;
            const centerY = nextVisualTop + visualHeight / 2;
            latest = {
                x: centerX - localWidth / 2,
                y: centerY - localHeight / 2,
                width: localWidth,
                height: localHeight
            };
            this.actionDispatcher.dispatch(SetCompositeComponentAction.create(node.id, componentIndex, latest));
        };

        const onMouseUp = (): void => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            this.actionDispatcher.dispatch(ChangeBoundsOperation.create([{
                elementId: `${node.id}::component::${componentIndex}`,
                newPosition: { x: latest.x, y: latest.y },
                newSize: { width: latest.width, height: latest.height }
            }]));
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }

    private renderComponent(
        node: Readonly<GNode & Hoverable & Selectable>,
        component: NodeShapeComponent,
        width: number,
        height: number
    ): VNode {
        const style = this.getShapeRenderStyle(component);
        switch (component.type) {
            case 'circle':
                return this.renderCircle(node, width, height, style);
            case 'arrow':
                return this.renderArrow(node, width, height, style);
            case 'line':
                return this.renderLine(node, width, height, style);
            case 'custom-svg':
                return this.renderCustomSvg(node, width, height, component);
            case 'composite':
                return this.renderComposite(node, width, height, component);
            default:
                return this.renderRectangle(node, width, height, style);
        }
    }

    private getShapeConfig(node: any): NodeShapeConfig | undefined {
        return node?.shapeConfig as NodeShapeConfig | undefined;
    }

    private getShapeRenderStyle(shapeConfig?: NodeShapeConfig): ShapeRenderStyle {
        if (!shapeConfig) {
            return {};
        }
        let fill: string;
        if (shapeConfig.filled === false) {
            fill = 'none';
        } else {
            fill = shapeConfig.fillColor || 'transparent';
        }
        return {
            fill: fill,
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

    private renderCustomSvg(node: Readonly<GNode & Hoverable & Selectable>, width: number, height: number, shapeConfig?: NodeShapeConfig): VNode {
        if (!shapeConfig?.svgContent) {
            return this.renderRectangle(node, width, height, {});
        }

        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(shapeConfig.svgContent, 'image/svg+xml');
        const parseError = svgDoc.querySelector('parsererror');
        if (parseError) {
            return this.renderRectangle(node, width, height, {});
        }

        const sourceSvg = svgDoc.querySelector('svg');
        if (!sourceSvg) {
            return this.renderRectangle(node, width, height, {});
        }

        let viewBox = sourceSvg.getAttribute('viewBox');
        if (!viewBox) {
            const svgWidth = sourceSvg.getAttribute('width');
            const svgHeight = sourceSvg.getAttribute('height');
            if (svgWidth && svgHeight) {
                const w = parseFloat(svgWidth.replace('px', '').replace('pt', '').trim());
                const h = parseFloat(svgHeight.replace('px', '').replace('pt', '').trim());
                if (w > 0 && h > 0) {
                    viewBox = `0 0 ${w} ${h}`;
                }
            }
            if (!viewBox) {
                viewBox = `0 0 ${width} ${height}`;
            }
        }

        const svgElement = sourceSvg.cloneNode(true) as SVGSVGElement;
        svgElement.removeAttribute('width');
        svgElement.removeAttribute('height');
        svgElement.setAttribute('viewBox', viewBox);
        svgElement.setAttribute('width', width.toString());
        svgElement.setAttribute('height', height.toString());
        svgElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');

        const svgString = new XMLSerializer().serializeToString(svgElement);
        const encodedSvg = encodeURIComponent(svgString);
        const dataUri = `data:image/svg+xml,${encodedSvg}`;

        return (
            <image
                class-sprotty-node={true}
                class-selected={node.selected}
                class-mouseover={node.hoverFeedback}
                href={dataUri}
                x="0"
                y="0"
                width={width}
                height={height}
                preserveAspectRatio="xMidYMid meet"
            />
        );
    }
}


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

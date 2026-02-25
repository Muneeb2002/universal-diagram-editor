/**
 * @author Abigail Sotomayor <s205720@dtu.dk>
 */
/** @jsx svg */
import { GEdge, PolylineEdgeView, RenderingContext } from '@eclipse-glsp/client';
import { svg } from '@eclipse-glsp/sprotty';
import type { Point } from '@eclipse-glsp/sprotty';
import { injectable } from 'inversify';
import { VNode } from 'snabbdom';

interface EdgeShapeStyle {
    stroke?: string;
    strokeWidth?: number;
    dashArray?: string;
    fill?: string;
}

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
            
            if (edge.type === 'edge:instance') {
                vnode.data!.attrs = vnode.data!.attrs || {};
                vnode.data!.attrs['data-edge-type'] = 'instance';
            }
        }

        return vnode;
    }

    protected override renderLine(edge: GEdge, segments: Point[], context: RenderingContext, args?: any): VNode {
        if (edge.type === 'edge:instance') {
            const shapeConfig = (edge as any).shapeConfig as { type?: string; svgContent?: string } | undefined;
            if (shapeConfig?.type === 'custom-svg' && shapeConfig.svgContent) {
                return <g />;
            }
        }

        const firstPoint = segments[0];
        let path = `M ${firstPoint.x},${firstPoint.y}`;
        for (let i = 1; i < segments.length; i++) {
            const p = segments[i];
            path += ` L ${p.x},${p.y}`;
        }

        const attrs: any = { d: path, fill: 'none' };

        if (edge.type === 'edge:instance') {
            const style = this.getEdgeShapeStyle(edge);
            const stroke = style.stroke || '#444';
            const strokeWidth = style.strokeWidth !== undefined ? style.strokeWidth : 2;
            const dashArray = style.dashArray || 'none';
            attrs.stroke = stroke;
            attrs['stroke-width'] = String(strokeWidth);
            if (style.dashArray) {
                attrs['stroke-dasharray'] = style.dashArray;
            }
            attrs.style = {
                '--instance-edge-stroke': stroke,
                '--instance-edge-stroke-width': `${strokeWidth}px`,
                '--instance-edge-dasharray': dashArray
            };
        }

        return <path {...attrs} />;
    }

    protected override renderAdditionals(edge: GEdge, segments: Point[], context: RenderingContext): VNode[] {
        const additionals: VNode[] = [];
        const type = edge.type ?? '';
        
        const shapeStyle = type === 'edge:instance' ? this.getEdgeShapeStyle(edge) : {};

        if (segments.length >= 2) {
            if (type !== 'edge:ecore-containment') {
                const tail = segments[segments.length - 2];
                const tip = segments[segments.length - 1];
                const head = this.createArrowForEdge(edge, tail, tip, 'end', shapeStyle);
                if (head) {
                    additionals.push(head);
                }
            }

            if (type === 'edge:ecore-containment') {
                const startTip = segments[0];
                const startTail = segments[1] ?? startTip;
                const startArrow = this.createArrowForEdge(edge, startTail, startTip, 'start', shapeStyle);
                if (startArrow) {
                    additionals.push(startArrow);
                }
            }
        }

        return additionals;
    }

    private createArrowForEdge(edge: GEdge, from: Point, to: Point, direction: 'start' | 'end', style: EdgeShapeStyle = {}): VNode | undefined {
        const type = edge.type ?? '';
        
        if (type === 'edge:instance') {
            const shapeConfig = (edge as any).shapeConfig as { 
                type?: string; 
                width?: number; 
                height?: number;
                arrowType?: 'filled-triangle' | 'open-triangle' | 'open-arrow' | 'diamond' | 'none';
                svgContent?: string;
            } | undefined;
            const shapeType = shapeConfig?.type;
            const arrowType = shapeConfig?.arrowType;
            
            if (shapeType === 'custom-svg' && shapeConfig?.svgContent) {
                return this.createCustomSvgMarker(to, shapeConfig);
            }
            
            const arrowLength = shapeConfig?.width ? Math.max(10, shapeConfig.width * 0.3) : 14;
            const arrowWidth = shapeConfig?.height ? Math.max(3, shapeConfig.height * 0.2) : 5;
            
            if (shapeType === 'arrow' && arrowType) {
                switch (arrowType) {
                    case 'filled-triangle':
                        return this.createFilledTriangle(from, to, type, direction, style, arrowLength, arrowWidth);
                    case 'open-triangle':
                        return this.createOpenTriangle(from, to, type, direction, style, arrowLength, arrowWidth);
                    case 'open-arrow':
                        return this.createOpenArrow(from, to, type, direction, style, arrowLength, arrowWidth);
                    case 'diamond':
                        return this.createDiamond(from, to, type, direction, style, arrowLength, arrowWidth);
                    case 'none':
                        return undefined; // No arrow, just the line
                    default:
                        return this.createFilledTriangle(from, to, type, direction, style, arrowLength, arrowWidth);
                }
            }
            
            if (shapeType === 'arrow') {
                return this.createFilledTriangle(from, to, type, direction, style, arrowLength, arrowWidth);
            }
            
            return undefined;
        }
        
        switch (type) {
            case 'edge:ecore-inheritance':
                return this.createOpenTriangle(from, to, type, direction, {}, 16, 6);
            case 'edge:ecore-containment':
                return this.createDiamond(from, to, type, direction, {}, 16, 6);
            case 'edge:ecore-bidirectional':
                return undefined;
            case 'edge:ecore-reference':
                return this.createOpenArrow(from, to, type, direction, {}, 14, 5);
            default:
                return this.createFilledTriangle(from, to, type, direction, {}, 11, 5);
        }
    }

    private createFilledTriangle(from: Point, to: Point, type: string, direction: 'start' | 'end', style: EdgeShapeStyle, length: number, halfWidth: number): VNode | undefined {
        const geometry = this.computeArrowGeometry(from, to, length, halfWidth);
        if (!geometry) {
            return undefined;
        }
        const { tip, baseLeft, baseRight } = geometry;
        const points = `${tip.x},${tip.y} ${baseLeft.x},${baseLeft.y} ${baseRight.x},${baseRight.y}`;
        const attrs: any = {
            'data-direction': direction,
            points: points,
            'pointer-events': "none",
            'stroke-linejoin': "round"
        };
        
        if (type === 'edge:instance') {
            const stroke = style.stroke || '#444';
            const fill = style.fill || stroke || '#444';
            const strokeWidth = style.strokeWidth !== undefined ? style.strokeWidth : 2;
            
            attrs.stroke = stroke;
            attrs.fill = fill;
            attrs['stroke-width'] = String(strokeWidth);
            attrs.style = {
                '--instance-edge-stroke': stroke,
                '--instance-edge-fill': fill,
                '--instance-edge-stroke-width': strokeWidth + 'px'
            };
        } else {
            attrs['class-edge-arrow'] = true;
            attrs['class-edge-arrow-reference'] = type === 'edge:ecore-reference';
            attrs.fill = style.fill || style.stroke || 'currentColor';
            if (style.stroke) {
                attrs.stroke = style.stroke;
            }
            if (style.strokeWidth !== undefined) {
                attrs['stroke-width'] = String(style.strokeWidth);
            }
        }
        
        return <polygon {...attrs} />;
    }

    private createOpenTriangle(from: Point, to: Point, type: string, direction: 'start' | 'end', style: EdgeShapeStyle, length = 16, halfWidth = 6): VNode | undefined {
        const geometry = this.computeArrowGeometry(from, to, length, halfWidth);
        if (!geometry) {
            return undefined;
        }
        const { tip, baseLeft, baseRight } = geometry;
        const d = `M ${baseLeft.x},${baseLeft.y} L ${tip.x},${tip.y} L ${baseRight.x},${baseRight.y} Z`;
        const attrs: any = {
            'data-direction': direction,
            d: d,
            fill: "none",
            'pointer-events': "none",
            'stroke-linejoin': "round"
        };
        
        if (type === 'edge:instance') {
            const stroke = style.stroke || '#444';
            const strokeWidth = style.strokeWidth !== undefined ? style.strokeWidth : 2;
            
            attrs.stroke = stroke;
            attrs['stroke-width'] = String(strokeWidth);
            attrs.style = {
                '--instance-edge-stroke': stroke,
                '--instance-edge-stroke-width': strokeWidth + 'px'
            };
        } else {
            attrs['class-edge-arrow'] = true;
            attrs['class-edge-arrow-inheritance'] = type === 'edge:ecore-inheritance';
        }
        
        return <path {...attrs} />;
    }

    private createDiamond(from: Point, to: Point, type: string, direction: 'start' | 'end', style: EdgeShapeStyle, length = 16, halfWidth = 6): VNode | undefined {
        const geometry = this.computeArrowGeometry(from, to, length, halfWidth);
        if (!geometry) {
            return undefined;
        }
        const { tip, midLeft, tail, midRight } = geometry;
        const points = `${tip.x},${tip.y} ${midLeft.x},${midLeft.y} ${tail.x},${tail.y} ${midRight.x},${midRight.y}`;
        const attrs: any = {
            'data-direction': direction,
            points: points,
            'pointer-events': "none",
            'stroke-linejoin': "round"
        };
        
        if (type === 'edge:instance') {
            const stroke = style.stroke || '#444';
            const fill = style.fill || stroke || '#444';
            const strokeWidth = style.strokeWidth !== undefined ? style.strokeWidth : 2;
            
            attrs.stroke = stroke;
            attrs.fill = fill;
            attrs['stroke-width'] = String(strokeWidth);
            attrs.style = {
                '--instance-edge-stroke': stroke,
                '--instance-edge-fill': fill,
                '--instance-edge-stroke-width': strokeWidth + 'px'
            };
        } else {
            attrs['class-edge-arrow'] = true;
            attrs['class-edge-arrow-containment'] = type === 'edge:ecore-containment';
        }
        
        return <polygon {...attrs} />;
    }

    private createOpenArrow(from: Point, to: Point, type: string, direction: 'start' | 'end', style: EdgeShapeStyle, length = 14, halfWidth = 5): VNode | undefined {
        const geometry = this.computeArrowGeometry(from, to, length, halfWidth);
        if (!geometry) {
            return undefined;
        }
        const { tip, baseLeft, baseRight } = geometry;
        const d = `M ${baseLeft.x},${baseLeft.y} L ${tip.x},${tip.y} M ${baseRight.x},${baseRight.y} L ${tip.x},${tip.y}`;
        const attrs: any = {
            'data-direction': direction,
            d: d,
            fill: "none",
            'pointer-events': "none",
            'stroke-linejoin': "round",
            'stroke-linecap': "round"
        };
        
        if (type === 'edge:instance') {
            const stroke = style.stroke || '#444';
            const strokeWidth = style.strokeWidth !== undefined ? style.strokeWidth : 2;
            const dashArray = style.dashArray || 'none';
            
            attrs.stroke = stroke;
            attrs['stroke-width'] = String(strokeWidth);
            if (style.dashArray) {
                attrs['stroke-dasharray'] = dashArray;
            }
            attrs.style = {
                '--instance-edge-stroke': stroke,
                '--instance-edge-stroke-width': strokeWidth + 'px',
                '--instance-edge-dasharray': dashArray
            };
        } else {
            attrs['class-edge-arrow'] = true;
            attrs['class-edge-arrow-reference'] = type === 'edge:ecore-reference';
        }
        
        return <path {...attrs} />;
    }

   
    private createCustomSvgMarker(
        tip: Point,
        shapeConfig: { svgContent?: string; width?: number; height?: number }
    ): VNode | undefined {
        if (!shapeConfig.svgContent) {
            return undefined;
        }

        try {
            const parser = new DOMParser();
            const svgDoc = parser.parseFromString(shapeConfig.svgContent, 'image/svg+xml');
            const parseError = svgDoc.querySelector('parsererror');
            if (parseError) {
                return undefined;
            }

            const sourceSvg = svgDoc.querySelector('svg');
            if (!sourceSvg) {
                return undefined;
            }

            const width = shapeConfig.width && shapeConfig.width > 0 ? shapeConfig.width : 24;
            const height = shapeConfig.height && shapeConfig.height > 0 ? shapeConfig.height : 24;

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

            const x = tip.x - width / 2;
            const y = tip.y - height / 2;

            return (
                <image
                    href={dataUri}
                    x={x}
                    y={y}
                    width={width}
                    height={height}
                    preserveAspectRatio="xMidYMid meet"
                    pointer-events="none"
                />
            );
        } catch {
            return undefined;
        }
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

    private getEdgeShapeStyle(edge: GEdge): EdgeShapeStyle {
        const config = (edge as any).shapeConfig as { color?: string; fillColor?: string; lineThickness?: number; lineStyle?: string } | undefined;
        if (!config) {
            return {};
        }
        return {
            stroke: config.color,
            fill: config.fillColor,
            strokeWidth: config.lineThickness,
            dashArray: this.resolveDashArray(config.lineStyle)
        };
    }

    private resolveDashArray(lineStyle?: string): string | undefined {
        if (!lineStyle) {
            return undefined;
        }
        if (lineStyle === 'dashed') {
            return '5,5';
        }
        if (lineStyle === 'dotted') {
            return '2,2';
        }
        return undefined;
    }
}


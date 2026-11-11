/**
 * Keeps contained instance nodes on the graphical component regions selected by
 * the shape designer while the client is showing drag feedback. The server
 * applies the same rules to the completed operation.
 */
import {
    ChangeBoundsManager,
    GModelElement,
    IGridManager,
    IHelperLineManager,
    IMovementRestrictor,
    ISnapper,
    MousePositionTracker,
    Point,
    TYPES,
    isBoundsAware
} from '@eclipse-glsp/client';
import { inject, injectable, optional } from 'inversify';

type ChildBindingMode = 'none' | 'inside' | 'on' | 'both';

interface BindingShape {
    type: string;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation?: number;
    childBinding?: ChildBindingMode;
    components?: BindingShape[];
}

@injectable()
export class EcoreChangeBoundsManager extends ChangeBoundsManager {
    constructor(
        @inject(MousePositionTracker) positionTracker: MousePositionTracker,
        @optional() @inject(TYPES.IMovementRestrictor) movementRestrictor?: IMovementRestrictor,
        @optional() @inject(TYPES.ISnapper) snapper?: ISnapper,
        @optional() @inject(TYPES.IHelperLineManager) helperLineManager?: IHelperLineManager,
        @optional() @inject(TYPES.IGridManager) gridManager?: IGridManager
    ) {
        super(positionTracker, movementRestrictor, snapper, helperLineManager, gridManager);
    }

    override snapPosition(element: GModelElement, position: Point): Point {
        const snapped = super.snapPosition(element, position);
        if (!isBoundsAware(element) || element.type !== 'ecore:instance') {
            return snapped;
        }

        const parent = (element as any).parent;
        const config = parent?.shapeConfig as BindingShape | undefined;
        if (!parent || parent.type !== 'ecore:instance' || !config) {
            return snapped;
        }

        const parentWidth = Number(parent.bounds?.width) || config.width;
        const parentHeight = Number(parent.bounds?.height) || config.height;
        const targets: BindingShape[] = [];
        if (config.type === 'composite') {
            (config.components ?? []).forEach(component => {
                if (this.getEffectiveChildBinding(component, true) !== 'none') {
                    targets.push(component);
                }
            });
        } else if (this.getEffectiveChildBinding(config, false) !== 'none') {
            targets.push({ ...config, x: 0, y: 0, width: parentWidth, height: parentHeight, rotation: 0 });
        }

        const size = { width: element.bounds.width, height: element.bounds.height };
        const candidates: Point[] = [];
        for (const target of targets) {
            const mode = this.getEffectiveChildBinding(target, config.type === 'composite');
            if (mode === 'inside' || mode === 'both') {
                candidates.push(this.constrainInsideShape(snapped, size, target));
            }
            if (mode === 'on' || mode === 'both') {
                candidates.push(this.constrainOnShape(snapped, size, target));
            }
        }

        return candidates.reduce((closest, candidate) =>
            this.distanceSquared(candidate, snapped) < this.distanceSquared(closest, snapped) ? candidate : closest,
            candidates[0] ?? snapped
        );
    }

    private getEffectiveChildBinding(config: Pick<BindingShape, 'type' | 'childBinding'>, isSubcomponent: boolean): ChildBindingMode {
        if (config.type === 'line') {
            return config.childBinding === 'none' ? 'none' : 'on';
        }
        if (config.childBinding === 'none' || config.childBinding === 'inside' ||
            config.childBinding === 'on' || config.childBinding === 'both') {
            return config.childBinding;
        }
        return isSubcomponent ? 'none' : 'inside';
    }

    private constrainInsideShape(position: Point, size: { width: number; height: number }, shape: BindingShape): Point {
        const center = this.shapeCenter(shape);
        const proposedCenter = { x: position.x + size.width / 2, y: position.y + size.height / 2 };
        const local = this.rotatePoint(proposedCenter, center, -(shape.rotation ?? 0));

        if (shape.type === 'circle') {
            const radius = Math.max(0.5, Math.min(shape.width, shape.height) / 2 - (Math.min(shape.width, shape.height) < 30 ? 0 : 10));
            const allowedRadius = Math.max(0, radius - Math.max(size.width, size.height) / 2);
            const dx = local.x - center.x;
            const dy = local.y - center.y;
            const length = Math.hypot(dx, dy);
            const bounded = length > allowedRadius && length > 0
                ? { x: center.x + dx / length * allowedRadius, y: center.y + dy / length * allowedRadius }
                : local;
            const world = this.rotatePoint(bounded, center, shape.rotation ?? 0);
            return { x: world.x - size.width / 2, y: world.y - size.height / 2 };
        }

        const halfWidth = Math.max(0, shape.width / 2 - size.width / 2);
        const halfHeight = Math.max(0, shape.height / 2 - size.height / 2);
        const bounded = {
            x: Math.min(Math.max(local.x, center.x - halfWidth), center.x + halfWidth),
            y: Math.min(Math.max(local.y, center.y - halfHeight), center.y + halfHeight)
        };
        const world = this.rotatePoint(bounded, center, shape.rotation ?? 0);
        return { x: world.x - size.width / 2, y: world.y - size.height / 2 };
    }

    private constrainOnShape(position: Point, size: { width: number; height: number }, shape: BindingShape): Point {
        const center = this.shapeCenter(shape);
        const proposedCenter = { x: position.x + size.width / 2, y: position.y + size.height / 2 };
        const local = this.rotatePoint(proposedCenter, center, -(shape.rotation ?? 0));
        let edgePoint: Point;

        if (shape.type === 'line') {
            edgePoint = {
                x: Math.min(Math.max(local.x, center.x - shape.width / 2), center.x + shape.width / 2),
                y: center.y
            };
        } else if (shape.type === 'circle') {
            const radius = Math.max(0.5, Math.min(shape.width, shape.height) / 2 - (Math.min(shape.width, shape.height) < 30 ? 0 : 10));
            const dx = local.x - center.x;
            const dy = local.y - center.y;
            const length = Math.hypot(dx, dy);
            edgePoint = length > 0
                ? { x: center.x + dx / length * radius, y: center.y + dy / length * radius }
                : { x: center.x + radius, y: center.y };
        } else {
            const halfWidth = shape.width / 2;
            const halfHeight = shape.height / 2;
            const boundedX = Math.min(Math.max(local.x, center.x - halfWidth), center.x + halfWidth);
            const boundedY = Math.min(Math.max(local.y, center.y - halfHeight), center.y + halfHeight);
            const distances = [
                { distance: Math.abs(local.x - (center.x - halfWidth)), point: { x: center.x - halfWidth, y: boundedY } },
                { distance: Math.abs(local.x - (center.x + halfWidth)), point: { x: center.x + halfWidth, y: boundedY } },
                { distance: Math.abs(local.y - (center.y - halfHeight)), point: { x: boundedX, y: center.y - halfHeight } },
                { distance: Math.abs(local.y - (center.y + halfHeight)), point: { x: boundedX, y: center.y + halfHeight } }
            ];
            edgePoint = distances.reduce((closest, candidate) => candidate.distance < closest.distance ? candidate : closest).point;
        }

        const world = this.rotatePoint(edgePoint, center, shape.rotation ?? 0);
        return { x: world.x - size.width / 2, y: world.y - size.height / 2 };
    }

    private shapeCenter(shape: BindingShape): Point {
        return { x: shape.x + shape.width / 2, y: shape.y + shape.height / 2 };
    }

    private rotatePoint(point: Point, center: Point, degrees: number): Point {
        if (degrees === 0) return point;
        const radians = degrees * Math.PI / 180;
        const cos = Math.cos(radians);
        const sin = Math.sin(radians);
        const dx = point.x - center.x;
        const dy = point.y - center.y;
        return { x: center.x + dx * cos - dy * sin, y: center.y + dx * sin + dy * cos };
    }

    private distanceSquared(a: Point, b: Point): number {
        return (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
    }
}

/**
 * Keeps children of line-based composite instance nodes on their parent's line
 * during client-side drag feedback. The server applies the same constraint when
 * the completed operation arrives.
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

interface LineComponent {
    type?: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    rotation?: number;
}

type LineGeometry = LineComponent & Required<Pick<LineComponent, 'x' | 'y' | 'width' | 'height'>>;

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
        if (!parent || parent.type !== 'ecore:instance') {
            return snapped;
        }

        const lines = ((parent.shapeConfig?.components ?? []) as LineComponent[])
            .filter(component => component.type === 'line')
            .filter(component =>
                Number.isFinite(component.x) &&
                Number.isFinite(component.y) &&
                Number.isFinite(component.width) &&
                Number.isFinite(component.height)
            ) as LineGeometry[];
        if (lines.length === 0) {
            return snapped;
        }

        const line = lines.reduce((longest, candidate) =>
            Math.max(candidate.width!, candidate.height!) > Math.max(longest.width!, longest.height!) ? candidate : longest
        );
        const width = element.bounds.width;
        const height = element.bounds.height;
        const centerX = line.x! + line.width! / 2;
        const centerY = line.y! + line.height! / 2;
        const rotatedQuarterTurn = Math.abs(Math.round((line.rotation ?? 0) / 90)) % 2 === 1;

        if (rotatedQuarterTurn) {
            const halfLength = line.width! / 2;
            return {
                x: centerX - width / 2,
                y: Math.min(Math.max(snapped.y + height / 2, centerY - halfLength), centerY + halfLength) - height / 2
            };
        }

        const halfLength = line.width! / 2;
        return {
            x: Math.min(Math.max(snapped.x + width / 2, centerX - halfLength), centerX + halfLength) - width / 2,
            y: centerY - height / 2
        };
    }
}

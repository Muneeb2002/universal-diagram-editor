/** @jsx svg */
import { GResizeHandle, GResizeHandleView } from '@eclipse-glsp/client';
import { RenderingContext, setAttr, svg } from '@eclipse-glsp/sprotty';
import { injectable } from 'inversify';
import { VNode } from 'snabbdom';

/** Keeps resize handles at a usable screen size regardless of the diagram zoom level. */
@injectable()
export class ZoomIndependentResizeHandleView extends GResizeHandleView {
    override render(handle: GResizeHandle, context: RenderingContext): VNode | undefined {
        if (context.targetKind === 'hidden') {
            return undefined;
        }

        const position = this.getPosition(handle);
        if (!position) {
            return <g />;
        }

        const rootZoom = Number((handle.root as any).zoom);
        const zoom = Number.isFinite(rootZoom) && rootZoom > 0 ? rootZoom : 1;
        const node = (
            <circle
                class-sprotty-resize-handle={true}
                class-mouseover={handle.hoverFeedback}
                cx="0"
                cy="0"
                r={this.getRadius()}
                transform={`translate(${position.x} ${position.y}) scale(${1 / zoom})`}
            />
        );
        setAttr(node, 'data-kind', handle.location);
        return node;
    }
}

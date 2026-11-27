export type ResizeDimension = 'width' | 'height';
export type ComponentBounds = { x: number; y: number; width: number; height: number };

export interface ResizeLinks {
    widthResizeGroup?: string;
    heightResizeGroup?: string;
}

export interface ResizableComponent extends ComponentBounds, ResizeLinks {
    rotation?: number;
}

export const resizeGroupProperty = {
    width: 'widthResizeGroup',
    height: 'heightResizeGroup'
} as const;

export function isQuarterTurn(rotation = 0): boolean {
    return Math.abs(Math.round(rotation / 90)) % 2 === 1;
}

export function getVisualSize(component: ResizableComponent): { width: number; height: number } {
    return isQuarterTurn(component.rotation)
        ? { width: component.height, height: component.width }
        : { width: component.width, height: component.height };
}

export function resizeLinkedComponents(
    components: readonly ResizableComponent[],
    sourceIndex: number,
    dimension: ResizeDimension,
    size: number,
    fromStart = false
): Record<number, ComponentBounds> {
    const property = resizeGroupProperty[dimension];
    const group = components[sourceIndex][property];
    const updates: Record<number, ComponentBounds> = {};
    components.forEach((component, index) => {
        if (index !== sourceIndex && (!group || component[property] !== group)) return;
        const visual = getVisualSize(component);
        const delta = size - visual[dimension];
        const centerShift = (fromStart ? -delta : delta) / 2;
        visual[dimension] = size;
        const rotated = isQuarterTurn(component.rotation);
        const width = rotated ? visual.height : visual.width;
        const height = rotated ? visual.width : visual.height;
        updates[index] = {
            x: component.x + (component.width - width) / 2 + (dimension === 'width' ? centerShift : 0),
            y: component.y + (component.height - height) / 2 + (dimension === 'height' ? centerShift : 0),
            width,
            height
        };
    });
    return updates;
}

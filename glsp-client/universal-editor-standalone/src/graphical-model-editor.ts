/**
 * @author Abigail Sotomayor <s205720@dtu.dk>
 */
import { GLSPActionDispatcher } from '@eclipse-glsp/client';
import { createSaveGraphicalModelAction } from './ecore-client-actions';

export const SUPPORTED_SHAPE_TYPES = ['rectangle', 'circle', 'line', 'arrow', 'custom-svg', 'composite'] as const;
export type SupportedShapeType = typeof SUPPORTED_SHAPE_TYPES[number];

export interface GraphicalElement {
    id: string;
    name: string;
    type: string; 
    x: number;
    y: number;
    width: number;
    height: number;
    resizeHorizontal?: boolean;
    resizeVertical?: boolean;
    color: string;
    fillColor: string;
    filled?: boolean;
    lineThickness: number;
    lineStyle: 'solid' | 'dashed' | 'dotted';
    arrowType?: 'filled-triangle' | 'open-triangle' | 'open-arrow' | 'diamond' | 'none'; // For arrow shapes
    svgContent?: string;
    components?: GraphicalElement[];
    rotation?: number;
    selected?: boolean;
}

export class GraphicalModelEditor {
    private dialog: HTMLElement | null = null;
    private backdrop: HTMLElement | null = null;
    private actionDispatcher: GLSPActionDispatcher | null = null;
    private canvas: HTMLDivElement | null = null;
    private canvasContainer: HTMLDivElement | null = null;
    private palette: HTMLDivElement | null = null;
    private propertiesPanel: HTMLDivElement | null = null;
    private elements: Map<string, GraphicalElement> = new Map();
    private selectedElement: GraphicalElement | null = null;
    private selectedElements: Set<string> = new Set();
    private isCombineMode = false;
    private nextElementId = 1;
    private isDragging = false;
    private dragOffset = { x: 0, y: 0 };
    private draggedElement: GraphicalElement | null = null;
    private zoom = 1;
    private isFullscreen = false;
    private dialogStyleBeforeFullscreen: Partial<CSSStyleDeclaration> | null = null;
    private static readonly MIN_ZOOM = 0.25;
    private static readonly MAX_ZOOM = 4;
    private cachedSavedShapes: Map<string, GraphicalElement> = new Map();
    private static readonly ACTIVE_GRAPHICAL_MODEL_STORAGE_KEY = 'activeGraphicalShapes';

    constructor(actionDispatcher: GLSPActionDispatcher) {
        this.actionDispatcher = actionDispatcher;
    }

    public getActionDispatcher(): GLSPActionDispatcher | null {
        return this.actionDispatcher;
    }

    public getSavedShapes(): Map<string, GraphicalElement> {
        let shapes: Map<string, GraphicalElement>;
        if (this.elements.size > 0) {
            shapes = new Map(this.elements);
        } else {
            if (this.cachedSavedShapes.size === 0) {
                this.loadActiveGraphicalModel();
                if (this.cachedSavedShapes.size === 0) {
                    this.loadShapesFromStorage();
                }
            }
            shapes = new Map(this.cachedSavedShapes);
        }
        
        const normalized = new Map<string, GraphicalElement>();
        shapes.forEach((shape, id) => {
            if (shape.type === 'arrow') {
                const arrowType = shape.arrowType ?? 'filled-triangle';
                normalized.set(id, { ...shape, arrowType });
            } else {
                normalized.set(id, shape);
            }
        });
        return normalized;
    }

    public show(mode: 'create' | 'edit' = 'edit'): void {
        if (mode === 'edit') {
            const shapes = this.loadActiveGraphicalModel() ?? this.loadShapesFromStorage();
            this.elements.clear();
            shapes.forEach(shape => this.elements.set(shape.id, { ...shape, selected: false }));
            this.updateNextElementId();
        } else {
            this.elements.clear();
            this.selectedElement = null;
            this.nextElementId = 1;
        }
        this.createDialog();
        document.body.appendChild(this.backdrop!);
        document.body.appendChild(this.dialog!);
        this.renderAllElements();
    }

    private parseStoredShapes(key: string): GraphicalElement[] {
        try {
            const stored = localStorage.getItem(key);
            if (!stored) return [];
            const data = JSON.parse(stored);
            const shapesArray = data.shapes || data.elements;
            if (!shapesArray || !Array.isArray(shapesArray)) return [];
            const loadedShapes: GraphicalElement[] = [];
            shapesArray.forEach((el: any, index: number) => {
                loadedShapes.push(this.normalizeElement(el, index));
            });
            this.cachedSavedShapes = new Map(loadedShapes.map(shape => [shape.id, shape]));
            return loadedShapes;
        } catch (error) {
            console.warn('Error loading shapes from storage:', error);
            return [];
        }
    }

    private loadActiveGraphicalModel(): GraphicalElement[] | null {
        const shapes = this.parseStoredShapes(GraphicalModelEditor.ACTIVE_GRAPHICAL_MODEL_STORAGE_KEY);
        return shapes.length > 0 ? shapes : null;
    }

    private loadShapesFromStorage(): GraphicalElement[] {
        return this.parseStoredShapes('savedGraphicalShapes');
    }

    private setActiveGraphicalModel(): void {
        const elementsArray = Array.from(this.elements.values()).map(el => {
            const { selected, ...rest } = el;
            return rest;
        });
        const data = {
            version: '1.0',
            type: 'graphical-shapes',
            shapes: elementsArray,
            savedAt: new Date().toISOString()
        };
        try {
            localStorage.setItem(GraphicalModelEditor.ACTIVE_GRAPHICAL_MODEL_STORAGE_KEY, JSON.stringify(data));
        } catch (error) {
            console.warn('Error saving active graphical model to storage:', error);
        }
    }

    private createDialog(): void {
        this.zoom = 1;
        this.isFullscreen = false;
        this.dialogStyleBeforeFullscreen = null;
        this.backdrop = document.createElement('div');
        this.backdrop.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            z-index: 1000;
        `;
        this.backdrop.addEventListener('click', () => this.hide());

        this.dialog = document.createElement('div');
        this.dialog.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            z-index: 1001;
            width: 95%;
            height: 90vh;
            max-width: 1400px;
            display: flex;
            flex-direction: column;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;

        this.dialog.innerHTML = `
            <div id="graphicalEditorTitleBar" style="padding: 20px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; cursor: move; user-select: none;">
                <h2 style="margin: 0; color: #333; font-size: 24px;">Graphical Model Editor</h2>
                <div style="display: flex; align-items: center; gap: 6px;">
                    <button id="fullscreenGraphicalEditor" type="button" title="Enter fullscreen" aria-label="Enter fullscreen" style="background: none; border: none; width: 34px; height: 34px; font-size: 22px; line-height: 1; cursor: pointer; color: #666;">⛶</button>
                    <button id="closeGraphicalEditor" type="button" title="Close" aria-label="Close" style="background: none; border: none; width: 34px; height: 34px; font-size: 24px; line-height: 1; cursor: pointer; color: #666;">&times;</button>
                </div>
            </div>
            <div style="flex: 1; display: flex; overflow: hidden;">
                <div id="paletteContainer" style="width: 200px; border-right: 1px solid #eee; padding: 15px; overflow-y: auto; background: #f8f9fa;">
                    <h3 style="margin: 0 0 15px 0; font-size: 16px; color: #333;">Shape Palette</h3>
                    <div id="shapePalette" style="display: flex; flex-direction: column; gap: 10px;"></div>
                </div>
                <div style="flex: 1; position: relative; overflow: hidden;">
                    <div id="canvasContainer" style="width: 100%; height: 100%; position: relative; overflow: auto; background: #fafafa; background-image:
                        linear-gradient(rgba(0,0,0,.05) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(0,0,0,.05) 1px, transparent 1px);
                        background-size: 20px 20px;">
                        <div id="graphicalCanvas" style="position: relative; width: 100%; height: 100%; transform-origin: 0 0;"></div>
                    </div>
                    <div style="position: absolute; right: 14px; top: 14px; z-index: 20; display: flex; align-items: center; background: white; border: 1px solid #ccc; border-radius: 6px; box-shadow: 0 2px 7px rgba(0,0,0,.18); overflow: hidden;">
                        <button id="graphicalZoomOut" type="button" title="Zoom out" style="width: 36px; height: 34px; border: none; background: white; cursor: pointer; font-size: 20px;">−</button>
                        <button id="graphicalZoomReset" type="button" title="Reset zoom" style="min-width: 58px; height: 34px; padding: 0 8px; border: none; border-left: 1px solid #ddd; border-right: 1px solid #ddd; background: white; cursor: pointer; font-size: 12px;">100%</button>
                        <button id="graphicalZoomIn" type="button" title="Zoom in" style="width: 36px; height: 34px; border: none; background: white; cursor: pointer; font-size: 20px;">+</button>
                    </div>
                </div>
                <div id="propertiesContainer" style="width: 300px; border-left: 1px solid #eee; padding: 15px; overflow-y: auto; background: #f8f9fa;">
                    <h3 style="margin: 0 0 15px 0; font-size: 16px; color: #333;">Properties</h3>
                    <div id="propertiesPanel" style="color: #666; font-size: 14px;">Select an element to edit its properties</div>
                </div>
            </div>
            <div style="padding: 15px; border-top: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; gap: 10px; align-items: center;">
                    <button id="enterCombineMode" style="
                        background: #007bff;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: 500;
                    ">Combine Shapes</button>
                    <button id="exitCombineMode" style="
                        background: #dc3545;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: 500;
                        display: none;
                    ">Cancel Combine</button>
                    <button id="combineSelected" style="
                        background: #007bff;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: 500;
                        display: none;
                    ">Combine Selected (0)</button>
                    <div id="selectionInfo" style="
                        padding: 10px 15px;
                        background: #e7f3ff;
                        border: 1px solid #b3d9ff;
                        border-radius: 4px;
                        font-size: 14px;
                        color: #0066cc;
                        display: none;
                    ">Click on shapes to select them for combining</div>
                </div>
                <div style="display: flex; gap: 10px;">
                    <button id="applyGraphicalModel" style="
                        background: #007acc;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 14px;
                    ">Apply Graphical Model</button>
                    <button id="saveGraphicalModel" style="
                        background: #007acc;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: 500;
                    ">Save Graphical Model</button>
                    <button id="loadGraphicalModel" style="
                        background: #007acc;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 14px;
                    ">Load Graphical Model</button>
                    <button id="clearCanvas" style="
                        background: #007acc;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 14px;
                    ">Clear Canvas</button>
                </div>
            </div>
            <div id="graphicalEditorResizeHandle" title="Drag to resize the editor" style="
                position: absolute;
                right: 2px;
                bottom: 2px;
                width: 18px;
                height: 18px;
                cursor: nwse-resize;
                z-index: 50;
                background: linear-gradient(135deg, transparent 0 45%, #9aa0a6 46% 54%, transparent 55% 65%, #9aa0a6 66% 74%, transparent 75%);
            "></div>
        `;

        this.palette = this.dialog.querySelector('#shapePalette') as HTMLDivElement;
        this.canvasContainer = this.dialog.querySelector('#canvasContainer') as HTMLDivElement;
        this.canvas = this.dialog.querySelector('#graphicalCanvas') as HTMLDivElement;
        this.propertiesPanel = this.dialog.querySelector('#propertiesPanel') as HTMLDivElement;

        this.setupPalette();
        this.setupCanvas();
        this.setupEventListeners();
    }

    private setupPalette(): void {
        if (!this.palette) return;

        const shapes = [
            { type: 'rectangle', label: 'Rectangle', icon: '▭' },
            { type: 'circle', label: 'Circle', icon: '○' },
            { type: 'arrow', label: 'Arrow', icon: '→' },
            { type: 'line', label: 'Line', icon: '—' }
        ];

        shapes.forEach(shape => {
            const item = document.createElement('div');
            item.style.cssText = `
                padding: 12px;
                background: white;
                border: 2px solid #ddd;
                border-radius: 6px;
                cursor: grab;
                text-align: center;
                user-select: none;
                transition: all 0.2s;
            `;
            item.innerHTML = `
                <div style="font-size: 32px; margin-bottom: 8px;">${shape.icon}</div>
                <div style="font-size: 12px; color: #666;">${shape.label}</div>
            `;
            item.draggable = true;
            item.dataset.shapeType = shape.type;

            item.addEventListener('dragstart', (e) => {
                e.dataTransfer!.effectAllowed = 'copy';
                e.dataTransfer!.setData('shapeType', shape.type);
                item.style.opacity = '0.5';
            });

            item.addEventListener('dragend', () => {
                item.style.opacity = '1';
            });

            item.addEventListener('mouseenter', () => {
                item.style.borderColor = '#007bff';
                item.style.transform = 'scale(1.05)';
            });

            item.addEventListener('mouseleave', () => {
                item.style.borderColor = '#ddd';
                item.style.transform = 'scale(1)';
            });

            this.palette!.appendChild(item);
        });

        // Add Upload Custom SVG button
        const uploadButton = document.createElement('button');
        uploadButton.textContent = 'Upload Custom SVG';
        uploadButton.style.cssText = `
            width: 100%;
            padding: 12px;
            margin-top: 15px;
            background: #007acc;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: background 0.2s;
        `;
        uploadButton.addEventListener('mouseenter', () => {
            uploadButton.style.background = '#005fa3';
        });
        uploadButton.addEventListener('mouseleave', () => {
            uploadButton.style.background = '#007acc';
        });
        uploadButton.addEventListener('click', () => this.handleSvgUpload());
        this.palette!.appendChild(uploadButton);
    }

    private setupCanvas(): void {
        if (!this.canvas || !this.canvasContainer || !this.dialog) return;

        const zoomIn = this.dialog.querySelector('#graphicalZoomIn') as HTMLButtonElement;
        const zoomOut = this.dialog.querySelector('#graphicalZoomOut') as HTMLButtonElement;
        const zoomReset = this.dialog.querySelector('#graphicalZoomReset') as HTMLButtonElement;
        zoomIn.addEventListener('click', () => this.setZoom(this.zoom * 1.2));
        zoomOut.addEventListener('click', () => this.setZoom(this.zoom / 1.2));
        zoomReset.addEventListener('click', () => this.setZoom(1));

        this.canvasContainer.addEventListener('wheel', event => {
            if (!event.ctrlKey) return;
            event.preventDefault();
            const factor = event.deltaY < 0 ? 1.15 : 1 / 1.15;
            this.setZoom(this.zoom * factor, { x: event.clientX, y: event.clientY });
        }, { passive: false });

        this.canvas.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer!.dropEffect = 'copy';
        });

        this.canvas.addEventListener('drop', (e) => {
            e.preventDefault();
            const shapeType = e.dataTransfer!.getData('shapeType');
            if (shapeType) {
                const rect = this.canvas!.getBoundingClientRect();
                const x = (e.clientX - rect.left) / this.zoom;
                const y = (e.clientY - rect.top) / this.zoom;
                this.createElement(shapeType, x, y);
            }
        });

        this.canvas.addEventListener('click', (e) => {
            if (e.target === this.canvas && !this.isCombineMode) {
                this.deselectElement();
            }
        });
    }

    private setZoom(requestedZoom: number, anchor?: { x: number; y: number }): void {
        if (!this.canvas || !this.canvasContainer || !this.dialog) return;

        const nextZoom = Math.min(GraphicalModelEditor.MAX_ZOOM, Math.max(GraphicalModelEditor.MIN_ZOOM, requestedZoom));
        if (Math.abs(nextZoom - this.zoom) < 0.001) return;

        const containerRect = this.canvasContainer.getBoundingClientRect();
        const screenX = anchor ? anchor.x - containerRect.left : this.canvasContainer.clientWidth / 2;
        const screenY = anchor ? anchor.y - containerRect.top : this.canvasContainer.clientHeight / 2;
        const logicalX = (this.canvasContainer.scrollLeft + screenX) / this.zoom;
        const logicalY = (this.canvasContainer.scrollTop + screenY) / this.zoom;

        this.zoom = nextZoom;
        this.canvas.style.transform = `scale(${this.zoom})`;
        this.canvas.style.width = `${100 / this.zoom}%`;
        this.canvas.style.height = `${100 / this.zoom}%`;
        this.canvasContainer.style.backgroundSize = `${20 * this.zoom}px ${20 * this.zoom}px`;

        this.canvasContainer.scrollLeft = logicalX * this.zoom - screenX;
        this.canvasContainer.scrollTop = logicalY * this.zoom - screenY;

        const zoomReset = this.dialog.querySelector('#graphicalZoomReset') as HTMLButtonElement | null;
        if (zoomReset) {
            zoomReset.textContent = `${Math.round(this.zoom * 100)}%`;
        }
    }

    private createElement(type: string, x: number, y: number, svgContent?: string, width?: number, height?: number): void {
        const normalizedType = SUPPORTED_SHAPE_TYPES.includes(type as any) ? type : 'rectangle';
        const isLine = normalizedType === 'line';
        const element: GraphicalElement = {
            id: `element_${this.nextElementId++}`,
            name: `Element ${this.nextElementId - 1}`,
            type: normalizedType,
            x,
            y,
            width: width ?? (isLine ? 120 : 100),
            height: height ?? (isLine ? 8 : 80),
            resizeHorizontal: true,
            resizeVertical: true,
            color: '#333333',
            fillColor: '#E3F2FD',
            filled: false,
            lineThickness: 2,
            lineStyle: 'solid',
            arrowType: normalizedType === 'arrow' ? 'filled-triangle' : undefined,
            svgContent: normalizedType === 'custom-svg' ? svgContent : undefined,
            rotation: 0
        };

        this.elements.set(element.id, element);
        this.renderElement(element);
        this.selectElement(element);
    }

    private renderElement(element: GraphicalElement): void {
        if (!this.canvas) return;

        let existingElement = document.getElementById(element.id);
        if (existingElement) {
            existingElement.remove();
        }

        const elementDiv = document.createElement('div');
        elementDiv.id = element.id;
        const isRectangle = element.type === 'rectangle';
        const isCustomSvg = element.type === 'custom-svg';
        const shouldShowBackground = isRectangle && element.filled !== false;
        elementDiv.style.cssText = `
            position: absolute;
            left: ${element.x}px;
            top: ${element.y}px;
            width: ${element.width}px;
            height: ${element.height}px;
            border: ${isRectangle ? `${element.lineThickness}px ${element.lineStyle} ${element.color}` : 'none'};
            background: ${shouldShowBackground ? element.fillColor : 'transparent'};
            cursor: move;
            display: ${isCustomSvg ? 'block' : 'flex'};
            align-items: ${isCustomSvg ? 'stretch' : 'center'};
            justify-content: ${isCustomSvg ? 'flex-start' : 'center'};
            font-size: 12px;
            color: ${element.color};
            font-weight: 500;
            user-select: none;
            overflow: ${isCustomSvg ? 'visible' : 'hidden'};
            transform-origin: 50% 50%;
            transform: rotate(${element.rotation ?? 0}deg);
            ${element.selected ? 'box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.5);' : ''}
        `;

        this.drawShape(elementDiv, element);

       

        let mouseDownTime = 0;
        let mouseDownX = 0;
        let mouseDownY = 0;
        let hasMoved = false;
        const DRAG_THRESHOLD = 5;
        const CLICK_TIME_THRESHOLD = 300;

        elementDiv.addEventListener('mousedown', (e) => {
            if (e.target === elementDiv || elementDiv.contains(e.target as Node)) {
                mouseDownTime = Date.now();
                mouseDownX = e.clientX;
                mouseDownY = e.clientY;
                hasMoved = false;

                if (this.isCombineMode) {
                } else {
                    this.clearMultiSelect();
                    this.selectElement(element);
                }
                
                this.startDrag(e, element);
            }
        });

        elementDiv.addEventListener('mousemove', (e) => {
            if (mouseDownTime > 0) {
                const distance = Math.sqrt(
                    Math.pow(e.clientX - mouseDownX, 2) + 
                    Math.pow(e.clientY - mouseDownY, 2)
                );
                if (distance > DRAG_THRESHOLD) {
                    hasMoved = true;
                }
            }
        }, { passive: true });

        elementDiv.addEventListener('click', (e) => {
            e.stopPropagation();
            const timeSinceMouseDown = Date.now() - mouseDownTime;
            
            if (this.isCombineMode && !hasMoved && timeSinceMouseDown < CLICK_TIME_THRESHOLD) {
                this.toggleElementSelection(element);
                this.updateSelectionUI();
            }
            
            mouseDownTime = 0;
            hasMoved = false;
        });

        this.canvas.appendChild(elementDiv);
    }

    private drawShape(container: HTMLElement, element: GraphicalElement): void {
        if (element.type === 'composite' && element.components) {
            this.drawCompositeShape(container, element.components);
            return;
        }
        if (element.type === 'custom-svg' && element.svgContent) {
            this.drawCustomSvg(container, element);
            return;
        }

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '100%');
        svg.style.position = 'absolute';
        svg.style.top = '0';
        svg.style.left = '0';
        svg.style.pointerEvents = 'none';

        if (element.type === 'arrow') {
            this.drawArrowShape(svg, element);
            container.appendChild(svg);
            return;
        }
        if (element.type === 'line') {
            this.drawLineShape(svg, element);
            container.appendChild(svg);
            return;
        }

        const shape = document.createElementNS('http://www.w3.org/2000/svg', element.type === 'circle' ? 'circle' : 'rect');

        const width = element.width;
        const height = element.height;
        const cx = width / 2;
        const cy = height / 2;

        shape.setAttribute('fill', (element.filled !== false) ? element.fillColor : 'none');
        shape.setAttribute('stroke', element.color);
        shape.setAttribute('stroke-width', element.lineThickness.toString());
        shape.setAttribute('stroke-dasharray', element.lineStyle === 'dashed' ? '5,5' : element.lineStyle === 'dotted' ? '2,2' : 'none');

        switch (element.type) {
            case 'circle':
                (shape as SVGCircleElement).setAttribute('cx', cx.toString());
                (shape as SVGCircleElement).setAttribute('cy', cy.toString());
                (shape as SVGCircleElement).setAttribute('r', Math.min(width, height) / 2 - element.lineThickness + '');
                break;
            case 'rectangle':
            default:
                (shape as SVGRectElement).setAttribute('x', '0');
                (shape as SVGRectElement).setAttribute('y', '0');
                (shape as SVGRectElement).setAttribute('width', width.toString());
                (shape as SVGRectElement).setAttribute('height', height.toString());
                break;
        }

        svg.appendChild(shape);
        container.appendChild(svg);
    }

    private drawCompositeShape(container: HTMLElement, components: GraphicalElement[]): void {
        components.forEach(component => {
            const child = document.createElement('div');
            child.style.cssText = `
                position: absolute;
                left: ${component.x}px;
                top: ${component.y}px;
                width: ${component.width}px;
                height: ${component.height}px;
                transform-origin: 50% 50%;
                transform: rotate(${component.rotation ?? 0}deg);
                pointer-events: none;
                overflow: visible;
            `;
            this.drawShape(child, component);
            container.appendChild(child);
        });
    }

    private drawLineShape(svg: SVGSVGElement, element: GraphicalElement): void {
        const width = element.width;
        const height = element.height;
        const cy = height / 2;
        const margin = Math.max(element.lineThickness, 4);
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', margin.toString());
        line.setAttribute('y1', cy.toString());
        line.setAttribute('x2', (width - margin).toString());
        line.setAttribute('y2', cy.toString());
        line.setAttribute('stroke', element.color);
        line.setAttribute('stroke-width', element.lineThickness.toString());
        line.setAttribute('fill', 'none');
        const dashArray = element.lineStyle === 'dashed' ? '5,5' : element.lineStyle === 'dotted' ? '2,2' : 'none';
        if (dashArray !== 'none') {
            line.setAttribute('stroke-dasharray', dashArray);
        }
        line.setAttribute('pointer-events', 'none');
        svg.appendChild(line);
    }

    private drawArrowShape(svg: SVGSVGElement, element: GraphicalElement): void {
        const strokeColor = element.color;
        const fillColor = element.fillColor;
        const filled = element.filled !== false;
        const strokeWidth = element.lineThickness;
        const dashArray = element.lineStyle === 'dashed' ? '5,5' : element.lineStyle === 'dotted' ? '2,2' : 'none';
        const arrowType = element.arrowType ?? 'filled-triangle';
        const width = element.width;
        const height = element.height;
        const cy = height / 2;
        const margin = Math.max(strokeWidth, 6);
        const headLength = Math.min(width * 0.35, 50);
        const headHalfHeight = Math.min(height / 2, 30);
        const lineStartX = margin;
        const lineEndX = arrowType === 'none' ? width - margin : width - headLength;

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', lineStartX.toString());
        line.setAttribute('y1', cy.toString());
        line.setAttribute('x2', lineEndX.toString());
        line.setAttribute('y2', cy.toString());
        line.setAttribute('stroke', strokeColor);
        line.setAttribute('stroke-width', strokeWidth.toString());
        line.setAttribute('fill', 'none');
        if (dashArray !== 'none') {
            line.setAttribute('stroke-dasharray', dashArray);
        }
        line.setAttribute('pointer-events', 'none');
        svg.appendChild(line);

        if (arrowType === 'none') {
            return;
        }

        const tipX = width - margin;
        switch (arrowType) {
            case 'open-arrow': {
                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                path.setAttribute('d', `M ${lineEndX},${cy - headHalfHeight} L ${tipX},${cy} M ${lineEndX},${cy + headHalfHeight} L ${tipX},${cy}`);
                path.setAttribute('stroke', strokeColor);
                path.setAttribute('stroke-width', strokeWidth.toString());
                path.setAttribute('fill', 'none');
                if (dashArray !== 'none') {
                    path.setAttribute('stroke-dasharray', dashArray);
                }
                path.setAttribute('pointer-events', 'none');
                path.setAttribute('stroke-linecap', 'round');
                svg.appendChild(path);
                break;
            }
            case 'open-triangle': {
                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                path.setAttribute('d', `M ${lineEndX},${cy - headHalfHeight} L ${tipX},${cy} L ${lineEndX},${cy + headHalfHeight} Z`);
                path.setAttribute('stroke', strokeColor);
                path.setAttribute('stroke-width', strokeWidth.toString());
                path.setAttribute('fill', 'none');
                if (dashArray !== 'none') {
                    path.setAttribute('stroke-dasharray', dashArray);
                }
                path.setAttribute('pointer-events', 'none');
                path.setAttribute('stroke-linejoin', 'round');
                svg.appendChild(path);
                break;
            }
            case 'diamond': {
                const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                const midX = lineEndX + (tipX - lineEndX) / 2;
                polygon.setAttribute('points', `${lineEndX},${cy} ${midX},${cy - headHalfHeight} ${tipX},${cy} ${midX},${cy + headHalfHeight}`);
                polygon.setAttribute('stroke', strokeColor);
                polygon.setAttribute('stroke-width', strokeWidth.toString());
                polygon.setAttribute('fill', filled ? fillColor : 'none');
                if (dashArray !== 'none') {
                    polygon.setAttribute('stroke-dasharray', dashArray);
                }
                polygon.setAttribute('pointer-events', 'none');
                polygon.setAttribute('stroke-linejoin', 'round');
                svg.appendChild(polygon);
                break;
            }
            case 'filled-triangle':
            default: {
                const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                polygon.setAttribute('points', `${lineEndX},${cy - headHalfHeight} ${tipX},${cy} ${lineEndX},${cy + headHalfHeight}`);
                polygon.setAttribute('stroke', strokeColor);
                polygon.setAttribute('stroke-width', strokeWidth.toString());
                polygon.setAttribute('fill', filled ? fillColor : 'none');
                if (dashArray !== 'none') {
                    polygon.setAttribute('stroke-dasharray', dashArray);
                }
                polygon.setAttribute('pointer-events', 'none');
                polygon.setAttribute('stroke-linejoin', 'round');
                svg.appendChild(polygon);
                break;
            }
        }
    }

    private startDrag(e: MouseEvent, element: GraphicalElement): void {
        this.isDragging = true;
        this.draggedElement = element;
        const rect = this.canvas!.getBoundingClientRect();
        this.dragOffset = {
            x: (e.clientX - rect.left) / this.zoom - element.x,
            y: (e.clientY - rect.top) / this.zoom - element.y
        };

        const onMouseMove = (moveEvent: MouseEvent) => {
            if (this.isDragging && this.draggedElement) {
                const canvasRect = this.canvas!.getBoundingClientRect();
                const newX = (moveEvent.clientX - canvasRect.left) / this.zoom - this.dragOffset.x;
                const newY = (moveEvent.clientY - canvasRect.top) / this.zoom - this.dragOffset.y;
                this.draggedElement.x = Math.max(0, newX);
                this.draggedElement.y = Math.max(0, newY);
                this.renderElement(this.draggedElement);
            }
        };

        const onMouseUp = () => {
            this.isDragging = false;
            this.draggedElement = null;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }

    private selectElement(element: GraphicalElement): void {
        if (this.selectedElement) {
            this.selectedElement.selected = false;
            this.renderElement(this.selectedElement);
        }

        this.selectedElement = element;
        element.selected = true;
        this.renderElement(element);
        this.updatePropertiesPanel();
        this.updateSelectionUI();
    }

    private toggleElementSelection(element: GraphicalElement): void {
        if (this.selectedElements.has(element.id)) {
            this.selectedElements.delete(element.id);
            element.selected = false;
            this.renderElement(element);
        } else {
            this.selectedElements.add(element.id);
            element.selected = true;
            this.renderElement(element);
        }
        
        if (this.selectedElements.size === 1) {
            const selectedId = Array.from(this.selectedElements)[0];
            this.selectedElement = this.elements.get(selectedId) || null;
        } else {
            this.selectedElement = null;
        }
        
        this.updatePropertiesPanel();
        this.updateSelectionUI();
    }

    private clearMultiSelect(): void {
        this.selectedElements.forEach(id => {
            const element = this.elements.get(id);
            if (element) {
                element.selected = false;
                this.renderElement(element);
            }
        });
        this.selectedElements.clear();
        this.updateSelectionUI();
    }

    private deselectElement(): void {
        if (this.selectedElement) {
            this.selectedElement.selected = false;
            this.renderElement(this.selectedElement);
            this.selectedElement = null;
        }
        this.clearMultiSelect();
        this.updatePropertiesPanel();
    }

    private updateSelectionUI(): void {
        const combineSelectedBtn = this.dialog?.querySelector('#combineSelected') as HTMLButtonElement;
        const selectionInfo = this.dialog?.querySelector('#selectionInfo') as HTMLDivElement;
        
        if (!combineSelectedBtn || !selectionInfo) return;

        const count = this.selectedElements.size;
        if (this.isCombineMode) {
            selectionInfo.style.display = 'block';
            if (count >= 2) {
                combineSelectedBtn.style.display = 'block';
                combineSelectedBtn.textContent = `Combine Selected (${count})`;
                selectionInfo.textContent = `${count} shapes selected. Click "Combine Selected" to group them as editable subcomponents.`;
            } else {
                combineSelectedBtn.style.display = 'none';
                selectionInfo.textContent = count === 1 
                    ? '1 shape selected. Select at least one more to combine.'
                    : 'Click on shapes to select them for combining.';
            }
        } else {
            combineSelectedBtn.style.display = 'none';
            selectionInfo.style.display = 'none';
        }
    }

    private enterCombineMode(): void {
        this.isCombineMode = true;
        this.clearMultiSelect();
        this.deselectElement();
        
        const enterBtn = this.dialog?.querySelector('#enterCombineMode') as HTMLButtonElement;
        const exitBtn = this.dialog?.querySelector('#exitCombineMode') as HTMLButtonElement;
        
        if (enterBtn) enterBtn.style.display = 'none';
        if (exitBtn) exitBtn.style.display = 'block';
        
        this.updateSelectionUI();
    }

    private exitCombineMode(): void {
        this.isCombineMode = false;
        this.clearMultiSelect();
        
        const enterBtn = this.dialog?.querySelector('#enterCombineMode') as HTMLButtonElement;
        const exitBtn = this.dialog?.querySelector('#exitCombineMode') as HTMLButtonElement;
        
        if (enterBtn) enterBtn.style.display = 'block';
        if (exitBtn) exitBtn.style.display = 'none';
        
        this.updateSelectionUI();
    }

    private combineSelectedElements(): void {
        if (this.selectedElements.size < 2) {
            alert('Please select at least 2 elements to combine');
            return;
        }

        const elementsToCombine: GraphicalElement[] = [];
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        this.selectedElements.forEach(id => {
            const element = this.elements.get(id);
            if (element) {
                elementsToCombine.push(element);
                const bounds = this.getComponentVisualBounds(element);
                minX = Math.min(minX, bounds.left);
                minY = Math.min(minY, bounds.top);
                maxX = Math.max(maxX, bounds.right);
                maxY = Math.max(maxY, bounds.bottom);
            }
        });

        if (elementsToCombine.length < 2) {
            alert('Could not find all selected elements');
            return;
        }

        const combinedWidth = maxX - minX;
        const combinedHeight = maxY - minY;
        const components = elementsToCombine.map(element => {
            const isDefaultLineResize = element.type === 'line'
                && element.resizeHorizontal !== false
                && element.resizeVertical !== false;
            return {
                ...element,
                x: element.x - minX,
                y: element.y - minY,
                resizeHorizontal: isDefaultLineResize ? !this.isQuarterTurn(element.rotation) : element.resizeHorizontal,
                resizeVertical: isDefaultLineResize ? this.isQuarterTurn(element.rotation) : element.resizeVertical,
                selected: false,
                components: element.components?.map(component => ({ ...component }))
            };
        });

        // Create new combined element
        const combinedElement: GraphicalElement = {
            id: `element_${this.nextElementId++}`,
            name: `Combined Shape`,
            type: 'composite',
            x: minX,
            y: minY,
            width: combinedWidth,
            height: combinedHeight,
            resizeHorizontal: true,
            resizeVertical: true,
            color: '#333333',
            fillColor: 'transparent',
            filled: false,
            lineThickness: 2,
            lineStyle: 'solid',
            components,
            rotation: 0
        };

        // Remove old elements and add combined one
        this.selectedElements.forEach(id => {
            this.elements.delete(id);
            const element = document.getElementById(id);
            if (element) element.remove();
        });
        this.selectedElements.clear();
        this.selectedElement = null;

        // Add and render combined element
        this.elements.set(combinedElement.id, combinedElement);
        this.renderElement(combinedElement);
        this.selectElement(combinedElement);
        this.updateSelectionUI();
        
        // Exit combine mode after combining
        this.exitCombineMode();
    }

    private updatePropertiesPanel(): void {
        if (!this.propertiesPanel) return;

        if (!this.selectedElement) {
            this.propertiesPanel.innerHTML = '<div style="color: #666; font-size: 14px;">Select an element to edit its properties</div>';
            return;
        }

        const element = this.selectedElement;
        this.propertiesPanel.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 15px;">
                <div>
                    <label style="display: block; margin-bottom: 5px; font-weight: 500; color: #555;">Name:</label>
                    <input type="text" id="propName" value="${element.name}" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
                </div>
                <div>
                    <label style="display: block; margin-bottom: 5px; font-weight: 500; color: #555;">Shape Type:</label>
                    <input type="text" value="${element.type === 'custom-svg' ? 'Custom SVG' : element.type}" disabled style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; background: #f5f5f5;">
                </div>
                <div>
                    <label style="display: block; margin-bottom: 5px; font-weight: 500; color: #555;">Default Width:</label>
                    <input type="number" id="propWidth" value="${element.width}" min="20" max="500" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
                </div>
                <div>
                    <label style="display: block; margin-bottom: 5px; font-weight: 500; color: #555;">Default Height:</label>
                    <input type="number" id="propHeight" value="${element.height}" min="20" max="500" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
                </div>
                <div>
                    <label style="display: block; margin-bottom: 7px; font-weight: 500; color: #555;">Resize in Diagram:</label>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                        <button type="button" id="propResizeHorizontal" aria-pressed="${element.resizeHorizontal !== false}" style="padding: 8px 6px; border: 1px solid ${element.resizeHorizontal !== false ? '#007acc' : '#bbb'}; border-radius: 4px; cursor: pointer; background: ${element.resizeHorizontal !== false ? '#007acc' : '#f5f5f5'}; color: ${element.resizeHorizontal !== false ? 'white' : '#444'}; font-size: 12px;">↔ Horizontal</button>
                        <button type="button" id="propResizeVertical" aria-pressed="${element.resizeVertical !== false}" style="padding: 8px 6px; border: 1px solid ${element.resizeVertical !== false ? '#007acc' : '#bbb'}; border-radius: 4px; cursor: pointer; background: ${element.resizeVertical !== false ? '#007acc' : '#f5f5f5'}; color: ${element.resizeVertical !== false ? 'white' : '#444'}; font-size: 12px;">↕ Vertical</button>
                    </div>
                    <div style="margin-top: 6px; color: #777; font-size: 11px; line-height: 1.35;">Enabled directions show drag handles when an instance is selected.</div>
                </div>
                <div>
                    <label style="display: block; margin-bottom: 5px; font-weight: 500; color: #555;">Rotation (degrees):</label>
                    <input type="number" id="propRotation" value="${element.rotation ?? 0}" min="0" max="360" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
                </div>
                ${element.type !== 'custom-svg' && element.type !== 'composite' ? `
                <div>
                    <label style="display: block; margin-bottom: 5px; font-weight: 500; color: #555;">Border Color:</label>
                    <input type="color" id="propColor" value="${element.color}" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; height: 40px;">
                </div>
                <div>
                    <label style="display: flex; align-items: center; gap: 8px; font-weight: 500; color: #555;">
                        <input type="checkbox" id="propFilled" ${element.filled !== false ? 'checked' : ''} style="width: 18px; height: 18px; cursor: pointer;">
                        <span>Filled</span>
                    </label>
                </div>
                <div>
                    <label style="display: block; margin-bottom: 5px; font-weight: 500; color: #555;">Fill Color:</label>
                    <input type="color" id="propFillColor" value="${element.fillColor}" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; height: 40px;" ${element.filled === false ? 'disabled' : ''}>
                </div>
                <div>
                    <label style="display: block; margin-bottom: 5px; font-weight: 500; color: #555;">Line Thickness:</label>
                    <input type="number" id="propLineThickness" value="${element.lineThickness}" min="1" max="20" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
                </div>
                <div>
                    <label style="display: block; margin-bottom: 5px; font-weight: 500; color: #555;">Line Style:</label>
                    <select id="propLineStyle" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
                        <option value="solid" ${element.lineStyle === 'solid' ? 'selected' : ''}>Solid</option>
                        <option value="dashed" ${element.lineStyle === 'dashed' ? 'selected' : ''}>Dashed</option>
                        <option value="dotted" ${element.lineStyle === 'dotted' ? 'selected' : ''}>Dotted</option>
                    </select>
                </div>
                ` : `
                <div style="padding: 10px; background: #f0f7ff; border-radius: 4px; color: #0066cc; font-size: 12px;">
                    ${element.type === 'composite' ? 'Composite styling is controlled by its individual subcomponents.' : 'Custom SVG: Original colors are preserved. Only size can be adjusted.'}
                </div>
                `}
                ${element.type === 'arrow' ? `
                <div>
                    <label style="display: block; margin-bottom: 5px; font-weight: 500; color: #555;">Arrow Type:</label>
                    <select id="propArrowType" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
                        <option value="filled-triangle" ${element.arrowType === 'filled-triangle' ? 'selected' : ''}>Filled Triangle</option>
                        <option value="open-triangle" ${element.arrowType === 'open-triangle' ? 'selected' : ''}>Open Triangle</option>
                        <option value="open-arrow" ${element.arrowType === 'open-arrow' ? 'selected' : ''}>Open Arrow (V-shape)</option>
                        <option value="diamond" ${element.arrowType === 'diamond' ? 'selected' : ''}>Diamond</option>
                        <option value="none" ${element.arrowType === 'none' ? 'selected' : ''}>None (Line only)</option>
                    </select>
                </div>
                ` : ''}
                ${element.type === 'composite' ? this.renderCompositeProperties(element) : ''}
                <div>
                    <button id="deleteElement" style="
                        width: 100%;
                        padding: 8px;
                        background: #007acc;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 14px;
                        margin-top: 10px;
                    ">Delete Element</button>
                </div>
            </div>
        `;

        // Setup property change listeners
        const nameInput = this.propertiesPanel.querySelector('#propName') as HTMLInputElement;
        const widthInput = this.propertiesPanel.querySelector('#propWidth') as HTMLInputElement;
        const heightInput = this.propertiesPanel.querySelector('#propHeight') as HTMLInputElement;
        const resizeHorizontalButton = this.propertiesPanel.querySelector('#propResizeHorizontal') as HTMLButtonElement;
        const resizeVerticalButton = this.propertiesPanel.querySelector('#propResizeVertical') as HTMLButtonElement;
        const rotationInput = this.propertiesPanel.querySelector('#propRotation') as HTMLInputElement | null;
        const colorInput = this.propertiesPanel.querySelector('#propColor') as HTMLInputElement | null;
        const filledCheckbox = this.propertiesPanel.querySelector('#propFilled') as HTMLInputElement | null;
        const fillColorInput = this.propertiesPanel.querySelector('#propFillColor') as HTMLInputElement | null;
        const lineThicknessInput = this.propertiesPanel.querySelector('#propLineThickness') as HTMLInputElement | null;
        const lineStyleSelect = this.propertiesPanel.querySelector('#propLineStyle') as HTMLSelectElement | null;
        const arrowTypeSelect = this.propertiesPanel.querySelector('#propArrowType') as HTMLSelectElement | null;
        const deleteBtn = this.propertiesPanel.querySelector('#deleteElement') as HTMLButtonElement;

        const updateResizeButton = (button: HTMLButtonElement, enabled: boolean): void => {
            button.setAttribute('aria-pressed', String(enabled));
            button.style.background = enabled ? '#007acc' : '#f5f5f5';
            button.style.color = enabled ? 'white' : '#444';
            button.style.borderColor = enabled ? '#007acc' : '#bbb';
        };

        const updateElement = () => {
            if (!this.selectedElement) return;
            this.selectedElement.name = nameInput.value;
            this.selectedElement.width = parseInt(widthInput.value) || 100;
            this.selectedElement.height = parseInt(heightInput.value) || 80;
            if (rotationInput) {
                this.selectedElement.rotation = Math.min(360, Math.max(0, parseInt(rotationInput.value, 10) || 0));
            }
            
            // Only update color/styling properties for non-custom-SVG elements
            if (this.selectedElement.type !== 'custom-svg') {
                if (colorInput) this.selectedElement.color = colorInput.value;
                if (filledCheckbox) this.selectedElement.filled = filledCheckbox.checked;
                if (fillColorInput) {
                    this.selectedElement.fillColor = fillColorInput.value;
                    if (filledCheckbox) fillColorInput.disabled = !filledCheckbox.checked;
                }
                if (lineThicknessInput) this.selectedElement.lineThickness = parseInt(lineThicknessInput.value) || 2;
                if (lineStyleSelect) this.selectedElement.lineStyle = lineStyleSelect.value as 'solid' | 'dashed' | 'dotted';
            }
            
            if (arrowTypeSelect && this.selectedElement.type === 'arrow') {
                this.selectedElement.arrowType = arrowTypeSelect.value as 'filled-triangle' | 'open-triangle' | 'open-arrow' | 'diamond' | 'none';
            }
            
            this.renderElement(this.selectedElement);
        };

        nameInput.addEventListener('input', updateElement);
        widthInput.addEventListener('input', updateElement);
        heightInput.addEventListener('input', updateElement);
        resizeHorizontalButton.addEventListener('click', () => {
            if (!this.selectedElement) return;
            this.selectedElement.resizeHorizontal = !(this.selectedElement.resizeHorizontal !== false);
            updateResizeButton(resizeHorizontalButton, this.selectedElement.resizeHorizontal);
        });
        resizeVerticalButton.addEventListener('click', () => {
            if (!this.selectedElement) return;
            this.selectedElement.resizeVertical = !(this.selectedElement.resizeVertical !== false);
            updateResizeButton(resizeVerticalButton, this.selectedElement.resizeVertical);
        });
        if (rotationInput) rotationInput.addEventListener('input', updateElement);
        if (colorInput) colorInput.addEventListener('input', updateElement);
        if (filledCheckbox) filledCheckbox.addEventListener('change', updateElement);
        if (fillColorInput) fillColorInput.addEventListener('input', updateElement);
        if (lineThicknessInput) lineThicknessInput.addEventListener('input', updateElement);
        if (lineStyleSelect) lineStyleSelect.addEventListener('change', updateElement);
        if (arrowTypeSelect) {
            arrowTypeSelect.addEventListener('change', updateElement);
        }

        this.setupCompositePropertyListeners(element, widthInput, heightInput);

        deleteBtn.addEventListener('click', () => {
            if (this.selectedElement && this.canvas) {
                const elementId = this.selectedElement.id;
                
                // Clear selection first (before removing from DOM)
                this.selectedElement = null;
                this.selectedElements.delete(elementId);
                if (this.propertiesPanel) {
                    this.propertiesPanel.innerHTML = '<div style="color: #666; font-size: 14px;">Select an element to edit its properties</div>';
                }
                this.updateSelectionUI();
                
                // Find and remove the DOM element from the canvas
                // Iterate through canvas children to find the element
                const children = Array.from(this.canvas.children);
                for (const child of children) {
                    if (child.id === elementId) {
                        child.remove();
                        break;
                    }
                }
                
                // Remove from the elements Map after DOM removal
                this.elements.delete(elementId);
            }
        });
    }

    private renderCompositeProperties(element: GraphicalElement): string {
        const components = element.components ?? [];
        return `
            <div style="border-top: 1px solid #ddd; padding-top: 12px;">
                <div style="font-weight: 600; color: #444; margin-bottom: 9px;">Subcomponents (${components.length})</div>
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    ${components.map((component, index) => {
                        const visualSize = this.getComponentVisualSize(component);
                        return `
                        <div style="padding: 10px; border: 1px solid #d7d7d7; border-radius: 5px; background: white;">
                            <div style="font-weight: 600; color: #333; margin-bottom: 8px;">${component.name || `Component ${index + 1}`} <span style="font-weight: 400; color: #777;">(${component.type})</span></div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 7px;">
                                ${this.renderComponentNumberInput(index, 'x', 'X', component.x, 0)}
                                ${this.renderComponentNumberInput(index, 'y', 'Y', component.y, 0)}
                                ${this.renderComponentNumberInput(index, 'width', 'Width', visualSize.width, 1)}
                                ${this.renderComponentNumberInput(index, 'height', 'Height', visualSize.height, 1)}
                            </div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 7px; margin-top: 8px;">
                                ${this.renderComponentResizeButton(index, 'horizontal', component.resizeHorizontal !== false)}
                                ${this.renderComponentResizeButton(index, 'vertical', component.resizeVertical !== false)}
                            </div>
                        </div>
                    `;}).join('')}
                </div>
            </div>
        `;
    }

    private renderComponentNumberInput(index: number, property: string, label: string, value: number, min: number): string {
        return `<label style="font-size: 11px; color: #666;">${label}
            <input type="number" data-component-index="${index}" data-component-property="${property}" value="${value}" min="${min}" style="box-sizing: border-box; width: 100%; margin-top: 3px; padding: 5px; border: 1px solid #ccc; border-radius: 3px;">
        </label>`;
    }

    private renderComponentResizeButton(index: number, direction: 'horizontal' | 'vertical', enabled: boolean): string {
        const icon = direction === 'horizontal' ? '↔' : '↕';
        const label = direction === 'horizontal' ? 'Horizontal' : 'Vertical';
        return `<button type="button" data-component-resize="${direction}" data-component-index="${index}" aria-pressed="${enabled}" style="padding: 6px 4px; border: 1px solid ${enabled ? '#007acc' : '#bbb'}; border-radius: 3px; cursor: pointer; background: ${enabled ? '#007acc' : '#f5f5f5'}; color: ${enabled ? 'white' : '#444'}; font-size: 11px;">${icon} ${label}</button>`;
    }

    private isQuarterTurn(rotation = 0): boolean {
        return Math.abs(Math.round(rotation / 90)) % 2 === 1;
    }

    private getComponentVisualSize(component: GraphicalElement): { width: number; height: number } {
        return this.isQuarterTurn(component.rotation)
            ? { width: component.height, height: component.width }
            : { width: component.width, height: component.height };
    }

    private getComponentVisualBounds(component: GraphicalElement): { left: number; top: number; right: number; bottom: number } {
        const size = this.getComponentVisualSize(component);
        const centerX = component.x + component.width / 2;
        const centerY = component.y + component.height / 2;
        return {
            left: centerX - size.width / 2,
            top: centerY - size.height / 2,
            right: centerX + size.width / 2,
            bottom: centerY + size.height / 2
        };
    }

    private setupCompositePropertyListeners(element: GraphicalElement, widthInput: HTMLInputElement, heightInput: HTMLInputElement): void {
        if (element.type !== 'composite' || !element.components || !this.propertiesPanel) return;

        const resizeCompositeBounds = (): void => {
            const bounds = element.components!.map(component => this.getComponentVisualBounds(component));
            element.width = Math.max(20, ...bounds.map(bound => bound.right));
            element.height = Math.max(20, ...bounds.map(bound => bound.bottom));
            widthInput.value = String(element.width);
            heightInput.value = String(element.height);
            this.renderElement(element);
        };

        this.propertiesPanel.querySelectorAll<HTMLInputElement>('input[data-component-property]').forEach(input => {
            input.addEventListener('input', () => {
                const index = Number(input.dataset.componentIndex);
                const property = input.dataset.componentProperty as 'x' | 'y' | 'width' | 'height';
                const component = element.components?.[index];
                if (!component || !property) return;
                const minimum = property === 'width' || property === 'height' ? 1 : 0;
                const value = Math.max(minimum, Number(input.value) || minimum);
                if (this.isQuarterTurn(component.rotation) && (property === 'width' || property === 'height')) {
                    component[property === 'width' ? 'height' : 'width'] = value;
                } else {
                    component[property] = value;
                }
                resizeCompositeBounds();
            });
        });

        this.propertiesPanel.querySelectorAll<HTMLButtonElement>('button[data-component-resize]').forEach(button => {
            button.addEventListener('click', () => {
                const index = Number(button.dataset.componentIndex);
                const component = element.components?.[index];
                const direction = button.dataset.componentResize;
                if (!component) return;
                const property = direction === 'horizontal' ? 'resizeHorizontal' : 'resizeVertical';
                component[property] = component[property] === false;
                updateToggleButton(button, component[property] !== false);
            });
        });

        const updateToggleButton = (button: HTMLButtonElement, enabled: boolean): void => {
            button.setAttribute('aria-pressed', String(enabled));
            button.style.background = enabled ? '#007acc' : '#f5f5f5';
            button.style.color = enabled ? 'white' : '#444';
            button.style.borderColor = enabled ? '#007acc' : '#bbb';
        };
    }

    private setupEventListeners(): void {
        const closeBtn = this.dialog!.querySelector('#closeGraphicalEditor');
        const fullscreenBtn = this.dialog!.querySelector('#fullscreenGraphicalEditor');
        const titleBar = this.dialog!.querySelector('#graphicalEditorTitleBar') as HTMLDivElement;
        const applyBtn = this.dialog!.querySelector('#applyGraphicalModel');
        const saveBtn = this.dialog!.querySelector('#saveGraphicalModel');
        const loadBtn = this.dialog!.querySelector('#loadGraphicalModel');
        const clearBtn = this.dialog!.querySelector('#clearCanvas');
        const resizeHandle = this.dialog!.querySelector('#graphicalEditorResizeHandle') as HTMLDivElement;

        closeBtn?.addEventListener('click', () => this.hide());
        fullscreenBtn?.addEventListener('click', () => this.toggleFullscreen());
        titleBar.addEventListener('mousedown', event => this.startDialogMove(event));
        titleBar.addEventListener('dblclick', event => {
            if (!(event.target as HTMLElement).closest('button')) {
                this.toggleFullscreen();
            }
        });

        applyBtn?.addEventListener('click', () => this.applyGraphicalModel());
        saveBtn?.addEventListener('click', () => this.saveGraphicalModel());
        loadBtn?.addEventListener('click', () => this.loadGraphicalModel());
        clearBtn?.addEventListener('click', () => this.clearCanvas());
        resizeHandle.addEventListener('mousedown', event => this.startDialogResize(event));
        
        const enterCombineBtn = this.dialog?.querySelector('#enterCombineMode') as HTMLButtonElement;
        const exitCombineBtn = this.dialog?.querySelector('#exitCombineMode') as HTMLButtonElement;
        const combineSelectedBtn = this.dialog?.querySelector('#combineSelected') as HTMLButtonElement;
        
        enterCombineBtn?.addEventListener('click', () => this.enterCombineMode());
        exitCombineBtn?.addEventListener('click', () => this.exitCombineMode());
        combineSelectedBtn?.addEventListener('click', () => {
            this.combineSelectedElements();
            this.exitCombineMode();
        });
    }

    private startDialogResize(event: MouseEvent): void {
        if (!this.dialog || this.isFullscreen) return;
        event.preventDefault();
        event.stopPropagation();

        const dialog = this.dialog;
        const initialRect = dialog.getBoundingClientRect();
        const startX = event.clientX;
        const startY = event.clientY;

        // Replace the centering transform with fixed pixel coordinates so the top-left
        // corner stays anchored while the lower-right resize handle is dragged.
        dialog.style.left = `${initialRect.left}px`;
        dialog.style.top = `${initialRect.top}px`;
        dialog.style.transform = 'none';
        dialog.style.width = `${initialRect.width}px`;
        dialog.style.height = `${initialRect.height}px`;
        dialog.style.maxWidth = 'none';

        const onMouseMove = (moveEvent: MouseEvent): void => {
            const minWidth = Math.min(900, window.innerWidth - 24);
            const minHeight = Math.min(480, window.innerHeight - 24);
            const availableWidth = Math.max(minWidth, window.innerWidth - initialRect.left - 12);
            const availableHeight = Math.max(minHeight, window.innerHeight - initialRect.top - 12);
            const width = Math.min(availableWidth, Math.max(minWidth, initialRect.width + moveEvent.clientX - startX));
            const height = Math.min(availableHeight, Math.max(minHeight, initialRect.height + moveEvent.clientY - startY));
            dialog.style.width = `${width}px`;
            dialog.style.height = `${height}px`;
        };

        const onMouseUp = (): void => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            document.body.style.userSelect = '';
        };

        document.body.style.userSelect = 'none';
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }

    private startDialogMove(event: MouseEvent): void {
        if (!this.dialog || this.isFullscreen || (event.target as HTMLElement).closest('button')) return;
        event.preventDefault();

        const dialog = this.dialog;
        const initialRect = dialog.getBoundingClientRect();
        const offsetX = event.clientX - initialRect.left;
        const offsetY = event.clientY - initialRect.top;

        dialog.style.left = `${initialRect.left}px`;
        dialog.style.top = `${initialRect.top}px`;
        dialog.style.transform = 'none';
        dialog.style.width = `${initialRect.width}px`;
        dialog.style.height = `${initialRect.height}px`;

        const onMouseMove = (moveEvent: MouseEvent): void => {
            const maxLeft = Math.max(0, window.innerWidth - dialog.offsetWidth);
            const maxTop = Math.max(0, window.innerHeight - dialog.offsetHeight);
            const left = Math.min(maxLeft, Math.max(0, moveEvent.clientX - offsetX));
            const top = Math.min(maxTop, Math.max(0, moveEvent.clientY - offsetY));
            dialog.style.left = `${left}px`;
            dialog.style.top = `${top}px`;
        };

        const onMouseUp = (): void => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            document.body.style.userSelect = '';
        };

        document.body.style.userSelect = 'none';
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }

    private toggleFullscreen(): void {
        if (!this.dialog) return;

        const fullscreenBtn = this.dialog.querySelector('#fullscreenGraphicalEditor') as HTMLButtonElement;
        const resizeHandle = this.dialog.querySelector('#graphicalEditorResizeHandle') as HTMLDivElement;

        if (!this.isFullscreen) {
            this.dialogStyleBeforeFullscreen = {
                left: this.dialog.style.left,
                top: this.dialog.style.top,
                width: this.dialog.style.width,
                height: this.dialog.style.height,
                transform: this.dialog.style.transform,
                maxWidth: this.dialog.style.maxWidth,
                borderRadius: this.dialog.style.borderRadius
            };
            this.dialog.style.left = '0';
            this.dialog.style.top = '0';
            this.dialog.style.width = '100vw';
            this.dialog.style.height = '100vh';
            this.dialog.style.maxWidth = 'none';
            this.dialog.style.transform = 'none';
            this.dialog.style.borderRadius = '0';
            resizeHandle.style.display = 'none';
            fullscreenBtn.textContent = '🗗';
            fullscreenBtn.title = 'Exit fullscreen';
            fullscreenBtn.setAttribute('aria-label', 'Exit fullscreen');
            this.isFullscreen = true;
            return;
        }

        const previous = this.dialogStyleBeforeFullscreen;
        if (previous) {
            this.dialog.style.left = previous.left ?? '';
            this.dialog.style.top = previous.top ?? '';
            this.dialog.style.width = previous.width ?? '';
            this.dialog.style.height = previous.height ?? '';
            this.dialog.style.transform = previous.transform ?? '';
            this.dialog.style.maxWidth = previous.maxWidth ?? '';
            this.dialog.style.borderRadius = previous.borderRadius ?? '';
        }
        resizeHandle.style.display = '';
        fullscreenBtn.textContent = '⛶';
        fullscreenBtn.title = 'Enter fullscreen';
        fullscreenBtn.setAttribute('aria-label', 'Enter fullscreen');
        this.isFullscreen = false;
    }

    /**
     * Applies the current graphical model without saving its file to disk. Existing
     * mappings are refreshed and sent to the server so the active instance view redraws.
     */
    private async applyGraphicalModel(): Promise<void> {
        this.updateCachedShapesFromElements();
        this.setActiveGraphicalModel();
        const sidebar = (window as any).globalLeftSidebar;
        if (sidebar && sidebar.markGraphicalModelLoaded) {
            sidebar.markGraphicalModelLoaded();
        }

        const mappingDialog = (window as any).globalShapeMappingDialog;
        const refreshedMappings = mappingDialog?.refreshShapeConfigs
            ? await mappingDialog.refreshShapeConfigs(this.getSavedShapes())
            : 0;

        const mappingMessage = refreshedMappings > 0
            ? ` Updated ${refreshedMappings} mapped shape(s) in the instance diagram.`
            : '';
        alert(`Graphical model applied to the client session.${mappingMessage}`);
    }

    private async saveGraphicalModel(): Promise<void> {
        if (!this.actionDispatcher) {
            alert('Action dispatcher not available');
            return;
        }

        const elementsArray = Array.from(this.elements.values()).map(el => {
            const { selected, ...rest } = el;
            return rest;
        });

        const data = {
            version: '1.0',
            type: 'graphical-shapes',
            shapes: elementsArray,
            savedAt: new Date().toISOString()
        };

        const json = JSON.stringify(data, null, 2);

        const defaultFilename = 'graphical-model.json';
        const input = prompt('Enter filename for saving the graphical model:', defaultFilename);
        if (input === null) {
            return;
        }
        const trimmed = input.trim();
        const filename = trimmed.length > 0 ? trimmed : defaultFilename;

        try {
            await this.actionDispatcher.dispatch(createSaveGraphicalModelAction(filename, json));
            this.updateCachedShapesFromElements();
            this.setActiveGraphicalModel();

            const mappingDialog = (window as any).globalShapeMappingDialog;
            const refreshedMappings = mappingDialog?.refreshShapeConfigs
                ? await mappingDialog.refreshShapeConfigs(this.getSavedShapes())
                : 0;
            const mappingMessage = refreshedMappings > 0
                ? ` Updated ${refreshedMappings} mapped shape(s) in the instance diagram.`
                : '';

            alert(`Saved ${elementsArray.length} graphical shape configuration(s) to server folder 'visual-configurations/${filename}'.${mappingMessage}`);
        } catch (error) {
            console.error('Error saving graphical model to server:', error);
            alert('Error saving graphical model to server: ' + error);
        }
    }

    public loadFromContent(content: string): void {
        try {
            const data = JSON.parse(content);
            const shapesArray = data.shapes || data.elements;
            if (shapesArray && Array.isArray(shapesArray)) {
                this.elements.clear();
                if (this.canvas) {
                    this.canvas.innerHTML = '';
                }
                this.deselectElement();
                this.selectedElements.clear();
                shapesArray.forEach((el: any, index: number) => {
                    const element = this.normalizeElement(el, index);
                    this.elements.set(element.id, element);
                    this.renderElement(element);
                });
                this.updateSelectionUI();
                this.updateCachedShapesFromElements();
                this.updateNextElementId();
                this.setActiveGraphicalModel();
                const sidebar = (window as any).globalLeftSidebar;
                if (sidebar && sidebar.markGraphicalModelLoaded) {
                    sidebar.markGraphicalModelLoaded();
                }
            }
        } catch (error) {
            console.error('Error loading from content:', error);
            throw error;
        }
    }

    private loadGraphicalModel(): void {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json';
        fileInput.style.display = 'none';

        fileInput.addEventListener('change', async (event) => {
            const target = event.target as HTMLInputElement;
            const file = target.files?.[0];
            if (!file) return;

            try {
                const content = await file.text();
                const data = JSON.parse(content);

                const shapesArray = data.shapes || data.elements;
                if (shapesArray && Array.isArray(shapesArray)) {
                    this.elements.clear();
                    if (this.canvas) {
                        this.canvas.innerHTML = '';
                    }
                    this.deselectElement();
                    this.selectedElements.clear();
                    shapesArray.forEach((el: any, index: number) => {
                        const element = this.normalizeElement(el, index);
                        this.elements.set(element.id, element);
                        this.renderElement(element);
                    });
                    this.updateCachedShapesFromElements();
                    this.updateSelectionUI();
                    this.updateNextElementId();
                    this.setActiveGraphicalModel();
                    const sidebar = (window as any).globalLeftSidebar;
                    if (sidebar && sidebar.addSavedGraphicalModel) {
                        sidebar.addSavedGraphicalModel(file.name, content);
                    }
                    if (sidebar && sidebar.markGraphicalModelLoaded) {
                        sidebar.markGraphicalModelLoaded();
                    }
                } else {
                    alert('Invalid graphical model file format.');
                }
            } catch (error) {
                console.error('Error loading graphical model:', error);
                alert('Error loading graphical model: ' + error);
            }
        });

        document.body.appendChild(fileInput);
        fileInput.click();
        document.body.removeChild(fileInput);
    }

    private clearCanvas(): void {
        if (confirm('Are you sure you want to clear the canvas? This action cannot be undone.')) {
            this.elements.clear();
            if (this.canvas) {
                this.canvas.innerHTML = '';
            }
            this.selectedElements.clear();
            this.deselectElement();
            this.updateSelectionUI();
        }
    }

    public hide(): void {
        if (this.backdrop && this.backdrop.parentNode) {
            document.body.removeChild(this.backdrop);
        }
        if (this.dialog && this.dialog.parentNode) {
            document.body.removeChild(this.dialog);
        }
        this.backdrop = null;
        this.dialog = null;
        this.canvas = null;
        this.canvasContainer = null;
        this.palette = null;
        this.propertiesPanel = null;
        this.selectedElement = null;
        this.selectedElements.clear();
    }

    private updateCachedShapesFromElements(): void {
        this.cachedSavedShapes = new Map(
            Array.from(this.elements.values()).map(el => [
                el.id,
                {
                    ...el,
                    selected: false
                }
            ])
        );
    }

    private renderAllElements(): void {
        if (!this.canvas) {
            return;
        }
        this.canvas.innerHTML = '';
        const elements = Array.from(this.elements.values());
        if (elements.length === 0) {
            return;
        }
        elements.forEach(element => this.renderElement(element));
    }

    private updateNextElementId(): void {
        let maxId = 0;
        for (const element of this.elements.values()) {
            const match = element.id.match(/element_(\d+)$/);
            if (match) {
                const num = parseInt(match[1], 10);
                if (num > maxId) {
                    maxId = num;
                }
            }
        }
        this.nextElementId = maxId + 1;
    }

    private normalizeElement(raw: any, index = 0): GraphicalElement {
        const rawType = typeof raw?.type === 'string' ? raw.type : 'rectangle';
        const type = SUPPORTED_SHAPE_TYPES.includes(rawType as any) ? rawType : 'rectangle';
        const validArrowTypes = ['filled-triangle', 'open-triangle', 'open-arrow', 'diamond', 'none'] as const;
        const rawArrowType = typeof raw?.arrowType === 'string' ? raw.arrowType : 'filled-triangle';
        const arrowType = type === 'arrow' && validArrowTypes.includes(rawArrowType as any)
            ? rawArrowType
            : (type === 'arrow' ? 'filled-triangle' : undefined);

        const id = typeof raw?.id === 'string' && raw.id.length > 0
            ? raw.id
            : `loaded_${Date.now()}_${index}`;

        return {
            id,
            name: typeof raw?.name === 'string' && raw.name.length > 0 ? raw.name : `Element ${id}`,
            type,
            x: Number.isFinite(raw?.x) ? raw.x : 0,
            y: Number.isFinite(raw?.y) ? raw.y : 0,
            width: Number.isFinite(raw?.width) ? raw.width : 100,
            height: Number.isFinite(raw?.height) ? raw.height : 80,
            resizeHorizontal: typeof raw?.resizeHorizontal === 'boolean' ? raw.resizeHorizontal : true,
            resizeVertical: typeof raw?.resizeVertical === 'boolean' ? raw.resizeVertical : true,
            color: typeof raw?.color === 'string' ? raw.color : '#333333',
            fillColor: typeof raw?.fillColor === 'string' ? raw.fillColor : '#E3F2FD',
            filled: typeof raw?.filled === 'boolean' ? raw.filled : false,
            lineThickness: Number.isFinite(raw?.lineThickness) ? raw.lineThickness : 2,
            lineStyle: raw?.lineStyle === 'dashed' || raw?.lineStyle === 'dotted' ? raw.lineStyle : 'solid',
            arrowType,
            svgContent: typeof raw?.svgContent === 'string' ? raw.svgContent : undefined,
            components: Array.isArray(raw?.components)
                ? raw.components.map((component: any, componentIndex: number) => this.normalizeElement(component, componentIndex))
                : undefined,
            rotation: Number.isFinite(raw?.rotation) ? Math.min(360, Math.max(0, raw.rotation)) : 0,
            selected: false
        };
    }

    private handleSvgUpload(): void {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.svg,image/svg+xml';
        fileInput.style.display = 'none';

        fileInput.addEventListener('change', async (event) => {
            const file = (event.target as HTMLInputElement).files?.[0];
            if (!file) return;

            const canvasContainer = this.canvasContainer!;
            const x = Math.max(0, (canvasContainer.scrollLeft + canvasContainer.clientWidth / 2) / this.zoom - 50);
            const y = Math.max(0, (canvasContainer.scrollTop + canvasContainer.clientHeight / 2) / this.zoom - 40);
            
            await this.processSvgFile(file, x, y);
        });

        document.body.appendChild(fileInput);
        fileInput.click();
        document.body.removeChild(fileInput);
    }

    private async processSvgFile(file: File, x: number, y: number): Promise<void> {
        if (file.size > 1024 * 1024) {
            alert('SVG file is too large. Maximum size is 1MB.');
            return;
        }

        try {
            const text = await file.text();
            
            if (!text.trim().startsWith('<svg') && !text.includes('<svg')) {
                alert('Invalid SVG file. Please upload a valid SVG file.');
                return;
            }

            // Parse and sanitize SVG
            const parser = new DOMParser();
            const svgDoc = parser.parseFromString(text, 'image/svg+xml');
            const parseError = svgDoc.querySelector('parsererror');
            if (parseError) {
                alert('Invalid SVG file. Please upload a valid SVG file.');
                return;
            }

            // Extract the SVG element
            const svgElement = svgDoc.querySelector('svg');
            if (!svgElement) {
                alert('No SVG element found in file.');
                return;
            }

            const viewBox = svgElement.getAttribute('viewBox');
            const widthAttr = svgElement.getAttribute('width');
            const heightAttr = svgElement.getAttribute('height');
            
            let defaultWidth = 100;
            let defaultHeight = 100;

            let vbWidth = 0;
            let vbHeight = 0;
            if (viewBox) {
                const parts = viewBox.split(/\s+/);
                if (parts.length >= 4) {
                    vbWidth = parseFloat(parts[2]);
                    vbHeight = parseFloat(parts[3]);
                }
            }
            
            let attrWidth = 0;
            let attrHeight = 0;
            if (widthAttr && heightAttr) {
                attrWidth = parseFloat(widthAttr.replace('px', '').replace('pt', '').trim());
                attrHeight = parseFloat(heightAttr.replace('px', '').replace('pt', '').trim());
            }
            
            if (vbWidth > 20 && vbHeight > 20) {
                defaultWidth = vbWidth;
                defaultHeight = vbHeight;
            } else if (attrWidth > 20 && attrHeight > 20) {
                defaultWidth = attrWidth;
                defaultHeight = attrHeight;
            } else if (vbWidth > 0 && vbHeight > 0) {
                const aspectRatio = vbWidth / vbHeight;
                if (aspectRatio >= 1) {
                    defaultWidth = 100;
                    defaultHeight = 100 / aspectRatio;
                } else {
                    defaultHeight = 100;
                    defaultWidth = 100 * aspectRatio;
                }
            }
            
            if (defaultWidth < 20) defaultWidth = 100;
            if (defaultHeight < 20) defaultHeight = 100;

            svgElement.removeAttribute('width');
            svgElement.removeAttribute('height');
            
            if (!svgElement.getAttribute('viewBox') && viewBox) {
                svgElement.setAttribute('viewBox', viewBox);
            } else if (!svgElement.getAttribute('viewBox')) {
                svgElement.setAttribute('viewBox', `0 0 ${defaultWidth} ${defaultHeight}`);
            }

            const svgContent = svgElement.outerHTML;

            this.createElement('custom-svg', x, y, svgContent, defaultWidth, defaultHeight);
        } catch (error) {
            console.error('Error reading SVG file:', error);
            alert('Error reading SVG file. Please try again.');
        }
    }

    private drawCustomSvg(container: HTMLElement, element: GraphicalElement): void {
        if (!element.svgContent) {
            console.error('No svgContent in element');
            return;
        }

        const containerWidth = element.width;
        const containerHeight = element.height;

        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(element.svgContent, 'image/svg+xml');
        const parseError = svgDoc.querySelector('parsererror');
        if (parseError) {
            console.error('SVG parse error:', parseError.textContent);
            return;
        }

        const sourceSvg = svgDoc.querySelector('svg');
        if (!sourceSvg) {
            console.error('No SVG element found in svgContent');
            return;
        }

        let viewBox = sourceSvg.getAttribute('viewBox');
        if (!viewBox) {
            const width = sourceSvg.getAttribute('width');
            const height = sourceSvg.getAttribute('height');
            if (width && height) {
                const w = parseFloat(width) || containerWidth;
                const h = parseFloat(height) || containerHeight;
                viewBox = `0 0 ${w} ${h}`;
            } else {
                viewBox = `0 0 ${containerWidth} ${containerHeight}`;
            }
        }

        const svgElement = sourceSvg.cloneNode(true) as SVGSVGElement;
        svgElement.removeAttribute('width');
        svgElement.removeAttribute('height');
        svgElement.setAttribute('viewBox', viewBox);
        svgElement.setAttribute('width', containerWidth.toString());
        svgElement.setAttribute('height', containerHeight.toString());
        svgElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');

        const svgString = new XMLSerializer().serializeToString(svgElement);
        const encodedSvg = encodeURIComponent(svgString);
        const dataUri = `data:image/svg+xml,${encodedSvg}`;

        const img = document.createElement('img');
        img.src = dataUri;
        img.style.cssText = `
            width: ${containerWidth}px;
            height: ${containerHeight}px;
            position: absolute;
            top: 0;
            left: 0;
            pointer-events: none;
            z-index: 1;
            display: block;
        `;
        img.alt = element.name;

        container.appendChild(img);
    }
}


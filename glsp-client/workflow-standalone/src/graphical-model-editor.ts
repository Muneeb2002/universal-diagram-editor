/********************************************************************************
 * Copyright (c) 2024 Eclipse GLSP and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * SPDX-License-Identifier: EPL-2.0
 ********************************************************************************/

import { GLSPActionDispatcher } from '@eclipse-glsp/client';
import { createSaveGraphicalModelAction } from './ecore-client-actions';

export interface GraphicalElement {
    id: string;
    name: string;
    type: string; // 'rectangle', 'circle', 'triangle', 'diamond', 'hexagon', 'arrow', 'custom-svg'
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
    fillColor: string;
    filled?: boolean; // Whether the shape should be filled (true) or outlined only (false)
    lineThickness: number;
    lineStyle: 'solid' | 'dashed' | 'dotted';
    arrowType?: 'filled-triangle' | 'open-triangle' | 'open-arrow' | 'diamond' | 'none'; // For arrow shapes
    svgContent?: string; // For custom SVG uploads - stores the SVG markup
    selected?: boolean;
}

export class GraphicalModelEditor {
    private dialog: HTMLElement | null = null;
    private backdrop: HTMLElement | null = null;
    private actionDispatcher: GLSPActionDispatcher | null = null;
    private canvas: HTMLDivElement | null = null;
    private palette: HTMLDivElement | null = null;
    private propertiesPanel: HTMLDivElement | null = null;
    private elements: Map<string, GraphicalElement> = new Map();
    private selectedElement: GraphicalElement | null = null;
    private nextElementId = 1;
    private isDragging = false;
    private dragOffset = { x: 0, y: 0 };
    private draggedElement: GraphicalElement | null = null;
    private cachedSavedShapes: Map<string, GraphicalElement> = new Map();

    constructor(actionDispatcher: GLSPActionDispatcher) {
        this.actionDispatcher = actionDispatcher;
    }

    /**
     * Get the action dispatcher (for future use with server actions)
     */
    public getActionDispatcher(): GLSPActionDispatcher | null {
        return this.actionDispatcher;
    }

    /**
     * Get all saved graphical elements (shapes)
     */
    public getSavedShapes(): Map<string, GraphicalElement> {
        let shapes: Map<string, GraphicalElement>;
        if (this.elements.size > 0) {
            shapes = new Map(this.elements);
        } else {
            if (this.cachedSavedShapes.size === 0) {
                this.loadShapesFromStorage();
            }
            shapes = new Map(this.cachedSavedShapes);
        }
        
        // Ensure all arrow shapes have arrowType, but preserve existing arrowType values
        const normalized = new Map<string, GraphicalElement>();
        shapes.forEach((shape, id) => {
            if (shape.type === 'arrow') {
                // Only default to filled-triangle if arrowType is truly missing/undefined
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
            const shapes = this.loadShapesFromStorage();
            this.elements.clear();
            shapes.forEach(shape => this.elements.set(shape.id, { ...shape, selected: false }));
            // Update nextElementId to avoid ID conflicts with existing elements
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

    private loadShapesFromStorage(): GraphicalElement[] {
        const loadedShapes: GraphicalElement[] = [];
        try {
            const stored = localStorage.getItem('savedGraphicalShapes');
            if (stored) {
                const data = JSON.parse(stored);
                const shapesArray = data.shapes || data.elements;
                if (shapesArray && Array.isArray(shapesArray)) {
                    shapesArray.forEach((el: any, index: number) => {
                        loadedShapes.push(this.normalizeElement(el, index));
                    });
                }
            }
        } catch (error) {
            console.warn('Error loading shapes from localStorage:', error);
        }
        this.cachedSavedShapes = new Map(loadedShapes.map(shape => [shape.id, shape]));
        return loadedShapes;
    }

    private createDialog(): void {
        // Create backdrop
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

        // Create dialog
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
            <div style="padding: 20px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
                <h2 style="margin: 0; color: #333; font-size: 24px;">Graphical Model Editor</h2>
                <button id="closeGraphicalEditor" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #666;">&times;</button>
            </div>
            <div style="flex: 1; display: flex; overflow: hidden;">
                <div id="paletteContainer" style="width: 200px; border-right: 1px solid #eee; padding: 15px; overflow-y: auto; background: #f8f9fa;">
                    <h3 style="margin: 0 0 15px 0; font-size: 16px; color: #333;">Shape Palette</h3>
                    <div id="shapePalette" style="display: flex; flex-direction: column; gap: 10px;"></div>
                </div>
                <div id="canvasContainer" style="flex: 1; position: relative; overflow: auto; background: #fafafa; background-image: 
                    linear-gradient(rgba(0,0,0,.05) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(0,0,0,.05) 1px, transparent 1px);
                    background-size: 20px 20px;">
                    <div id="graphicalCanvas" style="position: relative; min-height: 100%;"></div>
                </div>
                <div id="propertiesContainer" style="width: 300px; border-left: 1px solid #eee; padding: 15px; overflow-y: auto; background: #f8f9fa;">
                    <h3 style="margin: 0 0 15px 0; font-size: 16px; color: #333;">Properties</h3>
                    <div id="propertiesPanel" style="color: #666; font-size: 14px;">Select an element to edit its properties</div>
                </div>
            </div>
            <div style="padding: 15px; border-top: 1px solid #eee; display: flex; justify-content: flex-end; gap: 10px;">
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
        `;

        this.palette = this.dialog.querySelector('#shapePalette') as HTMLDivElement;
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
            { type: 'triangle', label: 'Triangle', icon: '△' },
            { type: 'diamond', label: 'Diamond', icon: '◇' },
            { type: 'hexagon', label: 'Hexagon', icon: '⬡' },
            { type: 'arrow', label: 'Arrow', icon: '→' }
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
        if (!this.canvas) return;

        // Allow dropping shapes
        this.canvas.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer!.dropEffect = 'copy';
        });

        this.canvas.addEventListener('drop', (e) => {
            e.preventDefault();
            
            // Handle shape drag from palette
            const shapeType = e.dataTransfer!.getData('shapeType');
            if (shapeType) {
                const rect = this.canvas!.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                this.createElement(shapeType, x, y);
            }
        });
        
        // Enable drag over for file drops
        this.canvas.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer!.dropEffect = 'copy';
        });

        // Click to select/deselect
        this.canvas.addEventListener('click', (e) => {
            if (e.target === this.canvas) {
                this.deselectElement();
            }
        });
    }

    private createElement(type: string, x: number, y: number, svgContent?: string, width?: number, height?: number): void {
        const element: GraphicalElement = {
            id: `element_${this.nextElementId++}`,
            name: `Element ${this.nextElementId - 1}`,
            type,
            x,
            y,
            width: width ?? 100,
            height: height ?? 80,
            color: '#333333',
            fillColor: '#E3F2FD',
            filled: false,
            lineThickness: 2,
            lineStyle: 'solid',
            arrowType: type === 'arrow' ? 'filled-triangle' : undefined,
            svgContent: type === 'custom-svg' ? svgContent : undefined
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
        // Only show border/background for rectangle type, others use transparent container
        const isRectangle = element.type === 'rectangle';
        const isCustomSvg = element.type === 'custom-svg';
        // Respect the filled property for rectangles - only show background if filled is true
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
            ${element.selected ? 'box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.5);' : ''}
        `;

        // Draw shape based on type
        this.drawShape(elementDiv, element);

        // Add text label on top (but hide it for custom SVG to avoid covering the image)
        if (element.type !== 'custom-svg') {
            const textLabel = document.createElement('div');
            textLabel.textContent = element.name;
            textLabel.style.cssText = `
                position: relative;
                z-index: 10;
                pointer-events: none;
                text-align: center;
                width: 100%;
                height: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 12px;
                color: ${element.color};
                font-weight: 500;
            `;
            elementDiv.appendChild(textLabel);
        } else {
            // For custom SVG, add name as title attribute for tooltip
            elementDiv.title = element.name;
        }

        // Make draggable
        elementDiv.addEventListener('mousedown', (e) => {
            if (e.target === elementDiv || elementDiv.contains(e.target as Node)) {
                this.selectElement(element);
                this.startDrag(e, element);
            }
        });

        elementDiv.addEventListener('click', (e) => {
            e.stopPropagation();
            this.selectElement(element);
        });

        this.canvas.appendChild(elementDiv);
    }

    private drawShape(container: HTMLElement, element: GraphicalElement): void {
        // Handle custom SVG uploads
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

        const shape = document.createElementNS('http://www.w3.org/2000/svg', element.type === 'circle' ? 'circle' :
            element.type === 'triangle' ? 'polygon' :
            element.type === 'diamond' ? 'polygon' :
            element.type === 'hexagon' ? 'polygon' :
            element.type === 'arrow' ? 'path' :
            'rect');

        const width = element.width;
        const height = element.height;
        const cx = width / 2;
        const cy = height / 2;

        shape.setAttribute('fill', (element.filled !== false) ? element.fillColor : 'none');
        shape.setAttribute('stroke', element.color);
        shape.setAttribute('stroke-width', element.lineThickness.toString());
        shape.setAttribute('stroke-dasharray', element.lineStyle === 'dashed' ? '5,5' : element.lineStyle === 'dotted' ? '2,2' : 'none');

        switch (element.type) {
            case 'rectangle':
                (shape as SVGRectElement).setAttribute('x', '0');
                (shape as SVGRectElement).setAttribute('y', '0');
                (shape as SVGRectElement).setAttribute('width', width.toString());
                (shape as SVGRectElement).setAttribute('height', height.toString());
                break;
            case 'circle':
                (shape as SVGCircleElement).setAttribute('cx', cx.toString());
                (shape as SVGCircleElement).setAttribute('cy', cy.toString());
                (shape as SVGCircleElement).setAttribute('r', Math.min(width, height) / 2 - element.lineThickness + '');
                break;
            case 'triangle':
                (shape as SVGPolygonElement).setAttribute('points', `0,${height} ${width / 2},0 ${width},${height}`);
                break;
            case 'diamond':
                (shape as SVGPolygonElement).setAttribute('points', `${cx},0 ${width},${cy} ${cx},${height} 0,${cy}`);
                break;
            case 'hexagon':
                const hexPoints = [
                    `${cx},0`,
                    `${width},${height * 0.25}`,
                    `${width},${height * 0.75}`,
                    `${cx},${height}`,
                    `0,${height * 0.75}`,
                    `0,${height * 0.25}`
                ].join(' ');
                (shape as SVGPolygonElement).setAttribute('points', hexPoints);
                break;
            case 'arrow':
                // handled above
                break;
        }

        svg.appendChild(shape);
        container.appendChild(svg);
    }

    private drawArrowShape(svg: SVGSVGElement, element: GraphicalElement): void {
        const strokeColor = element.color;
        const fillColor = element.fillColor;
        const filled = element.filled !== false; // Default to true if not specified
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
            x: e.clientX - rect.left - element.x,
            y: e.clientY - rect.top - element.y
        };

        const onMouseMove = (moveEvent: MouseEvent) => {
            if (this.isDragging && this.draggedElement) {
                const canvasRect = this.canvas!.getBoundingClientRect();
                const newX = moveEvent.clientX - canvasRect.left - this.dragOffset.x;
                const newY = moveEvent.clientY - canvasRect.top - this.dragOffset.y;
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
        // Deselect previous
        if (this.selectedElement) {
            this.selectedElement.selected = false;
            this.renderElement(this.selectedElement);
        }

        // Select new
        this.selectedElement = element;
        element.selected = true;
        this.renderElement(element);
        this.updatePropertiesPanel();
    }

    private deselectElement(): void {
        if (this.selectedElement) {
            this.selectedElement.selected = false;
            this.renderElement(this.selectedElement);
            this.selectedElement = null;
        }
        this.updatePropertiesPanel();
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
                    <label style="display: block; margin-bottom: 5px; font-weight: 500; color: #555;">Width:</label>
                    <input type="number" id="propWidth" value="${element.width}" min="20" max="500" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
                </div>
                <div>
                    <label style="display: block; margin-bottom: 5px; font-weight: 500; color: #555;">Height:</label>
                    <input type="number" id="propHeight" value="${element.height}" min="20" max="500" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
                </div>
                ${element.type !== 'custom-svg' ? `
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
                    Custom SVG: Original colors are preserved. Only size can be adjusted.
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
        const colorInput = this.propertiesPanel.querySelector('#propColor') as HTMLInputElement | null;
        const filledCheckbox = this.propertiesPanel.querySelector('#propFilled') as HTMLInputElement | null;
        const fillColorInput = this.propertiesPanel.querySelector('#propFillColor') as HTMLInputElement | null;
        const lineThicknessInput = this.propertiesPanel.querySelector('#propLineThickness') as HTMLInputElement | null;
        const lineStyleSelect = this.propertiesPanel.querySelector('#propLineStyle') as HTMLSelectElement | null;
        const arrowTypeSelect = this.propertiesPanel.querySelector('#propArrowType') as HTMLSelectElement | null;
        const deleteBtn = this.propertiesPanel.querySelector('#deleteElement') as HTMLButtonElement;

        const updateElement = () => {
            if (!this.selectedElement) return;
            this.selectedElement.name = nameInput.value;
            this.selectedElement.width = parseInt(widthInput.value) || 100;
            this.selectedElement.height = parseInt(heightInput.value) || 80;
            
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
        if (colorInput) colorInput.addEventListener('input', updateElement);
        if (filledCheckbox) filledCheckbox.addEventListener('change', updateElement);
        if (fillColorInput) fillColorInput.addEventListener('input', updateElement);
        if (lineThicknessInput) lineThicknessInput.addEventListener('input', updateElement);
        if (lineStyleSelect) lineStyleSelect.addEventListener('change', updateElement);
        if (arrowTypeSelect) {
            arrowTypeSelect.addEventListener('change', updateElement);
        }

        deleteBtn.addEventListener('click', () => {
            if (this.selectedElement && this.canvas) {
                const elementId = this.selectedElement.id;
                
                // Clear selection first (before removing from DOM)
                this.selectedElement = null;
                if (this.propertiesPanel) {
                    this.propertiesPanel.innerHTML = '<div style="color: #666; font-size: 14px;">Select an element to edit its properties</div>';
                }
                
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

    private setupEventListeners(): void {
        const closeBtn = this.dialog!.querySelector('#closeGraphicalEditor');
        const applyBtn = this.dialog!.querySelector('#applyGraphicalModel');
        const saveBtn = this.dialog!.querySelector('#saveGraphicalModel');
        const loadBtn = this.dialog!.querySelector('#loadGraphicalModel');
        const clearBtn = this.dialog!.querySelector('#clearCanvas');

        closeBtn?.addEventListener('click', () => this.hide());

        applyBtn?.addEventListener('click', () => this.applyGraphicalModel());
        saveBtn?.addEventListener('click', () => this.saveGraphicalModel());
        loadBtn?.addEventListener('click', () => this.loadGraphicalModel());
        clearBtn?.addEventListener('click', () => this.clearCanvas());
    }

    /**
     * Applies the current graphical model to the client session without saving to disk.
     * This updates the cached shapes used by the mapping dialog and notifies the sidebar
     * that a graphical model is available, but does not send any save action to the server.
     */
    private applyGraphicalModel(): void {
        // Update cached shapes from the current in-memory elements
        this.updateCachedShapesFromElements();

        // Notify sidebar that a graphical model has been "loaded" for this session
        const sidebar = (window as any).globalLeftSidebar;
        if (sidebar && sidebar.markGraphicalModelLoaded) {
            sidebar.markGraphicalModelLoaded();
        }
        alert('Graphical model applied to the client session.');
    }

    private async saveGraphicalModel(): Promise<void> {
        if (!this.actionDispatcher) {
            alert('Action dispatcher not available');
            return;
        }

        const elementsArray = Array.from(this.elements.values()).map(el => {
            const { selected, x, y, ...rest } = el;
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
            
            alert(`Saved ${elementsArray.length} graphical shape configuration(s) to server folder 'visual-configurations/${filename}'.`);
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
                // Clear existing elements
                this.elements.clear();
                if (this.canvas) {
                    this.canvas.innerHTML = '';
                }
                this.deselectElement();
                
                // Load new elements
                shapesArray.forEach((el: any, index: number) => {
                    const element = this.normalizeElement(el, index);
                    this.elements.set(element.id, element);
                    this.renderElement(element);
                });
                this.updateCachedShapesFromElements();
                // Update nextElementId to avoid ID conflicts
                this.updateNextElementId();
                // Notify sidebar that a graphical model has been loaded
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

                // Support both old format (elements) and new format (shapes)
                const shapesArray = data.shapes || data.elements;
                if (shapesArray && Array.isArray(shapesArray)) {
                    // Clear existing elements
                    this.elements.clear();
                    if (this.canvas) {
                        this.canvas.innerHTML = '';
                    }
                    this.deselectElement();
                    
                    // Load new elements
                    shapesArray.forEach((el: any, index: number) => {
                        const element = this.normalizeElement(el, index);
                        this.elements.set(element.id, element);
                        this.renderElement(element);
                    });
                    this.updateCachedShapesFromElements();
                    // Update nextElementId to avoid ID conflicts
                    this.updateNextElementId();
                    // Cache the loaded graphical model in the sidebar
                    const sidebar = (window as any).globalLeftSidebar;
                    if (sidebar && sidebar.addSavedGraphicalModel) {
                        sidebar.addSavedGraphicalModel(file.name, content);
                    }
                    // Notify sidebar that a graphical model has been loaded
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
            this.deselectElement();
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
        this.palette = null;
        this.propertiesPanel = null;
        this.selectedElement = null;
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
            // Extract numeric part from IDs like "element_1", "element_2", etc.
            const match = element.id.match(/element_(\d+)$/);
            if (match) {
                const num = parseInt(match[1], 10);
                if (num > maxId) {
                    maxId = num;
                }
            }
        }
        // Set nextElementId to be one higher than the maximum found
        this.nextElementId = maxId + 1;
    }

    private normalizeElement(raw: any, index = 0): GraphicalElement {
        const type = typeof raw?.type === 'string' ? raw.type : 'rectangle';
        const arrowType = type === 'arrow'
            ? (typeof raw?.arrowType === 'string' ? raw.arrowType : 'filled-triangle')
            : undefined;

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
            color: typeof raw?.color === 'string' ? raw.color : '#333333',
            fillColor: typeof raw?.fillColor === 'string' ? raw.fillColor : '#E3F2FD',
            filled: typeof raw?.filled === 'boolean' ? raw.filled : false,
            lineThickness: Number.isFinite(raw?.lineThickness) ? raw.lineThickness : 2,
            lineStyle: raw?.lineStyle === 'dashed' || raw?.lineStyle === 'dotted' ? raw.lineStyle : 'solid',
            arrowType,
            svgContent: typeof raw?.svgContent === 'string' ? raw.svgContent : undefined,
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

            const canvasRect = this.canvas!.getBoundingClientRect();
            const x = Math.max(0, (canvasRect.width / 2) - 50);
            const y = Math.max(0, (canvasRect.height / 2) - 40);
            
            await this.processSvgFile(file, x, y);
        });

        document.body.appendChild(fileInput);
        fileInput.click();
        document.body.removeChild(fileInput);
    }

    private async processSvgFile(file: File, x: number, y: number): Promise<void> {
        // Validate file size (max 1MB)
        if (file.size > 1024 * 1024) {
            alert('SVG file is too large. Maximum size is 1MB.');
            return;
        }

        try {
            const text = await file.text();
            
            // Basic validation - check if it's valid SVG
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

            // Get original dimensions
            const viewBox = svgElement.getAttribute('viewBox');
            const widthAttr = svgElement.getAttribute('width');
            const heightAttr = svgElement.getAttribute('height');
            
            let defaultWidth = 100;
            let defaultHeight = 100;

            // Check viewBox first to understand the coordinate system
            let vbWidth = 0;
            let vbHeight = 0;
            if (viewBox) {
                const parts = viewBox.split(/\s+/);
                if (parts.length >= 4) {
                    vbWidth = parseFloat(parts[2]);
                    vbHeight = parseFloat(parts[3]);
                }
            }
            
            // Parse width/height attributes (remove units)
            let attrWidth = 0;
            let attrHeight = 0;
            if (widthAttr && heightAttr) {
                attrWidth = parseFloat(widthAttr.replace('px', '').replace('pt', '').trim());
                attrHeight = parseFloat(heightAttr.replace('px', '').replace('pt', '').trim());
            }
            
            // Use a reasonable default size
            // If viewBox exists and is reasonable (> 20), use it as base
            // If width/height attributes exist and are reasonable, use them
            // Otherwise use default 100x100
            if (vbWidth > 20 && vbHeight > 20) {
                // ViewBox dimensions are reasonable, use them
                defaultWidth = vbWidth;
                defaultHeight = vbHeight;
            } else if (attrWidth > 20 && attrHeight > 20) {
                // Width/height attributes are reasonable, use them
                defaultWidth = attrWidth;
                defaultHeight = attrHeight;
            } else if (vbWidth > 0 && vbHeight > 0) {
                // ViewBox exists but is small (like 24x24), scale it up proportionally
                // Scale to a reasonable display size (e.g., 100px) while maintaining aspect ratio
                const aspectRatio = vbWidth / vbHeight;
                if (aspectRatio >= 1) {
                    defaultWidth = 100;
                    defaultHeight = 100 / aspectRatio;
                } else {
                    defaultHeight = 100;
                    defaultWidth = 100 * aspectRatio;
                }
            }
            
            // Ensure minimum size
            if (defaultWidth < 20) defaultWidth = 100;
            if (defaultHeight < 20) defaultHeight = 100;

            // Remove width/height attributes to allow scaling
            svgElement.removeAttribute('width');
            svgElement.removeAttribute('height');
            
            // Set viewBox if not present
            if (!svgElement.getAttribute('viewBox') && viewBox) {
                svgElement.setAttribute('viewBox', viewBox);
            } else if (!svgElement.getAttribute('viewBox')) {
                svgElement.setAttribute('viewBox', `0 0 ${defaultWidth} ${defaultHeight}`);
            }

            // Get the cleaned SVG content
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

        // Get the container dimensions
        const containerWidth = element.width;
        const containerHeight = element.height;

        // Parse the SVG to validate it
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

        // Get or create viewBox from source
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

        // Update the SVG content with proper dimensions and viewBox
        const svgElement = sourceSvg.cloneNode(true) as SVGSVGElement;
        // Remove width/height to allow scaling based on viewBox
        svgElement.removeAttribute('width');
        svgElement.removeAttribute('height');
        // Ensure viewBox is set
        svgElement.setAttribute('viewBox', viewBox);
        // Set dimensions for the img element (these will be used by the browser)
        svgElement.setAttribute('width', containerWidth.toString());
        svgElement.setAttribute('height', containerHeight.toString());
        svgElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');

        // Convert SVG to data URI
        const svgString = new XMLSerializer().serializeToString(svgElement);
        const encodedSvg = encodeURIComponent(svgString);
        const dataUri = `data:image/svg+xml,${encodedSvg}`;

        // Create an img element with the data URI - this is the most reliable way
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

        // Append to container
        container.appendChild(img);
    }
}


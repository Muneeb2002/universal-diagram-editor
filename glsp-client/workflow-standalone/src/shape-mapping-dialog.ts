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
import { GraphicalElement } from './graphical-model-editor';
import { createSaveShapeMappingsAction, createApplyShapeMappingsAction } from './ecore-client-actions';

export interface ShapeMapping {
    className: string;
    shapeId: string;
    shapeName: string;
    shapeConfig: Omit<GraphicalElement, 'id' | 'x' | 'y' | 'selected'>;
}

export class ShapeMappingDialog {
    private dialog: HTMLElement | null = null;
    private backdrop: HTMLElement | null = null;
    private actionDispatcher: GLSPActionDispatcher | null = null;
    private mappings: Map<string, ShapeMapping> = new Map();
    private savedShapes: Map<string, GraphicalElement> = new Map();
    private classNames: string[] = [];

    constructor(actionDispatcher: GLSPActionDispatcher) {
        this.actionDispatcher = actionDispatcher;
    }

    /**
     * Get the action dispatcher (for future use with server actions)
     */
    public getActionDispatcher(): GLSPActionDispatcher | null {
        return this.actionDispatcher;
    }

    public show(classNames: string[], savedShapes: Map<string, GraphicalElement>): void {
        this.classNames = classNames;
        // Normalize shapes to ensure arrowType is preserved
        this.savedShapes = new Map(
            Array.from(savedShapes.entries()).map(([id, shape]) => {
                const normalized: GraphicalElement = {
                    ...shape,
                    arrowType: shape.type === 'arrow'
                        ? (shape.arrowType ?? 'filled-triangle')
                        : undefined
                };
                return [id, normalized];
            })
        );
        this.loadMappings();
        this.createDialog();
        document.body.appendChild(this.backdrop!);
        document.body.appendChild(this.dialog!);
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
            width: 90%;
            max-width: 1000px;
            max-height: 80vh;
            display: flex;
            flex-direction: column;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;

        this.dialog.innerHTML = `
            <div style="padding: 20px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
                <h2 style="margin: 0; color: #333; font-size: 24px;">Map Metamodel Classes to Graphical Shapes</h2>
                <button id="closeMappingDialog" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #666;">&times;</button>
            </div>
            <div style="flex: 1; overflow-y: auto; padding: 20px;">
                <div style="margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-radius: 6px; border-left: 4px solid #007bff;">
                    <p style="margin: 0; color: #666; font-size: 14px;">
                        Map each metamodel class to a graphical shape configuration. 
                        These mappings will be used when creating instances of the classes.
                    </p>
                </div>
                <div id="mappingsContainer" style="display: flex; flex-direction: column; gap: 15px;">
                    ${this.createMappingRows()}
                </div>
            </div>
            <div style="padding: 15px; border-top: 1px solid #eee; display: flex; justify-content: flex-end; gap: 10px;">
                <button id="loadMappings" style="
                    background: #007bff;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                ">Load Mappings</button>
                <button id="saveMappings" style="
                    background: #007bff;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 500;
                ">Save Mappings</button>
            </div>
        `;

        this.setupEventListeners();
    }

    private createMappingRows(): string {
        if (this.classNames.length === 0) {
            return '<div style="text-align: center; color: #666; padding: 40px;">No metamodel classes available. Please load a metamodel first.</div>';
        }

        if (this.savedShapes.size === 0) {
            return '<div style="text-align: center; color: #666; padding: 40px;">No graphical shapes available. Please create and save shapes in the Graphical Model Editor first.</div>';
        }

        const shapesArray = Array.from(this.savedShapes.values());

        return this.classNames.map(className => {
            const existingMapping = this.mappings.get(className);
            const selectedShapeId = existingMapping ? existingMapping.shapeId : '';

            return `
                <div class="mapping-row" data-class-name="${className}" style="
                    border: 1px solid #ddd;
                    border-radius: 6px;
                    padding: 15px;
                    background: white;
                ">
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <div style="flex: 1;">
                            <label style="display: block; margin-bottom: 5px; font-weight: 500; color: #555;">Class:</label>
                            <div style="font-size: 16px; color: #333; font-weight: 600;">${className}</div>
                        </div>
                        <div style="flex: 2;">
                            <label style="display: block; margin-bottom: 5px; font-weight: 500; color: #555;">Graphical Shape:</label>
                            <select class="shape-select" data-class="${className}" style="
                                width: 100%;
                                padding: 8px;
                                border: 1px solid #ddd;
                                border-radius: 4px;
                                font-size: 14px;
                            ">
                                <option value="">-- Select a shape --</option>
                                ${shapesArray.map(shape => `
                                    <option value="${shape.id}" ${shape.id === selectedShapeId ? 'selected' : ''}>
                                        ${shape.name} (${shape.type})
                                    </option>
                                `).join('')}
                            </select>
                        </div>
                        <div style="flex: 1; text-align: center;">
                            ${existingMapping ? `
                                <div style="padding: 8px; background: #d4edda; border-radius: 4px; color: #155724; font-size: 12px;">
                                    ✓ Mapped
                                </div>
                            ` : `
                                <div style="padding: 8px; background: #f8d7da; border-radius: 4px; color: #721c24; font-size: 12px;">
                                    Not mapped
                                </div>
                            `}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    private setupEventListeners(): void {
        const closeBtn = this.dialog!.querySelector('#closeMappingDialog');
        const saveBtn = this.dialog!.querySelector('#saveMappings');
        const loadBtn = this.dialog!.querySelector('#loadMappings');

        closeBtn?.addEventListener('click', () => this.hide());

        saveBtn?.addEventListener('click', () => this.saveMappings());
        loadBtn?.addEventListener('click', () => this.loadMappingsFromFile());

        // Handle shape selection changes
        const shapeSelects = this.dialog!.querySelectorAll('.shape-select');
        shapeSelects.forEach(select => {
            select.addEventListener('change', (e) => {
                const target = e.target as HTMLSelectElement;
                const className = target.getAttribute('data-class')!;
                const shapeId = target.value;

                if (shapeId) {
                    const shape = this.savedShapes.get(shapeId);
                    if (shape) {
                        const mapping: ShapeMapping = {
                            className,
                            shapeId: shape.id,
                            shapeName: shape.name,
                            shapeConfig: {
                                name: shape.name,
                                type: shape.type,
                                width: shape.width,
                                height: shape.height,
                                color: shape.color,
                                fillColor: shape.fillColor,
                                lineThickness: shape.lineThickness,
                                lineStyle: shape.lineStyle,
                                arrowType: shape.type === 'arrow'
                                    ? (shape.arrowType ?? 'filled-triangle')
                                    : undefined
                            }
                        };
                        this.mappings.set(className, mapping);
                    }
                } else {
                    this.mappings.delete(className);
                }
                this.updateMappingStatus(className);
            });
        });
    }

    private updateMappingStatus(className: string): void {
        const row = this.dialog!.querySelector(`[data-class-name="${className}"]`);
        if (!row) return;

        const statusDiv = row.querySelector('div[style*="padding: 8px"]') as HTMLElement;
        const mapping = this.mappings.get(className);

        if (statusDiv) {
            if (mapping) {
                statusDiv.style.background = '#d4edda';
                statusDiv.style.color = '#155724';
                statusDiv.textContent = '✓ Mapped';
            } else {
                statusDiv.style.background = '#f8d7da';
                statusDiv.style.color = '#721c24';
                statusDiv.textContent = 'Not mapped';
            }
        }
    }

    private async saveMappings(): Promise<void> {
        if (!this.actionDispatcher) {
            alert('Action dispatcher not available');
            return;
        }

        // Use serializeMappings to ensure all mappings are normalized (including arrowType)
        const json = this.serializeMappings();
        const parsed = JSON.parse(json);
        const mappingsArray = parsed.mappings;

        // Pretty-print for file saving
        const data = {
            version: '1.0',
            mappings: mappingsArray,
            savedAt: new Date().toISOString()
        };
        const prettyJson = JSON.stringify(data, null, 2);

        const defaultFilename = 'shape-mappings.json';
        const input = prompt('Enter filename for saving the shape mappings:', defaultFilename);
        if (input === null) {
            return;
        }
        const trimmed = input.trim();
        const filename = trimmed.length > 0 ? trimmed : defaultFilename;

        try {
            await this.actionDispatcher.dispatch(createSaveShapeMappingsAction(filename, prettyJson));
            await this.syncMappingsWithServer(json);
            
            // Don't cache on save - only cache when loading
            alert(`Saved ${mappingsArray.length} shape mapping(s) to server folder 'samples/mappings/${filename}'.`);
        } catch (error) {
            console.error('Error saving shape mappings to server:', error);
            alert('Error saving shape mappings to server: ' + error);
        }
    }

    public loadFromContent(content: string, autoMount = true): void {
        try {
            const data = JSON.parse(content);
            if (data.mappings && Array.isArray(data.mappings)) {
                this.mappings.clear();
                // Ensure we have the latest shapes before normalizing mappings
                const editor = (window as any).globalGraphicalModelEditor;
                if (editor && editor.getSavedShapes) {
                    this.savedShapes = editor.getSavedShapes();
                }
                data.mappings.forEach((mapping: ShapeMapping, index: number) => {
                    this.mappings.set(mapping.className, this.normalizeMapping(mapping, index));
                });
                
                // Recreate dialog to show updated mappings
                // Remove both backdrop and dialog if they exist
                if (this.backdrop && this.backdrop.parentNode) {
                    document.body.removeChild(this.backdrop);
                }
                if (this.dialog && this.dialog.parentNode) {
                    document.body.removeChild(this.dialog);
                }
                this.createDialog();
                if (autoMount) {
                    document.body.appendChild(this.backdrop!);
                    document.body.appendChild(this.dialog!);
                }
                this.syncMappingsWithServer().catch(() => undefined);
            }
        } catch (error) {
            console.error('Error loading from content:', error);
            throw error;
        }
    }

    private loadMappingsFromFile(): void {
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

                if (data.mappings && Array.isArray(data.mappings)) {
                    this.mappings.clear();
                    // Ensure we have the latest shapes before normalizing mappings
                    const editor = (window as any).globalGraphicalModelEditor;
                    if (editor && editor.getSavedShapes) {
                        this.savedShapes = editor.getSavedShapes();
                    }
                    data.mappings.forEach((mapping: ShapeMapping, index: number) => {
                        this.mappings.set(mapping.className, this.normalizeMapping(mapping, index));
                    });
                    
                    // Recreate dialog to show updated mappings
                    // Remove both backdrop and dialog if they exist
                    if (this.backdrop && this.backdrop.parentNode) {
                        document.body.removeChild(this.backdrop);
                    }
                    if (this.dialog && this.dialog.parentNode) {
                        document.body.removeChild(this.dialog);
                    }
                    this.createDialog();
                    document.body.appendChild(this.backdrop!);
                    document.body.appendChild(this.dialog!);
                    
                    // Cache the loaded mapping model in the sidebar
                    const sidebar = (window as any).globalLeftSidebar;
                    if (sidebar && sidebar.addSavedMappingModel) {
                        sidebar.addSavedMappingModel(file.name, content);
                    }
                    await this.syncMappingsWithServer();
                } else {
                    alert('Invalid mapping file format.');
                }
            } catch (error) {
                console.error('Error loading mappings:', error);
                alert('Error loading mappings: ' + error);
            }
        });

        document.body.appendChild(fileInput);
        fileInput.click();
        document.body.removeChild(fileInput);
    }

    private loadMappings(): void {
        try {
            const stored = localStorage.getItem('shapeMappings');
            if (stored) {
                const data = JSON.parse(stored);
                if (data.mappings && Array.isArray(data.mappings)) {
                    this.mappings.clear();
                    // Ensure we have the latest shapes before normalizing mappings
                    const editor = (window as any).globalGraphicalModelEditor;
                    if (editor && editor.getSavedShapes) {
                        this.savedShapes = editor.getSavedShapes();
                    }
                    data.mappings.forEach((mapping: ShapeMapping, index: number) => {
                        this.mappings.set(mapping.className, this.normalizeMapping(mapping, index));
                    });
                    this.syncMappingsWithServer(JSON.stringify(data)).catch(() => undefined);
                }
            }
        } catch (error) {
            console.error('Error loading mappings from localStorage:', error);
        }
    }

    public getMappings(): Map<string, ShapeMapping> {
        return this.mappings;
    }

    private serializeMappings(): string {
        // Re-normalize all mappings before serializing to ensure arrowType is up-to-date
        const editor = (window as any).globalGraphicalModelEditor;
        if (editor && editor.getSavedShapes) {
            this.savedShapes = editor.getSavedShapes();
        }
        const mappingsArray = Array.from(this.mappings.values()).map((mapping, index) => 
            this.normalizeMapping(mapping, index)
        );
        return JSON.stringify({
            version: '1.0',
            mappings: mappingsArray,
            savedAt: new Date().toISOString()
        });
    }

    private async syncMappingsWithServer(payload?: string): Promise<void> {
        if (!this.actionDispatcher) return;
        const content = payload ?? this.serializeMappings();
        try {
            await this.actionDispatcher.dispatch(createApplyShapeMappingsAction(content));
        } catch (error) {
            console.warn('Failed to sync shape mappings with server:', error);
        }
    }

    public hide(): void {
        // Save to localStorage before hiding
        try {
            const mappingsArray = Array.from(this.mappings.values());
            const data = {
                version: '1.0',
                mappings: mappingsArray,
                savedAt: new Date().toISOString()
            };
            localStorage.setItem('shapeMappings', JSON.stringify(data));
        } catch (error) {
            console.error('Error saving mappings to localStorage:', error);
        }

        if (this.backdrop && this.backdrop.parentNode) {
            document.body.removeChild(this.backdrop);
        }
        if (this.dialog && this.dialog.parentNode) {
            document.body.removeChild(this.dialog);
        }
        this.backdrop = null;
        this.dialog = null;
    }

    private normalizeMapping(mapping: ShapeMapping, index = 0): ShapeMapping {
        if (!mapping) {
            return mapping;
        }
        return {
            ...mapping,
            shapeName: mapping.shapeName || `Shape ${index + 1}`,
            shapeConfig: this.normalizeShapeConfig(mapping.shapeConfig, mapping.shapeId)
        };
    }

    private normalizeShapeConfig(config: ShapeMapping['shapeConfig'], shapeId?: string): ShapeMapping['shapeConfig'] {
        if (!config) {
            return {
                name: 'Shape',
                type: 'rectangle',
                width: 100,
                height: 80,
                color: '#333333',
                fillColor: '#E3F2FD',
                lineThickness: 2,
                lineStyle: 'solid'
            };
        }
        const normalized = {
            ...config
        } as ShapeMapping['shapeConfig'];
        if (normalized.type === 'arrow') {
            // If arrowType is missing, try to get it from the current shape definition
            if (!normalized.arrowType && this.savedShapes.size > 0) {
                // Find the shape by matching shapeId (from mapping) or shapeName
                let foundShape: GraphicalElement | undefined;
                if (shapeId) {
                    foundShape = this.savedShapes.get(shapeId);
                }
                if (!foundShape) {
                    // Try to find by name
                    for (const shape of this.savedShapes.values()) {
                        if (shape.name === normalized.name && shape.type === 'arrow') {
                            foundShape = shape;
                            break;
                        }
                    }
                }
                if (foundShape && foundShape.type === 'arrow' && foundShape.arrowType) {
                    normalized.arrowType = foundShape.arrowType;
                }
            }
            // Always ensure arrowType is set (don't allow undefined)
            normalized.arrowType = normalized.arrowType ?? 'filled-triangle';
        } else {
            // Remove arrowType for non-arrow shapes
            delete (normalized as any).arrowType;
        }
        return normalized;
    }
}


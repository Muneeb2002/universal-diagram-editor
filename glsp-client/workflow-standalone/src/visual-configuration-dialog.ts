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

/**
 * Visual configuration dialog for setting how classes should appear when instantiated.
 */
export class VisualConfigurationDialog {
    private dialog: HTMLElement | null = null;
    private backdrop: HTMLElement | null = null;
    private actionDispatcher: GLSPActionDispatcher | null = null;

    constructor(actionDispatcher: GLSPActionDispatcher) {
        this.actionDispatcher = actionDispatcher;
    }

    /**
     * Shows the visual configuration dialog.
     * @param configurations Current visual configurations for all classes
     * @param availableShapes Available shape types
     * @param availableColors Available color schemes
     */
    show(configurations: Array<{
        className: string;
        shape: string;
        color: string;
        border?: {
            style: string;
        };
        showAttributes: boolean;
        showReferences: boolean;
    }>, availableShapes: string[], availableColors: string[]): void {
        this.createDialog(configurations, availableShapes, availableColors);
        document.body.appendChild(this.backdrop!);
        document.body.appendChild(this.dialog!);
    }

    private createDialog(configurations: Array<{
        className: string;
        shape: string;
        color: string;
        border?: {
            style: string;
        };
        showAttributes: boolean;
        showReferences: boolean;
    }>, availableShapes: string[], availableColors: string[]): void {
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
            width: 80%;
            max-width: 800px;
            max-height: 80vh;
            overflow-y: auto;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;

        this.dialog.innerHTML = `
            <div style="padding: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #eee; padding-bottom: 15px;">
                    <h2 style="margin: 0; color: #333; font-size: 24px;">Visual Configuration</h2>
                    <button id="closeDialog" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #666;">&times;</button>
                </div>
                
                <div style="margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-radius: 6px; border-left: 4px solid #007bff;">
                    <p style="margin: 0; color: #666; font-size: 14px;">
                        Configure how each class should be visually represented when creating instances. 
                        You can choose different shapes, colors, and display options for each class.
                    </p>
                </div>

                <div id="configurationsContainer">
                    ${this.createConfigurationRows(configurations, availableShapes, availableColors)}
                </div>

                <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #eee; display: flex; justify-content: flex-end; gap: 10px;">
                    <button id="saveAllConfigurations" style="
                        background: #28a745;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: 500;
                    ">Save All Configurations</button>
                    <button id="cancelDialog" style="
                        background: #6c757d;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 14px;
                    ">Cancel</button>
                </div>
            </div>
        `;

        this.setupEventListeners();
    }

    private createConfigurationRows(configurations: Array<{
        className: string;
        shape: string;
        color: string;
        border?: {
            style: string;
        };
        showAttributes: boolean;
        showReferences: boolean;
    }>, availableShapes: string[], availableColors: string[]): string {
        return configurations.map(config => `
            <div class="configuration-row" style="
                border: 1px solid #ddd;
                border-radius: 6px;
                padding: 15px;
                margin-bottom: 15px;
                background: white;
            " data-class-name="${config.className}">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <h3 style="margin: 0; color: #333; font-size: 18px;">${config.className}</h3>
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <label style="display: flex; align-items: center; gap: 5px; font-size: 14px;">
                            <input type="checkbox" class="show-attributes" ${config.showAttributes ? 'checked' : ''} style="margin: 0;">
                            Show Attributes
                        </label>
                        <label style="display: flex; align-items: center; gap: 5px; font-size: 14px;">
                            <input type="checkbox" class="show-references" ${config.showReferences ? 'checked' : ''} style="margin: 0;">
                            Show References
                        </label>
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div>
                        <label style="display: block; margin-bottom: 5px; font-weight: 500; color: #555;">Shape:</label>
                        <select class="shape-select" style="
                            width: 100%;
                            padding: 8px;
                            border: 1px solid #ddd;
                            border-radius: 4px;
                            font-size: 14px;
                        ">
                            ${availableShapes.map(shape => {
                                let displayName = shape.charAt(0).toUpperCase() + shape.slice(1);
                                if (shape === 'arrow') {
                                    displayName = 'Arrow';
                                }
                                return `<option value="${shape}" ${shape === config.shape ? 'selected' : ''}>${displayName}</option>`;
                            }).join('')}
                        </select>
                    </div>
                    
                    <div>
                        <label style="display: block; margin-bottom: 5px; font-weight: 500; color: #555;">Color:</label>
                        <select class="color-select" style="
                            width: 100%;
                            padding: 8px;
                            border: 1px solid #ddd;
                            border-radius: 4px;
                            font-size: 14px;
                        ">
                            ${availableColors.map(color => 
                                `<option value="${color}" ${color === config.color ? 'selected' : ''}>${color.charAt(0).toUpperCase() + color.slice(1)}</option>`
                            ).join('')}
                        </select>
                    </div>
                </div>
                
                <div style="margin-top: 15px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: 500; color: #555;">Border Style:</label>
                    <select class="border-style-select" style="
                        width: 100%;
                        padding: 8px;
                        border: 1px solid #ddd;
                        border-radius: 4px;
                        font-size: 14px;
                    ">
                        <option value="solid" ${config.border?.style === 'solid' ? 'selected' : ''}>Solid</option>
                        <option value="dashed" ${config.border?.style === 'dashed' ? 'selected' : ''}>Dashed</option>
                        <option value="dotted" ${config.border?.style === 'dotted' ? 'selected' : ''}>Dotted</option>
                    </select>
                </div>
                
                <div style="margin-top: 10px; padding: 10px; background: #f8f9fa; border-radius: 4px;">
                    <div style="font-size: 12px; color: #666; margin-bottom: 5px;">Preview:</div>
                    <div class="preview-container" style="
                        width: 60px;
                        height: 40px;
                        border: 2px solid #ccc;
                        border-radius: 4px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 12px;
                        font-weight: bold;
                        background: ${this.getColorFill(config.color)};
                        color: ${this.getColorText(config.color)};
                    ">${this.getShapeSymbol(config.shape)}</div>
                </div>
            </div>
        `).join('');
    }

    private getColorFill(color: string): string {
        const colorMap: Record<string, string> = {
            blue: '#E3F2FD',
            green: '#E8F5E8',
            red: '#FFEBEE',
            orange: '#FFF3E0',
            purple: '#F3E5F5',
            pink: '#FCE4EC',
            yellow: '#FFFDE7',
            gray: '#F5F5F5',
            brown: '#EFEBE9',
            cyan: '#E0F2F1'
        };
        return colorMap[color] || '#E3F2FD';
    }

    private getColorText(color: string): string {
        const colorMap: Record<string, string> = {
            blue: '#0D47A1',
            green: '#1B5E20',
            red: '#B71C1C',
            orange: '#E65100',
            purple: '#4A148C',
            pink: '#880E4F',
            yellow: '#F57F17',
            gray: '#212121',
            brown: '#3E2723',
            cyan: '#004D40'
        };
        return colorMap[color] || '#0D47A1';
    }

    private getShapeSymbol(shape: string): string {
        if (shape === 'arrow') return '→';
        if (shape === 'diamond') return '◆';
        if (shape === 'triangle') return '▲';
        return shape.charAt(0).toUpperCase();
    }

    private setupEventListeners(): void {
        // Close dialog
        const closeBtn = this.dialog!.querySelector('#closeDialog');
        const cancelBtn = this.dialog!.querySelector('#cancelDialog');
        const saveBtn = this.dialog!.querySelector('#saveAllConfigurations');

        const closeDialog = () => {
            if (this.backdrop) document.body.removeChild(this.backdrop);
            if (this.dialog) document.body.removeChild(this.dialog);
        };

        closeBtn?.addEventListener('click', closeDialog);
        cancelBtn?.addEventListener('click', closeDialog);
        this.backdrop?.addEventListener('click', closeDialog);

        // Save configurations
        saveBtn?.addEventListener('click', () => {
            this.saveAllConfigurations();
        });

        // Update previews when selections change
        const rows = this.dialog!.querySelectorAll('.configuration-row');
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i] as HTMLElement;
            const shapeSelect = row.querySelector('.shape-select') as HTMLSelectElement;
            const colorSelect = row.querySelector('.color-select') as HTMLSelectElement;
            const preview = row.querySelector('.preview-container') as HTMLElement;

            const updatePreview = () => {
                const shape = shapeSelect.value;
                const color = colorSelect.value;
                
                // Set appropriate symbol for each shape
                let symbol = shape.charAt(0).toUpperCase();
                if (shape === 'arrow') symbol = '→';
                else if (shape === 'star') symbol = '★';
                else if (shape === 'diamond') symbol = '◆';
                else if (shape === 'triangle') symbol = '▲';
                else if (shape === 'pentagon') symbol = '⬟';
                else if (shape === 'hexagon') symbol = '⬡';
                
                preview.textContent = symbol;
                preview.style.background = this.getColorFill(color);
                preview.style.color = this.getColorText(color);
            };

            shapeSelect?.addEventListener('change', updatePreview);
            colorSelect?.addEventListener('change', updatePreview);
        }
    }

    private async saveAllConfigurations(): Promise<void> {
        if (!this.actionDispatcher) {
            console.error('Action dispatcher not available');
            return;
        }

        const rows = this.dialog!.querySelectorAll('.configuration-row');
        const savePromises: Promise<any>[] = [];

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i] as HTMLElement;
            const className = row.getAttribute('data-class-name');
            const shapeSelect = row.querySelector('.shape-select') as HTMLSelectElement;
            const colorSelect = row.querySelector('.color-select') as HTMLSelectElement;
            const borderStyleSelect = row.querySelector('.border-style-select') as HTMLSelectElement;
            const showAttributesCheckbox = row.querySelector('.show-attributes') as HTMLInputElement;
            const showReferencesCheckbox = row.querySelector('.show-references') as HTMLInputElement;

            if (className) {
                const action = {
                    kind: 'setClassVisualConfiguration',
                    className,
                    shape: shapeSelect.value,
                    color: colorSelect.value,
                    border: {
                        style: borderStyleSelect.value
                    },
                    showAttributes: showAttributesCheckbox.checked,
                    showReferences: showReferencesCheckbox.checked
                };

                savePromises.push(this.actionDispatcher.dispatch(action));
            }
        }

        try {
            await Promise.all(savePromises);
            console.log('All visual configurations saved successfully');
            
            // Close dialog
            if (this.backdrop) document.body.removeChild(this.backdrop);
            if (this.dialog) document.body.removeChild(this.dialog);
        } catch (error) {
            console.error('Error saving visual configurations:', error);
            alert('Error saving configurations: ' + error);
        }
    }
}

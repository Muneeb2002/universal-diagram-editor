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
import { createSaveShapeMappingsAction, createApplyShapeMappingsAction, createOpenClassPropertiesAction } from './ecore-client-actions';
import { getContainmentRequirements } from './containment-utils';

export interface ShapeMapping {
    className: string;
    shapeId: string;
    shapeName: string;
    shapeConfig: Omit<GraphicalElement, 'id' | 'x' | 'y' | 'selected'>;
    // Optional enum conditions for submappings
    enumAttribute?: string; // Name of the enum attribute (e.g., "Status")
    enumValue?: string; // Value of the enum literal (e.g., "Active", "Pending")
    // Optional source and target class configurations (multiple pairs allowed)
    sourceTargetPairs?: Array<{
        sourceClass: string;
        targetClass: string;
    }>;
}

export class ShapeMappingDialog {
    private dialog: HTMLElement | null = null;
    private backdrop: HTMLElement | null = null;
    private actionDispatcher: GLSPActionDispatcher | null = null;
    private mappings: Map<string, ShapeMapping> = new Map();
    private savedShapes: Map<string, GraphicalElement> = new Map();
    private classNames: string[] = [];
    private mappingsJustLoaded: boolean = false;

    constructor(actionDispatcher: GLSPActionDispatcher) {
        this.actionDispatcher = actionDispatcher;
    }

    /**
     * Get the action dispatcher (for future use with server actions)
     */
    public getActionDispatcher(): GLSPActionDispatcher | null {
        return this.actionDispatcher;
    }

    public show(classNames: string[], savedShapes: Map<string, GraphicalElement>, mode: 'create' | 'edit' = 'create'): void {
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
        
        // Request class properties to get enum information with literals
        if (this.actionDispatcher) {
            this.actionDispatcher.dispatch(createOpenClassPropertiesAction()).catch(() => {
                // Ignore errors - enum info might not be critical
            });
        }
        
        // Clear mappings if mode is 'create', otherwise load existing mappings
        // But skip loading if mappings were just loaded from content (to avoid overwriting)
        if (mode === 'create') {
            this.mappings.clear();
            this.mappingsJustLoaded = false;
        } else if (!this.mappingsJustLoaded) {
            this.loadMappings();
            this.mappingsJustLoaded = false;
        } else {
            // Mappings were just loaded from content, don't overwrite them
            this.mappingsJustLoaded = false;
        }
        
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
                    background: #007acc;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                ">Load Mappings</button>
                <button id="applyMappings" style="
                    background: #007acc;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                ">Apply Mappings</button>
                <button id="saveMappings" style="
                    background: #007acc;
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
        
        // Attach pair event listeners for all classes after initial render
        this.classNames.forEach(className => {
            const mappingKey = this.getMappingKey(className);
            const mapping = this.mappings.get(mappingKey);
            if (mapping) {
                this.attachPairEventListeners(className);
            }
        });
    }

    private createMappingRows(): string {
        if (this.classNames.length === 0) {
            return '<div style="text-align: center; color: #666; padding: 40px;">No metamodel classes available. Please load a metamodel first.</div>';
        }

        if (this.savedShapes.size === 0) {
            return '<div style="text-align: center; color: #666; padding: 40px;">No graphical shapes available. Please create and save shapes in the Graphical Model Editor first.</div>';
        }

        const shapesArray = Array.from(this.savedShapes.values());
        const toolbar = (window as any).globalToolbar;
        const classInfoList = toolbar && toolbar.allClasses ? toolbar.allClasses : [];
        const enumNames = toolbar && toolbar.getEnumNames ? toolbar.getEnumNames() : [];
        
        // Identify root classes and exclude them from mappable classes
        const rootClassNames = this.getRootClassNames();
        const mappableClassNames = this.classNames.filter(className => !rootClassNames.has(className));

        return mappableClassNames.map(className => {
            const classInfo = classInfoList.find((c: any) => c.className === className);
            const enumAttributes = classInfo?.attributes?.filter((attr: any) => 
                enumNames.includes(attr.type)
            ) || [];

            // Get base mapping (no enum conditions)
            const baseMappingKey = this.getMappingKey(className);
            const baseMapping = this.mappings.get(baseMappingKey);
            const baseSelectedShapeId = baseMapping ? baseMapping.shapeId : '';

            // Get enum literal values for each enum attribute
            const enumSubmappings: Array<{ attrName: string; enumType: string; literals: string[] }> = [];
            for (const enumAttr of enumAttributes) {
                const enumType = enumAttr.type;
                const literals = this.getEnumLiterals(enumType);
                if (literals.length > 0) {
                    enumSubmappings.push({ attrName: enumAttr.name, enumType, literals });
                }
            }

            // Build base mapping row
            let html = `
                <div class="mapping-row" data-class-name="${className}" style="
                    border: 1px solid #ddd;
                    border-radius: 6px;
                    padding: 15px;
                    background: white;
                    margin-bottom: 10px;
                ">
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <div style="flex: 1;">
                            <label style="display: block; margin-bottom: 5px; font-weight: 500; color: #555;">Class:</label>
                            <div style="font-size: 16px; color: #333; font-weight: 600;">${className}</div>
                        </div>
                        <div style="flex: 2;">
                            <label style="display: block; margin-bottom: 5px; font-weight: 500; color: #555;">Base Mapping (Default):</label>
                            <select class="shape-select" data-class="${className}" data-mapping-type="base" style="
                                width: 100%;
                                padding: 8px;
                                border: 1px solid #ddd;
                                border-radius: 4px;
                                font-size: 14px;
                            ">
                                <option value="">-- Select a shape --</option>
                                ${shapesArray.map(shape => `
                                    <option value="${shape.id}" ${shape.id === baseSelectedShapeId ? 'selected' : ''}>
                                        ${shape.name} (${shape.type})
                                    </option>
                                `).join('')}
                            </select>
                        </div>
                        <div style="flex: 1; text-align: center;">
                            ${baseMapping ? `
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
                    <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #eee;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                            <label style="font-weight: 500; color: #555; font-size: 13px;">Source/Target Pairs (optional):</label>
                            <button type="button" class="add-source-target-pair-btn" data-class="${className}" ${!baseMapping ? 'disabled' : ''} style="
                                padding: 4px 12px;
                                background: ${baseMapping ? '#007acc' : '#ccc'};
                                color: white;
                                border: none;
                                border-radius: 4px;
                                cursor: ${baseMapping ? 'pointer' : 'not-allowed'};
                                font-size: 12px;
                                ${!baseMapping ? 'opacity: 0.6;' : ''}
                            ">+ Add Pair</button>
                        </div>
                        <div class="source-target-pairs-container" data-class="${className}" style="display: flex; flex-direction: column; gap: 10px;">
                            ${this.renderSourceTargetPairs(className, baseMapping, rootClassNames)}
                        </div>
                        ${!baseMapping ? '<div style="font-size: 11px; color: #999; margin-top: 5px; font-style: italic;">Select a shape first to configure source/target pairs</div>' : ''}
                    </div>
            `;

            // Add submappings for each enum attribute
            for (const { attrName, enumType, literals } of enumSubmappings) {
                html += `
                    <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #eee;">
                        <div style="margin-bottom: 10px; font-weight: 500; color: #555; font-size: 14px;">
                            Submappings for ${attrName} (${enumType}):
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 10px;">
                `;

                for (const literal of literals) {
                    const subMappingKey = this.getMappingKey(className, attrName, literal);
                    const subMapping = this.mappings.get(subMappingKey);
                    const subSelectedShapeId = subMapping ? subMapping.shapeId : '';

                    html += `
                        <div style="display: flex; align-items: center; gap: 15px; padding: 10px; background: #f8f9fa; border-radius: 4px;">
                            <div style="flex: 1;">
                                <label style="display: block; margin-bottom: 5px; font-weight: 500; color: #555; font-size: 12px;">When ${attrName} = ${literal}:</label>
                            </div>
                            <div style="flex: 2;">
                                <select class="shape-select" data-class="${className}" data-enum-attr="${attrName}" data-enum-value="${literal}" data-mapping-type="sub" style="
                                    width: 100%;
                                    padding: 6px;
                                    border: 1px solid #ddd;
                                    border-radius: 4px;
                                    font-size: 13px;
                                ">
                                    <option value="">-- Use base mapping --</option>
                                    ${shapesArray.map(shape => `
                                        <option value="${shape.id}" ${shape.id === subSelectedShapeId ? 'selected' : ''}>
                                            ${shape.name} (${shape.type})
                                        </option>
                                    `).join('')}
                                </select>
                            </div>
                            <div style="flex: 1; text-align: center;">
                                ${subMapping ? `
                                    <div style="padding: 6px; background: #d4edda; border-radius: 4px; color: #155724; font-size: 11px;">
                                        ✓ Mapped
                                    </div>
                                ` : `
                                    <div style="padding: 6px; background: #fff3cd; border-radius: 4px; color: #856404; font-size: 11px;">
                                        Uses base
                                    </div>
                                `}
                            </div>
                        </div>
                    `;
                }

                html += `
                        </div>
                    </div>
                `;
            }

            html += `</div>`;
            return html;
        }).join('');
    }

    /**
     * Get mapping key for a class, optionally with enum conditions
     */
    private getMappingKey(className: string, enumAttribute?: string, enumValue?: string): string {
        if (enumAttribute && enumValue) {
            return `${className}:${enumAttribute}:${enumValue}`;
        }
        return className;
    }

    /**
     * Get enum literal values for a given enum type name
     */
    private getEnumLiterals(enumTypeName: string): string[] {
        const toolbar = (window as any).globalToolbar;
        if (toolbar && typeof toolbar.getEnumLiterals === 'function') {
            return toolbar.getEnumLiterals(enumTypeName);
        }
        return [];
    }

    /**
     * Gets the set of root class names (classes with no containment requirements).
     */
    private getRootClassNames(): Set<string> {
        const toolbar = (window as any).globalToolbar;
        const classInfoList = toolbar && toolbar.allClasses ? toolbar.allClasses : [];
        const rootClassNames = new Set<string>();
        
        if (classInfoList.length > 0) {
            classInfoList.forEach((cls: any) => {
                const requirements = getContainmentRequirements(cls.className, classInfoList);
                if (requirements.length === 0) {
                    rootClassNames.add(cls.className);
                }
            });
        }
        
        return rootClassNames;
    }

    private renderSourceTargetPairs(className: string, mapping: ShapeMapping | undefined, rootClassNames: Set<string>): string {
        const pairs = mapping?.sourceTargetPairs || [];
        if (pairs.length === 0) {
            return '<div style="color: #999; font-size: 12px; font-style: italic;">No source/target pairs configured</div>';
        }
        
        // Filter out root classes and the current class from options
        const availableClassNames = this.classNames.filter(cn => cn !== className && !rootClassNames.has(cn));
        
        return pairs.map((pair, index) => `
            <div class="source-target-pair-row" data-class="${className}" data-pair-index="${index}" style="
                display: flex;
                gap: 10px;
                align-items: center;
                padding: 8px;
                background: #f8f9fa;
                border-radius: 4px;
                border: 1px solid #e0e0e0;
            ">
                <div style="flex: 1;">
                    <select class="pair-source-select" data-class="${className}" data-pair-index="${index}" style="
                        width: 100%;
                        padding: 6px;
                        border: 1px solid #ddd;
                        border-radius: 4px;
                        font-size: 13px;
                    ">
                        <option value="">-- Select Source --</option>
                        ${availableClassNames.map(cn => `
                            <option value="${cn}" ${pair.sourceClass === cn ? 'selected' : ''}>${cn}</option>
                        `).join('')}
                    </select>
                </div>
                <div style="flex: 0 0 auto; color: #666; font-size: 14px;">→</div>
                <div style="flex: 1;">
                    <select class="pair-target-select" data-class="${className}" data-pair-index="${index}" style="
                        width: 100%;
                        padding: 6px;
                        border: 1px solid #ddd;
                        border-radius: 4px;
                        font-size: 13px;
                    ">
                        <option value="">-- Select Target --</option>
                        ${availableClassNames.map(cn => `
                            <option value="${cn}" ${pair.targetClass === cn ? 'selected' : ''}>${cn}</option>
                        `).join('')}
                    </select>
                </div>
                <button type="button" class="remove-pair-btn" data-class="${className}" data-pair-index="${index}" style="
                    padding: 4px 8px;
                    background: #dc3545;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                ">×</button>
            </div>
        `).join('');
    }

    private setupEventListeners(): void {
        const closeBtn = this.dialog!.querySelector('#closeMappingDialog');
        const saveBtn = this.dialog!.querySelector('#saveMappings');
        const loadBtn = this.dialog!.querySelector('#loadMappings');
        const applyBtn = this.dialog!.querySelector('#applyMappings');

        closeBtn?.addEventListener('click', () => this.hide());

        saveBtn?.addEventListener('click', () => this.saveMappings());
        loadBtn?.addEventListener('click', () => this.loadMappingsFromFile());
        applyBtn?.addEventListener('click', () => this.applyMappings());

        // Handle shape selection changes
        const shapeSelects = this.dialog!.querySelectorAll('.shape-select');
        shapeSelects.forEach(select => {
            select.addEventListener('change', (e) => {
                const target = e.target as HTMLSelectElement;
                const className = target.getAttribute('data-class')!;
                const mappingType = target.getAttribute('data-mapping-type'); // 'base' or 'sub'
                const enumAttr = target.getAttribute('data-enum-attr');
                const enumValue = target.getAttribute('data-enum-value');
                const shapeId = target.value;

                // Determine the mapping key
                const mappingKey = mappingType === 'sub' && enumAttr && enumValue
                    ? this.getMappingKey(className, enumAttr, enumValue)
                    : this.getMappingKey(className);

                if (shapeId) {
                    const shape = this.savedShapes.get(shapeId);
                    if (shape) {
                        // Preserve existing sourceTargetPairs if they exist
                        const existingMapping = this.mappings.get(mappingKey);
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
                                filled: shape.filled,
                                lineThickness: shape.lineThickness,
                                lineStyle: shape.lineStyle,
                                arrowType: shape.type === 'arrow'
                                    ? (shape.arrowType ?? 'filled-triangle')
                                    : undefined,
                                svgContent: shape.type === 'custom-svg' ? shape.svgContent : undefined
                            },
                            enumAttribute: enumAttr || undefined,
                            enumValue: enumValue || undefined,
                            sourceTargetPairs: existingMapping?.sourceTargetPairs || []
                        };
                        this.mappings.set(mappingKey, mapping);
                        // Refresh the pairs UI if this is a base mapping
                        if (mappingType === 'base') {
                            this.refreshSourceTargetPairs(className);
                        }
                    }
                } else {
                    this.mappings.delete(mappingKey);
                    if (mappingType === 'base') {
                        this.refreshSourceTargetPairs(className);
                    }
                }
                this.updateMappingStatus(className, enumAttr, enumValue);
            });
        });

        // Handle add source/target pair button
        const addPairBtns = this.dialog!.querySelectorAll('.add-source-target-pair-btn');
        addPairBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.target as HTMLButtonElement;
                if (target.disabled) {
                    return;
                }
                const className = target.getAttribute('data-class')!;
                const mappingKey = this.getMappingKey(className);
                const mapping = this.mappings.get(mappingKey);
                if (mapping) {
                    if (!mapping.sourceTargetPairs) {
                        mapping.sourceTargetPairs = [];
                    }
                    mapping.sourceTargetPairs.push({ sourceClass: '', targetClass: '' });
                    this.mappings.set(mappingKey, mapping);
                    this.refreshSourceTargetPairs(className);
                }
            });
        });

        // Handle remove pair button
        const removePairBtns = this.dialog!.querySelectorAll('.remove-pair-btn');
        removePairBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.target as HTMLButtonElement;
                const className = target.getAttribute('data-class')!;
                const pairIndex = parseInt(target.getAttribute('data-pair-index') || '0');
                const mappingKey = this.getMappingKey(className);
                const mapping = this.mappings.get(mappingKey);
                if (mapping && mapping.sourceTargetPairs) {
                    mapping.sourceTargetPairs.splice(pairIndex, 1);
                    this.mappings.set(mappingKey, mapping);
                    this.refreshSourceTargetPairs(className);
                }
            });
        });

        // Handle pair source select changes
        const pairSourceSelects = this.dialog!.querySelectorAll('.pair-source-select');
        pairSourceSelects.forEach(select => {
            select.addEventListener('change', (e) => {
                const target = e.target as HTMLSelectElement;
                const className = target.getAttribute('data-class')!;
                const pairIndex = parseInt(target.getAttribute('data-pair-index') || '0');
                const sourceClass = target.value;
                const mappingKey = this.getMappingKey(className);
                const mapping = this.mappings.get(mappingKey);
                if (mapping && mapping.sourceTargetPairs && mapping.sourceTargetPairs[pairIndex]) {
                    mapping.sourceTargetPairs[pairIndex].sourceClass = sourceClass;
                    this.mappings.set(mappingKey, mapping);
                }
            });
        });

        // Handle pair target select changes
        const pairTargetSelects = this.dialog!.querySelectorAll('.pair-target-select');
        pairTargetSelects.forEach(select => {
            select.addEventListener('change', (e) => {
                const target = e.target as HTMLSelectElement;
                const className = target.getAttribute('data-class')!;
                const pairIndex = parseInt(target.getAttribute('data-pair-index') || '0');
                const targetClass = target.value;
                const mappingKey = this.getMappingKey(className);
                const mapping = this.mappings.get(mappingKey);
                if (mapping && mapping.sourceTargetPairs && mapping.sourceTargetPairs[pairIndex]) {
                    mapping.sourceTargetPairs[pairIndex].targetClass = targetClass;
                    this.mappings.set(mappingKey, mapping);
                }
            });
        });
    }

    private refreshSourceTargetPairs(className: string): void {
        const row = this.dialog!.querySelector(`[data-class-name="${className}"]`);
        if (!row) return;
        
        const mappingKey = this.getMappingKey(className);
        const mapping = this.mappings.get(mappingKey);
        const rootClassNames = this.getRootClassNames();
        const container = row.querySelector('.source-target-pairs-container');
        if (container) {
            container.innerHTML = this.renderSourceTargetPairs(className, mapping, rootClassNames);
            // Re-attach event listeners for the new elements
            this.attachPairEventListeners(className);
        }
    }

    private attachPairEventListeners(className: string): void {
        const row = this.dialog!.querySelector(`[data-class-name="${className}"]`);
        if (!row) return;

        // Remove pair buttons
        const removeBtns = row.querySelectorAll('.remove-pair-btn');
        removeBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.target as HTMLButtonElement;
                const pairIndex = parseInt(target.getAttribute('data-pair-index') || '0');
                const mappingKey = this.getMappingKey(className);
                const mapping = this.mappings.get(mappingKey);
                if (mapping && mapping.sourceTargetPairs) {
                    mapping.sourceTargetPairs.splice(pairIndex, 1);
                    this.mappings.set(mappingKey, mapping);
                    this.refreshSourceTargetPairs(className);
                }
            });
        });

        // Pair source selects
        const pairSourceSelects = row.querySelectorAll('.pair-source-select');
        pairSourceSelects.forEach(select => {
            select.addEventListener('change', (e) => {
                const target = e.target as HTMLSelectElement;
                const pairIndex = parseInt(target.getAttribute('data-pair-index') || '0');
                const sourceClass = target.value;
                const mappingKey = this.getMappingKey(className);
                const mapping = this.mappings.get(mappingKey);
                if (mapping && mapping.sourceTargetPairs && mapping.sourceTargetPairs[pairIndex]) {
                    mapping.sourceTargetPairs[pairIndex].sourceClass = sourceClass;
                    this.mappings.set(mappingKey, mapping);
                }
            });
        });

        // Pair target selects
        const pairTargetSelects = row.querySelectorAll('.pair-target-select');
        pairTargetSelects.forEach(select => {
            select.addEventListener('change', (e) => {
                const target = e.target as HTMLSelectElement;
                const pairIndex = parseInt(target.getAttribute('data-pair-index') || '0');
                const targetClass = target.value;
                const mappingKey = this.getMappingKey(className);
                const mapping = this.mappings.get(mappingKey);
                if (mapping && mapping.sourceTargetPairs && mapping.sourceTargetPairs[pairIndex]) {
                    mapping.sourceTargetPairs[pairIndex].targetClass = targetClass;
                    this.mappings.set(mappingKey, mapping);
                }
            });
        });
    }

    private updateMappingStatus(className: string, enumAttr?: string | null, enumValue?: string | null): void {
        const row = this.dialog!.querySelector(`[data-class-name="${className}"]`);
        if (!row) return;

        if (enumAttr && enumValue) {
            // Update submapping status
            const subSelect = row.querySelector(`select[data-enum-attr="${enumAttr}"][data-enum-value="${enumValue}"]`) as HTMLSelectElement;
            if (subSelect) {
                const subMappingKey = this.getMappingKey(className, enumAttr, enumValue);
                const subMapping = this.mappings.get(subMappingKey);
                const statusDiv = subSelect.parentElement?.parentElement?.querySelector('div[style*="padding: 6px"]') as HTMLElement;
                if (statusDiv) {
                    if (subMapping) {
                        statusDiv.style.background = '#d4edda';
                        statusDiv.style.color = '#155724';
                        statusDiv.textContent = '✓ Mapped';
                    } else {
                        statusDiv.style.background = '#fff3cd';
                        statusDiv.style.color = '#856404';
                        statusDiv.textContent = 'Uses base';
                    }
                }
            }
        } else {
            // Update base mapping status
            const statusDiv = row.querySelector('div[style*="padding: 8px"]') as HTMLElement;
            const baseMappingKey = this.getMappingKey(className);
            const mapping = this.mappings.get(baseMappingKey);

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

            // Update add pair button state and refresh source/target pairs
            const addPairBtn = row.querySelector('.add-source-target-pair-btn') as HTMLButtonElement;
            if (addPairBtn) {
                addPairBtn.disabled = !mapping;
                addPairBtn.style.background = mapping ? '#007acc' : '#ccc';
                addPairBtn.style.cursor = mapping ? 'pointer' : 'not-allowed';
                addPairBtn.style.opacity = mapping ? '1' : '0.6';
            }
            
            // Show/hide hint text
            const hintText = row.querySelector('.source-target-pairs-container')?.parentElement?.querySelector('div[style*="font-style: italic"]') as HTMLElement;
            if (hintText) {
                hintText.style.display = mapping ? 'none' : 'block';
            }
            
            // Refresh source/target pairs if mapping exists
            if (mapping) {
                this.refreshSourceTargetPairs(className);
            } else {
                // Clear pairs container if no mapping
                const container = row.querySelector('.source-target-pairs-container');
                if (container) {
                    container.innerHTML = '<div style="color: #999; font-size: 12px; font-style: italic;">No source/target pairs configured</div>';
                }
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
            alert(`Saved ${mappingsArray.length} shape mapping(s) to server folder 'samples/mappings/${filename}'.`);
        } catch (error) {
            console.error('Error saving shape mappings to server:', error);
            alert('Error saving shape mappings to server: ' + error);
        }
    }

    /**
     * Applies the current mapping model to the running editor without saving it to disk.
     * This sends the in-memory mappings to the server (ApplyShapeMappingsAction) only.
     */
    private async applyMappings(): Promise<void> {
        if (!this.actionDispatcher) {
            alert('Action dispatcher not available');
            return;
        }

        try {
            // Use current in-memory mappings; serialize and sync with server.
            await this.syncMappingsWithServer();
            alert(`Applied ${this.mappings.size} shape mapping(s) to the current editor session.`);
        } catch (error) {
            console.error('Error applying shape mappings to server:', error);
            alert('Error applying shape mappings: ' + error);
        }
    }

    public loadFromContent(content: string, autoMount = true, classNames?: string[], savedShapes?: Map<string, GraphicalElement>): void {
        try {
            const data = JSON.parse(content);
            if (data.mappings && Array.isArray(data.mappings)) {
                this.mappings.clear();
                
                // Set classNames if provided, otherwise try to get from toolbar
                if (classNames) {
                    this.classNames = classNames;
                } else {
                    const toolbar: any = (window as any).globalToolbar;
                    this.classNames = toolbar && toolbar.getConcreteClasses ? toolbar.getConcreteClasses() : [];
                }
                
                // Set savedShapes if provided, otherwise get from editor
                if (savedShapes) {
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
                } else {
                    const editor = (window as any).globalGraphicalModelEditor;
                    if (editor && editor.getSavedShapes) {
                        this.savedShapes = editor.getSavedShapes();
                    }
                }
                
                data.mappings.forEach((mapping: ShapeMapping, index: number) => {
                    const normalized = this.normalizeMapping(mapping, index);
                    // Use composite key for submappings, className for base mappings
                    const mappingKey = normalized.enumAttribute && normalized.enumValue
                        ? this.getMappingKey(normalized.className, normalized.enumAttribute, normalized.enumValue)
                        : this.getMappingKey(normalized.className);
                    this.mappings.set(mappingKey, normalized);
                });
                
                // Mark that mappings were just loaded to prevent overwriting in show()
                this.mappingsJustLoaded = true;
                
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
                
                // Update the edit button visibility in the sidebar
                const sidebar = (window as any).globalLeftSidebar;
                if (sidebar && sidebar.updateEditMappingButtonVisibility) {
                    sidebar.updateEditMappingButtonVisibility();
                }
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
                        const normalized = this.normalizeMapping(mapping, index);
                        // Use composite key for submappings, className for base mappings
                        const mappingKey = normalized.enumAttribute && normalized.enumValue
                            ? this.getMappingKey(normalized.className, normalized.enumAttribute, normalized.enumValue)
                            : this.getMappingKey(normalized.className);
                        this.mappings.set(mappingKey, normalized);
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
                    
                    // Update the edit button visibility in the sidebar
                    // This will show the button since mappings have been loaded
                    if (sidebar && sidebar.updateEditMappingButtonVisibility) {
                        sidebar.updateEditMappingButtonVisibility();
                    }
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
                        const normalized = this.normalizeMapping(mapping, index);
                        // Use composite key for submappings, className for base mappings
                        const mappingKey = normalized.enumAttribute && normalized.enumValue
                            ? this.getMappingKey(normalized.className, normalized.enumAttribute, normalized.enumValue)
                            : this.getMappingKey(normalized.className);
                        this.mappings.set(mappingKey, normalized);
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
            
            // Update the edit button visibility in the sidebar
            const sidebar = (window as any).globalLeftSidebar;
            if (sidebar && sidebar.updateEditMappingButtonVisibility) {
                sidebar.updateEditMappingButtonVisibility();
            }
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
        
        // Migrate old format (sourceClass/targetClass) to new format (sourceTargetPairs)
        let sourceTargetPairs = mapping.sourceTargetPairs;
        if (!sourceTargetPairs && (mapping as any).sourceClass && (mapping as any).targetClass) {
            // Convert old single pair format to new array format
            sourceTargetPairs = [{
                sourceClass: (mapping as any).sourceClass,
                targetClass: (mapping as any).targetClass
            }];
        }
        
        const normalized: ShapeMapping = {
            ...mapping,
            shapeName: mapping.shapeName || `Shape ${index + 1}`,
            shapeConfig: this.normalizeShapeConfig(mapping.shapeConfig, mapping.shapeId),
            sourceTargetPairs: sourceTargetPairs
        };
        
        // Remove old properties if they exist
        delete (normalized as any).sourceClass;
        delete (normalized as any).targetClass;
        
        return normalized;
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
                filled: false,
                lineThickness: 2,
                lineStyle: 'solid'
            };
        }
        const normalized = {
            ...config,
            // Ensure filled is set (default to false if not specified)
            filled: config.filled !== undefined ? config.filled : false,
            // Preserve svgContent if it exists (for custom-svg shapes)
            svgContent: config.svgContent
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


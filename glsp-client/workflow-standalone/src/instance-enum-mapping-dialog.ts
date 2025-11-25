/********************************************************************************
 * Copyright (c) 2024 Eclipse GLSP and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * SPDX-License-Identifier: EPL-2.0
 ********************************************************************************/

import { ShapeMapping } from './shape-mapping-dialog';

export interface EnumAttributeInfo {
    attrName: string;
    enumType: string;
    literals: string[];
}

export class InstanceEnumMappingDialog {
    private dialog: HTMLElement | null = null;
    private backdrop: HTMLElement | null = null;
    private onSelectCallback: ((enumAttribute: string, enumValue: string) => void) | null = null;
    private onCancelCallback: (() => void) | null = null;

    public show(
        className: string,
        enumAttributes: EnumAttributeInfo[],
        currentMappings: Map<string, ShapeMapping>,
        currentEnumAttributeName: string | null,
        currentEnumValue: string | null,
        onSelect: (enumAttribute: string, enumValue: string) => void,
        onCancel: () => void
    ): void {
        this.onSelectCallback = onSelect;
        this.onCancelCallback = onCancel;

        // Remove existing dialog if present
        if (this.dialog) {
            this.dialog.remove();
        }
        if (this.backdrop) {
            this.backdrop.remove();
        }

        this.createDialog(className, enumAttributes, currentMappings, currentEnumAttributeName, currentEnumValue);
        if (this.backdrop) {
            document.body.appendChild(this.backdrop);
        }
        if (this.dialog) {
            document.body.appendChild(this.dialog);
        } else {
            console.error('[InstanceEnumMappingDialog] Dialog is null!');
        }
    }

    public hide(): void {
        if (this.dialog && this.dialog.parentNode) {
            document.body.removeChild(this.dialog);
        }
        if (this.backdrop && this.backdrop.parentNode) {
            document.body.removeChild(this.backdrop);
        }
        this.dialog = null;
        this.backdrop = null;
    }

    private createDialog(
        className: string, 
        enumAttributes: EnumAttributeInfo[], 
        currentMappings: Map<string, ShapeMapping>,
        currentEnumAttributeName: string | null,
        currentEnumValue: string | null
    ): void {
        // Create backdrop
        this.backdrop = document.createElement('div');
        this.backdrop.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            z-index: 9998;
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
            padding: 24px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            z-index: 9999;
            min-width: 400px;
            max-width: 600px;
            max-height: 80vh;
            overflow-y: auto;
        `;

        const title = document.createElement('h2');
        title.textContent = `Select Mapping for ${className}`;
        title.style.cssText = 'margin: 0 0 20px 0; font-size: 20px; color: #333;';
        this.dialog.appendChild(title);

        const description = document.createElement('p');
        description.textContent = 'This class has enum attributes with submappings. Select which mapping to apply:';
        description.style.cssText = 'margin: 0 0 20px 0; color: #666; font-size: 14px;';
        this.dialog.appendChild(description);

        // Create sections for each enum attribute
        enumAttributes.forEach(enumAttr => {
            const section = document.createElement('div');
            section.style.cssText = 'margin-bottom: 24px;';

            const sectionTitle = document.createElement('h3');
            sectionTitle.textContent = `When ${enumAttr.attrName} =`;
            sectionTitle.style.cssText = 'margin: 0 0 12px 0; font-size: 16px; color: #444;';
            section.appendChild(sectionTitle);

            // Track if we've selected a radio button for this enum attribute
            let hasSelectedForThisAttr = false;

            // Create radio buttons for each literal
            enumAttr.literals.forEach(literal => {
                const label = document.createElement('label');
                label.style.cssText = 'display: block; margin-bottom: 8px; padding: 8px; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;';
                label.addEventListener('mouseenter', () => {
                    label.style.background = '#f5f5f5';
                });
                label.addEventListener('mouseleave', () => {
                    label.style.background = 'white';
                });

                const radio = document.createElement('input');
                radio.type = 'radio';
                radio.name = `enum_${enumAttr.attrName}`;
                radio.value = literal;
                radio.style.cssText = 'margin-right: 8px;';

                // Check if there's a mapping for this enum value
                const mappingKey = `${className}:${enumAttr.attrName}:${literal}`;
                const hasMapping = currentMappings.has(mappingKey);
                const baseMappingKey = className;
                const hasBaseMapping = currentMappings.has(baseMappingKey);

                // Check if this matches the current instance's enum attribute value
                if (!hasSelectedForThisAttr && currentEnumAttributeName === enumAttr.attrName && currentEnumValue === literal) {
                    radio.checked = true;
                    hasSelectedForThisAttr = true;
                }

                const labelText = document.createElement('span');
                labelText.textContent = literal;
                labelText.style.cssText = 'font-size: 14px; color: #333;';

                const mappingStatus = document.createElement('span');
                if (hasMapping) {
                    mappingStatus.textContent = ' (has custom mapping)';
                    mappingStatus.style.cssText = 'color: #28a745; font-size: 12px; margin-left: 8px;';
                } else if (hasBaseMapping) {
                    mappingStatus.textContent = ' (uses base mapping)';
                    mappingStatus.style.cssText = 'color: #ffc107; font-size: 12px; margin-left: 8px;';
                } else {
                    mappingStatus.textContent = ' (no mapping)';
                    mappingStatus.style.cssText = 'color: #dc3545; font-size: 12px; margin-left: 8px;';
                }

                label.appendChild(radio);
                label.appendChild(labelText);
                label.appendChild(mappingStatus);
                section.appendChild(label);
            });

            // Add option for base mapping (no enum condition)
            const baseLabel = document.createElement('label');
            baseLabel.style.cssText = 'display: block; margin-top: 12px; padding: 8px; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; background: #f8f9fa;';
            baseLabel.addEventListener('mouseenter', () => {
                baseLabel.style.background = '#e9ecef';
            });
            baseLabel.addEventListener('mouseleave', () => {
                baseLabel.style.background = '#f8f9fa';
            });

            const baseRadio = document.createElement('input');
            baseRadio.type = 'radio';
            baseRadio.name = `enum_${enumAttr.attrName}`;
            baseRadio.value = '__base__';
            baseRadio.style.cssText = 'margin-right: 8px;';

            const baseMappingKey = className;
            const hasBaseMapping = currentMappings.has(baseMappingKey);
            
            // Check if base mapping should be selected (no current enum value set for this attribute)
            if (!hasSelectedForThisAttr) {
                // No enum value is set for this attribute, so base mapping is active
                if (!currentEnumAttributeName || currentEnumAttributeName !== enumAttr.attrName) {
                    baseRadio.checked = true;
                    hasSelectedForThisAttr = true;
                } else if (!hasBaseMapping && !currentEnumAttributeName) {
                    // Default if no mappings exist and no current value
                    baseRadio.checked = true;
                    hasSelectedForThisAttr = true;
                }
            }

            const baseLabelText = document.createElement('span');
            baseLabelText.textContent = 'Use base mapping (no enum condition)';
            baseLabelText.style.cssText = 'font-size: 14px; color: #333; font-weight: 500;';

            const baseMappingStatus = document.createElement('span');
            if (hasBaseMapping) {
                baseMappingStatus.textContent = ' (mapped)';
                baseMappingStatus.style.cssText = 'color: #28a745; font-size: 12px; margin-left: 8px;';
            } else {
                baseMappingStatus.textContent = ' (not mapped)';
                baseMappingStatus.style.cssText = 'color: #dc3545; font-size: 12px; margin-left: 8px;';
            }

            baseLabel.appendChild(baseRadio);
            baseLabel.appendChild(baseLabelText);
            baseLabel.appendChild(baseMappingStatus);
            section.appendChild(baseLabel);

            if (this.dialog) {
                this.dialog.appendChild(section);
            }
        });

        // Create buttons
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = 'display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px;';

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.style.cssText = 'padding: 10px 20px; border: 1px solid #ddd; border-radius: 4px; background: white; cursor: pointer; font-size: 14px;';
        cancelBtn.addEventListener('click', () => {
            if (this.onCancelCallback) {
                this.onCancelCallback();
            }
            this.hide();
        });

        const selectBtn = document.createElement('button');
        selectBtn.textContent = 'Apply';
        selectBtn.style.cssText = 'padding: 10px 20px; border: none; border-radius: 4px; background: #007bff; color: white; cursor: pointer; font-size: 14px;';
        selectBtn.addEventListener('click', () => {
            // Find the selected enum attribute and value
            let selectedAttribute: string | null = null;
            let selectedValue: string | null = null;

            enumAttributes.forEach(enumAttr => {
                const selectedRadio = this.dialog!.querySelector(`input[name="enum_${enumAttr.attrName}"]:checked`) as HTMLInputElement;
                if (selectedRadio && selectedRadio.value !== '__base__') {
                    selectedAttribute = enumAttr.attrName;
                    selectedValue = selectedRadio.value;
                }
            });

            if (selectedAttribute && selectedValue && this.onSelectCallback) {
                this.onSelectCallback(selectedAttribute, selectedValue);
            } else if (this.onSelectCallback) {
                // Use base mapping (no enum condition)
                this.onSelectCallback('', '');
            }
            this.hide();
        });

        buttonContainer.appendChild(cancelBtn);
        buttonContainer.appendChild(selectBtn);
        this.dialog.appendChild(buttonContainer);
    }
}


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
import { createRenameClassAction, createChangeClassTypeAction, createDeleteClassAction } from './ecore-client-actions';

export interface ClassInfo {
    className: string;
    isAbstract: boolean;
    isInterface: boolean;
    attributes: Array<{
        name: string;
        type: string;
        lowerBound: number;
        upperBound: number;
        unique: boolean;
        ordered: boolean;
    }>;
    references: Array<{
        name: string;
        type: string;
        lowerBound: number;
        upperBound: number;
        containment: boolean;
        container: boolean;
        unique: boolean;
        ordered: boolean;
    }>;
}

export class EcoreContextMenu {
    private menu: HTMLDivElement;
    private actionDispatcher: GLSPActionDispatcher | null = null;
    private currentClass: ClassInfo | null = null;

    constructor() {
        this.menu = document.createElement('div');
        this.menu.style.cssText = `
            position: fixed;
            background-color: white;
            border: 1px solid #ccc;
            border-radius: 4px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            padding: 8px 0;
            min-width: 200px;
            z-index: 10000;
            font-family: Arial, sans-serif;
            font-size: 14px;
            display: none;
        `;
        
        document.body.appendChild(this.menu);
        
        // Hide menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!this.menu.contains(e.target as Node)) {
                this.hide();
            }
        });
    }

    public setActionDispatcher(dispatcher: GLSPActionDispatcher): void {
        this.actionDispatcher = dispatcher;
    }

    public show(event: MouseEvent, classInfo: ClassInfo): void {
        this.currentClass = classInfo;
        this.updateMenu();
        
        this.menu.style.display = 'block';
        this.menu.style.left = `${event.clientX}px`;
        this.menu.style.top = `${event.clientY}px`;
        
        // Prevent the event from bubbling
        event.preventDefault();
        event.stopPropagation();
    }

    public hide(): void {
        this.menu.style.display = 'none';
        this.currentClass = null;
    }

    private updateMenu(): void {
        if (!this.currentClass) return;

        this.menu.innerHTML = '';

        // Class name section
        const nameSection = document.createElement('div');
        nameSection.style.cssText = 'padding: 8px 12px; border-bottom: 1px solid #eee;';
        
        const nameLabel = document.createElement('div');
        nameLabel.textContent = 'Class: ' + this.currentClass.className;
        nameLabel.style.cssText = 'font-weight: bold; margin-bottom: 4px;';
        nameSection.appendChild(nameLabel);

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.value = this.currentClass.className;
        nameInput.style.cssText = 'width: 100%; padding: 4px; border: 1px solid #ccc; border-radius: 3px; font-size: 12px;';
        nameInput.addEventListener('change', () => this.renameClass(nameInput.value));
        nameSection.appendChild(nameInput);

        this.menu.appendChild(nameSection);

        // Class type section
        const typeSection = document.createElement('div');
        typeSection.style.cssText = 'padding: 8px 12px; border-bottom: 1px solid #eee;';
        
        const typeLabel = document.createElement('div');
        typeLabel.textContent = 'Class Type:';
        typeLabel.style.cssText = 'font-weight: bold; margin-bottom: 4px;';
        typeSection.appendChild(typeLabel);

        const typeContainer = document.createElement('div');
        typeContainer.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';

        const concreteOption = this.createRadioOption('concrete', 'Concrete', !this.currentClass.isAbstract && !this.currentClass.isInterface);
        const abstractOption = this.createRadioOption('abstract', 'Abstract', this.currentClass.isAbstract);
        const interfaceOption = this.createRadioOption('interface', 'Interface', this.currentClass.isInterface);

        typeContainer.appendChild(concreteOption);
        typeContainer.appendChild(abstractOption);
        typeContainer.appendChild(interfaceOption);
        typeSection.appendChild(typeContainer);

        this.menu.appendChild(typeSection);

        // Quick actions section
        const actionsSection = document.createElement('div');
        actionsSection.style.cssText = 'padding: 8px 12px;';
        
        const actionsLabel = document.createElement('div');
        actionsLabel.textContent = 'Quick Actions:';
        actionsLabel.style.cssText = 'font-weight: bold; margin-bottom: 4px;';
        actionsSection.appendChild(actionsLabel);

        const actionsContainer = document.createElement('div');
        actionsContainer.style.cssText = 'display: flex; flex-direction: column; gap: 2px;';

        const editPropertiesBtn = this.createMenuItem('Edit Properties...', () => this.editProperties());
        const deleteClassBtn = this.createMenuItem('Delete Class...', () => this.deleteClass());

        actionsContainer.appendChild(editPropertiesBtn);
        actionsContainer.appendChild(deleteClassBtn);
        actionsSection.appendChild(actionsContainer);

        this.menu.appendChild(actionsSection);
    }

    private createRadioOption(value: string, label: string, checked: boolean): HTMLLabelElement {
        const labelElement = document.createElement('label');
        labelElement.style.cssText = 'display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 12px;';
        
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'classType';
        radio.value = value;
        radio.checked = checked;
        radio.addEventListener('change', () => this.changeClassType(value));
        
        const text = document.createElement('span');
        text.textContent = label;
        
        labelElement.appendChild(radio);
        labelElement.appendChild(text);
        
        return labelElement;
    }

    private createMenuItem(text: string, onClick: () => void): HTMLDivElement {
        const item = document.createElement('div');
        item.textContent = text;
        item.style.cssText = `
            padding: 6px 8px;
            cursor: pointer;
            border-radius: 3px;
            font-size: 12px;
            transition: background-color 0.2s;
        `;
        
        item.addEventListener('mouseenter', () => {
            item.style.backgroundColor = '#f0f0f0';
        });
        
        item.addEventListener('mouseleave', () => {
            item.style.backgroundColor = 'transparent';
        });
        
        item.addEventListener('click', () => {
            onClick();
            this.hide();
        });
        
        return item;
    }

    private renameClass(newName: string): void {
        if (!this.currentClass || !this.actionDispatcher || newName === this.currentClass.className) {
            return;
        }

        if (!newName.trim()) {
            alert('Class name cannot be empty');
            return;
        }

        try {
            const action = createRenameClassAction(this.currentClass.className, newName.trim());
            this.actionDispatcher.dispatch(action);
            console.log(`Renaming class from ${this.currentClass.className} to ${newName}`);
        } catch (error) {
            console.error('Error renaming class:', error);
            alert(`Error renaming class: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private changeClassType(type: string): void {
        if (!this.currentClass || !this.actionDispatcher) {
            return;
        }

        console.log(`Changing class type to: ${type}`);
        
        try {
            const action = createChangeClassTypeAction(this.currentClass.className, type as 'abstract' | 'concrete' | 'interface');
            this.actionDispatcher.dispatch(action);
            console.log(`Changed class ${this.currentClass.className} to type ${type}`);
        } catch (error) {
            console.error('Error changing class type:', error);
            alert(`Error changing class type: ${error instanceof Error ? error.message : String(error)}`);
        }
    }


    private editProperties(): void {
        if (!this.currentClass) {
            return;
        }

        // Open the full property editor
        alert(`Opening property editor for class: ${this.currentClass.className}\n\nThis would show the full React property editor with all attributes and references.`);
        
        // TODO: Integrate with the React property editor component
    }

    private deleteClass(): void {
        if (!this.currentClass || !this.actionDispatcher) {
            return;
        }

        const className = this.currentClass.className;
        
        // Show confirmation dialog with options
        const message = `Are you sure you want to delete the class '${className}'?\n\n` +
                       `This action will:\n` +
                       `• Remove the class from the metamodel\n` +
                       `• Remove all references to this class\n` +
                       `• Update the entire Petri net structure\n\n` +
                       `This action cannot be undone.`;
        
        if (confirm(message)) {
            try {
                const action = createDeleteClassAction(className, true); // Force delete to remove references
                this.actionDispatcher.dispatch(action);
                console.log(`Deleted class ${className}`);
            } catch (error) {
                console.error('Error deleting class:', error);
                alert(`Error deleting class: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    }

    public destroy(): void {
        if (this.menu.parentNode) {
            this.menu.parentNode.removeChild(this.menu);
        }
    }
}

export interface EdgeInfo {
    edgeId: string;
    sourceId: string;
    targetId: string;
    currentType: string;
}

export class EcoreEdgeContextMenu {
    private menu: HTMLDivElement;
    private actionDispatcher: GLSPActionDispatcher | null = null;
    private currentEdge: EdgeInfo | null = null;

    constructor() {
        this.menu = document.createElement('div');
        this.menu.style.cssText = `
            position: fixed;
            background-color: white;
            border: 1px solid #ccc;
            border-radius: 4px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            z-index: 1000;
            min-width: 200px;
            display: none;
            font-family: Arial, sans-serif;
        `;
        
        document.body.appendChild(this.menu);
        
        // Hide menu when clicking outside
        document.addEventListener('click', (event) => {
            if (!this.menu.contains(event.target as Node)) {
                this.hide();
            }
        });
    }

    public setActionDispatcher(dispatcher: GLSPActionDispatcher): void {
        this.actionDispatcher = dispatcher;
    }

    public show(event: MouseEvent, edgeInfo: EdgeInfo): void {
        this.currentEdge = edgeInfo;
        this.updateMenu();
        
        this.menu.style.display = 'block';
        this.menu.style.left = `${event.clientX}px`;
        this.menu.style.top = `${event.clientY}px`;
        
        // Prevent the event from bubbling
        event.preventDefault();
        event.stopPropagation();
    }

    public hide(): void {
        this.menu.style.display = 'none';
        this.currentEdge = null;
    }

    private updateMenu(): void {
        if (!this.currentEdge) return;

        this.menu.innerHTML = '';

        // Edge info section
        const infoSection = document.createElement('div');
        infoSection.style.cssText = 'padding: 8px 12px; border-bottom: 1px solid #eee; background-color: #f8f9fa;';
        
        const edgeLabel = document.createElement('div');
        edgeLabel.textContent = 'Edge Type';
        edgeLabel.style.cssText = 'font-weight: bold; margin-bottom: 4px;';
        infoSection.appendChild(edgeLabel);

        const edgeInfo = document.createElement('div');
        edgeInfo.textContent = `${this.currentEdge.sourceId} → ${this.currentEdge.targetId}`;
        edgeInfo.style.cssText = 'font-size: 11px; color: #666;';
        infoSection.appendChild(edgeInfo);

        this.menu.appendChild(infoSection);

        // Edge type section
        const typeSection = document.createElement('div');
        typeSection.style.cssText = 'padding: 8px 12px;';
        
        const typeLabel = document.createElement('div');
        typeLabel.textContent = 'Change to:';
        typeLabel.style.cssText = 'font-weight: bold; margin-bottom: 6px;';
        typeSection.appendChild(typeLabel);

        const typeContainer = document.createElement('div');
        typeContainer.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';

        // Add edge type options
        const edgeTypes = [
            { value: 'edge:ecore-reference', label: 'Association' },
            { value: 'edge:ecore-containment', label: 'Composition' },
            { value: 'edge:ecore-inheritance', label: 'Inheritance' }
        ];

        edgeTypes.forEach(edgeType => {
            const isCurrentType = this.currentEdge!.currentType === edgeType.value;
            const option = this.createEdgeTypeOption(edgeType.value, edgeType.label, isCurrentType);
            typeContainer.appendChild(option);
        });

        typeSection.appendChild(typeContainer);
        this.menu.appendChild(typeSection);

        // Multiplicity section (shown only for containment)
        const multiplicitySection = this.createMultiplicitySection();
        this.menu.appendChild(multiplicitySection);

        // Actions section
        const actionsSection = document.createElement('div');
        actionsSection.style.cssText = 'padding: 8px 12px; border-top: 1px solid #eee;';
        
        const actionsLabel = document.createElement('div');
        actionsLabel.textContent = 'Actions:';
        actionsLabel.style.cssText = 'font-weight: bold; margin-bottom: 4px;';
        actionsSection.appendChild(actionsLabel);

        const actionsContainer = document.createElement('div');
        actionsContainer.style.cssText = 'display: flex; flex-direction: column; gap: 2px;';

        const deleteEdgeBtn = this.createMenuItem('Delete Edge', () => this.deleteEdge());
        actionsContainer.appendChild(deleteEdgeBtn);
        actionsSection.appendChild(actionsContainer);

        this.menu.appendChild(actionsSection);
    }

    private createEdgeTypeOption(value: string, label: string, checked: boolean): HTMLLabelElement {
        const labelElement = document.createElement('label');
        labelElement.style.cssText = 'display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 12px;';
        
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'edgeType';
        radio.value = value;
        radio.checked = checked;
        radio.addEventListener('change', () => this.changeEdgeType(value));
        
        const text = document.createElement('span');
        text.textContent = label;
        
        labelElement.appendChild(radio);
        labelElement.appendChild(text);
        
        return labelElement;
    }

    private createMultiplicitySection(): HTMLDivElement {
        const multiplicitySection = document.createElement('div');
        multiplicitySection.style.cssText = 'padding: 8px 12px; border-top: 1px solid #eee; display: none;';
        multiplicitySection.id = 'multiplicity-section';
        
        const multiplicityLabel = document.createElement('div');
        multiplicityLabel.textContent = 'Multiplicity (for containment):';
        multiplicityLabel.style.cssText = 'font-weight: bold; margin-bottom: 6px;';
        multiplicitySection.appendChild(multiplicityLabel);

        // Create input container
        const inputContainer = document.createElement('div');
        inputContainer.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-bottom: 8px;';

        // Lower bound input
        const lowerBoundLabel = document.createElement('span');
        lowerBoundLabel.textContent = 'Lower:';
        lowerBoundLabel.style.cssText = 'font-size: 11px; min-width: 40px;';
        inputContainer.appendChild(lowerBoundLabel);

        const lowerBoundInput = document.createElement('input');
        lowerBoundInput.type = 'number';
        lowerBoundInput.min = '0';
        lowerBoundInput.value = '0';
        lowerBoundInput.style.cssText = `
            width: 50px;
            padding: 2px 4px;
            border: 1px solid #ccc;
            border-radius: 3px;
            font-size: 11px;
        `;
        inputContainer.appendChild(lowerBoundInput);

        // Separator
        const separator = document.createElement('span');
        separator.textContent = '..';
        separator.style.cssText = 'font-size: 11px;';
        inputContainer.appendChild(separator);

        // Upper bound input
        const upperBoundLabel = document.createElement('span');
        upperBoundLabel.textContent = 'Upper:';
        upperBoundLabel.style.cssText = 'font-size: 11px; min-width: 40px;';
        inputContainer.appendChild(upperBoundLabel);

        const upperBoundInput = document.createElement('input');
        upperBoundInput.type = 'number';
        upperBoundInput.min = '1';
        upperBoundInput.value = '1';
        upperBoundInput.style.cssText = `
            width: 50px;
            padding: 2px 4px;
            border: 1px solid #ccc;
            border-radius: 3px;
            font-size: 11px;
        `;
        inputContainer.appendChild(upperBoundInput);

        // Asterisk option for unlimited
        const unlimitedLabel = document.createElement('label');
        unlimitedLabel.style.cssText = 'display: flex; align-items: center; gap: 4px; font-size: 11px; cursor: pointer;';
        
        const unlimitedCheckbox = document.createElement('input');
        unlimitedCheckbox.type = 'checkbox';
        unlimitedCheckbox.id = 'unlimited-upper';
        unlimitedCheckbox.addEventListener('change', () => {
            if (unlimitedCheckbox.checked) {
                upperBoundInput.value = '-1';
                upperBoundInput.disabled = true;
            } else {
                upperBoundInput.value = '1';
                upperBoundInput.disabled = false;
            }
        });
        
        const unlimitedText = document.createElement('span');
        unlimitedText.textContent = 'Unlimited (*)';
        
        unlimitedLabel.appendChild(unlimitedCheckbox);
        unlimitedLabel.appendChild(unlimitedText);
        inputContainer.appendChild(unlimitedLabel);

        multiplicitySection.appendChild(inputContainer);

        // Add apply button for containment
        const applyButton = document.createElement('button');
        applyButton.textContent = 'Apply Containment';
        applyButton.style.cssText = `
            padding: 4px 8px;
            background-color: #007acc;
            color: white;
            border: none;
            border-radius: 3px;
            cursor: pointer;
            font-size: 11px;
        `;
        applyButton.addEventListener('click', () => this.applyContainment(lowerBoundInput, upperBoundInput));
        multiplicitySection.appendChild(applyButton);

        return multiplicitySection;
    }


    private createMenuItem(text: string, onClick: () => void): HTMLDivElement {
        const item = document.createElement('div');
        item.textContent = text;
        item.style.cssText = `
            padding: 6px 8px;
            cursor: pointer;
            border-radius: 3px;
            font-size: 12px;
            transition: background-color 0.2s;
        `;
        
        item.addEventListener('mouseenter', () => {
            item.style.backgroundColor = '#f0f0f0';
        });
        
        item.addEventListener('mouseleave', () => {
            item.style.backgroundColor = 'transparent';
        });
        
        item.addEventListener('click', () => {
            onClick();
            this.hide();
        });
        
        return item;
    }

    private changeEdgeType(newType: string): void {
        if (!this.currentEdge || !this.actionDispatcher) return;

        // Show/hide multiplicity section based on edge type
        const multiplicitySection = document.getElementById('multiplicity-section');
        if (multiplicitySection) {
            multiplicitySection.style.display = newType === 'edge:ecore-containment' ? 'block' : 'none';
        }

        // If changing to containment, wait for multiplicity selection
        if (newType === 'edge:ecore-containment') {
            // Don't dispatch immediately, wait for user to select multiplicity
            return;
        }

        // For non-containment types, dispatch immediately
        this.dispatchEdgeTypeChange(newType, '1..1'); // Default for reference
    }

    private dispatchEdgeTypeChange(newType: string, multiplicity: string): void {
        if (!this.currentEdge || !this.actionDispatcher) return;

        // Parse multiplicity to get lower and upper bounds
        const bounds = this.parseMultiplicity(multiplicity);

        // Create action to change edge type
        const action = {
            kind: 'changeEdgeType',
            edgeId: this.currentEdge.edgeId,
            newType: newType,
            sourceId: this.currentEdge.sourceId,
            targetId: this.currentEdge.targetId,
            lowerBound: bounds.lower,
            upperBound: bounds.upper
        };

        this.actionDispatcher.dispatch(action);
    }

    private dispatchEdgeTypeChangeWithBounds(newType: string, lowerBound: number, upperBound: number): void {
        if (!this.currentEdge || !this.actionDispatcher) return;

        // Create action to change edge type with custom bounds
        const action = {
            kind: 'changeEdgeType',
            edgeId: this.currentEdge.edgeId,
            newType: newType,
            sourceId: this.currentEdge.sourceId,
            targetId: this.currentEdge.targetId,
            lowerBound: lowerBound,
            upperBound: upperBound
        };

        this.actionDispatcher.dispatch(action);
    }

    private parseMultiplicity(multiplicity: string): { lower: number, upper: number } {
        // Parse strings like "0..1", "1..*", "0..*", etc.
        const parts = multiplicity.split('..');
        const lower = parseInt(parts[0]) || 0;
        const upper = parts[1] === '*' ? -1 : parseInt(parts[1]) || 1;
        return { lower, upper };
    }

    private applyContainment(lowerBoundInput: HTMLInputElement, upperBoundInput: HTMLInputElement): void {
        // Get values from input fields
        const lowerBound = parseInt(lowerBoundInput.value);
        const upperBound = parseInt(upperBoundInput.value);

        // Validate inputs
        if (isNaN(lowerBound) || isNaN(upperBound)) {
            alert('Please enter valid numbers for bounds');
            return;
        }

        if (lowerBound < 0) {
            alert('Lower bound must be 0 or greater');
            return;
        }

        if (upperBound < 1 && upperBound !== -1) {
            alert('Upper bound must be 1 or greater (or -1 for unlimited)');
            return;
        }

        if (upperBound !== -1 && upperBound < lowerBound) {
            alert('Upper bound must be greater than or equal to lower bound');
            return;
        }

        // Apply containment with custom multiplicity
        this.dispatchEdgeTypeChangeWithBounds('edge:ecore-containment', lowerBound, upperBound);
        this.hide();
    }

    private deleteEdge(): void {
        if (!this.currentEdge || !this.actionDispatcher) return;

        // Create action to delete edge
        const action = {
            kind: 'deleteEdge',
            edgeId: this.currentEdge.edgeId
        };

        this.actionDispatcher.dispatch(action);
    }

    public destroy(): void {
        if (this.menu.parentNode) {
            this.menu.parentNode.removeChild(this.menu);
        }
    }
}

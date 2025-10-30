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
import { createRenameClassAction, createChangeClassTypeAction, createDeleteClassAction, ClassInfo } from './ecore-client-actions';

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

        const abstractOption = this.createCheckboxOption('abstract', 'Abstract', this.currentClass.isAbstract);
        const interfaceOption = this.createCheckboxOption('interface', 'Interface', this.currentClass.isInterface);

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

        const addAttributeBtn = this.createMenuItem('Add Attribute...', () => this.addAttribute());
        const deleteAttributeBtn = this.createMenuItem('Delete Attribute...', () => this.deleteAttribute());
        const deleteClassBtn = this.createMenuItem('Delete Class...', () => this.deleteClass());

        actionsContainer.appendChild(addAttributeBtn);
        actionsContainer.appendChild(deleteAttributeBtn);
        actionsContainer.appendChild(deleteClassBtn);
        actionsSection.appendChild(actionsContainer);

        this.menu.appendChild(actionsSection);
    }

    private createCheckboxOption(value: string, label: string, checked: boolean): HTMLLabelElement {
        const labelElement = document.createElement('label');
        labelElement.style.cssText = 'display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 12px;';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.name = `classType_${value}`;
        checkbox.value = value;
        checkbox.checked = checked;
        checkbox.addEventListener('change', () => this.handleClassTypeChange(value, checkbox.checked));
        
        const text = document.createElement('span');
        text.textContent = label;
        
        labelElement.appendChild(checkbox);
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
            
        } catch (error) {
            console.error('Error renaming class:', error);
            alert(`Error renaming class: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private handleClassTypeChange(value: string, checked: boolean): void {
        if (!this.currentClass || !this.actionDispatcher) {
            return;
        }

        // Get current checkboxes
        const abstractCheckbox = document.querySelector('input[name="classType_abstract"]') as HTMLInputElement;
        const interfaceCheckbox = document.querySelector('input[name="classType_interface"]') as HTMLInputElement;

        // Determine the new class type based on checkbox states
        let newType: 'abstract' | 'concrete' | 'interface' | 'abstract-interface';
        
        const abstractChecked = abstractCheckbox?.checked || false;
        const interfaceChecked = interfaceCheckbox?.checked || false;
        
        if (abstractChecked && interfaceChecked) {
            // Both are checked - abstract interface (purple)
            newType = 'abstract-interface';
        } else if (abstractChecked) {
            // Only abstract is checked
            newType = 'abstract';
        } else if (interfaceChecked) {
            // Only interface is checked
            newType = 'interface';
        } else {
            // Neither is checked, default to concrete
            newType = 'concrete';
        }

        
        
        try {
            const action = createChangeClassTypeAction(this.currentClass.className, newType);
            this.actionDispatcher.dispatch(action);
            
        } catch (error) {
            console.error('Error changing class type:', error);
            alert(`Error changing class type: ${error instanceof Error ? error.message : String(error)}`);
        }
    }



    private addAttribute(): void {
        if (!this.currentClass) return;
        // Call the global showAddAttributeDialog function
        if ((window as any).showAddAttributeDialog) {
            (window as any).showAddAttributeDialog(this.currentClass.className);
        }
        this.hide();
    }

    private deleteAttribute(): void {
        if (!this.currentClass) return;
        // Call the global showDeleteAttributeDialog function
        if ((window as any).showDeleteAttributeDialog) {
            const attributes = this.currentClass.attributes || [];
            (window as any).showDeleteAttributeDialog(this.currentClass.className, attributes);
        }
        this.hide();
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
        edgeLabel.textContent = 'Edge';
        edgeLabel.style.cssText = 'font-weight: bold; margin-bottom: 4px;';
        infoSection.appendChild(edgeLabel);

        const edgeInfo = document.createElement('div');
        edgeInfo.textContent = `${this.currentEdge.sourceId} → ${this.currentEdge.targetId}`;
        edgeInfo.style.cssText = 'font-size: 11px; color: #666;';
        infoSection.appendChild(edgeInfo);

        this.menu.appendChild(infoSection);

        // Actions section
        const actionsSection = document.createElement('div');
        actionsSection.style.cssText = 'padding: 8px 12px;';
        
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

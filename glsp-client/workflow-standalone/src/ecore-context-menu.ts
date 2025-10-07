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
import { createRenameClassAction, createChangeClassTypeAction } from './ecore-client-actions';

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

        actionsContainer.appendChild(editPropertiesBtn);
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

    public destroy(): void {
        if (this.menu.parentNode) {
            this.menu.parentNode.removeChild(this.menu);
        }
    }
}

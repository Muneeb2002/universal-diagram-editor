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
import { createSwitchModeAction, createCreateInstanceAction } from './ecore-client-actions';

export class EcoreToolbar {
    private toolbar: HTMLDivElement;
    private modeLabel: HTMLSpanElement;
    private classesDropdown: HTMLSelectElement;
    private currentMode: 'metamodel' | 'instance' = 'metamodel';
    private actionDispatcher: GLSPActionDispatcher | null = null;

    constructor() {
        this.toolbar = document.createElement('div');
        this.toolbar.style.cssText = `
            position: fixed;
            bottom: 10px;
            right: 10px;
            z-index: 1000;
            background-color: #f0f0f0;
            border: 1px solid #ccc;
            border-radius: 4px;
            padding: 10px;
            display: flex;
            flex-direction: column;
            gap: 10px;
            font-family: Arial, sans-serif;
            font-size: 14px;
        `;

        // Create mode toggle section
        const modeSection = document.createElement('div');
        modeSection.style.cssText = 'display: flex; flex-direction: column; gap: 5px;';

        this.modeLabel = document.createElement('span');
        this.modeLabel.textContent = 'Mode: Metamodel';
        this.modeLabel.style.cssText = 'font-weight: bold; font-size: 12px;';
        modeSection.appendChild(this.modeLabel);

        const modeButtonsContainer = document.createElement('div');
        modeButtonsContainer.style.cssText = 'display: flex; gap: 5px;';

        const metamodelButton = this.createButton('Metamodel View', () => this.switchMode('metamodel'));
        const instanceButton = this.createButton('Instance View', () => this.switchMode('instance'));

        modeButtonsContainer.appendChild(metamodelButton);
        modeButtonsContainer.appendChild(instanceButton);
        modeSection.appendChild(modeButtonsContainer);

        this.toolbar.appendChild(modeSection);

        // Create separator
        const separator = document.createElement('hr');
        separator.style.cssText = 'width: 100%; border: none; border-top: 1px solid #ccc; margin: 0;';
        this.toolbar.appendChild(separator);

        // Create instance creation section
        const instanceSection = document.createElement('div');
        instanceSection.style.cssText = 'display: flex; flex-direction: column; gap: 5px;';

        const instanceLabel = document.createElement('span');
        instanceLabel.textContent = 'Create Instance:';
        instanceLabel.style.cssText = 'font-weight: bold; font-size: 12px;';
        instanceSection.appendChild(instanceLabel);

        this.classesDropdown = document.createElement('select');
        this.classesDropdown.style.cssText = `
            padding: 5px;
            border: 1px solid #ccc;
            border-radius: 3px;
            background-color: white;
            font-size: 12px;
        `;
        this.classesDropdown.innerHTML = '<option value="">No classes available</option>';
        instanceSection.appendChild(this.classesDropdown);

        const createButton = this.createButton('Create Instance', () => this.createInstance());
        createButton.style.width = '100%';
        instanceSection.appendChild(createButton);

        this.toolbar.appendChild(instanceSection);
    }

    private createButton(text: string, onClick: () => void): HTMLButtonElement {
        const button = document.createElement('button');
        button.textContent = text;
        button.style.cssText = `
            padding: 5px 10px;
            background-color: #007acc;
            color: white;
            border: none;
            border-radius: 3px;
            cursor: pointer;
            font-size: 12px;
        `;

        button.addEventListener('mouseover', () => {
            button.style.backgroundColor = '#005a9e';
        });

        button.addEventListener('mouseout', () => {
            button.style.backgroundColor = '#007acc';
        });

        button.addEventListener('click', onClick);

        return button;
    }

    public setActionDispatcher(dispatcher: GLSPActionDispatcher): void {
        this.actionDispatcher = dispatcher;
    }

    public updateAvailableClasses(classes: string[]): void {
        this.classesDropdown.innerHTML = '';

        if (classes.length === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No classes available';
            this.classesDropdown.appendChild(option);
        } else {
            // Add placeholder option
            const placeholderOption = document.createElement('option');
            placeholderOption.value = '';
            placeholderOption.textContent = '-- Select a class --';
            this.classesDropdown.appendChild(placeholderOption);

            // Add class options
            classes.forEach(className => {
                const option = document.createElement('option');
                option.value = className;
                option.textContent = className;
                this.classesDropdown.appendChild(option);
            });
        }
    }

    private async switchMode(mode: 'metamodel' | 'instance'): Promise<void> {
        if (!this.actionDispatcher) {
            console.warn('Action dispatcher not set');
            return;
        }

        if (this.currentMode === mode) {
            console.log(`Already in ${mode} mode`);
            return;
        }

        this.currentMode = mode;
        this.modeLabel.textContent = `Mode: ${mode === 'metamodel' ? 'Metamodel' : 'Instance'}`;

        try {
            const action = createSwitchModeAction(mode);
            await this.actionDispatcher.dispatch(action);

            console.log(`Switched to ${mode} mode`);
        } catch (error) {
            console.error('Error switching mode:', error);
            alert('Error switching mode: ' + error);
        }
    }

    private async createInstance(): Promise<void> {
        if (!this.actionDispatcher) {
            console.warn('Action dispatcher not set');
            return;
        }

        const selectedClass = this.classesDropdown.value;
        if (!selectedClass) {
            alert('Please select a class to instantiate');
            return;
        }

        try {
            // Calculate a random position for the new instance
            const x = Math.random() * 400 + 100;
            const y = Math.random() * 300 + 100;

            const action = createCreateInstanceAction(selectedClass, { x, y });
            await this.actionDispatcher.dispatch(action);

            console.log(`Created instance of ${selectedClass}`);
        } catch (error) {
            console.error('Error creating instance:', error);
            alert('Error creating instance: ' + error);
        }
    }

    public getElement(): HTMLDivElement {
        return this.toolbar;
    }
}

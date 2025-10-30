/********************************************************************************
 * Copyright (c) 2024 Eclipse GLSP and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * SPDX-License-Identifier: EPL-2.0
 ********************************************************************************/

import { GLSPActionDispatcher, EditorContextService } from '@eclipse-glsp/client';
import { createSwitchModeAction, createCreateInstanceAction, createSaveMetamodelAction, createCreateInstanceReferenceAction } from './ecore-client-actions';
import { getCreatableClasses, mustBeContained, getContainmentDescription } from './containment-utils';
import { getCreatableChildren, getContainmentReferenceName } from './containment-utils';
import { ClassInfo } from './ecore-client-actions';
import { GModelElement } from '@eclipse-glsp/sprotty';

export class EcoreToolbar {
    private toolbar: HTMLDivElement;
    private modeLabel: HTMLSpanElement;
    private classesDropdown: HTMLSelectElement;
    private containerInfo: HTMLDivElement;
    private clearContainerButton: HTMLButtonElement;
    private currentMode: 'metamodel' | 'instance' = 'metamodel';
    private actionDispatcher: GLSPActionDispatcher | null = null;
    private allClasses: ClassInfo[] = [];
    private selectedContainerInstanceId: string | null = null;
    private selectedContainerClassName: string | null = null;
    private editorContextService?: EditorContextService;
    private createdInstances: Set<string> = new Set(); // Track created instances
    // Removed reload metamodel state

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

        // Separator after mode section
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


        // Add container info display
        this.containerInfo = document.createElement('div');
        this.containerInfo.style.cssText = 'font-size: 10px; color: #0066cc; margin-bottom: 5px; padding: 5px; background-color: #e6f3ff; border-radius: 3px; display: none;';
        instanceSection.appendChild(this.containerInfo);

        const clearContainerButton = document.createElement('button');
        clearContainerButton.textContent = 'Clear Container';
        clearContainerButton.style.cssText = `
            padding: 3px 8px;
            background-color: #ccc;
            color: black;
            border: none;
            border-radius: 3px;
            cursor: pointer;
            font-size: 10px;
            margin-bottom: 5px;
            display: none;
        `;
        clearContainerButton.addEventListener('click', () => this.clearContainer());
        instanceSection.appendChild(clearContainerButton);
        this.clearContainerButton = clearContainerButton;

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

        // Create separator
        const separator2 = document.createElement('hr');
        separator2.style.cssText = 'width: 100%; border: none; border-top: 1px solid #ccc; margin: 0;';
        this.toolbar.appendChild(separator2);

        // Create custom metamodel section
        const customSection = document.createElement('div');
        customSection.style.cssText = 'display: flex; flex-direction: column; gap: 5px;';

        const customLabel = document.createElement('span');
        customLabel.textContent = 'Create Custom Metamodel:';
        customLabel.style.cssText = 'font-weight: bold; font-size: 12px;';
        customSection.appendChild(customLabel);

        const createCustomButton = this.createButton('🆕 New Metamodel', () => this.createCustomMetamodel());
        createCustomButton.style.width = '100%';
        customSection.appendChild(createCustomButton);

        this.toolbar.appendChild(customSection);

        // Create separator
        const separator3 = document.createElement('hr');
        separator3.style.cssText = 'width: 100%; border: none; border-top: 1px solid #ccc; margin: 0;';
        this.toolbar.appendChild(separator3);

        // Create save section
        const saveSection = document.createElement('div');
        saveSection.style.cssText = 'display: flex; flex-direction: column; gap: 5px;';

        const saveLabel = document.createElement('span');
        saveLabel.textContent = 'Save Metamodel:';
        saveLabel.style.cssText = 'font-weight: bold; font-size: 12px;';
        saveSection.appendChild(saveLabel);

        const saveButton = this.createButton('💾 Save as JSON', () => this.saveMetamodel('json'));
        saveButton.style.width = '100%';
        saveSection.appendChild(saveButton);

        this.toolbar.appendChild(saveSection);

        // Create separator
        const separator4 = document.createElement('hr');
        separator4.style.cssText = 'width: 100%; border: none; border-top: 1px solid #ccc; margin: 0;';
        this.toolbar.appendChild(separator4);

        // Create visual configuration section
        const visualConfigSection = document.createElement('div');
        visualConfigSection.style.cssText = 'display: flex; flex-direction: column; gap: 5px;';

        const visualConfigLabel = document.createElement('span');
        visualConfigLabel.textContent = 'Visual Configuration:';
        visualConfigLabel.style.cssText = 'font-weight: bold; font-size: 12px;';
        visualConfigSection.appendChild(visualConfigLabel);

        const visualConfigButton = this.createButton('🎨 Configure Appearance', () => this.openVisualConfiguration());
        visualConfigButton.style.width = '100%';
        visualConfigSection.appendChild(visualConfigButton);

        this.toolbar.appendChild(visualConfigSection);

        // Create separator
        const separator5 = document.createElement('hr');
        separator5.style.cssText = 'width: 100%; border: none; border-top: 1px solid #ccc; margin: 0;';
        this.toolbar.appendChild(separator5);

        // Create load JSON section
        const loadSection = document.createElement('div');
        loadSection.style.cssText = 'display: flex; flex-direction: column; gap: 5px;';

        const loadLabel = document.createElement('span');
        loadLabel.textContent = 'Load Metamodel:';
        loadLabel.style.cssText = 'font-weight: bold; font-size: 12px;';
        loadSection.appendChild(loadLabel);

        const loadButton = this.createButton('Load JSON', () => this.loadJSON());
        loadButton.style.width = '100%';
        loadSection.appendChild(loadButton);

        this.toolbar.appendChild(loadSection);
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
    
    public setEditorContextService(service: EditorContextService): void {
        this.editorContextService = service;
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

    public updateClassInfo(allClasses: ClassInfo[]): void {
        this.allClasses = allClasses;
        this.updateAvailableClassesForMode();
    }

    private updateAvailableClassesForMode(): void {
        this.classesDropdown.innerHTML = '';

        if (this.allClasses.length === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No classes available';
            this.classesDropdown.appendChild(option);
            return;
        }

        // Add placeholder option
        const placeholderOption = document.createElement('option');
        placeholderOption.value = '';
        placeholderOption.textContent = '-- Select a class --';
        this.classesDropdown.appendChild(placeholderOption);

        if (this.currentMode === 'instance') {
            // Check if a container is selected
            if (this.selectedContainerInstanceId && this.selectedContainerClassName) {
                // Show children of the selected container
                const children = getCreatableChildren(this.selectedContainerClassName, this.allClasses);
                
                if (children.length === 0) {
                    const option = document.createElement('option');
                    option.value = '';
                    option.textContent = `No children available for ${this.selectedContainerClassName}`;
                    option.disabled = true;
                    this.classesDropdown.appendChild(option);
                } else {
                    // Filter out abstract classes
                    const creatableChildren = children.filter(c => !c.isAbstract && !c.isInterface);
                    
                    if (creatableChildren.length === 0) {
                        const option = document.createElement('option');
                        option.value = '';
                        option.textContent = `No creatable children (all abstract)`;
                        option.disabled = true;
                        this.classesDropdown.appendChild(option);
                    } else {
                        creatableChildren.forEach(cls => {
                            const option = document.createElement('option');
                            option.value = cls.className;
                            option.textContent = cls.className;
                            this.classesDropdown.appendChild(option);
                        });
                    }
                }
            } else {
                // No container selected: only show root classes
                const rootClasses = getCreatableClasses(this.allClasses)
                    .filter(c => !c.isAbstract && !c.isInterface);

                if (rootClasses.length === 0) {
                    const option = document.createElement('option');
                    option.value = '';
                    option.textContent = 'No root classes available';
                    option.disabled = true;
                    this.classesDropdown.appendChild(option);
                } else {
                    rootClasses.forEach(cls => {
                        const option = document.createElement('option');
                        option.value = cls.className;
                        option.textContent = `${cls.className} (root)`;
                        this.classesDropdown.appendChild(option);
                    });
                }
            }
        } else {
            // In metamodel mode, show all classes with visual indicators
            this.allClasses.forEach(cls => {
                const option = document.createElement('option');
                option.value = cls.className;
                
                // Add visual indicators for containment requirements
                let displayText = cls.className;
                if (mustBeContained(cls.className, this.allClasses)) {
                    displayText += ' 🔒'; // Lock icon for contained classes
                }
                if (cls.isAbstract) {
                    displayText += ' (abstract)';
                }
                if (cls.isInterface) {
                    displayText += ' (interface)';
                }
                
                option.textContent = displayText;
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
            return;
        }

        this.currentMode = mode;
        this.modeLabel.textContent = `Mode: ${mode === 'metamodel' ? 'Metamodel' : 'Instance'}`;

        // Update available classes based on new mode
        this.updateAvailableClassesForMode();

        try {
            const action = createSwitchModeAction(mode);
            await this.actionDispatcher.dispatch(action);
            
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

        

        // Check if this class requires source and target selection (e.g., Arc)
        const classInfo = this.allClasses.find(cls => cls.className === selectedClass);
        if (classInfo && this.requiresSourceAndTarget(classInfo)) {
            await this.createInstanceWithSourceAndTarget(selectedClass, classInfo);
            return;
        }

        // Determine container and containment reference
        let containerInstanceId: string | undefined;
        let containmentReferenceName: string | undefined;
        
        if (this.selectedContainerInstanceId && this.selectedContainerClassName) {
            // Explicit container selected
            const containmentRefName = getContainmentReferenceName(this.selectedContainerClassName, selectedClass, this.allClasses);
            if (!containmentRefName) {
                alert(`Cannot create '${selectedClass}' as a child of '${this.selectedContainerClassName}'. No containment reference found.`);
                return;
            }
            containerInstanceId = this.selectedContainerInstanceId;
            containmentReferenceName = containmentRefName;
        } else {
            // No explicit container: only allow root classes
            const rootClasses = getCreatableClasses(this.allClasses);
            const isRootClass = rootClasses.some(cls => cls.className === selectedClass);

            if (!isRootClass) {
                const description = getContainmentDescription(selectedClass, this.allClasses);
                alert(`Please select a container first for '${selectedClass}'.\n\n${description}`);
                return;
            }
        }

        try {
            // Calculate position for the new instance
            let x: number;
            let y: number;
            
            if (this.selectedContainerInstanceId && this.selectedContainerClassName) {
                // Position child instances relative to container (offset to the right)
                // Default container position estimate (will be adjusted if we can get actual position)
                const baseX = 200;
                const baseY = 150;
                
                // Calculate offset based on how many children already exist
                // Try to get children count from the container instance references
                // For now, use a simple offset pattern
                const childOffsetX = 250; // Offset to the right of container
                const childOffsetY = 50;  // Small vertical offset
                
                x = baseX + childOffsetX;
                y = baseY + childOffsetY;
            } else {
                // Root instance - use random position
                x = Math.random() * 400 + 100;
                y = Math.random() * 300 + 100;
            }

            // Create instance with container info if available
            const action = createCreateInstanceAction(
                selectedClass,
                { x, y },
                containerInstanceId,
                containmentReferenceName
            );
            await this.actionDispatcher.dispatch(action);

            // Track the created instance (server will generate ID like PetriNet_1, PetriNet_2, etc.)
            // We'll track by class name and let the server generate the actual ID
            this.createdInstances.add(selectedClass);
            
            // Refresh the available classes to show children of the newly created instance
            // Try multiple times with increasing delays to ensure model is updated
            this.refreshAvailableClasses(); // Immediate refresh
            
            setTimeout(() => {
                this.refreshAvailableClasses();
            }, 1000); // Initial delay
            
            setTimeout(() => {
                this.refreshAvailableClasses();
            }, 2000); // Second attempt
        } catch (error) {
            console.error('Error creating instance:', error);
            alert('Error creating instance: ' + error);
        }
    }

    /**
     * Sets the selected container instance for creating children.
     * @param instanceId The ID of the container instance
     * @param className The class name of the container instance
     */
    public setContainer(instanceId: string, className: string): void {
        this.selectedContainerInstanceId = instanceId;
        this.selectedContainerClassName = className;
        this.containerInfo.textContent = `Container: ${className} (${instanceId})`;
        this.containerInfo.style.display = 'block';
        this.clearContainerButton.style.display = 'block';
        this.updateAvailableClassesForMode();
    }

    /**
     * Clears the selected container instance.
     */
    public clearContainer(): void {
        this.selectedContainerInstanceId = null;
        this.selectedContainerClassName = null;
        this.containerInfo.style.display = 'none';
        this.clearContainerButton.style.display = 'none';
        this.updateAvailableClassesForMode();
    }

    // Removed implicit container instance detection

    private findInstancesOfClassByName(className: string): string[] {
        const instanceIds: string[] = [];
        
        
        
        // Note: We check createdInstances in hasInstancesOfClass first,
        // so if we get here, we're looking for the actual instance IDs in the model
        
        // Fallback to model root if available
        if (!this.editorContextService) {
            return instanceIds;
        }
        
        try {
            const modelRoot = this.editorContextService.modelRoot;
            
            if (!modelRoot) {
                return instanceIds;
            }
            
            
            
            // First, try to find instances using the dedicated method
            const instances = this.findInstancesOfClass(modelRoot, className);
            
            // Extract instance IDs that match the class name pattern
            instances.forEach(instance => {
                if (instance.id && instance.id.startsWith(className + '_')) {
                    instanceIds.push(instance.id);
                }
            });
            
            // Always also try aggressive search to catch any instances we might have missed
            const allElements = this.findAllElements(modelRoot);
            
            allElements.forEach(element => {
                if (element.id && element.id.startsWith(className + '_')) {
                    if (!instanceIds.includes(element.id)) {
                        instanceIds.push(element.id);
                    }
                }
            });
            return instanceIds;
        } catch (error) {
            console.warn('Could not access model root:', error);
            return instanceIds;
        }
    }

    /**
     * Recursively finds ALL elements in the model tree.
     */
    private findAllElements(element: GModelElement): GModelElement[] {
        const elements: GModelElement[] = [];
        
        if (!element || typeof element !== 'object') {
            return elements;
        }
        
        elements.push(element);
        
        if ('children' in element && element.children && Array.isArray(element.children)) {
            for (const child of element.children) {
                if (child) {
                    elements.push(...this.findAllElements(child));
                }
            }
        }
        
        return elements;
    }
    
    /**
     * Recursively finds all instances of a specific class in the model.
     */
    private findInstancesOfClass(element: GModelElement, className: string): GModelElement[] {
        const instances: GModelElement[] = [];
        
        // Safety check - ensure element exists and has the required properties
        if (!element || typeof element !== 'object') {
            return instances;
        }
        
        // Check if this element is an instance of the target class
        if (element.type === 'ecore:instance' && element.id && element.id.startsWith(className + '_')) {
            instances.push(element);
        }
        
        // Recursively check children
        if ('children' in element && element.children && Array.isArray(element.children)) {
            for (const child of element.children) {
                if (child) { // Ensure child is not null/undefined
                    instances.push(...this.findInstancesOfClass(child, className));
                }
            }
        }
        
        return instances;
    }

    /**
     * Checks if class information is available (metamodel is loaded).
     */
    public hasClassInfo(): boolean {
        return this.allClasses.length > 0;
    }
    
    /**
     * Refreshes the available classes based on current model state.
     * This should be called after instance creation to update the dropdown.
     */
    public refreshAvailableClasses(): void {
        
        if (this.currentMode === 'instance') {
            
            this.updateAvailableClassesForMode();
        }
    }


    private async saveMetamodel(format: 'json' | 'ecore'): Promise<void> {
        if (!this.actionDispatcher) {
            console.warn('Action dispatcher not set');
            return;
        }

        try {
            // Prompt user for filename
            const defaultFilename = format === 'json' ? 'metamodel.json' : 'metamodel.ecore';
            const filename = prompt(`Enter filename for saving metamodel:`, defaultFilename);
            
            if (!filename) {
                return; // User cancelled
            }

            const action = createSaveMetamodelAction(filename, format);
            await this.actionDispatcher.dispatch(action);

            // For now, we'll show a success message
            // In a full implementation, you'd listen for a response action
            alert(`Metamodel save requested for ${filename}. Check server logs for the JSON content.`);
        } catch (error) {
            console.error('Error saving metamodel:', error);
            alert('Error saving metamodel: ' + error);
        }
    }

    private createCustomMetamodel(): void {
        if (!this.actionDispatcher) {
            console.error('Action dispatcher not available');
            return;
        }

        // Show package creation dialog
        const packageName = prompt('Enter package name for your custom metamodel:');
        if (!packageName || !packageName.trim()) {
            return;
        }

        const trimmedName = packageName.trim();
        
        // Validate package name
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmedName)) {
            alert('Package name must start with a letter or underscore and contain only letters, numbers, and underscores.');
            return;
        }

        try {
            // Create the package with auto-generated nsURI and nsPrefix
            const nsURI = `https://www.example.org/${trimmedName}`;
            const nsPrefix = trimmedName.substring(0, 2).toUpperCase();
            
            
            
            // Dispatch action to create custom metamodel
            const action = {
                kind: 'createCustomMetamodel',
                packageName: trimmedName,
                nsURI: nsURI,
                nsPrefix: nsPrefix
            };
            
            this.actionDispatcher.dispatch(action);
            
        } catch (error) {
            console.error('Error creating custom metamodel:', error);
            alert(`Error creating custom metamodel: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async openVisualConfiguration(): Promise<void> {
        if (!this.actionDispatcher) {
            console.warn('Action dispatcher not set');
            return;
        }

        try {
            const action = { kind: 'openVisualConfiguration' };
            await this.actionDispatcher.dispatch(action);
        } catch (error) {
            console.error('Error opening visual configuration:', error);
            alert('Error opening visual configuration: ' + error);
        }
    }

    private loadJSON(): void {
        // Create file input element
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
                
                if (this.actionDispatcher) {
                    const action = {
                        kind: 'loadMetamodel',
                        content: content,
                        filename: file.name,
                        isJSON: true
                    };
                    
                    await this.actionDispatcher.dispatch(action);
                    
                } else {
                    console.error('Action dispatcher not available');
                    alert('Action dispatcher not available');
                }
            } catch (error) {
                console.error('Error loading metamodel:', error);
                alert('Error loading metamodel: ' + error);
            }
        });
        
        // Trigger file selection
        document.body.appendChild(fileInput);
        fileInput.click();
        document.body.removeChild(fileInput);
    }

    public getElement(): HTMLDivElement {
        return this.toolbar;
    }

    /**
     * Checks if a class requires source and target selection (e.g., Arc with source and target references).
     */
    private requiresSourceAndTarget(classInfo: ClassInfo): boolean {
        // Fast path by naming
        const hasSourceByName = classInfo.references.some(ref => ref.name && ref.name.toLowerCase().includes('source') && !ref.containment);
        const hasTargetByName = classInfo.references.some(ref => ref.name && ref.name.toLowerCase().includes('target') && !ref.containment);
        if (hasSourceByName && hasTargetByName) {
            return true;
        }

        // Fallback: treat as edge-like if it has at least two non-containment refs
        const nonContainment = classInfo.references.filter(r => !r.containment);
        if (nonContainment.length >= 2) {
            // Generic rule without metamodel-specific assumptions
            return true;
        }
        return false;
    }

    /**
     * Creates an instance that requires source and target selection.
     */
    private async createInstanceWithSourceAndTarget(selectedClass: string, classInfo: ClassInfo): Promise<void> {
        
        // Resolve source and target reference names (robust fallback)
        const refs = this.getSourceTargetRefs(classInfo);
        const sourceRef = refs.sourceRef;
        const targetRef = refs.targetRef;

        if (!sourceRef || !targetRef) {
            alert(`Class ${selectedClass} has source/target references but they couldn't be identified.`);
            return;
        }

        // Try to wait briefly for model; don't block Arc flow if not ready
        await this.waitForModelRoot(800);

        // Find all available source and target instances
        const sourceInstances = this.findAvailableInstancesForReference(sourceRef.type);
        const targetInstances = this.findAvailableInstancesForReference(targetRef.type);

        if (sourceInstances.length === 0) {
            alert(`No ${sourceRef.type} instances available for source. Please create some first.`);
            return;
        }

        if (targetInstances.length === 0) {
            alert(`No ${targetRef.type} instances available for target. Please create some first.`);
            return;
        }

        // Show selection dialog
        const selection = await this.showSourceTargetSelectionDialog(
            selectedClass,
            sourceRef.name,
            targetRef.name,
            sourceInstances,
            targetInstances
        );

        if (!selection) {
            return; // User cancelled
        }

        // Create the instance with source and target references
        await this.createInstanceWithReferences(selectedClass, selection.sourceId, selection.targetId, sourceRef.name, targetRef.name);
    }

    /**
     * Finds all available instances that can be used for a specific reference type.
     */
    private findAvailableInstancesForReference(referenceType: string): Array<{id: string, className: string}> {
        const instances: Array<{id: string, className: string}> = [];
        

        // Build allowed class set: reference type + all its subtypes (robust to qualified names)
        const allowedClassNames = new Set<string>();
        allowedClassNames.add(referenceType);
        for (const ci of this.allClasses) {
            if (this.isSubtypeOf(ci.className, referenceType)) {
                allowedClassNames.add(ci.className);
            }
        }


        // Scan model (or DOM fallback) for each allowed class
        for (const allowed of allowedClassNames) {
            let ids = this.findInstancesOfClassByName(allowed);
            if (ids.length === 0) {
                // DOM-based fallback if modelRoot not available
                const domIds = this.findDomInstancesByPrefix(allowed + '_');
                if (domIds.length > 0) {
                    
                    ids = domIds;
                }
            }
            
            ids.forEach(id => instances.push({ id, className: allowed }));
        }

        return instances;
    }

    /**
     * Wait until the editor model root is available or timeout.
     */
    private async waitForModelRoot(timeoutMs: number = 2000): Promise<boolean> {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            try {
                if (this.editorContextService && this.editorContextService.modelRoot) {
                    return true;
                }
            } catch {}
            await new Promise(r => setTimeout(r, 100));
        }
        return !!(this.editorContextService && this.editorContextService.modelRoot);
    }

    /**
     * DOM fallback: find elements whose id starts with the given prefix.
     */
    private findDomInstancesByPrefix(prefix: string): string[] {
        const found: string[] = [];
        try {
            const elements = document.querySelectorAll<HTMLElement>('[id], [data-sprotty-id], [data-id]');
            elements.forEach(el => {
                const candidates = [el.id, el.getAttribute('data-sprotty-id'), el.getAttribute('data-id')].filter(Boolean) as string[];
                for (const value of candidates) {
                    if (value && value.startsWith(prefix)) {
                        found.push(value);
                    }
                }
            });

            // As a last resort, scan labels for tokens like Class_#
            if (found.length === 0) {
                const tokenRegex = new RegExp('^' + prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
                const allNodes = document.querySelectorAll<HTMLElement>('*');
                allNodes.forEach(el => {
                    const text = (el.textContent || '').trim();
                    if (text && tokenRegex.test(text)) {
                        found.push(text);
                    }
                });
            }
        } catch {}
        return Array.from(new Set(found));
    }

    /**
     * Shows a dialog for selecting source and target instances.
     */
    private async showSourceTargetSelectionDialog(
        className: string,
        sourceRefName: string,
        targetRefName: string,
        sourceInstances: Array<{id: string, className: string}>,
        targetInstances: Array<{id: string, className: string}>
    ): Promise<{sourceId: string, targetId: string} | null> {
        return new Promise((resolve) => {
            // Create modal backdrop
            const backdrop = document.createElement('div');
            backdrop.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.5);
                z-index: 10000;
                display: flex;
                justify-content: center;
                align-items: center;
            `;

            // Create dialog
            const dialog = document.createElement('div');
            dialog.style.cssText = `
                background: white;
                border-radius: 8px;
                padding: 20px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
                min-width: 400px;
                max-width: 600px;
                font-family: Arial, sans-serif;
            `;

            dialog.innerHTML = `
                <h3 style="margin-top: 0; color: #333;">Create ${className}</h3>
                <p style="color: #666; margin-bottom: 20px;">Select source and target for this ${className} instance.</p>
                
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">${sourceRefName}:</label>
                    <select id="sourceSelect" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
                        <option value="">-- Select ${sourceRefName} --</option>
                    </select>
                </div>
                
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">${targetRefName}:</label>
                    <select id="targetSelect" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
                        <option value="">-- Select ${targetRefName} --</option>
                    </select>
                </div>
                
                <div style="display: flex; gap: 10px; justify-content: flex-end;">
                    <button id="cancelBtn" style="padding: 8px 16px; border: 1px solid #ccc; background: #f5f5f5; border-radius: 4px; cursor: pointer;">Cancel</button>
                    <button id="createBtn" style="padding: 8px 16px; border: none; background: #007acc; color: white; border-radius: 4px; cursor: pointer;">Create</button>
                </div>
            `;

            // Populate source dropdown
            const sourceSelect = dialog.querySelector('#sourceSelect') as HTMLSelectElement;
            sourceInstances.forEach(instance => {
                const option = document.createElement('option');
                option.value = instance.id;
                option.textContent = `${instance.className} (${instance.id})`;
                sourceSelect.appendChild(option);
            });

            // Populate target dropdown
            const targetSelect = dialog.querySelector('#targetSelect') as HTMLSelectElement;
            targetInstances.forEach(instance => {
                const option = document.createElement('option');
                option.value = instance.id;
                option.textContent = `${instance.className} (${instance.id})`;
                targetSelect.appendChild(option);
            });

            // Add event listeners
            const cancelBtn = dialog.querySelector('#cancelBtn') as HTMLButtonElement;
            const createBtn = dialog.querySelector('#createBtn') as HTMLButtonElement;

            cancelBtn.addEventListener('click', () => {
                document.body.removeChild(backdrop);
                resolve(null);
            });

            createBtn.addEventListener('click', () => {
                const sourceId = sourceSelect.value;
                const targetId = targetSelect.value;

                if (!sourceId || !targetId) {
                    alert('Please select both source and target.');
                    return;
                }

                if (sourceId === targetId) {
                    alert('Source and target must be different instances.');
                    return;
                }

                document.body.removeChild(backdrop);
                resolve({ sourceId, targetId });
            });

            // Close on backdrop click only when clicking outside the dialog
            backdrop.addEventListener('click', (e) => {
                if (e.target === backdrop) {
                    document.body.removeChild(backdrop);
                    resolve(null);
                }
            });

            // Mount dialog inside backdrop and show
            backdrop.appendChild(dialog);
            document.body.appendChild(backdrop);
        });
    }

    /**
     * Creates an instance with specific source and target references.
     */
    private async createInstanceWithReferences(
        className: string,
        sourceId: string,
        targetId: string,
        sourceRefName: string,
        targetRefName: string
    ): Promise<void> {
        try {
            // Calculate position (center of viewport)
            const x = window.innerWidth / 2 - 100;
            const y = window.innerHeight / 2 - 50;

            // Create the instance first
            const createAction = createCreateInstanceAction(className, { x, y });
            await this.actionDispatcher!.dispatch(createAction);

            // Track the created instance
            this.createdInstances.add(className);
            

            // Wait a bit for the instance to be created and get its ID
            setTimeout(async () => {
                try {
                    // Find the newly created instance ID
                    const newInstanceId = await this.findNewlyCreatedInstanceId(className);
                    if (newInstanceId) {
                        // Create source reference
                        const sourceRefAction = createCreateInstanceReferenceAction(
                            newInstanceId,
                            sourceId,
                            sourceRefName
                        );
                        await this.actionDispatcher!.dispatch(sourceRefAction);

                        // Create target reference
                        const targetRefAction = createCreateInstanceReferenceAction(
                            newInstanceId,
                            targetId,
                            targetRefName
                        );
                        await this.actionDispatcher!.dispatch(targetRefAction);

                        
                    } else {
                        console.warn(`Could not find newly created ${className} instance to set references`);
                    }
                } catch (refError) {
                    console.error('Error creating references:', refError);
                }
            }, 500);

            // Refresh available classes
            this.refreshAvailableClasses();
            setTimeout(() => this.refreshAvailableClasses(), 1000);
            setTimeout(() => this.refreshAvailableClasses(), 2000);

        } catch (error) {
            console.error('Error creating instance with references:', error);
            alert('Error creating instance: ' + error);
        }
    }

    /**
     * Resolve the two endpoint references to use as source and target.
     */
    private getSourceTargetRefs(classInfo: ClassInfo): { sourceRef: ClassInfo['references'][number], targetRef: ClassInfo['references'][number] } {
        // Try by conventional names first
        const byNameSource = classInfo.references.find(r => !r.containment && r.name && r.name.toLowerCase().includes('source'));
        const byNameTarget = classInfo.references.find(r => !r.containment && r.name && r.name.toLowerCase().includes('target'));
        if (byNameSource && byNameTarget) {
            return { sourceRef: byNameSource, targetRef: byNameTarget };
        }

        // Otherwise pick first two non-containment references
        const candidates = classInfo.references.filter(r => !r.containment);
        if (candidates.length >= 2) {
            return { sourceRef: candidates[0], targetRef: candidates[1] };
        }

        // Last resort: use whatever exists (will be rejected if invalid)
        const s = classInfo.references[0];
        const t = classInfo.references[1] || classInfo.references[0];
        return { sourceRef: s, targetRef: t };
    }

    /**
     * Finds the ID of the most recently created instance of a given class.
     */
    private async findNewlyCreatedInstanceId(className: string): Promise<string | null> {
        // Get all instances of this class
        const instances = this.findInstancesOfClassByName(className);
        
        if (instances.length === 0) {
            return null;
        }

        // Sort by instance number (assuming format: ClassName_1, ClassName_2, etc.)
        const sortedInstances = instances.sort((a, b) => {
            const aNum = parseInt(a.split('_')[1]) || 0;
            const bNum = parseInt(b.split('_')[1]) || 0;
            return bNum - aNum; // Descending order (newest first)
        });

        return sortedInstances[0];
    }

    /**
     * Checks if one class is a subtype of another (for reference type matching).
     */
    private isSubtypeOf(className: string, superTypeName: string): boolean {
        const normalize = (name: string) => {
            if (!name) return name;
            // Handle qualified names like pkg.Node or a::b::Node
            const parts = name.split(/[:.#]/).filter(p => p && p !== ':');
            return parts.length > 0 ? parts[parts.length - 1] : name;
        };

        const clsName = normalize(className);
        const supName = normalize(superTypeName);

        if (clsName === supName) {
            return true;
        }
        
        const cls = this.allClasses.find(c => normalize(c.className) === clsName);
        if (!cls || !cls.eSuperTypes || cls.eSuperTypes.length === 0) {
            return false;
        }
        
        // Check direct supertypes
        if (cls.eSuperTypes.some(st => normalize(st) === supName)) {
            return true;
        }
        
        // Recursively check supertypes of supertypes
        return cls.eSuperTypes.some(st => this.isSubtypeOf(normalize(st), supName));
    }
}

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
import { createSwitchModeAction, createCreateInstanceAction, createCreateInstanceReferenceAction, createRequestInstancesOverviewAction } from './ecore-client-actions';
import { getContainmentRequirements, getCreatableChildren, getContainmentReferenceName } from './containment-utils';
import { ClassInfo, InstancesOverviewResponse } from './ecore-client-actions';
import { GModelElement } from '@eclipse-glsp/sprotty';

export class EcoreToolbar {
    private toolbar: HTMLDivElement;
    private containerInfo: HTMLDivElement | null = null;
    private clearContainerButton: HTMLButtonElement | null = null;
    private currentMode: 'metamodel' | 'instance' = 'metamodel';
    private actionDispatcher: GLSPActionDispatcher | null = null;
    private allClasses: ClassInfo[] = [];
    private allEnumNames: string[] = [];
    private selectedContainerInstanceId: string | null = null;
    private selectedContainerClassName: string | null = null;
    private editorContextService?: EditorContextService;
    private createdInstances: Set<string> = new Set(); // Track created instances
    private instanceOverviewRequests: Map<string, {
        resolve: (instances: Array<{ id: string; className: string }>) => void;
        reject: (error: any) => void;
        timeoutHandle: number;
    }> = new Map();
    private instanceOverviewRequestCounter = 0;
    private paletteOriginalContent: string | null = null;
    private instancePaletteContainer: HTMLDivElement | null = null;
    private modeListeners: Array<(mode: 'metamodel' | 'instance') => void> = [];

    constructor() {
        this.toolbar = document.createElement('div');
        this.toolbar.style.cssText = `
            position: fixed;
            bottom: calc(var(--bottom-panel-height, 0px) + 10px);
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

    }

    public setActionDispatcher(dispatcher: GLSPActionDispatcher): void {
        this.actionDispatcher = dispatcher;
    }
    
    public setEditorContextService(service: EditorContextService): void {
        this.editorContextService = service;
    }

    public updateAvailableClasses(classes: string[]): void {
        this.renderInstancePalette(
            this.currentMode === 'instance' ? classes.slice().sort((a, b) => a.localeCompare(b)) : [],
            this.currentMode === 'instance'
        );

        if (!classes || classes.length === 0) {
            return;
        }

        const existingNames = new Set(this.allClasses.map(cls => cls.className));
        let updated = false;

        for (const className of classes) {
            if (!existingNames.has(className)) {
                this.allClasses.push({
                    className,
                    isAbstract: false,
                    isInterface: false,
                    attributes: [],
                    references: []
                });
                updated = true;
            }
        }

        if (updated) {
            this.updateAvailableClassesForMode();
        }
    }

    public updateClassInfo(allClasses: ClassInfo[]): void {
        this.allClasses = allClasses;
        this.updateAvailableClassesForMode();
    }

    public updateEnumNames(enumNames: string[]): void {
        this.allEnumNames = enumNames || [];
    }

    public getEnumNames(): string[] {
        return this.allEnumNames || [];
    }

    /**
     * Gets all concrete (non-abstract, non-interface) class names from the loaded metamodel.
     * This is useful for the mapping dialog and other places that need a list of instantiable classes.
     */
    public getConcreteClasses(): string[] {
        return this.allClasses
            .filter(cls => !cls.isAbstract && !cls.isInterface)
            .map(cls => cls.className);
    }

    /**
     * Gets all class names (including abstract classes and interfaces) from the loaded metamodel.
     */
    public getAllClassNames(): string[] {
        return this.allClasses.map(cls => cls.className);
    }

    private updateAvailableClassesForMode(): void {
        if (this.currentMode === 'instance') {
            const paletteClasses: string[] = [];

            if (this.selectedContainerInstanceId && this.selectedContainerClassName) {
                const children = getCreatableChildren(this.selectedContainerClassName, this.allClasses);

                const creatableChildren = children
                    .filter(c => !c.isAbstract && !c.isInterface)
                    .map(c => c.className);

                paletteClasses.push(...creatableChildren);
            } else {
                const rootContainers = this.allClasses.filter(cls =>
                    getContainmentRequirements(cls.className, this.allClasses).length === 0
                );

                const creatableFromRoot = new Map<string, ClassInfo>();

                for (const rootClass of rootContainers) {
                    const children = getCreatableChildren(rootClass.className, this.allClasses);
                    children
                        .filter(child => !child.isAbstract && !child.isInterface)
                        .forEach(child => creatableFromRoot.set(child.className, child));
                }

                rootContainers
                    .filter(cls => !cls.isAbstract && !cls.isInterface && !this.isContainerClass(cls))
                    .forEach(cls => creatableFromRoot.set(cls.className, cls));

                creatableFromRoot.forEach((cls) => {
                    paletteClasses.push(cls.className);
                });
            }

            this.renderInstancePalette(paletteClasses.sort((a, b) => a.localeCompare(b)), true);
        } else {
            this.renderInstancePalette([], false);
        }
    }

    private async switchMode(mode: 'metamodel' | 'instance'): Promise<void> {
        if (!this.actionDispatcher) {
            return;
        }

        if (this.currentMode === mode) {
            return;
        }

        this.currentMode = mode;
        this.notifyModeChange();

        // Update available classes based on new mode
        this.updateAvailableClassesForMode();

        try {
            const action = createSwitchModeAction(mode);
            await this.actionDispatcher.dispatch(action);
            
        } catch (error) {
            alert('Error switching mode: ' + error);
        }
    }

    private async createInstance(selectedClass: string): Promise<void> {
        if (!this.actionDispatcher) {
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
            // No explicit container: allow server to select default container (hidden root or existing instance)
            const requirements = getContainmentRequirements(selectedClass, this.allClasses);
            const isRootClass = requirements.length === 0;

            if (isRootClass) {
                // Nothing to do, class can exist at root level
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
        // Force re-render of the instance palette to show container info and clear button
        this.updateAvailableClassesForMode();
    }

    private isContainerClass(cls: ClassInfo): boolean {
        if (!cls.references || cls.references.length === 0) {
            return false;
        }

        return cls.references.some(ref => ref.containment === true);
    }

    /**
     * Clears the selected container instance.
     */
    public clearContainer(): void {
        this.selectedContainerInstanceId = null;
        this.selectedContainerClassName = null;
        if (this.containerInfo) {
            this.containerInfo.style.display = 'none';
        }
        if (this.clearContainerButton) {
            this.clearContainerButton.style.display = 'none';
        }
        this.updateAvailableClassesForMode();
    }

    // Removed implicit container instance detection

    private findInstancesOfClassByName(className: string): string[] {
        const instanceIds: string[] = [];
        const normalizedClass = this.normalizeClassName(className);
        if (!normalizedClass) {
            return instanceIds;
        }

        if (!this.editorContextService) {
            return instanceIds;
        }

        try {
            const modelRoot = this.editorContextService.modelRoot;

            if (!modelRoot) {
                return instanceIds;
            }

            const instances = this.findInstancesOfClass(modelRoot, normalizedClass);

            instances.forEach(instance => {
                if (instance.id && instance.id.startsWith(normalizedClass + '_')) {
                    instanceIds.push(instance.id);
                }
            });

            if (instanceIds.length === 0) {
                // No matching instances found yet; continue with full traversal
            }

            const allElements = this.findAllElements(modelRoot);

            allElements.forEach(element => {
                if (element.id && element.id.startsWith(normalizedClass + '_')) {
                    if (!instanceIds.includes(element.id)) {
                        instanceIds.push(element.id);
                    }
                }
            });

            return instanceIds;
        } catch (error) {
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

        if (!element || typeof element !== 'object') {
            return instances;
        }

        if (element.type === 'ecore:instance' && element.id && element.id.startsWith(className + '_')) {
            instances.push(element);
        }

        if ('children' in element && element.children && Array.isArray(element.children)) {
            for (const child of element.children) {
                if (child) {
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


    public getElement(): HTMLDivElement {
        return this.toolbar;
    }

    public switchToMode(mode: 'metamodel' | 'instance'): Promise<void> {
        return this.switchMode(mode);
    }

    public onModeChange(listener: (mode: 'metamodel' | 'instance') => void): void {
        this.modeListeners.push(listener);
        listener(this.currentMode);
    }

    private notifyModeChange(): void {
        for (const listener of this.modeListeners) {
            try {
                listener(this.currentMode);
            } catch (error) {
                console.error('Error in mode change listener:', error);
            }
        }
    }

    private renderInstancePalette(classNames: string[], isInstanceMode: boolean): void {
        const paletteBody = document.querySelector('.tool-palette .palette-body') as HTMLElement | null;

        if (!paletteBody) {
            if (isInstanceMode) {
                setTimeout(() => this.renderInstancePalette(classNames, isInstanceMode), 100);
            }
            return;
        }

        if (!isInstanceMode) {
            if (this.paletteOriginalContent !== null) {
                paletteBody.innerHTML = this.paletteOriginalContent;
                this.paletteOriginalContent = null;
            }
            this.instancePaletteContainer = null;
            return;
        }

        if (this.paletteOriginalContent === null) {
            this.paletteOriginalContent = paletteBody.innerHTML;
        }

        paletteBody.innerHTML = '';

        if (!this.instancePaletteContainer) {
            this.instancePaletteContainer = document.createElement('div');
            this.instancePaletteContainer.classList.add('instance-palette-container');
        }

        this.instancePaletteContainer.innerHTML = '';

        if (!this.instancePaletteContainer) {
            this.instancePaletteContainer = document.createElement('div');
            this.instancePaletteContainer.classList.add('instance-palette-container');
        }

        const container = this.instancePaletteContainer;
        container.innerHTML = '';

        const header = document.createElement('div');
        header.textContent = 'Create Instance';
        header.style.cssText = 'font-weight: bold; padding: 6px 8px;';
        container.appendChild(header);

        // Add container info and clear button if container is selected
        if (this.selectedContainerInstanceId && this.selectedContainerClassName) {
            // Create container info if it doesn't exist
            if (!this.containerInfo) {
                this.containerInfo = document.createElement('div');
                this.containerInfo.style.cssText = `
                    padding: 8px;
                    margin: 8px 0;
                    background-color: #e3f2fd;
                    border: 1px solid #90caf9;
                    border-radius: 4px;
                    font-size: 12px;
                    color: #1976d2;
                `;
            }
            this.containerInfo.textContent = `Container: ${this.selectedContainerClassName}`;
            container.appendChild(this.containerInfo);

            // Create clear container button if it doesn't exist
            if (!this.clearContainerButton) {
                this.clearContainerButton = document.createElement('button');
                this.clearContainerButton.textContent = 'Clear Container';
                this.clearContainerButton.style.cssText = `
                    padding: 6px 12px;
                    margin: 4px 0;
                    background-color: #007bff;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                    width: 100%;
                `;
                this.clearContainerButton.addEventListener('click', () => {
                    this.clearContainer();
                });
            }
            container.appendChild(this.clearContainerButton);
        } else {
            // Remove container info and button if they exist
            if (this.containerInfo && this.containerInfo.parentNode) {
                this.containerInfo.parentNode.removeChild(this.containerInfo);
            }
            if (this.clearContainerButton && this.clearContainerButton.parentNode) {
                this.clearContainerButton.parentNode.removeChild(this.clearContainerButton);
            }
        }

        if (classNames.length === 0) {
            const empty = document.createElement('div');
            empty.classList.add('tool-button');
            empty.style.opacity = '0.6';
            empty.textContent = 'No creatable classes available';
            container.appendChild(empty);
        } else {
            const list = document.createElement('div');
            list.style.display = 'flex';
            list.style.flexDirection = 'column';
            list.style.gap = '4px';

            classNames.forEach(className => {
                const item = document.createElement('div');
                item.classList.add('tool-button', 'instance-palette-item');
                item.textContent = className;
                item.addEventListener('click', () => this.handleInstancePaletteClick(className));
                list.appendChild(item);
            });

            container.appendChild(list);
        }

        paletteBody.appendChild(container);
    }

    private async handleInstancePaletteClick(className: string): Promise<void> {
        await this.createInstance(className);
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
        const sourceInstances = await this.findAvailableInstancesForReference(sourceRef.type);
        const targetInstances = await this.findAvailableInstancesForReference(targetRef.type);

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

    private async findAvailableInstancesForReference(referenceType: string): Promise<Array<{id: string, className: string}>> {
        const collected = new Map<string, { id: string; className: string }>();

        const allowedClassNames = new Set<string>();
        const addAllowedClass = (name?: string) => {
            const normalized = this.normalizeClassName(name);
            if (normalized) {
                allowedClassNames.add(normalized);
            }
        };

        addAllowedClass(referenceType);
        for (const ci of this.allClasses) {
            if (this.isSubtypeOf(ci.className, referenceType)) {
                addAllowedClass(ci.className);
            }
        }

        const modelInstances = this.collectInstancesFromModel(allowedClassNames);
        modelInstances.forEach(instance => collected.set(instance.id, instance));

        if (collected.size === 0) {
            for (const allowed of allowedClassNames) {
                const domIds = this.findDomInstancesByPrefix(allowed + '_');
                if (domIds.length > 0) {
                    domIds.forEach(id => collected.set(id, { id, className: allowed }));
                }
            }
        }

        if (collected.size === 0) {
            try {
                const remoteInstances = await this.requestInstancesOverview(Array.from(allowedClassNames));
                remoteInstances.forEach(instance => {
                    const normalizedClass = this.normalizeClassName(instance.className) || instance.className;
                    if (instance.id) {
                        collected.set(instance.id, { id: instance.id, className: normalizedClass });
                    }
                });
            } catch (error) {
                // Ignore failures when fetching remote instances; fall back to any locally discovered ones.
            }
        }

        return Array.from(collected.values());
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
                        alert(`Could not connect ${className} because the new instance id was not available yet.`);
                    }
                } catch (refError) {
                    alert('Error creating references: ' + refError);
                }
            }, 500);

            // Refresh available classes
            this.refreshAvailableClasses();
            setTimeout(() => this.refreshAvailableClasses(), 1000);
            setTimeout(() => this.refreshAvailableClasses(), 2000);

        } catch (error) {
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
        const normalizedClass = this.normalizeClassName(className);
        if (!normalizedClass) {
            return null;
        }

        let instances = this.findInstancesOfClassByName(normalizedClass);

        if (instances.length === 0) {
            try {
                const remoteInstances = await this.requestInstancesOverview([normalizedClass]);
                instances = remoteInstances
                    .filter(inst => this.normalizeClassName(inst.className) === normalizedClass)
                    .map(inst => inst.id);
            } catch (error) {
                return null;
            }
        }

        if (instances.length === 0) {
            return null;
        }

        const sortedInstances = instances.sort((a, b) => {
            const aNum = parseInt(a.split('_')[1]) || 0;
            const bNum = parseInt(b.split('_')[1]) || 0;
            return bNum - aNum;
        });

        return sortedInstances[0];
    }

    /**
     * Checks if one class is a subtype of another (for reference type matching).
     */
    private isSubtypeOf(className: string, superTypeName: string): boolean {
        const clsName = this.normalizeClassName(className);
        const supName = this.normalizeClassName(superTypeName);

        if (!clsName || !supName) {
            return false;
        }

        if (clsName === supName) {
            return true;
        }

        const cls = this.allClasses.find(c => this.normalizeClassName(c.className) === clsName);
        if (!cls || !cls.eSuperTypes || cls.eSuperTypes.length === 0) {
            return false;
        }

        if (cls.eSuperTypes.some(st => this.normalizeClassName(st) === supName)) {
            return true;
        }

        return cls.eSuperTypes.some(st => this.isSubtypeOf(st, supName));
    }

    private normalizeClassName(name?: string): string {
        if (!name) {
            return '';
        }
        const parts = name.split(/[:.#]/).filter(part => part && part !== ':');
        return parts.length > 0 ? parts[parts.length - 1] : name;
    }

    private collectInstancesFromModel(allowedClassNames: Set<string>): Array<{ id: string; className: string }> {
        const results = new Map<string, { id: string; className: string }>();

        if (!this.editorContextService || !this.editorContextService.modelRoot) {
            return Array.from(results.values());
        }

        for (const allowed of allowedClassNames) {
            const ids = this.findInstancesOfClassByName(allowed);
            ids.forEach(id => {
                if (!results.has(id)) {
                    results.set(id, { id, className: allowed });
                }
            });
        }

        return Array.from(results.values());
    }

    private requestInstancesOverview(classNames: string[]): Promise<Array<{ id: string; className: string }>> {
        if (!this.actionDispatcher) {
            return Promise.resolve([]);
        }

        const sanitized = Array.from(new Set(classNames.map(name => this.normalizeClassName(name)).filter(Boolean)));
        const requestId = `instances_${++this.instanceOverviewRequestCounter}_${Date.now()}`;

        return new Promise((resolve, reject) => {
            const timeoutHandle = window.setTimeout(() => {
                this.instanceOverviewRequests.delete(requestId);
                reject(new Error('Timed out waiting for instances overview response'));
            }, 5000);

            this.instanceOverviewRequests.set(requestId, { resolve, reject, timeoutHandle });

            const action = createRequestInstancesOverviewAction(requestId, sanitized);
            this.actionDispatcher!.dispatch(action).catch(error => {
                const pending = this.instanceOverviewRequests.get(requestId);
                if (pending) {
                    window.clearTimeout(pending.timeoutHandle);
                    this.instanceOverviewRequests.delete(requestId);
                    reject(error);
                }
            });
        });
    }

    public handleInstancesOverviewResponse(response: InstancesOverviewResponse): void {
        const pending = this.instanceOverviewRequests.get(response.requestId);
        if (!pending) {
            return;
        }

        window.clearTimeout(pending.timeoutHandle);
        this.instanceOverviewRequests.delete(response.requestId);

        if (!response.success) {
            pending.reject(new Error(response.message ?? 'Failed to retrieve instances overview'));
            return;
        }

        const instances = (response.instances ?? [])
            .filter(instance => !instance.hidden)
            .map(instance => ({
                id: instance.id,
                className: this.normalizeClassName(instance.className) || instance.className
            }));

        pending.resolve(instances);
    }
}

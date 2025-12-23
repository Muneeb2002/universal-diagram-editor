import { GLSPActionDispatcher } from '@eclipse-glsp/client';
import { DeleteElementOperation } from '@eclipse-glsp/protocol';
import { createRequestInstancesOverviewAction, InstancesOverviewResponse, createSetInstanceAttributeAction } from './ecore-client-actions';

export class InstanceManagementPanel {
    private root: HTMLDivElement | null = null;
    private instancesContainer: HTMLDivElement | null = null;
    private instances: Array<{ id: string; className: string; hidden?: boolean; attributes?: Record<string, any> }> = [];
    private requestCounter = 0;
    private pendingRequests: Map<string, {
        resolve: (instances: Array<{ id: string; className: string; hidden?: boolean; attributes?: Record<string, any> }>) => void;
        reject: (error: any) => void;
        timeoutHandle: number;
    }> = new Map();

    constructor(private readonly dispatcher: GLSPActionDispatcher) {}

    public show(): void {
        if (!this.root) {
            this.create();
        }

        if (this.root && !document.body.contains(this.root)) {
            document.body.appendChild(this.root);
        }

        // Set body padding to accommodate panel
        document.body.style.setProperty('--bottom-panel-height', '350px');
        document.body.style.paddingBottom = '350px';

        // Refresh instances
        this.refreshInstances();
    }

    public hide(): void {
        if (this.root && document.body.contains(this.root)) {
            document.body.removeChild(this.root);
        }

        // Reset body padding
        document.body.style.setProperty('--bottom-panel-height', '0px');
        document.body.style.paddingBottom = '0px';
    }

    public isVisible(): boolean {
        return this.root !== null && document.body.contains(this.root);
    }

    public refreshInstances(): void {
        const requestId = `instances-${++this.requestCounter}`;
        
        const promise = new Promise<Array<{ id: string; className: string; hidden?: boolean; attributes?: Record<string, any> }>>((resolve, reject) => {
            const timeoutHandle = window.setTimeout(() => {
                this.pendingRequests.delete(requestId);
                reject(new Error('Timed out waiting for instances overview response'));
            }, 5000);

            this.pendingRequests.set(requestId, {
                resolve,
                reject,
                timeoutHandle
            });
        });

        this.dispatcher.dispatch(createRequestInstancesOverviewAction(requestId))
            .catch(error => {
                const pending = this.pendingRequests.get(requestId);
                if (pending) {
                    window.clearTimeout(pending.timeoutHandle);
                    this.pendingRequests.delete(requestId);
                    pending.reject(error);
                }
            });

        promise.then(instances => {
            this.instances = instances.filter(inst => !inst.hidden);
            this.renderInstances();
        }).catch(error => {
            console.error('Error refreshing instances:', error);
        });
    }

    public handleInstancesOverviewResponse(response: InstancesOverviewResponse): void {
        const pending = this.pendingRequests.get(response.requestId);
        if (!pending) {
            return;
        }

        window.clearTimeout(pending.timeoutHandle);
        this.pendingRequests.delete(response.requestId);

        if (response.success && response.instances) {
            // Include attributes if present in response
            const instancesWithAttrs = response.instances.map(inst => ({
                id: inst.id,
                className: inst.className,
                hidden: inst.hidden,
                attributes: (inst as any).attributes
            }));
            pending.resolve(instancesWithAttrs);
        } else {
            // Handle "No active instance model" as a valid state (empty instances)
            // This happens when no instances have been created yet
            if (response.message === 'No active instance model') {
                pending.resolve([]);
            } else {
                pending.reject(new Error(response.message || 'Failed to get instances overview'));
            }
        }
    }

    private create(): void {
        this.root = document.createElement('div');
        this.root.id = 'instance-management-panel';
        this.root.style.cssText = `
            position: fixed;
            bottom: 0;
            left: 240px;
            right: 0;
            height: 350px;
            background: white;
            border-top: 2px solid #007acc;
            box-shadow: 0 -2px 10px rgba(0,0,0,0.1);
            z-index: 900;
            display: flex;
            flex-direction: column;
            font-family: Arial, sans-serif;
        `;

        // Header
        const header = document.createElement('div');
        header.style.cssText = `
            padding: 12px 16px;
            background: #f5f5f5;
            border-bottom: 1px solid #ddd;
            font-weight: bold;
            font-size: 16px;
            color: #333;
        `;

        const title = document.createElement('div');
        title.textContent = 'Instance Elements';
        header.appendChild(title);

        this.root.appendChild(header);

        // Instances container (scrollable)
        this.instancesContainer = document.createElement('div');
        this.instancesContainer.style.cssText = `
            flex: 1;
            overflow-y: auto;
            padding: 10px;
        `;
        this.root.appendChild(this.instancesContainer);
    }

    private renderInstances(): void {
        if (!this.instancesContainer) {
            return;
        }

        // Clear existing content
        this.instancesContainer.innerHTML = '';

        if (this.instances.length === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.textContent = 'No instances created yet.';
            emptyMsg.style.cssText = `
                text-align: center;
                color: #999;
                padding: 40px;
                font-style: italic;
            `;
            this.instancesContainer.appendChild(emptyMsg);
            return;
        }

        // Create instance cards
        this.instances.forEach(instance => {
            const card = this.createInstanceCard(instance);
            this.instancesContainer!.appendChild(card);
        });
    }

    private collectAllAttributes(className: string): Array<{ attr: any; sourceClass: string }> {
        const toolbar = (window as any).globalToolbar;
        if (!toolbar || !toolbar.allClasses) {
            return [];
        }

        const classInfoList = toolbar.allClasses || [];
        const classInfo = classInfoList.find((c: any) => c.className === className);
        if (!classInfo) {
            return [];
        }

        const visited = new Set<string>();
        const allAttrs: Array<{ attr: any; sourceClass: string }> = [];

        const collect = (cls: any): void => {
            if (!cls || visited.has(cls.className)) {
                return;
            }
            visited.add(cls.className);

            // First, collect attributes from supertypes (so inherited attributes appear first)
            if (cls.eSuperTypes && Array.isArray(cls.eSuperTypes)) {
                for (const superTypeName of cls.eSuperTypes) {
                    const superType = classInfoList.find((c: any) => c.className === superTypeName);
                    if (superType) {
                        collect(superType);
                    }
                }
            }

            // Then, add own attributes
            if (cls.attributes && Array.isArray(cls.attributes)) {
                for (const attr of cls.attributes) {
                    allAttrs.push({ attr, sourceClass: cls.className });
                }
            }
        };

        collect(classInfo);
        return allAttrs;
    }

    private createInstanceCard(instance: { id: string; className: string; attributes?: Record<string, any> }): HTMLDivElement {
        const card = document.createElement('div');
        card.style.cssText = `
            background: #f9f9f9;
            border: 1px solid #ddd;
            border-radius: 6px;
            margin-bottom: 10px;
            padding: 12px;
            transition: box-shadow 0.2s;
        `;
        card.addEventListener('mouseenter', () => {
            card.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
        });
        card.addEventListener('mouseleave', () => {
            card.style.boxShadow = 'none';
        });

        // Header with instance info and action buttons
        const header = document.createElement('div');
        header.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
        `;

        const instanceInfo = document.createElement('div');
        instanceInfo.style.cssText = 'flex: 1;';
        
        const instanceId = document.createElement('div');
        instanceId.textContent = instance.id;
        instanceId.style.cssText = 'font-weight: bold; color: #333; font-size: 14px;';
        instanceInfo.appendChild(instanceId);

        const className = document.createElement('div');
        className.textContent = `Class: ${instance.className}`;
        className.style.cssText = 'font-size: 12px; color: #666; margin-top: 2px;';
        instanceInfo.appendChild(className);

        header.appendChild(instanceInfo);

        // Action buttons in upper right
        const actionButtons = document.createElement('div');
        actionButtons.style.cssText = 'display: flex; gap: 6px; align-items: center;';

        // Set Container button
        const setContainerBtn = document.createElement('button');
        setContainerBtn.textContent = 'Set Container';
        setContainerBtn.style.cssText = `
            padding: 6px 12px;
            background: #007acc;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 11px;
        `;
        setContainerBtn.addEventListener('click', () => {
            const toolbar = (window as any).globalToolbar;
            if (toolbar && toolbar.setContainer) {
                toolbar.setContainer(instance.id, instance.className);
            }
        });
        actionButtons.appendChild(setContainerBtn);

        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.style.cssText = `
            padding: 6px 12px;
            background: #007acc;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 11px;
        `;
        deleteBtn.addEventListener('click', () => {
            const confirmed = confirm(`Are you sure you want to delete "${instance.id}"?`);
            if (confirmed) {
                // Server-side handler will resolve the correct element ID (including for arc instances)
                this.dispatcher.dispatch(DeleteElementOperation.create([instance.id]));
            }
        });
        actionButtons.appendChild(deleteBtn);

        header.appendChild(actionButtons);
        card.appendChild(header);

        // Attributes section - always visible and editable
        const attributesSection = document.createElement('div');
        attributesSection.style.cssText = 'margin-top: 8px;';
        
        const attributesTitle = document.createElement('div');
        attributesTitle.textContent = 'Attributes:';
        attributesTitle.style.cssText = 'font-weight: bold; margin-bottom: 8px; color: #555; font-size: 13px;';
        attributesSection.appendChild(attributesTitle);

        // Get all attributes (including inherited)
        const allAttributes = this.collectAllAttributes(instance.className);
        const currentAttributes = instance.attributes || {};

        if (allAttributes.length === 0) {
            const noAttrs = document.createElement('div');
            noAttrs.textContent = 'No attributes available for this class';
            noAttrs.style.cssText = 'color: #999; font-style: italic; font-size: 12px;';
            attributesSection.appendChild(noAttrs);
        } else {
            allAttributes.forEach(({ attr, sourceClass }) => {
                const attrRow = document.createElement('div');
                attrRow.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-bottom: 8px;';
                
                const attrLabel = document.createElement('label');
                const isInherited = sourceClass !== instance.className;
                attrLabel.textContent = `${attr.name}${isInherited ? ` [${sourceClass}]` : ''}:`;
                attrLabel.style.cssText = `
                    min-width: 120px;
                    color: ${isInherited ? '#666' : '#555'};
                    font-weight: 500;
                    font-size: 12px;
                    font-style: ${isInherited ? 'italic' : 'normal'};
                `;
                attrRow.appendChild(attrLabel);

                // Check if this attribute type is an enum
                const toolbar = (window as any).globalToolbar;
                const isEnum = toolbar && typeof toolbar.getEnumNames === 'function' 
                    ? toolbar.getEnumNames().includes(attr.type)
                    : false;

                if (isEnum) {
                    // Create dropdown for enum attributes
                    const enumSelect = document.createElement('select');
                    const enumLiterals = toolbar && typeof toolbar.getEnumLiterals === 'function'
                        ? toolbar.getEnumLiterals(attr.type)
                        : [];
                    
                    // Add empty option for clearing the value
                    const emptyOption = document.createElement('option');
                    emptyOption.value = '';
                    emptyOption.textContent = '(none)';
                    enumSelect.appendChild(emptyOption);
                    
                    // Add enum literal options
                    enumLiterals.forEach((literal: string) => {
                        const option = document.createElement('option');
                        option.value = literal;
                        option.textContent = literal;
                        enumSelect.appendChild(option);
                    });
                    
                    // Set current value
                    const currentValue = currentAttributes[attr.name];
                    if (currentValue !== undefined && currentValue !== null) {
                        enumSelect.value = String(currentValue);
                    } else {
                        enumSelect.value = '';
                    }
                    
                    enumSelect.style.cssText = `
                        flex: 1;
                        padding: 6px 8px;
                        border: 1px solid #ddd;
                        border-radius: 4px;
                        font-size: 12px;
                        background: white;
                    `;
                    
                    // Handle value changes
                    enumSelect.addEventListener('change', () => {
                        const value = enumSelect.value === '' ? null : enumSelect.value;
                        const currentValue = currentAttributes[attr.name];
                        if (value !== currentValue) {
                            this.dispatcher.dispatch(createSetInstanceAttributeAction(instance.id, attr.name, value));
                        }
                    });

                    attrRow.appendChild(enumSelect);
                } else {
                    // Create text input for non-enum attributes
                    const attrInput = document.createElement('input');
                    attrInput.type = 'text';
                    attrInput.value = currentAttributes[attr.name] !== undefined && currentAttributes[attr.name] !== null 
                        ? String(currentAttributes[attr.name]) 
                        : '';
                    attrInput.placeholder = `Enter ${attr.type} value`;
                    attrInput.style.cssText = `
                        flex: 1;
                        padding: 6px 8px;
                        border: 1px solid #ddd;
                        border-radius: 4px;
                        font-size: 12px;
                    `;
                    
                    // Handle value changes
                    attrInput.addEventListener('blur', () => {
                        const value = attrInput.value.trim();
                        let parsedValue: any = null;
                        
                        if (value === '') {
                            parsedValue = null;
                        } else if (attr.type === 'EInt' || attr.type === 'ELong') {
                            parsedValue = parseInt(value, 10);
                            if (isNaN(parsedValue)) {
                                alert(`Invalid ${attr.type} value: ${value}`);
                                attrInput.value = currentAttributes[attr.name] !== undefined && currentAttributes[attr.name] !== null 
                                    ? String(currentAttributes[attr.name]) 
                                    : '';
                                return;
                            }
                        } else if (attr.type === 'EDouble' || attr.type === 'EFloat') {
                            parsedValue = parseFloat(value);
                            if (isNaN(parsedValue)) {
                                alert(`Invalid ${attr.type} value: ${value}`);
                                attrInput.value = currentAttributes[attr.name] !== undefined && currentAttributes[attr.name] !== null 
                                    ? String(currentAttributes[attr.name]) 
                                    : '';
                                return;
                            }
                        } else if (attr.type === 'EBoolean' || attr.type === 'boolean') {
                            parsedValue = value === 'true' || value === 'True' || value === '1';
                        } else {
                            parsedValue = value;
                        }
                        
                        // Only dispatch if value changed
                        const currentValue = currentAttributes[attr.name];
                        if (parsedValue !== currentValue) {
                            this.dispatcher.dispatch(createSetInstanceAttributeAction(instance.id, attr.name, parsedValue));
                        }
                    });

                    attrInput.addEventListener('keypress', (e) => {
                        if (e.key === 'Enter') {
                            attrInput.blur();
                        }
                    });

                    attrRow.appendChild(attrInput);
                }

                attributesSection.appendChild(attrRow);
            });
        }

        card.appendChild(attributesSection);

        return card;
    }
}


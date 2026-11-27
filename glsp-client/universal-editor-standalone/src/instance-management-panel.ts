/**
 * @author Abigail Sotomayor <s205720@dtu.dk>
 */
import { GLSPActionDispatcher } from '@eclipse-glsp/client';
import { DeleteElementOperation } from '@eclipse-glsp/protocol';
import {
    createRequestInstancesOverviewAction,
    InstanceOverviewEntry,
    InstancesOverviewResponse,
    createSetInstanceAttributeAction,
    moveStackedLaneAction
} from './ecore-client-actions';

export class InstanceManagementPanel {
    private root: HTMLDivElement | null = null;
    private instancesContainer: HTMLDivElement | null = null;
    private readonly resizeHandle = document.createElement('div');
    private resizeDrag?: AbortController;
    private height = 350;
    private readonly onViewportResize = (): void => this.setHeight(this.height);
    private instances: InstanceOverviewEntry[] = [];
    private requestCounter = 0;
    private pendingRequests: Map<string, {
        resolve: (instances: InstanceOverviewEntry[]) => void;
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

        document.body.classList.add('instance-panel-open');
        this.setHeight(this.height);
        window.addEventListener('resize', this.onViewportResize);

        this.refreshInstances();
    }

    public hide(): void {
        this.resizeDrag?.abort();
        if (this.root && document.body.contains(this.root)) {
            document.body.removeChild(this.root);
        }

        window.removeEventListener('resize', this.onViewportResize);
        document.body.classList.remove('instance-panel-open');
        document.body.style.setProperty('--bottom-panel-height', '0px');
        document.body.style.paddingBottom = '0px';
    }

    public isVisible(): boolean {
        return this.root !== null && document.body.contains(this.root);
    }

    public refreshInstances(): void {
        const requestId = `instances-${++this.requestCounter}`;
        
        const promise = new Promise<InstanceOverviewEntry[]>((resolve, reject) => {
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
            pending.resolve(response.instances);
        } else {
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
            height: var(--bottom-panel-height);
            box-sizing: border-box;
            background: white;
            border-top: 2px solid #007acc;
            box-shadow: 0 -2px 10px rgba(0,0,0,0.1);
            z-index: 900;
            display: flex;
            flex-direction: column;
            font-family: Arial, sans-serif;
        `;

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
        title.textContent = 'Diagram Elements';
        header.appendChild(title);

        this.configureResizeHandle();
        this.root.append(this.resizeHandle, header);

        this.instancesContainer = document.createElement('div');
        this.instancesContainer.id = 'instance-management-list';
        this.instancesContainer.style.cssText = `
            flex: 1;
            overflow-y: auto;
            padding: 10px;
        `;
        this.root.appendChild(this.instancesContainer);
    }

    private setHeight(height: number): void {
        const max = Math.floor(window.innerHeight * 0.8);
        const min = Math.min(120, max);
        this.height = Math.min(max, Math.max(min, height));
        const value = `${this.height}px`;
        document.body.style.setProperty('--bottom-panel-height', value);
        document.body.style.paddingBottom = value;
        this.resizeHandle.setAttribute('aria-valuemin', String(min));
        this.resizeHandle.setAttribute('aria-valuemax', String(max));
        this.resizeHandle.setAttribute('aria-valuenow', String(this.height));
    }

    private configureResizeHandle(): void {
        const handle = this.resizeHandle;
        handle.className = 'instance-panel-resize-handle';
        handle.tabIndex = 0;
        handle.setAttribute('role', 'separator');
        handle.setAttribute('aria-label', 'Resize Diagram Elements panel');
        handle.setAttribute('aria-orientation', 'horizontal');
        handle.setAttribute('aria-controls', 'instance-management-list');

        handle.addEventListener('pointerdown', event => {
            if (!event.isPrimary || event.button !== 0) return;
            event.preventDefault();
            handle.focus({ preventScroll: true });
            handle.setPointerCapture(event.pointerId);
            this.resizeDrag?.abort();
            const drag = new AbortController();
            this.resizeDrag = drag;
            const { pointerId, clientY: startY } = event;
            const startHeight = this.height;
            const options = { capture: true, signal: drag.signal };
            const stopDrag = (pointer: PointerEvent): void => {
                if (pointer.pointerId === pointerId) drag.abort();
            };
            window.addEventListener('pointermove', pointer => {
                if (pointer.pointerId !== pointerId) return;
                pointer.stopPropagation();
                this.setHeight(startHeight + startY - pointer.clientY);
            }, options);
            window.addEventListener('pointerup', stopDrag, options);
            window.addEventListener('pointercancel', stopDrag, options);
            window.addEventListener('blur', () => drag.abort(), options);
        });
        handle.addEventListener('keydown', event => {
            const heights: Record<string, number> = {
                ArrowUp: this.height + 24,
                ArrowDown: this.height - 24,
                Home: 0,
                End: window.innerHeight
            };
            const nextHeight = heights[event.key];
            if (typeof nextHeight !== 'number') return;
            event.preventDefault();
            event.stopPropagation();
            this.setHeight(nextHeight);
        });
    }

    private renderInstances(): void {
        if (!this.instancesContainer) {
            return;
        }

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

            if (cls.eSuperTypes && Array.isArray(cls.eSuperTypes)) {
                for (const superTypeName of cls.eSuperTypes) {
                    const superType = classInfoList.find((c: any) => c.className === superTypeName);
                    if (superType) {
                        collect(superType);
                    }
                }
            }

            if (cls.attributes && Array.isArray(cls.attributes)) {
                for (const attr of cls.attributes) {
                    allAttrs.push({ attr, sourceClass: cls.className });
                }
            }
        };

        collect(classInfo);
        return allAttrs;
    }

    private createInstanceCard(instance: InstanceOverviewEntry): HTMLDivElement {
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

        const actionButtons = document.createElement('div');
        actionButtons.style.cssText = 'display: flex; gap: 6px; flex-wrap: wrap; align-items: center;';

        const order = instance.laneOrder;
        if (order && order.count > 1) {
            const lanePosition = document.createElement('span');
            lanePosition.textContent = `Lane ${order.index + 1} of ${order.count}`;
            lanePosition.style.fontSize = '12px';
            actionButtons.appendChild(lanePosition);
            for (const direction of ['up', 'down'] as const) {
                const moveButton = document.createElement('button');
                moveButton.type = 'button';
                moveButton.textContent = direction === 'up' ? 'Move lane up' : 'Move lane down';
                moveButton.disabled = direction === 'up' ? order.index === 0 : order.index === order.count - 1;
                moveButton.addEventListener('click', () => {
                    void this.dispatcher.dispatch(moveStackedLaneAction(instance.id, direction));
                });
                actionButtons.appendChild(moveButton);
            }
        }

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
                this.dispatcher.dispatch(DeleteElementOperation.create([instance.id]));
            }
        });
        actionButtons.appendChild(deleteBtn);

        header.appendChild(actionButtons);
        card.appendChild(header);

        const attributesSection = document.createElement('div');
        attributesSection.style.cssText = 'margin-top: 8px;';
        
        const attributesTitle = document.createElement('div');
        attributesTitle.textContent = 'Attributes:';
        attributesTitle.style.cssText = 'font-weight: bold; margin-bottom: 8px; color: #555; font-size: 13px;';
        attributesSection.appendChild(attributesTitle);

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

                const toolbar = (window as any).globalToolbar;
                const isEnum = toolbar && typeof toolbar.getEnumNames === 'function' 
                    ? toolbar.getEnumNames().includes(attr.type)
                    : false;

                if (isEnum) {
                    const enumSelect = document.createElement('select');
                    const enumLiterals = toolbar && typeof toolbar.getEnumLiterals === 'function'
                        ? toolbar.getEnumLiterals(attr.type)
                        : [];
                    
                    const emptyOption = document.createElement('option');
                    emptyOption.value = '';
                    emptyOption.textContent = '(none)';
                    enumSelect.appendChild(emptyOption);
                    
                    enumLiterals.forEach((literal: string) => {
                        const option = document.createElement('option');
                        option.value = literal;
                        option.textContent = literal;
                        enumSelect.appendChild(option);
                    });
                    
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
                    
                    enumSelect.addEventListener('change', () => {
                        const value = enumSelect.value === '' ? null : enumSelect.value;
                        const currentValue = currentAttributes[attr.name];
                        if (value !== currentValue) {
                            this.dispatcher.dispatch(createSetInstanceAttributeAction(instance.id, attr.name, value));
                        }
                    });

                    attrRow.appendChild(enumSelect);
                } else {
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


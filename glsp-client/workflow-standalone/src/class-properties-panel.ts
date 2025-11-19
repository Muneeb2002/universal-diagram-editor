import { GLSPActionDispatcher } from '@eclipse-glsp/client';
import {
    ClassPropertiesResponse,
    createAddAttributeAction,
    createChangeClassTypeAction,
    createDeleteAttributeAction,
    createOpenClassPropertiesAction,
    createRenameClassAction,
    createUpdateAttributeAction,
    createUpdateMetamodelPropertiesAction,
    createDeleteClassAction
} from './ecore-client-actions';
import { RequestAction } from '@eclipse-glsp/protocol';
import { setPendingEnumNameRequest, getPendingEnumNameRequest, clearPendingEnumNameRequest } from './enum-names-response-handler';

const ATTRIBUTE_TYPES = ['EString', 'EInt', 'EBoolean', 'EDouble', 'EFloat', 'ELong', 'EDate'];

export class ClassPropertiesPanel {
    private root: HTMLDivElement | null = null;
    private detailContainer: HTMLDivElement | null = null;
    private statusMessage: HTMLDivElement | null = null;

    private classes: ClassPropertiesResponse['classes'] = [];
    private metamodel: ClassPropertiesResponse['metamodel'] | null = null;
    private selectedClassName: string | null = null;
    private lastStatus: { message: string; isError: boolean } | null = null;
    private enumNames: string[] = [];

    constructor(private readonly dispatcher: GLSPActionDispatcher) {}

    public show(payload: ClassPropertiesResponse): void {
        this.classes = payload.classes ?? [];
        this.metamodel = payload.metamodel ?? null;

        if (this.selectedClassName && !this.classes.some(({ className }) => className === this.selectedClassName)) {
            this.selectedClassName = null;
        }

        if (!this.root) {
            this.create();
        }

        this.renderDetail();

        if (this.root && !document.body.contains(this.root)) {
            document.body.appendChild(this.root);
        }

        document.body.style.setProperty('--bottom-panel-height', '300px');
        document.body.style.paddingBottom = '300px';
        
        // Request enum names when panel is shown
        this.requestEnumNames();
    }

    public setSelectedClass(className: string | null): void {
        if (className && !this.classes.some(({ className: existing }) => existing === className)) {
            this.selectedClassName = null;
        } else {
            this.selectedClassName = className;
        }
        this.lastStatus = null;
        this.renderDetail();
    }

    public getSelectedClass(): string | null {
        return this.selectedClassName;
    }

    private create(): void {
        this.root = document.createElement('div');
        this.root.id = 'class-properties-panel';
        this.root.style.cssText = `
            position: fixed;
            left: calc(var(--left-sidebar-width, 0px) + 24px);
            right: 0;
            bottom: 0;
            height: 300px;
            background: #fff;
            border: 1px solid #e0e0e0;
            border-left: none;
            border-bottom: none;
            border-top-left-radius: 0;
            border-top-right-radius: 10px;
            display: flex;
            z-index: 1001;
            font-family: Arial, sans-serif;
        `;

        this.detailContainer = document.createElement('div');
        this.detailContainer.style.cssText = 'flex: 1; padding: 18px; overflow:auto;';
        this.root.appendChild(this.detailContainer);
    }

    private renderDetail(): void {
        if (!this.detailContainer) {
            return;
        }

        this.detailContainer.innerHTML = '';

        if (this.selectedClassName) {
            const cls = this.classes.find(({ className }) => className === this.selectedClassName);
            if (cls) {
                this.renderClassDetail(cls);
                return;
            }
            this.selectedClassName = null;
        }

        this.renderMetamodelDetail();
    }

    private renderMetamodelDetail(): void {
        if (!this.detailContainer) {
            return;
        }

        const container = document.createElement('div');

        const title = document.createElement('h3');
        title.textContent = 'Metamodel';
        title.style.cssText = 'margin:0 0 12px 0;font-size:16px;color:#333;';
        container.appendChild(title);

        const hint = document.createElement('p');
        hint.textContent = 'Select a class in the diagram to inspect and edit its properties here.';
        hint.style.cssText = 'margin:0 0 16px 0;font-size:12px;color:#777;';
        container.appendChild(hint);

        const info = document.createElement('p');
        info.style.cssText = 'margin:0 0 12px 0;font-size:12px;color:#666;';
        const classCount = this.metamodel ? this.metamodel.classCount : this.classes.length;
        info.textContent = `Classes detected: ${classCount}`;
        container.appendChild(info);

        const nameInput = this.createLabeledInput(container, 'Name', this.metamodel?.name || '');
        const nsUriInput = this.createLabeledInput(container, 'Namespace URI', this.metamodel?.nsURI || '');
        const nsPrefixInput = this.createLabeledInput(container, 'Namespace Prefix', this.metamodel?.nsPrefix || '');

        const buttonRow = document.createElement('div');
        buttonRow.style.cssText = 'margin-top:16px;display:flex;gap:8px;';

        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Update Metamodel';
        saveBtn.style.cssText = 'padding:6px 12px;background:#007acc;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:12px;';
        saveBtn.addEventListener('click', async () => {
            const name = nameInput.value.trim();
            const nsURI = nsUriInput.value.trim();
            const nsPrefix = nsPrefixInput.value.trim();
            if (!name || !nsURI || !nsPrefix) {
                this.showStatus('All metamodel fields are required.', true);
                return;
            }
            const dispatched = await this.dispatchAction(
                createUpdateMetamodelPropertiesAction(name, nsURI, nsPrefix),
                'Metamodel properties updated.',
                'Failed to update metamodel properties.'
            );
            if (dispatched) {
                await this.refreshProperties();
            }
        });
        buttonRow.appendChild(saveBtn);

        container.appendChild(buttonRow);
        this.attachStatusMessage(container);
        this.detailContainer.appendChild(container);
    }

    private renderClassDetail(cls: ClassPropertiesResponse['classes'][number]): void {
        if (!this.detailContainer) {
            return;
        }

        const container = document.createElement('div');

        const header = document.createElement('div');
        header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;';
        const title = document.createElement('h3');
        title.textContent = cls.className;
        title.style.cssText = 'margin:0;font-size:16px;color:#333;';
        header.appendChild(title);

        const modeTag = document.createElement('span');
        modeTag.textContent = cls.isInterface ? 'interface' : cls.isAbstract ? 'abstract' : 'concrete';
        modeTag.style.cssText = 'font-size:11px;padding:2px 6px;border-radius:10px;background:#eef2ff;color:#4455aa;text-transform:uppercase;';
        header.appendChild(modeTag);
        container.appendChild(header);

        const renameLabel = document.createElement('label');
        renameLabel.textContent = 'Class name';
        renameLabel.style.cssText = 'display:block;font-size:12px;color:#555;margin-top:4px;';
        container.appendChild(renameLabel);

        const renameRow = document.createElement('div');
        renameRow.style.cssText = 'display:flex;gap:8px;margin-bottom:12px;';
        const renameInput = document.createElement('input');
        renameInput.type = 'text';
        renameInput.value = cls.className;
        renameInput.style.cssText = 'flex:1;padding:6px 8px;border:1px solid #ccc;border-radius:4px;font-size:12px;';
        renameRow.appendChild(renameInput);

        const renameBtn = document.createElement('button');
        renameBtn.textContent = 'Rename';
        renameBtn.style.cssText = 'padding:6px 12px;background:#007acc;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:12px;';
        renameBtn.addEventListener('click', async () => {
            const newName = renameInput.value.trim();
            if (!newName || newName === cls.className) {
                this.showStatus('Enter a new name to rename.', true);
                return;
            }
            const dispatched = await this.dispatchAction(
                createRenameClassAction(cls.className, newName),
                `Renamed class to '${newName}'.`,
                `Failed to rename class '${cls.className}'.`
            );
            if (dispatched) {
                this.selectedClassName = newName;
                await this.refreshProperties();
            }
        });
        renameRow.appendChild(renameBtn);
        container.appendChild(renameRow);

        const deleteRow = document.createElement('div');
        deleteRow.style.cssText = 'margin-bottom:16px;';
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete Class';
        deleteBtn.style.cssText = 'padding:6px 12px;background:#fbe9e9;color:#a61b1b;border:1px solid #f0c2c2;border-radius:4px;cursor:pointer;font-size:12px;';
        deleteBtn.addEventListener('click', async () => {
            const ok = confirm(`Delete class '${cls.className}'? This will remove references.`);
            if (!ok) {
                return;
            }
            const dispatched = await this.dispatchAction(
                createDeleteClassAction(cls.className, true),
                `Deleted class '${cls.className}'.`,
                `Failed to delete class '${cls.className}'.`
            );
            if (dispatched) {
                this.selectedClassName = null;
                await this.refreshProperties();
            }
        });
        deleteRow.appendChild(deleteBtn);
        container.appendChild(deleteRow);

        const typeRow = document.createElement('div');
        typeRow.style.cssText = 'display:flex;gap:12px;margin-bottom:16px;';

        const abstractToggle = this.createToggle(typeRow, 'Abstract', cls.isAbstract, async (checked) => {
            await this.handleClassTypeToggle(cls.className, checked, cls.isInterface);
        });
        abstractToggle.style.marginRight = '8px';

        this.createToggle(typeRow, 'Interface', cls.isInterface, async (checked) => {
            await this.handleClassTypeToggle(cls.className, cls.isAbstract, checked);
        });

        container.appendChild(typeRow);

        const sectionTitle = document.createElement('h4');
        sectionTitle.textContent = 'Attributes';
        sectionTitle.style.cssText = 'margin:12px 0 8px 0;font-size:13px;color:#333;';
        container.appendChild(sectionTitle);

        if (!cls.attributes || cls.attributes.length === 0) {
            const empty = document.createElement('div');
            empty.textContent = 'No attributes defined.';
            empty.style.cssText = 'font-size:12px;color:#777;margin-bottom:8px;';
            container.appendChild(empty);
        } else {
            cls.attributes.forEach(attr => {
                container.appendChild(this.createAttributeEditor(cls.className, attr));
            });
        }

        container.appendChild(this.createAddAttributeForm(cls.className));
        this.attachStatusMessage(container);
        this.detailContainer.appendChild(container);
    }

    private createAttributeEditor(className: string, attr: { name: string; type: string; lowerBound: number; upperBound: number }): HTMLDivElement {
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'padding:10px;border:1px solid #e6e6e6;border-radius:6px;margin-bottom:8px;background:#fafafa;';

        const fieldsRow = document.createElement('div');
        fieldsRow.style.cssText = 'display:grid;grid-template-columns:120px 1fr 1fr 80px;gap:8px;align-items:center;';

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.value = attr.name;
        nameInput.style.cssText = 'width:100%;padding:4px 6px;border:1px solid #ccc;border-radius:4px;font-size:12px;';

        const typeSelect = document.createElement('select');
        typeSelect.style.cssText = 'width:100%;padding:4px 6px;border:1px solid #ccc;border-radius:4px;font-size:12px;';
        
        // Add primitive types
        ATTRIBUTE_TYPES.forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = type;
            if (type === attr.type) {
                option.selected = true;
            }
            typeSelect.appendChild(option);
        });
        
        // Add enum types
        this.addEnumOptionsToSelect(typeSelect, attr.type);

        const lowerInput = document.createElement('input');
        lowerInput.type = 'number';
        lowerInput.value = String(attr.lowerBound ?? 0);
        lowerInput.style.cssText = 'width:100%;padding:4px 6px;border:1px solid #ccc;border-radius:4px;font-size:12px;';

        const upperInput = document.createElement('input');
        upperInput.type = 'number';
        upperInput.value = String(attr.upperBound ?? 1);
        upperInput.style.cssText = 'width:100%;padding:4px 6px;border:1px solid #ccc;border-radius:4px;font-size:12px;';

        fieldsRow.appendChild(this.wrapField('Name', nameInput));
        fieldsRow.appendChild(this.wrapField('Type', typeSelect));
        fieldsRow.appendChild(this.wrapField('Lower', lowerInput));
        fieldsRow.appendChild(this.wrapField('Upper', upperInput));
        wrapper.appendChild(fieldsRow);

        const actionsRow = document.createElement('div');
        actionsRow.style.cssText = 'margin-top:8px;display:flex;gap:8px;';

        const updateBtn = document.createElement('button');
        updateBtn.textContent = 'Update';
        updateBtn.style.cssText = 'padding:4px 10px;background:#007acc;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:12px;';
        updateBtn.addEventListener('click', async () => {
            const newName = nameInput.value.trim();
            const lower = Number(lowerInput.value);
            const upper = Number(upperInput.value);
            if (!newName) {
                this.showStatus('Attribute name cannot be empty.', true);
                return;
            }
            if (Number.isNaN(lower) || Number.isNaN(upper)) {
                this.showStatus('Bounds must be numbers.', true);
                return;
            }
            const dispatched = await this.dispatchAction(
                createUpdateAttributeAction(className, attr.name, newName, typeSelect.value, lower, upper),
                `Updated attribute '${attr.name}'.`,
                `Failed to update attribute '${attr.name}'.`
            );
            if (dispatched) {
                await this.refreshProperties();
            }
        });
        actionsRow.appendChild(updateBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.style.cssText = 'padding:4px 10px;background:#f2f2f2;color:#c33;border:1px solid #e0e0e0;border-radius:4px;cursor:pointer;font-size:12px;';
        deleteBtn.addEventListener('click', async () => {
            const ok = confirm(`Delete attribute '${attr.name}'?`);
            if (!ok) {
                return;
            }
            const dispatched = await this.dispatchAction(
                createDeleteAttributeAction(className, attr.name),
                `Deleted attribute '${attr.name}'.`,
                `Failed to delete attribute '${attr.name}'.`
            );
            if (dispatched) {
                await this.refreshProperties();
            }
        });
        actionsRow.appendChild(deleteBtn);

        wrapper.appendChild(actionsRow);

        return wrapper;
    }

    private createAddAttributeForm(className: string): HTMLDivElement {
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'margin-top:12px;padding:10px;border:1px dashed #cbd2d9;border-radius:6px;';

        const heading = document.createElement('div');
        heading.textContent = 'Add Attribute';
        heading.style.cssText = 'font-size:12px;font-weight:bold;margin-bottom:8px;color:#333;';
        wrapper.appendChild(heading);

        const grid = document.createElement('div');
        grid.style.cssText = 'display:grid;grid-template-columns:120px 1fr 1fr 80px;gap:8px;align-items:center;';

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.placeholder = 'Name';
        nameInput.style.cssText = 'width:100%;padding:4px 6px;border:1px solid #ccc;border-radius:4px;font-size:12px;';

        const typeSelect = document.createElement('select');
        typeSelect.style.cssText = 'width:100%;padding:4px 6px;border:1px solid #ccc;border-radius:4px;font-size:12px;';
        
        // Add primitive types
        ATTRIBUTE_TYPES.forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = type;
            typeSelect.appendChild(option);
        });
        
        // Add enum types
        this.addEnumOptionsToSelect(typeSelect);
        
        // Request enum names from server to ensure we have the latest
        this.requestEnumNames();

        const lowerInput = document.createElement('input');
        lowerInput.type = 'number';
        lowerInput.value = '0';
        lowerInput.style.cssText = 'width:100%;padding:4px 6px;border:1px solid #ccc;border-radius:4px;font-size:12px;';

        const upperInput = document.createElement('input');
        upperInput.type = 'number';
        upperInput.value = '1';
        upperInput.style.cssText = 'width:100%;padding:4px 6px;border:1px solid #ccc;border-radius:4px;font-size:12px;';

        grid.appendChild(this.wrapField('Name', nameInput));
        grid.appendChild(this.wrapField('Type', typeSelect));
        grid.appendChild(this.wrapField('Lower', lowerInput));
        grid.appendChild(this.wrapField('Upper', upperInput));
        wrapper.appendChild(grid);

        const addBtn = document.createElement('button');
        addBtn.textContent = 'Add Attribute';
        addBtn.style.cssText = 'margin-top:10px;padding:6px 12px;background:#28a745;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:12px;';
        addBtn.addEventListener('click', async () => {
            const name = nameInput.value.trim();
            const lower = Number(lowerInput.value);
            const upper = Number(upperInput.value);
            if (!name) {
                this.showStatus('Attribute name cannot be empty.', true);
                return;
            }
            if (Number.isNaN(lower) || Number.isNaN(upper)) {
                this.showStatus('Bounds must be numbers.', true);
                return;
            }
            const dispatched = await this.dispatchAction(
                createAddAttributeAction(className, name, typeSelect.value, lower, upper),
                `Added attribute '${name}'.`,
                `Failed to add attribute '${name}'.`
            );
            if (dispatched) {
                nameInput.value = '';
                typeSelect.value = ATTRIBUTE_TYPES[0];
                lowerInput.value = '0';
                upperInput.value = '1';
                await this.refreshProperties();
            }
        });
        wrapper.appendChild(addBtn);

        return wrapper;
    }

    private wrapField(label: string, input: HTMLElement): HTMLDivElement {
        const wrapper = document.createElement('div');
        const lbl = document.createElement('div');
        lbl.textContent = label;
        lbl.style.cssText = 'font-size:11px;color:#555;margin-bottom:2px;';
        wrapper.appendChild(lbl);
        wrapper.appendChild(input);
        return wrapper;
    }

    private createLabeledInput(container: HTMLElement, label: string, value: string): HTMLInputElement {
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'display:flex;flex-direction:column;margin-bottom:10px;';
        const lbl = document.createElement('label');
        lbl.textContent = label;
        lbl.style.cssText = 'font-size:12px;color:#555;margin-bottom:4px;';
        wrapper.appendChild(lbl);
        const input = document.createElement('input');
        input.type = 'text';
        input.value = value;
        input.style.cssText = 'padding:6px 8px;border:1px solid #ccc;border-radius:4px;font-size:12px;';
        wrapper.appendChild(input);
        container.appendChild(wrapper);
        return input;
    }

    private createToggle(container: HTMLElement, label: string, value: boolean, onChange: (checked: boolean) => Promise<void>): HTMLLabelElement {
        const wrapper = document.createElement('label');
        wrapper.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:12px;color:#333;cursor:pointer;';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = value;
        checkbox.addEventListener('change', async () => {
            checkbox.disabled = true;
            await onChange(checkbox.checked);
            checkbox.disabled = false;
        });
        wrapper.appendChild(checkbox);
        const text = document.createElement('span');
        text.textContent = label;
        wrapper.appendChild(text);
        container.appendChild(wrapper);
        return wrapper;
    }

    private async handleClassTypeToggle(className: string, abstract: boolean, isInterface: boolean): Promise<void> {
        let type: 'abstract' | 'concrete' | 'interface' | 'abstract-interface' = 'concrete';
        if (abstract && isInterface) {
            type = 'abstract-interface';
        } else if (abstract) {
            type = 'abstract';
        } else if (isInterface) {
            type = 'interface';
        }
        const dispatched = await this.dispatchAction(
            createChangeClassTypeAction(className, type),
            `Updated type for '${className}'.`,
            `Failed to update type for '${className}'.`
        );
        if (dispatched) {
            await this.refreshProperties();
        }
    }

    private showStatus(message: string, isError = false): void {
        this.lastStatus = { message, isError };

        if (!this.statusMessage) {
            this.statusMessage = document.createElement('div');
            this.statusMessage.style.cssText = 'margin-top:16px;font-size:12px;';
        }

        this.statusMessage.textContent = message;
        this.statusMessage.style.color = isError ? '#c62828' : '#4a4a4a';

        if (this.detailContainer) {
            const parent = this.detailContainer.lastElementChild as HTMLElement | null;
            if (parent && this.statusMessage.parentElement !== parent) {
                parent.appendChild(this.statusMessage);
            }
        }
    }

    private attachStatusMessage(container: HTMLElement): void {
        if (!this.lastStatus) {
            if (this.statusMessage && this.statusMessage.parentElement === container) {
                container.removeChild(this.statusMessage);
            }
            return;
        }

        if (!this.statusMessage) {
            this.statusMessage = document.createElement('div');
            this.statusMessage.style.cssText = 'margin-top:16px;font-size:12px;';
        }

        this.statusMessage.textContent = this.lastStatus.message;
        this.statusMessage.style.color = this.lastStatus.isError ? '#c62828' : '#4a4a4a';

        if (this.statusMessage.parentElement !== container) {
            container.appendChild(this.statusMessage);
        }
    }

    private async dispatchAction(action: any, successMessage?: string, errorMessage?: string): Promise<boolean> {
        try {
            await this.dispatcher.dispatch(action);
            if (successMessage) {
                this.showStatus(successMessage);
            }
            return true;
        } catch (error) {
            console.error('Failed to dispatch action', error);
            this.showStatus(errorMessage ?? 'Action failed. Check console for details.', true);
            return false;
        }
    }

    private async refreshProperties(): Promise<void> {
        await this.dispatcher.dispatch(createOpenClassPropertiesAction());
    }
    
    /**
     * Adds enum options to a type select dropdown
     */
    private addEnumOptionsToSelect(typeSelect: HTMLSelectElement, currentType?: string): void {
        // Remove existing enum separator and options if they exist
        const existingOptions = Array.from(typeSelect.options);
        const separatorIndex = existingOptions.findIndex(opt => opt.textContent === '--- Enums ---');
        if (separatorIndex >= 0) {
            // Remove all options from separator onwards (they're enums)
            for (let i = typeSelect.options.length - 1; i >= separatorIndex; i--) {
                typeSelect.remove(i);
            }
        }
        
        // Add enum types if available
        if (this.enumNames && this.enumNames.length > 0) {
            // Add separator option
            const separatorOption = document.createElement('option');
            separatorOption.disabled = true;
            separatorOption.textContent = '--- Enums ---';
            typeSelect.appendChild(separatorOption);
            
            // Add enum options (sorted)
            this.enumNames.slice().sort().forEach((enumName: string) => {
                const option = document.createElement('option');
                option.value = enumName;
                option.textContent = enumName;
                if (currentType && enumName === currentType) {
                    option.selected = true;
                }
                typeSelect.appendChild(option);
            });
        }
    }
    
    /**
     * Requests enum names from the server
     */
    private requestEnumNames(): void {
        // Try to get enum names from toolbar (cached)
        const toolbar = (window as any).globalToolbar;
        if (toolbar) {
            if (typeof toolbar.getEnumNames === 'function') {
                const enumNames = toolbar.getEnumNames();
                if (enumNames && Array.isArray(enumNames) && enumNames.length > 0) {
                    this.enumNames = enumNames;
                    // Update all type selects in the panel
                    this.updateAllTypeSelects();
                }
            }
        }
        
        // Also request enum names from server to ensure we have the latest
        const requestId = RequestAction.generateRequestId();
        const requestAction: any = {
            kind: 'requestEnumNames',
            requestId: requestId
        };
        
        // Use promise-based approach
        new Promise<string[]>((resolve, reject) => {
            const timeoutHandle = window.setTimeout(() => {
                clearPendingEnumNameRequest(requestId);
                reject(new Error('Timed out waiting for enum names response'));
            }, 5000);
            
            setPendingEnumNameRequest(requestId, resolve, reject, timeoutHandle);
            
            // Dispatch the action
            this.dispatcher.dispatch(requestAction).catch(error => {
                const pending = getPendingEnumNameRequest(requestId);
                if (pending) {
                    window.clearTimeout(pending.timeoutHandle);
                    clearPendingEnumNameRequest(requestId);
                    reject(error);
                }
            });
        }).then((enumNames: string[]) => {
            this.enumNames = enumNames || [];
            // Update all type selects in the panel
            this.updateAllTypeSelects();
            // Also update the toolbar cache
            if (toolbar && typeof toolbar.updateEnumNames === 'function') {
                toolbar.updateEnumNames(enumNames);
            }
        }).catch((error) => {
            console.error('[ClassPropertiesPanel] Failed to request enum names:', error);
        });
    }
    
    /**
     * Updates all type select dropdowns in the panel with enum names
     */
    private updateAllTypeSelects(): void {
        if (!this.detailContainer) {
            return;
        }
        
        // Find all type selects in the panel
        const typeSelects = this.detailContainer.querySelectorAll('select') as NodeListOf<HTMLSelectElement>;
        typeSelects.forEach(select => {
            // Check if this is a type select (has primitive types)
            const hasPrimitiveTypes = Array.from(select.options).some(opt => ATTRIBUTE_TYPES.includes(opt.value));
            if (hasPrimitiveTypes) {
                // Get current value to preserve selection
                const currentValue = select.value;
                this.addEnumOptionsToSelect(select, currentValue);
                // Restore selection if it was an enum
                if (this.enumNames.includes(currentValue)) {
                    select.value = currentValue;
                }
            }
        });
    }
}

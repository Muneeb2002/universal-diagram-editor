/**
 * @author Abigail Sotomayor <s205720@dtu.dk>
 */
import { GLSPActionDispatcher } from '@eclipse-glsp/client';
import {
    ClassPropertiesResponse,
    createAddAttributeAction,
    createChangeClassTypeAction,
    createDeleteAttributeAction,
    createOpenClassPropertiesAction,
    createRenameClassAction,
    createRenameEnumAction,
    createAddEnumLiteralAction,
    createUpdateEnumLiteralAction,
    createDeleteEnumLiteralAction,
    createUpdateAttributeAction,
    createUpdateMetamodelPropertiesAction,
    createDeleteClassAction,
    createRequestEnumNamesAction,
    EnumNamesResponse
} from './ecore-client-actions';
import { RequestAction } from '@eclipse-glsp/protocol';

const ATTRIBUTE_TYPES = ['EString', 'EInt', 'EBoolean', 'EDouble', 'EFloat', 'ELong', 'EDate'];

export class ClassPropertiesPanel {
    private root: HTMLDivElement | null = null;
    private detailContainer: HTMLDivElement | null = null;
    private statusMessage: HTMLDivElement | null = null;

    private classes: ClassPropertiesResponse['classes'] = [];
    private metamodel: ClassPropertiesResponse['metamodel'] | null = null;
    private enums: ClassPropertiesResponse['enums'] = [];
    private selectedClassName: string | null = null;
    private selectedEnumName: string | null = null;
    private lastStatus: { message: string; isError: boolean } | null = null;
    private enumNames: string[] = [];

    constructor(private readonly dispatcher: GLSPActionDispatcher) {}

    public show(payload: ClassPropertiesResponse): void {
        this.classes = payload.classes ?? [];
        this.metamodel = payload.metamodel ?? null;
        this.enums = payload.enums ?? [];

        if (this.selectedClassName && !this.classes.some(({ className }) => className === this.selectedClassName)) {
            this.selectedClassName = null;
        }

        if (this.selectedEnumName && !this.enums.some(({ enumName }) => enumName === this.selectedEnumName)) {
            this.selectedEnumName = null;
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
        
        this.requestEnumNames();
    }

    public setSelectedClass(className: string | null): void {
        if (className) {
            this.selectedEnumName = null;
        }
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

    public setSelectedEnum(enumName: string | null): void {
        if (enumName) {
            this.selectedClassName = null;
        }
        this.selectedEnumName = enumName;
        this.lastStatus = null;
        this.renderDetail();
    }

    public getSelectedEnum(): string | null {
        return this.selectedEnumName;
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
            /* Render below modal dialogs (which use z-index 1000/1001) */
            z-index: 900;
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

        // Check for enum selection first
        if (this.selectedEnumName) {
            this.renderEnumDetail(this.selectedEnumName);
            return;
        }

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
        title.textContent = 'Ecore model';
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
        deleteBtn.style.cssText = 'padding:6px 12px;background:#007acc;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:12px;';
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
        deleteBtn.style.cssText = 'padding:4px 10px;background:#007acc;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:12px;';
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
        
        ATTRIBUTE_TYPES.forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = type;
            typeSelect.appendChild(option);
        });
        

        this.addEnumOptionsToSelect(typeSelect);
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
        addBtn.style.cssText = 'margin-top:10px;padding:6px 12px;background:#007acc;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:12px;';
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

        const existingOptions = Array.from(typeSelect.options);
        const separatorIndex = existingOptions.findIndex(opt => opt.textContent === '--- Enums ---');
        if (separatorIndex >= 0) {

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

        const toolbar = (window as any).globalToolbar;
        if (toolbar) {
            if (typeof toolbar.getEnumNames === 'function') {
                const enumNames = toolbar.getEnumNames();
                if (enumNames && Array.isArray(enumNames) && enumNames.length > 0) {
                    this.enumNames = enumNames;

                    this.updateAllTypeSelects();
                }
            }
        }
        

        const requestId = RequestAction.generateRequestId();
        const requestAction = createRequestEnumNamesAction(requestId);
        

        this.dispatcher.requestUntil<EnumNamesResponse>(requestAction, 5000, true).then((response) => {
            if (!response) {
                throw new Error('No response received for enum names request');
            }
            if (!response.success) {
                throw new Error(response.message || 'Failed to retrieve enum names');
            }
            const enumNames = response.enumNames || [];
            this.enumNames = enumNames;
            this.updateAllTypeSelects();
            const toolbar = (window as any).globalToolbar;
            if (toolbar && typeof toolbar.updateEnumNames === 'function') {
                toolbar.updateEnumNames(enumNames);
            }
        }).catch((error) => {
            console.error('[ClassPropertiesPanel] Failed to request enum names:', error);
        });
    }
    
    private renderEnumDetail(enumName: string): void {
        if (!this.detailContainer) {
            return;
        }

        const container = document.createElement('div');

        const header = document.createElement('div');
        header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;';
        const title = document.createElement('h3');
        title.textContent = enumName;
        title.style.cssText = 'margin:0;font-size:16px;color:#333;';
        header.appendChild(title);

        const typeTag = document.createElement('span');
        typeTag.textContent = 'enum';
        typeTag.style.cssText = 'font-size:11px;padding:2px 6px;border-radius:10px;background:#fff3cd;color:#856404;text-transform:uppercase;';
        header.appendChild(typeTag);
        container.appendChild(header);


        const renameLabel = document.createElement('label');
        renameLabel.textContent = 'Enum name';
        renameLabel.style.cssText = 'display:block;font-size:12px;color:#555;margin-top:4px;';
        container.appendChild(renameLabel);

        const renameRow = document.createElement('div');
        renameRow.style.cssText = 'display:flex;gap:8px;margin-bottom:12px;';
        const renameInput = document.createElement('input');
        renameInput.type = 'text';
        renameInput.value = enumName;
        renameInput.style.cssText = 'flex:1;padding:6px 8px;border:1px solid #ccc;border-radius:4px;font-size:12px;';
        renameRow.appendChild(renameInput);

        const renameBtn = document.createElement('button');
        renameBtn.textContent = 'Rename';
        renameBtn.style.cssText = 'padding:6px 12px;background:#007acc;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:12px;';
        renameBtn.addEventListener('click', async () => {
            const newName = renameInput.value.trim();
            if (!newName || newName === enumName) {
                this.showStatus('Enter a new name to rename.', true);
                return;
            }
            const dispatched = await this.dispatchAction(
                createRenameEnumAction(enumName, newName),
                `Renamed enum to '${newName}'.`,
                `Failed to rename enum '${enumName}'.`
            );
            if (dispatched) {
                this.selectedEnumName = newName;
                await this.refreshProperties();
            }
        });
        renameRow.appendChild(renameBtn);
        container.appendChild(renameRow);

        let enumData: { enumName: string; literals: Array<{ name: string; value?: number }> } | undefined;
        if (this.enums) {
            enumData = this.enums.find((e) => e.enumName === enumName);
        }
        
        if (!enumData) {
            const toolbar: any = (window as any).globalToolbar;
            if (toolbar && toolbar.getEnums) {
                const toolbarEnums = toolbar.getEnums();
                enumData = toolbarEnums.find((e: any) => e.enumName === enumName);
            }
        }

        const literals = enumData?.literals || [];

        const literalsLabel = document.createElement('label');
        literalsLabel.textContent = 'Enum Literals';
        literalsLabel.style.cssText = 'display:block;font-size:12px;color:#555;margin-top:8px;margin-bottom:8px;font-weight:bold;';
        container.appendChild(literalsLabel);

        const literalsContainer = document.createElement('div');
        literalsContainer.style.cssText = 'margin-bottom:12px;';
        
        if (literals.length === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.textContent = 'No literals defined.';
            emptyMsg.style.cssText = 'font-size:12px;color:#777;font-style:italic;padding:8px;';
            literalsContainer.appendChild(emptyMsg);
        } else {
            literals.forEach((literal, index) => {
                const literalRow = document.createElement('div');
                literalRow.style.cssText = 'display:flex;gap:8px;align-items:center;margin-bottom:6px;';
                
                const literalInput = document.createElement('input');
                literalInput.type = 'text';
                literalInput.value = literal.name;
                literalInput.style.cssText = 'flex:1;padding:6px 8px;border:1px solid #ccc;border-radius:4px;font-size:12px;';
                literalInput.placeholder = 'Literal name';
                literalRow.appendChild(literalInput);

                const valueInput = document.createElement('input');
                valueInput.type = 'number';
                valueInput.value = literal.value !== undefined ? String(literal.value) : String(index);
                valueInput.style.cssText = 'width:80px;padding:6px 8px;border:1px solid #ccc;border-radius:4px;font-size:12px;';
                valueInput.placeholder = 'Value';
                literalRow.appendChild(valueInput);

                const updateBtn = document.createElement('button');
                updateBtn.textContent = 'Update';
                updateBtn.style.cssText = 'padding:4px 8px;background:#007acc;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:11px;';
                updateBtn.addEventListener('click', async () => {
                    const newName = literalInput.value.trim();
                    const newValue = parseInt(valueInput.value);
                    if (!newName) {
                        this.showStatus('Literal name cannot be empty.', true);
                        return;
                    }
                    if (isNaN(newValue)) {
                        this.showStatus('Literal value must be a valid number.', true);
                        return;
                    }
                    const dispatched = await this.dispatchAction(
                        createUpdateEnumLiteralAction(enumName, literal.name, newName, newValue),
                        `Updated enum literal '${literal.name}' to '${newName}'.`,
                        `Failed to update enum literal '${literal.name}'.`
                    );
                    if (dispatched) {
                        await this.refreshProperties();
                    }
                });
                literalRow.appendChild(updateBtn);

                const deleteBtn = document.createElement('button');
                deleteBtn.textContent = 'Delete';
                deleteBtn.style.cssText = 'padding:4px 8px;background:#007acc;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:11px;';
                deleteBtn.addEventListener('click', async () => {
                    const dispatched = await this.dispatchAction(
                        createDeleteEnumLiteralAction(enumName, literal.name),
                        `Deleted enum literal '${literal.name}'.`,
                        `Failed to delete enum literal '${literal.name}'.`
                    );
                    if (dispatched) {
                        await this.refreshProperties();
                    }
                });
                literalRow.appendChild(deleteBtn);

                literalsContainer.appendChild(literalRow);
            });
        }
        container.appendChild(literalsContainer);

        const addLiteralSection = document.createElement('div');
        addLiteralSection.style.cssText = 'margin-top:12px;padding-top:12px;border-top:1px solid #eee;';
        
        const addLiteralLabel = document.createElement('label');
        addLiteralLabel.textContent = 'Add New Literal';
        addLiteralLabel.style.cssText = 'display:block;font-size:12px;color:#555;margin-bottom:8px;font-weight:bold;';
        addLiteralSection.appendChild(addLiteralLabel);

        const addLiteralRow = document.createElement('div');
        addLiteralRow.style.cssText = 'display:flex;gap:8px;';
        
        const newLiteralInput = document.createElement('input');
        newLiteralInput.type = 'text';
        newLiteralInput.placeholder = 'Literal name';
        newLiteralInput.style.cssText = 'flex:1;padding:6px 8px;border:1px solid #ccc;border-radius:4px;font-size:12px;';
        addLiteralRow.appendChild(newLiteralInput);

        const newValueInput = document.createElement('input');
        newValueInput.type = 'number';
        newValueInput.value = String(literals.length);
        newValueInput.placeholder = 'Value';
        newValueInput.style.cssText = 'width:80px;padding:6px 8px;border:1px solid #ccc;border-radius:4px;font-size:12px;';
        addLiteralRow.appendChild(newValueInput);

        const addBtn = document.createElement('button');
        addBtn.textContent = 'Add Literal';
        addBtn.style.cssText = 'padding:6px 12px;background:#007acc;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:12px;';
        addBtn.addEventListener('click', async () => {
            const literalName = newLiteralInput.value.trim();
            const literalValue = parseInt(newValueInput.value);
            if (!literalName) {
                this.showStatus('Literal name cannot be empty.', true);
                return;
            }
            if (isNaN(literalValue)) {
                this.showStatus('Literal value must be a valid number.', true);
                return;
            }
            const dispatched = await this.dispatchAction(
                createAddEnumLiteralAction(enumName, literalName, literalValue),
                `Added enum literal '${literalName}'.`,
                `Failed to add enum literal '${literalName}'.`
            );
            if (dispatched) {
                newLiteralInput.value = '';
                newValueInput.value = String(literals.length + 1);
                await this.refreshProperties();
            }
        });
        addLiteralRow.appendChild(addBtn);
        addLiteralSection.appendChild(addLiteralRow);
        container.appendChild(addLiteralSection);

        this.attachStatusMessage(container);
        this.detailContainer.appendChild(container);
    }

    /**
     * Updates all type select dropdowns in the panel with enum names
     */
    private updateAllTypeSelects(): void {
        if (!this.detailContainer) {
            return;
        }
        
        const typeSelects = this.detailContainer.querySelectorAll('select') as NodeListOf<HTMLSelectElement>;
        typeSelects.forEach(select => {
            const hasPrimitiveTypes = Array.from(select.options).some(opt => ATTRIBUTE_TYPES.includes(opt.value));
            if (hasPrimitiveTypes) {
                const currentValue = select.value;
                this.addEnumOptionsToSelect(select, currentValue);
                if (this.enumNames.includes(currentValue)) {
                    select.value = currentValue;
                }
            }
        });
    }
}

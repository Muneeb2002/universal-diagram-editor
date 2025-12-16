import { GLSPActionDispatcher } from '@eclipse-glsp/client';
import { createSaveMetamodelAction, createSwitchModeAction, SaveInstanceAction, LoadInstanceAction } from './ecore-client-actions';
import { CreateMetamodelDialog } from './create-metamodel-dialog';

export class LeftSidebar {
    private sidebar: HTMLDivElement;
    private actionDispatcher: GLSPActionDispatcher | null = null;
    private loadedContainer: HTMLDivElement;
    private loadedList: HTMLDivElement;
    private savedGraphicalModelsContainer: HTMLDivElement | null = null;
    private savedGraphicalModelsList: HTMLDivElement | null = null;
    private savedMappingModelsContainer: HTMLDivElement | null = null;
    private savedMappingModelsList: HTMLDivElement | null = null;
    private mappingModelLabel: HTMLDivElement | null = null;
    private savedMappingModelsLabel: HTMLDivElement | null = null;
    private loadedInstancesLabel: HTMLDivElement | null = null;
    private loadedInstancesContainer: HTMLDivElement | null = null;
    private loadedInstancesList: HTMLDivElement | null = null;
    private metamodelViewButton: HTMLButtonElement | null = null;
    private instanceViewButton: HTMLButtonElement | null = null;
    private metamodelInstancesLabel: HTMLDivElement | null = null;
    private createInstanceButton: HTMLButtonElement | null = null;
    private saveInstanceButton: HTMLButtonElement | null = null;
    private loadInstanceButton: HTMLButtonElement | null = null;
    private mapShapesBtn: HTMLButtonElement | null = null;
    private currentMode: 'metamodel' | 'instance' = 'metamodel';
    private instanceSectionVisible = false;
    private instancesAvailableInSession = false;
    private metamodelLoadedInSession: boolean = false; // Track if metamodel was actively loaded/created in this session
    private graphicalModelLoadedInSession: boolean = false; // Track if graphical model was actively loaded/created in this session
    private createMetamodelDialog: CreateMetamodelDialog;
    private static readonly STORAGE_KEY = 'wf_loaded_metamodels';
    private static readonly GRAPHICAL_MODEL_STORAGE_KEY = 'wf_saved_graphical_models';
    private static readonly MAPPING_MODEL_STORAGE_KEY = 'wf_saved_mapping_models';
    private static readonly INSTANCE_STORAGE_KEY = 'wf_loaded_instances';
    // Keep at most N recent entries to avoid exceeding localStorage limits
    private static readonly MAX_STORED = 10;

    constructor() {
        this.createMetamodelDialog = new CreateMetamodelDialog();
        this.sidebar = document.createElement('div');
        this.sidebar.style.cssText = `
            position: fixed;
            top: 0;
            bottom: 0;
            left: 0;
            width: 220px;
            background: #ffffff;
            border-right: 1px solid #dcdfe4;
            box-shadow: 2px 0 12px rgba(0,0,0,0.05);
            z-index: 1000;
            padding: 14px 12px;
            display: flex;
            flex-direction: column;
            gap: 10px;
            font-family: Arial, sans-serif;
            overflow-y: auto;
            overflow-x: hidden;
        `;

        const metamodelLabel = document.createElement('div');
        metamodelLabel.textContent = 'Metamodels:';
        metamodelLabel.style.cssText = 'font-weight: 600; font-size: 12px; margin-top: 4px; margin-bottom: 6px; color:#444;';
        this.sidebar.appendChild(metamodelLabel);

        const loadBtn = document.createElement('button');
        loadBtn.textContent = 'Load Metamodel';
        loadBtn.style.cssText = `
            width: 100%;
            padding: 8px 12px;
            background: #007acc;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
        `;
        loadBtn.addEventListener('click', () => this.loadJSON());
        this.sidebar.appendChild(loadBtn);

        const saveMetamodelBtn = document.createElement('button');
        saveMetamodelBtn.textContent = 'Save Metamodel';
        saveMetamodelBtn.style.cssText = `
            width: 100%;
            padding: 8px 12px;
            background: #007acc;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            margin-top: 6px;
            display: none;
        `;
        saveMetamodelBtn.addEventListener('click', () => this.saveActiveMetamodel());
        this.sidebar.appendChild(saveMetamodelBtn);
        // Store reference for visibility updates
        (this as any).saveMetamodelBtn = saveMetamodelBtn;

        const createBtn = document.createElement('button');
        createBtn.textContent = 'Create Metamodel';
        createBtn.style.cssText = `
            width: 100%;
            padding: 8px 12px;
            background: #007acc;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            margin-top: 6px;
        `;
        createBtn.addEventListener('click', () => this.createCustomMetamodel());
        this.sidebar.appendChild(createBtn);

        const metamodelViewBtn = document.createElement('button');
        metamodelViewBtn.textContent = 'Metamodel View';
        metamodelViewBtn.style.cssText = `
            width: 100%;
            padding: 8px 12px;
            background: #007acc;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            margin-top: 6px;
        `;
        metamodelViewBtn.addEventListener('click', () => this.switchToMetamodelMode());
        this.metamodelViewButton = metamodelViewBtn;
        this.sidebar.appendChild(metamodelViewBtn);
        this.updateMetamodelViewButtonVisibility('metamodel');

        // Loaded Metamodels list
        const savedMetamodelsLabel = document.createElement('div');
        savedMetamodelsLabel.textContent = 'Loaded Metamodels:';
        savedMetamodelsLabel.style.cssText = 'font-weight: 600; font-size: 12px; margin-top: 12px; margin-bottom: 6px; color:#444;';
        this.sidebar.appendChild(savedMetamodelsLabel);

        this.loadedContainer = document.createElement('div');
        this.loadedContainer.style.cssText = 'display:flex; flex-direction:column; gap:6px;';
        this.loadedList = document.createElement('div');
        this.loadedList.style.cssText = 'display:flex; flex-direction:column; gap:4px;';
        this.loadedContainer.appendChild(this.loadedList);
        this.sidebar.appendChild(this.loadedContainer);

        this.renderLoadedMetamodels();

        // Graphical Model Section
        const graphicalModelLabel = document.createElement('div');
        graphicalModelLabel.textContent = 'Graphical Model:';
        graphicalModelLabel.style.cssText = 'font-weight: 600; font-size: 12px; margin-top: 18px; margin-bottom: 6px; color:#444;';
        this.sidebar.appendChild(graphicalModelLabel);

        const createGraphicalModelBtn = document.createElement('button');
        createGraphicalModelBtn.textContent = 'Create Graphical Model';
        createGraphicalModelBtn.style.cssText = `
            width: 100%;
            padding: 8px 12px;
            background: #007acc;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
        `;
        createGraphicalModelBtn.addEventListener('click', () => this.openGraphicalModelEditor('create'));
        this.sidebar.appendChild(createGraphicalModelBtn);

        const editGraphicalModelBtn = document.createElement('button');
        editGraphicalModelBtn.textContent = 'Edit Graphical Model';
        editGraphicalModelBtn.style.cssText = `
            width: 100%;
            padding: 8px 12px;
            background: #007acc;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            margin-top: 6px;
            display: none;
        `;
        editGraphicalModelBtn.addEventListener('click', () => this.openGraphicalModelEditor('edit'));
        this.sidebar.appendChild(editGraphicalModelBtn);
        // Store reference for visibility updates
        (this as any).editGraphicalModelBtn = editGraphicalModelBtn;

        // Loaded Graphical Models list
        const savedGraphicalModelsLabel = document.createElement('div');
        savedGraphicalModelsLabel.textContent = 'Loaded Graphical Models:';
        savedGraphicalModelsLabel.style.cssText = 'font-weight: 600; font-size: 12px; margin-top: 12px; margin-bottom: 6px; color:#444;';
        this.sidebar.appendChild(savedGraphicalModelsLabel);

        this.savedGraphicalModelsContainer = document.createElement('div');
        this.savedGraphicalModelsContainer.style.cssText = 'display:flex; flex-direction:column; gap:6px;';
        this.savedGraphicalModelsList = document.createElement('div');
        this.savedGraphicalModelsList.style.cssText = 'display:flex; flex-direction:column; gap:4px;';
        this.savedGraphicalModelsContainer.appendChild(this.savedGraphicalModelsList);
        this.sidebar.appendChild(this.savedGraphicalModelsContainer);
        this.renderSavedGraphicalModels();

        // Mapping Model Section
        this.mappingModelLabel = document.createElement('div');
        this.mappingModelLabel.textContent = 'Mapping Model:';
        this.mappingModelLabel.style.cssText = 'font-weight: 600; font-size: 12px; margin-top: 18px; margin-bottom: 6px; color:#444; display: none;';
        this.sidebar.appendChild(this.mappingModelLabel);

        this.mapShapesBtn = document.createElement('button');
        this.mapShapesBtn.textContent = 'Create Mapping Model';
        this.mapShapesBtn.style.cssText = `
            width: 100%;
            padding: 8px 12px;
            background: #007acc;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            display: none;
        `;
        this.mapShapesBtn.addEventListener('click', async () => {
            // Ensure we are in metamodel view before creating a mapping model
            await this.switchToMetamodelMode();
            this.openShapeMappingDialog('create');
        });
        this.sidebar.appendChild(this.mapShapesBtn);

        const editMappingBtn = document.createElement('button');
        editMappingBtn.textContent = 'Edit Mapping Model';
        editMappingBtn.style.cssText = `
            width: 100%;
            padding: 8px 12px;
            background: #007acc;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            margin-top: 6px;
            display: none;
        `;
        editMappingBtn.addEventListener('click', async () => {
            // Ensure we are in metamodel view before editing a mapping model
            await this.switchToMetamodelMode();
            this.openShapeMappingDialog('edit');
        });
        this.sidebar.appendChild(editMappingBtn);
        // Store reference for visibility updates
        (this as any).editMappingBtn = editMappingBtn;

        // Loaded Mapping Models list
        this.savedMappingModelsLabel = document.createElement('div');
        this.savedMappingModelsLabel.textContent = 'Loaded Mapping Models:';
        this.savedMappingModelsLabel.style.cssText = 'font-weight: 600; font-size: 12px; margin-top: 12px; margin-bottom: 6px; color:#444; display: none;';
        this.sidebar.appendChild(this.savedMappingModelsLabel);

        this.savedMappingModelsContainer = document.createElement('div');
        this.savedMappingModelsContainer.style.cssText = 'display: none; flex-direction:column; gap:6px;';
        this.savedMappingModelsList = document.createElement('div');
        this.savedMappingModelsList.style.cssText = 'display:flex; flex-direction:column; gap:4px;';
        this.savedMappingModelsContainer.appendChild(this.savedMappingModelsList);
        this.sidebar.appendChild(this.savedMappingModelsContainer);
        this.renderSavedMappingModels();
        
        // Initialize visibility state
        this.updateCreateMappingModelButtonState();
        this.updateEditMappingButtonVisibility();

        this.createVisualConfigurationSection(false);
    }

    public attach(): void {
        document.body.appendChild(this.sidebar);
        // Provide left margin for main toolbar if needed
        document.body.style.setProperty('--left-sidebar-width', '220px');
        // Shift main content to the right so nothing sits under the sidebar
        document.body.style.paddingLeft = '220px';
    }

    public dockToolbar(toolbarElement: HTMLDivElement): void {
        // Make the toolbar a child of the sidebar and pin it to the bottom
        toolbarElement.style.position = 'static';
        toolbarElement.style.bottom = '';
        toolbarElement.style.right = '';
        toolbarElement.style.marginTop = 'auto'; // push to bottom in flex column
        toolbarElement.style.width = '100%';
        toolbarElement.style.boxSizing = 'border-box';
        toolbarElement.style.borderTop = '1px solid #e6e6e6';
        toolbarElement.style.boxShadow = 'none';
        this.sidebar.appendChild(toolbarElement);
    }

    public setActionDispatcher(dispatcher: GLSPActionDispatcher): void {
        this.actionDispatcher = dispatcher;
    }

    public setVisualConfigurationAvailable(available: boolean): void {
        this.createVisualConfigurationSection(available);
    }

    public setMode(mode: 'metamodel' | 'instance'): void {
        this.currentMode = mode;
        if (mode === 'instance') {
            this.instancesAvailableInSession = true;
        }
        this.updateMetamodelViewButtonVisibility(mode);
        this.updateInstanceViewButtonVisibility();
        this.updateSaveInstanceButtonVisibility();
    }

    private async createCustomMetamodel(): Promise<void> {
        if (!this.actionDispatcher) {
            console.error('Action dispatcher not available');
            return;
        }

        try {
            const options = await this.createMetamodelDialog.show();

            const action = {
                kind: 'createCustomMetamodel',
                packageName: options.packageName,
                nsURI: options.nsURI,
                nsPrefix: options.nsPrefix
            };
            this.actionDispatcher.dispatch(action);
            // Mark that a metamodel has been loaded/created in this session
            this.metamodelLoadedInSession = true;
            // Show save button after creating metamodel
            setTimeout(() => this.updateSaveMetamodelButtonVisibility(), 500);
            this.updateCreateMappingModelButtonState();
        } catch (error) {
            // User cancelled or dialog was closed
            if (error instanceof Error && error.message !== 'User cancelled') {
                console.error('Error creating custom metamodel:', error);
                alert(`Error creating custom metamodel: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    }

    private async saveActiveMetamodel(): Promise<void> {
        if (!this.actionDispatcher) {
            console.warn('Action dispatcher not available');
            return;
        }

        try {
            const defaultFilename = 'metamodel.json';
            const input = prompt('Enter filename for saving the metamodel:', defaultFilename);
            if (input === null) {
                return;
            }
            const trimmed = input.trim();
            const filename = trimmed.length > 0 ? trimmed : defaultFilename;
            
            await this.actionDispatcher.dispatch(createSaveMetamodelAction(filename));
            
            // Don't cache on save - only cache when loading
            alert(`Metamodel save requested for ${filename}.`);
        } catch (error) {
            console.error('Error saving metamodel:', error);
            alert('Error saving metamodel: ' + error);
        }
    }

    private loadJSON(): void {
        if (!this.actionDispatcher) {
            console.warn('Action dispatcher not available');
            return;
        }
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
                const action = {
                    kind: 'loadMetamodel',
                    content,
                    filename: file.name,
                    isJSON: true
                } as any;
                await this.actionDispatcher!.dispatch(action);
                this.addLoadedMetamodel({ name: file.name, content });
                // Mark that a metamodel has been loaded/created in this session
                this.metamodelLoadedInSession = true;
                this.updateCreateMappingModelButtonState();
                this.updateSaveMetamodelButtonVisibility();
            } catch (e) {
                console.error('Error loading metamodel:', e);
                alert('Error loading metamodel: ' + e);
            }
        });

        document.body.appendChild(fileInput);
        fileInput.click();
        document.body.removeChild(fileInput);
    }

    private addLoadedMetamodel(entry: { name: string; content: string }): void {
        const current = this.getStoredMetamodels();
        // de-duplicate by name; keep most recent content
        const without = current.filter(e => e.name !== entry.name);
        const next = [entry, ...without].slice(0, LeftSidebar.MAX_STORED);
        try {
            localStorage.setItem(LeftSidebar.STORAGE_KEY, JSON.stringify(next));
        } catch (e) {
            // ignore storage failures
        }
        this.renderLoadedMetamodels();
    }

    private getStoredMetamodels(): Array<{ name: string; content: string }> {
        try {
            const raw = localStorage.getItem(LeftSidebar.STORAGE_KEY);
            if (!raw) return [];
            const arr = JSON.parse(raw);
            if (!Array.isArray(arr)) return [];
            return arr
                .filter(x => x && typeof x.name === 'string' && typeof x.content === 'string')
                .map(x => ({ name: x.name as string, content: x.content as string }));
        } catch {
            return [];
        }
    }

    private renderLoadedMetamodels(): void {
        if (!this.loadedList) return;
        this.loadedList.innerHTML = '';
        const items = this.getStoredMetamodels();
        this.updateSaveMetamodelButtonVisibility();
        if (items.length === 0) {
            const empty = document.createElement('div');
            empty.textContent = 'None';
            empty.style.cssText = 'font-size: 12px; color:#777;';
            this.loadedList.appendChild(empty);
            return;
        }
        for (const { name } of items) {
            const row = document.createElement('div');
            row.style.cssText = 'display:flex; align-items:center; justify-content:space-between; gap:8px;';
            const text = document.createElement('span');
            text.textContent = name;
            text.style.cssText = 'font-size: 12px; color:#333; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;';
            row.appendChild(text);

            const controls = this.createRowControls(
                () => this.reloadFromStorageName(name),
                () => this.deleteStoredMetamodel(name)
            );
            row.appendChild(controls);

            this.loadedList.appendChild(row);
        }
    }

    private async reloadFromStorageName(name: string): Promise<void> {
        if (!this.actionDispatcher) return;
        const items = this.getStoredMetamodels();
        const match = items.find(e => e.name === name);
        if (!match) return;
        const action = {
            kind: 'loadMetamodel',
            content: match.content,
            filename: match.name,
            isJSON: true
        } as any;
        try {
            await this.actionDispatcher.dispatch(action);
            // bump to most recent
            this.addLoadedMetamodel({ name: match.name, content: match.content });
            // Mark that a metamodel has been loaded/created in this session
            this.metamodelLoadedInSession = true;
            this.updateSaveMetamodelButtonVisibility();
            this.updateCreateMappingModelButtonState();
        } catch (e) {
            console.error('Error reloading metamodel:', e);
            alert('Error reloading metamodel: ' + e);
        }
    }

    private deleteStoredMetamodel(name: string): void {
        const confirmDelete = confirm(`Remove stored metamodel '${name}' from the list?`);
        if (!confirmDelete) {
            return;
        }
        const next = this.getStoredMetamodels().filter(entry => entry.name !== name);
        try {
            localStorage.setItem(LeftSidebar.STORAGE_KEY, JSON.stringify(next));
        } catch {
            // ignore storage failures
        }
        this.renderLoadedMetamodels();
        this.updateSaveMetamodelButtonVisibility();
    }

    // Loaded Metamodels methods (using getStoredMetamodels directly)

    // Loaded Graphical Models methods
    public addSavedGraphicalModel(filename: string, content: string): void {
        const current = this.getSavedGraphicalModels();
        const without = current.filter(e => e.name !== filename);
        const next = [{ name: filename, content }, ...without].slice(0, LeftSidebar.MAX_STORED);
        try {
            localStorage.setItem(LeftSidebar.GRAPHICAL_MODEL_STORAGE_KEY, JSON.stringify(next));
        } catch (e) {
            // ignore storage failures
        }
        this.renderSavedGraphicalModels();
        // Mark that a graphical model has been saved (which means it was created/loaded)
        this.graphicalModelLoadedInSession = true;
        this.updateEditGraphicalModelButtonVisibility();
        this.updateCreateMappingModelButtonState();
    }

    private getSavedGraphicalModels(): Array<{ name: string; content: string }> {
        try {
            const raw = localStorage.getItem(LeftSidebar.GRAPHICAL_MODEL_STORAGE_KEY);
            if (!raw) return [];
            const arr = JSON.parse(raw);
            if (!Array.isArray(arr)) return [];
            return arr
                .filter(x => x && typeof x.name === 'string' && typeof x.content === 'string')
                .map(x => ({ name: x.name as string, content: x.content as string }));
        } catch {
            return [];
        }
    }

    private renderSavedGraphicalModels(): void {
        if (!this.savedGraphicalModelsList) return;
        this.savedGraphicalModelsList.innerHTML = '';
        const items = this.getSavedGraphicalModels();
        // Don't update visibility here - only update when actively loaded/created
        if (items.length === 0) {
            const empty = document.createElement('div');
            empty.textContent = 'None';
            empty.style.cssText = 'font-size: 12px; color:#777;';
            this.savedGraphicalModelsList.appendChild(empty);
            return;
        }
        for (const { name } of items) {
            const row = document.createElement('div');
            row.style.cssText = 'display:flex; align-items:center; justify-content:space-between; gap:8px;';
            const text = document.createElement('span');
            text.textContent = name;
            text.style.cssText = 'font-size: 12px; color:#333; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;';
            row.appendChild(text);

            const controls = this.createRowControls(
                () => this.reloadSavedGraphicalModel(name),
                () => this.deleteSavedGraphicalModel(name)
            );
            row.appendChild(controls);

            this.savedGraphicalModelsList.appendChild(row);
        }
    }

    private async reloadSavedGraphicalModel(name: string): Promise<void> {
        const items = this.getSavedGraphicalModels();
        const match = items.find(e => e.name === name);
        if (!match) return;
        
        const editor = (window as any).globalGraphicalModelEditor;
        if (editor && editor.loadFromContent) {
            try {
                // Open the editor if it's not already open
                if (editor.show) {
                    editor.show();
                }
                // Wait a bit for the editor to be ready
                setTimeout(() => {
                    editor.loadFromContent(match.content);
                    // Mark that a graphical model has been loaded in this session
                    this.graphicalModelLoadedInSession = true;
                    this.updateEditGraphicalModelButtonVisibility();
                    this.updateCreateMappingModelButtonState();
                }, 100);
            } catch (e) {
                console.error('Error reloading graphical model:', e);
                alert('Error reloading graphical model: ' + e);
            }
        } else {
            alert('Graphical Model Editor not available.');
        }
    }

    private deleteSavedGraphicalModel(name: string): void {
        const confirmDelete = confirm(`Remove saved graphical model '${name}' from the list?`);
        if (!confirmDelete) {
                return;
            }
        const next = this.getSavedGraphicalModels().filter(entry => entry.name !== name);
        try {
            localStorage.setItem(LeftSidebar.GRAPHICAL_MODEL_STORAGE_KEY, JSON.stringify(next));
        } catch {
            // ignore storage failures
        }
        this.renderSavedGraphicalModels();
    }

    // Loaded Mapping Models methods
    public addSavedMappingModel(filename: string, content: string): void {
        const current = this.getSavedMappingModels();
        const without = current.filter(e => e.name !== filename);
        const next = [{ name: filename, content }, ...without].slice(0, LeftSidebar.MAX_STORED);
        try {
            localStorage.setItem(LeftSidebar.MAPPING_MODEL_STORAGE_KEY, JSON.stringify(next));
        } catch (e) {
            // ignore storage failures
        }
        this.renderSavedMappingModels();
    }

    private getSavedMappingModels(): Array<{ name: string; content: string }> {
        try {
            const raw = localStorage.getItem(LeftSidebar.MAPPING_MODEL_STORAGE_KEY);
            if (!raw) return [];
            const arr = JSON.parse(raw);
            if (!Array.isArray(arr)) return [];
            return arr
                .filter(x => x && typeof x.name === 'string' && typeof x.content === 'string')
                .map(x => ({ name: x.name as string, content: x.content as string }));
        } catch {
            return [];
        }
    }

    private renderSavedMappingModels(): void {
        if (!this.savedMappingModelsList) return;
        this.savedMappingModelsList.innerHTML = '';
        const items = this.getSavedMappingModels();
        if (items.length === 0) {
            const empty = document.createElement('div');
            empty.textContent = 'None';
            empty.style.cssText = 'font-size: 12px; color:#777;';
            this.savedMappingModelsList.appendChild(empty);
            return;
        }
        for (const { name } of items) {
            const row = document.createElement('div');
            row.style.cssText = 'display:flex; align-items:center; justify-content:space-between; gap:8px;';
            const text = document.createElement('span');
            text.textContent = name;
            text.style.cssText = 'font-size: 12px; color:#333; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;';
            row.appendChild(text);

            const controls = this.createRowControls(
                () => this.reloadSavedMappingModel(name),
                () => this.deleteSavedMappingModel(name)
            );
            row.appendChild(controls);

            this.savedMappingModelsList.appendChild(row);
        }
    }

    private async reloadSavedMappingModel(name: string): Promise<void> {
        const items = this.getSavedMappingModels();
        const match = items.find(e => e.name === name);
        if (!match) return;
        
        const mappingDialog = (window as any).globalShapeMappingDialog;
        if (mappingDialog && mappingDialog.loadFromContent) {
            try {
                // Get class names and shapes for the dialog
                const editor = (window as any).globalGraphicalModelEditor;
                const savedShapes = editor ? editor.getSavedShapes() : new Map();
                const toolbar: any = (window as any).globalToolbar;
                let classNames: string[] = [];
                
                // Prefer concrete (non-abstract, non-interface) classes for the mapping dialog,
                // so abstract base types like 'Object' or 'Node' are not shown.
                if (toolbar) {
                    if (typeof toolbar.getConcreteClasses === 'function') {
                        classNames = toolbar.getConcreteClasses();
                    } else if (Array.isArray(toolbar.allClasses)) {
                        // Derive concrete classes from allClasses metadata
                        classNames = toolbar.allClasses
                            .filter((cls: any) => !cls.isAbstract && !cls.isInterface)
                            .map((cls: any) => cls.className || cls);
                    } else if (typeof toolbar.getAllClassNames === 'function') {
                        // Fallback: use all class names if we don't have better metadata
                        classNames = toolbar.getAllClassNames();
                    }
                }
                
                // Load the content with classNames and savedShapes, and autoMount=true to show the dialog immediately
                mappingDialog.loadFromContent(match.content, true, classNames, savedShapes);
                this.updateEditMappingButtonVisibility();
            } catch (e) {
                console.error('Error reloading mapping model:', e);
                alert('Error reloading mapping model: ' + e);
            }
        } else {
            alert('Shape Mapping Dialog not available.');
        }
    }

    private deleteSavedMappingModel(name: string): void {
        const confirmDelete = confirm(`Remove saved mapping model '${name}' from the list?`);
        if (!confirmDelete) {
            return;
        }
        const next = this.getSavedMappingModels().filter(entry => entry.name !== name);
        try {
            localStorage.setItem(LeftSidebar.MAPPING_MODEL_STORAGE_KEY, JSON.stringify(next));
        } catch {
            // ignore storage failures
        }
        this.renderSavedMappingModels();
    }


    private createVisualConfigurationSection(visible: boolean): void {
        this.instanceSectionVisible = visible;
        if (!visible) {
            this.instancesAvailableInSession = false;
        }
        if (!this.metamodelInstancesLabel) {
            const instancesLabel = document.createElement('div');
            instancesLabel.textContent = 'Metamodel Instances:';
            instancesLabel.style.cssText = 'font-weight: 600; font-size: 12px; margin-top: 18px; margin-bottom: 6px; color:#444;';
            this.sidebar.appendChild(instancesLabel);
            this.metamodelInstancesLabel = instancesLabel;
        }
        
        // Instance View button (shown when in metamodel view and instances exist)
        if (!this.instanceViewButton) {
            const instanceViewBtn = document.createElement('button');
            instanceViewBtn.textContent = 'Instance View';
            instanceViewBtn.style.cssText = `
                width: 100%;
                padding: 8px 12px;
                background: #007acc;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
                margin-bottom: 6px;
            `;
            instanceViewBtn.addEventListener('click', () => this.switchToInstanceMode());
            this.sidebar.appendChild(instanceViewBtn);
            this.instanceViewButton = instanceViewBtn;
            // Initially hide if no instances exist
            this.updateInstanceViewButtonVisibility();
        }
        
        if (!this.createInstanceButton) {
            const createInstanceBtn = document.createElement('button');
            createInstanceBtn.textContent = 'Create Instance';
            createInstanceBtn.style.cssText = `
                width: 100%;
                padding: 8px 12px;
                background: #007acc;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
            `;
            createInstanceBtn.addEventListener('click', () => this.switchToInstanceMode());
            this.sidebar.appendChild(createInstanceBtn);
            this.createInstanceButton = createInstanceBtn;
        }

        if (!this.saveInstanceButton) {
            const saveInstanceBtn = document.createElement('button');
            saveInstanceBtn.textContent = 'Save Instance';
            saveInstanceBtn.style.cssText = `
                width: 100%;
                padding: 8px 12px;
                background: #007acc;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
                margin-top: 6px;
            `;
            saveInstanceBtn.addEventListener('click', () => this.saveInstance());
            this.sidebar.appendChild(saveInstanceBtn);
            this.saveInstanceButton = saveInstanceBtn;
            // Initially hide if no instances exist
            this.updateSaveInstanceButtonVisibility();
        }

        if (!this.loadInstanceButton) {
            const loadInstanceBtn = document.createElement('button');
            loadInstanceBtn.textContent = 'Load Instance';
            loadInstanceBtn.style.cssText = `
                width: 100%;
                padding: 8px 12px;
                background: #007acc;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
                margin-top: 6px;
            `;
            loadInstanceBtn.addEventListener('click', () => this.loadInstance());
            this.sidebar.appendChild(loadInstanceBtn);
            this.loadInstanceButton = loadInstanceBtn;
        }

        // Loaded Instances list
        if (!this.loadedInstancesContainer) {
            this.loadedInstancesLabel = document.createElement('div');
            this.loadedInstancesLabel.textContent = 'Loaded Instances:';
            this.loadedInstancesLabel.style.cssText = 'font-weight: 600; font-size: 12px; margin-top: 12px; margin-bottom: 6px; color:#444;';
            this.sidebar.appendChild(this.loadedInstancesLabel);

            this.loadedInstancesContainer = document.createElement('div');
            this.loadedInstancesContainer.style.cssText = 'display:flex; flex-direction:column; gap:6px;';
            this.loadedInstancesList = document.createElement('div');
            this.loadedInstancesList.style.cssText = 'display:flex; flex-direction:column; gap:4px;';
            this.loadedInstancesContainer.appendChild(this.loadedInstancesList);
            this.sidebar.appendChild(this.loadedInstancesContainer);

            this.renderLoadedInstances();
        }

        const display = visible ? '' : 'none';
        if (this.metamodelInstancesLabel) {
            this.metamodelInstancesLabel.style.display = display;
        }
        if (this.createInstanceButton) {
            this.createInstanceButton.style.display = display;
        }
        if (this.loadInstanceButton) {
            this.loadInstanceButton.style.display = display;
        }
        if (this.loadedInstancesLabel) {
            this.loadedInstancesLabel.style.display = display;
        }
        if (this.loadedInstancesContainer) {
            this.loadedInstancesContainer.style.display = display;
        }
        // Update conditional buttons after base visibility applied
        this.updateInstanceViewButtonVisibility();
        this.updateSaveInstanceButtonVisibility();
    }


    private async switchToInstanceMode(): Promise<void> {
        const toolbar: any = (window as any).globalToolbar;
        if (toolbar && typeof toolbar.switchToMode === 'function') {
            try {
                await toolbar.switchToMode('instance');
                return;
            } catch (error) {
                console.error('Error switching mode via toolbar:', error);
            }
        }

        if (!this.actionDispatcher) {
            console.warn('Action dispatcher not available');
            return;
        }
        try {
            await this.actionDispatcher.dispatch(createSwitchModeAction('instance'));
        } catch (error) {
            console.error('Error switching to instance mode:', error);
            alert('Error switching to instance mode: ' + error);
        }
    }

    private async switchToMetamodelMode(): Promise<void> {
        const toolbar: any = (window as any).globalToolbar;
        if (toolbar && typeof toolbar.switchToMode === 'function') {
            try {
                await toolbar.switchToMode('metamodel');
                return;
            } catch (error) {
                console.error('Error switching mode via toolbar:', error);
            }
        }

        if (!this.actionDispatcher) {
            console.warn('Action dispatcher not available');
            return;
        }
        try {
            await this.actionDispatcher.dispatch(createSwitchModeAction('metamodel'));
        } catch (error) {
            console.error('Error switching to metamodel mode:', error);
            alert('Error switching to metamodel mode: ' + error);
        }
    }

    private hasInstances(): boolean {
        return this.instancesAvailableInSession;
    }

    private updateInstanceViewButtonVisibility(): void {
        if (!this.instanceViewButton) return;
        
        // Show button only when:
        // 1. In metamodel view
        // 2. Instances exist (loaded or created)
        const shouldShow = this.instanceSectionVisible && this.currentMode === 'metamodel' && this.hasInstances();
        this.instanceViewButton.style.display = shouldShow ? 'block' : 'none';
    }

    private updateSaveInstanceButtonVisibility(): void {
        if (!this.saveInstanceButton) return;
        
        // Show button only when instances exist (loaded or created)
        const shouldShow = this.instanceSectionVisible && this.hasInstances();
        this.saveInstanceButton.style.display = shouldShow ? 'block' : 'none';
    }

    private updateMetamodelViewButtonVisibility(mode: 'metamodel' | 'instance'): void {
        if (!this.metamodelViewButton) {
            return;
        }
        this.metamodelViewButton.style.display = mode === 'instance' ? '' : 'none';
    }




    private createRowControls(onReload: () => void, onDelete: () => void): HTMLDivElement {
        const container = document.createElement('div');
        container.style.cssText = 'display:flex; gap:4px;';

        const relBtn = document.createElement('button');
        relBtn.textContent = 'Reload';
        relBtn.style.cssText = 'font-size: 11px; padding:4px 6px; border:1px solid #dcdfe4; background:#f8f9fb; color:#333; border-radius:3px; cursor:pointer;';
        relBtn.addEventListener('click', onReload);
        container.appendChild(relBtn);

        const delBtn = document.createElement('button');
        delBtn.textContent = 'Delete';
        delBtn.style.cssText = 'font-size: 11px; padding:4px 6px; border:1px solid #dcdfe4; background:#f1f3f5; color:#555; border-radius:3px; cursor:pointer;';
        delBtn.addEventListener('click', onDelete);
        container.appendChild(delBtn);

        return container;
    }

    private filterOutRootClasses(classNames: string[], toolbar: any): string[] {
        if (!Array.isArray(classNames)) {
            return [];
        }

        // For mapping dialog, we only filter out classes that explicitly look like root classes by name
        // We don't use getRootClassNames() because it filters based on containment requirements,
        // which would incorrectly filter out newly created classes that don't have containment refs yet
        return classNames.filter(name => !this.looksLikeRootClass(name));
    }

    private looksLikeRootClass(name: string): boolean {
        if (!name) {
            return false;
        }
        const normalized = name.toLowerCase();
        // Only filter out classes that explicitly have "root" in their name
        // This prevents newly created classes from being incorrectly filtered out
        return normalized === 'root' || normalized === 'rootelement' || normalized === 'rootnode';
    }

    private openGraphicalModelEditor(mode: 'create' | 'edit' = 'edit'): void {
        // Access the global graphical model editor instance
        const editor = (window as any).globalGraphicalModelEditor;
        if (editor) {
            editor.show(mode);
            // If opening in edit mode, mark that a model has been loaded
            if (mode === 'edit') {
                this.graphicalModelLoadedInSession = true;
                this.updateEditGraphicalModelButtonVisibility();
                this.updateCreateMappingModelButtonState();
            }
            // For create mode, the flag will be set when the model is saved
        } else {
            console.error('Graphical Model Editor not initialized');
            alert('Graphical Model Editor is not available. Please refresh the page.');
        }
    }

    private updateEditGraphicalModelButtonVisibility(): void {
        const editBtn = (this as any).editGraphicalModelBtn as HTMLButtonElement | undefined;
        if (!editBtn) return;

        // Only show if a graphical model has been actively loaded or created in this session
        if (this.graphicalModelLoadedInSession) {
            editBtn.style.display = 'block';
        } else {
            editBtn.style.display = 'none';
        }
    }

    private updateSaveMetamodelButtonVisibility(): void {
        const saveBtn = (this as any).saveMetamodelBtn as HTMLButtonElement | undefined;
        if (!saveBtn) return;

        // Only show if a metamodel has been actively loaded or created in this session
        if (this.metamodelLoadedInSession) {
            saveBtn.style.display = 'block';
        } else {
            saveBtn.style.display = 'none';
        }
    }

    private updateCreateMappingModelButtonState(): void {
        const shouldShow = this.metamodelLoadedInSession;
        const display = shouldShow ? '' : 'none';
        const containerDisplay = shouldShow ? 'flex' : 'none';

        if (this.mappingModelLabel) {
            this.mappingModelLabel.style.display = display;
        }
        if (this.mapShapesBtn) {
            this.mapShapesBtn.style.display = display;
        }
        if (this.savedMappingModelsLabel) {
            this.savedMappingModelsLabel.style.display = display;
        }
        if (this.savedMappingModelsContainer) {
            this.savedMappingModelsContainer.style.display = containerDisplay;
        }
    }

    public markGraphicalModelLoaded(): void {
        this.graphicalModelLoadedInSession = true;
        this.updateEditGraphicalModelButtonVisibility();
        this.updateCreateMappingModelButtonState();
    }

    private openShapeMappingDialog(mode: 'create' | 'edit' = 'create'): void {
        // Access the global instances
        const editor = (window as any).globalGraphicalModelEditor;
        const mappingDialog = (window as any).globalShapeMappingDialog;
        
        if (!mappingDialog) {
            alert('Shape Mapping Dialog is not available. Please refresh the page.');
            return;
        }

        if (!editor) {
            alert('Graphical Model Editor is not available. Please refresh the page.');
            return;
        }

        // Get saved shapes
        const savedShapes = editor.getSavedShapes();
        
        if (savedShapes.size === 0) {
            alert('No graphical shapes found. Please create and save shapes in the Graphical Model Editor first.');
            return;
        }

        // Get concrete class names from the toolbar (exclude abstract classes and interfaces)
        const toolbar: any = (window as any).globalToolbar;
        let classNames: string[] = [];
        
        if (toolbar && toolbar.getConcreteClasses) {
            classNames = toolbar.getConcreteClasses();
        } else if (toolbar && toolbar.allClasses) {
            // Use allClasses array directly
            const allClassesInfo = Array.isArray(toolbar.allClasses) ? toolbar.allClasses : [];
            classNames = allClassesInfo
                .filter((cls: any) => !cls.isAbstract && !cls.isInterface)
                .map((cls: any) => cls.className || cls);
        } else if (toolbar && toolbar.getAllClasses) {
            // Fallback: filter manually if getConcreteClasses doesn't exist
            const allClasses = toolbar.getAllClasses();
            // We can't filter without ClassInfo, so use all classes as fallback
            classNames = allClasses;
        }

        // Filter out root classes (only if we have classes)
        if (classNames.length > 0) {
            classNames = this.filterOutRootClasses(classNames, toolbar);
        }

        // Open the dialog with the specified mode
        mappingDialog.show(classNames, savedShapes, mode);
    }

    private updateEditMappingButtonVisibility(): void {
        const editBtn = (this as any).editMappingBtn;
        if (!editBtn) return;

        // Check if the mapping dialog has active mappings (loaded or created)
        // Only show the button when a mapping model has been reloaded or created
        const mappingDialog = (window as any).globalShapeMappingDialog;
        let hasMappings = false;
        
        if (mappingDialog && mappingDialog.getMappings) {
            const mappings = mappingDialog.getMappings();
            hasMappings = mappings && mappings.size > 0;
        }
        
        editBtn.style.display = hasMappings ? 'block' : 'none';
    }

    private async saveInstance(): Promise<void> {
        if (!this.actionDispatcher) {
            alert('Action dispatcher not available');
            return;
        }

        try {
            // Prompt for filename
            const filename = prompt('Enter filename for instance model (e.g., myInstances.json):', 'instances.json');
            if (!filename) {
                return; // User cancelled
            }

            // Dispatch save action
            const action = SaveInstanceAction.create(filename);
            await this.actionDispatcher.dispatch(action);
            alert('Instance model saved successfully!');
        } catch (error) {
            console.error('Error saving instance:', error);
            alert('Error saving instance: ' + error);
        }
    }

    private loadInstance(): void {
        if (!this.actionDispatcher) {
            console.warn('Action dispatcher not available');
            return;
        }
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
                const action = LoadInstanceAction.create(content, file.name);
                await this.actionDispatcher!.dispatch(action);
                this.instancesAvailableInSession = true;
                this.addLoadedInstance({ name: file.name, content });
                // Update instance view button visibility after loading
                this.updateInstanceViewButtonVisibility();
                // Update save instance button visibility after loading
                this.updateSaveInstanceButtonVisibility();
                alert('Instance model loaded successfully!');
            } catch (e) {
                console.error('Error loading instance model:', e);
                alert('Error loading instance model: ' + e);
            }
        });

        document.body.appendChild(fileInput);
        fileInput.click();
        document.body.removeChild(fileInput);
    }

    private addLoadedInstance(entry: { name: string; content: string }): void {
        const current = this.getStoredInstances();
        // de-duplicate by name; keep most recent content
        const without = current.filter(e => e.name !== entry.name);
        const next = [entry, ...without].slice(0, LeftSidebar.MAX_STORED);
        try {
            localStorage.setItem(LeftSidebar.INSTANCE_STORAGE_KEY, JSON.stringify(next));
        } catch (e) {
            // ignore storage failures
        }
        this.renderLoadedInstances();
        // Update instance view button visibility after adding instance
        this.updateInstanceViewButtonVisibility();
        // Update save instance button visibility after adding instance
        this.updateSaveInstanceButtonVisibility();
    }

    private getStoredInstances(): Array<{ name: string; content: string }> {
        try {
            const raw = localStorage.getItem(LeftSidebar.INSTANCE_STORAGE_KEY);
            if (!raw) return [];
            const arr = JSON.parse(raw);
            if (!Array.isArray(arr)) return [];
            return arr
                .filter(x => x && typeof x.name === 'string' && typeof x.content === 'string')
                .map(x => ({ name: x.name as string, content: x.content as string }));
        } catch {
            return [];
        }
    }

    private renderLoadedInstances(): void {
        if (!this.loadedInstancesList) return;
        this.loadedInstancesList.innerHTML = '';
        const items = this.getStoredInstances();
        if (items.length === 0) {
            const empty = document.createElement('div');
            empty.textContent = 'None';
            empty.style.cssText = 'font-size: 12px; color:#777;';
            this.loadedInstancesList.appendChild(empty);
            return;
        }
        for (const { name } of items) {
            const row = document.createElement('div');
            row.style.cssText = 'display:flex; align-items:center; justify-content:space-between; gap:8px;';
            const text = document.createElement('span');
            text.textContent = name;
            text.style.cssText = 'font-size: 12px; color:#333; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;';
            row.appendChild(text);

            const controls = this.createRowControls(
                () => this.reloadInstanceFromStorage(name),
                () => this.deleteStoredInstance(name)
            );
            row.appendChild(controls);

            this.loadedInstancesList.appendChild(row);
        }
    }

    private async reloadInstanceFromStorage(name: string): Promise<void> {
        if (!this.actionDispatcher) return;
        const items = this.getStoredInstances();
        const match = items.find(e => e.name === name);
        if (!match) return;
        
        try {
            // First, switch to instance mode
            await this.switchToInstanceMode();
            
            // Then load the instance model
            const action = LoadInstanceAction.create(match.content, match.name);
            await this.actionDispatcher.dispatch(action);
            
            // bump to most recent
            this.instancesAvailableInSession = true;
            this.addLoadedInstance({ name: match.name, content: match.content });
            // Update instance view button visibility after loading
            this.updateInstanceViewButtonVisibility();
            // Update save instance button visibility after loading
            this.updateSaveInstanceButtonVisibility();
        } catch (e) {
            console.error('Error reloading instance model:', e);
            alert('Error reloading instance model: ' + e);
        }
    }

    private deleteStoredInstance(name: string): void {
        const current = this.getStoredInstances();
        const next = current.filter(e => e.name !== name);
        try {
            localStorage.setItem(LeftSidebar.INSTANCE_STORAGE_KEY, JSON.stringify(next));
        } catch (e) {
            // ignore storage failures
        }
        this.renderLoadedInstances();
        // Update save instance button visibility after deleting instance
        this.updateSaveInstanceButtonVisibility();
        // Update instance view button visibility after deleting instance
        this.updateInstanceViewButtonVisibility();
    }
}



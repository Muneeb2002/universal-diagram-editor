/**
 * @author Abigail Sotomayor <s205720@dtu.dk>
 */
import { GLSPActionDispatcher } from '@eclipse-glsp/client';
import { createSaveMetamodelAction, createSwitchModeAction, CreationContainerPath, SaveInstanceAction, LoadInstanceAction, LoadMetamodelResponse } from './ecore-client-actions';
import { RequestAction } from '@eclipse-glsp/protocol';
import { CreateMetamodelDialog } from './ui/dialogs/create-metamodel-dialog';
import { EcoreSourceEditor, EcoreSourceFile } from './ecore-source-editor';
import type { GraphicalElement } from './graphical-model-editor';
import type { EcoreToolbar } from './ecore-toolbar';
import { parseGraphicalModel, readCreationContainerPaths } from './graphical-model-format';

type GraphicalModelFile = { name: string; content: string };
type SelectedGraphicalModel = GraphicalModelFile & {
    classNames: string[];
    shapes: Map<string, GraphicalElement>;
    creationContainers: CreationContainerPath[];
};
type StoredMetamodel = { name: string; content: string; files?: EcoreSourceFile[]; graphicalModel?: GraphicalModelFile };
type MetamodelUploadResponse = LoadMetamodelResponse & { responseId: string };
interface MetamodelUploadRequest extends RequestAction<MetamodelUploadResponse> {
    filename: string;
    content: string;
    files?: StoredMetamodel['files'];
}

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
    private readonly selectGraphicalModelButton = document.createElement('button');
    private readonly selectedGraphicalModelLabel = document.createElement('div');
    private currentMode: 'metamodel' | 'instance' = 'metamodel';
    private instanceSectionVisible = false;
    private instancesAvailableInSession = false;
    private metamodelLoadedInSession: boolean = false; // Track if metamodel was actively loaded/created in this session
    private graphicalModelLoadedInSession: boolean = false; // Track if graphical model was actively loaded/created in this session
    private createMetamodelDialog: CreateMetamodelDialog;
    private readonly ecoreSourceEditor = new EcoreSourceEditor(
        () => { void this.applyEcoreSource(); },
        () => this.queueEcoreDraftSave()
    );
    private ecoreSourceName?: string;
    private ecoreGraphicalModel?: SelectedGraphicalModel;
    private ecoreDraftSaveTimer?: number;
    private metamodelUploadPending = false;
    private static readonly STORAGE_KEY = 'wf_loaded_metamodels';
    private static readonly GRAPHICAL_MODEL_STORAGE_KEY = 'wf_saved_graphical_models';
    private static readonly MAPPING_MODEL_STORAGE_KEY = 'wf_saved_mapping_models';
    private static readonly INSTANCE_STORAGE_KEY = 'wf_loaded_instances';
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
        metamodelLabel.textContent = 'Ecore model:';
        metamodelLabel.style.cssText = 'font-weight: 600; font-size: 12px; margin-top: 4px; margin-bottom: 6px; color:#444;';
        this.sidebar.appendChild(metamodelLabel);

        const loadBtn = document.createElement('button');
        loadBtn.textContent = 'Load Ecore model';
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
        loadBtn.title = 'Select one JSON metamodel or all related .ecore files together';
        loadBtn.addEventListener('click', () => this.selectMetamodelFiles());
        this.sidebar.appendChild(loadBtn);

        const saveMetamodelBtn = document.createElement('button');
        saveMetamodelBtn.textContent = 'Save Ecore model';
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
        (this as any).saveMetamodelBtn = saveMetamodelBtn;

        const createBtn = document.createElement('button');
        createBtn.textContent = 'Create Ecore model';
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
        metamodelViewBtn.textContent = 'Ecore Model View';
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

        const savedMetamodelsLabel = document.createElement('div');
        savedMetamodelsLabel.textContent = 'Loaded Ecore models:';
        savedMetamodelsLabel.style.cssText = 'font-weight: 600; font-size: 12px; margin-top: 12px; margin-bottom: 6px; color:#444;';
        this.sidebar.appendChild(savedMetamodelsLabel);

        this.loadedContainer = document.createElement('div');
        this.loadedContainer.style.cssText = 'display:flex; flex-direction:column; gap:6px;';
        this.loadedList = document.createElement('div');
        this.loadedList.style.cssText = 'display:flex; flex-direction:column; gap:4px;';
        this.loadedContainer.appendChild(this.loadedList);
        this.sidebar.appendChild(this.loadedContainer);

        this.renderLoadedMetamodels();

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

        this.selectGraphicalModelButton.type = 'button';
        this.selectGraphicalModelButton.textContent = 'Select Graphical Model';
        this.selectGraphicalModelButton.style.cssText = 'padding: 8px 12px; border: 1px solid #dcdfe4; border-radius: 4px; background: #f8f9fb; cursor: pointer; font-size: 12px;';
        this.selectGraphicalModelButton.addEventListener('click', () => this.selectEcoreGraphicalModel());
        this.selectedGraphicalModelLabel.style.cssText = 'font-size: 12px; color: #444; overflow-wrap: anywhere;';
        this.selectedGraphicalModelLabel.setAttribute('role', 'status');
        this.sidebar.append(this.selectGraphicalModelButton, this.selectedGraphicalModelLabel);

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
            await this.switchToMetamodelMode();
            this.openShapeMappingDialog('edit');
        });
        this.sidebar.appendChild(editMappingBtn);
        (this as any).editMappingBtn = editMappingBtn;

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

        this.updateCreateMappingModelButtonState();
        this.updateEditMappingButtonVisibility();

        this.createVisualConfigurationSection(false);
    }

    public attach(): void {
        document.body.appendChild(this.sidebar);
        document.body.style.setProperty('--left-sidebar-width', '220px');
        document.body.style.paddingLeft = '220px';
        this.ecoreSourceEditor.attach();
        window.addEventListener('pagehide', () => this.savePendingEcoreDraft());
    }

    public setActionDispatcher(dispatcher: GLSPActionDispatcher): void {
        this.actionDispatcher = dispatcher;
    }

    public get isEcoreWorkspace(): boolean {
        return this.ecoreSourceName !== undefined;
    }

    public setVisualConfigurationAvailable(available: boolean): void {
        this.createVisualConfigurationSection(available);
    }

    public setMode(mode: 'metamodel' | 'instance'): void {
        this.currentMode = mode;
        this.ecoreSourceEditor.setVisible(mode === 'metamodel' && this.ecoreSourceName !== undefined);
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
            if (this.metamodelUploadPending) {
                alert('Wait for the current metamodel upload to finish.');
                return;
            }
            this.closeEcoreSource();
            await this.switchToMetamodelMode();

            const action = {
                kind: 'createCustomMetamodel',
                packageName: options.packageName,
                nsURI: options.nsURI,
                nsPrefix: options.nsPrefix
            };
            this.actionDispatcher.dispatch(action);
            this.metamodelLoadedInSession = true;
            setTimeout(() => this.updateSaveMetamodelButtonVisibility(), 500);
            this.updateCreateMappingModelButtonState();
        } catch (error) {
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

            alert(`Metamodel save requested for ${filename}.`);
        } catch (error) {
            console.error('Error saving metamodel:', error);
            alert('Error saving metamodel: ' + error);
        }
    }

    private selectMetamodelFiles(): void {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json,.ecore';
        fileInput.multiple = true;
        fileInput.style.display = 'none';

        fileInput.addEventListener('change', async () => {
            const files = Array.from(fileInput.files ?? []);
            if (files.length === 0) return;
            try {
                if (files.length === 1) {
                    await this.loadMetamodel({ name: files[0].name, content: await files[0].text() });
                } else {
                    if (files.some(file => !/\.ecore$/i.test(file.name))) {
                        throw new Error('Select either one JSON file or a set of .ecore files.');
                    }
                    const parts = await Promise.all(files.map(async file => ({ filename: file.name, content: await file.text() })));
                    const name = parts.map(file => file.filename).sort().join(', ');
                    await this.loadMetamodel({ name, content: '', files: parts });
                }
            } catch (e) {
                console.error('Error loading metamodel:', e);
                alert(`Error loading metamodel: ${e instanceof Error ? e.message : String(e)}`);
            }
        });

        document.body.appendChild(fileInput);
        fileInput.click();
        document.body.removeChild(fileInput);
    }

    private async loadMetamodel(entry: StoredMetamodel): Promise<void> {
        if (this.metamodelUploadPending) {
            throw new Error('Wait for the current metamodel upload to finish.');
        }
        if (entry.files?.length || /\.ecore$/i.test(entry.name)) {
            const files = entry.files?.length ? entry.files : [{ filename: entry.name, content: entry.content }];
            this.savePendingEcoreDraft();
            this.ecoreSourceName = entry.name;
            this.ecoreGraphicalModel = undefined;
            const graphicalModel = entry.graphicalModel ?? this.getStoredMetamodels()
                .find(model => model.name === entry.name)?.graphicalModel;
            if (graphicalModel) {
                try {
                    this.ecoreGraphicalModel = this.readEcoreGraphicalModel(graphicalModel);
                } catch (error) {
                    console.warn('Could not restore the selected graphical model:', error);
                }
            }
            this.ecoreSourceEditor.loadFiles(files);
            this.setMode('metamodel');
            this.metamodelLoadedInSession = false;
            this.setVisualConfigurationAvailable(false);
            this.updateCreateMappingModelButtonState();
            await this.applyEcoreSource();
            return;
        }

        this.metamodelUploadPending = true;
        try {
            const response = await this.submitMetamodel(entry);
            this.closeEcoreSource();
            await this.switchToMetamodelMode();
            this.addLoadedMetamodel(entry);
            this.updateMetamodelControls();
            if (response.warnings?.length) {
                alert(response.warnings.join('\n'));
            }
        } finally {
            this.metamodelUploadPending = false;
        }
    }

    private async submitMetamodel(entry: StoredMetamodel): Promise<MetamodelUploadResponse> {
        const dispatcher = this.actionDispatcher;
        if (!dispatcher) {
            throw new Error('Connect to the editor server to apply this metamodel.');
        }

        const request: MetamodelUploadRequest = {
            kind: 'loadMetamodel',
            requestId: RequestAction.generateRequestId(),
            filename: entry.name,
            content: entry.content,
            files: entry.files
        };
        const response = await dispatcher.requestUntil(request, 30000);
        if (!response) {
            throw new Error('The server did not respond to the metamodel upload.');
        }
        if (response.kind !== 'loadMetamodelResponse') {
            throw new Error('The server returned an unexpected reply to the metamodel upload.');
        }
        if (!response.success) {
            throw new Error(response.message ?? 'The server rejected the metamodel upload.');
        }
        await dispatcher.dispatch({ ...response, responseId: '' } as MetamodelUploadResponse);
        return response;
    }

    private updateMetamodelControls(): void {
        this.metamodelLoadedInSession = true;
        this.updateSaveMetamodelButtonVisibility();
        this.updateCreateMappingModelButtonState();
    }

    private async applyEcoreSource(): Promise<void> {
        if (!this.ecoreSourceName || this.metamodelUploadPending) {
            return;
        }
        this.metamodelUploadPending = true;
        const entry = this.createEcoreDraft(this.ecoreSourceName);
        this.cancelEcoreDraftSave();
        this.addLoadedMetamodel(entry);
        this.ecoreSourceEditor.setApplying(true);
        this.ecoreSourceEditor.setStatus('Applying Ecore files…');
        try {
            const response = await this.submitMetamodel(entry);
            await this.switchToMetamodelMode();
            this.updateMetamodelControls();
            this.ecoreSourceEditor.setStatus(['Ecore files applied.', ...(response.warnings ?? [])].join('\n'));
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.ecoreSourceEditor.setStatus(`Could not apply Ecore files. ${message}`, true);
        } finally {
            this.ecoreSourceEditor.setApplying(false);
            this.metamodelUploadPending = false;
        }
    }

    private queueEcoreDraftSave(): void {
        this.ecoreSourceEditor.setStatus('Source edited. Apply the Ecore files to update the active metamodel.');
        this.cancelEcoreDraftSave();
        this.ecoreDraftSaveTimer = window.setTimeout(() => this.savePendingEcoreDraft(), 300);
    }

    private cancelEcoreDraftSave(): void {
        if (this.ecoreDraftSaveTimer !== undefined) {
            window.clearTimeout(this.ecoreDraftSaveTimer);
            this.ecoreDraftSaveTimer = undefined;
        }
    }

    private savePendingEcoreDraft(): void {
        if (this.ecoreDraftSaveTimer !== undefined && this.ecoreSourceName) {
            this.cancelEcoreDraftSave();
            this.addLoadedMetamodel(this.createEcoreDraft(this.ecoreSourceName));
        }
    }

    private createEcoreDraft(name: string): StoredMetamodel {
        const model = this.ecoreGraphicalModel;
        const graphicalModel = model ? { name: model.name, content: model.content } : undefined;
        return { name, content: '', files: this.ecoreSourceEditor.getFiles(), graphicalModel };
    }

    private closeEcoreSource(): void {
        this.savePendingEcoreDraft();
        this.ecoreSourceName = undefined;
        this.ecoreGraphicalModel = undefined;
        window.globalShapeMappingDialog?.setGraphicalModelScope();
        this.ecoreSourceEditor.setVisible(false);
        this.updateMetamodelViewButtonVisibility(this.currentMode);
    }

    private addLoadedMetamodel(entry: StoredMetamodel): void {
        const current = this.getStoredMetamodels();
        const without = current.filter(e => e.name !== entry.name);
        const next = [entry, ...without].slice(0, LeftSidebar.MAX_STORED);
        try {
            localStorage.setItem(LeftSidebar.STORAGE_KEY, JSON.stringify(next));
        } catch (e) {
        }
        this.renderLoadedMetamodels();
    }

    private getStoredMetamodels(): StoredMetamodel[] {
        try {
            const raw = localStorage.getItem(LeftSidebar.STORAGE_KEY);
            if (!raw) return [];
            const arr = JSON.parse(raw);
            if (!Array.isArray(arr)) return [];
            return arr
                .filter(x => x && typeof x.name === 'string' && typeof x.content === 'string')
                .map(x => ({ name: x.name, content: x.content, files: x.files, graphicalModel: x.graphicalModel }));
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
            text.title = name;
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
        this.savePendingEcoreDraft();
        const items = this.getStoredMetamodels();
        const match = items.find(e => e.name === name);
        if (!match) return;
        try {
            await this.loadMetamodel(match);
        } catch (e) {
            console.error('Error reloading metamodel:', e);
            alert(`Error reloading metamodel: ${e instanceof Error ? e.message : String(e)}`);
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
        }
        this.renderLoadedMetamodels();
        this.updateSaveMetamodelButtonVisibility();
    }

    private readEcoreGraphicalModel(file: GraphicalModelFile): SelectedGraphicalModel {
        const data = parseGraphicalModel(file.content);
        const names: unknown = data?.mappableClasses;
        if (!Array.isArray(names) || names.length === 0 ||
            names.some(name => typeof name !== 'string' || name.trim() === '')) {
            throw new Error('The graphical model must contain a non-empty mappableClasses list of metamodel class names.');
        }
        if (!Array.isArray(data.shapes) || data.shapes.length === 0) {
            throw new Error('The graphical model must contain a non-empty shapes list.');
        }
        if (data.shapes.some((shape: unknown) =>
            !shape || typeof shape !== 'object' || !('id' in shape) || typeof shape.id !== 'string' || !shape.id.trim())) {
            throw new Error('Every shape in the graphical model must have an ID.');
        }
        const editor = window.globalGraphicalModelEditor;
        if (!editor) {
            throw new Error('The graphical model editor is not ready.');
        }
        const shapes = editor.readGraphicalModelShapes(data.shapes);
        if (shapes.size !== data.shapes.length) {
            throw new Error('Every shape in the graphical model must have a unique ID.');
        }
        return {
            ...file,
            classNames: [...new Set<string>(names.map(name => name.trim()))],
            shapes,
            creationContainers: readCreationContainerPaths(data.creationContainers)
        };
    }

    private selectEcoreGraphicalModel(): void {
        const workspace = this.ecoreSourceName;
        if (!workspace || !this.metamodelLoadedInSession || this.metamodelUploadPending) {
            return;
        }
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.ecore,.json,application/xml,application/json';
        input.addEventListener('change', async () => {
            const file = input.files?.[0];
            if (!file) return;
            try {
                const content = await file.text();
                if (this.ecoreSourceName !== workspace || this.metamodelUploadPending) return;
                const graphicalModel = this.readEcoreGraphicalModel({ name: file.name, content });
                const concrete = new Set(this.getConcreteMappingClasses());
                const unavailable = graphicalModel.classNames.filter(name => !concrete.has(name));
                if (unavailable.length) {
                    throw new Error(`These classes are missing or cannot be instantiated: ${unavailable.join(', ')}.`);
                }
                this.ecoreGraphicalModel = graphicalModel;
                this.cancelEcoreDraftSave();
                this.addLoadedMetamodel(this.createEcoreDraft(workspace));
                this.updateCreateMappingModelButtonState();
            } catch (error) {
                alert(`Error selecting graphical model: ${error instanceof Error ? error.message : String(error)}`);
            }
        });
        input.click();
    }


    public addSavedGraphicalModel(filename: string, content: string): void {
        const current = this.getSavedGraphicalModels();
        const without = current.filter(e => e.name !== filename);
        const next = [{ name: filename, content }, ...without].slice(0, LeftSidebar.MAX_STORED);
        try {
            localStorage.setItem(LeftSidebar.GRAPHICAL_MODEL_STORAGE_KEY, JSON.stringify(next));
        } catch (e) {
        }
        this.renderSavedGraphicalModels();
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
                if (editor.show) {
                    editor.show();
                }
                setTimeout(() => {
                    editor.loadFromContent(match.content);
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
        }
        this.renderSavedGraphicalModels();
    }

    public addSavedMappingModel(filename: string, content: string): void {
        const current = this.getSavedMappingModels();
        const without = current.filter(e => e.name !== filename);
        const next = [{ name: filename, content }, ...without].slice(0, LeftSidebar.MAX_STORED);
        try {
            localStorage.setItem(LeftSidebar.MAPPING_MODEL_STORAGE_KEY, JSON.stringify(next));
        } catch (e) {
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
                const inputs = this.getMappingInputs(true);
                if (inputs) {
                    mappingDialog.loadFromContent(match.content, true, inputs.classNames, inputs.shapes);
                    this.updateEditMappingButtonVisibility();
                }
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
            instancesLabel.textContent = 'Diagram Editor:';
            instancesLabel.style.cssText = 'font-weight: 600; font-size: 12px; margin-top: 18px; margin-bottom: 6px; color:#444;';
            this.sidebar.appendChild(instancesLabel);
            this.metamodelInstancesLabel = instancesLabel;
        }

        if (!this.instanceViewButton) {
            const instanceViewBtn = document.createElement('button');
            instanceViewBtn.textContent = 'Diagram View';
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
            this.updateInstanceViewButtonVisibility();
        }

        if (!this.createInstanceButton) {
            const createInstanceBtn = document.createElement('button');
            createInstanceBtn.textContent = 'Create Diagram';
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
            loadInstanceBtn.textContent = 'Load Diagram';
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
            this.loadedInstancesLabel.textContent = 'Loaded Diagrams:';
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
        if (this.metamodelUploadPending) {
            return;
        }
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
        if (this.ecoreSourceName) {
            this.ecoreSourceEditor.setVisible(true);
        }
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
        this.metamodelViewButton.textContent = this.ecoreSourceName ? 'Ecore Source' : 'Ecore Model View';
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
        const editor = (window as any).globalGraphicalModelEditor;
        if (editor) {
            editor.show(mode, mode === 'edit' ? this.ecoreGraphicalModel : undefined);
            if (mode === 'edit') {
                this.graphicalModelLoadedInSession = true;
                this.updateEditGraphicalModelButtonVisibility();
                this.updateCreateMappingModelButtonState();
            }
        } else {
            console.error('Graphical Model Editor not initialized');
            alert('Graphical Model Editor is not available. Please refresh the page.');
        }
    }

    private updateEditGraphicalModelButtonVisibility(): void {
        const editBtn = (this as any).editGraphicalModelBtn as HTMLButtonElement | undefined;
        if (!editBtn) return;
        if (this.graphicalModelLoadedInSession || this.ecoreGraphicalModel) {
            editBtn.style.display = 'block';
        } else {
            editBtn.style.display = 'none';
        }
    }

    private updateSaveMetamodelButtonVisibility(): void {
        const saveBtn = (this as any).saveMetamodelBtn as HTMLButtonElement | undefined;
        if (!saveBtn) return;
        if (this.metamodelLoadedInSession && !this.ecoreSourceName) {
            saveBtn.style.display = 'block';
        } else {
            saveBtn.style.display = 'none';
        }
    }

    private updateCreateMappingModelButtonState(): void {
        this.updateEditGraphicalModelButtonVisibility();
        const shouldShow = this.metamodelLoadedInSession;
        const ecoreMode = this.isEcoreWorkspace;
        const model = this.ecoreGraphicalModel;
        const classNames = this.getScopedMappingClasses();
        this.getToolbar()?.setGraphicalCreationClasses(
            ecoreMode ? (shouldShow ? classNames : []) : undefined,
            shouldShow ? model?.creationContainers : undefined
        );
        const mappingReady = shouldShow && (!ecoreMode || classNames.length > 0);
        this.selectGraphicalModelButton.hidden = !shouldShow || !ecoreMode;
        this.selectedGraphicalModelLabel.hidden = this.selectGraphicalModelButton.hidden;
        this.selectedGraphicalModelLabel.textContent = model
            ? `${model.name} · ${classNames.length} of ${model.classNames.length} classes available`
            : 'Select a graphical model to choose which classes appear in mappings.';
        window.globalShapeMappingDialog?.setGraphicalModelScope(
            shouldShow && this.ecoreSourceName && model
                ? {
                    storageKey: `shapeMappings:ecore:${JSON.stringify([this.ecoreSourceName, model.name])}`,
                    classNames: new Set(classNames),
                    shapes: model.shapes
                }
                : undefined
        );
        const display = shouldShow ? '' : 'none';

        if (this.mappingModelLabel) {
            this.mappingModelLabel.style.display = display;
        }
        if (this.mapShapesBtn) {
            this.mapShapesBtn.style.display = display;
            this.mapShapesBtn.disabled = !mappingReady;
        }
        if (this.savedMappingModelsLabel) {
            this.savedMappingModelsLabel.style.display = mappingReady ? '' : 'none';
        }
        if (this.savedMappingModelsContainer) {
            this.savedMappingModelsContainer.style.display = mappingReady ? 'flex' : 'none';
        }
        this.updateEditMappingButtonVisibility();
    }

    public applyEditedGraphicalProfile(name: string, content: string): boolean {
        const workspace = this.ecoreSourceName;
        if (!workspace || this.ecoreGraphicalModel?.name !== name) return false;
        this.ecoreGraphicalModel = this.readEcoreGraphicalModel({ name, content });
        this.cancelEcoreDraftSave();
        this.addLoadedMetamodel(this.createEcoreDraft(workspace));
        this.updateCreateMappingModelButtonState();
        return true;
    }

    public markGraphicalModelLoaded(): void {
        this.graphicalModelLoadedInSession = true;
        this.updateEditGraphicalModelButtonVisibility();
        this.updateCreateMappingModelButtonState();
    }

    private openShapeMappingDialog(mode: 'create' | 'edit' = 'create'): void {
        const mappingDialog = window.globalShapeMappingDialog;
        if (!mappingDialog) {
            alert('Shape Mapping Dialog is not available. Please refresh the page.');
            return;
        }
        const inputs = this.getMappingInputs();
        if (inputs) {
            mappingDialog.show(inputs.classNames, inputs.shapes, mode);
        }
    }

    private getConcreteMappingClasses(): string[] {
        return this.getToolbar()?.getConcreteClasses() ?? [];
    }

    private getToolbar(): EcoreToolbar | undefined {
        return (window as Window & { globalToolbar?: EcoreToolbar }).globalToolbar;
    }

    private getScopedMappingClasses(): string[] {
        const concrete = new Set(this.getConcreteMappingClasses());
        return this.ecoreGraphicalModel?.classNames.filter(name => concrete.has(name)) ?? [];
    }

    private getMappingInputs(reloading = false): { classNames: string[]; shapes: Map<string, GraphicalElement> } | undefined {
        if (this.ecoreSourceName) {
            const model = this.ecoreGraphicalModel;
            const classNames = this.getScopedMappingClasses();
            if (!this.metamodelLoadedInSession || !model || classNames.length === 0) {
                alert('Apply the Ecore files and select a graphical model with matching classes first.');
                return undefined;
            }
            return { classNames, shapes: model.shapes };
        }
        const editor = window.globalGraphicalModelEditor;
        if (!editor && !reloading) {
            alert('Graphical Model Editor is not available. Please refresh the page.');
            return undefined;
        }
        const shapes = editor?.getSavedShapes() ?? new Map<string, GraphicalElement>();
        if (!reloading && shapes.size === 0) {
            alert('No graphical shapes found. Please create and save shapes in the Graphical Model Editor first.');
            return undefined;
        }
        const classNames = this.getConcreteMappingClasses();
        return { classNames: reloading ? classNames : classNames.filter(name => !this.looksLikeRootClass(name)), shapes };
    }

    private updateEditMappingButtonVisibility(): void {
        const editBtn = (this as any).editMappingBtn;
        if (!editBtn) return;

        const mappingDialog = (window as any).globalShapeMappingDialog;
        let hasMappings = false;

        if (mappingDialog && mappingDialog.getMappings) {
            const mappings = mappingDialog.getMappings();
            hasMappings = mappings && mappings.size > 0;
        }

        const mappingReady = !this.ecoreSourceName || (this.metamodelLoadedInSession && this.getScopedMappingClasses().length > 0);
        editBtn.style.display = hasMappings && mappingReady ? 'block' : 'none';
    }

    private async saveInstance(): Promise<void> {
        if (!this.actionDispatcher) {
            alert('Action dispatcher not available');
            return;
        }

        try {   
            const filename = prompt('Enter filename for instance model (e.g., myInstances.json):', 'instances.json');
            if (!filename) {
                return;
            }

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
                this.updateInstanceViewButtonVisibility();
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
        const without = current.filter(e => e.name !== entry.name);
        const next = [entry, ...without].slice(0, LeftSidebar.MAX_STORED);
        try {
            localStorage.setItem(LeftSidebar.INSTANCE_STORAGE_KEY, JSON.stringify(next));
        } catch (e) {
        }
        this.renderLoadedInstances();
        this.updateInstanceViewButtonVisibility();
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
            await this.switchToInstanceMode();
            const action = LoadInstanceAction.create(match.content, match.name);
            await this.actionDispatcher.dispatch(action);

            this.instancesAvailableInSession = true;
            this.addLoadedInstance({ name: match.name, content: match.content });
            this.updateInstanceViewButtonVisibility();
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
        }
        this.renderLoadedInstances();
        this.updateSaveInstanceButtonVisibility();
        this.updateInstanceViewButtonVisibility();
    }
}



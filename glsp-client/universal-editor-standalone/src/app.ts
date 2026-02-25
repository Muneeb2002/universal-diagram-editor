/**
 * @author Abigail Sotomayor <s205720@dtu.dk>
 */
import 'reflect-metadata';

declare const GLSP_SERVER_HOST: string;
declare const GLSP_SERVER_PORT: string;
declare const GLSP_SERVER_PROTOCOL: string;

import {
    BaseJsonrpcGLSPClient,
    DiagramLoader,
    GLSPActionDispatcher,
    GLSPClient,
    GLSPWebSocketProvider,
    MessageAction,
    StatusAction,
    TYPES,
    EditorContextService
} from '@eclipse-glsp/client';
import { LocalRequestBoundsAction } from '@eclipse-glsp/client/lib/features/bounds/local-bounds';
import type { GModelRoot } from '@eclipse-glsp/sprotty';
import { Container } from 'inversify';
import { MessageConnection } from 'vscode-jsonrpc';
import createContainer from './di.config';
import { EcoreToolbar } from './ecore-toolbar';
import { EcoreEdgeContextMenu } from './edge-context-menu';
import {
    createOpenClassPropertiesAction,
    createCreateEClassAction,
    createCreateEEnumAction,
    createAddAttributeAction,
    createDeleteAttributeAction,
    createRequestEnumNamesAction,
    EnumNamesResponse,
    InstancesOverviewResponse
} from './ecore-client-actions';
import { RequestAction } from '@eclipse-glsp/protocol';
import { setGlobalToolbar } from './handlers/load-metamodel-response-handler';
import { LeftSidebar } from './left-sidebar';
import { SelectAction, SetModelAction, UpdateModelAction, SetEditModeAction, EditMode, TriggerEdgeCreationAction } from '@eclipse-glsp/protocol';
import { EnableDefaultToolsAction } from '@eclipse-glsp/client';
import { GraphicalModelEditor } from './graphical-model-editor';
import { ShapeMappingDialog } from './ui/dialogs/shape-mapping-dialog';
import { InstanceManagementPanel } from './instance-management-panel';

let editorContextServiceRef: EditorContextService | undefined;
let lastKnownModelRoot: GModelRoot | undefined;

declare global {
    interface Window {
        showEClassCreationDialog?: () => void;
        showEEnumCreationDialog?: () => void;
        globalGraphicalModelEditor?: GraphicalModelEditor;
        globalShapeMappingDialog?: ShapeMappingDialog;
        globalLeftSidebar?: LeftSidebar;
    }
}

const host = GLSP_SERVER_HOST;
const port = GLSP_SERVER_PORT;
const id = 'ecore';
const diagramType = 'ecore-diagram';

const clientId = 'sprotty';

const protocol = GLSP_SERVER_PROTOCOL || (window.location.protocol === 'https:' ? 'wss' : 'ws');
const webSocketUrl = `${protocol}://${host}:${port}/${id}`;

let glspClient: GLSPClient;
let container: Container;
let actionDispatcher: GLSPActionDispatcher;
const wsProvider = new GLSPWebSocketProvider(webSocketUrl);
wsProvider.listen({ onConnection: initialize, onReconnect: reconnect, logger: console });

const toolbar = new EcoreToolbar();
const leftSidebar = new LeftSidebar();
const edgeContextMenu = new EcoreEdgeContextMenu();
let instanceManagementPanel: InstanceManagementPanel | null = null;

toolbar.onModeChange(mode => leftSidebar.setMode(mode));

let metamodelAvailable = false;
let desiredToolPaletteVisible = false;
let paletteVisibilityRetryHandle: number | undefined;
let paletteObserver: MutationObserver | undefined;

document.addEventListener('DOMContentLoaded', () => {
    leftSidebar.attach();
});

function getToolPaletteElement(): HTMLElement | null {
    return (document.getElementById('tool-palette') as HTMLElement | null) ??
        (document.querySelector('.tool-palette') as HTMLElement | null) ??
        null;
}

function getToolPaletteToggleButton(): HTMLElement | null {
    return document.querySelector('.minimize-palette-button');
}

function applyToolPaletteVisibility(): void {
    const palette = getToolPaletteElement();
    const toggleButton = getToolPaletteToggleButton();

    if (palette) {
        palette.style.display = desiredToolPaletteVisible ? '' : 'none';
    }

    if (toggleButton) {
        toggleButton.style.display = desiredToolPaletteVisible ? '' : 'none';
    }

    if ((!palette || !toggleButton) && paletteVisibilityRetryHandle === undefined) {
        paletteVisibilityRetryHandle = window.setTimeout(() => {
            paletteVisibilityRetryHandle = undefined;
            applyToolPaletteVisibility();
        }, 50);
    }
}

function setToolPaletteVisible(visible: boolean): void {
    desiredToolPaletteVisible = visible;
    ensureToolPaletteObserver();
    applyToolPaletteVisibility();
}

function ensureToolPaletteObserver(): void {
    if (paletteObserver || typeof MutationObserver === 'undefined') {
        return;
    }

    const startObserver = () => {
        if (!document.body) {
            return;
        }

        paletteObserver = new MutationObserver(() => {
            const paletteReady = !!getToolPaletteElement();
            const toggleReady = !!getToolPaletteToggleButton();

            if (paletteReady && toggleReady) {
                applyToolPaletteVisibility();
                setupMinimizeButtonBehavior();
                paletteObserver?.disconnect();
                paletteObserver = undefined;
            }
        });

        paletteObserver.observe(document.body, { childList: true, subtree: true });
    };

    if (document.body) {
        startObserver();
    } else {
        document.addEventListener('DOMContentLoaded', startObserver, { once: true });
    }
}

function setupMinimizeButtonBehavior(): void {
    const toggleButton = getToolPaletteToggleButton();
    const palette = getToolPaletteElement();

    if (!toggleButton || !palette) {
        return;
    }

    const minimizeIcon = toggleButton.querySelector('.codicon');

    if (!minimizeIcon) {
        return;
    }

    (minimizeIcon as HTMLElement).onclick = (event) => {
        event.preventDefault();
        event.stopPropagation();

        const isVisible = palette.style.display !== 'none';

        if (isVisible) {
            palette.style.display = 'none';
            palette.style.maxHeight = '0px';
            minimizeIcon.classList.remove('codicon-chevron-right');
            minimizeIcon.classList.add('codicon-tools');
            toggleButton.title = 'Show Tool Palette';
        } else {
            palette.style.display = '';
            palette.style.maxHeight = '500px';
            minimizeIcon.classList.remove('codicon-tools');
            minimizeIcon.classList.add('codicon-chevron-right');
            toggleButton.title = 'Hide Tool Palette';
        }
    };
}

setToolPaletteVisible(false);

async function initialize(connectionProvider: MessageConnection, isReconnecting = false): Promise<void> {
    glspClient = new BaseJsonrpcGLSPClient({ id, connectionProvider });
    container = createContainer({ clientId, diagramType, glspClientProvider: async () => glspClient });
    actionDispatcher = container.get(GLSPActionDispatcher);

    toolbar.setActionDispatcher(actionDispatcher);
    leftSidebar.setActionDispatcher(actionDispatcher);
    leftSidebar.setVisualConfigurationAvailable(false);
    edgeContextMenu.setActionDispatcher(actionDispatcher);

    const editorContextServiceProvider = container.get(TYPES.IEditorContextServiceProvider) as () => EditorContextService;
    const editorContextService = editorContextServiceProvider();
    editorContextServiceRef = editorContextService;

    (window as any).editorContextServiceRef = editorContextService;

    setGlobalToolbar(toolbar);
    (window as any).globalToolbar = toolbar;

    const graphicalModelEditor = new GraphicalModelEditor(actionDispatcher);
    (window as any).globalGraphicalModelEditor = graphicalModelEditor;


    const shapeMappingDialog = new ShapeMappingDialog(actionDispatcher);
    (window as any).globalShapeMappingDialog = shapeMappingDialog;

    (window as any).globalLeftSidebar = leftSidebar;


    setupContextMenu();
    setupCustomActionHandling();

    const diagramLoader = container.get(DiagramLoader);
    const loadResult = await diagramLoader.load({ requestModelOptions: { isReconnecting } });
    const loadResultAsRoot = (loadResult as unknown as GModelRoot) ?? undefined;
    if (editorContextService.modelRoot) {
        lastKnownModelRoot = editorContextService.modelRoot as unknown as GModelRoot;
    } else if (loadResultAsRoot) {
        lastKnownModelRoot = loadResultAsRoot;
    }

    try { await actionDispatcher.dispatch(createOpenClassPropertiesAction()); } catch { }


    if (isReconnecting) {
        const message = `Connection to the ${id} glsp server got closed. Connection was successfully re-established.`;
        const timeout = 5000;
        const severity = 'WARNING';
        actionDispatcher.dispatchAll([StatusAction.create(message, { severity, timeout }), MessageAction.create(message, { severity })]);
        return;
    }
}

const STRIP_PREFIX = 'sprotty_';

function stripSprottyId(rawId: string): string {
    return rawId.startsWith(STRIP_PREFIX) ? rawId.substring(STRIP_PREFIX.length) : rawId;
}

function setupContextMenu(): void {
    document.addEventListener('click', (event) => {
        const target = event.target as HTMLElement | null;
        if (!target) return;

        const enumEl = target.closest('.ecore-enum, [data-svg-metadata-type="ecore:enum"]') as HTMLElement | null;
        if (enumEl?.id) {
            forwardSelectionToEnumProperties(stripSprottyId(enumEl.id));
            return;
        }

        const classEl = target.closest('.ecore-class') as HTMLElement | null;
        if (classEl) {
            const rawId = classEl.id || classEl.getAttribute('data-class-name') || '';
            if (rawId) {
                forwardSelectionToClassProperties(stripSprottyId(rawId));
                return;
            }
        }

        const isCanvas = target.closest('.sprotty-root, svg, [id*="sprotty"], [class*="sprotty-graph"]') !== null ||
            target.tagName === 'svg' || target.classList.contains('sprotty-root');
        if (isCanvas) {
            forwardSelectionToClassProperties(null);
            forwardSelectionToEnumProperties(null);
        }
    });

    document.addEventListener('dblclick', (event) => {
        const target = event.target as HTMLElement;

        const edgeElement = target.closest('.sprotty-edge') || target.closest('[data-svg-metadata-type*="edge:"]');

        if (edgeElement) {
            event.preventDefault();
            event.stopPropagation();
            const edgeId = edgeElement.id || 'unknown-edge';
            edgeContextMenu.show(event, edgeId);
        }
    });
}

async function reconnect(connectionProvider: MessageConnection): Promise<void> {
    glspClient.stop();
    initialize(connectionProvider, true /* isReconnecting */);
}

function handleTriggerAction(action: any): boolean {
    if (action?.kind === 'triggerEClassCreation') {
        showEClassCreationDialog();
        return true;
    }
    if (action?.kind === 'triggerEEnumCreation') {
        showEEnumCreationDialog();
        return true;
    }
    return false;
}

function forceEditableMode(): void {
    if (!editorContextServiceRef) return;
    const oldValue = (editorContextServiceRef as any)._editMode || EditMode.READONLY;
    (editorContextServiceRef as any)._editMode = EditMode.EDITABLE;
    if ((editorContextServiceRef as any).onEditModeChangedEmitter) {
        (editorContextServiceRef as any).onEditModeChangedEmitter.fire({
            newValue: EditMode.EDITABLE,
            oldValue
        });
    }
}

function setupCustomActionHandling(): void {
    if (!actionDispatcher) {
        console.error('Action dispatcher not available for custom action handling');
        return;
    }

    window.showEClassCreationDialog = showEClassCreationDialog;
    window.showEEnumCreationDialog = showEEnumCreationDialog;

    const originalDispatch = actionDispatcher.dispatch.bind(actionDispatcher);
    const originalDispatchAll = (actionDispatcher as any).dispatchAll?.bind(actionDispatcher);

    if (originalDispatchAll) {
        (actionDispatcher as any).dispatchAll = async (...args: any[]) => {
            const actionsArray = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
            for (const action of actionsArray) {
                if (handleTriggerAction(action)) return Promise.resolve();
            }
            return originalDispatchAll(...args);
        };
    }

    actionDispatcher.dispatch = async (action: any) => {
        if (handleTriggerAction(action)) return Promise.resolve();

        if (action.kind === 'createCustomMetamodel') {
            metamodelAvailable = true;
            setToolPaletteVisible(true);
            leftSidebar.setVisualConfigurationAvailable(true);
        }
        else if (SelectAction.is(action)) {
            const selected = action.selectedElementsIDs ?? [];
            if (selected.length > 0) {
                forwardSelectionToClassProperties(stripSprottyId(selected[0]));
            } else {
                forwardSelectionToClassProperties(null);
            }
        }
        else if (action.kind === 'switchMode') {
            const mode = action.mode as 'metamodel' | 'instance';
            (window as any).currentViewMode = mode;

            if (mode === 'instance') {
                forwardSelectionToClassProperties(null);
                const panel = document.getElementById('class-properties-panel');
                if (panel && panel.parentElement) panel.parentElement.removeChild(panel);
                document.body.style.paddingBottom = '0px';
                document.body.style.setProperty('--bottom-panel-height', '0px');
                setToolPaletteVisible(metamodelAvailable);

                if (!instanceManagementPanel) {
                    instanceManagementPanel = new InstanceManagementPanel(actionDispatcher);
                }
                instanceManagementPanel.show();
            } else if (mode === 'metamodel') {
                if (instanceManagementPanel) {
                    instanceManagementPanel.hide();
                }
                try { await actionDispatcher.dispatch({ kind: 'openClassProperties' }); } catch { }
                setToolPaletteVisible(metamodelAvailable);
                forceEditableMode();
                try {
                    await actionDispatcher.dispatch(SetEditModeAction.create(EditMode.EDITABLE));
                    await actionDispatcher.dispatch(EnableDefaultToolsAction.create());
                } catch (e) {
                    console.warn('Could not set edit mode:', e);
                }

                setTimeout(() => {
                    forceEditableMode();
                    const palette = getToolPaletteElement();
                    if (palette) {
                        const buttons = palette.querySelectorAll('.tool-button');
                        buttons.forEach((button: Element) => {
                            const htmlButton = button as HTMLElement;
                            const buttonToUse = htmlButton;

                            htmlButton.onclick = null;

                            const itemId = buttonToUse.getAttribute('data-item-id') ||
                                buttonToUse.id ||
                                buttonToUse.textContent?.trim();

                            buttonToUse.addEventListener('click', (e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                forceEditableMode();

                                if (itemId && (itemId.includes('eclass') || itemId.includes('EClass') ||
                                    buttonToUse.textContent?.includes('EClass'))) {
                                    showEClassCreationDialog();
                                    return;
                                }

                                const buttonText = (buttonToUse.textContent?.toLowerCase() || '').trim();
                                const isEdgeButton = itemId && (
                                    itemId.includes('edge') ||
                                    itemId.includes('Edge') ||
                                    buttonText.includes('edge') ||
                                    buttonText.includes('inheritance') ||
                                    buttonText.includes('reference') ||
                                    buttonText.includes('containment')
                                );

                                if (isEdgeButton) {
                                    let edgeType = buttonToUse.getAttribute('data-edge-type') ||
                                        buttonToUse.getAttribute('data-element-type-id') ||
                                        'edge:ecore-reference';

                                    if (buttonText.includes('inheritance') || buttonText.includes('generalization')) {
                                        edgeType = 'edge:ecore-inheritance';
                                    } else if (buttonText.includes('containment') || buttonText.includes('composition')) {
                                        edgeType = 'edge:ecore-containment';
                                    } else if (buttonText.includes('reference') || buttonText.includes('association')) {
                                        edgeType = 'edge:ecore-reference';
                                    } else if (buttonText.includes('bidirectional')) {
                                        edgeType = 'edge:ecore-bidirectional';
                                    }

                                    actionDispatcher.dispatch(TriggerEdgeCreationAction.create(edgeType));

                                    actionDispatcher.dispatch(EnableDefaultToolsAction.create());

                                    return;
                                }

                                const actionData = buttonToUse.getAttribute('data-action');
                                if (actionData) {
                                    try {
                                        const parsed = JSON.parse(actionData);
                                        actionDispatcher.dispatch(parsed);
                                        return;
                                    } catch (e) {
                                        console.warn('Could not parse action data:', e);
                                    }
                                }
                            }, { capture: true });

                            buttonToUse.style.pointerEvents = 'auto';
                            buttonToUse.style.cursor = 'pointer';
                            buttonToUse.removeAttribute('disabled');
                        });
                    }
                    try {
                        actionDispatcher.dispatch(SetEditModeAction.create(EditMode.EDITABLE));
                        actionDispatcher.dispatch(EnableDefaultToolsAction.create());
                    } catch (e) {
                        console.warn('Could not set edit mode:', e);
                    }
                }, 200);
            }
        }
        else if (action.kind === 'loadMetamodelResponse') {
            pendingBoundsRetries = 0;
            const result = originalDispatch(action);
            result.then(() => {
                if (editorContextServiceRef?.modelRoot) {
                    lastKnownModelRoot = editorContextServiceRef.modelRoot as unknown as GModelRoot;
                }
                scheduleBoundsUpdate();
            }, () => scheduleBoundsUpdate());

            if (action.success) {
                metamodelAvailable = true;
                setToolPaletteVisible(true);
                leftSidebar.setVisualConfigurationAvailable(true);
            } else {
                metamodelAvailable = false;
                setToolPaletteVisible(false);
                leftSidebar.setVisualConfigurationAvailable(false);
            }

            try { await actionDispatcher.dispatch(createOpenClassPropertiesAction()); } catch { }

            return result;
        }
        else if (SetModelAction.is(action)) {
            const result = originalDispatch(action);
            result.then(async () => {
                const contextRoot = editorContextServiceRef?.modelRoot as unknown as GModelRoot | undefined;
                lastKnownModelRoot = contextRoot ?? (action.newRoot as unknown as GModelRoot);
                scheduleBoundsUpdate();

                const currentMode = (window as any).currentViewMode || 'metamodel';
                if (currentMode === 'instance' && instanceManagementPanel && instanceManagementPanel.isVisible()) {
                    instanceManagementPanel.refreshInstances();
                }

                if (metamodelAvailable && currentMode === 'metamodel') {
                    const setEditMode = async (attempt = 0) => {
                        try {
                            await actionDispatcher.dispatch(SetEditModeAction.create(EditMode.EDITABLE));
                            await actionDispatcher.dispatch(EnableDefaultToolsAction.create());

                            if (editorContextServiceRef && editorContextServiceRef.isReadonly && attempt < 3) {
                                setTimeout(() => setEditMode(attempt + 1), 100);
                            }
                        } catch (e) {
                            console.warn('Could not set edit mode to EDITABLE or enable default tools after SetModelAction:', e);
                            if (attempt < 3) {
                                setTimeout(() => setEditMode(attempt + 1), 100);
                            }
                        }
                    };

                    setEditMode();
                    setTimeout(() => setEditMode(), 50);
                    setTimeout(() => setEditMode(), 200);
                }
            }, () => {
                scheduleBoundsUpdate();
            });
            return result;
        }
        else if (UpdateModelAction.is(action)) {
            const result = originalDispatch(action);
            result.then(() => {
                const contextRoot = editorContextServiceRef?.modelRoot as unknown as GModelRoot | undefined;
                lastKnownModelRoot = contextRoot ?? (action.newRoot as unknown as GModelRoot);
                scheduleBoundsUpdate();

                const currentMode = (window as any).currentViewMode || 'metamodel';
                if (currentMode === 'instance' && instanceManagementPanel && instanceManagementPanel.isVisible()) {
                    instanceManagementPanel.refreshInstances();
                }

                if (currentMode === 'metamodel' && metamodelAvailable && actionDispatcher) {
                    actionDispatcher.dispatch(createOpenClassPropertiesAction()).catch(() => {
                    });
                }
            }, () => {
                scheduleBoundsUpdate();
            });
            return result;
        }
        else if (action.kind === 'instancesOverviewResponse') {
            if (instanceManagementPanel) {
                instanceManagementPanel.handleInstancesOverviewResponse(action as InstancesOverviewResponse);
            }
            return originalDispatch(action);
        }

        return originalDispatch(action);
    };
}


function showEClassCreationDialog(): void {

    const dialog = document.createElement('div');
    dialog.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        border: 1px solid #ccc;
        border-radius: 8px;
        padding: 20px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        min-width: 300px;
        font-family: Arial, sans-serif;
    `;

    const title = document.createElement('h3');
    title.textContent = 'Create EClass';
    title.style.cssText = 'margin: 0 0 15px 0; color: #333;';
    dialog.appendChild(title);

    const nameLabel = document.createElement('label');
    nameLabel.textContent = 'Class Name:';
    nameLabel.style.cssText = 'display: block; margin-bottom: 5px; font-weight: bold;';
    dialog.appendChild(nameLabel);

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.placeholder = 'Enter class name';
    nameInput.style.cssText = 'width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; margin-bottom: 15px; box-sizing: border-box;';
    dialog.appendChild(nameInput);

    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = 'margin-top: 20px; text-align: right;';

    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    cancelButton.style.cssText = 'padding: 8px 16px; margin-right: 10px; border: 1px solid #ccc; border-radius: 4px; background: white; cursor: pointer;';
    cancelButton.addEventListener('click', () => {
        document.body.removeChild(dialog);
    });

    const createButton = document.createElement('button');
    createButton.textContent = 'Create';
    createButton.style.cssText = 'padding: 8px 16px; border: none; border-radius: 4px; background: #007acc; color: white; cursor: pointer;';
    createButton.addEventListener('click', () => {
        const className = nameInput.value.trim();
        if (!className) {
            alert('Please enter a class name');
            return;
        }

        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(className)) {
            alert('Class name must start with a letter or underscore and contain only letters, numbers, and underscores. Spaces are not allowed.');
            return;
        }

        if (actionDispatcher) {
            const action = createCreateEClassAction(className);
            actionDispatcher.dispatch(action);
        }

        document.body.removeChild(dialog);
    });

    buttonContainer.appendChild(cancelButton);
    buttonContainer.appendChild(createButton);
    dialog.appendChild(buttonContainer);

    const backdrop = document.createElement('div');
    backdrop.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.3);
        z-index: 9999;
    `;
    backdrop.addEventListener('click', () => {
        document.body.removeChild(backdrop);
        document.body.removeChild(dialog);
    });

    document.body.appendChild(backdrop);
    document.body.appendChild(dialog);

    nameInput.focus();
}

function showEEnumCreationDialog(): void {
    const dialog = document.createElement('div');
    dialog.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        border: 1px solid #ccc;
        border-radius: 8px;
        padding: 20px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        min-width: 300px;
        font-family: Arial, sans-serif;
    `;

    const title = document.createElement('h3');
    title.textContent = 'Create EEnum';
    title.style.cssText = 'margin: 0 0 15px 0; color: #333;';
    dialog.appendChild(title);

    const nameLabel = document.createElement('label');
    nameLabel.textContent = 'Enum Name:';
    nameLabel.style.cssText = 'display: block; margin-bottom: 5px; font-weight: bold;';
    dialog.appendChild(nameLabel);

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.placeholder = 'Enter enum name';
    nameInput.style.cssText = 'width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; margin-bottom: 15px; box-sizing: border-box;';
    dialog.appendChild(nameInput);

    const literalsLabel = document.createElement('label');
    literalsLabel.textContent = 'Enum Literals (Values):';
    literalsLabel.style.cssText = 'display: block; margin-bottom: 5px; font-weight: bold; margin-top: 10px;';
    dialog.appendChild(literalsLabel);

    const literalsContainer = document.createElement('div');
    literalsContainer.id = 'enum-literals-container';
    literalsContainer.style.cssText = 'margin-bottom: 15px; max-height: 200px; overflow-y: auto; border: 1px solid #ddd; border-radius: 4px; padding: 10px; background: #f9f9f9;';
    dialog.appendChild(literalsContainer);

    const literalsList: Array<{ nameInput: HTMLInputElement; valueInput: HTMLInputElement; container: HTMLDivElement }> = [];

    function addLiteralRow() {
        const row = document.createElement('div');
        row.style.cssText = 'display: flex; gap: 8px; margin-bottom: 8px; align-items: center;';

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.placeholder = 'Literal name';
        nameInput.style.cssText = 'flex: 2; padding: 6px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;';

        const valueInput = document.createElement('input');
        valueInput.type = 'number';
        valueInput.placeholder = 'Value (optional)';
        valueInput.style.cssText = 'flex: 1; padding: 6px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;';

        const removeButton = document.createElement('button');
        removeButton.textContent = '×';
        removeButton.style.cssText = 'width: 30px; height: 30px; padding: 0; border: 1px solid #ccc; border-radius: 4px; background: #fff; cursor: pointer; font-size: 18px; line-height: 1;';

        removeButton.addEventListener('click', () => {
            literalsContainer.removeChild(row);
            const index = literalsList.findIndex(item => item.container === row);
            if (index >= 0) {
                literalsList.splice(index, 1);
            }
        });

        row.appendChild(nameInput);
        row.appendChild(valueInput);
        row.appendChild(removeButton);
        literalsContainer.appendChild(row);

        literalsList.push({ nameInput, valueInput, container: row });
    }

    const addLiteralButton = document.createElement('button');
    addLiteralButton.textContent = '+ Add Literal';
    addLiteralButton.style.cssText = 'padding: 6px 12px; border: 1px solid #ccc; border-radius: 4px; background: white; cursor: pointer; margin-bottom: 10px; font-size: 12px;';
    addLiteralButton.addEventListener('click', addLiteralRow);
    dialog.appendChild(addLiteralButton);

    addLiteralRow();

    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = 'margin-top: 20px; text-align: right;';

    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    cancelButton.style.cssText = 'padding: 8px 16px; margin-right: 10px; border: 1px solid #ccc; border-radius: 4px; background: white; cursor: pointer;';
    cancelButton.addEventListener('click', () => {
        document.body.removeChild(dialog);
    });

    const createButton = document.createElement('button');
    createButton.textContent = 'Create';
    createButton.style.cssText = 'padding: 8px 16px; border: none; border-radius: 4px; background: #007acc; color: white; cursor: pointer;';
    createButton.addEventListener('click', () => {
        const enumName = nameInput.value.trim();
        if (!enumName) {
            alert('Please enter an enum name');
            return;
        }

        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(enumName)) {
            alert('Enum name must start with a letter or underscore and contain only letters, numbers, and underscores. Spaces are not allowed.');
            return;
        }

        const enumLiterals: Array<{ name: string; value?: number }> = [];
        literalsList.forEach(item => {
            const literalName = item.nameInput.value.trim();
            if (literalName) {
                const literalValue = item.valueInput.value.trim();
                const literal: { name: string; value?: number } = { name: literalName };
                if (literalValue) {
                    const numValue = parseInt(literalValue, 10);
                    if (!isNaN(numValue)) {
                        literal.value = numValue;
                    }
                }
                enumLiterals.push(literal);
            }
        });

        if (actionDispatcher) {
            const action = createCreateEEnumAction(enumName, undefined, enumLiterals.length > 0 ? enumLiterals : undefined);
            actionDispatcher.dispatch(action);
        }

        document.body.removeChild(dialog);
    });

    buttonContainer.appendChild(cancelButton);
    buttonContainer.appendChild(createButton);
    dialog.appendChild(buttonContainer);

    const backdrop = document.createElement('div');
    backdrop.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.3);
        z-index: 9999;
    `;
    backdrop.addEventListener('click', () => {
        document.body.removeChild(backdrop);
        document.body.removeChild(dialog);
    });

    document.body.appendChild(backdrop);
    document.body.appendChild(dialog);
    nameInput.focus();
}

function showAddAttributeDialog(className: string): void {
    const dialog = document.createElement('div');
    dialog.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        border: 1px solid #ccc;
        border-radius: 8px;
        padding: 20px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        min-width: 350px;
        font-family: Arial, sans-serif;
    `;

    const title = document.createElement('h3');
    title.textContent = `Add Attribute to ${className}`;
    title.style.cssText = 'margin: 0 0 15px 0; color: #333;';
    dialog.appendChild(title);

    const nameLabel = document.createElement('label');
    nameLabel.textContent = 'Attribute Name:';
    nameLabel.style.cssText = 'display: block; margin-top: 10px; color: #555;';
    dialog.appendChild(nameLabel);

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.placeholder = 'e.g., name, age, description';
    nameInput.style.cssText = 'width: 100%; padding: 8px; margin-top: 5px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box;';
    dialog.appendChild(nameInput);

    const typeLabel = document.createElement('label');
    typeLabel.textContent = 'Attribute Type:';
    typeLabel.style.cssText = 'display: block; margin-top: 10px; color: #555;';
    dialog.appendChild(typeLabel);

    const typeSelect = document.createElement('select');
    typeSelect.style.cssText = 'width: 100%; padding: 8px; margin-top: 5px; border: 1px solid #ddd; border-radius: 4px;';

    const types = ['EString', 'EInt', 'EBoolean', 'EDouble', 'EFloat', 'ELong', 'EDate'];
    types.forEach(type => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type;
        typeSelect.appendChild(option);
    });

    const addEnumOptions = (enumNames: string[]) => {
        if (enumNames && Array.isArray(enumNames) && enumNames.length > 0) {
            const existingOptions = Array.from(typeSelect.options);
            const separatorIndex = existingOptions.findIndex(opt => opt.textContent === '--- Enums ---');
            if (separatorIndex >= 0) {
                for (let i = typeSelect.options.length - 1; i >= separatorIndex; i--) {
                    typeSelect.remove(i);
                }
            }

            const separatorOption = document.createElement('option');
            separatorOption.disabled = true;
            separatorOption.textContent = '--- Enums ---';
            typeSelect.appendChild(separatorOption);

            enumNames.slice().sort().forEach((enumName: string) => {
                const option = document.createElement('option');
                option.value = enumName;
                option.textContent = enumName;
                typeSelect.appendChild(option);
            });
        }
    };

    const toolbar = (window as any).globalToolbar;
    if (toolbar) {
        let enumNames: string[] = [];
        if (typeof toolbar.getEnumNames === 'function') {
            enumNames = toolbar.getEnumNames();
        } else if (toolbar.allEnumNames && Array.isArray(toolbar.allEnumNames)) {
            enumNames = toolbar.allEnumNames;
        }

        if (enumNames && Array.isArray(enumNames) && enumNames.length > 0) {
            addEnumOptions(enumNames);
        }
    }

    if (actionDispatcher) {
        const requestId = RequestAction.generateRequestId();
        const requestAction = createRequestEnumNamesAction(requestId);
        actionDispatcher.requestUntil<EnumNamesResponse>(requestAction, 5000, true).then((response) => {
            if (!response || !response.success) {
                throw new Error(response?.message ?? 'Failed to retrieve enum names');
            }
            const enumNames = response.enumNames ?? [];
            if (enumNames.length > 0) {
                addEnumOptions(enumNames);
                if (toolbar && typeof toolbar.updateEnumNames === 'function') {
                    toolbar.updateEnumNames(enumNames);
                }
            }
        }).catch((error) => {
            console.error('[showAddAttributeDialog] Failed to request enum names:', error);
        });
    } else {
        console.warn('[showAddAttributeDialog] No actionDispatcher available');
    }

    dialog.appendChild(typeSelect);

    const lowerBoundLabel = document.createElement('label');
    lowerBoundLabel.textContent = 'Lower Bound:';
    lowerBoundLabel.style.cssText = 'display: block; margin-top: 10px; color: #555;';
    dialog.appendChild(lowerBoundLabel);

    const lowerBoundInput = document.createElement('input');
    lowerBoundInput.type = 'number';
    lowerBoundInput.value = '0';
    lowerBoundInput.min = '0';
    lowerBoundInput.style.cssText = 'width: 100%; padding: 8px; margin-top: 5px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box;';
    dialog.appendChild(lowerBoundInput);

    const upperBoundLabel = document.createElement('label');
    upperBoundLabel.textContent = 'Upper Bound (-1 for unlimited):';
    upperBoundLabel.style.cssText = 'display: block; margin-top: 10px; color: #555;';
    dialog.appendChild(upperBoundLabel);

    const upperBoundInput = document.createElement('input');
    upperBoundInput.type = 'number';
    upperBoundInput.value = '1';
    upperBoundInput.min = '-1';
    upperBoundInput.style.cssText = 'width: 100%; padding: 8px; margin-top: 5px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box;';
    dialog.appendChild(upperBoundInput);

    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = 'margin-top: 20px; text-align: right;';

    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    cancelButton.style.cssText = 'padding: 8px 16px; margin-right: 10px; border: 1px solid #ccc; border-radius: 4px; background: white; cursor: pointer;';
    cancelButton.addEventListener('click', () => {
        document.body.removeChild(backdrop);
        document.body.removeChild(dialog);
    });

    const addButton = document.createElement('button');
    addButton.textContent = 'Add Attribute';
    addButton.style.cssText = 'padding: 8px 16px; border: none; border-radius: 4px; background: #007acc; color: white; cursor: pointer;';
    addButton.addEventListener('click', () => {
        const attributeName = nameInput.value.trim();
        if (!attributeName) {
            alert('Please enter an attribute name');
            return;
        }

        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(attributeName)) {
            alert('Attribute name must start with a letter or underscore and contain only letters, numbers, and underscores. Spaces are not allowed.');
            return;
        }

        const attributeType = typeSelect.value;
        const lowerBound = parseInt(lowerBoundInput.value, 10);
        const upperBound = parseInt(upperBoundInput.value, 10);

        if (lowerBound < 0) {
            alert('Lower bound must be >= 0');
            return;
        }
        if (upperBound < -1 || (upperBound >= 0 && upperBound < lowerBound)) {
            alert('Upper bound must be >= lower bound or -1 for unlimited');
            return;
        }

        if (actionDispatcher) {
            const action = createAddAttributeAction(className, attributeName, attributeType, lowerBound, upperBound);
            actionDispatcher.dispatch(action);
        }

        document.body.removeChild(backdrop);
        document.body.removeChild(dialog);
    });

    buttonContainer.appendChild(cancelButton);
    buttonContainer.appendChild(addButton);
    dialog.appendChild(buttonContainer);

    const backdrop = document.createElement('div');
    backdrop.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.3);
        z-index: 9999;
    `;
    backdrop.addEventListener('click', () => {
        document.body.removeChild(backdrop);
        document.body.removeChild(dialog);
    });

    document.body.appendChild(backdrop);
    document.body.appendChild(dialog);

    nameInput.focus();
}

(window as any).showAddAttributeDialog = showAddAttributeDialog;

function showDeleteAttributeDialog(className: string, attributes: Array<{ name: string; type: string }>): void {
    if (!attributes || attributes.length === 0) {
        alert(`Class "${className}" has no attributes to delete.`);
        return;
    }

    const dialog = document.createElement('div');
    dialog.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        border: 1px solid #ccc;
        border-radius: 8px;
        padding: 20px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        min-width: 400px;
        font-family: Arial, sans-serif;
    `;

    const title = document.createElement('h3');
    title.textContent = `Delete Attributes from ${className}`;
    title.style.cssText = 'margin: 0 0 15px 0; color: #333;';
    dialog.appendChild(title);

    const description = document.createElement('p');
    description.textContent = 'Select one or more attributes to delete:';
    description.style.cssText = 'margin: 10px 0; color: #666;';
    dialog.appendChild(description);

    const attributeList = document.createElement('div');
    attributeList.style.cssText = 'max-height: 300px; overflow-y: auto; margin: 10px 0; padding: 10px; border: 1px solid #ddd; border-radius: 4px;';

    const selectedAttributes: Set<string> = new Set();
    const checkboxes: Map<string, HTMLInputElement> = new Map();

    attributes.forEach(attr => {
        const optionDiv = document.createElement('div');
        optionDiv.style.cssText = 'padding: 8px; margin: 4px 0; cursor: pointer; border-radius: 4px; display: flex; align-items: center;';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = attr.name;
        checkbox.style.cssText = 'margin-right: 10px; cursor: pointer;';
        checkbox.addEventListener('change', () => {
            if (checkbox.checked) {
                selectedAttributes.add(attr.name);
            } else {
                selectedAttributes.delete(attr.name);
            }
        });
        checkboxes.set(attr.name, checkbox);

        const label = document.createElement('span');
        label.textContent = `${attr.name}: ${attr.type}`;
        label.style.cssText = 'flex: 1; cursor: pointer;';
        label.addEventListener('click', () => {
            checkbox.checked = !checkbox.checked;
            if (checkbox.checked) {
                selectedAttributes.add(attr.name);
            } else {
                selectedAttributes.delete(attr.name);
            }
        });

        optionDiv.addEventListener('mouseenter', () => {
            optionDiv.style.background = '#f0f0f0';
        });
        optionDiv.addEventListener('mouseleave', () => {
            optionDiv.style.background = 'transparent';
        });

        optionDiv.appendChild(checkbox);
        optionDiv.appendChild(label);
        attributeList.appendChild(optionDiv);
    });

    dialog.appendChild(attributeList);

    const selectionButtons = document.createElement('div');
    selectionButtons.style.cssText = 'margin: 10px 0; display: flex; gap: 10px;';

    const selectAllButton = document.createElement('button');
    selectAllButton.textContent = 'Select All';
    selectAllButton.style.cssText = 'padding: 4px 12px; border: 1px solid #ccc; border-radius: 4px; background: white; cursor: pointer; font-size: 12px;';
    selectAllButton.addEventListener('click', () => {
        checkboxes.forEach((checkbox, name) => {
            checkbox.checked = true;
            selectedAttributes.add(name);
        });
    });

    const deselectAllButton = document.createElement('button');
    deselectAllButton.textContent = 'Deselect All';
    deselectAllButton.style.cssText = 'padding: 4px 12px; border: 1px solid #ccc; border-radius: 4px; background: white; cursor: pointer; font-size: 12px;';
    deselectAllButton.addEventListener('click', () => {
        checkboxes.forEach((checkbox) => {
            checkbox.checked = false;
        });
        selectedAttributes.clear();
    });

    selectionButtons.appendChild(selectAllButton);
    selectionButtons.appendChild(deselectAllButton);
    dialog.appendChild(selectionButtons);

    const warning = document.createElement('p');
    warning.textContent = 'This action cannot be undone.';
    warning.style.cssText = 'margin: 10px 0; color: #d9534f; font-size: 12px; font-weight: bold;';
    dialog.appendChild(warning);

    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = 'margin-top: 20px; text-align: right;';

    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    cancelButton.style.cssText = 'padding: 8px 16px; margin-right: 10px; border: 1px solid #ccc; border-radius: 4px; background: white; cursor: pointer;';
    cancelButton.addEventListener('click', () => {
        document.body.removeChild(backdrop);
        document.body.removeChild(dialog);
    });

    const deleteButton = document.createElement('button');
    deleteButton.textContent = 'Delete Selected';
    deleteButton.style.cssText = 'padding: 8px 16px; border: none; border-radius: 4px; background: #d9534f; color: white; cursor: pointer;';
    deleteButton.addEventListener('click', async () => {
        if (selectedAttributes.size === 0) {
            alert('Please select at least one attribute to delete');
            return;
        }

        const attributeList = Array.from(selectedAttributes).join(', ');
        const pluralSuffix = selectedAttributes.size > 1 ? 's' : '';
        const confirmed = confirm(`Are you sure you want to delete ${selectedAttributes.size} attribute${pluralSuffix} (${attributeList}) from class "${className}"?\n\nThis action cannot be undone.`);

        if (confirmed && actionDispatcher) {
            for (const attributeName of selectedAttributes) {
                const action = createDeleteAttributeAction(className, attributeName);
                await actionDispatcher.dispatch(action);
            }

            document.body.removeChild(backdrop);
            document.body.removeChild(dialog);
        }
    });

    buttonContainer.appendChild(cancelButton);
    buttonContainer.appendChild(deleteButton);
    dialog.appendChild(buttonContainer);

    const backdrop = document.createElement('div');
    backdrop.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.3);
        z-index: 9999;
    `;
    backdrop.addEventListener('click', () => {
        document.body.removeChild(backdrop);
        document.body.removeChild(dialog);
    });

    document.body.appendChild(backdrop);
    document.body.appendChild(dialog);
}

(window as any).showDeleteAttributeDialog = showDeleteAttributeDialog;


function forwardSelectionToClassProperties(className: string | null): void {
    const panel = window.classPropertiesPanel;
    if (panel && typeof panel.setSelectedClass === 'function') {
        panel.setSelectedClass(className);
    }
}

function forwardSelectionToEnumProperties(enumName: string | null): void {
    const panel = window.classPropertiesPanel;
    if (panel && typeof panel.setSelectedEnum === 'function') {
        panel.setSelectedEnum(enumName);
    }
}

function requestBoundsUpdate(): void {
    if (!actionDispatcher) {
        return;
    }
    const root = editorContextServiceRef?.modelRoot ?? lastKnownModelRoot;
    if (!root) {
        if (pendingBoundsRetries < MAX_BOUNDS_RETRIES) {
            pendingBoundsRetries++;
            setTimeout(() => requestBoundsUpdate(), BOUNDS_RETRY_DELAY);
        } else {
            console.warn('[app] requestBoundsUpdate: giving up after retries (no model root)');
        }
        return;
    }
    pendingBoundsRetries = 0;
    lastKnownModelRoot = root;
    try {
        actionDispatcher.dispatch(LocalRequestBoundsAction.create(root));
    } catch (err) {
        console.warn('Failed to request bounds update', err);
    }
}

function scheduleBoundsUpdate(): void {
    if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => {
            requestBoundsUpdate();
        });
    } else {
        setTimeout(() => {
            requestBoundsUpdate();
        }, 0);
    }
}

let pendingBoundsRetries = 0;
const MAX_BOUNDS_RETRIES = 10;
const BOUNDS_RETRY_DELAY = 50;

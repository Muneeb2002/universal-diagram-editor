/********************************************************************************
 * Copyright (c) 2019-2024 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/
import 'reflect-metadata';

// Build-time globals provided by webpack DefinePlugin
declare const GLSP_SERVER_HOST: string;
declare const GLSP_SERVER_PORT: string;

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
import { EcoreContextMenu, EcoreEdgeContextMenu, EdgeInfo } from './ecore-context-menu';
import { createOpenClassPropertiesAction } from './ecore-client-actions';
import { createCreateEClassAction, createCreateEEnumAction, createAddAttributeAction, createDeleteAttributeAction } from './ecore-client-actions';
import { RequestAction } from '@eclipse-glsp/protocol';
import { setPendingEnumNameRequest, getPendingEnumNameRequest, clearPendingEnumNameRequest } from './enum-names-response-handler';
import { setGlobalToolbar } from './load-metamodel-response-handler';
import { LeftSidebar } from './left-sidebar';
import { setupInteractiveResize } from './interactive-resize';
import { SelectAction, SetModelAction, UpdateModelAction, SetEditModeAction, EditMode, TriggerEdgeCreationAction, DeleteElementOperation } from '@eclipse-glsp/protocol';
import { EnableDefaultToolsAction } from '@eclipse-glsp/client';
import { GraphicalModelEditor } from './graphical-model-editor';
import { ShapeMappingDialog } from './shape-mapping-dialog';

let editorContextServiceRef: EditorContextService | undefined;
let lastKnownModelRoot: GModelRoot | undefined;

declare global {
    interface Window {
        showEClassCreationDialog?: () => void;
        showEEnumCreationDialog?: () => void;
        debugVisualConfigurations?: () => void;
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

const webSocketUrl = `ws://${host}:${port}/${id}`;

let glspClient: GLSPClient;
let container: Container;
let actionDispatcher: GLSPActionDispatcher;
const wsProvider = new GLSPWebSocketProvider(webSocketUrl);
wsProvider.listen({ onConnection: initialize, onReconnect: reconnect, logger: console });

// Initialize toolbar, sidebar and context menus
const toolbar = new EcoreToolbar();
const leftSidebar = new LeftSidebar();
const contextMenu = new EcoreContextMenu();
const edgeContextMenu = new EcoreEdgeContextMenu();

toolbar.onModeChange(mode => leftSidebar.setMode(mode));

let metamodelAvailable = false;
let desiredToolPaletteVisible = false;
let paletteVisibilityRetryHandle: number | undefined;
let paletteObserver: MutationObserver | undefined;

// Add UI elements to the page
document.addEventListener('DOMContentLoaded', () => {
    leftSidebar.attach();
    const toolbarElement = toolbar.getElement();
    leftSidebar.dockToolbar(toolbarElement);
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
            applyToolPaletteVisibility();
            const paletteReady = !!getToolPaletteElement();
            const toggleReady = !!getToolPaletteToggleButton();
            if (paletteReady && toggleReady) {
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

// Hide the palette as early as possible until a metamodel is available
setToolPaletteVisible(false);

async function initialize(connectionProvider: MessageConnection, isReconnecting = false): Promise<void> {
    glspClient = new BaseJsonrpcGLSPClient({ id, connectionProvider });
    container = createContainer({ clientId, diagramType, glspClientProvider: async () => glspClient });
    actionDispatcher = container.get(GLSPActionDispatcher);
    
    // Set action dispatcher for toolbar and context menus
    toolbar.setActionDispatcher(actionDispatcher);
    leftSidebar.setActionDispatcher(actionDispatcher);
    leftSidebar.setVisualConfigurationAvailable(false);
    contextMenu.setActionDispatcher(actionDispatcher);
    edgeContextMenu.setActionDispatcher(actionDispatcher);
    
    // Set editor context service for toolbar
    const editorContextServiceProvider = container.get(TYPES.IEditorContextServiceProvider) as () => EditorContextService;
    const editorContextService = editorContextServiceProvider();
    editorContextServiceRef = editorContextService;
    toolbar.setEditorContextService(editorContextService);
    
    // Set the global toolbar reference for the LoadMetamodelResponseHandler
    setGlobalToolbar(toolbar);
    
    // Also set it on window for context menu access
    (window as any).globalToolbar = toolbar;
    
    // Create and set up graphical model editor
    const graphicalModelEditor = new GraphicalModelEditor(actionDispatcher);
    (window as any).globalGraphicalModelEditor = graphicalModelEditor;
    
    // Create and set up shape mapping dialog
    const shapeMappingDialog = new ShapeMappingDialog(actionDispatcher);
    (window as any).globalShapeMappingDialog = shapeMappingDialog;
    
    // Set global left sidebar reference
    (window as any).globalLeftSidebar = leftSidebar;
    
    // Set up context menu for class elements
    setupContextMenu();
    setupClassSelectionForwarding();
    
    // Set up action handling for custom actions
    setupCustomActionHandling();
    
    // Add visual configuration debugging
    setupVisualConfigurationDebugging();
    
    // Set up interactive resize functionality with a delay to ensure DOM is ready
    setTimeout(() => {
        setupInteractiveResize();
    }, 1000);
    
    const diagramLoader = container.get(DiagramLoader);
    const loadResult = await diagramLoader.load({ requestModelOptions: { isReconnecting } });
    const loadResultAsRoot = (loadResult as unknown as GModelRoot) ?? undefined;
    if (editorContextService.modelRoot) {
        lastKnownModelRoot = editorContextService.modelRoot as unknown as GModelRoot;
    } else if (loadResultAsRoot) {
        lastKnownModelRoot = loadResultAsRoot;
    }

    // Open docked class properties panel initially
    try { await actionDispatcher.dispatch(createOpenClassPropertiesAction()); } catch {}

   
    if (isReconnecting) {
        const message = `Connection to the ${id} glsp server got closed. Connection was successfully re-established.`;
        const timeout = 5000;
        const severity = 'WARNING';
        actionDispatcher.dispatchAll([StatusAction.create(message, { severity, timeout }), MessageAction.create(message, { severity })]);
        return;
    }
}

function setupContextMenu(): void {
    // Listen for clicks on class elements to sync the class properties panel
    document.addEventListener('click', (event) => {
        const target = event.target as HTMLElement | null;
        if (!target) {
            return;
        }
        const classElement = target.closest('.ecore-class') as HTMLElement | null;
        if (!classElement) {
            return;
        }
        const rawId = classElement.id || classElement.getAttribute('data-class-name') || '';
        if (!rawId) {
            return;
        }
        const className = rawId.startsWith('sprotty_') ? rawId.substring(8) : rawId;
        forwardSelectionToClassProperties(className);
    });

    // Listen for double-clicks on edges
    document.addEventListener('dblclick', (event) => {
        const target = event.target as HTMLElement;
        
        // Check if the clicked element is an edge
        const edgeElement = target.closest('.sprotty-edge') || target.closest('[data-svg-metadata-type*="edge:"]');
        
        if (edgeElement) {
            event.preventDefault();
            event.stopPropagation();
            
            // Get edge information from the element
            const edgeId = edgeElement.id || 'unknown-edge';
            const edgeType = edgeElement.getAttribute('data-svg-metadata-type') || 'edge:ecore-reference';
            
            // Extract source and target IDs from the edge ID
            // Edge IDs follow patterns like: "Place_inherits_Node", "Place_tokens", "Arc_source"
            const { sourceId, targetId } = extractSourceAndTargetFromEdgeId(edgeId);
            
            // Create edge info object
            const edgeInfo: EdgeInfo = {
                edgeId: edgeId,
                sourceId: sourceId,
                targetId: targetId,
                currentType: edgeType
            };
            
            // Show edge context menu
            edgeContextMenu.show(event, edgeInfo);
        }
    });

    // Listen for right-clicks on instance nodes
    document.addEventListener('contextmenu', (event) => {
        const target = event.target as HTMLElement;
        
        // Check if the clicked element is an instance node
        let instanceElement = target.closest('.ecore-instance') as HTMLElement | null;
        
        if (instanceElement) {
            // If this is a nested node, find the outermost parent instance node
            // (the one that is not nested inside another .ecore-instance)
            let parent = instanceElement.parentElement;
            while (parent) {
                const parentInstance = parent.closest('.ecore-instance') as HTMLElement | null;
                if (parentInstance && parentInstance !== instanceElement) {
                    // Found a parent instance, use that instead
                    instanceElement = parentInstance;
                    parent = parentInstance.parentElement;
                } else {
                    break;
                }
            }
            
            event.preventDefault();
            event.stopPropagation();
            
            // Get instance information from the element
            const rawId = instanceElement.id || 'unknown-instance';
            const instanceId = rawId.startsWith('sprotty_') ? rawId.substring(8) : rawId;
            
            // Show instance context menu
            showInstanceContextMenu(event, instanceId);
        }
    });
}

async function reconnect(connectionProvider: MessageConnection): Promise<void> {
    glspClient.stop();
    initialize(connectionProvider, true /* isReconnecting */);
}

function extractSourceAndTargetFromEdgeId(edgeId: string): { sourceId: string, targetId: string } {
    // Remove sprotty_ prefix if present to get the model element id
    const cleanEdgeId = edgeId.startsWith('sprotty_') ? edgeId.substring(8) : edgeId;

    try {
        // Resolve the current model via the editor context service to avoid any metamodel assumptions
        const editorContextServiceProvider = container.get(TYPES.IEditorContextServiceProvider) as () => EditorContextService;
        const ecs = editorContextServiceProvider();
        const root = ecs.modelRoot;
        const edge = root.index.getById(cleanEdgeId) as any;

        if (edge && typeof edge.sourceId === 'string' && typeof edge.targetId === 'string') {
            return { sourceId: edge.sourceId, targetId: edge.targetId };
        }
    } catch (e) {
        // Intentionally swallow to use the generic fallback below
        // console.warn('Failed to resolve edge endpoints from model', e);
    }

    // Fallback to unknowns if the element cannot be resolved; callers should handle gracefully
    return { sourceId: 'unknown-source', targetId: 'unknown-target' };
}

function setupCustomActionHandling(): void {
    if (!actionDispatcher) {
        console.error('Action dispatcher not available for custom action handling');
        return;
    }

    // Set up a simple way to trigger the EClass creation dialog
    // This is a simplified approach - in a full implementation you'd use proper action handlers
    window.showEClassCreationDialog = showEClassCreationDialog;
    window.showEEnumCreationDialog = showEEnumCreationDialog;

    // Listen for various custom actions
    // This is a workaround - in a full implementation you'd use proper action handlers
    const originalDispatch = actionDispatcher.dispatch.bind(actionDispatcher);
    const originalDispatchAll = (actionDispatcher as any).dispatchAll?.bind(actionDispatcher);
    
    // Intercept dispatchAll to handle actions that come through the tool palette
    if (originalDispatchAll) {
        (actionDispatcher as any).dispatchAll = async (...args: any[]) => {
            // Handle both array and variadic arguments
            let actionsArray: any[];
            if (args.length === 1 && Array.isArray(args[0])) {
                actionsArray = args[0];
            } else {
                actionsArray = args;
            }
            
            // Check if any action is triggerEClassCreation or triggerEEnumCreation
            for (const action of actionsArray) {
                if (action && action.kind === 'triggerEClassCreation') {
                    showEClassCreationDialog();
                    return Promise.resolve();
                }
                if (action && action.kind === 'triggerEEnumCreation') {
                    showEEnumCreationDialog();
                    return Promise.resolve();
                }
            }
            
            // Otherwise, call original dispatchAll with the same arguments
            return originalDispatchAll(...args);
        };
    }
    
    actionDispatcher.dispatch = async (action: any) => {
        
        // Check if this is the trigger EClass creation action
        if (action.kind === 'triggerEClassCreation') {
            showEClassCreationDialog();
            return Promise.resolve();
        }
        if (action.kind === 'triggerEEnumCreation') {
            showEEnumCreationDialog();
            return Promise.resolve();
        }
        else if (action.kind === 'createCustomMetamodel') {
            metamodelAvailable = true;
            setToolPaletteVisible(true);
            leftSidebar.setVisualConfigurationAvailable(true);
        }
        // Handle diagram selection changes to keep the properties panel in sync
        else if (SelectAction.is(action)) {
            const selected = action.selectedElementsIDs ?? [];
            const deselected = action.deselectedElementsIDs;
            const deselectAll = typeof deselected === 'boolean' ? deselected : false;
            const deselectedList = Array.isArray(deselected);
            if (selected.length > 0) {
                const first = selected[0];
                const className = first.startsWith('sprotty_') ? first.substring(8) : first;
                forwardSelectionToClassProperties(className);
            } else if (selected.length === 0 && (deselectAll || deselectedList || deselected === undefined)) {
                forwardSelectionToClassProperties(null);
            }
        }
        // Hide/show docked panels depending on mode
        else if (action.kind === 'switchMode') {
            const mode = action.mode as 'metamodel' | 'instance';
            // Track current view mode globally
            (window as any).currentViewMode = mode;
            
            if (mode === 'instance') {
                forwardSelectionToClassProperties(null);
                const panel = document.getElementById('class-properties-panel');
                if (panel && panel.parentElement) panel.parentElement.removeChild(panel);
                document.body.style.paddingBottom = '0px';
                document.body.style.setProperty('--bottom-panel-height', '0px');
                setToolPaletteVisible(metamodelAvailable);
            } else if (mode === 'metamodel') {
                try { await actionDispatcher.dispatch({ kind: 'openClassProperties' }); } catch {}
                setToolPaletteVisible(metamodelAvailable);
                
                // Force editor context to be editable by directly setting it
                // This bypasses any potential issues with action dispatching
                if (editorContextServiceRef) {
                    // Use reflection to access the protected _editMode property
                    const oldValue = (editorContextServiceRef as any)._editMode || EditMode.READONLY;
                    (editorContextServiceRef as any)._editMode = EditMode.EDITABLE;
                    // Trigger the edit mode change event manually
                    if ((editorContextServiceRef as any).onEditModeChangedEmitter) {
                        (editorContextServiceRef as any).onEditModeChangedEmitter.fire({
                            newValue: EditMode.EDITABLE,
                            oldValue: oldValue
                        });
                    }
                }
                
                // Immediately set edit mode to EDITABLE and enable tools
                // This ensures edges can be created when switching to metamodel view
                try {
                    await actionDispatcher.dispatch(SetEditModeAction.create(EditMode.EDITABLE));
                    await actionDispatcher.dispatch(EnableDefaultToolsAction.create());
                } catch (e) {
                    console.warn('Could not set edit mode:', e);
                }
                
                // Force tool palette buttons to be clickable by intercepting clicks
                setTimeout(() => {
                    // Force editor context again after DOM updates
                    if (editorContextServiceRef) {
                        const oldValue = (editorContextServiceRef as any)._editMode || EditMode.READONLY;
                        (editorContextServiceRef as any)._editMode = EditMode.EDITABLE;
                        if ((editorContextServiceRef as any).onEditModeChangedEmitter) {
                            (editorContextServiceRef as any).onEditModeChangedEmitter.fire({
                                newValue: EditMode.EDITABLE,
                                oldValue: oldValue
                            });
                        }
                    }
                    
                    const palette = getToolPaletteElement();
                    if (palette) {
                        // Override click handlers on all tool buttons to bypass readonly check
                        const buttons = palette.querySelectorAll('.tool-button');
                        buttons.forEach((button: Element) => {
                            const htmlButton = button as HTMLElement;
                            const buttonToUse = htmlButton;
                            
                            // Remove existing click listeners by replacing the onclick handler
                            htmlButton.onclick = null;
                            
                            // Find the palette item data from the button
                            const itemId = buttonToUse.getAttribute('data-item-id') || 
                                         buttonToUse.id || 
                                         buttonToUse.textContent?.trim();
                            
                            // Create a new click handler that bypasses readonly check
                            buttonToUse.addEventListener('click', (e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                
                                // Force editable before any action
                                if (editorContextServiceRef) {
                                    (editorContextServiceRef as any)._editMode = EditMode.EDITABLE;
                                }
                                
                                // If it's the EClass button, trigger the creation dialog directly
                                if (itemId && (itemId.includes('eclass') || itemId.includes('EClass') || 
                                    buttonToUse.textContent?.includes('EClass'))) {
                                    showEClassCreationDialog();
                                    return;
                                }
                                
                                // For edge creation, dispatch TriggerEdgeCreationAction directly
                                // Check for edge-related buttons (edge, inheritance, reference, containment)
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
                                    // Find the edge type from the button or use default
                                    let edgeType = buttonToUse.getAttribute('data-edge-type') || 
                                                 buttonToUse.getAttribute('data-element-type-id') ||
                                                 'edge:ecore-reference';
                                    
                                    // Try to find edge type from button's text content
                                    if (buttonText.includes('inheritance') || buttonText.includes('generalization')) {
                                        edgeType = 'edge:ecore-inheritance';
                                    } else if (buttonText.includes('containment') || buttonText.includes('composition')) {
                                        edgeType = 'edge:ecore-containment';
                                    } else if (buttonText.includes('reference') || buttonText.includes('association')) {
                                        edgeType = 'edge:ecore-reference';
                                    } else if (buttonText.includes('bidirectional')) {
                                        edgeType = 'edge:ecore-bidirectional';
                                    }
                                    
                                    // Ensure editor is editable before dispatching
                                    if (editorContextServiceRef) {
                                        (editorContextServiceRef as any)._editMode = EditMode.EDITABLE;
                                    }
                                    
                                    // Dispatch the edge creation action
                                    actionDispatcher.dispatch(TriggerEdgeCreationAction.create(edgeType));
                                    
                                    // Also enable the edge creation tool explicitly
                                    actionDispatcher.dispatch(EnableDefaultToolsAction.create());
                                    
                                    return;
                                }
                                
                                // Try to find and dispatch the original action from the button's data
                                const actionData = buttonToUse.getAttribute('data-action');
                                if (actionData) {
                                    try {
                                        const action = JSON.parse(actionData);
                                        actionDispatcher.dispatch(action);
                                        return;
                                    } catch (e) {
                                        console.warn('Could not parse action data:', e);
                                    }
                                }
                                
                                // Fallback: try to trigger via the tool palette's original mechanism
                                // by finding the palette item and dispatching its actions
                                const paletteItemId = buttonToUse.getAttribute('data-palette-item-id');
                                if (paletteItemId) {
                                    // The tool palette should handle this
                                }
                            }, { capture: true });
                            
                            // Ensure button is visually clickable
                            buttonToUse.style.pointerEvents = 'auto';
                            buttonToUse.style.cursor = 'pointer';
                            buttonToUse.removeAttribute('disabled');
                        });
                    }
                    // Also ensure edit mode and tools are still enabled after DOM updates
                    try {
                        actionDispatcher.dispatch(SetEditModeAction.create(EditMode.EDITABLE));
                        actionDispatcher.dispatch(EnableDefaultToolsAction.create());
                    } catch (e) {
                        console.warn('Could not set edit mode:', e);
                    }
                }, 200);
            }
        }
        // Check if this is a LoadMetamodelResponse
        else if (action.kind === 'loadMetamodelResponse') {
            pendingBoundsRetries = 0;
            const result = originalDispatch(action);
            result.then(() => {
                if (editorContextServiceRef?.modelRoot) {
                    lastKnownModelRoot = editorContextServiceRef.modelRoot as unknown as GModelRoot;
                }
                scheduleBoundsUpdate();
            }, () => scheduleBoundsUpdate());

            // Update toolbar with available classes
            if (action.success) {
                metamodelAvailable = true;
                setToolPaletteVisible(true);
                leftSidebar.setVisualConfigurationAvailable(true);
                if (action.classInfo && action.classInfo.length > 0) {
                    toolbar.updateClassInfo(action.classInfo);
                } else if (action.classNames && action.classNames.length > 0) {
                    toolbar.updateAvailableClasses(action.classNames);
                }
            } else {
                metamodelAvailable = false;
                setToolPaletteVisible(false);
                leftSidebar.setVisualConfigurationAvailable(false);
            }

            // Refresh docked properties panel when metamodel changes (metamodel mode only)
            try { await actionDispatcher.dispatch(createOpenClassPropertiesAction()); } catch {}

            return result;
        }
        else if (SetModelAction.is(action)) {
            const result = originalDispatch(action);
            result.then(async () => {
                const contextRoot = editorContextServiceRef?.modelRoot as unknown as GModelRoot | undefined;
                lastKnownModelRoot = contextRoot ?? (action.newRoot as unknown as GModelRoot);
                scheduleBoundsUpdate();
                
                // After model is set (especially after mode switch), ensure editor is in editable mode
                // Check current mode to determine if we should set edit mode
                const currentMode = (window as any).currentViewMode || 'metamodel';
                if (metamodelAvailable && currentMode === 'metamodel') {
                    // Use multiple attempts to ensure edit mode is set
                    const setEditMode = async (attempt = 0) => {
                        try {
                            await actionDispatcher.dispatch(SetEditModeAction.create(EditMode.EDITABLE));
                            await actionDispatcher.dispatch(EnableDefaultToolsAction.create());
                            
                            // Verify edit mode was set correctly
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
                    
                    // Try immediately and with delays to ensure it sticks
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
            }, () => {
                scheduleBoundsUpdate();
            });
            return result;
        }
        
        // Otherwise, dispatch normally
        return originalDispatch(action);
    };
}

function setupVisualConfigurationDebugging(): void {
    // Visual configuration debugging functionality
    window.debugVisualConfigurations = () => {
        // Find all instance nodes
        const instanceNodes = document.querySelectorAll('.ecore-instance');
        
        instanceNodes.forEach((node) => {
            // Check for SVG children
            node.querySelectorAll('rect, circle, ellipse, polygon, path');
        });
    };
}

function showEClassCreationDialog(): void {
    // Create a simple dialog for EClass creation
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

    // Class name input
    const nameLabel = document.createElement('label');
    nameLabel.textContent = 'Class Name:';
    nameLabel.style.cssText = 'display: block; margin-bottom: 5px; font-weight: bold;';
    dialog.appendChild(nameLabel);

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.placeholder = 'Enter class name';
    nameInput.style.cssText = 'width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; margin-bottom: 15px; box-sizing: border-box;';
    dialog.appendChild(nameInput);

    // Buttons
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

        // Validate class name
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(className)) {
            alert('Class name must start with a letter or underscore and contain only letters, numbers, and underscores.');
            return;
        }

        // Create the EClass
        if (actionDispatcher) {
            const action = createCreateEClassAction(className);
            actionDispatcher.dispatch(action);
        }

        document.body.removeChild(dialog);
    });

    buttonContainer.appendChild(cancelButton);
    buttonContainer.appendChild(createButton);
    dialog.appendChild(buttonContainer);

    // Add backdrop
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

    // Focus the name input
    nameInput.focus();
}

function showEEnumCreationDialog(): void {
    // Create a simple dialog for EEnum creation
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

    // Enum name input
    const nameLabel = document.createElement('label');
    nameLabel.textContent = 'Enum Name:';
    nameLabel.style.cssText = 'display: block; margin-bottom: 5px; font-weight: bold;';
    dialog.appendChild(nameLabel);

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.placeholder = 'Enter enum name';
    nameInput.style.cssText = 'width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; margin-bottom: 15px; box-sizing: border-box;';
    dialog.appendChild(nameInput);

    // Enum literals section
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

    // Add one empty row by default
    addLiteralRow();

    // Buttons
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

        // Validate enum name
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(enumName)) {
            alert('Enum name must start with a letter or underscore and contain only letters, numbers, and underscores.');
            return;
        }

        // Collect enum literals
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

        // Create the EEnum
        if (actionDispatcher) {
            const action = createCreateEEnumAction(enumName, undefined, enumLiterals.length > 0 ? enumLiterals : undefined);
            actionDispatcher.dispatch(action);
        }

        document.body.removeChild(dialog);
    });

    buttonContainer.appendChild(cancelButton);
    buttonContainer.appendChild(createButton);
    dialog.appendChild(buttonContainer);

    // Add backdrop
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
    // Create a dialog for adding an attribute
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

    // Attribute Name Input
    const nameLabel = document.createElement('label');
    nameLabel.textContent = 'Attribute Name:';
    nameLabel.style.cssText = 'display: block; margin-top: 10px; color: #555;';
    dialog.appendChild(nameLabel);

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.placeholder = 'e.g., name, age, description';
    nameInput.style.cssText = 'width: 100%; padding: 8px; margin-top: 5px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box;';
    dialog.appendChild(nameInput);

    // Attribute Type Dropdown
    const typeLabel = document.createElement('label');
    typeLabel.textContent = 'Attribute Type:';
    typeLabel.style.cssText = 'display: block; margin-top: 10px; color: #555;';
    dialog.appendChild(typeLabel);

    const typeSelect = document.createElement('select');
    typeSelect.style.cssText = 'width: 100%; padding: 8px; margin-top: 5px; border: 1px solid #ddd; border-radius: 4px;';
    
    // Add primitive types
    const types = ['EString', 'EInt', 'EBoolean', 'EDouble', 'EFloat', 'ELong', 'EDate'];
    types.forEach(type => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type;
        typeSelect.appendChild(option);
    });
    
    // Function to add enum options to the dropdown
    const addEnumOptions = (enumNames: string[]) => {
        if (enumNames && Array.isArray(enumNames) && enumNames.length > 0) {
            // Remove existing enum separator and options if they exist
            const existingOptions = Array.from(typeSelect.options);
            const separatorIndex = existingOptions.findIndex(opt => opt.textContent === '--- Enums ---');
            if (separatorIndex >= 0) {
                // Remove all options from separator onwards (they're enums)
                for (let i = typeSelect.options.length - 1; i >= separatorIndex; i--) {
                    typeSelect.remove(i);
                }
            }
            
            // Add separator option
            const separatorOption = document.createElement('option');
            separatorOption.disabled = true;
            separatorOption.textContent = '--- Enums ---';
            typeSelect.appendChild(separatorOption);
            
            // Add enum options (sorted)
            enumNames.slice().sort().forEach((enumName: string) => {
                const option = document.createElement('option');
                option.value = enumName;
                option.textContent = enumName;
                typeSelect.appendChild(option);
            });
        }
    };
    
    // First, try to get enum names from toolbar (cached)
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
    
    // Also request enum names from server to ensure we have the latest
    if (actionDispatcher) {
        // Generate requestId using RequestAction helper
        const requestId = RequestAction.generateRequestId();
        const requestAction: any = {
            kind: 'requestEnumNames',
            requestId: requestId
        };
        
        console.log('[showAddAttributeDialog] Requesting enum names with requestId:', requestId);
        
        // Use promise-based approach similar to RequestInstancesOverviewAction
        new Promise<string[]>((resolve, reject) => {
            const timeoutHandle = window.setTimeout(() => {
                clearPendingEnumNameRequest(requestId);
                reject(new Error('Timed out waiting for enum names response'));
            }, 5000);
            
            setPendingEnumNameRequest(requestId, resolve, reject, timeoutHandle);
            
            // Dispatch the action
            console.log('[showAddAttributeDialog] Dispatching requestEnumNames action:', requestAction);
            actionDispatcher.dispatch(requestAction).catch(error => {
                const pending = getPendingEnumNameRequest(requestId);
                if (pending) {
                    window.clearTimeout(pending.timeoutHandle);
                    clearPendingEnumNameRequest(requestId);
                    reject(error);
                }
            });
        }).then((enumNames: string[]) => {
            console.log('[showAddAttributeDialog] Received enum names:', enumNames);
            if (enumNames && Array.isArray(enumNames) && enumNames.length > 0) {
                addEnumOptions(enumNames);
                // Also update the toolbar cache
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

    // Lower Bound Input
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

    // Upper Bound Input
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

    // Buttons
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

        // Validate attribute name
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(attributeName)) {
            alert('Attribute name must start with a letter or underscore and contain only letters, numbers, and underscores.');
            return;
        }

        const attributeType = typeSelect.value;
        const lowerBound = parseInt(lowerBoundInput.value, 10);
        const upperBound = parseInt(upperBoundInput.value, 10);

        // Validate bounds
        if (lowerBound < 0) {
            alert('Lower bound must be >= 0');
            return;
        }
        if (upperBound < -1 || (upperBound >= 0 && upperBound < lowerBound)) {
            alert('Upper bound must be >= lower bound or -1 for unlimited');
            return;
        }

        // Add the attribute
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

    // Add backdrop
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

    // Focus the name input
    nameInput.focus();
}

// Export to global scope so context menu can call it
(window as any).showAddAttributeDialog = showAddAttributeDialog;

function showDeleteAttributeDialog(className: string, attributes: Array<{name: string; type: string}>): void {
    if (!attributes || attributes.length === 0) {
        alert(`Class "${className}" has no attributes to delete.`);
        return;
    }

    // Create a dialog for deleting attributes
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

    // Attribute list (checkboxes for multiple selection)
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

    // Select All / Deselect All buttons
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

    // Warning message
    const warning = document.createElement('p');
    warning.textContent = 'This action cannot be undone.';
    warning.style.cssText = 'margin: 10px 0; color: #d9534f; font-size: 12px; font-weight: bold;';
    dialog.appendChild(warning);

    // Buttons
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
            // Delete attributes one by one
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

    // Add backdrop
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

// Export to global scope so context menu can call it
(window as any).showDeleteAttributeDialog = showDeleteAttributeDialog;

function showInstanceContextMenu(event: MouseEvent, instanceId: string): void {
    // Check if metamodel is loaded (check if toolbar has class info)
    const toolbar = (window as any).globalToolbar;
    const hasMetamodel = toolbar && toolbar.hasClassInfo && toolbar.hasClassInfo();
    
    // Create backdrop first so it's accessible in all click handlers
    const backdrop = document.createElement('div');
    backdrop.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 9999;
        background: transparent;
    `;
    
    // Create a simple context menu for instances
    const menu = document.createElement('div');
    menu.style.cssText = `
        position: fixed;
        left: ${event.clientX}px;
        top: ${event.clientY}px;
        background: white;
        border: 1px solid #ccc;
        border-radius: 4px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        min-width: 200px;
        font-family: Arial, sans-serif;
        padding: 5px 0;
    `;
    
    // Function to close the menu
    const closeMenu = () => {
        if (backdrop.parentNode) {
            document.body.removeChild(backdrop);
        }
        if (menu.parentNode) {
            document.body.removeChild(menu);
        }
    };
    
    backdrop.addEventListener('click', closeMenu);

    // Add menu item to edit attributes
    const editAttributesItem = document.createElement('div');
    editAttributesItem.textContent = 'Edit Attributes';
    editAttributesItem.style.cssText = `
        padding: 10px 15px;
        cursor: pointer;
        font-size: 14px;
    `;
    editAttributesItem.addEventListener('mouseenter', () => {
        editAttributesItem.style.background = '#f0f0f0';
    });
    editAttributesItem.addEventListener('mouseleave', () => {
        editAttributesItem.style.background = 'transparent';
    });
    editAttributesItem.addEventListener('click', () => {
        closeMenu();
        showEditInstanceAttributeDialog(instanceId);
    });

    menu.appendChild(editAttributesItem);

    // Add menu item to delete element
    const deleteElementItem = document.createElement('div');
    deleteElementItem.textContent = 'Delete Element';
    deleteElementItem.style.cssText = `
        padding: 10px 15px;
        cursor: pointer;
        font-size: 14px;
        border-top: 1px solid #eee;
        color: #000000;
    `;
    deleteElementItem.addEventListener('mouseenter', () => {
        deleteElementItem.style.background = '#f0f0f0';
    });
    deleteElementItem.addEventListener('mouseleave', () => {
        deleteElementItem.style.background = 'transparent';
    });
    deleteElementItem.addEventListener('click', () => {
        closeMenu();
        
        // Confirm deletion
        const confirmed = confirm('Are you sure you want to delete this element?');
        if (confirmed && actionDispatcher) {
            // Dispatch delete operation
            actionDispatcher.dispatch(DeleteElementOperation.create([instanceId]));
        }
    });

    menu.appendChild(deleteElementItem);

    // Add menu item to set as container (only if metamodel is loaded)
    if (hasMetamodel) {
        const setContainerItem = document.createElement('div');
        setContainerItem.textContent = 'Set as Container';
        setContainerItem.style.cssText = `
            padding: 10px 15px;
            cursor: pointer;
            font-size: 14px;
            border-top: 1px solid #eee;
        `;
        setContainerItem.addEventListener('mouseenter', () => {
            setContainerItem.style.background = '#f0f0f0';
        });
        setContainerItem.addEventListener('mouseleave', () => {
            setContainerItem.style.background = 'transparent';
        });
        setContainerItem.addEventListener('click', () => {
            const toolbar = (window as any).globalToolbar;
            if (toolbar && toolbar.setContainer) {
                const className = instanceId.split('_')[0]; // Extract class name from instance ID
                toolbar.setContainer(instanceId, className);
            }
            // Backdrop will be declared later, find it by class or remove menu directly
            const backdropElements = document.querySelectorAll('div[style*="z-index: 9999"]');
            backdropElements.forEach(el => {
                if (el.parentNode) {
                    el.parentNode.removeChild(el);
                }
            });
            document.body.removeChild(menu);
        });
        menu.appendChild(setContainerItem);
    }

    // Only show instance creation options if metamodel is loaded
    if (!hasMetamodel) {
        document.body.appendChild(backdrop);
        document.body.appendChild(menu);
        return;
    }

    // The backdrop is already created above, just append it here
    document.body.appendChild(backdrop);
    document.body.appendChild(menu);
}

function showEditInstanceAttributeDialog(instanceId: string): void {
    // Create a dialog for editing instance attributes
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
        max-width: 600px;
        font-family: Arial, sans-serif;
    `;

    const title = document.createElement('h3');
    title.textContent = `Edit Instance: ${instanceId}`;
    title.style.cssText = 'margin: 0 0 15px 0; color: #333;';
    dialog.appendChild(title);

    const description = document.createElement('p');
    description.textContent = 'Edit attribute values for this instance:';
    description.style.cssText = 'margin: 10px 0; color: #666;';
    dialog.appendChild(description);

    // Create attribute input section
    const attributeSection = document.createElement('div');
    attributeSection.style.cssText = 'margin: 15px 0;';

    // Attribute Name Input
    const nameLabel = document.createElement('label');
    nameLabel.textContent = 'Attribute Name:';
    nameLabel.style.cssText = 'display: block; margin-top: 10px; color: #555;';
    attributeSection.appendChild(nameLabel);

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.placeholder = 'e.g., name, age, description';
    nameInput.style.cssText = 'width: 100%; padding: 8px; margin-top: 5px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box;';
    attributeSection.appendChild(nameInput);

    // Attribute Value Input
    const valueLabel = document.createElement('label');
    valueLabel.textContent = 'Attribute Value:';
    valueLabel.style.cssText = 'display: block; margin-top: 10px; color: #555;';
    attributeSection.appendChild(valueLabel);

    const valueInput = document.createElement('input');
    valueInput.type = 'text';
    valueInput.placeholder = 'Enter the value';
    valueInput.style.cssText = 'width: 100%; padding: 8px; margin-top: 5px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box;';
    attributeSection.appendChild(valueInput);

    dialog.appendChild(attributeSection);

    // Buttons
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = 'margin-top: 20px; text-align: right;';

    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    cancelButton.style.cssText = 'padding: 8px 16px; margin-right: 10px; border: 1px solid #ccc; border-radius: 4px; background: white; cursor: pointer;';
    cancelButton.addEventListener('click', () => {
        document.body.removeChild(backdrop);
        document.body.removeChild(dialog);
    });

    const saveButton = document.createElement('button');
    saveButton.textContent = 'Save';
    saveButton.style.cssText = 'padding: 8px 16px; border: none; border-radius: 4px; background: #007acc; color: white; cursor: pointer;';
    saveButton.addEventListener('click', async () => {
        const attributeName = nameInput.value.trim();
        const attributeValue = valueInput.value.trim();
        
        if (!attributeName) {
            alert('Please enter an attribute name');
            return;
        }

        if (!attributeValue) {
            alert('Please enter an attribute value');
            return;
        }

        // Dispatch action to set the attribute
        if (actionDispatcher) {
            const action = {
                kind: 'setInstanceAttribute',
                instanceId: instanceId,
                attributeName: attributeName,
                value: attributeValue
            };
            
            try {
                await actionDispatcher.dispatch(action);
                document.body.removeChild(backdrop);
                document.body.removeChild(dialog);
            } catch (error) {
                console.error('Error setting instance attribute:', error);
                alert('Error setting attribute: ' + error);
            }
        }
    });

    buttonContainer.appendChild(cancelButton);
    buttonContainer.appendChild(saveButton);
    dialog.appendChild(buttonContainer);

    // Add backdrop
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

    // Focus the name input
    nameInput.focus();
}

let classSelectionForwarderInstalled = false;

function forwardSelectionToClassProperties(className: string | null): void {
    const panel = window.classPropertiesPanel;
    if (panel && typeof panel.setSelectedClass === 'function') {
        panel.setSelectedClass(className);
    }
}

function setupClassSelectionForwarding(): void {
    if (classSelectionForwarderInstalled) {
        return;
    }
    classSelectionForwarderInstalled = true;

    document.addEventListener('click', (event) => {
        const target = event.target as HTMLElement | null;
        if (!target) {
            return;
        }
        const classElement = target.closest('.ecore-class') as HTMLElement | null;
        if (!classElement) {
            return;
        }
        const rawId = classElement.id || classElement.getAttribute('data-class-name') || '';
        if (!rawId) {
            return;
        }
        const className = rawId.startsWith('sprotty_') ? rawId.substring(8) : rawId;
        forwardSelectionToClassProperties(className);
    });
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

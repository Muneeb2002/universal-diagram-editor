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
import { createCreateEClassAction, createAddAttributeAction, createDeleteAttributeAction } from './ecore-client-actions';
import { setGlobalToolbar } from './load-metamodel-response-handler';
import { VisualConfigurationDialog } from './visual-configuration-dialog';
import { setGlobalVisualConfigDialog } from './visual-configuration-response-handler';
import { LeftSidebar } from './left-sidebar';
import { setupInteractiveResize } from './interactive-resize';
import { SelectAction, SetModelAction, UpdateModelAction } from '@eclipse-glsp/protocol';

let editorContextServiceRef: EditorContextService | undefined;
let lastKnownModelRoot: GModelRoot | undefined;

declare global {
    interface Window {
        showEClassCreationDialog?: () => void;
        debugVisualConfigurations?: () => void;
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

// Add UI elements to the page
document.addEventListener('DOMContentLoaded', () => {
    leftSidebar.attach();
    const toolbarElement = toolbar.getElement();
    leftSidebar.dockToolbar(toolbarElement);
});

async function initialize(connectionProvider: MessageConnection, isReconnecting = false): Promise<void> {
    glspClient = new BaseJsonrpcGLSPClient({ id, connectionProvider });
    container = createContainer({ clientId, diagramType, glspClientProvider: async () => glspClient });
    actionDispatcher = container.get(GLSPActionDispatcher);
    
    // Set action dispatcher for toolbar and context menus
    toolbar.setActionDispatcher(actionDispatcher);
    leftSidebar.setActionDispatcher(actionDispatcher);
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
    
    // Create and set up visual configuration dialog
    const visualConfigDialog = new VisualConfigurationDialog(actionDispatcher);
    setGlobalVisualConfigDialog(visualConfigDialog);
    
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
        const instanceElement = target.closest('.ecore-instance');
        
        if (instanceElement) {
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

    // Listen for various custom actions
    // This is a workaround - in a full implementation you'd use proper action handlers
    const originalDispatch = actionDispatcher.dispatch.bind(actionDispatcher);
    actionDispatcher.dispatch = async (action: any) => {
        
        // Check if this is the trigger EClass creation action
        if (action.kind === 'triggerEClassCreation') {
            showEClassCreationDialog();
            return Promise.resolve();
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
            if (mode === 'instance') {
                forwardSelectionToClassProperties(null);
                const panel = document.getElementById('class-properties-panel');
                if (panel && panel.parentElement) panel.parentElement.removeChild(panel);
                document.body.style.paddingBottom = '0px';
                document.body.style.setProperty('--bottom-panel-height', '0px');
                // Hide tool palette UI extension
                const palette = document.getElementById('tool-palette') || document.querySelector('.tool-palette') as HTMLElement | null;
                if (palette) (palette as HTMLElement).style.display = 'none';
            } else if (mode === 'metamodel') {
                try { await actionDispatcher.dispatch({ kind: 'openClassProperties' }); } catch {}
                const palette = document.getElementById('tool-palette') || document.querySelector('.tool-palette') as HTMLElement | null;
                if (palette) (palette as HTMLElement).style.display = '';
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
            if (action.success && action.classNames && action.classNames.length > 0) {
                
                // If we have full class info, use that (it has containment and abstract info)
                if (action.classInfo && action.classInfo.length > 0) {
                    toolbar.updateClassInfo(action.classInfo);
                } else {
                    // Fallback to class names only
                    toolbar.updateAvailableClasses(action.classNames);
                }
            } else {
                console.warn('LoadMetamodelResponse received but no classes found:', action);
            }

            // Refresh docked properties panel when metamodel changes (metamodel mode only)
            try { await actionDispatcher.dispatch(createOpenClassPropertiesAction()); } catch {}

            return result;
        }
        else if (SetModelAction.is(action)) {
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

    // Class type checkboxes
    const typeLabel = document.createElement('label');
    typeLabel.textContent = 'Class Type:';
    typeLabel.style.cssText = 'display: block; margin-bottom: 10px; font-weight: bold;';
    dialog.appendChild(typeLabel);

    const abstractCheckbox = document.createElement('input');
    abstractCheckbox.type = 'checkbox';
    abstractCheckbox.id = 'abstract-checkbox';
    const abstractLabel = document.createElement('label');
    abstractLabel.htmlFor = 'abstract-checkbox';
    abstractLabel.textContent = 'Abstract';
    abstractLabel.style.cssText = 'margin-right: 15px; cursor: pointer;';
    dialog.appendChild(abstractCheckbox);
    dialog.appendChild(abstractLabel);

    const interfaceCheckbox = document.createElement('input');
    interfaceCheckbox.type = 'checkbox';
    interfaceCheckbox.id = 'interface-checkbox';
    const interfaceLabel = document.createElement('label');
    interfaceLabel.htmlFor = 'interface-checkbox';
    interfaceLabel.textContent = 'Interface';
    interfaceLabel.style.cssText = 'margin-right: 15px; cursor: pointer;';
    dialog.appendChild(interfaceCheckbox);
    dialog.appendChild(interfaceLabel);

    const br = document.createElement('br');
    dialog.appendChild(br);

    // Attributes checkbox
    const attributesCheckbox = document.createElement('input');
    attributesCheckbox.type = 'checkbox';
    attributesCheckbox.id = 'attributes-checkbox';
    attributesCheckbox.checked = true; // Default to true
    const attributesLabel = document.createElement('label');
    attributesLabel.htmlFor = 'attributes-checkbox';
    attributesLabel.textContent = 'Include default attributes';
    attributesLabel.style.cssText = 'cursor: pointer;';
    dialog.appendChild(attributesCheckbox);
    dialog.appendChild(attributesLabel);

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

        const isAbstract = abstractCheckbox.checked;
        const isInterface = interfaceCheckbox.checked;
        const hasAttributes = attributesCheckbox.checked;

        // Create the EClass
        if (actionDispatcher) {
            const action = createCreateEClassAction(className, isAbstract, isInterface, hasAttributes);
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
    const types = ['EString', 'EInt', 'EBoolean', 'EDouble', 'EFloat', 'ELong', 'EDate'];
    types.forEach(type => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type;
        typeSelect.appendChild(option);
    });
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
        document.body.removeChild(backdrop);
        document.body.removeChild(menu);
        showEditInstanceAttributeDialog(instanceId);
    });

    menu.appendChild(editAttributesItem);

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
        // Add backdrop to close menu
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
        backdrop.addEventListener('click', () => {
            document.body.removeChild(backdrop);
            document.body.removeChild(menu);
        });

        document.body.appendChild(backdrop);
        document.body.appendChild(menu);
        return;
    }



    // Add backdrop to close menu
    const backdrop = document.createElement('div');
    backdrop.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 9999;
    `;
    backdrop.addEventListener('click', () => {
        document.body.removeChild(backdrop);
        document.body.removeChild(menu);
    });

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

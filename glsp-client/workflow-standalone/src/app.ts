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

import {
    BaseJsonrpcGLSPClient,
    DiagramLoader,
    GLSPActionDispatcher,
    GLSPClient,
    GLSPWebSocketProvider,
    MessageAction,
    StatusAction
} from '@eclipse-glsp/client';
import { Container } from 'inversify';
import { MessageConnection } from 'vscode-jsonrpc';
import createContainer from './di.config';
import { EcoreFilePicker } from './ecore-file-picker';
import { EcoreToolbar } from './ecore-toolbar';
import { EcoreContextMenu, ClassInfo, EcoreEdgeContextMenu, EdgeInfo } from './ecore-context-menu';
import { createLoadMetamodelAction, createCreateEClassAction, createAddAttributeAction, createDeleteAttributeAction } from './ecore-client-actions';
import { setGlobalToolbar } from './load-metamodel-response-handler';
import { VisualConfigurationDialog } from './visual-configuration-dialog';
import { setGlobalVisualConfigDialog } from './visual-configuration-response-handler';
import { setupInteractiveResize } from './interactive-resize';

// Global type declaration for the EClass creation dialog
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

// Initialize file picker
const filePicker = new EcoreFilePicker();
const toolbar = new EcoreToolbar();
const contextMenu = new EcoreContextMenu();
const edgeContextMenu = new EcoreEdgeContextMenu();

filePicker.onFileSelected = async (filename: string, content: string) => {
    if (actionDispatcher) {
        try {
            // Use the action to load JSON metamodel files
            const action = createLoadMetamodelAction(content, filename, true);
            await actionDispatcher.dispatch(action);

            console.log('Metamodel loaded:', filename);
        } catch (error) {
            console.error('Error loading metamodel:', error);
            alert('Error loading metamodel: ' + error);
        }
    }
};

// Add UI elements to the page
document.addEventListener('DOMContentLoaded', () => {
    const button = filePicker.createFilePickerButton();
    document.body.appendChild(button);
    
    const toolbarElement = toolbar.getElement();
    document.body.appendChild(toolbarElement);
});

async function initialize(connectionProvider: MessageConnection, isReconnecting = false): Promise<void> {
    glspClient = new BaseJsonrpcGLSPClient({ id, connectionProvider });
    container = createContainer({ clientId, diagramType, glspClientProvider: async () => glspClient });
    actionDispatcher = container.get(GLSPActionDispatcher);
    
    // Set action dispatcher for toolbar and context menus
    toolbar.setActionDispatcher(actionDispatcher);
    contextMenu.setActionDispatcher(actionDispatcher);
    edgeContextMenu.setActionDispatcher(actionDispatcher);
    
    // Set the global toolbar reference for the LoadMetamodelResponseHandler
    setGlobalToolbar(toolbar);
    
    // Create and set up visual configuration dialog
    const visualConfigDialog = new VisualConfigurationDialog(actionDispatcher);
    setGlobalVisualConfigDialog(visualConfigDialog);
    
    // Set up context menu for class elements
    setupContextMenu();
    
    // Set up action handling for custom actions
    setupCustomActionHandling();
    
    // Add visual configuration debugging
    setupVisualConfigurationDebugging();
    
    // Set up interactive resize functionality with a delay to ensure DOM is ready
    setTimeout(() => {
        setupInteractiveResize();
    }, 1000);
    
    const diagramLoader = container.get(DiagramLoader);
    await diagramLoader.load({ requestModelOptions: { isReconnecting } });

    // Set up listener for LoadMetamodelResponse to update toolbar
    setupMetamodelResponseListener();

    if (isReconnecting) {
        const message = `Connection to the ${id} glsp server got closed. Connection was successfully re-established.`;
        const timeout = 5000;
        const severity = 'WARNING';
        actionDispatcher.dispatchAll([StatusAction.create(message, { severity, timeout }), MessageAction.create(message, { severity })]);
        return;
    }
}

function setupContextMenu(): void {
    // Listen for clicks on edit buttons in the diagram
    document.addEventListener('click', (event) => {
        const target = event.target as HTMLElement;
        
        // Check if the clicked element is an edit button or its parent
        const editButton = target.closest('.edit-button') || 
                          (target.classList.contains('edit-button-bg') ? target.parentElement : null);
        
        if (editButton) {
            event.preventDefault();
            event.stopPropagation();
            
            // Find the parent class element
            const classElement = editButton.closest('.ecore-class');
            if (!classElement) return;
            
            // Get class information from the element
            // Use the node ID which is set to the class name, but strip the sprotty_ prefix
            const rawId = classElement.id || classElement.getAttribute('data-class-name') || 'UnknownClass';
            const className = rawId.startsWith('sprotty_') ? rawId.substring(8) : rawId;
            
            // Check if it's abstract or interface
            const isAbstract = classElement.classList.contains('abstract');
            const isInterface = classElement.classList.contains('interface');
            
            // Extract attributes from the rendered DOM
            const attributes: Array<{name: string; type: string; lowerBound: number; upperBound: number; unique: boolean; ordered: boolean}> = [];
            const references: Array<{name: string; type: string; lowerBound: number; upperBound: number; containment: boolean; container: boolean; unique: boolean; ordered: boolean}> = [];
            
            // Find the attributes compartment using data attribute
            let attributesCompartment = classElement.querySelector('[data-svg-metadata-type="comp:attributes"]');
            
            if (attributesCompartment) {
                // Get the text element within the compartment (all attributes are in ONE label)
                const textElement = attributesCompartment.querySelector('text');
                
                if (textElement) {
                    const fullText = textElement.textContent || '';
                    
                    // Split by newlines - each line is one attribute
                    const lines = fullText.split('\n');
                    
                    lines.forEach((line) => {
                        const text = line.trim();
                        if (!text || text === 'Attributes') return;
                        
                        // Parse format: "name : EString[0..1]" or "name : EString [0..1]"
                        // Note: space before and after colon, optional space before bracket
                        const match = text.match(/^(.+?)\s*:\s*([^\[]+?)\s*(?:\[(\d+)\.\.(-?\d+|\*)\])?$/);
                        if (match) {
                            const [, name, type, lower, upper] = match;
                            
                            attributes.push({
                                name: name.trim(),
                                type: type.trim(),
                                lowerBound: lower ? parseInt(lower) : 0,
                                upperBound: upper === '*' || upper === '-1' ? -1 : (upper ? parseInt(upper) : 1),
                                unique: true,
                                ordered: false
                            });
                        }
                    });
                }
            }
            
            // Create class info object  
            const classInfo: ClassInfo = {
                className: className,
                isAbstract: isAbstract,
                isInterface: isInterface,
                attributes: attributes,
                references: references  // Empty for now, could be extracted similarly
            };
            
            // Show context menu
            contextMenu.show(event, classInfo);
        }
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
            
            console.log(`Edge info created: edgeId="${edgeId}", sourceId="${sourceId}", targetId="${targetId}"`);
            
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
            
            console.log(`Right-clicked on instance: ${instanceId}`);
            
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
    // Remove sprotty_ prefix if present
    const cleanEdgeId = edgeId.startsWith('sprotty_') ? edgeId.substring(8) : edgeId;
    
    // Handle different edge ID patterns
    if (cleanEdgeId.includes('_inherits_')) {
        // Inheritance: "Place_inherits_Node" -> sourceId: "Place", targetId: "Node"
        const parts = cleanEdgeId.split('_inherits_');
        return { sourceId: parts[0], targetId: parts[1] };
    } else if (cleanEdgeId.includes('_')) {
        // Reference/Containment: "Place_tokens" or "Arc_source" or "Arc_target"
        const parts = cleanEdgeId.split('_');
        const sourceId = parts[0];
        
        // For references like "Arc_source" and "Arc_target", we need to determine the target
        // This is tricky without more context, so we'll use a heuristic
        if (parts[1] === 'source' || parts[1] === 'target') {
            // These are likely references to Node (based on the metamodel)
            return { sourceId, targetId: 'Node' };
        } else {
            // For other cases like "Place_tokens", assume the reference name is the target type
            // We'll need to map this to the actual target type
            const referenceName = parts.slice(1).join('_');
            
            // For containment/reference edges like "Node_places", we need to reverse the relationship
            // "Node_places" means Node contains Place, so for inheritance: Place -> Node
            if (referenceName === 'tokens') {
                // Place_tokens -> Place contains Token, so inheritance: Token -> Place
                return { sourceId: 'Token', targetId: sourceId };
            } else if (referenceName === 'places') {
                // Node_places -> Node contains Place, so inheritance: Place -> Node
                return { sourceId: 'Place', targetId: sourceId };
            } else if (referenceName === 'objects') {
                // PetriNet_objects -> PetriNet contains Object, so inheritance: Object -> PetriNet
                return { sourceId: 'Object', targetId: sourceId };
            } else {
                // For other cases, try to infer from the reference name
                const capitalized = referenceName.charAt(0).toUpperCase() + referenceName.slice(1);
                return { sourceId: capitalized, targetId: sourceId };
            }
        }
    }
    
    // Fallback
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
        console.log('[ACTION DISPATCHER] Received action:', action.kind);
        
        // Check if this is the trigger EClass creation action
        if (action.kind === 'triggerEClassCreation') {
            showEClassCreationDialog();
            return Promise.resolve();
        }
        // Check if this is a LoadMetamodelResponse
        else if (action.kind === 'loadMetamodelResponse') {
            console.log('✅ Received LoadMetamodelResponse:', action);
            
            // Update toolbar with available classes
            if (action.success && action.classNames && action.classNames.length > 0) {
                console.log(`📋 Updating toolbar with ${action.classNames.length} classes:`, action.classNames);
                toolbar.updateAvailableClasses(action.classNames);
                console.log('✅ Toolbar updated successfully');
            } else {
                console.warn('⚠️ LoadMetamodelResponse received but no classes found:', action);
            }
        }
        
        // Otherwise, dispatch normally
        return originalDispatch(action);
    };
}

function setupMetamodelResponseListener(): void {
    // This function is now handled in setupCustomActionHandling
    // Keeping it for backwards compatibility but it does nothing
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

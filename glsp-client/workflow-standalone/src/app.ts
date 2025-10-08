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
import { createLoadMetamodelAction } from './ecore-client-actions';
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
    
    // Set up context menu for class elements
    setupContextMenu();
    
    const diagramLoader = container.get(DiagramLoader);
    await diagramLoader.load({ requestModelOptions: { isReconnecting } });

    // TODO: Set up proper action listener for LoadMetamodelResponse
    // For now, classes will need to be manually updated
    // In a full implementation, you'd register a proper action handler

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
            
            // Create class info object
            const classInfo: ClassInfo = {
                className: className,
                isAbstract: isAbstract,
                isInterface: isInterface,
                attributes: [], // TODO: Get from metamodel
                references: []  // TODO: Get from metamodel
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
            
            // Show edge context menu
            edgeContextMenu.show(event, edgeInfo);
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
            
            // Simple mapping based on common patterns
            if (referenceName === 'tokens') {
                return { sourceId, targetId: 'Token' };
            } else if (referenceName === 'objects') {
                return { sourceId, targetId: 'Object' };
            } else {
                // For other cases, try to infer from the reference name
                const capitalized = referenceName.charAt(0).toUpperCase() + referenceName.slice(1);
                return { sourceId, targetId: capitalized };
            }
        }
    }
    
    // Fallback
    return { sourceId: 'unknown-source', targetId: 'unknown-target' };
}

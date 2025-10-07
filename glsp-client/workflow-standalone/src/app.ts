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
import { EcoreContextMenu, ClassInfo } from './ecore-context-menu';
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
    
    // Set action dispatcher for toolbar and context menu
    toolbar.setActionDispatcher(actionDispatcher);
    contextMenu.setActionDispatcher(actionDispatcher);
    
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
}

async function reconnect(connectionProvider: MessageConnection): Promise<void> {
    glspClient.stop();
    initialize(connectionProvider, true /* isReconnecting */);
}

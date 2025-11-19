/********************************************************************************
 * Copyright (c) 2024 Eclipse GLSP and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * SPDX-License-Identifier: EPL-2.0
 ********************************************************************************/

import { injectable, inject } from 'inversify';
import {
    GModelCreateNodeOperationHandler,
    CreateNodeOperation,
    GNode,
    GCompartment,
    GLabel,
    ModelState,
    ArgsUtil,
    ModelSubmissionHandler
} from '@eclipse-glsp/server';
import { Point } from '@eclipse-glsp/protocol';

@injectable()
export class DynamicCreateNodeHandler extends GModelCreateNodeOperationHandler {
    @inject(ModelState)
    protected override modelState: ModelState;

    @inject(ModelSubmissionHandler)
    protected modelSubmissionHandler: ModelSubmissionHandler;

    override get label(): string {
        return 'Create Metamodel Element';
    }

    override get elementTypeIds(): string[] {
        // Always return Ecore metamodeling element types
        return this.getEcoreElementTypeIds();
    }

    private getEcoreElementTypeIds(): string[] {
        // Return Ecore metamodeling element types
        return [
            'ecore:class',
            'ecore:datatype',
            'ecore:enum',
            'ecore:attribute',
            'ecore:reference',
            'ecore:package'
        ];
    }


    override createNode(operation: CreateNodeOperation, relativeLocation?: Point): GNode {
        const elementTypeId = operation.elementTypeId;
        // Always create Ecore metamodeling elements
        return this.createEcoreNode(elementTypeId, operation, relativeLocation);
    }

    override async createCommand(operation: CreateNodeOperation) {
        const command = await super.createCommand(operation);
        // After command executes, submit the model to ensure client gets the update
        // Use submitModelDirectly to avoid regenerating the model (which would wipe out the new node)
        if (command) {
            const originalExecute = command.execute.bind(command);
            command.execute = async () => {
                await originalExecute();
                // Submit the current model directly without regenerating
                const actions = await this.modelSubmissionHandler.submitModelDirectly();
                this.actionDispatcher.dispatchAll(actions);
            };
        }
        return command;
    }

    private createEcoreNode(elementTypeId: string, operation: CreateNodeOperation, relativeLocation?: Point): GNode {
        const elementType = elementTypeId.replace('ecore:', '');
        
        const node = new GNode();
        node.type = elementTypeId;
        node.id = this.generateId(elementType);
        node.layout = 'vbox';
        node.args = ArgsUtil.cornerRadius(5);
        
        // Set appropriate CSS classes and initialize based on element type
        switch (elementType) {
            case 'class':
                node.cssClasses = ['ecore-class'];
                node.size = { width: 150, height: 100 };
                this.addHeaderCompartment(node, 'EClass');
                break;
            case 'datatype':
                node.cssClasses = ['ecore-datatype'];
                node.size = { width: 150, height: 80 };
                this.addHeaderCompartment(node, 'EDataType');
                break;
            case 'enum':
                node.cssClasses = ['ecore-enum'];
                node.size = { width: 150, height: 80 };
                this.addEnumHeaderCompartment(node);
                break;
            case 'attribute':
                node.cssClasses = ['ecore-attribute'];
                node.size = { width: 120, height: 60 };
                this.addHeaderCompartment(node, 'EAttribute');
                break;
            case 'reference':
                node.cssClasses = ['ecore-reference'];
                node.size = { width: 120, height: 60 };
                this.addHeaderCompartment(node, 'EReference');
                break;
            case 'package':
                node.cssClasses = ['ecore-package'];
                node.size = { width: 200, height: 150 };
                this.addHeaderCompartment(node, 'EPackage');
                break;
            default:
                node.cssClasses = ['ecore-element'];
                node.size = { width: 100, height: 60 };
                this.addHeaderCompartment(node, 'Element');
        }
        
        // Use default position - place nodes in a grid pattern starting at (100, 100)
        // Calculate position based on existing nodes in the model to avoid overlap
        const existingNodes = this.modelState.root?.children?.filter(child => child instanceof GNode) || [];
        const nodeWidth = node.size?.width || 150;
        const nodeHeight = node.size?.height || 100;
        const spacing = 100;
        const maxNodesPerRow = 3;
        
        const nodeCount = existingNodes.length;
        const row = Math.floor(nodeCount / maxNodesPerRow);
        const col = nodeCount % maxNodesPerRow;
        
        const x = 100 + col * (nodeWidth + spacing);
        const y = 100 + row * (nodeHeight + spacing);
        
        node.position = { x, y };
        return node;
    }

    private addHeaderCompartment(node: GNode, defaultName: string): void {
        const headerCompartment = new GCompartment();
        headerCompartment.id = `${node.id}_header`;
        headerCompartment.type = 'comp:header';
        headerCompartment.layout = 'hbox';
        headerCompartment.size = { width: node.size?.width || 150, height: 30 };
        
        const label = new GLabel();
        label.type = 'label:heading';
        label.id = `${node.id}_name`;
        label.text = defaultName;
        
        headerCompartment.children.push(label);
        node.children = node.children || [];
        node.children.push(headerCompartment);
    }

    private addEnumHeaderCompartment(node: GNode): void {
        const headerCompartment = new GCompartment();
        headerCompartment.id = `${node.id}_header`;
        headerCompartment.type = 'comp:header';
        headerCompartment.layout = 'hbox';
        headerCompartment.size = { width: node.size?.width || 150, height: 30 };
        
        const label = new GLabel();
        label.type = 'label:heading';
        label.id = `${node.id}_enumname`;
        label.text = '<<enumeration>> EEnum';
        
        headerCompartment.children.push(label);
        node.children = node.children || [];
        node.children.push(headerCompartment);
    }


    private generateId(prefix: string): string {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

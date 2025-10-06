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
    ModelState,
    ArgsUtil
} from '@eclipse-glsp/server';

@injectable()
export class DynamicCreateNodeHandler extends GModelCreateNodeOperationHandler {
    @inject(ModelState)
    protected override modelState: ModelState;

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


    override createNode(operation: CreateNodeOperation): GNode {
        const elementTypeId = operation.elementTypeId;
        // Always create Ecore metamodeling elements
        return this.createEcoreNode(elementTypeId, operation);
    }

    private createEcoreNode(elementTypeId: string, operation: CreateNodeOperation): GNode {
        const elementType = elementTypeId.replace('ecore:', '');
        
        const node = new GNode();
        node.type = elementTypeId;
        node.id = this.generateId(elementType);
        node.layout = 'vbox';
        node.args = ArgsUtil.cornerRadius(5);
        
        // Set appropriate CSS classes based on element type
        switch (elementType) {
            case 'class':
                node.cssClasses = ['ecore-class'];
                break;
            case 'datatype':
                node.cssClasses = ['ecore-datatype'];
                break;
            case 'enum':
                node.cssClasses = ['ecore-enum'];
                break;
            case 'attribute':
                node.cssClasses = ['ecore-attribute'];
                break;
            case 'reference':
                node.cssClasses = ['ecore-reference'];
                break;
            case 'package':
                node.cssClasses = ['ecore-package'];
                break;
            default:
                node.cssClasses = ['ecore-element'];
        }
        
        node.position = operation.location || { x: 0, y: 0 };
        return node;
    }


    private generateId(prefix: string): string {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

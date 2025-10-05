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
import { EcoreModel, EClass, isEClass } from './ecore-types';

@injectable()
export class DynamicCreateNodeHandler extends GModelCreateNodeOperationHandler {
    @inject(ModelState)
    protected override modelState: ModelState;

    override get label(): string {
        return 'Create Node';
    }

    override get elementTypeIds(): string[] {
        const modelType = this.modelState.get('modelType') as string;

        if (modelType === 'ecore') {
            return this.getEcoreElementTypeIds();
        } else {
            return this.getWorkflowElementTypeIds();
        }
    }

    private getEcoreElementTypeIds(): string[] {
        const ecoreModel = this.modelState.get('ecoreModel') as EcoreModel;
        if (!ecoreModel) {
            return [];
        }

        const typeIds: string[] = [];
        ecoreModel.ePackages.forEach(pkg => {
            pkg.eClassifiers.forEach(classifier => {
                if (isEClass(classifier)) {
                    typeIds.push(`ecore:${classifier.name}`);
                }
            });
        });
        return typeIds;
    }

    private getWorkflowElementTypeIds(): string[] {
        // Return existing workflow element type IDs
        return [
            'task:manual',
            'task:automated',
            'activityNode:fork',
            'activityNode:join',
            'activityNode:decision',
            'activityNode:merge',
            'category'
        ];
    }

    override createNode(operation: CreateNodeOperation): GNode {
        const elementTypeId = operation.elementTypeId;
        const modelType = this.modelState.get('modelType') as string;

        if (modelType === 'ecore') {
            return this.createEcoreNode(elementTypeId, operation);
        } else {
            return this.createWorkflowNode(elementTypeId, operation);
        }
    }

    private createEcoreNode(elementTypeId: string, operation: CreateNodeOperation): GNode {
        const eClassName = elementTypeId.replace('ecore:', '');
        const ecoreModel = this.modelState.get('ecoreModel') as EcoreModel;

        if (!ecoreModel) {
            throw new Error('No Ecore model found');
        }

        // Find the EClass
        let eClass: EClass | undefined;
        for (const pkg of ecoreModel.ePackages) {
            eClass = pkg.eClassifiers.find(c => isEClass(c) && c.name === eClassName) as EClass;
            if (eClass) break;
        }

        if (!eClass) {
            throw new Error(`EClass ${eClassName} not found`);
        }

        const node = new GNode();
        node.type = elementTypeId;
        node.id = this.generateId(eClassName);
        node.layout = 'vbox';
        node.args = ArgsUtil.cornerRadius(5);
        node.cssClasses = ['ecore-class'];
        node.position = operation.location || { x: 0, y: 0 };
        return node;
    }

    private createWorkflowNode(elementTypeId: string, operation: CreateNodeOperation): GNode {
        // Delegate to existing workflow node creation logic
        // This is a placeholder - in practice you'd delegate to the existing handlers
        const node = new GNode();
        node.type = elementTypeId;
        node.id = this.generateId(elementTypeId);
        node.position = operation.location || { x: 0, y: 0 };
        return node;
    }

    private generateId(prefix: string): string {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

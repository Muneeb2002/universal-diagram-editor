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
    GModelFactory,
    GModelRoot,
    GNode,
    GEdge,
    GCompartment,
    GLabel,
    ModelState,
    ArgsUtil
} from '@eclipse-glsp/server';
import { EcoreModel, EClass, EReference, isEClass } from './ecore-types';
import { MetamodelRegistry } from './metamodel-registry';
import { InstanceModelStorage } from './instance-model-storage';
import { EcoreInstance } from './instance-model-types';

@injectable()
export class DynamicEcoreGModelFactory implements GModelFactory {
    @inject(ModelState)
    protected modelState: ModelState;

    @inject(MetamodelRegistry)
    protected metamodelRegistry: MetamodelRegistry;

    @inject(InstanceModelStorage)
    protected instanceStorage: InstanceModelStorage;

    createModel(): void {
        const modelType = this.modelState.get('modelType') as string;
        const viewMode = this.modelState.get('viewMode') as string || 'metamodel';

        console.log('DynamicEcoreGModelFactory.createModel() - modelType:', modelType, 'viewMode:', viewMode);

        if (modelType === 'ecore') {
            if (viewMode === 'instance') {
                this.createInstanceModel();
            } else {
                this.createMetamodelVisualization();
            }
        } else {
            // Create a default empty model if no specific type
            this.createDefaultModel();
        }
    }

    /**
     * Creates visualization of the Ecore metamodel (class diagram view)
     */
    private createMetamodelVisualization(): void {
        const ecoreModel = this.modelState.get('ecoreModel') as EcoreModel;
        console.log('createMetamodelVisualization() - ecoreModel:', ecoreModel);

        if (!ecoreModel) {
            console.log('No ecoreModel found, creating default model');
            this.createDefaultModel();
            return;
        }

        const root = new GModelRoot();
        root.type = 'graph';
        root.id = 'sprotty';
        root.revision = 0;

        this.createNodesFromEClasses(root, ecoreModel);
        this.createEdgesFromEReferences(root, ecoreModel);

        console.log('Created metamodel visualization with root:', root);
        this.modelState.set('gmodel', root);
    }

    /**
     * Creates visualization of instance model (object diagram view)
     */
    private createInstanceModel(): void {
        console.log('createInstanceModel()');

        const root = new GModelRoot();
        root.type = 'graph';
        root.id = 'sprotty';
        root.revision = 0;

        const instances = this.instanceStorage.getAllInstances();
        console.log(`Found ${instances.length} instances to visualize`);

        // Create nodes for each instance
        instances.forEach(instance => {
            const node = this.createNodeForInstance(instance);
            root.children.push(node);
        });

        // Create edges for references
        instances.forEach(instance => {
            const edges = this.createEdgesForInstanceReferences(instance);
            edges.forEach(edge => root.children.push(edge));
        });

        console.log('Created instance model with root:', root);
        this.modelState.set('gmodel', root);
    }

    private createDefaultModel(): void {
        console.log('Creating default empty model');
        const root = new GModelRoot();
        root.type = 'graph';
        root.id = 'sprotty';
        root.revision = 0; // Initialize revision
        this.modelState.set('gmodel', root);
        console.log('Default model root set in model state');
    }

    private createNodesFromEClasses(root: GModelRoot, ecoreModel: EcoreModel): void {
        ecoreModel.ePackages.forEach(pkg => {
            pkg.eClassifiers.forEach(classifier => {
                if (isEClass(classifier)) {
                    const node = this.createNodeForEClass(classifier);
                    root.children.push(node);
                }
            });
        });
    }

    private createNodeForEClass(eClass: EClass): GNode {
        const node = new GNode();
        node.type = 'ecore:class'; // Use consistent type for all EClass nodes
        node.id = eClass.name;
        node.layout = 'vbox';
        node.args = ArgsUtil.cornerRadius(5);
        node.cssClasses = ['ecore-class'];

        // Add header compartment with class name
        const headerCompartment = new GCompartment();
        headerCompartment.id = `${eClass.name}_header`;
        headerCompartment.type = 'comp:header';
        headerCompartment.layout = 'hbox';
        headerCompartment.children.push(this.createClassNameLabel(eClass));

        node.children.push(headerCompartment);

        // Add attributes compartment
        if (eClass.eAttributes.length > 0) {
            const attributesCompartment = new GCompartment();
            attributesCompartment.id = `${eClass.name}_attributes`;
            attributesCompartment.type = 'comp:attributes';
            attributesCompartment.layout = 'vbox';
            attributesCompartment.children.push(this.createAttributesLabel(eClass));

            node.children.push(attributesCompartment);
        }

        // Add references compartment
        if (eClass.eReferences.length > 0) {
            const referencesCompartment = new GCompartment();
            referencesCompartment.id = `${eClass.name}_references`;
            referencesCompartment.type = 'comp:references';
            referencesCompartment.layout = 'vbox';
            referencesCompartment.children.push(this.createReferencesLabel(eClass));

            node.children.push(referencesCompartment);
        }

        return node;
    }

    private createClassNameLabel(eClass: EClass): GLabel {
        const labelText = eClass.interface ? `<<interface>> ${eClass.name}` : eClass.name;
        const label = new GLabel();
        label.type = 'label:heading';
        label.id = `${eClass.name}_classname`;
        label.text = labelText;
        return label;
    }

    private createAttributesLabel(eClass: EClass): GLabel {
        const attributesText = eClass.eAttributes
            .map(attr => `- ${attr.name}: ${this.getTypeName(attr.eType)}`)
            .join('\n');

        const label = new GLabel();
        label.type = 'label:text';
        label.id = `${eClass.name}_attributes_label`;
        label.text = attributesText;
        return label;
    }

    private createReferencesLabel(eClass: EClass): GLabel {
        const referencesText = eClass.eReferences
            .map(ref => `- ${ref.name}: ${ref.eType.name}${ref.containment ? ' (containment)' : ''}`)
            .join('\n');

        const label = new GLabel();
        label.type = 'label:text';
        label.id = `${eClass.name}_references_label`;
        label.text = referencesText;
        return label;
    }

    private createEdgesFromEReferences(root: GModelRoot, ecoreModel: EcoreModel): void {
        ecoreModel.ePackages.forEach(pkg => {
            pkg.eClassifiers.forEach(classifier => {
                if (isEClass(classifier)) {
                    classifier.eReferences.forEach(eRef => {
                        const edge = this.createEdgeForEReference(eRef, classifier);
                        if (edge) {
                            root.children.push(edge);
                        }
                    });
                }
            });
        });
    }

    private createEdgeForEReference(eRef: EReference, sourceClass: EClass): GEdge | null {
        // Only create edges for non-containment references to avoid visual clutter
        if (eRef.containment) {
            return null;
        }

        const edge = new GEdge();
        edge.type = 'edge:ecore-reference';
        edge.id = `${sourceClass.name}_${eRef.name}`;
        edge.sourceId = sourceClass.name;
        edge.targetId = eRef.eType.name;

        // Add label for reference name
        const label = new GLabel();
        label.type = 'label:text';
        label.id = `${edge.id}_label`;
        label.text = eRef.name;

        edge.children.push(label);

        return edge;
    }

    private getTypeName(eType: any): string {
        if (typeof eType === 'string') {
            return eType;
        }
        return eType.name || 'Unknown';
    }

    /**
     * Creates a GNode for an instance.
     */
    private createNodeForInstance(instance: EcoreInstance): GNode {
        const node = new GNode();
        node.type = 'ecore:instance'; // Use consistent type for all instance nodes
        node.id = instance.id;
        node.layout = 'vbox';
        node.args = ArgsUtil.cornerRadius(5);
        node.cssClasses = ['ecore-instance'];

        // Set position if available
        if (instance.position) {
            node.position = { x: instance.position.x, y: instance.position.y };
        } else {
            // Auto-layout: position instances in a grid
            node.position = { x: 50, y: 50 };
        }

        // Set size if available
        if (instance.size) {
            node.size = { width: instance.size.width, height: instance.size.height };
        }

        // Get EClass definition for structure
        const eClass = this.metamodelRegistry.findEClass(instance.eClassName);

        // Add header compartment with instance ID and class name
        const headerCompartment = new GCompartment();
        headerCompartment.id = `${instance.id}_header`;
        headerCompartment.type = 'comp:header';
        headerCompartment.layout = 'hbox';

        const headerLabel = new GLabel();
        headerLabel.type = 'label:heading';
        headerLabel.id = `${instance.id}_header_label`;
        headerLabel.text = `${instance.id}: ${instance.eClassName}`;

        headerCompartment.children.push(headerLabel);
        node.children.push(headerCompartment);

        // Add attributes compartment with values
        if (eClass && instance.attributes.size > 0) {
            const attributesCompartment = new GCompartment();
            attributesCompartment.id = `${instance.id}_attributes`;
            attributesCompartment.type = 'comp:attributes';
            attributesCompartment.layout = 'vbox';

            const attributesText: string[] = [];
            instance.attributes.forEach((value, attrName) => {
                const displayValue = value !== null && value !== undefined ? String(value) : '';
                attributesText.push(`${attrName} = ${displayValue}`);
            });

            const attributesLabel = new GLabel();
            attributesLabel.type = 'label:text';
            attributesLabel.id = `${instance.id}_attributes_label`;
            attributesLabel.text = attributesText.join('\n');

            attributesCompartment.children.push(attributesLabel);
            node.children.push(attributesCompartment);
        }

        return node;
    }

    /**
     * Creates GEdges for an instance's references.
     */
    private createEdgesForInstanceReferences(instance: EcoreInstance): GEdge[] {
        const edges: GEdge[] = [];

        instance.references.forEach((value, refName) => {
            if (typeof value === 'string' && value) {
                // Single reference
                const edge = this.createInstanceEdge(instance.id, value, refName);
                if (edge) {
                    edges.push(edge);
                }
            } else if (Array.isArray(value)) {
                // Multi-valued reference
                value.forEach(targetId => {
                    const edge = this.createInstanceEdge(instance.id, targetId, refName);
                    if (edge) {
                        edges.push(edge);
                    }
                });
            }
        });

        return edges;
    }

    /**
     * Creates a single instance reference edge.
     */
    private createInstanceEdge(sourceId: string, targetId: string, refName: string): GEdge | null {
        if (!targetId) {
            return null;
        }

        const edge = new GEdge();
        edge.type = 'edge:inst-reference';
        edge.id = `${sourceId}_${refName}_${targetId}`;
        edge.sourceId = sourceId;
        edge.targetId = targetId;

        // Add label for reference name
        const label = new GLabel();
        label.type = 'label:text';
        label.id = `${edge.id}_label`;
        label.text = refName;

        edge.children.push(label);

        return edge;
    }
}

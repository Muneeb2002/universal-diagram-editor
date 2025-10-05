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
import { EcoreModel, EClass, EReference, EDataType, EEnum, isEClass, isEDataType, isEEnum } from './ecore-types';
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
        this.createEdgesFromInheritance(root, ecoreModel);

        console.log('Created metamodel visualization with root:', root);
        console.log(`Total children in root: ${root.children.length}`);
        console.log(`Children breakdown:`, root.children.map(child => ({ type: child.type, id: child.id })));

        // Debug: Check if any edges were created
        const edges = root.children.filter(child => child.type?.startsWith('edge:'));
        console.log(`Total edges created: ${edges.length}`);
        edges.forEach(edge => {
            console.log(`Edge: ${edge.id} (${edge.type}) from ${(edge as any).sourceId} to ${(edge as any).targetId}`);
        });

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
        let x = 100;
        let y = 100;
        const nodeWidth = 250;
        const nodeHeight = 200;
        const spacing = 100;
        const maxNodesPerRow = 2;

        let nodeCount = 0;

        ecoreModel.ePackages.forEach(pkg => {
            pkg.eClassifiers.forEach(classifier => {
                if (isEClass(classifier)) {
                    const node = this.createNodeForEClass(classifier);
                    this.setNodePosition(node, x, y, nodeWidth, nodeHeight);
                    root.children.push(node);
                } else if (isEDataType(classifier)) {
                    const node = this.createNodeForEDataType(classifier);
                    this.setNodePosition(node, x, y, nodeWidth, nodeHeight);
                    root.children.push(node);
                } else if (isEEnum(classifier)) {
                    const node = this.createNodeForEEnum(classifier);
                    this.setNodePosition(node, x, y, nodeWidth, nodeHeight);
                    root.children.push(node);
                }

                // Update position for next node
                nodeCount++;
                if (nodeCount % maxNodesPerRow === 0) {
                    // Move to next row
                    x = 100;
                    y += nodeHeight + spacing;
                } else {
                    // Move to next column
                    x += nodeWidth + spacing;
                }
            });
        });
    }

    private setNodePosition(node: GNode, x: number, y: number, width: number, height: number): void {
        node.position = { x, y };

        // Ensure minimum size constraints
        const finalWidth = Math.max(width, 150);
        const finalHeight = Math.max(height, 100);

        node.size = { width: finalWidth, height: finalHeight };
    }

    private createNodeForEClass(eClass: EClass): GNode {
        const node = new GNode();
        node.type = 'ecore:class'; // Use consistent type for all EClass nodes
        node.id = eClass.name;
        node.layout = 'vbox';
        node.args = ArgsUtil.cornerRadius(5);

        // Add layout hints to ensure proper sizing
        node.args = {
            ...node.args,
            paddingTop: 10,
            paddingBottom: 10,
            paddingLeft: 10,
            paddingRight: 10
        };

        // Set CSS classes based on class type
        const cssClasses = ['ecore-class'];
        if (eClass.abstract) {
            cssClasses.push('abstract');
        }
        if (eClass.interface) {
            cssClasses.push('interface');
        }
        node.cssClasses = cssClasses;

        // Add header compartment with class name
        const headerCompartment = new GCompartment();
        headerCompartment.id = `${eClass.name}_header`;
        headerCompartment.type = 'comp:header';
        headerCompartment.layout = 'hbox';
        headerCompartment.size = { width: 200, height: 30 }; // Explicit size
        headerCompartment.children.push(this.createClassNameLabel(eClass));

        node.children.push(headerCompartment);

        // Add attributes compartment
        if (eClass.eAttributes.length > 0) {
            const attributesCompartment = new GCompartment();
            attributesCompartment.id = `${eClass.name}_attributes`;
            attributesCompartment.type = 'comp:attributes';
            attributesCompartment.layout = 'vbox';
            attributesCompartment.size = { width: 200, height: 50 }; // Explicit size
            attributesCompartment.children.push(this.createAttributesLabel(eClass));

            node.children.push(attributesCompartment);
        }

        // Add references compartment
        if (eClass.eReferences.length > 0) {
            const referencesCompartment = new GCompartment();
            referencesCompartment.id = `${eClass.name}_references`;
            referencesCompartment.type = 'comp:references';
            referencesCompartment.layout = 'vbox';
            referencesCompartment.size = { width: 200, height: 50 }; // Explicit size
            referencesCompartment.children.push(this.createReferencesLabel(eClass));

            node.children.push(referencesCompartment);
        }

        return node;
    }

    private createNodeForEDataType(eDataType: EDataType): GNode {
        const node = new GNode();
        node.type = 'ecore:datatype'; // Use specific type for EDataType nodes
        node.id = eDataType.name;
        node.layout = 'vbox';
        node.args = ArgsUtil.cornerRadius(5);
        node.cssClasses = ['ecore-datatype'];

        // Add header compartment with data type name
        const headerCompartment = new GCompartment();
        headerCompartment.id = `${eDataType.name}_header`;
        headerCompartment.type = 'comp:header';
        headerCompartment.layout = 'hbox';
        headerCompartment.size = { width: 200, height: 30 }; // Explicit size
        headerCompartment.children.push(this.createDataTypeNameLabel(eDataType));

        node.children.push(headerCompartment);

        // Add instance class name compartment
        const instanceClassCompartment = new GCompartment();
        instanceClassCompartment.id = `${eDataType.name}_instanceclass`;
        instanceClassCompartment.type = 'comp:attributes';
        instanceClassCompartment.layout = 'vbox';
        instanceClassCompartment.size = { width: 200, height: 50 }; // Explicit size
        instanceClassCompartment.children.push(this.createInstanceClassNameLabel(eDataType));

        node.children.push(instanceClassCompartment);

        return node;
    }

    private createNodeForEEnum(eEnum: EEnum): GNode {
        const node = new GNode();
        node.type = 'ecore:enum'; // Use specific type for EEnum nodes
        node.id = eEnum.name;
        node.layout = 'vbox';
        node.args = ArgsUtil.cornerRadius(5);
        node.cssClasses = ['ecore-enum'];

        // Add header compartment with enum name
        const headerCompartment = new GCompartment();
        headerCompartment.id = `${eEnum.name}_header`;
        headerCompartment.type = 'comp:header';
        headerCompartment.layout = 'hbox';
        headerCompartment.size = { width: 200, height: 30 }; // Explicit size
        headerCompartment.children.push(this.createEnumNameLabel(eEnum));

        node.children.push(headerCompartment);

        // Add literals compartment
        if (eEnum.eLiterals.length > 0) {
            const literalsCompartment = new GCompartment();
            literalsCompartment.id = `${eEnum.name}_literals`;
            literalsCompartment.type = 'comp:attributes';
            literalsCompartment.layout = 'vbox';
            literalsCompartment.size = { width: 200, height: 50 }; // Explicit size
            literalsCompartment.children.push(this.createEnumLiteralsLabel(eEnum));

            node.children.push(literalsCompartment);
        }

        return node;
    }

    private createClassNameLabel(eClass: EClass): GLabel {
        let labelText = eClass.name;

        // Add stereotypes for different class types
        if (eClass.interface) {
            labelText = `<<interface>> ${eClass.name}`;
        } else if (eClass.abstract) {
            labelText = `<<abstract>> ${eClass.name}`;
        }

        const label = new GLabel();
        label.type = 'label:heading';
        label.id = `${eClass.name}_classname`;
        label.text = labelText;
        return label;
    }

    private createAttributesLabel(eClass: EClass): GLabel {
        const attributesText = eClass.eAttributes
            .map(attr => {
                const typeName = this.getTypeName(attr.eType);
                const multiplicity = this.getMultiplicityString(attr.lowerBound, attr.upperBound);
                return `- ${attr.name}: ${typeName}${multiplicity}`;
            })
            .join('\n');

        const label = new GLabel();
        label.type = 'label:text';
        label.id = `${eClass.name}_attributes_label`;
        label.text = attributesText;
        return label;
    }

    private createReferencesLabel(eClass: EClass): GLabel {
        const referencesText = eClass.eReferences
            .map(ref => {
                const typeName = this.getTypeName(ref.eType);
                const containment = ref.containment ? ' (containment)' : '';
                const multiplicity = this.getMultiplicityString(ref.lowerBound, ref.upperBound);
                return `- ${ref.name}: ${typeName}${multiplicity}${containment}`;
            })
            .join('\n');

        const label = new GLabel();
        label.type = 'label:text';
        label.id = `${eClass.name}_references_label`;
        label.text = referencesText;
        return label;
    }

    private createDataTypeNameLabel(eDataType: EDataType): GLabel {
        const label = new GLabel();
        label.type = 'label:heading';
        label.id = `${eDataType.name}_datatypename`;
        label.text = `<<datatype>> ${eDataType.name}`;
        return label;
    }

    private createInstanceClassNameLabel(eDataType: EDataType): GLabel {
        const label = new GLabel();
        label.type = 'label:text';
        label.id = `${eDataType.name}_instanceclassname`;
        label.text = `instanceClassName: ${eDataType.instanceClassName}`;
        return label;
    }

    private createEnumNameLabel(eEnum: EEnum): GLabel {
        const label = new GLabel();
        label.type = 'label:heading';
        label.id = `${eEnum.name}_enumname`;
        label.text = `<<enumeration>> ${eEnum.name}`;
        return label;
    }

    private createEnumLiteralsLabel(eEnum: EEnum): GLabel {
        const literalsText = eEnum.eLiterals
            .map(literal => `${literal.name} = ${literal.value}`)
            .join('\n');

        const label = new GLabel();
        label.type = 'label:text';
        label.id = `${eEnum.name}_literals_label`;
        label.text = literalsText;
        return label;
    }

    private createEdgesFromEReferences(root: GModelRoot, ecoreModel: EcoreModel): void {
        console.log('createEdgesFromEReferences() - Starting edge creation');
        let edgeCount = 0;

        ecoreModel.ePackages.forEach(pkg => {
            console.log(`Processing package: ${pkg.name}`);
            pkg.eClassifiers.forEach(classifier => {
                console.log(`Processing classifier: ${classifier.name}, isEClass: ${isEClass(classifier)}`);
                if (isEClass(classifier)) {
                    console.log(`Processing class ${classifier.name} with ${classifier.eReferences.length} references`);
                    classifier.eReferences.forEach(eRef => {
                        const edge = this.createEdgeForEReference(eRef, classifier);
                        if (edge) {
                            root.children.push(edge);
                            edgeCount++;
                            console.log(`Created ${edge.type} edge: ${edge.sourceId} -> ${edge.targetId}`);
                        }
                    });
                }
            });
        });

        console.log(`createEdgesFromEReferences() - Created ${edgeCount} reference edges`);
    }

    private createEdgeForEReference(eRef: EReference, sourceClass: EClass): GEdge | null {
        const edge = new GEdge();

        // Determine edge type based on containment
        if (eRef.containment) {
            edge.type = 'edge:ecore-containment';
            edge.cssClasses = ['ecore-containment'];
        } else {
            edge.type = 'edge:ecore-reference';
            edge.cssClasses = ['ecore-reference'];
        }

        edge.id = `${sourceClass.name}_${eRef.name}`;
        edge.sourceId = sourceClass.name;
        edge.targetId = this.getTypeName(eRef.eType);

        console.log(`Creating edge: ${edge.sourceId} -> ${edge.targetId} (${edge.type})`);
        console.log(`eRef.eType:`, eRef.eType);
        console.log(`Resolved targetId: ${edge.targetId}`);

        // Add label with reference name and multiplicity
        const multiplicity = this.getMultiplicityString(eRef.lowerBound, eRef.upperBound);
        const labelText = multiplicity !== '[1]' ? `${multiplicity} ${eRef.name}` : eRef.name;

        console.log(`Creating edge label: "${labelText}" for edge ${edge.id}`);

        const label = new GLabel();
        label.type = 'label:text';
        label.id = `${edge.id}_label`;
        label.text = labelText;

        edge.children.push(label);

        return edge;
    }

    /**
     * Creates edges for inheritance relationships (eSuperTypes)
     */
    private createEdgesFromInheritance(root: GModelRoot, ecoreModel: EcoreModel): void {
        console.log('createEdgesFromInheritance() - Starting inheritance edge creation');
        let inheritanceCount = 0;

        ecoreModel.ePackages.forEach(pkg => {
            console.log(`Processing package for inheritance: ${pkg.name}`);
            pkg.eClassifiers.forEach(classifier => {
                console.log(`Processing classifier for inheritance: ${classifier.name}, isEClass: ${isEClass(classifier)}`);
                if (isEClass(classifier) && classifier.eSuperTypes && classifier.eSuperTypes.length > 0) {
                    console.log(`Processing class ${classifier.name} with ${classifier.eSuperTypes.length} super types`);
                    classifier.eSuperTypes.forEach(superType => {
                        const edge = this.createInheritanceEdge(classifier, superType);
                        if (edge) {
                            root.children.push(edge);
                            inheritanceCount++;
                            console.log(`Created inheritance edge: ${edge.sourceId} -> ${edge.targetId}`);
                        }
                    });
                }
            });
        });

        console.log(`createEdgesFromInheritance() - Created ${inheritanceCount} inheritance edges`);
    }

    /**
     * Creates an inheritance edge between a subclass and its superclass
     */
    private createInheritanceEdge(subClass: EClass, superClass: EClass): GEdge | null {
        if (!superClass.name) {
            console.log(`createInheritanceEdge: No superClass name for ${subClass.name}`);
            return null;
        }

        const edge = new GEdge();
        edge.type = 'edge:ecore-inheritance';
        edge.id = `${subClass.name}_inherits_${this.getTypeName(superClass)}`;
        edge.sourceId = subClass.name;
        edge.targetId = this.getTypeName(superClass);
        edge.cssClasses = ['ecore-inheritance'];

        console.log(`Created inheritance edge: ${edge.sourceId} -> ${edge.targetId} (type: ${edge.type})`);

        return edge;
    }

    private getTypeName(eType: any): string {
        if (typeof eType === 'string') {
            return eType;
        }
        if (eType && typeof eType === 'object') {
            return eType.name || 'Unknown';
        }
        return 'Unknown';
    }

    private getMultiplicityString(lowerBound: number, upperBound: number): string {
        if (lowerBound === upperBound) {
            return `[${lowerBound}]`;
        } else if (upperBound === -1) {
            return `[${lowerBound}..*]`;
        } else {
            return `[${lowerBound}..${upperBound}]`;
        }
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

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
import { EcoreModel, isEClass, isEDataType, isEEnum, isEAttribute, isEReference } from './ecore-types';
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
     * Creates a metamodel visualization directly from an EcoreModel (for testing)
     */
    createMetamodelFromModel(ecoreModel: EcoreModel): GModelRoot {
        console.log('createMetamodelFromModel() - ecoreModel:', ecoreModel);

        const root = new GModelRoot();
        root.type = 'graph';
        root.id = 'sprotty';
        root.revision = 0;

        this.createNodesFromEClasses(root, ecoreModel);
        this.createEdgesFromEReferences(root, ecoreModel);
        this.createEdgesFromInheritance(root, ecoreModel);

        console.log('Created metamodel visualization with root:', root);
        console.log(`Total children in root: ${root.children.length}`);

        return root;
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
            (pkg.get('eClassifiers') as any).forEach((classifier: any) => {
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

    private createNodeForEClass(eClass: any): GNode {
        const node = new GNode();
        node.type = 'ecore:class'; // Use consistent type for all EClass nodes
        node.id = eClass.get('name');
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
        if (eClass.get('abstract')) {
            cssClasses.push('abstract');
        }
        if (eClass.get('interface')) {
            cssClasses.push('interface');
        }
        node.cssClasses = cssClasses;

        // Add header compartment with class name
        const headerCompartment = new GCompartment();
        headerCompartment.id = `${eClass.get('name')}_header`;
        headerCompartment.type = 'comp:header';
        headerCompartment.layout = 'hbox';
        headerCompartment.layoutOptions = { paddingTop: 8, paddingBottom: 8, paddingLeft: 10, paddingRight: 10 };
        headerCompartment.size = { width: 200, height: 30 }; // Explicit size
        headerCompartment.children.push(this.createClassNameLabel(eClass));

        node.children.push(headerCompartment);

        // Add attributes compartment (only if there are attributes)
        const attributes = (eClass.get('eStructuralFeatures') as any).filter(isEAttribute);
        if (attributes.length > 0) {
            const attributesCompartment = new GCompartment();
            attributesCompartment.id = `${eClass.get('name')}_attributes`;
            attributesCompartment.type = 'comp:attributes';
            attributesCompartment.layout = 'vbox';
            attributesCompartment.layoutOptions = { paddingTop: 8, paddingBottom: 8, paddingLeft: 10, paddingRight: 10 };
            attributesCompartment.size = { width: 200, height: 50 };
            attributesCompartment.children.push(this.createAttributesLabel(eClass));

            node.children.push(attributesCompartment);
        }

        // References compartment removed - only showing attributes

        return node;
    }

    private createNodeForEDataType(eDataType: any): GNode {
        const node = new GNode();
        node.type = 'ecore:datatype'; // Use specific type for EDataType nodes
        node.id = eDataType.get('name');
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

    private createNodeForEEnum(eEnum: any): GNode {
        const node = new GNode();
        node.type = 'ecore:enum'; // Use specific type for EEnum nodes
        node.id = eEnum.get('name');
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

    private createClassNameLabel(eClass: any): GLabel {
        const className = eClass.get('name');
        console.log('Creating class name label for class:', className);
        
        let labelText = className;

        // Add stereotypes for different class types
        const isInterface = eClass.get('interface');
        const isAbstract = eClass.get('abstract');
        
        if (isInterface && isAbstract) {
            labelText = `<<interface>><<abstract>> ${className}`;
        } else if (isInterface) {
            labelText = `<<interface>> ${className}`;
        } else if (isAbstract) {
            labelText = `<<abstract>> ${className}`;
        }

        const label = new GLabel();
        label.type = 'label:heading';
        label.id = `${className}_classname`;
        label.text = labelText;
        
        console.log('Created label with ID:', label.id, 'and text:', label.text);
        return label;
    }

    private createAttributesLabel(eClass: any): GLabel {
        const attributes = (eClass.get('eStructuralFeatures') as any).filter(isEAttribute);
        const attributesText = attributes
            .map((attr: any) => {
                const typeName = this.getTypeName(attr.get('eType'));
                const multiplicity = this.getMultiplicityString(attr.get('lowerBound'), attr.get('upperBound'));
                return `${attr.get('name')} : ${typeName}${multiplicity}`;
            })
            .join('\n');

        const label = new GLabel();
        label.type = 'label:text';
        label.id = `${eClass.get('name')}_attributes_label`;
        label.text = attributesText;
        return label;
    }

    private createDataTypeNameLabel(eDataType: any): GLabel {
        const label = new GLabel();
        label.type = 'label:heading';
        label.id = `${eDataType.get('name')}_datatypename`;
        label.text = `<<datatype>> ${eDataType.get('name')}`;
        return label;
    }

    private createInstanceClassNameLabel(eDataType: any): GLabel {
        const label = new GLabel();
        label.type = 'label:text';
        label.id = `${eDataType.get('name')}_instanceclassname`;
        label.text = `instanceClassName: ${eDataType.get('instanceClassName')}`;
        return label;
    }

    private createEnumNameLabel(eEnum: any): GLabel {
        const label = new GLabel();
        label.type = 'label:heading';
        label.id = `${eEnum.get('name')}_enumname`;
        label.text = `<<enumeration>> ${eEnum.get('name')}`;
        return label;
    }

    private createEnumLiteralsLabel(eEnum: any): GLabel {
        const literalsText = (eEnum.get('eLiterals') as any)
            .map((literal: any) => `${literal.get('name')} = ${literal.get('value')}`)
            .join('\n');

        const label = new GLabel();
        label.type = 'label:text';
        label.id = `${eEnum.get('name')}_literals_label`;
        label.text = literalsText;
        return label;
    }

    private createEdgesFromEReferences(root: GModelRoot, ecoreModel: EcoreModel): void {
        let edgeCount = 0;

        console.log('createEdgesFromEReferences() - Starting edge creation');

        ecoreModel.ePackages.forEach(pkg => {
            // Handle both Ecore packages and JSON packages
            let classifiers: any[];
            let packageName: string;
            
            if (typeof pkg.get === 'function') {
                packageName = pkg.get('name');
                classifiers = pkg.get('eClassifiers');
            } else {
                packageName = pkg.name;
                classifiers = pkg.eClassifiers;
            }
            
            console.log(`Processing package: ${packageName} with ${classifiers.length} classifiers`);
            
            classifiers.forEach((classifier: any) => {
                if (isEClass(classifier)) {
                    let className: string;
                    if (typeof classifier.get === 'function') {
                        className = classifier.get('name');
                    } else {
                        className = classifier.name;
                    }
                    
                    // Handle both Ecore objects and JSON objects
                    let references: any[];
                    if (typeof classifier.get === 'function') {
                        const allFeatures = classifier.get('eStructuralFeatures') || [];
                        references = allFeatures.filter(isEReference);
                        console.log(`Class ${className} has ${allFeatures.length} structural features, ${references.length} are references`);
                    } else {
                        references = (classifier.eReferences || []).filter(isEReference);
                        console.log(`Class ${className} has ${references.length} references`);
                    }
                    
                    references.forEach((eRef: any) => {
                        const refName = typeof eRef.get === 'function' ? eRef.get('name') : eRef.name;
                        const containment = typeof eRef.get === 'function' ? eRef.get('containment') : eRef.containment;
                        console.log(`Processing reference: ${refName} (containment: ${containment})`);
                        
                        const edge = this.createEdgeForEReference(eRef, classifier);
                        if (edge) {
                            root.children.push(edge);
                            edgeCount++;
                            console.log(`Created edge: ${edge.sourceId} -> ${edge.targetId} (${edge.type})`);
                        }
                    });
                }
            });
        });

        console.log(`createEdgesFromEReferences() - Created ${edgeCount} reference edges`);
    }

    private createEdgeForEReference(eRef: any, sourceClass: any): GEdge | null {
        const edge = new GEdge();

        // Get values - handle both Ecore objects and JSON objects
        const containment = typeof eRef.get === 'function' ? eRef.get('containment') : eRef.containment;
        const refName = typeof eRef.get === 'function' ? eRef.get('name') : eRef.name;
        const eType = typeof eRef.get === 'function' ? eRef.get('eType') : eRef.eType;
        const lowerBound = typeof eRef.get === 'function' ? eRef.get('lowerBound') : eRef.lowerBound;
        const upperBound = typeof eRef.get === 'function' ? eRef.get('upperBound') : eRef.upperBound;
        const sourceClassName = typeof sourceClass.get === 'function' ? sourceClass.get('name') : sourceClass.name;

        // Determine edge type based on containment
        if (containment) {
            edge.type = 'edge:ecore-containment';
            edge.cssClasses = ['ecore-containment'];
        } else {
            edge.type = 'edge:ecore-reference';
            edge.cssClasses = ['ecore-reference'];
        }

        edge.id = `${sourceClassName}_${refName}`;
        edge.sourceId = sourceClassName;
        edge.targetId = this.getTypeName(eType);

        // Add label with reference name and multiplicity
        const multiplicity = this.getMultiplicityString(lowerBound, upperBound);
        const labelText = multiplicity !== '[1]' ? `${multiplicity} ${refName}` : refName;

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
        let inheritanceCount = 0;

        ecoreModel.ePackages.forEach(pkg => {
            // Handle both Ecore packages and JSON packages
            let classifiers: any[];
            
            if (typeof pkg.get === 'function') {
                classifiers = pkg.get('eClassifiers');
            } else {
                classifiers = pkg.eClassifiers;
            }
            
            
            classifiers.forEach((classifier: any) => {
                if (isEClass(classifier)) {
                    // Get superTypes - handle both Ecore objects and JSON objects
                    let superTypes: any;
                    if (typeof classifier.get === 'function') {
                        superTypes = classifier.get('eSuperTypes');
                    } else {
                        superTypes = classifier.eSuperTypes;
                    }
                    
                    // Handle both Ecore collections (with .size() method) and plain arrays
                    let superTypesArray: any[] = [];
                    if (superTypes) {
                        if (typeof superTypes.size === 'function') {
                            // Ecore collection - iterate through it properly
                            if (superTypes.size() > 0) {
                                superTypesArray = [];
                                // Use forEach if available, otherwise try Array.from
                                if (typeof superTypes.forEach === 'function') {
                                    superTypes.forEach((superType: any) => {
                                        superTypesArray.push(superType);
                                    });
                                } else {
                                    // Fallback to Array.from
                                    superTypesArray = Array.from(superTypes);
                                }
                            }
                        } else if (Array.isArray(superTypes)) {
                            // Plain array (our custom objects)
                            superTypesArray = superTypes;
                        }
                    }
                    
                    if (superTypesArray.length > 0) {
                        // Filter out any invalid superType objects
                        const validSuperTypes = superTypesArray.filter((superType: any) => {
                            if (!superType) return false;
                            
                            // Handle Ecore objects (with .get() method)
                            if (typeof superType.get === 'function') {
                                return superType.get('name');
                            }
                            
                            // Handle plain JSON objects (from loaded metamodels)
                            if (typeof superType.name === 'string') {
                                return superType.name;
                            }
                            
                            return false;
                        });
                        
                        validSuperTypes.forEach((superType: any) => {
                            const edge = this.createInheritanceEdge(classifier, superType);
                            if (edge) {
                                root.children.push(edge);
                                inheritanceCount++;
                            }
                        });
                    }
                }
            });
        });

    }

    /**
     * Creates an inheritance edge between a subclass and its superclass
     */
    private createInheritanceEdge(subClass: any, superClass: any): GEdge | null {
        // Validate that both subClass and superClass exist
        if (!subClass || !superClass) {
            return null;
        }

        // Get class names - handle both Ecore objects and plain JSON objects
        let subClassName: string;
        let superClassName: string;

        if (typeof subClass.get === 'function') {
            subClassName = subClass.get('name');
        } else if (typeof subClass.name === 'string') {
            subClassName = subClass.name;
        } else {
            return null;
        }

        if (typeof superClass.get === 'function') {
            superClassName = superClass.get('name');
        } else if (typeof superClass.name === 'string') {
            superClassName = superClass.name;
        } else {
            return null;
        }

        if (!subClassName || !superClassName) {
            return null;
        }

        const edge = new GEdge();
        edge.type = 'edge:ecore-inheritance';
        edge.id = `${subClassName}_inherits_${superClassName}`;
        edge.sourceId = subClassName;
        edge.targetId = superClassName;
        edge.cssClasses = ['ecore-inheritance'];


        return edge;
    }

    private getTypeName(eType: any): string {
        if (typeof eType === 'string') {
            return eType;
        }
        if (eType && typeof eType === 'object') {
            // For ecore-ts instances, use .get('name')
            if (eType.get && typeof eType.get === 'function') {
                return eType.get('name') || 'Unknown';
            }
            // Fallback for plain objects
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

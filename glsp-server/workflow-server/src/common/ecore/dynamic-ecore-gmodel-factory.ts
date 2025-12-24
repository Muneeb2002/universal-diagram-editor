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
import { VisualConfigurationStorage } from './visual-configuration-storage';
import { ShapeMappingStorage, ShapeMapping } from './shape-mapping-storage';
import { EcoreInstance, InstanceModel } from './instance-model-types';

@injectable()
export class DynamicEcoreGModelFactory implements GModelFactory {
    @inject(ModelState)
    protected modelState: ModelState;

    @inject(MetamodelRegistry)
    protected metamodelRegistry: MetamodelRegistry;

    @inject(InstanceModelStorage)
    protected instanceStorage: InstanceModelStorage;

    @inject(VisualConfigurationStorage)
    protected visualConfigStorage: VisualConfigurationStorage;

    @inject(ShapeMappingStorage)
    protected shapeMappingStorage: ShapeMappingStorage;

    createModel(): void {
        const modelType = this.modelState.get('modelType') as string;
        const viewMode = this.modelState.get('viewMode') as string || 'metamodel';

        // Clear any existing model to prevent duplicate labels
        this.modelState.set('gmodel', undefined);

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
        const root = new GModelRoot();
        root.type = 'graph';
        root.id = 'sprotty';
        root.revision = 0;

        this.createNodesFromEClasses(root, ecoreModel);
        this.createEdgesFromEReferences(root, ecoreModel);
        this.createEdgesFromInheritance(root, ecoreModel);

        return root;
    }

    /**
     * Creates visualization of the Ecore metamodel (class diagram view)
     */
    private createMetamodelVisualization(): void {
        const ecoreModel = this.modelState.get('ecoreModel') as EcoreModel;
        if (!ecoreModel) {
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

        this.modelState.set('gmodel', root);
    }

    /**
     * Creates visualization of instance model (object diagram view)
     */
    private createInstanceModel(): void {
        const root = new GModelRoot();
        root.type = 'graph';
        root.id = 'sprotty';
        root.revision = 0;

        const instances = this.instanceStorage.getAllInstances();
        const visibleInstances = instances.filter(instance => !(instance as any).hidden);
        const arcInstances = visibleInstances.filter(instance => this.isArcInstance(instance));
        const nodeInstances = visibleInstances.filter(instance => !this.isArcInstance(instance));

        // Only add root instances directly to root (contained instances will be nested in their parents)
        const instanceModel = this.instanceStorage.getActiveInstanceModel();
        const rootInstances = nodeInstances.filter(instance => {
            return instanceModel && instanceModel.rootInstances.has(instance.id);
        });

        // Also add visible instances whose parents are hidden (they should be rendered as root instances)
        const instancesWithHiddenParents = nodeInstances.filter(instance => {
            if (instanceModel && instanceModel.rootInstances.has(instance.id)) {
                return false; // Already a root instance
            }
            const parent = this.findParentInstance(instance, instanceModel);
            return parent && (parent as any).hidden; // Parent exists but is hidden
        });

        // Combine root instances and instances with hidden parents
        const instancesToRender = [...rootInstances, ...instancesWithHiddenParents];

        instancesToRender.forEach(instance => {
            const node = this.createNodeForInstance(instance);
            root.children.push(node);
        });

        arcInstances.forEach(instance => {
            const arcEdge = this.createEdgeForArcInstance(instance);
            if (arcEdge) {
                root.children.push(arcEdge);
            }
        });

        this.modelState.set('gmodel', root);
    }

    private createDefaultModel(): void {
        const root = new GModelRoot();
        root.type = 'graph';
        root.id = 'sprotty';
        root.revision = 0; // Initialize revision
        this.modelState.set('gmodel', root);
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
            const classifiersRaw = this.getProp(pkg, 'eClassifiers') as any;
            // Convert to array to ensure we iterate over all classifiers including newly added ones
            const classifiers = this.toArray(classifiersRaw);
            
            classifiers.forEach((classifier: any) => {
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
        const className = this.getProp<string>(eClass, 'name') ?? 'EClass';
        node.type = 'ecore:class'; // Use consistent type for all EClass nodes
        node.id = className;
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
        if (this.getProp<boolean>(eClass, 'abstract')) {
            cssClasses.push('abstract');
        }
        if (this.getProp<boolean>(eClass, 'interface')) {
            cssClasses.push('interface');
        }
        node.cssClasses = cssClasses;

        // Add header compartment with class name
        const headerCompartment = new GCompartment();
        headerCompartment.id = `${className}_header`;
        headerCompartment.type = 'comp:header';
        headerCompartment.layout = 'hbox';
        headerCompartment.layoutOptions = { paddingTop: 8, paddingBottom: 8, paddingLeft: 10, paddingRight: 10 };
        headerCompartment.size = { width: 200, height: 30 }; // Explicit size
        headerCompartment.children.push(this.createClassNameLabel(eClass));

        node.children.push(headerCompartment);

        // Add attributes compartment (only if there are attributes)
        const structuralFeatures = this.getProp<any[]>(eClass, 'eStructuralFeatures') ?? [];
        const attributes = (structuralFeatures as any[]).filter(isEAttribute);
        if (attributes.length > 0) {
            const attributesCompartment = new GCompartment();
            attributesCompartment.id = `${className}_attributes`;
            attributesCompartment.type = 'comp:attributes';
            attributesCompartment.layout = 'vbox';
            attributesCompartment.layoutOptions = { paddingTop: 8, paddingBottom: 8, paddingLeft: 10, paddingRight: 10 };
            attributesCompartment.size = { width: 200, height: 50 };
            attributes.forEach((attr: any, index: number) => {
                attributesCompartment.children.push(this.createAttributeLabel(eClass, attr, index));
            });

            node.children.push(attributesCompartment);
        }

        // References compartment removed - only showing attributes

        return node;
    }

    private createNodeForEDataType(eDataType: any): GNode {
        const node = new GNode();
        const dataTypeName = this.getProp<string>(eDataType, 'name') ?? 'EDataType';
        node.type = 'ecore:datatype'; // Use specific type for EDataType nodes
        node.id = dataTypeName;
        node.layout = 'vbox';
        node.args = ArgsUtil.cornerRadius(5);
        node.cssClasses = ['ecore-datatype'];

        // Add header compartment with data type name
        const headerCompartment = new GCompartment();
        headerCompartment.id = `${dataTypeName}_header`;
        headerCompartment.type = 'comp:header';
        headerCompartment.layout = 'hbox';
        headerCompartment.size = { width: 200, height: 30 }; // Explicit size
        headerCompartment.children.push(this.createDataTypeNameLabel(eDataType));

        node.children.push(headerCompartment);

        // Add instance class name compartment
        const instanceClassCompartment = new GCompartment();
        instanceClassCompartment.id = `${dataTypeName}_instanceclass`;
        instanceClassCompartment.type = 'comp:attributes';
        instanceClassCompartment.layout = 'vbox';
        instanceClassCompartment.size = { width: 200, height: 50 }; // Explicit size
        instanceClassCompartment.children.push(this.createInstanceClassNameLabel(eDataType));

        node.children.push(instanceClassCompartment);

        return node;
    }

    private createNodeForEEnum(eEnum: any): GNode {
        const node = new GNode();
        const enumName = this.getProp<string>(eEnum, 'name') ?? 'EEnum';
        node.type = 'ecore:enum'; // Use specific type for EEnum nodes
        node.id = enumName;
        node.layout = 'vbox';
        node.args = ArgsUtil.cornerRadius(5);
        node.cssClasses = ['ecore-enum'];

        // Add header compartment with enum name
        const headerCompartment = new GCompartment();
        headerCompartment.id = `${enumName}_header`;
        headerCompartment.type = 'comp:header';
        headerCompartment.layout = 'hbox';
        headerCompartment.size = { width: 200, height: 30 }; // Explicit size
        headerCompartment.children.push(this.createEnumNameLabel(eEnum));

        node.children.push(headerCompartment);

        // Add literals compartment
        const literals = this.toArray(this.getProp<any>(eEnum, 'eLiterals'));
        if (literals.length > 0) {
            const literalsCompartment = new GCompartment();
            literalsCompartment.id = `${enumName}_literals`;
            literalsCompartment.type = 'comp:attributes';
            literalsCompartment.layout = 'vbox';
            literalsCompartment.size = { width: 200, height: 50 }; // Explicit size
            
            literals.forEach((literal: any, index: number) => {
                literalsCompartment.children.push(this.createEnumLiteralLabel(enumName, literal, index));
            });

            node.children.push(literalsCompartment);
        }

        return node;
    }

    private createClassNameLabel(eClass: any): GLabel {
        const className = this.getProp<string>(eClass, 'name') ?? 'EClass';
        let labelText = className;

        // Add stereotypes for different class types
        const isInterface = !!this.getProp<boolean>(eClass, 'interface');
        const isAbstract = !!this.getProp<boolean>(eClass, 'abstract');
        
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
        
        return label;
    }

    private createAttributeLabel(eClass: any, attr: any, index: number): GLabel {
        const attrName = this.getProp<string>(attr, 'name') ?? `attribute_${index}`;
        const type = this.getProp(attr, 'eType');
        const typeName = this.getTypeName(type);
        const lowerBound = this.getProp<number | undefined>(attr, 'lowerBound');
        const upperBound = this.getProp<number | undefined>(attr, 'upperBound');
        const multiplicity = this.getMultiplicityString(lowerBound, upperBound);

        const label = new GLabel();
        label.type = 'label:text';
        const className = this.getProp<string>(eClass, 'name') ?? 'EClass';
        label.id = `${className}_attribute_${index}`;
        label.text = `${attrName} : ${typeName}${multiplicity}`;
        return label;
    }

    private createDataTypeNameLabel(eDataType: any): GLabel {
        const label = new GLabel();
        label.type = 'label:heading';
        const dataTypeName = this.getProp<string>(eDataType, 'name') ?? 'EDataType';
        label.id = `${dataTypeName}_datatypename`;
        label.text = `<<datatype>> ${dataTypeName}`;
        return label;
    }

    private createInstanceClassNameLabel(eDataType: any): GLabel {
        const label = new GLabel();
        label.type = 'label:text';
        const dataTypeName = this.getProp<string>(eDataType, 'name') ?? 'EDataType';
        const instanceClassName = this.getProp<string>(eDataType, 'instanceClassName') ?? '';
        label.id = `${dataTypeName}_instanceclassname`;
        label.text = `instanceClassName: ${instanceClassName}`;
        return label;
    }

    private createEnumNameLabel(eEnum: any): GLabel {
        const label = new GLabel();
        label.type = 'label:heading';
        const enumName = this.getProp<string>(eEnum, 'name') ?? 'EEnum';
        label.id = `${enumName}_enumname`;
        label.text = `<<enumeration>> ${enumName}`;
        return label;
    }

    private createEnumLiteralLabel(enumName: string, literal: any, index: number): GLabel {
        const literalName = this.getProp<string>(literal, 'name') ?? '';
        const literalValue = this.getProp<string | number>(literal, 'value');
        const literalText = literalValue !== undefined ? `${literalName} = ${literalValue}` : literalName;
        const label = new GLabel();
        label.type = 'label:text';
        label.id = `${enumName}_literal_${index}`;
        label.text = literalText;
        return label;
    }

    private createEdgesFromEReferences(root: GModelRoot, ecoreModel: EcoreModel): void {
        ecoreModel.ePackages.forEach(pkg => {
            const classifiers = this.toArray(this.getProp<any>(pkg, 'eClassifiers'));
            
            classifiers.forEach((classifier: any) => {
                if (isEClass(classifier)) {
                    // Handle both Ecore objects and JSON objects
                    const allFeatures = this.toArray(this.getProp<any>(classifier, 'eStructuralFeatures'));
                    let references = allFeatures.filter(isEReference);
                    if (references.length === 0) {
                        references = this.toArray(this.getProp<any>(classifier, 'eReferences')).filter(isEReference);
                    }

                    references.forEach((eRef: any) => {
                        const edge = this.createEdgeForEReference(eRef, classifier);
                        if (edge) {
                            root.children.push(edge);
                        }
                    });
                }
            });
        });
    }

    private createEdgeForEReference(eRef: any, sourceClass: any): GEdge | null {
        const edge = new GEdge();

        // Get values - handle both Ecore objects and JSON objects
        const containment = !!this.getProp<boolean>(eRef, 'containment');
        const refName = this.getProp<string>(eRef, 'name') ?? 'reference';
        const eType = this.getProp<any>(eRef, 'eType');
        const lowerBound = this.getProp<number | undefined>(eRef, 'lowerBound');
        const upperBound = this.getProp<number | undefined>(eRef, 'upperBound');
        const sourceClassName = this.getProp<string>(sourceClass, 'name') ?? 'EClass';
        
        // Check for eOpposite to determine if this is a bidirectional reference
        const eOpposite = this.getProp<any>(eRef, 'eOpposite');
        const isBidirectional = !!eOpposite;

        // Determine edge type based on containment and bidirectionality
        if (containment) {
            edge.type = 'edge:ecore-containment';
            edge.cssClasses = ['ecore-containment'];
        } else if (isBidirectional) {
            edge.type = 'edge:ecore-bidirectional';
            edge.cssClasses = ['ecore-reference', 'bidirectional'];
        } else {
            edge.type = 'edge:ecore-reference';
            edge.cssClasses = ['ecore-reference'];
        }

        edge.id = `${sourceClassName}_${refName}`;
        edge.sourceId = sourceClassName;
        edge.targetId = this.getTypeName(eType);

        // Add label with reference name and multiplicity
        const multiplicity = this.getMultiplicityString(lowerBound, upperBound);
        let labelText = multiplicity !== '[1]' ? `${multiplicity} ${refName}` : refName;

        const label = new GLabel();
        label.type = 'label:text';
        label.id = `${edge.id}_label`;
        label.text = labelText;
        
        // Set label placement for all edge types
        if (containment) {
            // Containment: near target, on the edge
            label.edgePlacement = {
                position: 0.95,
                offset: 12,
                side: 'on',
                rotate: false
            };
        } else if (isBidirectional) {
            // Bidirectional: near target, on the right side
            label.edgePlacement = {
                position: 0.95,
                offset: 12,
                side: 'right',
                rotate: false
            };
        } else {
            // Regular reference: near target (arrow side), on the right side
            label.edgePlacement = {
                position: 0.9,
                offset: 12,
                side: 'right',
                rotate: false
            };
        }

        edge.children.push(label);

        return edge;
    }

    /**
     * Creates edges for inheritance relationships (eSuperTypes)
     */
    private createEdgesFromInheritance(root: GModelRoot, ecoreModel: EcoreModel): void {
        ecoreModel.ePackages.forEach(pkg => {
            const classifiers = this.toArray(this.getProp<any>(pkg, 'eClassifiers'));
            
            classifiers.forEach((classifier: any) => {
                if (isEClass(classifier)) {
                    // Get superTypes - handle both Ecore objects and JSON objects
                    const superTypes = this.getProp<any>(classifier, 'eSuperTypes');
                    const superTypesArray = this.toArray(superTypes);
                    
                    if (superTypesArray.length > 0) {
                        // Filter out any invalid superType objects
                        const validSuperTypes = superTypesArray.filter((superType: any) => {
                            if (!superType) return false;
                            
                            const superTypeName = this.getProp<string>(superType, 'name');
                            return !!superTypeName;
                        });
                        
                        validSuperTypes.forEach((superType: any) => {
                            const edge = this.createInheritanceEdge(classifier, superType);
                            if (edge) {
                                root.children.push(edge);
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

        const subClassName = this.getProp<string>(subClass, 'name');
        const superClassName = this.getProp<string>(superClass, 'name');

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
        if (!eType) {
            return 'Unknown';
        }
        if (typeof eType === 'object') {
            // Check if it's an enum by checking for eClass structure
            const isEnum = isEEnum(eType) || 
                          (eType.eClass && eType.eClass.values && eType.eClass.values.name === 'EEnum');
            
            if (isEnum) {
                // Try multiple ways to get the enum name
                const enumName = this.getProp<string>(eType, 'name') || 
                                eType.name || 
                                (eType.get && eType.get('name'));
                return enumName || 'Unknown';
            }
            
            // For other types, try to get the name
            const typeName = this.getProp<string>(eType, 'name') || 
                            eType.name || 
                            (eType.get && eType.get('name'));
            
            // If the type name matches an enum name, it might be an enum that wasn't recognized
            if (typeName && !['EString', 'EInt', 'EBoolean', 'EDouble', 'EFloat', 'ELong', 'EDate', 'Unknown'].includes(typeName)) {
                // Check if it's actually an enum by checking the metamodel
                const metamodel = this.modelState.get('ecoreModel') as EcoreModel;
                if (metamodel && metamodel.ePackages) {
                    for (const pkg of metamodel.ePackages) {
                        const classifiers = this.getProp<any>(pkg, 'eClassifiers');
                        if (classifiers) {
                            let classifierArray: any[] = [];
                            if (Array.isArray(classifiers)) {
                                classifierArray = classifiers;
                            } else if (typeof classifiers.forEach === 'function') {
                                classifiers.forEach((item: any) => {
                                    if (item) classifierArray.push(item);
                                });
                            } else {
                                try {
                                    classifierArray = Array.from(classifiers);
                                } catch {
                                    classifierArray = [];
                                }
                            }
                            
                            for (const classifier of classifierArray) {
                                if (isEEnum(classifier)) {
                                    const name = this.getProp<string>(classifier, 'name') || classifier.name;
                                    if (name === typeName) {
                                        return typeName;
                                    }
                                }
                            }
                        }
                    }
                }
            }
            
            return typeName || 'Unknown';
        }
        return 'Unknown';
    }

    private getMultiplicityString(lowerBound?: number, upperBound?: number): string {
        const lb = lowerBound ?? 0;
        const ub = upperBound ?? lb;
        if (lb === ub) {
            return `[${lb}]`;
        } else if (ub === -1) {
            return `[${lb}..*]`;
        } else {
            return `[${lb}..${ub}]`;
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
        
        // Store eClassName and attributes in the node for client-side access
        (node as any).eClassName = instance.eClassName;
        // Store attributes as a plain object for easier access on client
        // Always create the attributes object, even if empty
        const attrsObj: any = {};
        if (instance.attributes && instance.attributes.size > 0) {
            instance.attributes.forEach((value, key) => {
                attrsObj[key] = value;
            });
        }
        // Make attributes enumerable so they get serialized
        Object.defineProperty(node, 'attributes', {
            value: attrsObj,
            enumerable: true,
            writable: true,
            configurable: true
        });

        // Get visual configuration for this class (needed for showAttributes/showReferences)
        const visualConfig = this.visualConfigStorage.getClassVisualConfiguration(instance.eClassName);
        
        // Check for submappings based on instance enum attribute values
        let shapeMapping: ShapeMapping | undefined;
        
        // First, check if instance has enum attributes with values
        if (instance.attributes && instance.attributes.size > 0) {
            // Get the class to check for enum attributes
            const eClass = this.metamodelRegistry.findEClass(instance.eClassName);
            if (eClass) {
                const structuralFeatures = this.getProp<any[]>(eClass, 'eStructuralFeatures') ?? [];
                const attributes = structuralFeatures.filter(isEAttribute);
                
                // Check each enum attribute to see if there's a submapping
                for (const attr of attributes) {
                    const attrName = this.getProp<string>(attr, 'name');
                    const eType = this.getProp<any>(attr, 'eType');
                    
                    if (attrName && eType && isEEnum(eType)) {
                        // This is an enum attribute, check if instance has a value for it
                        const enumValue = instance.attributes.get(attrName);
                        if (enumValue !== undefined && enumValue !== null) {
                            // Try to get submapping for this enum value
                            const subMapping = this.shapeMappingStorage.getMapping(
                                instance.eClassName,
                                attrName,
                                String(enumValue)
                            );
                            if (subMapping) {
                                shapeMapping = subMapping;
                                break; // Use the first matching submapping
                            }
                        }
                    }
                }
            }
        }
        
        // If no submapping found, try base mapping
        if (!shapeMapping) {
            shapeMapping = this.shapeMappingStorage.getMapping(instance.eClassName);
        }
        
        if (shapeMapping) {
            // Apply mapping-based visuals (this will override visual configuration styling)
            // First, ensure fill-none is removed before applying shape mapping
            node.cssClasses = node.cssClasses.filter(cls => cls !== 'fill-none');
            this.applyShapeMapping(node, shapeMapping);
            // Final check after applying shape mapping: remove fill-none if filled is not false
            const appliedShapeConfig = (node as any).shapeConfig;
            if (appliedShapeConfig && appliedShapeConfig.filled !== false) {
                node.cssClasses = node.cssClasses.filter(cls => cls !== 'fill-none');
            }
        } else {
            // Only apply visual configuration styling if no shape mapping exists
            this.applyVisualConfiguration(node, visualConfig);
        }
        // Note: visualConfig is still used below for showAttributes/showReferences

        // Set position if available
        if (instance.position) {
            node.position = { x: instance.position.x, y: instance.position.y };
        } else {
            // Auto-layout: position instances in a grid to prevent overlapping
            const gridSpacing = 250; // Space between instances
            const instancesPerRow = 3; // Number of instances per row
            const instanceCount = this.getInstanceCount();
            const row = Math.floor(instanceCount / instancesPerRow);
            const col = instanceCount % instancesPerRow;
            node.position = { 
                x: 50 + (col * gridSpacing), 
                y: 50 + (row * gridSpacing) 
            };
        }

        // Set size if available from instance data, ensure minimum size
        if (instance.size) {
            node.size = { 
                width: Math.max(120, instance.size.width || 120), 
                height: Math.max(60, instance.size.height || 60) 
            };
        } else {
            // Default size if not set
            node.size = { width: 120, height: 60 };
        }

        // Get EClass definition for structure
        const eClass = this.metamodelRegistry.findEClass(instance.eClassName);

        // Add name label above the node if instance has a 'name' attribute
        const nameValue = instance.attributes.get('name');
        if (nameValue !== undefined && nameValue !== null) {
            const nameLabel = new GLabel();
            nameLabel.type = 'label:text';
            nameLabel.id = `${instance.id}_name_label`;
            nameLabel.text = String(nameValue);
            nameLabel.position = { x: 0, y: -15 };
            node.children.push(nameLabel);
        }

        // Add attributes compartment with values (only if configured to show)
        // Exclude 'name' attribute from attributes compartment if it's shown as a label
        if (visualConfig.showAttributes && eClass && instance.attributes.size > 0) {
            const attributesCompartment = new GCompartment();
            attributesCompartment.id = `${instance.id}_attributes`;
            attributesCompartment.type = 'comp:attributes';
            attributesCompartment.layout = 'vbox';

            const attributesText: string[] = [];
            instance.attributes.forEach((value, attrName) => {
                // Skip 'name' attribute if it's being displayed as a label above the node
                if (attrName === 'name' && nameValue !== undefined && nameValue !== null) {
                    return;
                }
                const displayValue = value !== null && value !== undefined ? String(value) : '';
                attributesText.push(displayValue);
            });

            const attributesLabel = new GLabel();
            attributesLabel.type = 'label:text';
            attributesLabel.id = `${instance.id}_attributes_label`;
            attributesLabel.text = attributesText.join('\n');

            attributesCompartment.children.push(attributesLabel);
            node.children.push(attributesCompartment);
        }

        // Add references compartment (only if configured to show)
        if (visualConfig.showReferences && instance.references.size > 0) {
            const referencesCompartment = new GCompartment();
            referencesCompartment.id = `${instance.id}_references`;
            referencesCompartment.type = 'comp:references';
            referencesCompartment.layout = 'vbox';

            const referencesText: string[] = [];
            instance.references.forEach((value, refName) => {
                if (typeof value === 'string' && value) {
                    referencesText.push(`${refName} -> ${value}`);
                } else if (Array.isArray(value) && value.length > 0) {
                    referencesText.push(`${refName} -> [${value.join(', ')}]`);
                }
            });

            if (referencesText.length > 0) {
                const referencesLabel = new GLabel();
                referencesLabel.type = 'label:text';
                referencesLabel.id = `${instance.id}_references_label`;
                referencesLabel.text = referencesText.join('\n');

                referencesCompartment.children.push(referencesLabel);
                node.children.push(referencesCompartment);
            }
        }

        // Add nested child instances for containment references
        if (eClass) {
            const eReferences = this.getProp<any[]>(eClass, 'eReferences') ?? [];
            eReferences.forEach((eRef: any) => {
                const isContainment = this.getProp<boolean>(eRef, 'containment') === true;
                if (isContainment) {
                    const refName = this.getProp<string>(eRef, 'name');
                    if (refName) {
                        const childInstanceIds = this.getContainedInstanceIds(instance, refName);
                        childInstanceIds.forEach((childId, index) => {
                            const instanceModel = this.instanceStorage.getActiveInstanceModel();
                            const childInstance = instanceModel?.instances.get(childId);
                            if (childInstance && !childInstance.hidden) {
                                const childNode = this.createNodeForInstance(childInstance);
                                // Position child relative to parent (local coordinates)
                                const childOffsetX = 20; // Padding from parent edge
                                const childOffsetY = (index * 80) + 60; // Stack vertically with spacing
                                childNode.position = {
                                    x: childOffsetX,
                                    y: childOffsetY
                                };
                                // Respect the size set by applyShapeMapping (via customSize)
                                // Only enforce minimum if size is invalid or not set
                                const customSize = (childNode as any).customSize;
                                if (customSize && customSize.width > 0 && customSize.height > 0) {
                                    // Use the customSize from shapeConfig
                                    childNode.size = { 
                                        width: customSize.width, 
                                        height: customSize.height 
                                    };
                                } else if (!childNode.size || childNode.size.width <= 0 || childNode.size.height <= 0) {
                                    // Only set default if size is invalid
                                    childNode.size = { width: 100, height: 50 };
                                    (childNode as any).customSize = { width: 100, height: 50 };
                                } else {
                                    // Ensure minimum size, but use smaller minimums for nested nodes
                                    childNode.size = { 
                                        width: Math.max(20, childNode.size.width), 
                                        height: Math.max(20, childNode.size.height) 
                                    };
                                }
                                node.children.push(childNode);
                            }
                        });
                    }
                }
            });
        }

        // Final safety check: if node has shapeConfig with filled !== false, ensure fill-none is removed
        const finalShapeConfig = (node as any).shapeConfig;
        if (finalShapeConfig && finalShapeConfig.filled !== false) {
            node.cssClasses = node.cssClasses.filter(cls => cls !== 'fill-none');
        }

        return node;
    }

    private applyShapeMapping(node: GNode, mapping: ShapeMapping): void {
        const config = mapping.shapeConfig;
        if (!config) {
            return;
        }

        // Remove previous shape/color classes and fill-none class to avoid conflicts
        node.cssClasses = (node.cssClasses || []).filter(cls => 
            !cls.startsWith('shape-') && 
            !cls.startsWith('color-') && 
            cls !== 'fill-none'
        );

        node.cssClasses.push(`shape-${config.type}`);
        node.cssClasses.push(`color-mapped`);
        
        // Only add fill-none class if filled is explicitly false
        // If filled is true or undefined, fill-none should NOT be present
        // This ensures nodes with filled: true or filled: undefined will not have fill-none
        if (config.filled === false) {
            node.cssClasses.push('fill-none');
        }
        // Explicitly ensure fill-none is NOT in the array if filled is not false
        else {
            // Double-check: remove fill-none if it somehow got added
            const fillNoneIndex = node.cssClasses.indexOf('fill-none');
            if (fillNoneIndex !== -1) {
                node.cssClasses.splice(fillNoneIndex, 1);
            }
        }

        const shapeConfig = {
            type: config.type,
            width: config.width,
            height: config.height,
            color: config.color,
            fillColor: config.fillColor,
            filled: config.filled,
            lineThickness: config.lineThickness,
            lineStyle: config.lineStyle,
            svgContent: config.svgContent
        };
        
        // Ensure shapeConfig is enumerable so it gets serialized
        Object.defineProperty(node, 'shapeConfig', {
            value: shapeConfig,
            enumerable: true,
            writable: true,
            configurable: true
        });

        const width = config.width || node.size?.width || 150;
        const height = config.height || node.size?.height || 100;
        (node as any).customSize = { width, height };
        node.size = { width, height };
    }

    private applyShapeMappingToArc(edge: GEdge, mapping: ShapeMapping): void {
        const config = mapping.shapeConfig;
        if (!config) {
            return;
        }

        const shapeConfig = {
            type: config.type,
            width: config.width,
            height: config.height,
            color: config.color,
            fillColor: config.fillColor,
            lineThickness: config.lineThickness,
            lineStyle: config.lineStyle,
            arrowType: config.arrowType,
            svgContent: config.svgContent
        };
        
        // Explicitly set as enumerable property to ensure serialization
        Object.defineProperty(edge, 'shapeConfig', {
            value: shapeConfig,
            enumerable: true,
            writable: true,
            configurable: true
        });
    }

    /**
     * Gets the current count of instances for auto-layout positioning.
     * @returns The number of instances created so far
     */
    private getInstanceCount(): number {
        const instanceModel = this.instanceStorage.getOrCreateActiveInstanceModel();
        return instanceModel.instances.size;
    }

    /**
     * Applies visual configuration to a node.
     */
    private applyVisualConfiguration(node: GNode, visualConfig: any): void {
        // Add CSS classes for shape and color
        const shapeClass = `shape-${visualConfig.shape}`;
        const colorClass = `color-${visualConfig.color}`;
        
        node.cssClasses = [...(node.cssClasses || []), shapeClass, colorClass];
        
        // Apply fill toggle
        if (visualConfig.filled === false) {
            node.cssClasses.push('fill-none');
        }
        
        // Add border styling if specified
        if (visualConfig.border && visualConfig.border.style) {
            const borderClass = `border-${visualConfig.border.style}`;
            node.cssClasses.push(borderClass);
        }
        
    }

    private createEdgeForArcInstance(instance: EcoreInstance): GEdge | null {
        const { sourceId, targetId } = this.findArcEndpoints(instance);
        if (!sourceId || !targetId) {
            return null;
        }

        const edge = new GEdge();
        edge.type = 'edge:instance';
        edge.id = `${instance.id}_${sourceId}_to_${targetId}`;
        edge.sourceId = sourceId;
        edge.targetId = targetId;
        // Set router kind to ensure proper routing for both nested and non-nested nodes
        // GLSP's edge router will automatically calculate routing points, handling coordinate
        // transformation for nested nodes (local to global) and direct routing for root-level nodes
        // This ensures consistent routing behavior regardless of whether source/target are in containers
        edge.routerKind = 'manhattan';
        // Initialize empty routing points - GLSP client will calculate them automatically
        edge.routingPoints = [];
        // No CSS classes - styling comes from mapping model

        const mapping = this.shapeMappingStorage.getMapping(instance.eClassName);
        if (mapping) {
            this.applyShapeMappingToArc(edge, mapping);
        }

        // Add name label at the middle of the edge if instance has a 'name' attribute
        const nameValue = instance.attributes.get('name');
        if (nameValue !== undefined && nameValue !== null) {
            const nameLabel = new GLabel();
            nameLabel.type = 'label:text';
            nameLabel.id = `${edge.id}_name_label`;
            nameLabel.text = String(nameValue);
            nameLabel.edgePlacement = {
                position: 0.5,
                offset: 0,
                side: 'on',
                rotate: false
            };
            edge.children.push(nameLabel);
        }

        return edge;
    }

    private findArcEndpoints(instance: EcoreInstance): { sourceId?: string; targetId?: string } {
        let sourceId: string | undefined;
        let targetId: string | undefined;

        instance.references.forEach((value, refName) => {
            const normalized = refName.toLowerCase();
            if (normalized.includes('source')) {
                sourceId ??= this.extractReferenceValue(value);
            } else if (normalized.includes('target')) {
                targetId ??= this.extractReferenceValue(value);
            }
        });

        if ((!sourceId || !targetId) && instance.references.size > 0) {
            const entries = Array.from(instance.references.entries());
            entries.forEach(([name, value]) => {
                if (!sourceId) {
                    sourceId = this.extractReferenceValue(value);
                } else if (!targetId) {
                    targetId = this.extractReferenceValue(value);
                }
            });
        }

        return { sourceId, targetId };
    }

    private extractReferenceValue(value: string | string[] | undefined): string | undefined {
        if (!value) {
            return undefined;
        }
        if (Array.isArray(value)) {
            return value.length > 0 ? value[0] : undefined;
        }
        return value;
    }

    /**
     * Gets contained instance IDs from a containment reference.
     * @param instance The parent instance
     * @param referenceName The name of the containment reference
     * @returns Array of child instance IDs
     */
    private getContainedInstanceIds(instance: EcoreInstance, referenceName: string): string[] {
        const refValue = instance.references.get(referenceName);
        if (!refValue) {
            return [];
        }
        if (Array.isArray(refValue)) {
            return refValue;
        }
        return [refValue];
    }

    /**
     * Finds the parent instance that contains the given instance.
     * @param instance The child instance
     * @param instanceModel The instance model to search in
     * @returns The parent instance, or undefined if not found
     */
    private findParentInstance(instance: EcoreInstance, instanceModel: InstanceModel | undefined): EcoreInstance | undefined {
        if (!instanceModel) {
            return undefined;
        }

        // Search through all instances to find which one contains this instance
        for (const [, parentInstance] of instanceModel.instances.entries()) {
            if (!parentInstance.references) {
                continue;
            }

            // Check all containment references of the parent
            for (const [, refValue] of parentInstance.references.entries()) {
                // Check if this reference contains our instance
                if (Array.isArray(refValue)) {
                    if (refValue.includes(instance.id)) {
                        return parentInstance;
                    }
                } else if (refValue === instance.id) {
                    return parentInstance;
                }
            }
        }

        return undefined;
    }

    private isArcInstance(instance: EcoreInstance): boolean {
        const className = instance.eClassName;
        if (!className) {
            return false;
        }
        if (className.toLowerCase() === 'arc') {
            return true;
        }

        const eClass = this.metamodelRegistry.findEClass(className);
        if (!eClass) {
            return false;
        }

        const superTypes = this.toArray(this.getProp<any>(eClass, 'eSuperTypes'));
        return superTypes.some(superType => {
            const name = this.getProp<string>(superType, 'name');
            return name?.toLowerCase() === 'arc';
        });
    }

    private toArray(collection: any): any[] {
        if (!collection) {
            return [];
        }
        if (Array.isArray(collection)) {
            return collection;
        }
        if (typeof collection.toArray === 'function') {
            return collection.toArray();
        }
        const result: any[] = [];
        if (typeof collection.forEach === 'function') {
            collection.forEach((item: any) => result.push(item));
            return result;
        }
        if (typeof collection.length === 'number') {
            return Array.from(collection);
        }
        return result;
    }

    private getProp<T>(obj: any, key: string): T | undefined {
        if (obj == null) {
            return undefined;
        }
        if (typeof obj.get === 'function') {
            return obj.get(key);
        }
        return (obj as Record<string, unknown>)[key] as T | undefined;
    }
}

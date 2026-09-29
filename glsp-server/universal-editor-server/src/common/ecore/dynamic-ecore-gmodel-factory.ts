/**
 * @author Abigail Sotomayor <s205720@dtu.dk>
 */
import { injectable, inject } from 'inversify';
import {
    GModelFactory,
    GModelRoot,
    GNode,
    GEdge,
    GCompartment,
    GLabel,
    ModelState,
    ArgsUtil,
    GResizeLocation
} from '@eclipse-glsp/server';
import { EcoreModel, isEClass, isEDataType, isEEnum, isEAttribute, isEReference } from './ecore-types';
import { MetamodelRegistry } from './metamodel-registry';
import { InstanceModelStorage } from './instance-model-storage';
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

    @inject(ShapeMappingStorage)
    protected shapeMappingStorage: ShapeMappingStorage;

    createModel(): void {
        const modelType = this.modelState.get('modelType') as string;
        const viewMode = this.modelState.get('viewMode') as string || 'metamodel';

        this.modelState.set('gmodel', undefined);

        if (modelType === 'ecore') {
            if (viewMode === 'instance') {
                this.createInstanceModel();
            } else {
                this.createMetamodelVisualization();
            }
        } else {
            this.createDefaultModel();
        }
    }

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

    private createInstanceModel(): void {
        const root = new GModelRoot();
        root.type = 'graph';
        root.id = 'sprotty';
        root.revision = 0;

        const instances = this.instanceStorage.getAllInstances();
        const visibleInstances = instances.filter(instance => !(instance as any).hidden);
        const arcInstances = visibleInstances.filter(instance => this.isArcInstance(instance));
        const nodeInstances = visibleInstances.filter(instance => !this.isArcInstance(instance));

        const instanceModel = this.instanceStorage.getActiveInstanceModel();
        const rootInstances = nodeInstances.filter(instance => {
            return instanceModel && instanceModel.rootInstances.has(instance.id);
        });

        const instancesWithHiddenParents = nodeInstances.filter(instance => {
            if (instanceModel && instanceModel.rootInstances.has(instance.id)) {
                return false;
            }
            const parent = this.findParentInstance(instance, instanceModel);
            return parent && (parent as any).hidden; // Parent exists but is hidden
        });

        // SVG uses paint order for hit testing. Render larger nodes first so small nodes remain
        // visible and clickable when their bounds overlap a larger node.
        const instancesToRender = [...rootInstances, ...instancesWithHiddenParents]
            .sort((left, right) => this.getInstanceRenderArea(right) - this.getInstanceRenderArea(left));

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

    private getInstanceRenderArea(instance: EcoreInstance): number {
        const config = this.shapeMappingStorage.getMapping(instance.eClassName)?.shapeConfig;
        const width = instance.size?.width ?? config?.width ?? 120;
        const height = instance.size?.height ?? config?.height ?? 60;
        return Math.max(1, width) * Math.max(1, height);
    }

    private createDefaultModel(): void {
        const root = new GModelRoot();
        root.type = 'graph';
        root.id = 'sprotty';
        root.revision = 0;
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
            const classifiers = this.toArray(classifiersRaw);

            classifiers.forEach((classifier: any) => {
                const className = this.getProp<string>(classifier, 'name');

                const diagramPositions = this.modelState.get<Map<string, { position?: { x: number; y: number }; size?: { width: number; height: number } }>>('diagramPositions');
                let savedPosition: { x: number; y: number } | undefined;
                let savedSize: { width: number; height: number } | undefined;

                if (diagramPositions && className) {
                    const stored = diagramPositions.get(className);
                    if (stored) {
                        savedPosition = stored.position;
                        savedSize = stored.size;
                    }
                }


                let node: GNode | null = null;
                if (isEClass(classifier)) {
                    node = this.createNodeForEClass(classifier);
                } else if (isEDataType(classifier)) {
                    node = this.createNodeForEDataType(classifier);
                } else if (isEEnum(classifier)) {
                    node = this.createNodeForEEnum(classifier);
                }

                if (node) {
                    if (savedPosition) {
                        this.setNodePosition(node, savedPosition.x, savedPosition.y, savedSize?.width || nodeWidth, savedSize?.height || nodeHeight);
                    } else {
                        this.setNodePosition(node, x, y, nodeWidth, nodeHeight);
                        nodeCount++;
                        if (nodeCount % maxNodesPerRow === 0) {
                            x = 100;
                            y += nodeHeight + spacing;
                        } else {
                            x += nodeWidth + spacing;
                        }
                    }
                    root.children.push(node);
                }
            });
        });
    }

    private setNodePosition(node: GNode, x: number, y: number, width: number, height: number): void {
        node.position = { x, y };

        const finalWidth = Math.max(width, 150);
        const finalHeight = Math.max(height, 100);

        node.size = { width: finalWidth, height: finalHeight };
    }


    private createNodeForEClass(eClass: any): GNode {
        const node = new GNode();
        const className = this.getProp<string>(eClass, 'name') ?? 'EClass';
        node.type = 'ecore:class';
        node.id = className;
        node.layout = 'vbox';
        node.args = ArgsUtil.cornerRadius(5);

        node.args = {
            ...node.args,
            paddingTop: 10,
            paddingBottom: 10,
            paddingLeft: 10,
            paddingRight: 10
        };

        const cssClasses = ['ecore-class'];
        if (this.getProp<boolean>(eClass, 'abstract')) {
            cssClasses.push('abstract');
        }
        if (this.getProp<boolean>(eClass, 'interface')) {
            cssClasses.push('interface');
        }
        node.cssClasses = cssClasses;

        const headerCompartment = new GCompartment();
        headerCompartment.id = `${className}_header`;
        headerCompartment.type = 'comp:header';
        headerCompartment.layout = 'hbox';
        headerCompartment.layoutOptions = { paddingTop: 8, paddingBottom: 8, paddingLeft: 10, paddingRight: 10 };
        headerCompartment.size = { width: 200, height: 30 };
        headerCompartment.children.push(this.createClassNameLabel(eClass));

        node.children.push(headerCompartment);

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

        return node;
    }

    private createNodeForEDataType(eDataType: any): GNode {
        const node = new GNode();
        const dataTypeName = this.getProp<string>(eDataType, 'name') ?? 'EDataType';
        node.type = 'ecore:datatype';
        node.id = dataTypeName;
        node.layout = 'vbox';
        node.args = ArgsUtil.cornerRadius(5);
        node.cssClasses = ['ecore-datatype'];

        const headerCompartment = new GCompartment();
        headerCompartment.id = `${dataTypeName}_header`;
        headerCompartment.type = 'comp:header';
        headerCompartment.layout = 'hbox';
        headerCompartment.size = { width: 200, height: 30 };
        headerCompartment.children.push(this.createDataTypeNameLabel(eDataType));

        node.children.push(headerCompartment);

        const instanceClassCompartment = new GCompartment();
        instanceClassCompartment.id = `${dataTypeName}_instanceclass`;
        instanceClassCompartment.type = 'comp:attributes';
        instanceClassCompartment.layout = 'vbox';
        instanceClassCompartment.size = { width: 200, height: 50 };
        instanceClassCompartment.children.push(this.createInstanceClassNameLabel(eDataType));

        node.children.push(instanceClassCompartment);

        return node;
    }

    private createNodeForEEnum(eEnum: any): GNode {
        const node = new GNode();
        const enumName = this.getProp<string>(eEnum, 'name') ?? 'EEnum';
        node.type = 'ecore:enum';
        node.id = enumName;
        node.layout = 'vbox';
        node.args = ArgsUtil.cornerRadius(5);
        node.cssClasses = ['ecore-enum'];

        const headerCompartment = new GCompartment();
        headerCompartment.id = `${enumName}_header`;
        headerCompartment.type = 'comp:header';
        headerCompartment.layout = 'hbox';
        headerCompartment.size = { width: 200, height: 30 };
        headerCompartment.children.push(this.createEnumNameLabel(eEnum));

        node.children.push(headerCompartment);

        const literals = this.toArray(this.getProp<any>(eEnum, 'eLiterals'));
        if (literals.length > 0) {
            const literalsCompartment = new GCompartment();
            literalsCompartment.id = `${enumName}_literals`;
            literalsCompartment.type = 'comp:attributes';
            literalsCompartment.layout = 'vbox';
            literalsCompartment.size = { width: 200, height: 50 };

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

        const containment = !!this.getProp<boolean>(eRef, 'containment');
        const refName = this.getProp<string>(eRef, 'name') ?? 'reference';
        const eType = this.getProp<any>(eRef, 'eType');
        const lowerBound = this.getProp<number | undefined>(eRef, 'lowerBound');
        const upperBound = this.getProp<number | undefined>(eRef, 'upperBound');
        const sourceClassName = this.getProp<string>(sourceClass, 'name') ?? 'EClass';

        const eOpposite = this.getProp<any>(eRef, 'eOpposite');
        const isBidirectional = !!eOpposite;

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

        const multiplicity = this.getMultiplicityString(lowerBound, upperBound);
        let labelText = multiplicity !== '[1]' ? `${multiplicity} ${refName}` : refName;

        const label = new GLabel();
        label.type = 'label:text';
        label.id = `${edge.id}_label`;
        label.text = labelText;

        if (containment) {
            label.edgePlacement = {
                position: 0.95,
                offset: 12,
                side: 'on',
                rotate: false
            };
        } else if (isBidirectional) {
            label.edgePlacement = {
                position: 0.95,
                offset: 12,
                side: 'right',
                rotate: false
            };
        } else {
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

    private createEdgesFromInheritance(root: GModelRoot, ecoreModel: EcoreModel): void {
        ecoreModel.ePackages.forEach(pkg => {
            const classifiers = this.toArray(this.getProp<any>(pkg, 'eClassifiers'));

            classifiers.forEach((classifier: any) => {
                if (isEClass(classifier)) { 
                    const superTypes = this.getProp<any>(classifier, 'eSuperTypes');
                    const superTypesArray = this.toArray(superTypes);

                    if (superTypesArray.length > 0) {
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

    private createInheritanceEdge(subClass: any, superClass: any): GEdge | null {
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
            const isEnum = isEEnum(eType) ||
                (eType.eClass && eType.eClass.values && eType.eClass.values.name === 'EEnum');

            if (isEnum) {
                const enumName = this.getProp<string>(eType, 'name') ||
                    eType.name ||
                    (eType.get && eType.get('name'));
                return enumName || 'Unknown';
            }

            const typeName = this.getProp<string>(eType, 'name') ||
                eType.name ||
                (eType.get && eType.get('name'));

            if (typeName && !['EString', 'EInt', 'EBoolean', 'EDouble', 'EFloat', 'ELong', 'EDate', 'Unknown'].includes(typeName)) {
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

    private createNodeForInstance(instance: EcoreInstance): GNode {
        const node = new GNode();
        node.type = 'ecore:instance';
        node.id = instance.id;
        node.layout = 'vbox';
        node.args = ArgsUtil.cornerRadius(5);
        node.cssClasses = ['ecore-instance'];

        (node as any).eClassName = instance.eClassName;
        const attrsObj: any = {};
        if (instance.attributes && instance.attributes.size > 0) {
            instance.attributes.forEach((value, key) => {
                attrsObj[key] = value;
            });
        }
        Object.defineProperty(node, 'attributes', {
            value: attrsObj,
            enumerable: true,
            writable: true,
            configurable: true
        });

        let shapeMapping: ShapeMapping | undefined;

        if (instance.attributes && instance.attributes.size > 0) {
            const eClass = this.metamodelRegistry.findEClass(instance.eClassName);
            if (eClass) {
                const structuralFeatures = this.getProp<any[]>(eClass, 'eStructuralFeatures') ?? [];
                const attributes = structuralFeatures.filter(isEAttribute);

                for (const attr of attributes) {
                    const attrName = this.getProp<string>(attr, 'name');
                    const eType = this.getProp<any>(attr, 'eType');

                    if (attrName && eType && isEEnum(eType)) {
                        const enumValue = instance.attributes.get(attrName);
                        if (enumValue !== undefined && enumValue !== null) {
                            const subMapping = this.shapeMappingStorage.getMapping(
                                instance.eClassName,
                                attrName,
                                String(enumValue)
                            );
                            if (subMapping) {
                                shapeMapping = subMapping;
                                break;
                            }
                        }
                    }
                }
            }
        }

        if (!shapeMapping) {
            shapeMapping = this.shapeMappingStorage.getMapping(instance.eClassName);
        }

        if (shapeMapping) {
            node.cssClasses = node.cssClasses.filter(cls => cls !== 'fill-none');
            this.applyShapeMapping(node, shapeMapping, instance.componentBounds);
            const appliedShapeConfig = (node as any).shapeConfig;
            if (appliedShapeConfig && appliedShapeConfig.filled !== false) {
                node.cssClasses = node.cssClasses.filter(cls => cls !== 'fill-none');
            }
        } else {
            // TODO: change default visual configuration
            this.applyVisualConfiguration(node, {
                className: '',
                shape: 'rectangle',
                color: 'black',
                filled: false,
                showAttributes: true,
                showReferences: false
            });
        }


        if (instance.position) {
            node.position = { x: instance.position.x, y: instance.position.y };
        } else {
            const gridSpacing = 250;
            const instancesPerRow = 3;
            const instanceCount = this.getInstanceCount();
            const row = Math.floor(instanceCount / instancesPerRow);
            const col = instanceCount % instancesPerRow;
            node.position = {
                x: 50 + (col * gridSpacing),
                y: 50 + (row * gridSpacing)
            };
        }

        if (instance.size) {
            node.size = {
                width: Math.max(20, instance.size.width || 20),
                height: Math.max(20, instance.size.height || 20)
            };
        } else if (shapeMapping?.shapeConfig) {
            node.size = {
                width: shapeMapping.shapeConfig.width || 120,
                height: shapeMapping.shapeConfig.height || 60
            };
        } else {
            node.size = { width: 120, height: 60 };
        }

        // The client-side vbox layouter otherwise recomputes a newly created node from its
        // labels and can collapse a mapped composite below its graphical-model default size.
        node.layoutOptions = {
            ...(node.layoutOptions ?? {}),
            prefWidth: node.size.width,
            prefHeight: node.size.height
        };

        // The graphical model dimensions are defaults. A resized instance keeps its own size.
        (node as any).customSize = { width: node.size.width, height: node.size.height };

        const eClass = this.metamodelRegistry.findEClass(instance.eClassName);

        const nameValue = instance.attributes.get('name');
        if (nameValue !== undefined && nameValue !== null) {
            const nameLabel = new GLabel();
            nameLabel.type = 'label:text';
            nameLabel.id = `${instance.id}_name_label`;
            nameLabel.text = String(nameValue);
            nameLabel.position = { x: 0, y: -15 };
            node.children.push(nameLabel);
        }

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
                                if (childInstance.position) {
                                    childNode.position = {
                                        x: childInstance.position.x,
                                        y: childInstance.position.y
                                    };
                                } else {
                                    const childOffsetX = 20; // Padding from parent edge
                                    const childOffsetY = (index * 80) + 60;
                                    childNode.position = {
                                        x: childOffsetX,
                                        y: childOffsetY
                                    };
                                }
                                const customSize = (childNode as any).customSize;
                                if (customSize && customSize.width > 0 && customSize.height > 0) {
                                    childNode.size = {
                                        width: customSize.width,
                                        height: customSize.height
                                    };
                                } else if (!childNode.size || childNode.size.width <= 0 || childNode.size.height <= 0) {
                                    childNode.size = { width: 100, height: 50 };
                                    (childNode as any).customSize = { width: 100, height: 50 };
                                } else {
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

        const finalShapeConfig = (node as any).shapeConfig;
        if (finalShapeConfig && finalShapeConfig.filled !== false) {
            node.cssClasses = node.cssClasses.filter(cls => cls !== 'fill-none');
        }

        return node;
    }

    private applyShapeMapping(
        node: GNode,
        mapping: ShapeMapping,
        componentBounds?: Record<string, { x: number; y: number; width: number; height: number }>
    ): void {
        const config = mapping.shapeConfig;
        if (!config) {
            return;
        }

        node.cssClasses = (node.cssClasses || []).filter(cls =>
            !cls.startsWith('shape-') &&
            !cls.startsWith('color-') &&
            cls !== 'fill-none'
        );

        node.cssClasses.push(`shape-${config.type}`);
        node.cssClasses.push(`color-mapped`);

        if (config.filled === false) {
            node.cssClasses.push('fill-none');
        }
        else {
            const fillNoneIndex = node.cssClasses.indexOf('fill-none');
            if (fillNoneIndex !== -1) {
                node.cssClasses.splice(fillNoneIndex, 1);
            }
        }

        const shapeConfig = {
            type: config.type,
            width: config.width,
            height: config.height,
            resizeHorizontal: config.resizeHorizontal !== false,
            resizeVertical: config.resizeVertical !== false,
            color: config.color,
            fillColor: config.fillColor,
            filled: config.filled,
            lineThickness: config.lineThickness,
            lineStyle: config.lineStyle,
            svgContent: config.svgContent,
            components: config.components?.map((component, index) => ({
                ...component,
                ...(componentBounds?.[String(index)] ?? {})
            }))
        };

        Object.defineProperty(node, 'shapeConfig', {
            value: shapeConfig,
            enumerable: true,
            writable: true,
            configurable: true
        });

        const horizontal = config.resizeHorizontal !== false;
        const vertical = config.resizeVertical !== false;
        node.resizeLocations = [];
        if (horizontal) {
            node.resizeLocations.push(GResizeLocation.Left, GResizeLocation.Right);
        }
        if (vertical) {
            node.resizeLocations.push(GResizeLocation.Top, GResizeLocation.Bottom);
        }
        if (horizontal && vertical) {
            node.resizeLocations.push(
                GResizeLocation.TopLeft,
                GResizeLocation.TopRight,
                GResizeLocation.BottomRight,
                GResizeLocation.BottomLeft
            );
        }

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

        Object.defineProperty(edge, 'shapeConfig', {
            value: shapeConfig,
            enumerable: true,
            writable: true,
            configurable: true
        });
    }

    private getInstanceCount(): number {
        const instanceModel = this.instanceStorage.getOrCreateActiveInstanceModel();
        return instanceModel.instances.size;
    }

    private applyVisualConfiguration(node: GNode, visualConfig: any): void {
        const shapeClass = `shape-${visualConfig.shape}`;
        const colorClass = `color-${visualConfig.color}`;

        node.cssClasses = [...(node.cssClasses || []), shapeClass, colorClass];

        if (visualConfig.filled === false) {
            node.cssClasses.push('fill-none');
        }

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
        edge.routerKind = 'manhattan';
        edge.routingPoints = [];

        const mapping = this.shapeMappingStorage.getMapping(instance.eClassName);
        if (mapping) {
            this.applyShapeMappingToArc(edge, mapping);
        }

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
        const mapping = this.shapeMappingStorage.getMapping(instance.eClassName);
        const srcRefName = mapping?.sourceReferenceName;
        const tgtRefName = mapping?.targetReferenceName;

        if (srcRefName && tgtRefName && instance.references.has(srcRefName) && instance.references.has(tgtRefName)) {
            const sourceId = this.extractReferenceValue(instance.references.get(srcRefName));
            const targetId = this.extractReferenceValue(instance.references.get(tgtRefName));
            if (sourceId && targetId) {
                return { sourceId, targetId };
            }
        }

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

    private findParentInstance(instance: EcoreInstance, instanceModel: InstanceModel | undefined): EcoreInstance | undefined {
        if (!instanceModel) {
            return undefined;
        }

        for (const [, parentInstance] of instanceModel.instances.entries()) {
            if (!parentInstance.references) {
                continue;
            }

            for (const [, refValue] of parentInstance.references.entries()) {
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

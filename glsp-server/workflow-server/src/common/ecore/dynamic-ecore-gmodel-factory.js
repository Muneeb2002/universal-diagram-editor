"use strict";
/********************************************************************************
 * Copyright (c) 2024 Eclipse GLSP and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * SPDX-License-Identifier: EPL-2.0
 ********************************************************************************/
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __setFunctionName = (this && this.__setFunctionName) || function (f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DynamicEcoreGModelFactory = void 0;
var inversify_1 = require("inversify");
var server_1 = require("@eclipse-glsp/server");
var ecore_types_1 = require("./ecore-types");
var metamodel_registry_1 = require("./metamodel-registry");
var instance_model_storage_1 = require("./instance-model-storage");
var DynamicEcoreGModelFactory = function () {
    var _classDecorators = [(0, inversify_1.injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var _modelState_decorators;
    var _modelState_initializers = [];
    var _modelState_extraInitializers = [];
    var _metamodelRegistry_decorators;
    var _metamodelRegistry_initializers = [];
    var _metamodelRegistry_extraInitializers = [];
    var _instanceStorage_decorators;
    var _instanceStorage_initializers = [];
    var _instanceStorage_extraInitializers = [];
    var DynamicEcoreGModelFactory = _classThis = /** @class */ (function () {
        function DynamicEcoreGModelFactory_1() {
            this.modelState = __runInitializers(this, _modelState_initializers, void 0);
            this.metamodelRegistry = (__runInitializers(this, _modelState_extraInitializers), __runInitializers(this, _metamodelRegistry_initializers, void 0));
            this.instanceStorage = (__runInitializers(this, _metamodelRegistry_extraInitializers), __runInitializers(this, _instanceStorage_initializers, void 0));
            __runInitializers(this, _instanceStorage_extraInitializers);
        }
        DynamicEcoreGModelFactory_1.prototype.createModel = function () {
            var modelType = this.modelState.get('modelType');
            var viewMode = this.modelState.get('viewMode') || 'metamodel';
            console.log('DynamicEcoreGModelFactory.createModel() - modelType:', modelType, 'viewMode:', viewMode);
            if (modelType === 'ecore') {
                if (viewMode === 'instance') {
                    this.createInstanceModel();
                }
                else {
                    this.createMetamodelVisualization();
                }
            }
            else {
                // Create a default empty model if no specific type
                this.createDefaultModel();
            }
        };
        /**
         * Creates visualization of the Ecore metamodel (class diagram view)
         */
        DynamicEcoreGModelFactory_1.prototype.createMetamodelVisualization = function () {
            var ecoreModel = this.modelState.get('ecoreModel');
            console.log('createMetamodelVisualization() - ecoreModel:', ecoreModel);
            if (!ecoreModel) {
                console.log('No ecoreModel found, creating default model');
                this.createDefaultModel();
                return;
            }
            var root = new server_1.GModelRoot();
            root.type = 'graph';
            root.id = 'sprotty';
            root.revision = 0;
            this.createNodesFromEClasses(root, ecoreModel);
            this.createEdgesFromEReferences(root, ecoreModel);
            this.createEdgesFromInheritance(root, ecoreModel);
            console.log('Created metamodel visualization with root:', root);
            console.log("Total children in root: ".concat(root.children.length));
            console.log("Children breakdown:", root.children.map(function (child) { return ({ type: child.type, id: child.id }); }));
            // Debug: Check if any edges were created
            var edges = root.children.filter(function (child) { var _a; return (_a = child.type) === null || _a === void 0 ? void 0 : _a.startsWith('edge:'); });
            console.log("Total edges created: ".concat(edges.length));
            edges.forEach(function (edge) {
                console.log("Edge: ".concat(edge.id, " (").concat(edge.type, ") from ").concat(edge.sourceId, " to ").concat(edge.targetId));
            });
            this.modelState.set('gmodel', root);
        };
        /**
         * Creates visualization of instance model (object diagram view)
         */
        DynamicEcoreGModelFactory_1.prototype.createInstanceModel = function () {
            var _this = this;
            console.log('createInstanceModel()');
            var root = new server_1.GModelRoot();
            root.type = 'graph';
            root.id = 'sprotty';
            root.revision = 0;
            var instances = this.instanceStorage.getAllInstances();
            console.log("Found ".concat(instances.length, " instances to visualize"));
            // Create nodes for each instance
            instances.forEach(function (instance) {
                var node = _this.createNodeForInstance(instance);
                root.children.push(node);
            });
            // Create edges for references
            instances.forEach(function (instance) {
                var edges = _this.createEdgesForInstanceReferences(instance);
                edges.forEach(function (edge) { return root.children.push(edge); });
            });
            console.log('Created instance model with root:', root);
            this.modelState.set('gmodel', root);
        };
        DynamicEcoreGModelFactory_1.prototype.createDefaultModel = function () {
            console.log('Creating default empty model');
            var root = new server_1.GModelRoot();
            root.type = 'graph';
            root.id = 'sprotty';
            root.revision = 0; // Initialize revision
            this.modelState.set('gmodel', root);
            console.log('Default model root set in model state');
        };
        DynamicEcoreGModelFactory_1.prototype.createNodesFromEClasses = function (root, ecoreModel) {
            var _this = this;
            var x = 100;
            var y = 100;
            var nodeWidth = 250;
            var nodeHeight = 200;
            var spacing = 100;
            var maxNodesPerRow = 2;
            var nodeCount = 0;
            ecoreModel.ePackages.forEach(function (pkg) {
                pkg.get('eClassifiers').forEach(function (classifier) {
                    if ((0, ecore_types_1.isEClass)(classifier)) {
                        var node = _this.createNodeForEClass(classifier);
                        _this.setNodePosition(node, x, y, nodeWidth, nodeHeight);
                        root.children.push(node);
                    }
                    else if ((0, ecore_types_1.isEDataType)(classifier)) {
                        var node = _this.createNodeForEDataType(classifier);
                        _this.setNodePosition(node, x, y, nodeWidth, nodeHeight);
                        root.children.push(node);
                    }
                    else if ((0, ecore_types_1.isEEnum)(classifier)) {
                        var node = _this.createNodeForEEnum(classifier);
                        _this.setNodePosition(node, x, y, nodeWidth, nodeHeight);
                        root.children.push(node);
                    }
                    // Update position for next node
                    nodeCount++;
                    if (nodeCount % maxNodesPerRow === 0) {
                        // Move to next row
                        x = 100;
                        y += nodeHeight + spacing;
                    }
                    else {
                        // Move to next column
                        x += nodeWidth + spacing;
                    }
                });
            });
        };
        DynamicEcoreGModelFactory_1.prototype.setNodePosition = function (node, x, y, width, height) {
            node.position = { x: x, y: y };
            // Ensure minimum size constraints
            var finalWidth = Math.max(width, 150);
            var finalHeight = Math.max(height, 100);
            node.size = { width: finalWidth, height: finalHeight };
        };
        DynamicEcoreGModelFactory_1.prototype.createNodeForEClass = function (eClass) {
            var node = new server_1.GNode();
            node.type = 'ecore:class'; // Use consistent type for all EClass nodes
            node.id = eClass.get('name');
            node.layout = 'vbox';
            node.args = server_1.ArgsUtil.cornerRadius(5);
            // Add layout hints to ensure proper sizing
            node.args = __assign(__assign({}, node.args), { paddingTop: 10, paddingBottom: 10, paddingLeft: 10, paddingRight: 10 });
            // Set CSS classes based on class type
            var cssClasses = ['ecore-class'];
            if (eClass.abstract) {
                cssClasses.push('abstract');
            }
            if (eClass.interface) {
                cssClasses.push('interface');
            }
            node.cssClasses = cssClasses;
            // Add header compartment with class name
            var headerCompartment = new server_1.GCompartment();
            headerCompartment.id = "".concat(eClass.name, "_header");
            headerCompartment.type = 'comp:header';
            headerCompartment.layout = 'hbox';
            headerCompartment.size = { width: 200, height: 30 }; // Explicit size
            headerCompartment.children.push(this.createClassNameLabel(eClass));
            node.children.push(headerCompartment);
            // Add attributes compartment
            var attributes = eClass.eStructuralFeatures.filter(ecore_types_1.isEAttribute);
            if (attributes.length > 0) {
                var attributesCompartment = new server_1.GCompartment();
                attributesCompartment.id = "".concat(eClass.name, "_attributes");
                attributesCompartment.type = 'comp:attributes';
                attributesCompartment.layout = 'vbox';
                attributesCompartment.size = { width: 200, height: 50 }; // Explicit size
                attributesCompartment.children.push(this.createAttributesLabel(eClass));
                node.children.push(attributesCompartment);
            }
            // Add references compartment
            var references = eClass.eStructuralFeatures.filter(ecore_types_1.isEReference);
            if (references.length > 0) {
                var referencesCompartment = new server_1.GCompartment();
                referencesCompartment.id = "".concat(eClass.name, "_references");
                referencesCompartment.type = 'comp:references';
                referencesCompartment.layout = 'vbox';
                referencesCompartment.size = { width: 200, height: 50 }; // Explicit size
                referencesCompartment.children.push(this.createReferencesLabel(eClass));
                node.children.push(referencesCompartment);
            }
            return node;
        };
        DynamicEcoreGModelFactory_1.prototype.createNodeForEDataType = function (eDataType) {
            var node = new server_1.GNode();
            node.type = 'ecore:datatype'; // Use specific type for EDataType nodes
            node.id = eDataType.get('name');
            node.layout = 'vbox';
            node.args = server_1.ArgsUtil.cornerRadius(5);
            node.cssClasses = ['ecore-datatype'];
            // Add header compartment with data type name
            var headerCompartment = new server_1.GCompartment();
            headerCompartment.id = "".concat(eDataType.name, "_header");
            headerCompartment.type = 'comp:header';
            headerCompartment.layout = 'hbox';
            headerCompartment.size = { width: 200, height: 30 }; // Explicit size
            headerCompartment.children.push(this.createDataTypeNameLabel(eDataType));
            node.children.push(headerCompartment);
            // Add instance class name compartment
            var instanceClassCompartment = new server_1.GCompartment();
            instanceClassCompartment.id = "".concat(eDataType.name, "_instanceclass");
            instanceClassCompartment.type = 'comp:attributes';
            instanceClassCompartment.layout = 'vbox';
            instanceClassCompartment.size = { width: 200, height: 50 }; // Explicit size
            instanceClassCompartment.children.push(this.createInstanceClassNameLabel(eDataType));
            node.children.push(instanceClassCompartment);
            return node;
        };
        DynamicEcoreGModelFactory_1.prototype.createNodeForEEnum = function (eEnum) {
            var node = new server_1.GNode();
            node.type = 'ecore:enum'; // Use specific type for EEnum nodes
            node.id = eEnum.get('name');
            node.layout = 'vbox';
            node.args = server_1.ArgsUtil.cornerRadius(5);
            node.cssClasses = ['ecore-enum'];
            // Add header compartment with enum name
            var headerCompartment = new server_1.GCompartment();
            headerCompartment.id = "".concat(eEnum.name, "_header");
            headerCompartment.type = 'comp:header';
            headerCompartment.layout = 'hbox';
            headerCompartment.size = { width: 200, height: 30 }; // Explicit size
            headerCompartment.children.push(this.createEnumNameLabel(eEnum));
            node.children.push(headerCompartment);
            // Add literals compartment
            if (eEnum.eLiterals.length > 0) {
                var literalsCompartment = new server_1.GCompartment();
                literalsCompartment.id = "".concat(eEnum.name, "_literals");
                literalsCompartment.type = 'comp:attributes';
                literalsCompartment.layout = 'vbox';
                literalsCompartment.size = { width: 200, height: 50 }; // Explicit size
                literalsCompartment.children.push(this.createEnumLiteralsLabel(eEnum));
                node.children.push(literalsCompartment);
            }
            return node;
        };
        DynamicEcoreGModelFactory_1.prototype.createClassNameLabel = function (eClass) {
            var labelText = eClass.get('name');
            // Add stereotypes for different class types
            if (eClass.get('interface')) {
                labelText = "<<interface>> ".concat(eClass.get('name'));
            }
            else if (eClass.get('abstract')) {
                labelText = "<<abstract>> ".concat(eClass.get('name'));
            }
            var label = new server_1.GLabel();
            label.type = 'label:heading';
            label.id = "".concat(eClass.get('name'), "_classname");
            label.text = labelText;
            return label;
        };
        DynamicEcoreGModelFactory_1.prototype.createAttributesLabel = function (eClass) {
            var _this = this;
            var attributes = eClass.get('eStructuralFeatures').filter(ecore_types_1.isEAttribute);
            var attributesText = attributes
                .map(function (attr) {
                var typeName = _this.getTypeName(attr.get('eType'));
                var multiplicity = _this.getMultiplicityString(attr.get('lowerBound'), attr.get('upperBound'));
                return "- ".concat(attr.get('name'), ": ").concat(typeName).concat(multiplicity);
            })
                .join('\n');
            var label = new server_1.GLabel();
            label.type = 'label:text';
            label.id = "".concat(eClass.get('name'), "_attributes_label");
            label.text = attributesText;
            return label;
        };
        DynamicEcoreGModelFactory_1.prototype.createReferencesLabel = function (eClass) {
            var _this = this;
            var references = eClass.get('eStructuralFeatures').filter(ecore_types_1.isEReference);
            var referencesText = references
                .map(function (ref) {
                var typeName = _this.getTypeName(ref.get('eType'));
                var containment = ref.get('containment') ? ' (containment)' : '';
                var multiplicity = _this.getMultiplicityString(ref.get('lowerBound'), ref.get('upperBound'));
                return "- ".concat(ref.get('name'), ": ").concat(typeName).concat(multiplicity).concat(containment);
            })
                .join('\n');
            var label = new server_1.GLabel();
            label.type = 'label:text';
            label.id = "".concat(eClass.get('name'), "_references_label");
            label.text = referencesText;
            return label;
        };
        DynamicEcoreGModelFactory_1.prototype.createDataTypeNameLabel = function (eDataType) {
            var label = new server_1.GLabel();
            label.type = 'label:heading';
            label.id = "".concat(eDataType.get('name'), "_datatypename");
            label.text = "<<datatype>> ".concat(eDataType.get('name'));
            return label;
        };
        DynamicEcoreGModelFactory_1.prototype.createInstanceClassNameLabel = function (eDataType) {
            var label = new server_1.GLabel();
            label.type = 'label:text';
            label.id = "".concat(eDataType.get('name'), "_instanceclassname");
            label.text = "instanceClassName: ".concat(eDataType.get('instanceClassName'));
            return label;
        };
        DynamicEcoreGModelFactory_1.prototype.createEnumNameLabel = function (eEnum) {
            var label = new server_1.GLabel();
            label.type = 'label:heading';
            label.id = "".concat(eEnum.get('name'), "_enumname");
            label.text = "<<enumeration>> ".concat(eEnum.get('name'));
            return label;
        };
        DynamicEcoreGModelFactory_1.prototype.createEnumLiteralsLabel = function (eEnum) {
            var literalsText = eEnum.get('eLiterals')
                .map(function (literal) { return "".concat(literal.get('name'), " = ").concat(literal.get('value')); })
                .join('\n');
            var label = new server_1.GLabel();
            label.type = 'label:text';
            label.id = "".concat(eEnum.get('name'), "_literals_label");
            label.text = literalsText;
            return label;
        };
        DynamicEcoreGModelFactory_1.prototype.createEdgesFromEReferences = function (root, ecoreModel) {
            var _this = this;
            console.log('createEdgesFromEReferences() - Starting edge creation');
            var edgeCount = 0;
            ecoreModel.ePackages.forEach(function (pkg) {
                console.log("Processing package: ".concat(pkg.get('name')));
                pkg.get('eClassifiers').forEach(function (classifier) {
                    console.log("Processing classifier: ".concat(classifier.get('name'), ", isEClass: ").concat((0, ecore_types_1.isEClass)(classifier)));
                    if ((0, ecore_types_1.isEClass)(classifier)) {
                        var references = classifier.get('eStructuralFeatures').filter(ecore_types_1.isEReference);
                        console.log("Processing class ".concat(classifier.get('name'), " with ").concat(references.length, " references"));
                        references.forEach(function (eRef) {
                            var edge = _this.createEdgeForEReference(eRef, classifier);
                            if (edge) {
                                root.children.push(edge);
                                edgeCount++;
                                console.log("Created ".concat(edge.type, " edge: ").concat(edge.sourceId, " -> ").concat(edge.targetId));
                            }
                        });
                    }
                });
            });
            console.log("createEdgesFromEReferences() - Created ".concat(edgeCount, " reference edges"));
        };
        DynamicEcoreGModelFactory_1.prototype.createEdgeForEReference = function (eRef, sourceClass) {
            var edge = new server_1.GEdge();
            // Determine edge type based on containment
            if (eRef.get('containment')) {
                edge.type = 'edge:ecore-containment';
                edge.cssClasses = ['ecore-containment'];
            }
            else {
                edge.type = 'edge:ecore-reference';
                edge.cssClasses = ['ecore-reference'];
            }
            edge.id = "".concat(sourceClass.get('name'), "_").concat(eRef.get('name'));
            edge.sourceId = sourceClass.get('name');
            edge.targetId = this.getTypeName(eRef.get('eType'));
            console.log("Creating edge: ".concat(edge.sourceId, " -> ").concat(edge.targetId, " (").concat(edge.type, ")"));
            console.log("eRef.eType:", eRef.get('eType'));
            console.log("Resolved targetId: ".concat(edge.targetId));
            // Add label with reference name and multiplicity
            var multiplicity = this.getMultiplicityString(eRef.get('lowerBound'), eRef.get('upperBound'));
            var labelText = multiplicity !== '[1]' ? "".concat(multiplicity, " ").concat(eRef.get('name')) : eRef.get('name');
            console.log("Creating edge label: \"".concat(labelText, "\" for edge ").concat(edge.id));
            var label = new server_1.GLabel();
            label.type = 'label:text';
            label.id = "".concat(edge.id, "_label");
            label.text = labelText;
            edge.children.push(label);
            return edge;
        };
        /**
         * Creates edges for inheritance relationships (eSuperTypes)
         */
        DynamicEcoreGModelFactory_1.prototype.createEdgesFromInheritance = function (root, ecoreModel) {
            var _this = this;
            console.log('createEdgesFromInheritance() - Starting inheritance edge creation');
            var inheritanceCount = 0;
            ecoreModel.ePackages.forEach(function (pkg) {
                console.log("Processing package for inheritance: ".concat(pkg.get('name')));
                pkg.get('eClassifiers').forEach(function (classifier) {
                    console.log("Processing classifier for inheritance: ".concat(classifier.get('name'), ", isEClass: ").concat((0, ecore_types_1.isEClass)(classifier)));
                    if ((0, ecore_types_1.isEClass)(classifier) && classifier.get('eSuperTypes') && classifier.get('eSuperTypes').length > 0) {
                        console.log("Processing class ".concat(classifier.get('name'), " with ").concat(classifier.get('eSuperTypes').length, " super types"));
                        classifier.get('eSuperTypes').forEach(function (superType) {
                            var edge = _this.createInheritanceEdge(classifier, superType);
                            if (edge) {
                                root.children.push(edge);
                                inheritanceCount++;
                                console.log("Created inheritance edge: ".concat(edge.sourceId, " -> ").concat(edge.targetId));
                            }
                        });
                    }
                });
            });
            console.log("createEdgesFromInheritance() - Created ".concat(inheritanceCount, " inheritance edges"));
        };
        /**
         * Creates an inheritance edge between a subclass and its superclass
         */
        DynamicEcoreGModelFactory_1.prototype.createInheritanceEdge = function (subClass, superClass) {
            if (!superClass.get('name')) {
                console.log("createInheritanceEdge: No superClass name for ".concat(subClass.get('name')));
                return null;
            }
            var edge = new server_1.GEdge();
            edge.type = 'edge:ecore-inheritance';
            edge.id = "".concat(subClass.get('name'), "_inherits_").concat(this.getTypeName(superClass));
            edge.sourceId = subClass.get('name');
            edge.targetId = this.getTypeName(superClass);
            edge.cssClasses = ['ecore-inheritance'];
            console.log("Created inheritance edge: ".concat(edge.sourceId, " -> ").concat(edge.targetId, " (type: ").concat(edge.type, ")"));
            return edge;
        };
        DynamicEcoreGModelFactory_1.prototype.getTypeName = function (eType) {
            if (typeof eType === 'string') {
                return eType;
            }
            if (eType && typeof eType === 'object') {
                return eType.name || 'Unknown';
            }
            return 'Unknown';
        };
        DynamicEcoreGModelFactory_1.prototype.getMultiplicityString = function (lowerBound, upperBound) {
            if (lowerBound === upperBound) {
                return "[".concat(lowerBound, "]");
            }
            else if (upperBound === -1) {
                return "[".concat(lowerBound, "..*]");
            }
            else {
                return "[".concat(lowerBound, "..").concat(upperBound, "]");
            }
        };
        /**
         * Creates a GNode for an instance.
         */
        DynamicEcoreGModelFactory_1.prototype.createNodeForInstance = function (instance) {
            var node = new server_1.GNode();
            node.type = 'ecore:instance'; // Use consistent type for all instance nodes
            node.id = instance.id;
            node.layout = 'vbox';
            node.args = server_1.ArgsUtil.cornerRadius(5);
            node.cssClasses = ['ecore-instance'];
            // Set position if available
            if (instance.position) {
                node.position = { x: instance.position.x, y: instance.position.y };
            }
            else {
                // Auto-layout: position instances in a grid
                node.position = { x: 50, y: 50 };
            }
            // Set size if available
            if (instance.size) {
                node.size = { width: instance.size.width, height: instance.size.height };
            }
            // Get EClass definition for structure
            var eClass = this.metamodelRegistry.findEClass(instance.eClassName);
            // Add header compartment with instance ID and class name
            var headerCompartment = new server_1.GCompartment();
            headerCompartment.id = "".concat(instance.id, "_header");
            headerCompartment.type = 'comp:header';
            headerCompartment.layout = 'hbox';
            var headerLabel = new server_1.GLabel();
            headerLabel.type = 'label:heading';
            headerLabel.id = "".concat(instance.id, "_header_label");
            headerLabel.text = "".concat(instance.id, ": ").concat(instance.eClassName);
            headerCompartment.children.push(headerLabel);
            node.children.push(headerCompartment);
            // Add attributes compartment with values
            if (eClass && instance.attributes.size > 0) {
                var attributesCompartment = new server_1.GCompartment();
                attributesCompartment.id = "".concat(instance.id, "_attributes");
                attributesCompartment.type = 'comp:attributes';
                attributesCompartment.layout = 'vbox';
                var attributesText_1 = [];
                instance.attributes.forEach(function (value, attrName) {
                    var displayValue = value !== null && value !== undefined ? String(value) : '';
                    attributesText_1.push("".concat(attrName, " = ").concat(displayValue));
                });
                var attributesLabel = new server_1.GLabel();
                attributesLabel.type = 'label:text';
                attributesLabel.id = "".concat(instance.id, "_attributes_label");
                attributesLabel.text = attributesText_1.join('\n');
                attributesCompartment.children.push(attributesLabel);
                node.children.push(attributesCompartment);
            }
            return node;
        };
        /**
         * Creates GEdges for an instance's references.
         */
        DynamicEcoreGModelFactory_1.prototype.createEdgesForInstanceReferences = function (instance) {
            var _this = this;
            var edges = [];
            instance.references.forEach(function (value, refName) {
                if (typeof value === 'string' && value) {
                    // Single reference
                    var edge = _this.createInstanceEdge(instance.id, value, refName);
                    if (edge) {
                        edges.push(edge);
                    }
                }
                else if (Array.isArray(value)) {
                    // Multi-valued reference
                    value.forEach(function (targetId) {
                        var edge = _this.createInstanceEdge(instance.id, targetId, refName);
                        if (edge) {
                            edges.push(edge);
                        }
                    });
                }
            });
            return edges;
        };
        /**
         * Creates a single instance reference edge.
         */
        DynamicEcoreGModelFactory_1.prototype.createInstanceEdge = function (sourceId, targetId, refName) {
            if (!targetId) {
                return null;
            }
            var edge = new server_1.GEdge();
            edge.type = 'edge:inst-reference';
            edge.id = "".concat(sourceId, "_").concat(refName, "_").concat(targetId);
            edge.sourceId = sourceId;
            edge.targetId = targetId;
            // Add label for reference name
            var label = new server_1.GLabel();
            label.type = 'label:text';
            label.id = "".concat(edge.id, "_label");
            label.text = refName;
            edge.children.push(label);
            return edge;
        };
        return DynamicEcoreGModelFactory_1;
    }());
    __setFunctionName(_classThis, "DynamicEcoreGModelFactory");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        _modelState_decorators = [(0, inversify_1.inject)(server_1.ModelState)];
        _metamodelRegistry_decorators = [(0, inversify_1.inject)(metamodel_registry_1.MetamodelRegistry)];
        _instanceStorage_decorators = [(0, inversify_1.inject)(instance_model_storage_1.InstanceModelStorage)];
        __esDecorate(null, null, _modelState_decorators, { kind: "field", name: "modelState", static: false, private: false, access: { has: function (obj) { return "modelState" in obj; }, get: function (obj) { return obj.modelState; }, set: function (obj, value) { obj.modelState = value; } }, metadata: _metadata }, _modelState_initializers, _modelState_extraInitializers);
        __esDecorate(null, null, _metamodelRegistry_decorators, { kind: "field", name: "metamodelRegistry", static: false, private: false, access: { has: function (obj) { return "metamodelRegistry" in obj; }, get: function (obj) { return obj.metamodelRegistry; }, set: function (obj, value) { obj.metamodelRegistry = value; } }, metadata: _metadata }, _metamodelRegistry_initializers, _metamodelRegistry_extraInitializers);
        __esDecorate(null, null, _instanceStorage_decorators, { kind: "field", name: "instanceStorage", static: false, private: false, access: { has: function (obj) { return "instanceStorage" in obj; }, get: function (obj) { return obj.instanceStorage; }, set: function (obj, value) { obj.instanceStorage = value; } }, metadata: _metadata }, _instanceStorage_initializers, _instanceStorage_extraInitializers);
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        DynamicEcoreGModelFactory = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return DynamicEcoreGModelFactory = _classThis;
}();
exports.DynamicEcoreGModelFactory = DynamicEcoreGModelFactory;

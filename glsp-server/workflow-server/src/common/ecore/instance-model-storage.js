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
exports.InstanceModelStorage = void 0;
var inversify_1 = require("inversify");
var instance_model_types_1 = require("./instance-model-types");
var metamodel_registry_1 = require("./metamodel-registry");
var ecore_types_1 = require("./ecore-types");
/**
 * Storage and management for Ecore instance models.
 */
var InstanceModelStorage = function () {
    var _classDecorators = [(0, inversify_1.injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var _metamodelRegistry_decorators;
    var _metamodelRegistry_initializers = [];
    var _metamodelRegistry_extraInitializers = [];
    var InstanceModelStorage = _classThis = /** @class */ (function () {
        function InstanceModelStorage_1() {
            this.instanceModels = new Map();
            this.instanceFactory = new instance_model_types_1.InstanceFactory();
            this.metamodelRegistry = __runInitializers(this, _metamodelRegistry_initializers, void 0);
            __runInitializers(this, _metamodelRegistry_extraInitializers);
        }
        /**
         * Creates a new instance model for the specified metamodel.
         * @param metamodelKey The key of the metamodel
         * @returns The created instance model
         */
        InstanceModelStorage_1.prototype.createInstanceModel = function (metamodelKey) {
            if (!this.metamodelRegistry.hasMetamodel(metamodelKey)) {
                throw new Error("Metamodel with key '".concat(metamodelKey, "' not found"));
            }
            var instanceModel = {
                metamodelKey: metamodelKey,
                instances: new Map(),
                rootInstances: new Set()
            };
            this.instanceModels.set(metamodelKey, instanceModel);
            return instanceModel;
        };
        /**
         * Gets the instance model for the specified metamodel.
         * @param metamodelKey The key of the metamodel
         * @returns The instance model or undefined if not found
         */
        InstanceModelStorage_1.prototype.getInstanceModel = function (metamodelKey) {
            return this.instanceModels.get(metamodelKey);
        };
        /**
         * Gets the instance model for the active metamodel.
         * @returns The instance model or undefined if not found
         */
        InstanceModelStorage_1.prototype.getActiveInstanceModel = function () {
            var activeKey = this.metamodelRegistry.getActiveMetamodelKey();
            if (!activeKey) {
                return undefined;
            }
            return this.instanceModels.get(activeKey);
        };
        /**
         * Gets or creates the instance model for the active metamodel.
         * @returns The instance model
         */
        InstanceModelStorage_1.prototype.getOrCreateActiveInstanceModel = function () {
            var activeKey = this.metamodelRegistry.getActiveMetamodelKey();
            if (!activeKey) {
                throw new Error('No active metamodel set');
            }
            var instanceModel = this.instanceModels.get(activeKey);
            if (!instanceModel) {
                instanceModel = this.createInstanceModel(activeKey);
            }
            return instanceModel;
        };
        /**
         * Creates a new instance of the specified EClass.
         * @param eClassName The name of the EClass
         * @param position Optional initial position
         * @returns The created instance
         */
        InstanceModelStorage_1.prototype.createInstance = function (eClassName, position) {
            var activeKey = this.metamodelRegistry.getActiveMetamodelKey();
            if (!activeKey) {
                throw new Error('No active metamodel set');
            }
            // Validate that the EClass exists in the metamodel
            var eClass = this.metamodelRegistry.findEClass(eClassName);
            if (!eClass) {
                throw new Error("EClass '".concat(eClassName, "' not found in active metamodel"));
            }
            // Check if the class is abstract
            if (eClass.abstract) {
                throw new Error("Cannot instantiate abstract class '".concat(eClassName, "'"));
            }
            // Create the instance
            var instance = this.instanceFactory.createInstance(eClassName, activeKey, position);
            // Initialize default attribute values
            this.initializeAttributes(instance, eClass);
            // Add to instance model
            var instanceModel = this.getOrCreateActiveInstanceModel();
            instanceModel.instances.set(instance.id, instance);
            instanceModel.rootInstances.add(instance.id);
            console.log("Created instance ".concat(instance.id, " of class ").concat(eClassName));
            return instance;
        };
        /**
         * Initializes default attribute values for an instance based on its EClass.
         * @param instance The instance to initialize
         * @param eClass The EClass definition
         */
        InstanceModelStorage_1.prototype.initializeAttributes = function (instance, eClass) {
            var attributes = eClass.eStructuralFeatures.filter(ecore_types_1.isEAttribute);
            for (var _i = 0, attributes_1 = attributes; _i < attributes_1.length; _i++) {
                var attr = attributes_1[_i];
                // Set default values based on type
                var defaultValue = null;
                var typeName = attr.eType.name.toLowerCase();
                if (typeName.includes('string')) {
                    defaultValue = '';
                }
                else if (typeName.includes('int') || typeName.includes('long')) {
                    defaultValue = 0;
                }
                else if (typeName.includes('boolean')) {
                    defaultValue = false;
                }
                else if (typeName.includes('double') || typeName.includes('float')) {
                    defaultValue = 0.0;
                }
                instance.attributes.set(attr.name, defaultValue);
            }
            // Initialize references as empty
            var references = eClass.eStructuralFeatures.filter(ecore_types_1.isEReference);
            for (var _a = 0, references_1 = references; _a < references_1.length; _a++) {
                var ref = references_1[_a];
                if (ref.upperBound === 1) {
                    instance.references.set(ref.name, '');
                }
                else {
                    instance.references.set(ref.name, []);
                }
            }
        };
        /**
         * Gets an instance by its ID.
         * @param instanceId The ID of the instance
         * @returns The instance or undefined if not found
         */
        InstanceModelStorage_1.prototype.getInstance = function (instanceId) {
            var instanceModel = this.getActiveInstanceModel();
            if (!instanceModel) {
                return undefined;
            }
            return instanceModel.instances.get(instanceId);
        };
        /**
         * Sets an attribute value on an instance.
         * @param instanceId The ID of the instance
         * @param attributeName The name of the attribute
         * @param value The value to set
         */
        InstanceModelStorage_1.prototype.setAttributeValue = function (instanceId, attributeName, value) {
            var instance = this.getInstance(instanceId);
            if (!instance) {
                throw new Error("Instance '".concat(instanceId, "' not found"));
            }
            var eClass = this.metamodelRegistry.findEClass(instance.eClassName);
            if (!eClass) {
                throw new Error("EClass '".concat(instance.eClassName, "' not found in metamodel"));
            }
            // Validate attribute exists
            var attributes = eClass.eStructuralFeatures.filter(ecore_types_1.isEAttribute);
            var attr = attributes.find(function (a) { return a.name === attributeName; });
            if (!attr) {
                throw new Error("Attribute '".concat(attributeName, "' not found in class '").concat(instance.eClassName, "'"));
            }
            // TODO: Add type validation
            instance.attributes.set(attributeName, value);
            console.log("Set attribute ".concat(attributeName, " = ").concat(value, " on instance ").concat(instanceId));
        };
        /**
         * Creates a reference between two instances.
         * @param sourceInstanceId The ID of the source instance
         * @param referenceName The name of the reference
         * @param targetInstanceId The ID of the target instance
         */
        InstanceModelStorage_1.prototype.createReference = function (sourceInstanceId, referenceName, targetInstanceId) {
            var sourceInstance = this.getInstance(sourceInstanceId);
            if (!sourceInstance) {
                throw new Error("Source instance '".concat(sourceInstanceId, "' not found"));
            }
            var targetInstance = this.getInstance(targetInstanceId);
            if (!targetInstance) {
                throw new Error("Target instance '".concat(targetInstanceId, "' not found"));
            }
            var eClass = this.metamodelRegistry.findEClass(sourceInstance.eClassName);
            if (!eClass) {
                throw new Error("EClass '".concat(sourceInstance.eClassName, "' not found in metamodel"));
            }
            // Validate reference exists
            var references = eClass.eStructuralFeatures.filter(ecore_types_1.isEReference);
            var ref = references.find(function (r) { return r.name === referenceName; });
            if (!ref) {
                throw new Error("Reference '".concat(referenceName, "' not found in class '").concat(sourceInstance.eClassName, "'"));
            }
            // Validate target type matches reference type
            if (ref.eType.name !== targetInstance.eClassName) {
                throw new Error("Type mismatch: reference '".concat(referenceName, "' expects type '").concat(ref.eType.name, "' but got '").concat(targetInstance.eClassName, "'"));
            }
            // Check if it's a single or multi-valued reference
            if (ref.upperBound === 1) {
                sourceInstance.references.set(referenceName, targetInstanceId);
            }
            else {
                var currentValue = sourceInstance.references.get(referenceName);
                if (Array.isArray(currentValue)) {
                    currentValue.push(targetInstanceId);
                }
                else {
                    sourceInstance.references.set(referenceName, [targetInstanceId]);
                }
            }
            // Handle containment
            if (ref.containment) {
                var instanceModel = this.getActiveInstanceModel();
                if (instanceModel) {
                    instanceModel.rootInstances.delete(targetInstanceId);
                }
            }
            console.log("Created reference ".concat(referenceName, " from ").concat(sourceInstanceId, " to ").concat(targetInstanceId));
        };
        /**
         * Deletes an instance.
         * @param instanceId The ID of the instance to delete
         * @returns True if the instance was deleted, false if it didn't exist
         */
        InstanceModelStorage_1.prototype.deleteInstance = function (instanceId) {
            var instanceModel = this.getActiveInstanceModel();
            if (!instanceModel) {
                return false;
            }
            var deleted = instanceModel.instances.delete(instanceId);
            if (deleted) {
                instanceModel.rootInstances.delete(instanceId);
                // TODO: Clean up references to this instance from other instances
                console.log("Deleted instance ".concat(instanceId));
            }
            return deleted;
        };
        /**
         * Gets all instances in the active instance model.
         * @returns Array of all instances
         */
        InstanceModelStorage_1.prototype.getAllInstances = function () {
            var instanceModel = this.getActiveInstanceModel();
            if (!instanceModel) {
                return [];
            }
            return Array.from(instanceModel.instances.values());
        };
        /**
         * Gets all root instances in the active instance model.
         * @returns Array of root instances
         */
        InstanceModelStorage_1.prototype.getRootInstances = function () {
            var instanceModel = this.getActiveInstanceModel();
            if (!instanceModel) {
                return [];
            }
            var rootInstances = [];
            for (var _i = 0, _a = instanceModel.rootInstances; _i < _a.length; _i++) {
                var rootId = _a[_i];
                var instance = instanceModel.instances.get(rootId);
                if (instance) {
                    rootInstances.push(instance);
                }
            }
            return rootInstances;
        };
        /**
         * Clears the instance model for the specified metamodel.
         * @param metamodelKey The key of the metamodel
         */
        InstanceModelStorage_1.prototype.clearInstanceModel = function (metamodelKey) {
            this.instanceModels.delete(metamodelKey);
            console.log("Cleared instance model for metamodel ".concat(metamodelKey));
        };
        /**
         * Clears all instance models.
         */
        InstanceModelStorage_1.prototype.clearAll = function () {
            this.instanceModels.clear();
            this.instanceFactory.resetCounter();
            console.log('Cleared all instance models');
        };
        return InstanceModelStorage_1;
    }());
    __setFunctionName(_classThis, "InstanceModelStorage");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        _metamodelRegistry_decorators = [(0, inversify_1.inject)(metamodel_registry_1.MetamodelRegistry)];
        __esDecorate(null, null, _metamodelRegistry_decorators, { kind: "field", name: "metamodelRegistry", static: false, private: false, access: { has: function (obj) { return "metamodelRegistry" in obj; }, get: function (obj) { return obj.metamodelRegistry; }, set: function (obj, value) { obj.metamodelRegistry = value; } }, metadata: _metadata }, _metamodelRegistry_initializers, _metamodelRegistry_extraInitializers);
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        InstanceModelStorage = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return InstanceModelStorage = _classThis;
}();
exports.InstanceModelStorage = InstanceModelStorage;

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
exports.MetamodelRegistry = void 0;
var inversify_1 = require("inversify");
var ecore_types_1 = require("./ecore-types");
/**
 * Registry for storing and managing loaded Ecore metamodels.
 * This is a singleton service that maintains all metamodels loaded during the session.
 */
var MetamodelRegistry = function () {
    var _classDecorators = [(0, inversify_1.injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var MetamodelRegistry = _classThis = /** @class */ (function () {
        function MetamodelRegistry_1() {
            this.metamodels = new Map();
            this.activeMetamodelKey = null;
        }
        /**
         * Registers a new metamodel in the registry.
         * @param key Unique identifier for the metamodel (typically nsURI or filename)
         * @param metamodel The Ecore metamodel to register
         */
        MetamodelRegistry_1.prototype.registerMetamodel = function (key, metamodel) {
            console.log("Registering metamodel with key: ".concat(key));
            this.metamodels.set(key, metamodel);
            // Set as active if it's the first one
            if (!this.activeMetamodelKey) {
                this.activeMetamodelKey = key;
            }
        };
        /**
         * Retrieves a metamodel by its key.
         * @param key The unique identifier of the metamodel
         * @returns The metamodel or undefined if not found
         */
        MetamodelRegistry_1.prototype.getMetamodel = function (key) {
            return this.metamodels.get(key);
        };
        /**
         * Gets the currently active metamodel.
         * @returns The active metamodel or undefined if none is set
         */
        MetamodelRegistry_1.prototype.getActiveMetamodel = function () {
            if (!this.activeMetamodelKey) {
                return undefined;
            }
            return this.metamodels.get(this.activeMetamodelKey);
        };
        /**
         * Gets the key of the currently active metamodel.
         * @returns The active metamodel key or null if none is set
         */
        MetamodelRegistry_1.prototype.getActiveMetamodelKey = function () {
            return this.activeMetamodelKey;
        };
        /**
         * Sets the active metamodel.
         * @param key The key of the metamodel to set as active
         * @throws Error if the metamodel key doesn't exist
         */
        MetamodelRegistry_1.prototype.setActiveMetamodel = function (key) {
            if (!this.metamodels.has(key)) {
                throw new Error("Metamodel with key '".concat(key, "' not found in registry"));
            }
            this.activeMetamodelKey = key;
        };
        /**
         * Gets all registered metamodel keys.
         * @returns Array of all metamodel keys
         */
        MetamodelRegistry_1.prototype.getAllMetamodelKeys = function () {
            return Array.from(this.metamodels.keys());
        };
        /**
         * Checks if a metamodel with the given key exists.
         * @param key The key to check
         * @returns True if the metamodel exists, false otherwise
         */
        MetamodelRegistry_1.prototype.hasMetamodel = function (key) {
            return this.metamodels.has(key);
        };
        /**
         * Removes a metamodel from the registry.
         * @param key The key of the metamodel to remove
         * @returns True if the metamodel was removed, false if it didn't exist
         */
        MetamodelRegistry_1.prototype.removeMetamodel = function (key) {
            var removed = this.metamodels.delete(key);
            // If the active metamodel was removed, set a new active one
            if (removed && this.activeMetamodelKey === key) {
                var keys = this.getAllMetamodelKeys();
                this.activeMetamodelKey = keys.length > 0 ? keys[0] : null;
            }
            return removed;
        };
        /**
         * Clears all metamodels from the registry.
         */
        MetamodelRegistry_1.prototype.clear = function () {
            this.metamodels.clear();
            this.activeMetamodelKey = null;
        };
        /**
         * Finds an EClass by name in the active metamodel.
         * @param className The name of the class to find
         * @returns The EClass or undefined if not found
         */
        MetamodelRegistry_1.prototype.findEClass = function (className) {
            var activeMetamodel = this.getActiveMetamodel();
            if (!activeMetamodel) {
                return undefined;
            }
            for (var _i = 0, _a = activeMetamodel.ePackages; _i < _a.length; _i++) {
                var pkg = _a[_i];
                for (var _b = 0, _c = pkg.eClassifiers; _b < _c.length; _b++) {
                    var classifier = _c[_b];
                    if ((0, ecore_types_1.isEClass)(classifier) && classifier.name === className) {
                        return classifier;
                    }
                }
            }
            return undefined;
        };
        /**
         * Finds an EClass by name in a specific metamodel.
         * @param metamodelKey The key of the metamodel to search in
         * @param className The name of the class to find
         * @returns The EClass or undefined if not found
         */
        MetamodelRegistry_1.prototype.findEClassInMetamodel = function (metamodelKey, className) {
            var metamodel = this.getMetamodel(metamodelKey);
            if (!metamodel) {
                return undefined;
            }
            for (var _i = 0, _a = metamodel.ePackages; _i < _a.length; _i++) {
                var pkg = _a[_i];
                for (var _b = 0, _c = pkg.eClassifiers; _b < _c.length; _b++) {
                    var classifier = _c[_b];
                    if ((0, ecore_types_1.isEClass)(classifier) && classifier.name === className) {
                        return classifier;
                    }
                }
            }
            return undefined;
        };
        /**
         * Gets all EClasses from the active metamodel.
         * @returns Array of all EClasses
         */
        MetamodelRegistry_1.prototype.getAllEClasses = function () {
            var activeMetamodel = this.getActiveMetamodel();
            if (!activeMetamodel) {
                return [];
            }
            var eClasses = [];
            for (var _i = 0, _a = activeMetamodel.ePackages; _i < _a.length; _i++) {
                var pkg = _a[_i];
                for (var _b = 0, _c = pkg.eClassifiers; _b < _c.length; _b++) {
                    var classifier = _c[_b];
                    if ((0, ecore_types_1.isEClass)(classifier)) {
                        eClasses.push(classifier);
                    }
                }
            }
            return eClasses;
        };
        /**
         * Gets all packages from the active metamodel.
         * @returns Array of all packages
         */
        MetamodelRegistry_1.prototype.getAllPackages = function () {
            var activeMetamodel = this.getActiveMetamodel();
            if (!activeMetamodel) {
                return [];
            }
            return activeMetamodel.ePackages;
        };
        /**
         * Gets information about all registered metamodels.
         * @returns Array of metamodel info objects
         */
        MetamodelRegistry_1.prototype.getMetamodelsInfo = function () {
            var infos = [];
            this.metamodels.forEach(function (metamodel, key) {
                var classCount = 0;
                var nsURI = '';
                var name = '';
                if (metamodel.ePackages.length > 0) {
                    var firstPackage = metamodel.ePackages[0];
                    nsURI = firstPackage.nsURI;
                    name = firstPackage.name;
                    for (var _i = 0, _a = metamodel.ePackages; _i < _a.length; _i++) {
                        var pkg = _a[_i];
                        classCount += pkg.eClassifiers.filter(ecore_types_1.isEClass).length;
                    }
                }
                infos.push({ key: key, nsURI: nsURI, name: name, classCount: classCount });
            });
            return infos;
        };
        return MetamodelRegistry_1;
    }());
    __setFunctionName(_classThis, "MetamodelRegistry");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        MetamodelRegistry = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return MetamodelRegistry = _classThis;
}();
exports.MetamodelRegistry = MetamodelRegistry;

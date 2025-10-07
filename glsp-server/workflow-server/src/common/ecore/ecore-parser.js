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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __setFunctionName = (this && this.__setFunctionName) || function (f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EcoreParser = void 0;
var inversify_1 = require("inversify");
var xml2js_1 = require("xml2js");
var ecore_types_1 = require("./ecore-types");
/**
 * Ecore Parser with reliable JSON parsing and XML support
 * Provides comprehensive validation and normalization
 */
var EcoreParser = function () {
    var _classDecorators = [(0, inversify_1.injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var EcoreParser = _classThis = /** @class */ (function () {
        function EcoreParser_1() {
        }
        /**
         * Parse Ecore JSON content using ecore-ts library
         */
        EcoreParser_1.prototype.parseEcoreJson = function (jsonContent) {
            return __awaiter(this, void 0, void 0, function () {
                var jsonObject;
                return __generator(this, function (_a) {
                    try {
                        jsonObject = JSON.parse(jsonContent);
                        // Validate basic structure
                        this.validateBasicStructure(jsonObject);
                        // Convert to our internal EcoreModel format
                        return [2 /*return*/, this.convertJsonToEcoreModel(jsonObject)];
                    }
                    catch (error) {
                        throw new Error("Failed to parse Ecore JSON: ".concat(error));
                    }
                    return [2 /*return*/];
                });
            });
        };
        /**
         * Parse Ecore XML file (maintains backward compatibility)
         */
        EcoreParser_1.prototype.parseEcoreFile = function (filePath) {
            return __awaiter(this, void 0, void 0, function () {
                var fs, xmlContent;
                return __generator(this, function (_a) {
                    fs = require('fs');
                    xmlContent = fs.readFileSync(filePath, 'utf8');
                    return [2 /*return*/, this.parseEcoreXml(xmlContent)];
                });
            });
        };
        /**
         * Parse Ecore XML content (maintains backward compatibility)
         */
        EcoreParser_1.prototype.parseEcoreXml = function (xmlContent) {
            return __awaiter(this, void 0, void 0, function () {
                var _this = this;
                return __generator(this, function (_a) {
                    return [2 /*return*/, new Promise(function (resolve, reject) {
                            (0, xml2js_1.parseString)(xmlContent, { explicitArray: false }, function (err, result) {
                                if (err) {
                                    reject(err);
                                    return;
                                }
                                try {
                                    var ecoreModel = _this.convertXmlToEcoreModel(result);
                                    resolve(ecoreModel);
                                }
                                catch (error) {
                                    reject(error);
                                }
                            });
                        })];
                });
            });
        };
        /**
         * Validate that JSON object has basic Ecore structure
         */
        EcoreParser_1.prototype.validateBasicStructure = function (jsonObject) {
            var _this = this;
            if (!jsonObject || typeof jsonObject !== 'object') {
                throw new Error('Root object must be a valid JSON object');
            }
            if (!jsonObject.ePackages) {
                throw new Error('Missing required property: ePackages');
            }
            if (!Array.isArray(jsonObject.ePackages)) {
                throw new Error('ePackages must be an array');
            }
            // Validate each package
            jsonObject.ePackages.forEach(function (pkg, index) {
                _this.validateEPackage(pkg, index);
            });
        };
        /**
         * Validate EPackage structure
         */
        EcoreParser_1.prototype.validateEPackage = function (pkg, index) {
            var _this = this;
            if (!pkg.name || typeof pkg.name !== 'string') {
                throw new Error("ePackages[".concat(index, "]: Missing or invalid name"));
            }
            if (!pkg.nsURI || typeof pkg.nsURI !== 'string') {
                throw new Error("ePackages[".concat(index, "]: Missing or invalid nsURI"));
            }
            if (!pkg.nsPrefix || typeof pkg.nsPrefix !== 'string') {
                throw new Error("ePackages[".concat(index, "]: Missing or invalid nsPrefix"));
            }
            // Validate classifiers if present
            if (pkg.eClassifiers) {
                if (!Array.isArray(pkg.eClassifiers)) {
                    throw new Error("ePackages[".concat(index, "]: eClassifiers must be an array"));
                }
                pkg.eClassifiers.forEach(function (classifier, cIndex) {
                    _this.validateEClassifier(classifier, index, cIndex);
                });
            }
        };
        /**
         * Validate EClassifier structure
         */
        EcoreParser_1.prototype.validateEClassifier = function (classifier, pkgIndex, cIndex) {
            var _this = this;
            if (!classifier.name || typeof classifier.name !== 'string') {
                throw new Error("ePackages[".concat(pkgIndex, "].eClassifiers[").concat(cIndex, "]: Missing or invalid name"));
            }
            // Validate attributes if present
            if (classifier.eAttributes) {
                if (!Array.isArray(classifier.eAttributes)) {
                    throw new Error("ePackages[".concat(pkgIndex, "].eClassifiers[").concat(cIndex, "]: eAttributes must be an array"));
                }
                classifier.eAttributes.forEach(function (attr, aIndex) {
                    _this.validateEAttribute(attr, pkgIndex, cIndex, aIndex);
                });
            }
            // Validate references if present
            if (classifier.eReferences) {
                if (!Array.isArray(classifier.eReferences)) {
                    throw new Error("ePackages[".concat(pkgIndex, "].eClassifiers[").concat(cIndex, "]: eReferences must be an array"));
                }
                classifier.eReferences.forEach(function (ref, rIndex) {
                    _this.validateEReference(ref, pkgIndex, cIndex, rIndex);
                });
            }
        };
        /**
         * Validate EAttribute structure
         */
        EcoreParser_1.prototype.validateEAttribute = function (attr, pkgIndex, cIndex, aIndex) {
            if (!attr.name || typeof attr.name !== 'string') {
                throw new Error("ePackages[".concat(pkgIndex, "].eClassifiers[").concat(cIndex, "].eAttributes[").concat(aIndex, "]: Missing or invalid name"));
            }
            if (!attr.eType) {
                throw new Error("ePackages[".concat(pkgIndex, "].eClassifiers[").concat(cIndex, "].eAttributes[").concat(aIndex, "]: Missing eType"));
            }
            if (typeof attr.lowerBound !== 'number' || attr.lowerBound < 0) {
                throw new Error("ePackages[".concat(pkgIndex, "].eClassifiers[").concat(cIndex, "].eAttributes[").concat(aIndex, "]: Invalid lowerBound"));
            }
            if (typeof attr.upperBound !== 'number' || (attr.upperBound < -1 && attr.upperBound !== -1)) {
                throw new Error("ePackages[".concat(pkgIndex, "].eClassifiers[").concat(cIndex, "].eAttributes[").concat(aIndex, "]: Invalid upperBound"));
            }
        };
        /**
         * Validate EReference structure
         */
        EcoreParser_1.prototype.validateEReference = function (ref, pkgIndex, cIndex, rIndex) {
            if (!ref.name || typeof ref.name !== 'string') {
                throw new Error("ePackages[".concat(pkgIndex, "].eClassifiers[").concat(cIndex, "].eReferences[").concat(rIndex, "]: Missing or invalid name"));
            }
            if (!ref.eType) {
                throw new Error("ePackages[".concat(pkgIndex, "].eClassifiers[").concat(cIndex, "].eReferences[").concat(rIndex, "]: Missing eType"));
            }
            if (typeof ref.lowerBound !== 'number' || ref.lowerBound < 0) {
                throw new Error("ePackages[".concat(pkgIndex, "].eClassifiers[").concat(cIndex, "].eReferences[").concat(rIndex, "]: Invalid lowerBound"));
            }
            if (typeof ref.upperBound !== 'number' || (ref.upperBound < -1 && ref.upperBound !== -1)) {
                throw new Error("ePackages[".concat(pkgIndex, "].eClassifiers[").concat(cIndex, "].eReferences[").concat(rIndex, "]: Invalid upperBound"));
            }
        };
        /**
         * Convert JSON object to EcoreModel format
         */
        EcoreParser_1.prototype.convertJsonToEcoreModel = function (jsonObject) {
            var _this = this;
            var ecoreModel = {
                ePackages: []
            };
            if (jsonObject.ePackages && Array.isArray(jsonObject.ePackages)) {
                ecoreModel.ePackages = jsonObject.ePackages.map(function (pkg) { return _this.convertJsonToEPackage(pkg); });
            }
            return ecoreModel;
        };
        /**
         * Convert JSON package to EPackage format using ecore-ts
         */
        EcoreParser_1.prototype.convertJsonToEPackage = function (pkg) {
            var _this = this;
            var epackage = ecore_types_1.EPackage.create({
                name: pkg.name || '',
                nsURI: pkg.nsURI || '',
                nsPrefix: pkg.nsPrefix || ''
            });
            // Add classifiers
            if (pkg.eClassifiers && Array.isArray(pkg.eClassifiers)) {
                pkg.eClassifiers.forEach(function (classifier) {
                    var eclassifier = _this.convertJsonToEClassifier(classifier);
                    if (eclassifier) {
                        epackage.get('eClassifiers').add(eclassifier);
                    }
                });
            }
            return epackage;
        };
        /**
         * Convert JSON classifier to EClassifier format using ecore-ts
         */
        EcoreParser_1.prototype.convertJsonToEClassifier = function (classifier) {
            var _this = this;
            // Determine if this is an EClass, EDataType, or EEnum
            if (classifier.eAttributes || classifier.eReferences || classifier.eSuperTypes || classifier.abstract !== undefined || classifier.interface !== undefined) {
                // This is an EClass
                var eclass_1 = ecore_types_1.EClass.create({
                    name: classifier.name || '',
                    abstract: classifier.abstract === true,
                    interface: classifier.interface === true
                });
                // Add super types
                if (classifier.eSuperTypes && Array.isArray(classifier.eSuperTypes)) {
                    classifier.eSuperTypes.forEach(function (superType) {
                        // For now, we'll store the super type name and resolve it later
                        // This is a limitation of the current approach
                        console.log("Super type: ".concat(superType.name));
                    });
                }
                // Add structural features (attributes and references)
                if (classifier.eAttributes && Array.isArray(classifier.eAttributes)) {
                    classifier.eAttributes.forEach(function (attr) {
                        var eattribute = _this.convertJsonToEAttribute(attr);
                        if (eattribute) {
                            eclass_1.get('eStructuralFeatures').add(eattribute);
                        }
                    });
                }
                if (classifier.eReferences && Array.isArray(classifier.eReferences)) {
                    classifier.eReferences.forEach(function (ref) {
                        var ereference = _this.convertJsonToEReference(ref);
                        if (ereference) {
                            eclass_1.get('eStructuralFeatures').add(ereference);
                        }
                    });
                }
                return eclass_1;
            }
            else if (classifier.eLiterals) {
                // This is an EEnum
                var eenum_1 = ecore_types_1.EEnum.create({
                    name: classifier.name || ''
                });
                // Add enum literals
                if (classifier.eLiterals && Array.isArray(classifier.eLiterals)) {
                    classifier.eLiterals.forEach(function (literal) {
                        var eenumLiteral = _this.convertJsonToEEnumLiteral(literal);
                        if (eenumLiteral) {
                            eenum_1.get('eLiterals').add(eenumLiteral);
                        }
                    });
                }
                return eenum_1;
            }
            else {
                // This is an EDataType
                return ecore_types_1.EDataType.create({
                    name: classifier.name || '',
                    instanceClassName: classifier.instanceClassName || 'java.lang.String'
                });
            }
        };
        /**
         * Convert JSON attribute to EAttribute format using ecore-ts
         */
        EcoreParser_1.prototype.convertJsonToEAttribute = function (attr) {
            var _a;
            // Map type names to ecore-ts types
            var eType = this.mapTypeNameToEcoreType((_a = attr.eType) === null || _a === void 0 ? void 0 : _a.name);
            return ecore_types_1.EAttribute.create({
                name: attr.name || '',
                eType: eType,
                lowerBound: typeof attr.lowerBound === 'number' ? attr.lowerBound : 0,
                upperBound: typeof attr.upperBound === 'number' ? attr.upperBound : 1,
                unique: attr.unique !== false,
                ordered: attr.ordered !== false
            });
        };
        /**
         * Convert JSON reference to EReference format using ecore-ts
         */
        EcoreParser_1.prototype.convertJsonToEReference = function (ref) {
            var _a;
            // Map type names to ecore-ts types
            var eType = this.mapTypeNameToEcoreType((_a = ref.eType) === null || _a === void 0 ? void 0 : _a.name);
            return ecore_types_1.EReference.create({
                name: ref.name || '',
                eType: eType,
                lowerBound: typeof ref.lowerBound === 'number' ? ref.lowerBound : 0,
                upperBound: typeof ref.upperBound === 'number' ? ref.upperBound : 1,
                unique: ref.unique !== false,
                ordered: ref.ordered !== false,
                containment: ref.containment === true,
                container: ref.container === true,
                resolveProxies: ref.resolveProxies !== false
            });
        };
        /**
         * Convert JSON enum literal to EEnumLiteral format using ecore-ts
         */
        EcoreParser_1.prototype.convertJsonToEEnumLiteral = function (literal) {
            var EEnumLiteral = require('ecore-ts').EEnumLiteral;
            return EEnumLiteral.create({
                name: literal.name || '',
                value: literal.value || 0,
                literal: literal.literal || literal.name || ''
            });
        };
        /**
         * Map type names to ecore-ts built-in types
         */
        EcoreParser_1.prototype.mapTypeNameToEcoreType = function (typeName) {
            if (!typeName) {
                return ecore_types_1.EString; // Default to String
            }
            switch (typeName.toLowerCase()) {
                case 'estring':
                case 'string':
                    return ecore_types_1.EString;
                case 'eboolean':
                case 'boolean':
                    return ecore_types_1.EBoolean;
                case 'eint':
                case 'int':
                case 'integer':
                    return ecore_types_1.EInt;
                case 'edouble':
                case 'double':
                    return ecore_types_1.EDouble;
                default:
                    // For custom types, we'll need to resolve them later
                    // For now, return a placeholder
                    console.log("Unknown type: ".concat(typeName, ", using EString as fallback"));
                    return ecore_types_1.EString;
            }
        };
        /**
         * Convert XML result to EcoreModel (maintains backward compatibility)
         */
        EcoreParser_1.prototype.convertXmlToEcoreModel = function (xmlResult) {
            var _this = this;
            console.log('XML parsing result:', JSON.stringify(xmlResult, null, 2));
            var ecoreModel = {
                ePackages: []
            };
            // Check for different possible XML structures
            var packages = [];
            if (xmlResult['ecore:EPackage']) {
                packages = Array.isArray(xmlResult['ecore:EPackage'])
                    ? xmlResult['ecore:EPackage']
                    : [xmlResult['ecore:EPackage']];
            }
            else if (xmlResult.ePackage) {
                packages = Array.isArray(xmlResult.ePackage)
                    ? xmlResult.ePackage
                    : [xmlResult.ePackage];
            }
            else if (xmlResult.ecore && xmlResult.ecore.ePackage) {
                packages = Array.isArray(xmlResult.ecore.ePackage)
                    ? xmlResult.ecore.ePackage
                    : [xmlResult.ecore.ePackage];
            }
            console.log('Found packages:', packages);
            ecoreModel.ePackages = packages.map(function (pkg) { return _this.convertXmlToEPackage(pkg); });
            return ecoreModel;
        };
        /**
         * Convert XML package to EPackage (maintains backward compatibility)
         */
        EcoreParser_1.prototype.convertXmlToEPackage = function (pkgXml) {
            var _this = this;
            var pkg = {
                name: pkgXml.$.name || '',
                nsURI: pkgXml.$.nsURI || '',
                nsPrefix: pkgXml.$.nsPrefix || '',
                eClassifiers: []
            };
            if (pkgXml.eClassifiers) {
                var classifiers = [];
                if (Array.isArray(pkgXml.eClassifiers)) {
                    classifiers = pkgXml.eClassifiers;
                }
                else if (pkgXml.eClassifiers.eClassifier) {
                    classifiers = Array.isArray(pkgXml.eClassifiers.eClassifier)
                        ? pkgXml.eClassifiers.eClassifier
                        : [pkgXml.eClassifiers.eClassifier];
                }
                pkg.eClassifiers = classifiers.map(function (classifier) { return _this.convertXmlToEClassifier(classifier); });
            }
            return pkg;
        };
        /**
         * Convert XML classifier to EClassifier (maintains backward compatibility)
         */
        EcoreParser_1.prototype.convertXmlToEClassifier = function (classifierXml) {
            if (classifierXml.$.xsiType === 'ecore:EClass' || classifierXml.eAttributes || classifierXml.eReferences) {
                return this.convertXmlToEClass(classifierXml);
            }
            else if (classifierXml.$.xsiType === 'ecore:EDataType' || classifierXml.$.instanceClassName) {
                return this.convertXmlToEDataType(classifierXml);
            }
            else if (classifierXml.$.xsiType === 'ecore:EEnum' || classifierXml.eLiterals) {
                return this.convertXmlToEEnum(classifierXml);
            }
            else {
                return this.convertXmlToEClass(classifierXml);
            }
        };
        /**
         * Convert XML class to EClass (maintains backward compatibility)
         */
        EcoreParser_1.prototype.convertXmlToEClass = function (classXml) {
            var _this = this;
            var eClass = {
                name: classXml.$.name || '',
                eAttributes: [],
                eReferences: [],
                eSuperTypes: [],
                abstract: classXml.$.abstract === 'true',
                interface: classXml.$.interface === 'true'
            };
            // Parse structural features
            if (classXml.eStructuralFeatures) {
                var features = Array.isArray(classXml.eStructuralFeatures)
                    ? classXml.eStructuralFeatures
                    : [classXml.eStructuralFeatures];
                features.forEach(function (feature) {
                    if (feature.$ && feature.$.xsiType === 'ecore:EAttribute') {
                        eClass.eAttributes.push(_this.convertXmlToEAttribute(feature));
                    }
                    else if (feature.$ && feature.$.xsiType === 'ecore:EReference') {
                        eClass.eReferences.push(_this.convertXmlToEReference(feature));
                    }
                });
            }
            // Parse attributes (legacy support)
            if (classXml.eAttributes && classXml.eAttributes.eAttribute) {
                var attributes = Array.isArray(classXml.eAttributes.eAttribute)
                    ? classXml.eAttributes.eAttribute
                    : [classXml.eAttributes.eAttribute];
                eClass.eAttributes = attributes.map(function (attr) { return _this.convertXmlToEAttribute(attr); });
            }
            // Parse references (legacy support)
            if (classXml.eReferences && classXml.eReferences.eReference) {
                var references = Array.isArray(classXml.eReferences.eReference)
                    ? classXml.eReferences.eReference
                    : [classXml.eReferences.eReference];
                eClass.eReferences = references.map(function (ref) { return _this.convertXmlToEReference(ref); });
            }
            // Parse super types
            if (classXml.eSuperTypes && classXml.eSuperTypes.eClass) {
                var superTypes = Array.isArray(classXml.eSuperTypes.eClass)
                    ? classXml.eSuperTypes.eClass
                    : [classXml.eSuperTypes.eClass];
                eClass.eSuperTypes = superTypes.map(function (superType) { return ({
                    name: superType.$.href ? _this.extractClassNameFromHref(superType.$.href) : superType.$.name || '',
                    eAttributes: [],
                    eReferences: [],
                    eSuperTypes: [],
                    abstract: false,
                    interface: false
                }); });
            }
            return eClass;
        };
        /**
         * Convert XML attribute to EAttribute (maintains backward compatibility)
         */
        EcoreParser_1.prototype.convertXmlToEAttribute = function (attrXml) {
            return {
                name: attrXml.$.name || '',
                eType: {
                    name: attrXml.$.eType ? this.extractClassNameFromHref(attrXml.$.eType) : 'EString',
                    instanceClassName: 'java.lang.String'
                },
                lowerBound: parseInt(attrXml.$.lowerBound) || 0,
                upperBound: parseInt(attrXml.$.upperBound) || 1,
                unique: attrXml.$.unique !== 'false',
                ordered: attrXml.$.ordered !== 'false'
            };
        };
        /**
         * Convert XML reference to EReference (maintains backward compatibility)
         */
        EcoreParser_1.prototype.convertXmlToEReference = function (refXml) {
            return {
                name: refXml.$.name || '',
                eType: {
                    name: refXml.$.eType ? this.extractClassNameFromHref(refXml.$.eType) : 'EClass',
                    eAttributes: [],
                    eReferences: [],
                    eSuperTypes: [],
                    abstract: false,
                    interface: false
                },
                eContainingClass: {
                    name: '',
                    eAttributes: [],
                    eReferences: [],
                    eSuperTypes: [],
                    abstract: false,
                    interface: false
                },
                containment: refXml.$.containment === 'true',
                container: refXml.$.container === 'true',
                lowerBound: parseInt(refXml.$.lowerBound) || 0,
                upperBound: parseInt(refXml.$.upperBound) || 1
            };
        };
        /**
         * Convert XML data type to EDataType (maintains backward compatibility)
         */
        EcoreParser_1.prototype.convertXmlToEDataType = function (dataTypeXml) {
            return {
                name: dataTypeXml.$.name || '',
                instanceClassName: dataTypeXml.$.instanceClassName || 'java.lang.Object'
            };
        };
        /**
         * Convert XML enum to EEnum (maintains backward compatibility)
         */
        EcoreParser_1.prototype.convertXmlToEEnum = function (enumXml) {
            var eEnum = {
                name: enumXml.$.name || '',
                eLiterals: []
            };
            if (enumXml.eLiterals && enumXml.eLiterals.eEnumLiteral) {
                var literals = Array.isArray(enumXml.eLiterals.eEnumLiteral)
                    ? enumXml.eLiterals.eEnumLiteral
                    : [enumXml.eLiterals.eEnumLiteral];
                eEnum.eLiterals = literals.map(function (literal) { return ({
                    name: literal.$.name || '',
                    value: parseInt(literal.$.value) || 0
                }); });
            }
            return eEnum;
        };
        /**
         * Extract class name from href (maintains backward compatibility)
         */
        EcoreParser_1.prototype.extractClassNameFromHref = function (href) {
            if (href.startsWith('#//')) {
                return href.substring(3);
            }
            else if (href.startsWith('ecore:')) {
                return href.substring(6);
            }
            return href;
        };
        return EcoreParser_1;
    }());
    __setFunctionName(_classThis, "EcoreParser");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        EcoreParser = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return EcoreParser = _classThis;
}();
exports.EcoreParser = EcoreParser;

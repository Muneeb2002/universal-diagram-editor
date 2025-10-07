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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isEClass = isEClass;
exports.isEDataType = isEDataType;
exports.isEEnum = isEEnum;
exports.isEAttribute = isEAttribute;
exports.isEReference = isEReference;
exports.isEStructuralFeature = isEStructuralFeature;
/**
 * Re-export types from ecore-ts library
 * This provides the complete Ecore metamodel implementation
 */
// Re-export all from ecore-ts
__exportStar(require("ecore-ts"), exports);
// Type guards using ecore-ts instances
function isEClass(classifier) {
    return classifier && classifier.eClass && classifier.eClass.values && classifier.eClass.values.name === 'EClass';
}
function isEDataType(classifier) {
    return classifier && classifier.eClass && classifier.eClass.values && classifier.eClass.values.name === 'EDataType';
}
function isEEnum(classifier) {
    return classifier && classifier.eClass && classifier.eClass.values && classifier.eClass.values.name === 'EEnum';
}
function isEAttribute(feature) {
    return feature && feature.eClass && feature.eClass.values && feature.eClass.values.name === 'EAttribute';
}
function isEReference(feature) {
    return feature && feature.eClass && feature.eClass.values && feature.eClass.values.name === 'EReference';
}
function isEStructuralFeature(element) {
    return element && element.eClass && element.eClass.values &&
        (element.eClass.values.name === 'EStructuralFeature' ||
            element.eClass.values.name === 'EAttribute' ||
            element.eClass.values.name === 'EReference');
}

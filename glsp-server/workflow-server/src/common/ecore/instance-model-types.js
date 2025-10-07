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
Object.defineProperty(exports, "__esModule", { value: true });
exports.InstanceFactory = void 0;
/**
 * Factory for creating new Ecore instances.
 */
var InstanceFactory = /** @class */ (function () {
    function InstanceFactory() {
        this.instanceCounter = 0;
    }
    /**
     * Creates a new instance of the specified EClass.
     * @param eClassName The name of the EClass
     * @param metamodelKey The key of the metamodel
     * @param position Optional initial position
     * @returns A new EcoreInstance with default values
     */
    InstanceFactory.prototype.createInstance = function (eClassName, metamodelKey, position) {
        var id = this.generateInstanceId(eClassName);
        return {
            id: id,
            eClassName: eClassName,
            metamodelKey: metamodelKey,
            attributes: new Map(),
            references: new Map(),
            position: position,
            size: { width: 200, height: 100 }
        };
    };
    /**
     * Generates a unique instance ID.
     * @param eClassName The name of the EClass
     * @returns A unique instance ID
     */
    InstanceFactory.prototype.generateInstanceId = function (eClassName) {
        this.instanceCounter++;
        return "".concat(eClassName, "_").concat(this.instanceCounter);
    };
    /**
     * Resets the instance counter.
     */
    InstanceFactory.prototype.resetCounter = function () {
        this.instanceCounter = 0;
    };
    return InstanceFactory;
}());
exports.InstanceFactory = InstanceFactory;

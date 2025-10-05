/********************************************************************************
 * Copyright (c) 2024 Eclipse GLSP and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * SPDX-License-Identifier: EPL-2.0
 ********************************************************************************/

/**
 * Represents an instance of an Ecore class.
 */
export interface EcoreInstance {
    /** Unique identifier for this instance */
    id: string;
    
    /** The name of the EClass this is an instance of */
    eClassName: string;
    
    /** The metamodel key this instance belongs to */
    metamodelKey: string;
    
    /** Attribute values keyed by attribute name */
    attributes: Map<string, any>;
    
    /** Reference values keyed by reference name. Values are instance IDs. */
    references: Map<string, string | string[]>;
    
    /** Position in the diagram */
    position?: { x: number; y: number };
    
    /** Size in the diagram */
    size?: { width: number; height: number };
}

/**
 * Represents the complete instance model.
 */
export interface InstanceModel {
    /** The metamodel key this instance model conforms to */
    metamodelKey: string;
    
    /** All instances in this model, keyed by instance ID */
    instances: Map<string, EcoreInstance>;
    
    /** The root instances (not contained by other instances) */
    rootInstances: Set<string>;
}

/**
 * Factory for creating new Ecore instances.
 */
export class InstanceFactory {
    private instanceCounter = 0;

    /**
     * Creates a new instance of the specified EClass.
     * @param eClassName The name of the EClass
     * @param metamodelKey The key of the metamodel
     * @param position Optional initial position
     * @returns A new EcoreInstance with default values
     */
    createInstance(eClassName: string, metamodelKey: string, position?: { x: number; y: number }): EcoreInstance {
        const id = this.generateInstanceId(eClassName);
        
        return {
            id,
            eClassName,
            metamodelKey,
            attributes: new Map(),
            references: new Map(),
            position,
            size: { width: 200, height: 100 }
        };
    }

    /**
     * Generates a unique instance ID.
     * @param eClassName The name of the EClass
     * @returns A unique instance ID
     */
    private generateInstanceId(eClassName: string): string {
        this.instanceCounter++;
        return `${eClassName}_${this.instanceCounter}`;
    }

    /**
     * Resets the instance counter.
     */
    resetCounter(): void {
        this.instanceCounter = 0;
    }
}

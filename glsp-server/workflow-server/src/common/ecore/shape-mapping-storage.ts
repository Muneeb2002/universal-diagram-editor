/********************************************************************************
 * Copyright (c) 2024 Eclipse GLSP and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * SPDX-License-Identifier: EPL-2.0
 ********************************************************************************/

import { injectable } from 'inversify';

export interface ShapeConfig {
    type: string;
    width: number;
    height: number;
    color: string;
    fillColor: string;
    filled?: boolean;
    lineThickness: number;
    lineStyle: 'solid' | 'dashed' | 'dotted';
    arrowType?: 'filled-triangle' | 'open-triangle' | 'open-arrow' | 'diamond' | 'none';
    svgContent?: string;
}

export interface ShapeMapping {
    className: string;
    shapeId: string;
    shapeName: string;
    shapeConfig: ShapeConfig;
    // Optional enum conditions for submappings
    enumAttribute?: string; // Name of the enum attribute (e.g., "Status")
    enumValue?: string; // Value of the enum literal (e.g., "Active", "Pending")
    // Optional source and target class configurations (multiple pairs allowed)
    sourceTargetPairs?: Array<{
        sourceClass: string;
        targetClass: string;
    }>;
}

@injectable()
export class ShapeMappingStorage {
    protected mappings: Map<string, ShapeMapping> = new Map();

    public updateMappings(mappings: ShapeMapping[]): void {
        this.mappings.clear();
        for (const mapping of mappings) {
            if (mapping?.className && mapping?.shapeConfig) {
                // Use composite key for submappings, className for base mappings
                const mappingKey = mapping.enumAttribute && mapping.enumValue
                    ? this.getMappingKey(mapping.className, mapping.enumAttribute, mapping.enumValue)
                    : this.getMappingKey(mapping.className);
                this.mappings.set(mappingKey, mapping);
            }
        }
        console.log('[ShapeMappingStorage] Updated mappings for', this.mappings.size, 'classes/submappings');
    }

    /**
     * Get mapping key for a class, optionally with enum conditions
     */
    private getMappingKey(className: string, enumAttribute?: string, enumValue?: string): string {
        if (enumAttribute && enumValue) {
            return `${className}:${enumAttribute}:${enumValue}`;
        }
        return className;
    }

    /**
     * Get mapping for a class, optionally with enum conditions.
     * If a submapping exists for the given enum attribute and value, it will be returned.
     * Otherwise, the base mapping (if any) will be returned.
     */
    public getMapping(className: string, enumAttribute?: string, enumValue?: string): ShapeMapping | undefined {
        // First try to get submapping if enum conditions are provided
        if (enumAttribute && enumValue) {
            const subMappingKey = this.getMappingKey(className, enumAttribute, enumValue);
            const subMapping = this.mappings.get(subMappingKey);
            if (subMapping) {
                return subMapping;
            }
        }
        // Fall back to base mapping
        const baseMappingKey = this.getMappingKey(className);
        return this.mappings.get(baseMappingKey);
    }

    public clear(): void {
        this.mappings.clear();
    }
}


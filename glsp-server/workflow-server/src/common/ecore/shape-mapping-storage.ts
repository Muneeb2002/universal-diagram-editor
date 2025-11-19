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
    lineThickness: number;
    lineStyle: 'solid' | 'dashed' | 'dotted';
    arrowType?: 'filled-triangle' | 'open-triangle' | 'open-arrow' | 'diamond' | 'none';
}

export interface ShapeMapping {
    className: string;
    shapeId: string;
    shapeName: string;
    shapeConfig: ShapeConfig;
}

@injectable()
export class ShapeMappingStorage {
    protected mappings: Map<string, ShapeMapping> = new Map();

    public updateMappings(mappings: ShapeMapping[]): void {
        this.mappings.clear();
        for (const mapping of mappings) {
            if (mapping?.className && mapping?.shapeConfig) {
                this.mappings.set(mapping.className, mapping);
            }
        }
        console.log('[ShapeMappingStorage] Updated mappings for', this.mappings.size, 'classes');
    }

    public getMapping(className: string): ShapeMapping | undefined {
        return this.mappings.get(className);
    }

    public clear(): void {
        this.mappings.clear();
    }
}


/**********************************************************************************
 * Copyright (c) 2024 Eclipse GLSP and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * SPDX-License-Identifier: EPL-2.0
 *********************************************************************************/

/**
 * Available shape types for class instances
 */
export type ShapeType = 
    | 'rectangle';

/**
 * Available color schemes for class instances
 */
export type ColorScheme = 
    | 'black';

/**
 * Visual configuration for a single class
 */
export interface ClassVisualConfiguration {
    /** The name of the EClass this configuration applies to */
    className: string;
    
    /** The shape type for instances of this class */
    shape: ShapeType;
    
    /** The color scheme for instances of this class */
    color: ColorScheme;
    
    /** Whether the figure should be filled (true) or outlined only (false) */
    filled?: boolean;
    
    /** Custom border style (optional) */
    border?: {
        width?: number;
        style: 'solid' | 'dashed' | 'dotted';
    };
    
    /** Whether to show attribute values in the instance */
    showAttributes: boolean;
    
    /** Whether to show reference names in the instance */
    showReferences: boolean;
}

/**
 * Complete visual configuration for a metamodel
 */
export interface MetamodelVisualConfiguration {
    /** The metamodel key this configuration applies to */
    metamodelKey: string;
    
    /** Visual configurations for each class */
    classConfigurations: Map<string, ClassVisualConfiguration>;
    
    /** Default configuration for new classes */
    defaultConfiguration: ClassVisualConfiguration;
}

/**
 * Predefined shape definitions with SVG paths
 */
export const SHAPE_DEFINITIONS: Record<ShapeType, string> = {
    rectangle: 'M0,0 L100,0 L100,60 L0,60 Z'
};

/**
 * Predefined color schemes with CSS values
 */
export const COLOR_SCHEMES: Record<ColorScheme, { fill: string; stroke: string; text: string }> = {
    black: { fill: '#1B1B1B', stroke: '#000000', text: '#FFFFFF' }
};

/**
 * Default visual configuration for new classes
 */
export const DEFAULT_CLASS_VISUAL_CONFIG: ClassVisualConfiguration = {
    className: '',
    shape: 'rectangle',
    color: 'black',
    filled: false,
    showAttributes: true,
    showReferences: false
};

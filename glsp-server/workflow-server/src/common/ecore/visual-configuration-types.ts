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
    | 'rectangle'
    | 'circle'
    | 'ellipse'
    | 'arrow';

/**
 * Available color schemes for class instances
 */
export type ColorScheme = 
    | 'black'
    | 'blue'
    | 'red'
    | 'white'
    | 'grey';

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
    rectangle: 'M0,0 L100,0 L100,60 L0,60 Z',
    circle: 'M50,0 A50,50 0 1,1 50,100 A50,50 0 1,1 50,0',
    ellipse: 'M0,30 A50,30 0 1,1 100,30 A50,30 0 1,1 0,30',
    arrow: 'M10,30 L100,30 M100,30 L85,20 M100,30 L85,40'
};

/**
 * Predefined color schemes with CSS values
 */
export const COLOR_SCHEMES: Record<ColorScheme, { fill: string; stroke: string; text: string }> = {
    black: { fill: '#1B1B1B', stroke: '#000000', text: '#FFFFFF' },
    blue: { fill: '#E3F2FD', stroke: '#1976D2', text: '#0D47A1' },
    red: { fill: '#FFEBEE', stroke: '#D32F2F', text: '#B71C1C' },
    white: { fill: '#FFFFFF', stroke: '#9E9E9E', text: '#000000' },
    grey: { fill: '#F5F5F5', stroke: '#616161', text: '#212121' }
};

/**
 * Default visual configuration for new classes
 */
export const DEFAULT_CLASS_VISUAL_CONFIG: ClassVisualConfiguration = {
    className: '',
    shape: 'rectangle',
    color: 'black',
    filled: true,
    showAttributes: true,
    showReferences: false
};

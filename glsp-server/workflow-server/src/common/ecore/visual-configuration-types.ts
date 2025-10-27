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
    | 'blue'
    | 'green'
    | 'red'
    | 'orange'
    | 'purple'
    | 'pink'
    | 'yellow'
    | 'gray'
    | 'brown'
    | 'cyan';

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
    
    /** Custom size override (optional) */
    size?: {
        width: number;
        height: number;
    };
    
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
    blue: { fill: '#E3F2FD', stroke: '#1976D2', text: '#0D47A1' },
    green: { fill: '#E8F5E8', stroke: '#388E3C', text: '#1B5E20' },
    red: { fill: '#FFEBEE', stroke: '#D32F2F', text: '#B71C1C' },
    orange: { fill: '#FFF3E0', stroke: '#F57C00', text: '#E65100' },
    purple: { fill: '#F3E5F5', stroke: '#7B1FA2', text: '#4A148C' },
    pink: { fill: '#FCE4EC', stroke: '#C2185B', text: '#880E4F' },
    yellow: { fill: '#FFFDE7', stroke: '#FBC02D', text: '#F57F17' },
    gray: { fill: '#F5F5F5', stroke: '#616161', text: '#212121' },
    brown: { fill: '#EFEBE9', stroke: '#5D4037', text: '#3E2723' },
    cyan: { fill: '#E0F2F1', stroke: '#00796B', text: '#004D40' }
};

/**
 * Default visual configuration for new classes
 */
export const DEFAULT_CLASS_VISUAL_CONFIG: ClassVisualConfiguration = {
    className: '',
    shape: 'rectangle',
    color: 'blue',
    showAttributes: true,
    showReferences: false
};

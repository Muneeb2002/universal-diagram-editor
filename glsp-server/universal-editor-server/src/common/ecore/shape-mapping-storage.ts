/**
 * @author Abigail Sotomayor <s205720@dtu.dk>
 */
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
    enumAttribute?: string;
    enumValue?: string;
    sourceReferenceName?: string;
    targetReferenceName?: string;
    sourceClass?: string;
    targetClass?: string;
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
                const mappingKey = mapping.enumAttribute && mapping.enumValue
                    ? this.getMappingKey(mapping.className, mapping.enumAttribute, mapping.enumValue)
                    : this.getMappingKey(mapping.className);
                this.mappings.set(mappingKey, mapping);
            }
        }
        console.log('[ShapeMappingStorage] Updated mappings for', this.mappings.size, 'classes/submappings');
    }

    
    private getMappingKey(className: string, enumAttribute?: string, enumValue?: string): string {
        if (enumAttribute && enumValue) {
            return `${className}:${enumAttribute}:${enumValue}`;
        }
        return className;
    }

    public getMapping(className: string, enumAttribute?: string, enumValue?: string): ShapeMapping | undefined {
        if (enumAttribute && enumValue) {
            const subMappingKey = this.getMappingKey(className, enumAttribute, enumValue);
            const subMapping = this.mappings.get(subMappingKey);
            if (subMapping) {
                return subMapping;
            }
        }
        const baseMappingKey = this.getMappingKey(className);
        return this.mappings.get(baseMappingKey);
    }

    public clear(): void {
        this.mappings.clear();
    }
}


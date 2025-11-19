import { injectable, inject } from 'inversify';
import { ActionHandler } from '@eclipse-glsp/server';
import { Action, MessageAction } from '@eclipse-glsp/protocol';
import { SaveShapeMappingsAction } from './ecore-actions';
import { ShapeMappingStorage, ShapeMapping } from './shape-mapping-storage';
import * as fs from 'fs';
import * as path from 'path';

@injectable()
export class SaveShapeMappingsActionHandler implements ActionHandler {
    actionKinds = [SaveShapeMappingsAction.KIND];

    @inject(ShapeMappingStorage)
    protected shapeMappingStorage: ShapeMappingStorage;

    async execute(action: Action): Promise<Action[]> {
        if (!SaveShapeMappingsAction.is(action)) {
            return [];
        }

        try {
            this.updateActiveMappings(action.content);

            const filename = this.ensureJsonExtension(action.filename?.trim() ?? 'shape-mappings.json');
            const targetPath = this.resolveTargetPath(filename);
            fs.mkdirSync(path.dirname(targetPath), { recursive: true });
            fs.writeFileSync(targetPath, action.content, { encoding: 'utf8' });

            console.log(`Saved shape mappings to ${targetPath}`);

            return [
                MessageAction.create(`Shape mappings saved to ${targetPath}`, { severity: 'INFO' })
            ];
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error('Error saving shape mappings:', error);

            return [
                MessageAction.create(`Failed to save shape mappings: ${message}`, { severity: 'ERROR' })
            ];
        }
    }

    private updateActiveMappings(content: string): void {
        try {
            const parsed = JSON.parse(content);
            const mappings = parsed?.mappings;
            if (Array.isArray(mappings)) {
                this.shapeMappingStorage.updateMappings(mappings as ShapeMapping[]);
            } else {
                this.shapeMappingStorage.clear();
            }
        } catch (error) {
            console.warn('[SaveShapeMappings] Failed to parse mapping content:', error);
            this.shapeMappingStorage.clear();
        }
    }

    private resolveTargetPath(filename: string): string {
        if (path.isAbsolute(filename)) {
            return filename;
        }
        const baseDir = path.resolve(process.cwd(), 'samples', 'mappings');
        return path.resolve(baseDir, filename);
    }

    private ensureJsonExtension(filename: string): string {
        if (!filename.toLowerCase().endsWith('.json')) {
            return `${filename}.json`;
        }
        return filename;
    }
}


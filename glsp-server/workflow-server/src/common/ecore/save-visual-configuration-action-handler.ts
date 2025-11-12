import { injectable, inject } from 'inversify';
import { ActionHandler } from '@eclipse-glsp/server';
import { Action, MessageAction } from '@eclipse-glsp/protocol';
import { SaveVisualConfigurationAction } from './ecore-actions';
import { VisualConfigurationStorage } from './visual-configuration-storage';
import { ClassVisualConfiguration } from './visual-configuration-types';
import { MetamodelRegistry } from './metamodel-registry';
import * as fs from 'fs';
import * as path from 'path';

@injectable()
export class SaveVisualConfigurationActionHandler implements ActionHandler {
    actionKinds = [SaveVisualConfigurationAction.KIND];

    @inject(VisualConfigurationStorage)
    protected visualConfigStorage: VisualConfigurationStorage;

    @inject(MetamodelRegistry)
    protected metamodelRegistry: MetamodelRegistry;

    async execute(action: Action): Promise<Action[]> {
        if (!SaveVisualConfigurationAction.is(action)) {
            return [];
        }

        try {
            const activeMetamodelKey = this.metamodelRegistry.getActiveMetamodelKey();
            if (!activeMetamodelKey) {
                return [
                    MessageAction.create(
                        'No active metamodel found. Please load a metamodel before saving visual configurations.',
                        { severity: 'WARNING' }
                    )
                ];
            }

            const visualConfig = this.visualConfigStorage.getOrCreateActiveVisualConfiguration();
            const payload = {
                metamodelKey: activeMetamodelKey,
                defaultConfiguration: visualConfig.defaultConfiguration,
                classConfigurations: Array.from(visualConfig.classConfigurations.entries()).reduce((acc, [className, config]) => {
                    acc[className] = config;
                    return acc;
                }, {} as Record<string, ClassVisualConfiguration>)
            };

            const requested = action.filename?.trim() ?? '';
            const filename = this.ensureJsonExtension(requested.length > 0 ? requested : `${this.sanitizeKey(activeMetamodelKey)}-visual-configuration.json`);
            const targetPath = this.resolveTargetPath(filename);

            fs.mkdirSync(path.dirname(targetPath), { recursive: true });
            fs.writeFileSync(targetPath, JSON.stringify(payload, null, 2), { encoding: 'utf8' });

            console.log(`Saved visual configuration to ${targetPath}`);

            return [
                MessageAction.create(
                    `Visual configuration saved to ${targetPath}`,
                    { severity: 'INFO' }
                )
            ];
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error('Error saving visual configuration:', error);
            return [
                MessageAction.create(
                    `Failed to save visual configuration: ${message}`,
                    { severity: 'ERROR' }
                )
            ];
        }
    }

    private resolveTargetPath(filename: string): string {
        if (path.isAbsolute(filename)) {
            return filename;
        }
        const baseDir = path.resolve(process.cwd(), 'samples', 'visual-configurations');
        return path.resolve(baseDir, filename);
    }

    private ensureJsonExtension(filename: string): string {
        if (!filename.toLowerCase().endsWith('.json')) {
            return `${filename}.json`;
        }
        return filename;
    }

    private sanitizeKey(key: string): string {
        return key.replace(/[^\w.-]+/g, '_');
    }
}


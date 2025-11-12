import { injectable, inject } from 'inversify';
import { ActionHandler } from '@eclipse-glsp/server';
import { Action, MessageAction } from '@eclipse-glsp/protocol';
import { LoadVisualConfigurationAction } from './ecore-actions';
import { VisualConfigurationStorage } from './visual-configuration-storage';
import { MetamodelRegistry } from './metamodel-registry';
import { ClassVisualConfiguration } from './visual-configuration-types';
import * as fs from 'fs';
import * as path from 'path';

interface SerializedVisualConfiguration {
    metamodelKey?: string;
    defaultConfiguration?: Partial<ClassVisualConfiguration>;
    classConfigurations?: Record<string, ClassVisualConfiguration>;
}

@injectable()
export class LoadVisualConfigurationActionHandler implements ActionHandler {
    actionKinds = [LoadVisualConfigurationAction.KIND];

    @inject(VisualConfigurationStorage)
    protected visualConfigStorage: VisualConfigurationStorage;

    @inject(MetamodelRegistry)
    protected metamodelRegistry: MetamodelRegistry;

    async execute(action: Action): Promise<Action[]> {
        if (!LoadVisualConfigurationAction.is(action)) {
            return [];
        }

        try {
            const activeMetamodelKey = this.metamodelRegistry.getActiveMetamodelKey();
            if (!activeMetamodelKey) {
                return [
                    MessageAction.create(
                        'No active metamodel found. Please load a metamodel before loading visual configurations.',
                        { severity: 'WARNING' }
                    )
                ];
            }

            let parsed: SerializedVisualConfiguration | undefined;
            let sourceDescription = 'uploaded visual configuration';

            if (action.content && action.content.trim().length > 0) {
                parsed = JSON.parse(action.content) as SerializedVisualConfiguration;
                if (action.filename) {
                    sourceDescription = `uploaded visual configuration '${action.filename}'`;
                }
            } else {
                const requested = action.filename?.trim() ?? '';
                const filename = this.ensureJsonExtension(
                    requested.length > 0 ? requested : `${this.sanitizeKey(activeMetamodelKey)}-visual-configuration.json`
                );
                const sourcePath = this.findExistingPath(filename);

                if (!sourcePath) {
                    return [
                        MessageAction.create(
                            `Could not find visual configuration file '${filename}'.`,
                            { severity: 'ERROR' }
                        )
                    ];
                }

                const raw = fs.readFileSync(sourcePath, { encoding: 'utf8' });
                parsed = JSON.parse(raw) as SerializedVisualConfiguration;
                sourceDescription = `${sourcePath}`;
            }

            if (!parsed) {
                return [
                    MessageAction.create(
                        'No visual configuration data provided.',
                        { severity: 'ERROR' }
                    )
                ];
            }

            this.visualConfigStorage.loadVisualConfiguration(parsed);

            const mismatch = parsed.metamodelKey && parsed.metamodelKey !== activeMetamodelKey;
            const severity = mismatch ? 'WARNING' : 'INFO';
            const details = mismatch
                ? ` (file targets '${parsed.metamodelKey}', but current metamodel is '${activeMetamodelKey}')`
                : '';

            console.log(`Loaded visual configuration from ${sourceDescription}${details}`);

            return [
                MessageAction.create(
                    `Visual configuration loaded from ${sourceDescription}${details}`,
                    { severity }
                )
            ];
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error('Error loading visual configuration:', error);
            return [
                MessageAction.create(
                    `Failed to load visual configuration: ${message}`,
                    { severity: 'ERROR' }
                )
            ];
        }
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

    private findExistingPath(filename: string): string | undefined {
        const candidates: string[] = [];

        if (path.isAbsolute(filename)) {
            candidates.push(filename);
        } else {
            candidates.push(
                path.resolve(process.cwd(), filename),
                path.resolve(process.cwd(), 'samples', 'visual-configurations', filename),
                path.resolve(process.cwd(), 'workflow-server-bundled', 'samples', 'visual-configurations', filename)
            );
        }

        for (const candidate of candidates) {
            if (fs.existsSync(candidate)) {
                return candidate;
            }
        }

        return undefined;
    }
}


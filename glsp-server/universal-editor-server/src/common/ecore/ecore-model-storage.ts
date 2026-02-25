/**
 * @author Abigail Sotomayor <s205720@dtu.dk>
 */
import { injectable, inject } from 'inversify';
import { RequestModelAction, SaveModelAction } from '@eclipse-glsp/protocol';
import { ModelState, SOURCE_URI_ARG, SourceModelStorage } from '@eclipse-glsp/server';
import { EcoreParser } from './ecore-parser';
import { EcoreModel } from './ecore-types';
import { DiagramPositionStorage } from './diagram-position-storage';

@injectable()
export class EcoreModelStorage implements SourceModelStorage {
    @inject(EcoreParser)
    protected ecoreParser: EcoreParser;

    @inject(ModelState)
    protected modelState: ModelState;

    @inject(DiagramPositionStorage)
    protected diagramPositionStorage: DiagramPositionStorage;

    async loadSourceModel(action: RequestModelAction): Promise<void> {
        const sourceUri = this.getSourceUri(action);

        try {
            const jsonObject = this.loadFromFile(sourceUri);

            try {
                const ecoreModel = await this.ecoreParser.parseEcoreJson(JSON.stringify(jsonObject));
                this.modelState.set('ecoreModel', ecoreModel);
                this.modelState.set('modelType', 'ecore');

                if (jsonObject && typeof jsonObject === 'object' && 'diagramPositions' in jsonObject) {
                    const positionsObj = (jsonObject as any).diagramPositions;
                    if (positionsObj && typeof positionsObj === 'object') {
                        const positionsMap = new Map<string, { position?: { x: number; y: number }; size?: { width: number; height: number } }>();
                        for (const [key, value] of Object.entries(positionsObj)) {
                            positionsMap.set(key, value as { position?: { x: number; y: number }; size?: { width: number; height: number } });
                        }
                        this.diagramPositionStorage.restorePositions(positionsMap);
                    }
                }

                console.log('Detected and parsed Ecore model from JSON file');
            } catch (ecoreError) {
                this.modelState.set('sourceModel', jsonObject);
                this.modelState.set('modelType', 'json');
                console.log('Stored as generic JSON model (not Ecore)');
            }

            this.modelState.set('sourceUri', sourceUri);
        } catch (error) {
            throw new Error(`Failed to load model from ${sourceUri}: ${error}`);
        }
    }

    private getSourceUri(action: RequestModelAction): string {
        const sourceUri = action.options?.[SOURCE_URI_ARG];
        if (typeof sourceUri !== 'string') {
            throw new Error(`Invalid RequestModelAction! Missing argument with key '${SOURCE_URI_ARG}'`);
        }
        return sourceUri;
    }

    private loadFromFile(sourceUri: string): unknown {
        const fs = require('fs');
        const path = this.toPath(sourceUri);
        const data = fs.readFileSync(path, { encoding: 'utf8' });
        return JSON.parse(data);
    }

    private toPath(sourceUri: string): string {
        let path = sourceUri.startsWith('file://') ? sourceUri.substring(7) : sourceUri;
        if (process.platform === 'win32') {
            path = path.replace(/^\//, '');
        }
        return path;
    }

    async saveSourceModel(action: SaveModelAction): Promise<void> {
        const fileUri = this.getFileUri(action);
        const modelType = this.modelState.get('modelType') as string;

        if (modelType === 'ecore') {
            const ecoreModel = this.modelState.get('ecoreModel') as EcoreModel;
            const viewMode = this.modelState.get('viewMode') as string;

            const modelToSave: any = this.convertToPlainJson(ecoreModel);
            if (viewMode === 'metamodel') {
                const diagramPositions = this.diagramPositionStorage.getAllPositions();
                if (diagramPositions.size > 0) {
                    const positionsObj: any = {};
                    diagramPositions.forEach((value, key) => {
                        positionsObj[key] = value;
                    });
                    modelToSave.diagramPositions = positionsObj;
                }
            }
            
            this.writeFile(fileUri, modelToSave);
        } else {
            const sourceModel = this.modelState.get('sourceModel');
            this.writeFile(fileUri, sourceModel);
        }
    }

    private getFileUri(action: SaveModelAction): string {
        const uri = action.fileUri ?? this.modelState.get(SOURCE_URI_ARG);
        if (!uri) {
            throw new Error('Could not derive fileUri for saving the current source model');
        }
        return uri;
    }

    private writeFile(fileUri: string, model: unknown): void {
        const path = this.toPath(fileUri);
        const plainModel = this.convertToPlainJson(model);
        const content = JSON.stringify(plainModel, undefined, 2);
        const fs = require('fs');
        fs.writeFileSync(path, content);
    }

    private convertToPlainJson(obj: any): any {
        if (obj === null || obj === undefined) {
            return obj;
        }

        if (Array.isArray(obj)) {
            return obj.map(item => this.convertToPlainJson(item));
        }

        if (typeof obj === 'object') {
            const result: any = {};
            const keys = new Set<string>();

            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    keys.add(key);
                }
            }

            if (typeof obj.get === 'function') {
                const commonProps = ['name', 'nsURI', 'nsPrefix', 'abstract', 'interface', 
                                     'diagramPosition', 'diagramSize', 'eClassifiers', 'eAttributes', 
                                     'eReferences', 'eSuperTypes', 'eType', 'lowerBound', 'upperBound'];
                commonProps.forEach(prop => {
                    try {
                        const value = obj.get(prop);
                        if (value !== undefined) {
                            keys.add(prop);
                        }
                    } catch {
                    }
                });
            }

            for (const key of keys) {
                let value = obj[key];

                if (typeof obj.get === 'function') {
                    try {
                        const getValue = obj.get(key);
                        if (getValue !== undefined) {
                            value = getValue;
                        }
                    } catch {
                    }
                }

                result[key] = this.convertToPlainJson(value);
            }

            return result;
        }

        return obj;
    }

    protected createModelForEmptyFile(path: string): unknown | undefined {
        if (path.endsWith('.ecore')) {
            return {
                ePackages: [{
                    name: 'DefaultPackage',
                    nsURI: 'http://www.example.org/default',
                    nsPrefix: 'default',
                    eClassifiers: []
                }]
            };
        }
        return undefined;
    }
}

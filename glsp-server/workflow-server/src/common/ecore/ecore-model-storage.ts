/********************************************************************************
 * Copyright (c) 2024 Eclipse GLSP and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * SPDX-License-Identifier: EPL-2.0
 ********************************************************************************/

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
            // Check if it's an inline Ecore content
            if (sourceUri === 'ecore:inline') {
                // Try to get ecoreContent from action options first, then from model state
                let ecoreContent = action.options?.['ecoreContent'] as string;

                if (!ecoreContent) {
                    // If not in action, try to get from model state (for subsequent reloads)
                    ecoreContent = this.modelState.get('ecoreContent') as string;
                }

                console.log('Loading inline Ecore content, length:', ecoreContent?.length);

                if (!ecoreContent) {
                    throw new Error('No Ecore content provided for inline loading');
                }

                const ecoreModel = await this.ecoreParser.parseEcoreXml(ecoreContent);
                console.log('Parsed Ecore model:', ecoreModel);
                this.modelState.set('ecoreModel', ecoreModel);
                this.modelState.set('ecoreContent', ecoreContent); // Store for future reloads
                this.modelState.set('sourceUri', action.options?.['filename'] as string || 'inline.ecore');
                this.modelState.set('modelType', 'ecore');
                console.log('Set modelType to ecore');
            } else if (sourceUri.endsWith('.ecore')) {
                const ecoreModel = await this.ecoreParser.parseEcoreFile(sourceUri);
                this.modelState.set('ecoreModel', ecoreModel);
                this.modelState.set('sourceUri', sourceUri);
                this.modelState.set('modelType', 'ecore');
            } else {
                // Fall back to JSON loading for non-ecore files
                const jsonObject = this.loadFromFile(sourceUri);

                try {
                    // Try to parse as Ecore JSON with validation
                    const ecoreModel = await this.ecoreParser.parseEcoreJson(JSON.stringify(jsonObject));
                    this.modelState.set('ecoreModel', ecoreModel);
                    this.modelState.set('modelType', 'ecore');
                    
                    // Restore diagram positions if they exist in the saved file
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
                    // It's not an Ecore model, store as generic JSON
                    this.modelState.set('sourceModel', jsonObject);
                    this.modelState.set('modelType', 'json');
                    console.log('Stored as generic JSON model (not Ecore)');
                }

                this.modelState.set('sourceUri', sourceUri);
            }
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
        // Simple file loading implementation
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
            
            // Include diagram positions in the saved model if in metamodel mode
            const modelToSave: any = this.convertToPlainJson(ecoreModel);
            if (viewMode === 'metamodel') {
                const diagramPositions = this.diagramPositionStorage.getAllPositions();
                if (diagramPositions.size > 0) {
                    // Convert Map to plain object for JSON serialization
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
        // Convert model to plain JSON, ensuring all properties including diagramPosition/diagramSize are included
        const plainModel = this.convertToPlainJson(model);
        const content = JSON.stringify(plainModel, undefined, 2);
        const fs = require('fs');
        fs.writeFileSync(path, content);
    }

    /**
     * Converts EcoreModel (which may contain Ecore objects with get/set methods) to plain JSON
     * This ensures that custom properties like diagramPosition and diagramSize are included in the serialization
     */
    private convertToPlainJson(obj: any): any {
        if (obj === null || obj === undefined) {
            return obj;
        }

        // Handle arrays
        if (Array.isArray(obj)) {
            return obj.map(item => this.convertToPlainJson(item));
        }

        // Handle objects
        if (typeof obj === 'object') {
            const result: any = {};
            
            // Get all properties, including those set via set() method
            const keys = new Set<string>();
            
            // Add all enumerable properties
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    keys.add(key);
                }
            }
            
            // If it's an Ecore object with get method, try to get all properties
            if (typeof obj.get === 'function') {
                // Try common Ecore properties
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
                        // Property doesn't exist, ignore
                    }
                });
            }
            
            // Convert each property
            for (const key of keys) {
                let value = obj[key];
                
                // If it's an Ecore object, try to get the value using get() method
                if (typeof obj.get === 'function') {
                    try {
                        const getValue = obj.get(key);
                        if (getValue !== undefined) {
                            value = getValue;
                        }
                    } catch {
                        // Use direct property access
                    }
                }
                
                // Recursively convert nested objects
                result[key] = this.convertToPlainJson(value);
            }
            
            return result;
        }

        // Primitive values
        return obj;
    }

    protected createModelForEmptyFile(path: string): unknown | undefined {
        // For .ecore files, create a minimal Ecore model
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

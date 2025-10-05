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

@injectable()
export class EcoreModelStorage implements SourceModelStorage {
    @inject(EcoreParser)
    protected ecoreParser: EcoreParser;

    @inject(ModelState)
    protected modelState: ModelState;

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
            // For now, we'll save as JSON since converting back to Ecore XML is complex
            // In a full implementation, you'd want to implement proper Ecore serialization
            const ecoreModel = this.modelState.get('ecoreModel') as EcoreModel;
            this.writeFile(fileUri, ecoreModel);
        } else {
            // Save as JSON
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
        const content = JSON.stringify(model, undefined, 2);
        const fs = require('fs');
        fs.writeFileSync(path, content);
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

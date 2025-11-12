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
import { ActionHandler } from '@eclipse-glsp/server';
import { Action, MessageAction } from '@eclipse-glsp/protocol';
import { OpenVisualConfigurationAction, VisualConfigurationResponse } from './ecore-actions';
import { VisualConfigurationStorage } from './visual-configuration-storage';
import { MetamodelRegistry } from './metamodel-registry';

/**
 * Server-side handler for opening visual configuration.
 * This handler responds to requests to open the visual configuration dialog.
 */
@injectable()
export class OpenVisualConfigurationActionHandler implements ActionHandler {
    actionKinds = [OpenVisualConfigurationAction.KIND];
    
    @inject(VisualConfigurationStorage)
    protected visualConfigStorage: VisualConfigurationStorage;
    
    @inject(MetamodelRegistry)
    protected metamodelRegistry: MetamodelRegistry;
    
    async execute(action: OpenVisualConfigurationAction): Promise<Action[]> {
        console.log('OpenVisualConfigurationActionHandler.execute()', action);
        
        try {
            // Check if there's an active metamodel
            const activeMetamodel = this.metamodelRegistry.getActiveMetamodel();
            if (!activeMetamodel) {
                return [
                    MessageAction.create(
                        'No active metamodel found. Please load a metamodel first.',
                        { severity: 'WARNING' }
                    )
                ];
            }

            // Get or create visual configuration for the active metamodel
            this.visualConfigStorage.getOrCreateActiveVisualConfiguration();
            
            // Get all class names from the active metamodel
            const classes = this.metamodelRegistry.getAllEClasses();
            const eligibleClasses = classes
                .map(c => {
                    const isAbstract = c.get ? c.get('abstract') : c.abstract;
                    const isInterface = c.get ? c.get('interface') : c.interface;
                    const name = c.get ? c.get('name') : c.name;
                    return { raw: c, name, isAbstract, isInterface };
                })
                .filter(info => !!info.name && !info.isAbstract && !info.isInterface)
                .filter(info => this.hasIncomingContainment(info.name!, classes))
                .filter(info => !this.isArcClass(info.name!, classes));
            const classNames = eligibleClasses.map(info => info.name!);

            // Build configurations array
            const configurations = classNames.map(className => {
                const classConfig = this.visualConfigStorage.getClassVisualConfiguration(className);
                return {
                    className,
                    shape: classConfig.shape,
                    color: classConfig.color,
                    filled: classConfig.filled,
                    border: classConfig.border,
                    showAttributes: classConfig.showAttributes,
                    showReferences: classConfig.showReferences
                };
            });

            // Get available options
            const availableShapes = this.visualConfigStorage.getAvailableShapes();
            const availableColors = this.visualConfigStorage.getAvailableColors();

            console.log(`Opening visual configuration for ${classNames.length} classes`);
            
            return [
                VisualConfigurationResponse.create(
                    true,
                    configurations,
                    availableShapes,
                    availableColors
                ),
                MessageAction.create(
                    `Visual configuration opened for ${classNames.length} classes`,
                    { severity: 'INFO' }
                )
            ];
        } catch (error) {
            console.error('Error opening visual configuration:', error);
            return [
                MessageAction.create(
                    `Error opening visual configuration: ${error instanceof Error ? error.message : String(error)}`,
                    { severity: 'ERROR' }
                )
            ];
        }
    }

    private hasIncomingContainment(className: string, classes: any[]): boolean {
        for (const cls of classes) {
            const structuralFeatures = cls.get ? cls.get('eStructuralFeatures') : cls.eStructuralFeatures;
            const references = cls.get ? cls.get('eReferences') : cls.eReferences;
            const candidates = this.toArray(references ?? structuralFeatures ?? []);
            for (const ref of candidates) {
                const containment = ref.get ? ref.get('containment') : ref.containment;
                if (!containment) {
                    continue;
                }
                const eType = ref.get ? ref.get('eType') : ref.eType;
                const typeName = eType?.get ? eType.get('name') : eType?.name;
                if (!typeName) {
                    continue;
                }
                if (typeName === className || this.isSubtypeOf(className, typeName, classes)) {
                    return true;
                }
            }
        }
        return false;
    }

    private isSubtypeOf(className: string, superTypeName: string, classes: any[]): boolean {
        if (className === superTypeName) {
            return true;
        }

        const cls = classes.find(c => {
            const name = c.get ? c.get('name') : c.name;
            return name === className;
        });
        if (!cls) {
            return false;
        }

        const eSuperTypes = cls.get ? cls.get('eSuperTypes') : cls.eSuperTypes;
        const superTypesArray = this.toArray(eSuperTypes ?? []);
        for (const st of superTypesArray) {
            const stName = st?.get ? st.get('name') : st?.name;
            if (!stName) {
                continue;
            }
            if (stName === superTypeName || this.isSubtypeOf(stName, superTypeName, classes)) {
                return true;
            }
        }
        return false;
    }

    private isArcClass(className: string, classes: any[]): boolean {
        if (!className) {
            return false;
        }

        if (className.toLowerCase() === 'arc') {
            return true;
        }

        const cls = classes.find(c => {
            const name = c.get ? c.get('name') : c.name;
            return name === className;
        });
        if (!cls) {
            return false;
        }

        const eSuperTypes = cls.get ? cls.get('eSuperTypes') : cls.eSuperTypes;
        const superTypesArray = this.toArray(eSuperTypes ?? []);
        for (const st of superTypesArray) {
            const stName = st?.get ? st.get('name') : st?.name;
            if (!stName) {
                continue;
            }
            if (stName.toLowerCase() === 'arc' || this.isArcClass(stName, classes)) {
                return true;
            }
        }

        return false;
    }

    private toArray(collection: any): any[] {
        if (!collection) {
            return [];
        }
        if (Array.isArray(collection)) {
            return collection;
        }
        if (typeof collection.forEach === 'function') {
            const result: any[] = [];
            collection.forEach((item: any) => result.push(item));
            return result;
        }
        if (typeof collection.length === 'number') {
            try {
                return Array.from(collection);
            } catch {
                return [];
            }
        }
        return [];
    }
}

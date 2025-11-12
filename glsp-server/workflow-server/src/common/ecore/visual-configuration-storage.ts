/**********************************************************************************
 * Copyright (c) 2024 Eclipse GLSP and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * SPDX-License-Identifier: EPL-2.0
 *********************************************************************************/
 
import { injectable, inject } from 'inversify';
import {
    ClassVisualConfiguration,
    MetamodelVisualConfiguration,
    DEFAULT_CLASS_VISUAL_CONFIG,
    ShapeType,
    ColorScheme
} from './visual-configuration-types';
import { MetamodelRegistry } from './metamodel-registry';

/**
 * Storage and management for visual configurations of metamodels.
 * This service manages how classes should be visually represented when instantiated.
 */
@injectable()
export class VisualConfigurationStorage {
    private configurations: Map<string, MetamodelVisualConfiguration> = new Map();

    @inject(MetamodelRegistry)
    protected metamodelRegistry: MetamodelRegistry;

    createVisualConfiguration(metamodelKey: string): MetamodelVisualConfiguration {
        const configuration: MetamodelVisualConfiguration = {
            metamodelKey,
            classConfigurations: new Map(),
            defaultConfiguration: { ...DEFAULT_CLASS_VISUAL_CONFIG }
        };

        this.configurations.set(metamodelKey, configuration);
        console.log(`Created visual configuration for metamodel: ${metamodelKey}`);
        return configuration;
    }

    getVisualConfiguration(metamodelKey: string): MetamodelVisualConfiguration | undefined {
        return this.configurations.get(metamodelKey);
    }

    getOrCreateActiveVisualConfiguration(): MetamodelVisualConfiguration {
        const activeKey = this.metamodelRegistry.getActiveMetamodelKey();
        if (!activeKey) {
            throw new Error('No active metamodel set');
        }

        let configuration = this.getVisualConfiguration(activeKey);
        if (!configuration) {
            configuration = this.createVisualConfiguration(activeKey);
            this.initializeDefaultConfigurations(configuration);
        }

        return configuration;
    }

    setClassVisualConfiguration(className: string, configuration: ClassVisualConfiguration): void {
        const activeConfig = this.getOrCreateActiveVisualConfiguration();
        activeConfig.classConfigurations.set(className, configuration);
        console.log(`Set visual configuration for class ${className}:`, configuration);
        console.log(`All configurations for active metamodel:`, Array.from(activeConfig.classConfigurations.entries()));
    }

    getClassVisualConfiguration(className: string): ClassVisualConfiguration {
        const activeConfig = this.getOrCreateActiveVisualConfiguration();
        const classConfig = activeConfig.classConfigurations.get(className);
        
        console.log(`Getting visual configuration for class ${className}:`, classConfig);
        console.log(`Available configurations:`, Array.from(activeConfig.classConfigurations.keys()));
        
        if (classConfig) {
            return classConfig;
        }

        // Return default configuration for this class
        const defaultConfig = {
            ...activeConfig.defaultConfiguration,
            className: className
        };
        console.log(`Using default configuration for ${className}:`, defaultConfig);
        return defaultConfig;
    }

    updateDefaultConfiguration(configuration: Partial<ClassVisualConfiguration>): void {
        const activeConfig = this.getOrCreateActiveVisualConfiguration();
        activeConfig.defaultConfiguration = {
            ...activeConfig.defaultConfiguration,
            ...configuration
        };
        console.log('Updated default visual configuration:', activeConfig.defaultConfiguration);
    }

    loadVisualConfiguration(serialized: {
        defaultConfiguration?: Partial<ClassVisualConfiguration>;
        classConfigurations?: Record<string, ClassVisualConfiguration>;
    }): void {
        const activeConfig = this.getOrCreateActiveVisualConfiguration();

        if (serialized.defaultConfiguration) {
            activeConfig.defaultConfiguration = {
                ...activeConfig.defaultConfiguration,
                ...serialized.defaultConfiguration,
                className: ''
            };
        }

        if (serialized.classConfigurations) {
            activeConfig.classConfigurations.clear();
            for (const [className, config] of Object.entries(serialized.classConfigurations)) {
                const merged: ClassVisualConfiguration = {
                    ...activeConfig.defaultConfiguration,
                    ...config,
                    className: config.className ?? className
                };
                activeConfig.classConfigurations.set(className, merged);
            }
        }

        console.log(`Loaded visual configuration for ${activeConfig.classConfigurations.size} classes`);
    }

    getAvailableShapes(): ShapeType[] {
        return ['rectangle', 'circle', 'ellipse', 'arrow'];
    }

    getAvailableColors(): ColorScheme[] {
        return ['black', 'blue', 'red', 'white', 'grey'];
    }

    removeClassConfiguration(className: string): boolean {
        const activeConfig = this.getOrCreateActiveVisualConfiguration();
        const normalized = className.trim();
        if (normalized.length === 0) {
            return false;
        }
        const removed = activeConfig.classConfigurations.delete(normalized);
        if (removed) {
            console.log(`Removed cached visual configuration for ${normalized}`);
        }
        return removed;
    }

    private initializeDefaultConfigurations(configuration: MetamodelVisualConfiguration): void {
        const activeMetamodel = this.metamodelRegistry.getActiveMetamodel();
        if (!activeMetamodel) {
            return;
        }

        const classes = this.metamodelRegistry.getAllEClasses();
        for (const eClass of classes) {
            const className = eClass.get ? eClass.get('name') : eClass.name;
            if (className && !configuration.classConfigurations.has(className)) {
                const classConfig: ClassVisualConfiguration = {
                    ...configuration.defaultConfiguration,
                    className: className
                };
                configuration.classConfigurations.set(className, classConfig);
            }
        }

        console.log(`Initialized visual configurations for ${classes.length} classes`);
    }

    removeVisualConfiguration(metamodelKey: string): boolean {
        const removed = this.configurations.delete(metamodelKey);
        if (removed) {
            console.log(`Removed visual configuration for metamodel: ${metamodelKey}`);
        }
        return removed;
    }

    clear(): void {
        this.configurations.clear();
        console.log('Cleared all visual configurations');
    }
}

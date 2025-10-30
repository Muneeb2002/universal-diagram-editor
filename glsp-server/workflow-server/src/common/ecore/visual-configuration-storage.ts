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

    /**
     * Creates a visual configuration for a metamodel.
     * @param metamodelKey The key of the metamodel
     * @returns The created configuration
     */
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

    /**
     * Gets the visual configuration for a metamodel.
     * @param metamodelKey The key of the metamodel
     * @returns The configuration or undefined if not found
     */
    getVisualConfiguration(metamodelKey: string): MetamodelVisualConfiguration | undefined {
        return this.configurations.get(metamodelKey);
    }

    /**
     * Gets or creates the visual configuration for the active metamodel.
     * @returns The visual configuration
     */
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

    /**
     * Sets the visual configuration for a specific class.
     * @param className The name of the class
     * @param configuration The visual configuration
     */
    setClassVisualConfiguration(className: string, configuration: ClassVisualConfiguration): void {
        const activeConfig = this.getOrCreateActiveVisualConfiguration();
        activeConfig.classConfigurations.set(className, configuration);
        console.log(`Set visual configuration for class ${className}:`, configuration);
        console.log(`All configurations for active metamodel:`, Array.from(activeConfig.classConfigurations.entries()));
    }

    /**
     * Gets the visual configuration for a specific class.
     * @param className The name of the class
     * @returns The visual configuration or the default if not found
     */
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

    /**
     * Updates the default configuration for the active metamodel.
     * @param configuration The new default configuration
     */
    updateDefaultConfiguration(configuration: Partial<ClassVisualConfiguration>): void {
        const activeConfig = this.getOrCreateActiveVisualConfiguration();
        activeConfig.defaultConfiguration = {
            ...activeConfig.defaultConfiguration,
            ...configuration
        };
        console.log('Updated default visual configuration:', activeConfig.defaultConfiguration);
    }

    /**
     * Gets all available shape types.
     * @returns Array of shape types
     */
    getAvailableShapes(): ShapeType[] {
        return ['rectangle', 'circle', 'ellipse', 'arrow'];
    }

    /**
     * Gets all available color schemes.
     * @returns Array of color schemes
     */
    getAvailableColors(): ColorScheme[] {
        return ['blue', 'green', 'red', 'orange', 'purple', 'pink', 'yellow', 'gray', 'brown', 'cyan'];
    }

    /**
     * Initializes default configurations for all classes in the active metamodel.
     * @param configuration The configuration to initialize
     */
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

    /**
     * Removes the visual configuration for a metamodel.
     * @param metamodelKey The key of the metamodel
     * @returns True if the configuration was removed
     */
    removeVisualConfiguration(metamodelKey: string): boolean {
        const removed = this.configurations.delete(metamodelKey);
        if (removed) {
            console.log(`Removed visual configuration for metamodel: ${metamodelKey}`);
        }
        return removed;
    }

    /**
     * Clears all visual configurations.
     */
    clear(): void {
        this.configurations.clear();
        console.log('Cleared all visual configurations');
    }
}

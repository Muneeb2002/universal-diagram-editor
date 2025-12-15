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

    getOrCreateActiveVisualConfiguration(): MetamodelVisualConfiguration {
        const activeKey = this.metamodelRegistry.getActiveMetamodelKey();
        if (!activeKey) {
            throw new Error('No active metamodel set');
        }

        let configuration = this.configurations.get(activeKey);
        if (!configuration) {
            configuration = {
                metamodelKey: activeKey,
                classConfigurations: new Map(),
                defaultConfiguration: { ...DEFAULT_CLASS_VISUAL_CONFIG }
            };
            this.configurations.set(activeKey, configuration);
        }

        return configuration;
    }

    setClassVisualConfiguration(className: string, configuration: ClassVisualConfiguration): void {
        const activeConfig = this.getOrCreateActiveVisualConfiguration();
        activeConfig.classConfigurations.set(className, configuration);
    }

    getClassVisualConfiguration(className: string): ClassVisualConfiguration {
        const activeConfig = this.getOrCreateActiveVisualConfiguration();
        const classConfig = activeConfig.classConfigurations.get(className);

        if (classConfig) {
            return classConfig;
        }

        return {
            ...activeConfig.defaultConfiguration,
            className
        };
    }

    getAvailableShapes(): ShapeType[] {
        return ['rectangle'];
    }

    getAvailableColors(): ColorScheme[] {
        return ['black'];
    }

    removeClassConfiguration(className: string): boolean {
        const activeConfig = this.getOrCreateActiveVisualConfiguration();
        const normalized = className.trim();
        if (normalized.length === 0) {
            return false;
        }
        const removed = activeConfig.classConfigurations.delete(normalized);
        return removed;
    }

    clear(): void {
        this.configurations.clear();
    }
}

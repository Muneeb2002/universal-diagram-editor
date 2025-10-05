/********************************************************************************
 * Copyright (c) 2024 Eclipse GLSP and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * SPDX-License-Identifier: EPL-2.0
 ********************************************************************************/

import { injectable, interfaces } from 'inversify';
import {
    GModelDiagramModule,
    BindingTarget,
    SourceModelStorage,
    DiagramConfiguration,
    GModelFactory,
    OperationHandlerConstructor,
    InstanceMultiBinding,
    ActionHandlerConstructor
} from '@eclipse-glsp/server';
import { EcoreModelStorage } from './ecore-model-storage';
import { DynamicEcoreDiagramConfiguration } from './dynamic-ecore-diagram-configuration';
import { DynamicEcoreGModelFactory } from './dynamic-ecore-gmodel-factory';
import { DynamicCreateNodeHandler } from './dynamic-create-node-handler';
import { EcoreParser } from './ecore-parser';
import { MetamodelRegistry } from './metamodel-registry';
import { InstanceModelStorage } from './instance-model-storage';
import { LoadMetamodelActionHandler } from './load-metamodel-action-handler';
import { SwitchModeActionHandler } from './switch-mode-action-handler';
import { CreateInstanceActionHandler } from './create-instance-action-handler';

@injectable()
export class EcoreDiagramModule extends GModelDiagramModule {
    get diagramType(): string {
        return 'ecore-diagram';
    }

    protected bindSourceModelStorage(): BindingTarget<SourceModelStorage> {
        return EcoreModelStorage;
    }

    protected bindDiagramConfiguration(): BindingTarget<DiagramConfiguration> {
        return DynamicEcoreDiagramConfiguration;
    }

    protected override bindGModelFactory(): BindingTarget<GModelFactory> {
        return DynamicEcoreGModelFactory;
    }

    protected override configureOperationHandlers(binding: InstanceMultiBinding<OperationHandlerConstructor>): void {
        super.configureOperationHandlers(binding);
        binding.add(DynamicCreateNodeHandler);
    }

    protected override configureActionHandlers(binding: InstanceMultiBinding<ActionHandlerConstructor>): void {
        super.configureActionHandlers(binding);
        binding.add(LoadMetamodelActionHandler);
        binding.add(SwitchModeActionHandler);
        binding.add(CreateInstanceActionHandler);
    }

    protected override configure(bind: interfaces.Bind, unbind: interfaces.Unbind, isBound: interfaces.IsBound, rebind: interfaces.Rebind): void {
        super.configure(bind, unbind, isBound, rebind);
        
        // Bind core services as singletons
        bind(EcoreParser).toSelf().inSingletonScope();
        bind(MetamodelRegistry).toSelf().inSingletonScope();
        bind(InstanceModelStorage).toSelf().inSingletonScope();
    }
}

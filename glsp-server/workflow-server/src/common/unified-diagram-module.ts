/********************************************************************************
 * Copyright (c) 2022-2024 STMicroelectronics and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/
import { injectable, interfaces } from 'inversify';
import {
    GModelDiagramModule, BindingTarget, SourceModelStorage, DiagramConfiguration,
    GModelFactory, OperationHandlerConstructor, InstanceMultiBinding
} from '@eclipse-glsp/server';
import { GModelStorage } from '@eclipse-glsp/server/node';
import { CreateAutomatedTaskHandler } from './handler/create-automated-task-handler';
import { CreateManualTaskHandler } from './handler/create-manual-task-handler';
import { CreateJoinNodeHandler } from './handler/create-join-node-handler';
import { CreateForkNodeHandler } from './handler/create-fork-node-handler';
import { CreateEdgeHandler } from './handler/create-edge-handler';
import { CreateWeightedEdgeHandler } from './handler/create-weighted-edge-handler';
import { CreateMergeNodeHandler } from './handler/create-merge-node-handler';
import { CreateDecisionNodeHandler } from './handler/create-decision-node-handler';
import { CreateCategoryHandler } from './handler/create-category-handler';
import { EditTaskOperationHandler } from './taskedit/edit-task-operation-handler';
import { EcoreModelStorage } from './ecore/ecore-model-storage';
import { DynamicEcoreDiagramConfiguration } from './ecore/dynamic-ecore-diagram-configuration';
import { DynamicEcoreGModelFactory } from './ecore/dynamic-ecore-gmodel-factory';
import { DynamicCreateNodeHandler } from './ecore/dynamic-create-node-handler';
import { EcoreParser } from './ecore/ecore-parser';
import { UnifiedModelStorage } from './unified-model-storage';

/**
 * Unified diagram module that supports both workflow and Ecore diagrams
 */
@injectable()
export class UnifiedDiagramModule extends GModelDiagramModule {
    get diagramType(): string {
        return 'workflow-diagram';
    }

    protected override bindSourceModelStorage(): BindingTarget<SourceModelStorage> {
        return UnifiedModelStorage;
    }

    protected bindDiagramConfiguration(): BindingTarget<DiagramConfiguration> {
        return DynamicEcoreDiagramConfiguration;
    }

    protected override bindGModelFactory(): BindingTarget<GModelFactory> {
        return DynamicEcoreGModelFactory;
    }

    protected override configureOperationHandlers(binding: InstanceMultiBinding<OperationHandlerConstructor>): void {
        super.configureOperationHandlers(binding);

        // Add workflow operation handlers
        binding.add(CreateAutomatedTaskHandler);
        binding.add(CreateManualTaskHandler);
        binding.add(CreateJoinNodeHandler);
        binding.add(CreateForkNodeHandler);
        binding.add(CreateEdgeHandler);
        binding.add(CreateWeightedEdgeHandler);
        binding.add(CreateMergeNodeHandler);
        binding.add(CreateDecisionNodeHandler);
        binding.add(CreateCategoryHandler);
        binding.add(EditTaskOperationHandler);

        // Add Ecore operation handlers
        binding.add(DynamicCreateNodeHandler);
    }

    protected override configure(bind: interfaces.Bind, unbind: interfaces.Unbind, isBound: interfaces.IsBound, rebind: interfaces.Rebind): void {
        super.configure(bind, unbind, isBound, rebind);

        // Bind EcoreParser as singleton
        bind(EcoreParser).toSelf().inSingletonScope();

        // Bind both model storages - the unified storage will delegate to the appropriate one
        bind(GModelStorage).toSelf().inSingletonScope();
        bind(EcoreModelStorage).toSelf().inSingletonScope();
        bind(UnifiedModelStorage).toSelf().inSingletonScope();
    }
}

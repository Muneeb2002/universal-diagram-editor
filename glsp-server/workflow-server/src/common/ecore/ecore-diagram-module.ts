/********************************************************************************
 * Copyright (c) 2024 Eclipse GLSP and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * SPDX-License-Identifier: EPL-2.0
 ********************************************************************************/

import {
    ActionHandlerConstructor,
    BindingTarget,
    DiagramConfiguration,
    GModelDiagramModule,
    GModelFactory,
    InstanceMultiBinding,
    OperationHandlerConstructor,
    SourceModelStorage,
    ToolPaletteItemProvider
} from '@eclipse-glsp/server';
import { injectable, interfaces } from 'inversify';
import { CreateInstanceActionHandler } from './create-instance-action-handler';
import { DynamicCreateNodeHandler } from './dynamic-create-node-handler';
import { DynamicEcoreDiagramConfiguration } from './dynamic-ecore-diagram-configuration';
import { DynamicEcoreGModelFactory } from './dynamic-ecore-gmodel-factory';
import { EcoreModelStorage } from './ecore-model-storage';
import { EcoreParser } from './ecore-parser';
import { EcoreToolPaletteItemProvider } from './ecore-tool-palette-item-provider';
import { InstanceModelStorage } from './instance-model-storage';
import { LoadMetamodelActionHandler } from './load-metamodel-action-handler';
import { MetamodelRegistry } from './metamodel-registry';
import { SwitchModeActionHandler } from './switch-mode-action-handler';
import { EditMetamodelActionHandler } from './edit-metamodel-action-handler';
import { DeleteEdgeActionHandler } from './edge-action-handlers';
import { EcoreDeleteOperationHandler } from './ecore-delete-operation-handler';
import { CreateCustomMetamodelActionHandler } from './create-custom-metamodel-action-handler';
import { TriggerEClassCreationActionHandler } from './trigger-eclass-creation-action-handler';
import { EcoreEdgeCreationHandler } from './ecore-edge-creation-handler';
import { EcoreCreateEdgeActionHandler } from './ecore-create-edge-action-handler';
import { MultiplicityInputResponseActionHandler } from './multiplicity-input-response-action-handler';
import { BidirectionalMultiplicityInputResponseActionHandler } from './bidirectional-multiplicity-input-response-action-handler';
import { AddAttributeActionHandler } from './add-attribute-action-handler';
import { DeleteAttributeActionHandler } from './delete-attribute-action-handler';

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
        binding.add(EcoreDeleteOperationHandler);
        binding.add(EcoreEdgeCreationHandler);
    }

    protected override configureActionHandlers(binding: InstanceMultiBinding<ActionHandlerConstructor>): void {
        super.configureActionHandlers(binding);
        binding.add(LoadMetamodelActionHandler);
        binding.add(SwitchModeActionHandler);
        binding.add(CreateInstanceActionHandler);
        binding.add(EditMetamodelActionHandler);
        binding.add(DeleteEdgeActionHandler);
        binding.add(CreateCustomMetamodelActionHandler);
        binding.add(TriggerEClassCreationActionHandler);
        binding.add(EcoreCreateEdgeActionHandler);
        binding.add(MultiplicityInputResponseActionHandler);
        binding.add(BidirectionalMultiplicityInputResponseActionHandler);
        binding.add(AddAttributeActionHandler);
        binding.add(DeleteAttributeActionHandler);
    }

    protected override bindToolPaletteItemProvider(): BindingTarget<ToolPaletteItemProvider> {
        return EcoreToolPaletteItemProvider;
    }

    protected override configure(bind: interfaces.Bind, unbind: interfaces.Unbind, isBound: interfaces.IsBound, rebind: interfaces.Rebind): void {
        super.configure(bind, unbind, isBound, rebind);

        // Bind core services as singletons
        bind(EcoreParser).toSelf().inSingletonScope();
        bind(MetamodelRegistry).toSelf().inSingletonScope();
        bind(InstanceModelStorage).toSelf().inSingletonScope();
    }
}

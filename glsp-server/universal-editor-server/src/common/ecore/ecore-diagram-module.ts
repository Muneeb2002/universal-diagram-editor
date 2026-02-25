/**
 * @author Abigail Sotomayor <s205720@dtu.dk>
 */
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
import { CreateInstanceActionHandler } from './handlers/create-instance-action-handler';
import { DynamicEcoreDiagramConfiguration } from './dynamic-ecore-diagram-configuration';
import { DynamicEcoreGModelFactory } from './dynamic-ecore-gmodel-factory';
import { EcoreModelStorage } from './ecore-model-storage';
import { EcoreParser } from './ecore-parser';
import { EcoreToolPaletteItemProvider } from './ecore-tool-palette-item-provider';
import { InstanceModelStorage } from './instance-model-storage';
import { ShapeMappingStorage } from './shape-mapping-storage';
import { LoadMetamodelActionHandler } from './handlers/load-metamodel-action-handler';
import { MetamodelRegistry } from './metamodel-registry';
import { SwitchModeActionHandler } from './handlers/switch-mode-action-handler';
import { EditMetamodelActionHandler } from './handlers/edit-metamodel-action-handler';
import { DeleteEdgeActionHandler } from './handlers/edge-action-handlers';
import { EcoreDeleteOperationHandler } from './handlers/ecore-delete-operation-handler';
import { GModelDeleteOperationHandler, GModelChangeBoundsOperationHandler } from '@eclipse-glsp/server';
import { EcoreChangeBoundsOperationHandler } from './handlers/ecore-change-bounds-operation-handler';
import { CreateCustomMetamodelActionHandler } from './handlers/create-custom-metamodel-action-handler';
import { TriggerEClassCreationActionHandler } from './handlers/trigger-eclass-creation-action-handler';
import { TriggerEEnumCreationActionHandler } from './handlers/trigger-eenum-creation-action-handler';
import { EcoreCreateEdgeActionHandler } from './handlers/ecore-create-edge-action-handler';
import { MultiplicityInputResponseActionHandler } from './handlers/multiplicity-input-response-action-handler';
import { BidirectionalMultiplicityInputResponseActionHandler } from './handlers/bidirectional-multiplicity-input-response-action-handler';
import { AddAttributeActionHandler } from './handlers/add-attribute-action-handler';
import { DeleteAttributeActionHandler } from './handlers/delete-attribute-action-handler';
import { UpdateAttributeActionHandler } from './update-attribute-action-handler';
import { SetInstanceAttributeActionHandler } from './handlers/set-instance-attribute-action-handler';
import { CreateInstanceReferenceActionHandler } from './handlers/create-instance-reference-action-handler';
import { LoadMetamodelResponseHandler } from './handlers/load-metamodel-response-handler';
import { OpenClassPropertiesActionHandler } from './handlers/open-class-properties-action-handler';
import { RequestInstancesOverviewActionHandler } from './handlers/request-instances-overview-action-handler';
import { RequestEnumNamesActionHandler } from './handlers/request-enum-names-action-handler';
import { SaveGraphicalModelActionHandler } from './handlers/save-graphical-model-action-handler';
import { SaveShapeMappingsActionHandler } from './handlers/save-shape-mappings-action-handler';
import { ApplyShapeMappingsActionHandler } from './handlers/apply-shape-mappings-action-handler';
import { SaveInstanceActionHandler } from './handlers/save-instance-action-handler';
import { LoadInstanceActionHandler } from './handlers/load-instance-action-handler';
import { OperationHandlerRegistry } from '@eclipse-glsp/server';
import { EcoreCompoundOperationHandler } from './handlers/ecore-compound-operation-handler';
import { CompoundOperationHandler } from '@eclipse-glsp/server';
import { DiagramPositionStorage } from './diagram-position-storage';

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

        binding.remove(GModelDeleteOperationHandler);
        binding.remove(CompoundOperationHandler);
        binding.add(EcoreCompoundOperationHandler);
        binding.remove(GModelChangeBoundsOperationHandler);

        binding.add(EcoreDeleteOperationHandler);
        binding.add(EcoreChangeBoundsOperationHandler);
    }

    protected override configureActionHandlers(binding: InstanceMultiBinding<ActionHandlerConstructor>): void {
        super.configureActionHandlers(binding);
        binding.add(LoadMetamodelActionHandler);
        binding.add(LoadMetamodelResponseHandler);
        binding.add(SwitchModeActionHandler);
        binding.add(CreateInstanceActionHandler);
        binding.add(SetInstanceAttributeActionHandler);
        binding.add(CreateInstanceReferenceActionHandler);
        binding.add(SaveGraphicalModelActionHandler);
        binding.add(SaveShapeMappingsActionHandler);
        binding.add(ApplyShapeMappingsActionHandler);
        binding.add(OpenClassPropertiesActionHandler);
        binding.add(RequestInstancesOverviewActionHandler);
        binding.add(RequestEnumNamesActionHandler);
        binding.add(EditMetamodelActionHandler);
        binding.add(DeleteEdgeActionHandler);
        binding.add(CreateCustomMetamodelActionHandler);
        binding.add(TriggerEClassCreationActionHandler);
        binding.add(TriggerEEnumCreationActionHandler);
        binding.add(EcoreCreateEdgeActionHandler);
        binding.add(MultiplicityInputResponseActionHandler);
        binding.add(BidirectionalMultiplicityInputResponseActionHandler);
        binding.add(AddAttributeActionHandler);
        binding.add(DeleteAttributeActionHandler);
        binding.add(UpdateAttributeActionHandler);
        binding.add(SaveInstanceActionHandler);
        binding.add(LoadInstanceActionHandler);
    }

    protected override bindToolPaletteItemProvider(): BindingTarget<ToolPaletteItemProvider> {
        return EcoreToolPaletteItemProvider;
    }

    protected override bindOperationHandlerRegistry(): BindingTarget<OperationHandlerRegistry> {
        return OperationHandlerRegistry;
    }

    protected override configure(bind: interfaces.Bind, unbind: interfaces.Unbind, isBound: interfaces.IsBound, rebind: interfaces.Rebind): void {
        super.configure(bind, unbind, isBound, rebind);

        bind(EcoreParser).toSelf().inSingletonScope();
        bind(MetamodelRegistry).toSelf().inSingletonScope();
        bind(InstanceModelStorage).toSelf().inSingletonScope();
        bind(DiagramPositionStorage).toSelf().inSingletonScope();
        bind(ShapeMappingStorage).toSelf().inSingletonScope();
    }
}

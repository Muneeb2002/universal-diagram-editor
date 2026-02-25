/**
 * @author Abigail Sotomayor <s205720@dtu.dk>
 */
import { injectable, interfaces } from 'inversify';
import {
    GModelDiagramModule, BindingTarget, SourceModelStorage, DiagramConfiguration,
    GModelFactory, OperationHandlerConstructor, InstanceMultiBinding,
    ToolPaletteItemProvider, GLSPServer,ServerModule
} from '@eclipse-glsp/server';
import { GModelStorage } from '@eclipse-glsp/server/node';
import { EcoreModelStorage } from './ecore/ecore-model-storage';
import { DynamicEcoreDiagramConfiguration } from './ecore/dynamic-ecore-diagram-configuration';
import { DynamicEcoreGModelFactory } from './ecore/dynamic-ecore-gmodel-factory';
import { EcoreParser } from './ecore/ecore-parser';
import { UnifiedModelStorage } from './unified-model-storage';
import { EcoreToolPaletteItemProvider } from './ecore/ecore-tool-palette-item-provider';
import { UniversalEditorGLSPServer } from './universal-editor-glsp-server'

@injectable()
export class UnifiedDiagramServerModule extends ServerModule {
    protected override bindGLSPServer(): BindingTarget<GLSPServer> {
        return UniversalEditorGLSPServer;
    }
}
/**
 * Unified diagram module that supports Ecore diagrams
 */
@injectable()
export class UnifiedDiagramModule extends GModelDiagramModule {
    get diagramType(): string {
        return 'universal-editor-diagram';
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

    }

    protected override bindToolPaletteItemProvider(): BindingTarget<ToolPaletteItemProvider> {
        return EcoreToolPaletteItemProvider;
    }

    protected override configure(bind: interfaces.Bind, unbind: interfaces.Unbind, isBound: interfaces.IsBound, rebind: interfaces.Rebind): void {
        super.configure(bind, unbind, isBound, rebind);

        bind(EcoreParser).toSelf().inSingletonScope();

        bind(GModelStorage).toSelf().inSingletonScope();
        bind(EcoreModelStorage).toSelf().inSingletonScope();
        bind(UnifiedModelStorage).toSelf().inSingletonScope();
    }
}

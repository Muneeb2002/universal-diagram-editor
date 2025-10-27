import { injectable, inject } from 'inversify';
import { Action } from '@eclipse-glsp/protocol';
import { ModelState, ActionHandler, GModelFactory, GModelSerializer, GModelRoot } from '@eclipse-glsp/server';
import { SetModelAction } from '@eclipse-glsp/protocol';
import { MetamodelRegistry } from './metamodel-registry';
import { 
    CreateCustomMetamodelAction,
    CreateEClassAction
} from './ecore-actions';

/**
 * Action handler for creating custom metamodels and EClasses.
 */
@injectable()
export class CreateCustomMetamodelActionHandler implements ActionHandler {
    actionKinds = [
        CreateCustomMetamodelAction.KIND,
        CreateEClassAction.KIND
    ];


    @inject(MetamodelRegistry)
    protected metamodelRegistry: MetamodelRegistry;

    @inject(ModelState)
    protected modelState: ModelState;

    @inject(GModelFactory)
    protected gmodelFactory: GModelFactory;

    @inject(GModelSerializer)
    protected gmodelSerializer: GModelSerializer;

    async execute(action: Action): Promise<Action[]> {
        try {
            let success = false;

            if (CreateCustomMetamodelAction.is(action)) {
                const result = await this.handleCreateCustomMetamodel(action);
                success = result.success;
            } else if (CreateEClassAction.is(action)) {
                const result = await this.handleCreateEClass(action);
                success = result.success;
            }

            // If successful, regenerate the model
            if (success) {
                this.gmodelFactory.createModel();
                const gmodel = this.modelState.get('gmodel') as GModelRoot;
                if (gmodel && gmodel.type && gmodel.id) {
                    return [SetModelAction.create(gmodel)];
                }
            }

            return [];

        } catch (error) {
            console.error('Error in CreateCustomMetamodelActionHandler:', error);
            return [];
        }
    }

    private async handleCreateCustomMetamodel(action: CreateCustomMetamodelAction): Promise<{ success: boolean; message: string }> {
        try {
            // Create a new custom metamodel with the specified package
            const result = this.metamodelRegistry.createCustomMetamodel(
                action.packageName,
                action.nsURI,
                action.nsPrefix
            );

            if (result.success) {
                // Set the new metamodel as active
                this.modelState.set('ecoreModel', result.metamodel);
                this.modelState.set('modelType', 'ecore');
                this.modelState.set('viewMode', 'metamodel');

                return {
                    success: true,
                    message: `Successfully created custom metamodel '${action.packageName}' with nsURI '${action.nsURI}'`
                };
            } else {
                return {
                    success: false,
                    message: result.message || 'Failed to create custom metamodel'
                };
            }
        } catch (error) {
            return {
                success: false,
                message: `Failed to create custom metamodel: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async handleCreateEClass(action: CreateEClassAction): Promise<{ success: boolean; message: string }> {
        try {
            // Create a new EClass in the active custom metamodel
            const result = this.metamodelRegistry.createEClass(
                action.className,
                action.isAbstract,
                action.isInterface,
                action.hasAttributes,
                action.position
            );

            if (result.success) {
                // Update the model state with the updated metamodel
                const activeMetamodel = this.metamodelRegistry.getActiveMetamodel();
                if (activeMetamodel) {
                    this.modelState.set('ecoreModel', activeMetamodel);
                }
                
                return {
                    success: true,
                    message: `Successfully created EClass '${action.className}'`
                };
            } else {
                return {
                    success: false,
                    message: result.message || 'Failed to create EClass'
                };
            }
        } catch (error) {
            console.error('Error in handleCreateEClass:', error);
            return {
                success: false,
                message: `Failed to create EClass: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }
}

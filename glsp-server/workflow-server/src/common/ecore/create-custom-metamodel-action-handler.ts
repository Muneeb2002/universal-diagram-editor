import { injectable, inject } from 'inversify';
import { Action } from '@eclipse-glsp/protocol';
import { ModelState, ActionHandler, GModelFactory, GModelSerializer, GModelRoot } from '@eclipse-glsp/server';
import { SetModelAction } from '@eclipse-glsp/protocol';
import { MetamodelRegistry } from './metamodel-registry';
import { 
    CreateCustomMetamodelAction,
    CreateEClassAction,
    LoadMetamodelResponse,
    ClassInfo
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

            // If successful, regenerate the model and send LoadMetamodelResponse
            if (success) {
                this.gmodelFactory.createModel();
                const gmodel = this.modelState.get('gmodel') as GModelRoot;
                if (gmodel && gmodel.type && gmodel.id) {
                    // Get available classes for the toolbar (with full ClassInfo, same as LoadMetamodelActionHandler)
                    const allClasses = this.metamodelRegistry.getAllEClasses();
                    const classInfo: ClassInfo[] = allClasses.map(c => {
                        const className = c.get ? c.get('name') : c.name;
                        const isAbstract = c.get ? c.get('abstract') : c.abstract;
                        const isInterface = c.get ? c.get('interface') : c.interface;
                        
                        // Extract supertypes
                        const eSuperTypes = c.get ? c.get('eSuperTypes') : c.eSuperTypes;
                        const superTypeNames: string[] = [];
                        if (eSuperTypes) {
                            let superTypes: any[] = [];
                            if (Array.isArray(eSuperTypes)) {
                                superTypes = eSuperTypes;
                            } else if (eSuperTypes.forEach) {
                                eSuperTypes.forEach((st: any) => superTypes.push(st));
                            }
                            
                            for (const superType of superTypes) {
                                const stName = superType.get ? superType.get('name') : superType.name;
                                if (stName) {
                                    superTypeNames.push(stName);
                                }
                            }
                        }
                        
                        // Extract structural features
                        const structuralFeatures = c.get ? c.get('eStructuralFeatures') : c.eStructuralFeatures;
                        const eAttributes = c.get ? c.get('eAttributes') : c.eAttributes;
                        const eReferences = c.get ? c.get('eReferences') : c.eReferences;
                        const attributes: any[] = [];
                        const references: any[] = [];
                        
                        // Process attributes
                        if (eAttributes) {
                            let attrs: any[] = [];
                            if (Array.isArray(eAttributes)) {
                                attrs = eAttributes;
                            } else if (eAttributes.forEach) {
                                eAttributes.forEach((f: any) => attrs.push(f));
                            }
                            
                            for (const attr of attrs) {
                                const name = attr.get ? attr.get('name') : attr.name;
                                const lowerBound = attr.get ? attr.get('lowerBound') : attr.lowerBound;
                                const upperBound = attr.get ? attr.get('upperBound') : attr.upperBound;
                                const unique = attr.get ? attr.get('unique') : attr.unique;
                                const ordered = attr.get ? attr.get('ordered') : attr.ordered;
                                
                                const eType = attr.get ? attr.get('eType') : attr.eType;
                                const typeName = eType ? (eType.get ? eType.get('name') : eType.name) : 'EString';
                                
                                attributes.push({
                                    name,
                                    type: typeName,
                                    lowerBound: lowerBound || 0,
                                    upperBound: upperBound || 1,
                                    unique: unique !== false,
                                    ordered: ordered === true
                                });
                            }
                        }
                        
                        // Process references
                        if (eReferences) {
                            let refs: any[] = [];
                            if (Array.isArray(eReferences)) {
                                refs = eReferences;
                            } else if (eReferences.forEach) {
                                eReferences.forEach((f: any) => refs.push(f));
                            }
                            
                            for (const ref of refs) {
                                const name = ref.get ? ref.get('name') : ref.name;
                                const lowerBound = ref.get ? ref.get('lowerBound') : ref.lowerBound;
                                const upperBound = ref.get ? ref.get('upperBound') : ref.upperBound;
                                const unique = ref.get ? ref.get('unique') : ref.unique;
                                const ordered = ref.get ? ref.get('ordered') : ref.ordered;
                                
                                const eType = ref.get ? ref.get('eType') : ref.eType;
                                const typeName = eType ? (eType.get ? eType.get('name') : eType.name) : 'EString';
                                
                                const containment = ref.get ? ref.get('containment') : ref.containment;
                                const container = ref.get ? ref.get('container') : ref.container;
                                
                                references.push({
                                    name,
                                    type: typeName,
                                    lowerBound: lowerBound || 0,
                                    upperBound: upperBound || 1,
                                    containment: containment === true,
                                    container: container === true,
                                    unique: unique !== false,
                                    ordered: ordered === true
                                });
                            }
                        }
                        
                        // Fallback: if eStructuralFeatures exists, process it
                        if (structuralFeatures && !eAttributes && !eReferences) {
                            let features: any[] = [];
                            if (Array.isArray(structuralFeatures)) {
                                features = structuralFeatures;
                            } else if (structuralFeatures.forEach) {
                                structuralFeatures.forEach((f: any) => features.push(f));
                            }
                            
                            for (const feature of features) {
                                const name = feature.get ? feature.get('name') : feature.name;
                                const lowerBound = feature.get ? feature.get('lowerBound') : feature.lowerBound;
                                const upperBound = feature.get ? feature.get('upperBound') : feature.upperBound;
                                const unique = feature.get ? feature.get('unique') : feature.unique;
                                const ordered = feature.get ? feature.get('ordered') : feature.ordered;
                                
                                const eType = feature.get ? feature.get('eType') : feature.eType;
                                const typeName = eType ? (eType.get ? eType.get('name') : eType.name) : 'EString';
                                
                                const containment = feature.get ? feature.get('containment') : feature.containment;
                                const container = feature.get ? feature.get('container') : feature.container;
                                
                                // Determine if it's an attribute or reference based on type
                                const isPrimitive = typeName.startsWith('E') && ['EString', 'EInt', 'EBoolean', 'EDouble', 'EFloat', 'ELong', 'EDate'].includes(typeName);
                                
                                if (isPrimitive) {
                                    attributes.push({
                                        name,
                                        type: typeName,
                                        lowerBound: lowerBound || 0,
                                        upperBound: upperBound || 1,
                                        unique: unique !== false,
                                        ordered: ordered === true
                                    });
                                } else {
                                    references.push({
                                        name,
                                        type: typeName,
                                        lowerBound: lowerBound || 0,
                                        upperBound: upperBound || 1,
                                        containment: containment === true,
                                        container: container === true,
                                        unique: unique !== false,
                                        ordered: ordered === true
                                    });
                                }
                            }
                        }
                        
                        return {
                            className,
                            isAbstract: isAbstract === true,
                            isInterface: isInterface === true,
                            eSuperTypes: superTypeNames.length > 0 ? superTypeNames : undefined,
                            attributes,
                            references
                        };
                    });
                    
                    const classNames = classInfo
                        .filter(c => !c.isAbstract)
                        .map(c => c.className);

                    const activeMetamodelKey = this.metamodelRegistry.getActiveMetamodelKey();
                    
                    return [
                        SetModelAction.create(gmodel),
                        LoadMetamodelResponse.create(
                            true,
                            activeMetamodelKey || 'custom',
                            `Successfully updated metamodel with ${classNames.length} classes`,
                            classNames,
                            classInfo
                        )
                    ];
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

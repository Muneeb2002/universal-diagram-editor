/********************************************************************************
 * Copyright (c) 2024 Eclipse GLSP and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * SPDX-License-Identifier: EPL-2.0
 ********************************************************************************/

import { injectable, inject } from 'inversify';
import { ActionHandler, ModelState, GModelFactory, GModelSerializer, GModelRoot } from '@eclipse-glsp/server';
import { Action, SetModelAction } from '@eclipse-glsp/protocol';
import { LoadMetamodelAction, LoadMetamodelResponse, ClassInfo } from './ecore-actions';
import { EcoreParser } from './ecore-parser';
import { MetamodelRegistry } from './metamodel-registry';

@injectable()
export class LoadMetamodelActionHandler implements ActionHandler {
    actionKinds = [LoadMetamodelAction.KIND];

    @inject(EcoreParser)
    protected ecoreParser: EcoreParser;

    @inject(MetamodelRegistry)
    protected metamodelRegistry: MetamodelRegistry;

    @inject(ModelState)
    protected modelState: ModelState;

    @inject(GModelFactory)
    protected gmodelFactory: GModelFactory;

    @inject(GModelSerializer)
    protected gmodelSerializer: GModelSerializer;

    async execute(action: LoadMetamodelAction): Promise<Action[]> {
        console.log('LoadMetamodelActionHandler.execute()', action);

        try {
            // Use reliable parser for JSON parsing with validation
            const ecoreModel = await this.ecoreParser.parseEcoreJson(action.content);

            console.log('Parsed Ecore model:', ecoreModel);

            // Generate a key for the metamodel (use filename or nsURI)
            let metamodelKey = action.filename.replace(/\.json$/, ''); // Remove extension
            if (ecoreModel.ePackages.length > 0 && ecoreModel.ePackages[0].nsURI) {
                metamodelKey = ecoreModel.ePackages[0].nsURI;
            }

            // Register the metamodel
            this.metamodelRegistry.registerMetamodel(metamodelKey, ecoreModel);
            console.log(`Registered JSON metamodel with key: ${metamodelKey}`);

            // Set as active if requested
            if (action.setAsActive !== false) {
                this.metamodelRegistry.setActiveMetamodel(metamodelKey);

                // Update model state to trigger visualization
                this.modelState.set('ecoreModel', ecoreModel);
                this.modelState.set('sourceContent', action.content); // Store for future reloads
                this.modelState.set('sourceUri', action.filename);
                this.modelState.set('modelType', 'ecore');
                this.modelState.set('viewMode', 'metamodel');

                console.log('Set modelType to ecore, viewMode to metamodel');
            }

            // Get all class information
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
                
                // Extract structural features - handle both eStructuralFeatures and separate eAttributes/eReferences
                const structuralFeatures = c.get ? c.get('eStructuralFeatures') : c.eStructuralFeatures;
                const eAttributes = c.get ? c.get('eAttributes') : c.eAttributes;
                const eReferences = c.get ? c.get('eReferences') : c.eReferences;
                const attributes: any[] = [];
                const references: any[] = [];
                
                console.log(`Extracting structural features for class '${className}'`);
                console.log(`Raw structuralFeatures:`, structuralFeatures);
                console.log(`Raw eAttributes:`, eAttributes);
                console.log(`Raw eReferences:`, eReferences);
                
                // Process attributes
                if (eAttributes) {
                    let attrs: any[] = [];
                    if (Array.isArray(eAttributes)) {
                        attrs = eAttributes;
                    } else if (eAttributes.forEach) {
                        eAttributes.forEach((f: any) => attrs.push(f));
                    }
                    
                    console.log(`Found ${attrs.length} attributes for ${className}`);
                    
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
                        console.log(`Added attribute: ${name} -> ${typeName}`);
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
                    
                    console.log(`Found ${refs.length} references for ${className}`);
                    
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
                        console.log(`Added reference: ${name} -> ${typeName} (containment: ${containment === true})`);
                    }
                }
                
                // Fallback: if eStructuralFeatures exists, process it (for other metamodel formats)
                if (structuralFeatures && !eAttributes && !eReferences) {
                    let features: any[] = [];
                    if (Array.isArray(structuralFeatures)) {
                        features = structuralFeatures;
                    } else if (structuralFeatures.forEach) {
                        structuralFeatures.forEach((f: any) => features.push(f));
                    }
                    
                    console.log(`Found ${features.length} structural features for ${className} (fallback)`);
                    
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
                            console.log(`Added reference: ${name} -> ${typeName} (containment: ${containment === true})`);
                        }
                    }
                }
                
                console.log(`Final result for ${className}: ${references.length} references, ${attributes.length} attributes`);
                
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

            // Get all enum names
            const allEnums = this.metamodelRegistry.getAllEEnums();
            const enumNames = allEnums.map(e => {
                return e.get ? e.get('name') : e.name;
            }).filter((name): name is string => !!name);

            console.log(`Found ${allClasses.length} total classes, ${classNames.length} non-abstract classes:`, classNames);

            // Create the GModel
            this.gmodelFactory.createModel();

            // Get the created model
            const gmodel = this.modelState.get('gmodel') as GModelRoot;
            if (gmodel) {
                // Return SetModelAction to update the client and LoadMetamodelResponse for feedback
                return [
                    SetModelAction.create(gmodel),
                    LoadMetamodelResponse.create(
                        true,
                        metamodelKey,
                        `Successfully loaded JSON metamodel '${metamodelKey}' with ${classNames.length} classes`,
                        classNames,
                        classInfo,
                        enumNames
                    )
                ];
            } else {
                throw new Error('Failed to create GModel');
            }
        } catch (error) {
            console.error('Error loading metamodel:', error);
            return [
                LoadMetamodelResponse.create(
                    false,
                    '',
                    `Error loading metamodel: ${error instanceof Error ? error.message : String(error)}`,
                    undefined,
                    undefined,
                    []
                )
            ];
        }
    }
}

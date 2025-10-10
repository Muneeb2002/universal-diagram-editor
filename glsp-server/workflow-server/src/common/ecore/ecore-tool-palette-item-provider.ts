import { Args, PaletteItem, TriggerEdgeCreationAction } from '@eclipse-glsp/protocol';
import { inject, injectable } from 'inversify';
import { ToolPaletteItemProvider, ModelState } from '@eclipse-glsp/server';

/**
 * Custom tool palette provider that shows Ecore metamodeling elements
 * (EClass, EAttribute, EReference, etc.) instead of generic "Nodes" and "Edges"
 */
@injectable()
export class EcoreToolPaletteItemProvider extends ToolPaletteItemProvider {
    @inject(ModelState)
    protected modelState: ModelState;

    override get contextId(): string {
        return 'tool-palette';
    }

    async getItems(args?: Args): Promise<PaletteItem[]> {
        // Always return Ecore metamodeling elements
        return this.getEcorePaletteItems();
    }

    private getEcorePaletteItems(): PaletteItem[] {
        // Create palette items for Ecore metamodeling elements
        const metamodelItems: PaletteItem[] = [];
        const relationshipItems: PaletteItem[] = [];

        // Only EClass for metamodel elements
        metamodelItems.push(
            this.createEClassPaletteItem()
        );

        // All relationship types for metamodeling
        relationshipItems.push(
            this.createEdgePaletteItem('Inheritance', 'edge:ecore-inheritance', 'Create Inheritance'),
            this.createEdgePaletteItem('Reference', 'edge:ecore-reference', 'Create Reference'),
            this.createEdgePaletteItem('Bidirectional', 'edge:ecore-bidirectional', 'Create Bidirectional Reference'),
            this.createEdgePaletteItem('Containment', 'edge:ecore-containment', 'Create Containment')
        );

        return [
            {
                id: 'ecore-metamodel-elements-group',
                label: 'Metamodel Elements',
                actions: [],
                children: metamodelItems,
                icon: 'symbol-class',
                sortString: 'A'
            },
            {
                id: 'ecore-relationships-group',
                label: 'Relationships',
                actions: [],
                children: relationshipItems,
                icon: 'symbol-interface',
                sortString: 'B'
            }
        ];
    }




    private createEdgePaletteItem(label: string, elementTypeId: string, actionLabel: string): PaletteItem {
        return {
            id: `palette-item-${elementTypeId}`,
            label: label,
            actions: [TriggerEdgeCreationAction.create(elementTypeId)],
            icon: 'symbol-interface',
            sortString: label
        };
    }

    private createEClassPaletteItem(): PaletteItem {
        return {
            id: 'palette-item-create-eclass',
            label: 'EClass',
            actions: [{
                kind: 'triggerEClassCreation'
            }],
            icon: 'symbol-class',
            sortString: 'EClass'
        };
    }
}

/**
 * @author Abigail Sotomayor <s205720@dtu.dk>
 */
import { Args, PaletteItem, TriggerEdgeCreationAction } from '@eclipse-glsp/protocol';
import { inject, injectable } from 'inversify';
import { ToolPaletteItemProvider, ModelState } from '@eclipse-glsp/server';

@injectable()
export class EcoreToolPaletteItemProvider extends ToolPaletteItemProvider {
    @inject(ModelState)
    protected modelState: ModelState;

    override get contextId(): string {
        return 'tool-palette';
    }

    async getItems(args?: Args): Promise<PaletteItem[]> {
        return this.getEcorePaletteItems();
    }

    private getEcorePaletteItems(): PaletteItem[] {
        const metamodelItems: PaletteItem[] = [];
        const relationshipItems: PaletteItem[] = [];

        metamodelItems.push(
            this.createEClassPaletteItem(),
            this.createEEnumPaletteItem()
        );

        relationshipItems.push(
            this.createEdgePaletteItem('Inheritance', 'edge:ecore-inheritance', 'debug-start'),
            this.createEdgePaletteItem('Reference', 'edge:ecore-reference', 'arrow-left'),
            this.createEdgePaletteItem('Bidirectional', 'edge:ecore-bidirectional', 'arrow-both'),
            this.createEdgePaletteItem('Containment', 'edge:ecore-containment', 'debug-breakpoint-log')
        );

        return [
            {
                id: 'ecore-metamodel-elements-group',
                label: 'Metamodel Elements',
                actions: [],
                children: metamodelItems,
                sortString: 'A'
            },
            {
                id: 'ecore-relationships-group',
                label: 'Relationships',
                actions: [],
                children: relationshipItems,
                sortString: 'B'
            }
        ];
    }


    private createEdgePaletteItem(label: string, elementTypeId: string, icon: string): PaletteItem {
        return {
            id: `palette-item-${elementTypeId}`,
            label: label,
            actions: [TriggerEdgeCreationAction.create(elementTypeId)],
            icon,
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

    private createEEnumPaletteItem(): PaletteItem {
        return {
            id: 'palette-item-create-enum',
            label: 'EEnum',
            actions: [{
                kind: 'triggerEEnumCreation'
            }],
            icon: 'symbol-enum',
            sortString: 'EEnum'
        };
    }

}

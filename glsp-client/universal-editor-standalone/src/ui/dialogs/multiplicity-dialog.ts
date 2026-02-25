/**
 * @author Abigail Sotomayor <s205720@dtu.dk>
 */
import { BaseDialog } from './base-dialog';

export interface MultiplicityOptions {
    lowerBound: number;
    upperBound: number;
    referenceName: string;
}

/**
 * Dialog for configuring reference multiplicity.
 * Extends BaseDialog to inherit common dialog functionality.
 */
export class MultiplicityDialog extends BaseDialog<MultiplicityOptions> {
    private sourceClassName: string = '';
    private targetClassName: string = '';
    private edgeType: string = '';

    private titleElement!: HTMLHeadingElement;
    private referenceNameInput!: HTMLInputElement;
    private lowerBoundInput!: HTMLInputElement;
    private upperBoundInput!: HTMLInputElement;

    constructor() {
        super();
        this.buildDialog();
    }

    /**
     * Build the dialog structure using helper methods from BaseDialog
     */
    private buildDialog(): void {
        this.titleElement = this.createTitle('Configure Reference');
        this.titleElement.id = 'dialogTitle';
        this.contentElement.appendChild(this.titleElement);

        const refNameGroup = this.createInputGroup('Reference Name:', {
            id: 'referenceName',
            type: 'text',
            placeholder: 'Enter reference name'
        });
        this.contentElement.appendChild(refNameGroup);

        const boundsRow = document.createElement('div');
        boundsRow.className = 'dialog-input-row';

        const lowerBoundGroup = this.createInputGroup('Lower Bound:', {
            id: 'lowerBound',
            type: 'number',
            value: '0',
            min: '0'
        });

        const upperBoundGroup = this.createInputGroup('Upper Bound:', {
            id: 'upperBound',
            type: 'number',
            value: '-1',
            min: '-1'
        });

        boundsRow.appendChild(lowerBoundGroup);
        boundsRow.appendChild(upperBoundGroup);
        this.contentElement.appendChild(boundsRow);

        this.referenceNameInput = document.getElementById('referenceName') as HTMLInputElement;
        this.lowerBoundInput = document.getElementById('lowerBound') as HTMLInputElement;
        this.upperBoundInput = document.getElementById('upperBound') as HTMLInputElement;

        this.addKeyboardHandlers([
            this.referenceNameInput,
            this.lowerBoundInput,
            this.upperBoundInput
        ]);

        const cancelButton = this.createButton('Cancel', 'secondary', () => this.cancel());
        const createButton = this.createButton('Create Reference', 'primary', () => this.handleConfirm());
        const buttonContainer = this.createButtonContainer(cancelButton, createButton);
        this.contentElement.appendChild(buttonContainer);
    }

    /**
     * Show the dialog with class names and edge type (API compatibility with old version)
     */
    show(sourceClassName: string, targetClassName: string, edgeType?: string): Promise<MultiplicityOptions> {
        this.sourceClassName = sourceClassName;
        this.targetClassName = targetClassName;
        this.edgeType = edgeType || '';
        return this.showDialog();
    }

    /**
     * Called when dialog is shown - update labels and set default values
     */
    protected override onShow(): void {
        const isContainment = this.edgeType === 'edge:ecore-containment';
        const edgeLabel = isContainment ? 'Containment' : 'Reference';

        this.titleElement.textContent = `Create ${edgeLabel}: ${this.sourceClassName} → ${this.targetClassName}`;

        if (isContainment) {
            this.referenceNameInput.value = `${this.targetClassName.toLowerCase()}s`; // Plural for containment
        } else {
            this.referenceNameInput.value = `${this.targetClassName.toLowerCase()}`; // Singular for reference
        }


        if (isContainment) {
            this.lowerBoundInput.value = '0'; 
            this.upperBoundInput.value = '-1'; // Containment: 0..* (many)
        } else {
            this.lowerBoundInput.value = '1'; // Reference: 1..1 (required)
            this.upperBoundInput.value = '1'; 
        }
    }

    /**
     * Validate and confirm the dialog
     */
    protected override handleConfirm(): void {
        const referenceName = this.referenceNameInput.value.trim();
        const lowerBound = parseInt(this.lowerBoundInput.value);
        const upperBound = parseInt(this.upperBoundInput.value);

        if (!referenceName) {
            alert('Please enter a reference name');
            this.referenceNameInput.focus();
            return;
        }

        if (isNaN(lowerBound) || lowerBound < 0) {
            alert('Lower bound must be a non-negative number');
            this.lowerBoundInput.focus();
            return;
        }

        if (isNaN(upperBound) || (upperBound !== -1 && upperBound < lowerBound)) {
            alert('Upper bound must be -1 (unlimited) or greater than or equal to lower bound');
            this.upperBoundInput.focus();
            return;
        }

        this.confirm({
            referenceName,
            lowerBound,
            upperBound
        });
    }
}

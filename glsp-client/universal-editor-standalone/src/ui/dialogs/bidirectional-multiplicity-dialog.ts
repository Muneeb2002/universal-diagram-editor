/**
 * @author Abigail Sotomayor <s205720@dtu.dk>
 */
import { BaseDialog } from './base-dialog';

export interface BidirectionalMultiplicityOptions {
    sourceReferenceName: string;
    sourceLowerBound: number;
    sourceUpperBound: number;
    targetReferenceName: string;
    targetLowerBound: number;
    targetUpperBound: number;
}

/**
 * Dialog for configuring bidirectional references between classes.
 * Extends BaseDialog to inherit common dialog functionality.
 */
export class BidirectionalMultiplicityDialog extends BaseDialog<BidirectionalMultiplicityOptions> {
    private sourceClassName: string = '';
    private targetClassName: string = '';

    private titleElement!: HTMLHeadingElement;
    private sourceRefInput!: HTMLInputElement;
    private sourceLowerInput!: HTMLInputElement;
    private sourceUpperInput!: HTMLInputElement;
    private targetRefInput!: HTMLInputElement;
    private targetLowerInput!: HTMLInputElement;
    private targetUpperInput!: HTMLInputElement;

    constructor() {
        super();
        this.buildDialog();
    }

    /**
     * Build the dialog structure using helper methods from BaseDialog
     */
    private buildDialog(): void {
        this.titleElement = this.createTitle('Configure Bidirectional Reference');
        this.titleElement.id = 'dialogTitle';
        this.contentElement.appendChild(this.titleElement);

        const forwardSection = this.createReferenceSection(
            'forward',
            'sourceClassLabel',
            'targetClassLabel'
        );
        this.contentElement.appendChild(forwardSection);

        const reverseSection = this.createReferenceSection(
            'reverse',
            'targetClassLabel2',
            'sourceClassLabel2',
            true
        );
        this.contentElement.appendChild(reverseSection);

        this.sourceRefInput = document.getElementById('sourceReferenceName') as HTMLInputElement;
        this.sourceLowerInput = document.getElementById('sourceLowerBound') as HTMLInputElement;
        this.sourceUpperInput = document.getElementById('sourceUpperBound') as HTMLInputElement;
        this.targetRefInput = document.getElementById('targetReferenceName') as HTMLInputElement;
        this.targetLowerInput = document.getElementById('targetLowerBound') as HTMLInputElement;
        this.targetUpperInput = document.getElementById('targetUpperBound') as HTMLInputElement;

        this.addKeyboardHandlers([
            this.sourceRefInput,
            this.sourceLowerInput,
            this.sourceUpperInput,
            this.targetRefInput,
            this.targetLowerInput,
            this.targetUpperInput
        ]);

        const cancelButton = this.createButton('Cancel', 'secondary', () => this.cancel());
        const createButton = this.createButton('Create', 'primary', () => this.handleConfirm());
        const buttonContainer = this.createButtonContainer(cancelButton, createButton);
        this.contentElement.appendChild(buttonContainer);
    }

    /**
     * Create a reference section (forward or reverse)
     */
    private createReferenceSection(
        direction: 'forward' | 'reverse',
        sourceLabelId: string,
        targetLabelId: string,
        isReverse: boolean = false
    ): HTMLDivElement {
        const section = document.createElement('div');
        section.className = 'bidirectional-dialog-section';

        const header = document.createElement('h4');
        header.className = 'bidirectional-dialog-header';
        header.innerHTML = `
            <span id="${sourceLabelId}">${isReverse ? 'Target' : 'Source'}</span>
            <span class="bidirectional-dialog-arrow">→</span>
            <span id="${targetLabelId}">${isReverse ? 'Source' : 'Target'}</span>
            ${isReverse ? ' <span style="color: #666;">(opposite)</span>' : ''}
        `;
        section.appendChild(header);

        const prefix = direction === 'forward' ? 'source' : 'target';
        const refNameGroup = this.createInputGroup(
            'Reference Name:',
            {
                id: `${prefix}ReferenceName`,
                type: 'text',
                placeholder: 'Enter reference name'
            }
        );
        section.appendChild(refNameGroup);

        const boundsRow = document.createElement('div');
        boundsRow.className = 'dialog-input-row';

        const lowerBoundGroup = this.createInputGroup(
            'Lower Bound:',
            {
                id: `${prefix}LowerBound`,
                type: 'number',
                value: '0',
                min: '0'
            }
        );

        const upperBoundGroup = this.createInputGroup(
            'Upper Bound:',
            {
                id: `${prefix}UpperBound`,
                type: 'number',
                value: direction === 'forward' ? '1' : '-1',
                min: '-1'
            }
        );

        boundsRow.appendChild(lowerBoundGroup);
        boundsRow.appendChild(upperBoundGroup);
        section.appendChild(boundsRow);

        return section;
    }

    /**
     * Show the dialog with class names (API compatibility with old version)
     */
    show(sourceClassName: string, targetClassName: string): Promise<BidirectionalMultiplicityOptions> {
        this.sourceClassName = sourceClassName;
        this.targetClassName = targetClassName;
        return this.showDialog();
    }

    /**
     * Called when dialog is shown - update labels and set default values
     */
    protected override onShow(): void {
        this.titleElement.textContent = `Create Bidirectional Reference: ${this.sourceClassName} ↔ ${this.targetClassName}`;

        const sourceLabel1 = document.getElementById('sourceClassLabel');
        const targetLabel1 = document.getElementById('targetClassLabel');
        const sourceLabel2 = document.getElementById('sourceClassLabel2');
        const targetLabel2 = document.getElementById('targetClassLabel2');

        if (sourceLabel1) sourceLabel1.textContent = this.sourceClassName;
        if (targetLabel1) targetLabel1.textContent = this.targetClassName;
        if (sourceLabel2) sourceLabel2.textContent = this.sourceClassName;
        if (targetLabel2) targetLabel2.textContent = this.targetClassName;

        this.sourceRefInput.value = `${this.targetClassName.toLowerCase()}s`;
        this.targetRefInput.value = `${this.sourceClassName.toLowerCase()}s`;

        this.sourceLowerInput.value = '0';
        this.sourceUpperInput.value = '-1';
        this.targetLowerInput.value = '0';
        this.targetUpperInput.value = '-1';
    }

    /**
     * Validate and confirm the dialog
     */
    protected override handleConfirm(): void {
        const sourceReferenceName = this.sourceRefInput.value.trim();
        const sourceLowerBound = parseInt(this.sourceLowerInput.value);
        const sourceUpperBound = parseInt(this.sourceUpperInput.value);
        const targetReferenceName = this.targetRefInput.value.trim();
        const targetLowerBound = parseInt(this.targetLowerInput.value);
        const targetUpperBound = parseInt(this.targetUpperInput.value);

        if (!sourceReferenceName) {
            alert('Please enter a source reference name');
            this.sourceRefInput.focus();
            return;
        }

        if (!targetReferenceName) {
            alert('Please enter a target reference name');
            this.targetRefInput.focus();
            return;
        }

        if (isNaN(sourceLowerBound) || sourceLowerBound < 0) {
            alert('Source lower bound must be a non-negative number');
            this.sourceLowerInput.focus();
            return;
        }

        if (isNaN(sourceUpperBound) || (sourceUpperBound !== -1 && sourceUpperBound < sourceLowerBound)) {
            alert('Source upper bound must be -1 (unlimited) or greater than or equal to lower bound');
            this.sourceUpperInput.focus();
            return;
        }

        if (isNaN(targetLowerBound) || targetLowerBound < 0) {
            alert('Target lower bound must be a non-negative number');
            this.targetLowerInput.focus();
            return;
        }

        if (isNaN(targetUpperBound) || (targetUpperBound !== -1 && targetUpperBound < targetLowerBound)) {
            alert('Target upper bound must be -1 (unlimited) or greater than or equal to lower bound');
            this.targetUpperInput.focus();
            return;
        }

        this.confirm({
            sourceReferenceName,
            sourceLowerBound,
            sourceUpperBound,
            targetReferenceName,
            targetLowerBound,
            targetUpperBound
        });
    }
}

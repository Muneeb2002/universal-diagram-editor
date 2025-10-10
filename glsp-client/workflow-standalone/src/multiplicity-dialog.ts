
export interface MultiplicityOptions {
    lowerBound: number;
    upperBound: number;
    referenceName: string;
}

export class MultiplicityDialog {
    private dialog: HTMLDivElement;
    private currentResolve?: (value: MultiplicityOptions) => void;
    private currentReject?: (reason?: any) => void;

    constructor() {
        console.log('MultiplicityDialog constructor called');
        this.dialog = this.createDialog();
    }

    private createDialog(): HTMLDivElement {
        const dialog = document.createElement('div');
        dialog.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            z-index: 10000;
            display: none;
            justify-content: center;
            align-items: center;
        `;

        const content = document.createElement('div');
        content.style.cssText = `
            background: white;
            border-radius: 8px;
            padding: 24px;
            min-width: 400px;
            max-width: 500px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        `;

        content.innerHTML = `
            <h3 style="margin: 0 0 16px 0; color: #333; font-size: 18px;">Configure Containment Reference</h3>
            <div style="margin-bottom: 16px;">
                <label for="referenceName" style="display: block; margin-bottom: 4px; font-weight: 500; color: #555;">Reference Name:</label>
                <input type="text" id="referenceName" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;" placeholder="Enter reference name">
            </div>
            <div style="display: flex; gap: 16px; margin-bottom: 16px;">
                <div style="flex: 1;">
                    <label for="lowerBound" style="display: block; margin-bottom: 4px; font-weight: 500; color: #555;">Lower Bound:</label>
                    <input type="number" id="lowerBound" min="0" value="0" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
                </div>
                <div style="flex: 1;">
                    <label for="upperBound" style="display: block; margin-bottom: 4px; font-weight: 500; color: #555;">Upper Bound:</label>
                    <input type="number" id="upperBound" min="-1" value="-1" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
                </div>
            </div>
            <div style="margin-bottom: 16px; padding: 12px; background-color: #f5f5f5; border-radius: 4px; font-size: 13px; color: #666;">
                <strong>Multiplicity Guide:</strong><br>
                • Lower Bound: minimum number of references (0 = optional)<br>
                • Upper Bound: maximum number of references (-1 = unlimited, 1 = single)<br>
                • Common patterns: 0..1 (optional), 1..1 (required), 0..* (many), 1..* (required many)
            </div>
            <div style="display: flex; gap: 12px; justify-content: flex-end;">
                <button id="cancelBtn" style="padding: 8px 16px; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer; font-size: 14px;">Cancel</button>
                <button id="okBtn" style="padding: 8px 16px; border: none; background: #007acc; color: white; border-radius: 4px; cursor: pointer; font-size: 14px;">Create Reference</button>
            </div>
        `;

        dialog.appendChild(content);
        document.body.appendChild(dialog);

        // Add event listeners
        const cancelBtn = content.querySelector('#cancelBtn') as HTMLButtonElement;
        const okBtn = content.querySelector('#okBtn') as HTMLButtonElement;
        const referenceNameInput = content.querySelector('#referenceName') as HTMLInputElement;
        const lowerBoundInput = content.querySelector('#lowerBound') as HTMLInputElement;
        const upperBoundInput = content.querySelector('#upperBound') as HTMLInputElement;

        cancelBtn.addEventListener('click', () => this.cancel());
        okBtn.addEventListener('click', () => this.confirm());
        
        // Handle Enter key
        [referenceNameInput, lowerBoundInput, upperBoundInput].forEach(input => {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    this.confirm();
                } else if (e.key === 'Escape') {
                    this.cancel();
                }
            });
        });

        // Close dialog when clicking outside
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                this.cancel();
            }
        });

        return dialog;
    }

    show(sourceClassName: string, targetClassName: string): Promise<MultiplicityOptions> {
        console.log('MultiplicityDialog.show() called, current resolve:', !!this.currentResolve);
        return new Promise((resolve, reject) => {
            this.currentResolve = resolve;
            this.currentReject = reject;
            console.log('Promise callbacks set:', { resolve: !!this.currentResolve, reject: !!this.currentReject });

            // Set default reference name
            const referenceNameInput = this.dialog.querySelector('#referenceName') as HTMLInputElement;
            referenceNameInput.value = `${targetClassName.toLowerCase()}s`;

            // Update dialog title
            const title = this.dialog.querySelector('h3') as HTMLHeadingElement;
            title.textContent = `Create containment: ${sourceClassName} → ${targetClassName}`;

            this.dialog.style.display = 'flex';
            
            // Focus on reference name input
            referenceNameInput.focus();
            referenceNameInput.select();
        });
    }

    private confirm(): void {
        console.log('MultiplicityDialog.confirm() called, currentResolve:', !!this.currentResolve, 'currentReject:', !!this.currentReject);
        const referenceNameInput = this.dialog.querySelector('#referenceName') as HTMLInputElement;
        const lowerBoundInput = this.dialog.querySelector('#lowerBound') as HTMLInputElement;
        const upperBoundInput = this.dialog.querySelector('#upperBound') as HTMLInputElement;

        const referenceName = referenceNameInput.value.trim();
        const lowerBound = parseInt(lowerBoundInput.value);
        const upperBound = parseInt(upperBoundInput.value);

        if (!referenceName) {
            alert('Please enter a reference name');
            return;
        }

        if (isNaN(lowerBound) || lowerBound < 0) {
            alert('Lower bound must be a non-negative number');
            return;
        }

        if (isNaN(upperBound) || (upperBound !== -1 && upperBound < lowerBound)) {
            alert('Upper bound must be -1 (unlimited) or greater than or equal to lower bound');
            return;
        }

        this.hide();
        if (this.currentResolve) {
            console.log('Resolving promise with options:', { referenceName, lowerBound, upperBound });
            this.currentResolve({
                referenceName,
                lowerBound,
                upperBound
            });
            this.currentResolve = undefined;
            this.currentReject = undefined;
        } else {
            console.log('No currentResolve available');
        }
    }

    private cancel(): void {
        this.hide();
        if (this.currentReject) {
            this.currentReject(new Error('User cancelled'));
            this.currentResolve = undefined;
            this.currentReject = undefined;
        }
    }

    private hide(): void {
        this.dialog.style.display = 'none';
    }

    destroy(): void {
        if (this.dialog.parentNode) {
            this.dialog.parentNode.removeChild(this.dialog);
        }
    }
}

 /********************************************************************************
  * Copyright (c) 2024 Eclipse GLSP and others.
  *
  * This program and the accompanying materials are made available under the
  * terms of the Eclipse Public License v. 2.0 which is available at
  * http://www.eclipse.org/legal/epl-2.0.
  *
  * SPDX-License-Identifier: EPL-2.0
  ********************************************************************************/


export interface BidirectionalMultiplicityOptions {
    sourceReferenceName: string;
    sourceLowerBound: number;
    sourceUpperBound: number;
    targetReferenceName: string;
    targetLowerBound: number;
    targetUpperBound: number;
}

export class BidirectionalMultiplicityDialog {
    private dialog: HTMLDivElement;
    private currentResolve?: (value: BidirectionalMultiplicityOptions) => void;
    private currentReject?: (reason?: any) => void;

    constructor() {
        
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
            min-width: 500px;
            max-width: 600px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        `;

        content.innerHTML = `
            <h3 id="dialogTitle" style="margin: 0 0 16px 0; color: #333; font-size: 18px;">Configure Bidirectional Reference</h3>
            
            <!-- Forward Reference (Source -> Target) -->
            <div style="margin-bottom: 20px; padding: 16px; background-color: #f0f8ff; border-radius: 4px;">
                <h4 style="margin: 0 0 12px 0; color: #0066cc; font-size: 14px; font-weight: 600;">
                    <span id="sourceClassLabel">Source</span> → <span id="targetClassLabel">Target</span>
                </h4>
                <div style="margin-bottom: 12px;">
                    <label for="sourceReferenceName" style="display: block; margin-bottom: 4px; font-weight: 500; color: #555;">Reference Name:</label>
                    <input type="text" id="sourceReferenceName" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;" placeholder="Enter reference name">
                </div>
                <div style="display: flex; gap: 12px;">
                    <div style="flex: 1;">
                        <label for="sourceLowerBound" style="display: block; margin-bottom: 4px; font-weight: 500; color: #555;">Lower Bound:</label>
                        <input type="number" id="sourceLowerBound" min="0" value="0" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
                    </div>
                    <div style="flex: 1;">
                        <label for="sourceUpperBound" style="display: block; margin-bottom: 4px; font-weight: 500; color: #555;">Upper Bound:</label>
                        <input type="number" id="sourceUpperBound" min="-1" value="1" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
                    </div>
                </div>
            </div>

            <!-- Reverse Reference (Target -> Source) -->
            <div style="margin-bottom: 20px; padding: 16px; background-color: #fff0f5; border-radius: 4px;">
                <h4 style="margin: 0 0 12px 0; color: #cc0066; font-size: 14px; font-weight: 600;">
                    <span id="targetClassLabel2">Target</span> → <span id="sourceClassLabel2">Source</span> (opposite)
                </h4>
                <div style="margin-bottom: 12px;">
                    <label for="targetReferenceName" style="display: block; margin-bottom: 4px; font-weight: 500; color: #555;">Reference Name:</label>
                    <input type="text" id="targetReferenceName" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;" placeholder="Enter opposite reference name">
                </div>
                <div style="display: flex; gap: 12px;">
                    <div style="flex: 1;">
                        <label for="targetLowerBound" style="display: block; margin-bottom: 4px; font-weight: 500; color: #555;">Lower Bound:</label>
                        <input type="number" id="targetLowerBound" min="0" value="0" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
                    </div>
                    <div style="flex: 1;">
                        <label for="targetUpperBound" style="display: block; margin-bottom: 4px; font-weight: 500; color: #555;">Upper Bound:</label>
                        <input type="number" id="targetUpperBound" min="-1" value="-1" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
                    </div>
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
                <button id="okBtn" style="padding: 8px 16px; border: none; background: #007acc; color: white; border-radius: 4px; cursor: pointer; font-size: 14px;">Create Bidirectional Reference</button>
            </div>
        `;

        dialog.appendChild(content);
        document.body.appendChild(dialog);

        // Add event listeners
        const cancelBtn = content.querySelector('#cancelBtn') as HTMLButtonElement;
        const okBtn = content.querySelector('#okBtn') as HTMLButtonElement;
        const inputs = [
            content.querySelector('#sourceReferenceName'),
            content.querySelector('#sourceLowerBound'),
            content.querySelector('#sourceUpperBound'),
            content.querySelector('#targetReferenceName'),
            content.querySelector('#targetLowerBound'),
            content.querySelector('#targetUpperBound')
        ] as HTMLInputElement[];

        cancelBtn.addEventListener('click', () => this.cancel());
        okBtn.addEventListener('click', () => this.confirm());
        
        // Handle Enter key
        inputs.forEach(input => {
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

    show(sourceClassName: string, targetClassName: string): Promise<BidirectionalMultiplicityOptions> {
        
        return new Promise((resolve, reject) => {
            this.currentResolve = resolve;
            this.currentReject = reject;

            // Set default reference names
            const sourceRefInput = this.dialog.querySelector('#sourceReferenceName') as HTMLInputElement;
            const targetRefInput = this.dialog.querySelector('#targetReferenceName') as HTMLInputElement;
            
            sourceRefInput.value = `${targetClassName.toLowerCase()}s`; // Source -> Target: plural
            targetRefInput.value = `${sourceClassName.toLowerCase()}s`; // Target -> Source: plural

            // Update class labels in both sections
            const sourceLabel1 = this.dialog.querySelector('#sourceClassLabel') as HTMLSpanElement;
            const targetLabel1 = this.dialog.querySelector('#targetClassLabel') as HTMLSpanElement;
            const sourceLabel2 = this.dialog.querySelector('#sourceClassLabel2') as HTMLSpanElement;
            const targetLabel2 = this.dialog.querySelector('#targetClassLabel2') as HTMLSpanElement;

            sourceLabel1.textContent = sourceClassName;
            targetLabel1.textContent = targetClassName;
            sourceLabel2.textContent = sourceClassName;
            targetLabel2.textContent = targetClassName;

            // Update dialog title
            const title = this.dialog.querySelector('#dialogTitle') as HTMLHeadingElement;
            title.textContent = `Create Bidirectional Reference: ${sourceClassName} ↔ ${targetClassName}`;

            this.dialog.style.display = 'flex';
            
            // Focus on first reference name input
            sourceRefInput.focus();
            sourceRefInput.select();
        });
    }

    private confirm(): void {
        
        
        const sourceRefInput = this.dialog.querySelector('#sourceReferenceName') as HTMLInputElement;
        const sourceLowerInput = this.dialog.querySelector('#sourceLowerBound') as HTMLInputElement;
        const sourceUpperInput = this.dialog.querySelector('#sourceUpperBound') as HTMLInputElement;
        const targetRefInput = this.dialog.querySelector('#targetReferenceName') as HTMLInputElement;
        const targetLowerInput = this.dialog.querySelector('#targetLowerBound') as HTMLInputElement;
        const targetUpperInput = this.dialog.querySelector('#targetUpperBound') as HTMLInputElement;

        const sourceReferenceName = sourceRefInput.value.trim();
        const sourceLowerBound = parseInt(sourceLowerInput.value);
        const sourceUpperBound = parseInt(sourceUpperInput.value);
        const targetReferenceName = targetRefInput.value.trim();
        const targetLowerBound = parseInt(targetLowerInput.value);
        const targetUpperBound = parseInt(targetUpperInput.value);

        // Validation
        if (!sourceReferenceName) {
            alert('Please enter a source reference name');
            return;
        }

        if (!targetReferenceName) {
            alert('Please enter a target reference name');
            return;
        }

        if (isNaN(sourceLowerBound) || sourceLowerBound < 0) {
            alert('Source lower bound must be a non-negative number');
            return;
        }

        if (isNaN(sourceUpperBound) || (sourceUpperBound !== -1 && sourceUpperBound < sourceLowerBound)) {
            alert('Source upper bound must be -1 (unlimited) or greater than or equal to lower bound');
            return;
        }

        if (isNaN(targetLowerBound) || targetLowerBound < 0) {
            alert('Target lower bound must be a non-negative number');
            return;
        }

        if (isNaN(targetUpperBound) || (targetUpperBound !== -1 && targetUpperBound < targetLowerBound)) {
            alert('Target upper bound must be -1 (unlimited) or greater than or equal to lower bound');
            return;
        }

        this.hide();
        if (this.currentResolve) {
            
            this.currentResolve({
                sourceReferenceName,
                sourceLowerBound,
                sourceUpperBound,
                targetReferenceName,
                targetLowerBound,
                targetUpperBound
            });
            this.currentResolve = undefined;
            this.currentReject = undefined;
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


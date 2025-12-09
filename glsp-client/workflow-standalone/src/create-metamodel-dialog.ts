/********************************************************************************
 * Copyright (c) 2024 Eclipse GLSP and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * SPDX-License-Identifier: EPL-2.0
 ********************************************************************************/

export interface MetamodelCreationOptions {
    packageName: string;
    nsURI: string;
    nsPrefix: string;
}

export class CreateMetamodelDialog {
    private dialog: HTMLDivElement;
    private currentResolve?: (value: MetamodelCreationOptions) => void;
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
            min-width: 450px;
            max-width: 550px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        `;

        content.innerHTML = `
            <h3 id="dialogTitle" style="margin: 0 0 20px 0; color: #333; font-size: 18px;">Create Custom Metamodel</h3>
            <div style="margin-bottom: 16px;">
                <label for="packageName" style="display: block; margin-bottom: 4px; font-weight: 500; color: #555;">Package Name:</label>
                <input type="text" id="packageName" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; box-sizing: border-box;" placeholder="Enter package name">
                <div style="font-size: 12px; color: #777; margin-top: 4px;">Must start with a letter or underscore</div>
            </div>
            <div style="margin-bottom: 16px;">
                <label for="nsURI" style="display: block; margin-bottom: 4px; font-weight: 500; color: #555;">Namespace URI:</label>
                <input type="text" id="nsURI" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; box-sizing: border-box;" placeholder="https://www.example.org/package">
                <div style="font-size: 12px; color: #777; margin-top: 4px;">Should start with http:// or https://</div>
            </div>
            <div style="margin-bottom: 20px;">
                <label for="nsPrefix" style="display: block; margin-bottom: 4px; font-weight: 500; color: #555;">Namespace Prefix:</label>
                <input type="text" id="nsPrefix" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; box-sizing: border-box;" placeholder="Enter namespace prefix">
                <div style="font-size: 12px; color: #777; margin-top: 4px;">Must start with a letter or underscore</div>
            </div>
            <div style="display: flex; gap: 12px; justify-content: flex-end;">
                <button id="cancelBtn" style="padding: 8px 16px; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer; font-size: 14px;">Cancel</button>
                <button id="okBtn" style="padding: 8px 16px; border: none; background: #007acc; color: white; border-radius: 4px; cursor: pointer; font-size: 14px;">Create Metamodel</button>
            </div>
        `;

        dialog.appendChild(content);
        document.body.appendChild(dialog);

        // Add event listeners
        const cancelBtn = content.querySelector('#cancelBtn') as HTMLButtonElement;
        const okBtn = content.querySelector('#okBtn') as HTMLButtonElement;
        const packageNameInput = content.querySelector('#packageName') as HTMLInputElement;
        const nsURIInput = content.querySelector('#nsURI') as HTMLInputElement;
        const nsPrefixInput = content.querySelector('#nsPrefix') as HTMLInputElement;

        // Auto-fill defaults when package name changes
        packageNameInput.addEventListener('input', () => {
            const packageName = packageNameInput.value.trim();
            if (packageName && !nsURIInput.value) {
                nsURIInput.value = `https://www.example.org/${packageName}`;
            }
            if (packageName && !nsPrefixInput.value) {
                const defaultPrefix = packageName.slice(0, 3).toLowerCase() || 'pkg';
                nsPrefixInput.value = defaultPrefix;
            }
        });

        cancelBtn.addEventListener('click', () => this.cancel());
        okBtn.addEventListener('click', () => this.confirm());
        
        // Handle Enter key
        [packageNameInput, nsURIInput, nsPrefixInput].forEach(input => {
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

    show(): Promise<MetamodelCreationOptions> {
        return new Promise((resolve, reject) => {
            // Clear any previous state
            this.currentResolve = undefined;
            this.currentReject = undefined;
            
            this.currentResolve = resolve;
            this.currentReject = reject;

            // Reset inputs
            const packageNameInput = this.dialog.querySelector('#packageName') as HTMLInputElement;
            const nsURIInput = this.dialog.querySelector('#nsURI') as HTMLInputElement;
            const nsPrefixInput = this.dialog.querySelector('#nsPrefix') as HTMLInputElement;

            packageNameInput.value = '';
            nsURIInput.value = '';
            nsPrefixInput.value = '';

            this.dialog.style.display = 'flex';
            
            // Focus on package name input
            packageNameInput.focus();
            
            // Trigger input event to auto-fill defaults when user starts typing
            // This will be handled by the input event listener
        });
    }

    private confirm(): void {
        const packageNameInput = this.dialog.querySelector('#packageName') as HTMLInputElement;
        const nsURIInput = this.dialog.querySelector('#nsURI') as HTMLInputElement;
        const nsPrefixInput = this.dialog.querySelector('#nsPrefix') as HTMLInputElement;

        const packageName = packageNameInput.value.trim();
        const nsURI = nsURIInput.value.trim();
        const nsPrefix = nsPrefixInput.value.trim();

        // Validate package name
        if (!packageName) {
            alert('Package name is required.');
            packageNameInput.focus();
            return;
        }

        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(packageName)) {
            alert('Package name must start with a letter or underscore and contain only letters, numbers, and underscores.');
            packageNameInput.focus();
            return;
        }

        // Validate nsURI
        if (!nsURI) {
            alert('Namespace URI is required.');
            nsURIInput.focus();
            return;
        }

        if (!/^https?:\/\//i.test(nsURI)) {
            const proceed = confirm('Namespace URI does not start with http:// or https://. Continue anyway?');
            if (!proceed) {
                nsURIInput.focus();
                return;
            }
        }

        // Validate nsPrefix
        if (!nsPrefix) {
            alert('Namespace prefix is required.');
            nsPrefixInput.focus();
            return;
        }

        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(nsPrefix)) {
            alert('Namespace prefix must start with a letter or underscore and contain only letters, numbers, and underscores.');
            nsPrefixInput.focus();
            return;
        }

        this.hide();
        if (this.currentResolve) {
            this.currentResolve({
                packageName,
                nsURI,
                nsPrefix
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


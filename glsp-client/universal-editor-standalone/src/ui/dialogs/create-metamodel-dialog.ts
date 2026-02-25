/**
 * @author Abigail Sotomayor <s205720@dtu.dk>
 */
import { BaseDialog } from './base-dialog';

export interface MetamodelCreationOptions {
    packageName: string;
    nsURI: string;
    nsPrefix: string;
}

/**
 * Dialog for creating a custom metamodel with package information.
 * Extends BaseDialog to inherit common dialog functionality.
 */
export class CreateMetamodelDialog extends BaseDialog<MetamodelCreationOptions> {
    private packageNameInput!: HTMLInputElement;
    private nsURIInput!: HTMLInputElement;
    private nsPrefixInput!: HTMLInputElement;

    constructor() {
        super();
        this.buildDialog();
    }

    /**
     * Build the dialog structure using helper methods from BaseDialog
     */
    private buildDialog(): void {
        // Create title
        const title = this.createTitle('Create Custom Metamodel');
        this.contentElement.appendChild(title);

        // Package name input with hint
        const packageGroup = this.createInputGroupWithHint(
            'Package Name:',
            {
                id: 'packageName',
                type: 'text',
                placeholder: 'Enter package name'
            },
            'Must start with a letter or underscore'
        );
        this.contentElement.appendChild(packageGroup);

        // Namespace URI input with hint
        const nsURIGroup = this.createInputGroupWithHint(
            'Namespace URI:',
            {
                id: 'nsURI',
                type: 'text',
                placeholder: 'https://www.example.org/package'
            },
            'Should start with http:// or https://'
        );
        this.contentElement.appendChild(nsURIGroup);

        // Namespace prefix input with hint
        const nsPrefixGroup = this.createInputGroupWithHint(
            'Namespace Prefix:',
            {
                id: 'nsPrefix',
                type: 'text',
                placeholder: 'Enter namespace prefix'
            },
            'Must start with a letter or underscore'
        );
        this.contentElement.appendChild(nsPrefixGroup);

        // Get input references
        this.packageNameInput = document.getElementById('packageName') as HTMLInputElement;
        this.nsURIInput = document.getElementById('nsURI') as HTMLInputElement;
        this.nsPrefixInput = document.getElementById('nsPrefix') as HTMLInputElement;

        // Auto-fill defaults when package name changes
        this.packageNameInput.addEventListener('input', (e) => {
            const packageName = (e.target as HTMLInputElement).value.trim();
            if (packageName) {
                this.nsURIInput.value = `https://www.example.org/${packageName}`;
                const defaultPrefix = packageName.toLowerCase() || 'pkg';
                this.nsPrefixInput.value = defaultPrefix;
            }
        });

        // Add keyboard handlers
        this.addKeyboardHandlers([
            this.packageNameInput,
            this.nsURIInput,
            this.nsPrefixInput
        ]);

        // Create buttons
        const cancelButton = this.createButton('Cancel', 'secondary', () => this.cancel());
        const createButton = this.createButton('Create Ecore model', 'primary', () => this.handleConfirm());
        const buttonContainer = this.createButtonContainer(cancelButton, createButton);
        this.contentElement.appendChild(buttonContainer);
    }

    /**
     * Create an input group with a hint text below
     */
    private createInputGroupWithHint(
        labelText: string,
        inputConfig: {
            id: string;
            type?: string;
            placeholder?: string;
        },
        hintText: string
    ): HTMLDivElement {
        const group = this.createInputGroup(labelText, inputConfig);

        const hint = document.createElement('div');
        hint.className = 'dialog-input-hint';
        hint.textContent = hintText;
        group.appendChild(hint);

        return group;
    }

    /**
     * Show the dialog (API compatibility with old version)
     */
    show(): Promise<MetamodelCreationOptions> {
        return this.showDialog();
    }

    /**
     * Called when dialog is shown - reset inputs
     */
    protected override onShow(): void {
        this.packageNameInput.value = '';
        this.nsURIInput.value = '';
        this.nsPrefixInput.value = '';
    }

    /**
     * Validate and confirm the dialog
     */
    protected override handleConfirm(): void {
        const packageName = this.packageNameInput.value.trim();
        const nsURI = this.nsURIInput.value.trim();
        const nsPrefix = this.nsPrefixInput.value.trim();

        // Validate package name
        if (!packageName) {
            alert('Package name is required.');
            this.packageNameInput.focus();
            return;
        }

        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(packageName)) {
            alert('Package name must start with a letter or underscore and contain only letters, numbers, and underscores.');
            this.packageNameInput.focus();
            return;
        }

        // Validate nsURI
        if (!nsURI) {
            alert('Namespace URI is required.');
            this.nsURIInput.focus();
            return;
        }

        if (!/^https?:\/\//i.test(nsURI)) {
            const proceed = confirm('Namespace URI does not start with http:// or https://. Continue anyway?');
            if (!proceed) {
                this.nsURIInput.focus();
                return;
            }
        }

        // Validate nsPrefix
        if (!nsPrefix) {
            alert('Namespace prefix is required.');
            this.nsPrefixInput.focus();
            return;
        }

        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(nsPrefix)) {
            alert('Namespace prefix must start with a letter or underscore and contain only letters, numbers, and underscores.');
            this.nsPrefixInput.focus();
            return;
        }

        // Confirm with result
        this.confirm({
            packageName,
            nsURI,
            nsPrefix
        });
    }
}

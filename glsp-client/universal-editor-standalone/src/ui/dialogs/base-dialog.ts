/**
 * @author Abigail Sotomayor <s205720@dtu.dk>
 */
/**
 * Base class for creating modal dialogs with a consistent look and feel.
 * Handles common dialog functionality like backdrop, positioning, and lifecycle.
 */
export abstract class BaseDialog<T> {
    protected backdrop: HTMLDivElement;
    protected container: HTMLDivElement;
    protected contentElement: HTMLDivElement;
    protected currentResolve?: (value: T) => void;
    protected currentReject?: (reason?: any) => void;

    constructor() {
        this.backdrop = this.createBackdrop();
        this.container = this.createContainer();
        this.contentElement = this.createContentElement();
        this.container.appendChild(this.contentElement);
        this.backdrop.appendChild(this.container);
        document.body.appendChild(this.backdrop);

        // Prevent clicks on the container from closing the dialog
        this.container.addEventListener('click', (e) => e.stopPropagation());
    }

    /**
     * Create the backdrop overlay
     */
    protected createBackdrop(): HTMLDivElement {
        const backdrop = document.createElement('div');
        backdrop.className = 'dialog-backdrop';
        backdrop.style.display = 'none';

        // Close dialog when clicking outside
        backdrop.addEventListener('click', () => this.cancel());

        return backdrop;
    }

    /**
     * Create the dialog container
     */
    protected createContainer(): HTMLDivElement {
        const container = document.createElement('div');
        container.className = 'dialog-container';
        return container;
    }

    /**
     * Create the content element that will hold dialog-specific content
     */
    protected createContentElement(): HTMLDivElement {
        const content = document.createElement('div');
        return content;
    }

    /**
     * Create a title element
     */
    protected createTitle(text: string): HTMLHeadingElement {
        const title = document.createElement('h3');
        title.className = 'dialog-title';
        title.textContent = text;
        return title;
    }

    /**
     * Create a labeled input field
     */
    protected createInputGroup(labelText: string, inputConfig: {
        id: string;
        type?: string;
        placeholder?: string;
        value?: string;
        min?: string;
        max?: string;
    }): HTMLDivElement {
        const group = document.createElement('div');
        group.className = 'dialog-input-group';

        const label = document.createElement('label');
        label.className = 'dialog-label';
        label.htmlFor = inputConfig.id;
        label.textContent = labelText;

        const input = document.createElement('input');
        input.className = 'dialog-input';
        input.id = inputConfig.id;
        input.type = inputConfig.type || 'text';
        if (inputConfig.placeholder) input.placeholder = inputConfig.placeholder;
        if (inputConfig.value !== undefined) input.value = inputConfig.value;
        if (inputConfig.min !== undefined) input.min = inputConfig.min;
        if (inputConfig.max !== undefined) input.max = inputConfig.max;

        group.appendChild(label);
        group.appendChild(input);

        return group;
    }

    /**
     * Create a button with appropriate styling
     */
    protected createButton(
        text: string,
        variant: 'primary' | 'secondary' | 'danger',
        onClick: () => void
    ): HTMLButtonElement {
        const button = document.createElement('button');
        button.className = `dialog-button dialog-button-${variant}`;
        button.textContent = text;
        button.addEventListener('click', onClick);
        return button;
    }

    /**
     * Create a button container
     */
    protected createButtonContainer(...buttons: HTMLButtonElement[]): HTMLDivElement {
        const container = document.createElement('div');
        container.className = 'dialog-buttons';
        buttons.forEach(button => container.appendChild(button));
        return container;
    }

    /**
     * Show the dialog and return a promise that resolves with the result
     * Protected so subclasses can override with their own show() signature
     */
    protected showDialog(): Promise<T> {
        return new Promise((resolve, reject) => {
            this.currentResolve = resolve;
            this.currentReject = reject;

            this.backdrop.style.display = 'flex';
            this.onShow();

            // Focus first input
            const firstInput = this.contentElement.querySelector('input') as HTMLInputElement;
            if (firstInput) {
                firstInput.focus();
                firstInput.select();
            }
        });
    }

    /**
     * Called when the dialog is shown. Override to perform initialization.
     */
    protected onShow(): void {
        // Override in subclass
    }

    /**
     * Hide the dialog
     */
    protected hide(): void {
        this.backdrop.style.display = 'none';
    }

    /**
     * Confirm and close the dialog with a result
     */
    protected confirm(result: T): void {
        this.hide();
        if (this.currentResolve) {
            this.currentResolve(result);
            this.currentResolve = undefined;
            this.currentReject = undefined;
        }
    }

    /**
     * Cancel and close the dialog
     */
    protected cancel(): void {
        this.hide();
        if (this.currentReject) {
            this.currentReject(new Error('User cancelled'));
            this.currentResolve = undefined;
            this.currentReject = undefined;
        }
    }

    /**
     * Destroy the dialog and remove it from the DOM
     */
    destroy(): void {
        if (this.backdrop.parentNode) {
            this.backdrop.parentNode.removeChild(this.backdrop);
        }
    }

    /**
     * Add keyboard event handler for Enter and Escape keys
     */
    protected addKeyboardHandlers(inputs: HTMLInputElement[]): void {
        inputs.forEach(input => {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    this.handleConfirm();
                } else if (e.key === 'Escape') {
                    this.cancel();
                }
            });
        });
    }

    /**
     * Handle confirmation - should be implemented by subclass
     */
    protected abstract handleConfirm(): void;
}

import { Compartment, EditorState } from '@codemirror/state';
import { xml } from '@codemirror/lang-xml';
import { basicSetup, EditorView } from 'codemirror';
import '../css/ecore-source-editor.css';

export interface EcoreSourceFile {
    filename: string;
    content: string;
}

export class EcoreSourceEditor {
    private readonly root = document.createElement('section');
    private readonly fileList = document.createElement('nav');
    private readonly filename = document.createElement('h2');
    private readonly editor: EditorView;
    private readonly editability = new Compartment();
    private readonly status = document.createElement('div');
    private readonly applyButton = document.createElement('button');
    private readonly downloadButton = document.createElement('button');
    private files: EcoreSourceFile[] = [];
    private selectedIndex = 0;
    private applying = false;

    constructor(onApply: () => void, private readonly onEdit: () => void) {
        this.root.className = 'ecore-source-editor';
        this.root.setAttribute('aria-label', 'Ecore source editor');
        this.root.hidden = true;
        this.root.innerHTML = '<header class="ecore-source-header"><h1>Ecore Source</h1></header>';

        const header = this.root.querySelector('header')!;
        this.downloadButton.type = 'button';
        this.downloadButton.textContent = 'Download file';
        this.downloadButton.addEventListener('click', () => this.downloadFile());
        this.applyButton.type = 'button';
        this.applyButton.textContent = 'Apply Ecore files';
        this.applyButton.className = 'ecore-source-apply';
        this.applyButton.addEventListener('click', onApply);
        header.append(this.downloadButton, this.applyButton);

        const content = document.createElement('div');
        content.className = 'ecore-source-content';
        const filesPane = document.createElement('div');
        filesPane.className = 'ecore-source-files';
        const filesHeading = document.createElement('h2');
        filesHeading.textContent = 'Files';
        this.fileList.setAttribute('aria-label', 'Ecore files');
        filesPane.append(filesHeading, this.fileList);

        const textPane = document.createElement('div');
        textPane.className = 'ecore-source-text';
        this.filename.id = 'ecore-source-filename';
        const editorHost = document.createElement('div');
        editorHost.className = 'ecore-source-code';
        this.editor = new EditorView({ state: this.createEditorState(''), parent: editorHost });
        // Keep source editing keys out of the diagram's global shortcuts.
        editorHost.addEventListener('keydown', event => event.stopPropagation());
        textPane.append(this.filename, editorHost);
        content.append(filesPane, textPane);

        this.status.className = 'ecore-source-status';
        this.status.setAttribute('role', 'status');
        this.root.append(content, this.status);
    }

    attach(): void {
        document.body.append(this.root);
    }

    loadFiles(files: EcoreSourceFile[]): void {
        this.files = files.map(file => ({ ...file })).sort((left, right) => left.filename.localeCompare(right.filename));
        this.fileList.replaceChildren();
        this.files.forEach((file, index) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = file.filename;
            button.title = file.filename;
            button.addEventListener('click', () => this.selectFile(index));
            this.fileList.append(button);
        });
        this.selectFile(0);
    }

    getFiles(): EcoreSourceFile[] {
        return this.files.map(file => ({ ...file }));
    }

    setVisible(visible: boolean): void {
        this.root.hidden = !visible;
        document.body.classList.toggle('ecore-source-mode', visible);
        if (visible) this.editor.requestMeasure();
    }

    setApplying(applying: boolean): void {
        this.applying = applying;
        this.applyButton.disabled = applying;
        this.editor.dispatch({ effects: this.editability.reconfigure(this.editabilityExtensions()) });
    }

    setStatus(message: string, error = false): void {
        this.status.textContent = message;
        this.status.classList.toggle('ecore-source-error', error);
    }

    private selectFile(index: number): void {
        const file = this.files[index];
        this.selectedIndex = index;
        this.filename.textContent = file?.filename ?? '';
        this.downloadButton.disabled = !file;
        this.editor.setState(this.createEditorState(file?.content ?? ''));
        this.editor.scrollDOM.scrollTo(0, 0);
        Array.from(this.fileList.children).forEach((button, buttonIndex) => {
            if (index === buttonIndex) {
                button.setAttribute('aria-current', 'true');
            } else {
                button.removeAttribute('aria-current');
            }
        });
    }

    private createEditorState(doc: string): EditorState {
        return EditorState.create({
            doc,
            extensions: [
                basicSetup,
                xml(),
                this.editability.of(this.editabilityExtensions()),
                EditorView.contentAttributes.of({ 'aria-labelledby': this.filename.id, spellcheck: 'false' }),
                EditorView.updateListener.of(update => {
                    const file = this.files[this.selectedIndex];
                    if (update.docChanged && file) {
                        file.content = update.state.doc.toString();
                        this.onEdit();
                    }
                })
            ]
        });
    }

    private editabilityExtensions() {
        return [EditorState.readOnly.of(this.applying), EditorView.editable.of(!this.applying)];
    }

    private downloadFile(): void {
        const file = this.files[this.selectedIndex];
        if (!file) return;
        const url = URL.createObjectURL(new Blob([file.content], { type: 'application/xml' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = file.filename;
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
}

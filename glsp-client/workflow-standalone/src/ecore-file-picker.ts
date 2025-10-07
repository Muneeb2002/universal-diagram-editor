/********************************************************************************
 * Copyright (c) 2024 Eclipse GLSP and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * SPDX-License-Identifier: EPL-2.0
 ********************************************************************************/

export class EcoreFilePicker {
    private fileInput: HTMLInputElement;

    constructor() {
        this.fileInput = document.createElement('input');
        this.fileInput.type = 'file';
        this.fileInput.accept = '.json';
        this.fileInput.style.display = 'none';
        document.body.appendChild(this.fileInput);
    }

    async pickFile(): Promise<File | null> {
        return new Promise((resolve) => {
            this.fileInput.onchange = (event) => {
                const target = event.target as HTMLInputElement;
                const file = target.files?.[0] || null;
                resolve(file);
            };
            this.fileInput.click();
        });
    }

    async readFileAsText(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const result = event.target?.result as string;
                resolve(result);
            };
            reader.onerror = () => reject(reader.error);
            reader.readAsText(file);
        });
    }

    createFilePickerButton(): HTMLButtonElement {
        const button = document.createElement('button');
        button.textContent = 'Load JSON Metamodel';
        button.style.cssText = `
            position: fixed;
            bottom: 250px;
            right: 10px;
            z-index: 1000;
            padding: 10px 15px;
            background-color: #007acc;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
        `;

        button.addEventListener('click', async () => {
            try {
                const file = await this.pickFile();
                if (file) {
                    const content = await this.readFileAsText(file);
                    this.onFileSelected(file.name, content);
                }
            } catch (error) {
                console.error('Error reading file:', error);
                alert('Error reading file: ' + error);
            }
        });

        return button;
    }

    onFileSelected(filename: string, content: string): void {
        // This will be overridden by the app
        console.log('File selected:', filename, 'Content length:', content.length);
    }
}


import { GLSPActionDispatcher } from '@eclipse-glsp/client';

export class LeftSidebar {
    private sidebar: HTMLDivElement;
    private actionDispatcher: GLSPActionDispatcher | null = null;
    private loadedContainer: HTMLDivElement;
    private loadedList: HTMLDivElement;
    private static readonly STORAGE_KEY = 'wf_loaded_metamodels';
    // Keep at most N recent entries to avoid exceeding localStorage limits
    private static readonly MAX_STORED = 10;

    constructor() {
        this.sidebar = document.createElement('div');
        this.sidebar.style.cssText = `
            position: fixed;
            top: 0;
            bottom: 0;
            left: 0;
            width: 220px;
            background: #ffffff;
            border-right: 1px solid #dcdfe4;
            box-shadow: 2px 0 12px rgba(0,0,0,0.05);
            z-index: 1000;
            padding: 14px 12px;
            display: flex;
            flex-direction: column;
            gap: 10px;
            font-family: Arial, sans-serif;
        `;

        const title = document.createElement('div');
        title.style.cssText = 'font-weight: bold; font-size: 12px; color: #333; letter-spacing: .2px;';
        this.sidebar.appendChild(title);

        const loadLabel = document.createElement('div');
        loadLabel.textContent = 'Load Metamodel:';
        loadLabel.style.cssText = 'font-weight: 600; font-size: 12px; margin-top: 4px; margin-bottom: 6px; color:#444;';
        this.sidebar.appendChild(loadLabel);

        const loadBtn = document.createElement('button');
        loadBtn.textContent = 'Load Metamodel';
        loadBtn.style.cssText = `
            width: 100%;
            padding: 8px 12px;
            background: #007acc;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
        `;
        loadBtn.addEventListener('click', () => this.loadJSON());
        this.sidebar.appendChild(loadBtn);

        const createBtn = document.createElement('button');
        createBtn.textContent = 'Create Metamodel';
        createBtn.style.cssText = `
            width: 100%;
            padding: 8px 12px;
            background: #28a745;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            margin-top: 8px;
        `;
        createBtn.addEventListener('click', () => this.createCustomMetamodel());
        this.sidebar.appendChild(createBtn);

        const loadedLabel = document.createElement('div');
        loadedLabel.textContent = 'Loaded metamodels:';
        loadedLabel.style.cssText = 'font-weight: 600; font-size: 12px; margin-top: 16px; margin-bottom: 6px; color:#444;';
        this.sidebar.appendChild(loadedLabel);

        this.loadedContainer = document.createElement('div');
        this.loadedContainer.style.cssText = 'display:flex; flex-direction:column; gap:6px;';
        this.loadedList = document.createElement('div');
        this.loadedList.style.cssText = 'display:flex; flex-direction:column; gap:4px;';
        this.loadedContainer.appendChild(this.loadedList);
        this.sidebar.appendChild(this.loadedContainer);

        this.renderLoadedMetamodels();
    }

    public attach(): void {
        document.body.appendChild(this.sidebar);
        // Provide left margin for main toolbar if needed
        document.body.style.setProperty('--left-sidebar-width', '220px');
        // Shift main content to the right so nothing sits under the sidebar
        document.body.style.paddingLeft = '220px';
    }

    public dockToolbar(toolbarElement: HTMLDivElement): void {
        // Make the toolbar a child of the sidebar and pin it to the bottom
        toolbarElement.style.position = 'static';
        toolbarElement.style.bottom = '';
        toolbarElement.style.right = '';
        toolbarElement.style.marginTop = 'auto'; // push to bottom in flex column
        toolbarElement.style.width = '100%';
        toolbarElement.style.boxSizing = 'border-box';
        toolbarElement.style.borderTop = '1px solid #e6e6e6';
        toolbarElement.style.boxShadow = 'none';
        this.sidebar.appendChild(toolbarElement);
    }

    public setActionDispatcher(dispatcher: GLSPActionDispatcher): void {
        this.actionDispatcher = dispatcher;
    }

    private createCustomMetamodel(): void {
        if (!this.actionDispatcher) {
            console.error('Action dispatcher not available');
            return;
        }

        const packageName = prompt('Enter package name for your custom metamodel:');
        if (!packageName || !packageName.trim()) {
            return;
        }

        const trimmedName = packageName.trim();
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmedName)) {
            alert('Package name must start with a letter or underscore and contain only letters, numbers, and underscores.');
            return;
        }

        const defaultNsURI = `https://www.example.org/${trimmedName}`;
        const nsURIInput = prompt('Enter Namespace URI for the metamodel:', defaultNsURI);
        if (!nsURIInput || !nsURIInput.trim()) {
            alert('Namespace URI is required.');
            return;
        }

        const trimmedNsURI = nsURIInput.trim();
        if (!/^https?:\/\//i.test(trimmedNsURI)) {
            const proceed = confirm('Namespace URI does not start with http:// or https://. Continue anyway?');
            if (!proceed) {
                return;
            }
        }

        const defaultPrefix = trimmedName.slice(0, 3).toLowerCase() || 'pkg';
        const nsPrefixInput = prompt('Enter Namespace Prefix for the metamodel:', defaultPrefix);
        if (!nsPrefixInput || !nsPrefixInput.trim()) {
            alert('Namespace prefix is required.');
            return;
        }

        const trimmedPrefix = nsPrefixInput.trim();
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmedPrefix)) {
            alert('Namespace prefix must start with a letter or underscore and contain only letters, numbers, and underscores.');
            return;
        }

        try {
            const action = {
                kind: 'createCustomMetamodel',
                packageName: trimmedName,
                nsURI: trimmedNsURI,
                nsPrefix: trimmedPrefix
            };
            this.actionDispatcher.dispatch(action);
        } catch (error) {
            console.error('Error creating custom metamodel:', error);
            alert(`Error creating custom metamodel: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private loadJSON(): void {
        if (!this.actionDispatcher) {
            console.warn('Action dispatcher not available');
            return;
        }
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json';
        fileInput.style.display = 'none';

        fileInput.addEventListener('change', async (event) => {
            const target = event.target as HTMLInputElement;
            const file = target.files?.[0];
            if (!file) return;
            try {
                const content = await file.text();
                const action = {
                    kind: 'loadMetamodel',
                    content,
                    filename: file.name,
                    isJSON: true
                } as any;
                await this.actionDispatcher!.dispatch(action);
                this.addLoadedMetamodel({ name: file.name, content });
            } catch (e) {
                console.error('Error loading metamodel:', e);
                alert('Error loading metamodel: ' + e);
            }
        });

        document.body.appendChild(fileInput);
        fileInput.click();
        document.body.removeChild(fileInput);
    }

    private addLoadedMetamodel(entry: { name: string; content: string }): void {
        const current = this.getStoredMetamodels();
        // de-duplicate by name; keep most recent content
        const without = current.filter(e => e.name !== entry.name);
        const next = [entry, ...without].slice(0, LeftSidebar.MAX_STORED);
        try {
            localStorage.setItem(LeftSidebar.STORAGE_KEY, JSON.stringify(next));
        } catch (e) {
            // ignore storage failures
        }
        this.renderLoadedMetamodels();
    }

    private getStoredMetamodels(): Array<{ name: string; content: string }> {
        try {
            const raw = localStorage.getItem(LeftSidebar.STORAGE_KEY);
            if (!raw) return [];
            const arr = JSON.parse(raw);
            if (!Array.isArray(arr)) return [];
            return arr
                .filter(x => x && typeof x.name === 'string' && typeof x.content === 'string')
                .map(x => ({ name: x.name as string, content: x.content as string }));
        } catch {
            return [];
        }
    }

    private renderLoadedMetamodels(): void {
        if (!this.loadedList) return;
        this.loadedList.innerHTML = '';
        const items = this.getStoredMetamodels();
        if (items.length === 0) {
            const empty = document.createElement('div');
            empty.textContent = 'None';
            empty.style.cssText = 'font-size: 12px; color:#777;';
            this.loadedList.appendChild(empty);
            return;
        }
        for (const { name } of items) {
            const row = document.createElement('div');
            row.style.cssText = 'display:flex; align-items:center; justify-content:space-between; gap:8px;';
            const text = document.createElement('span');
            text.textContent = name;
            text.style.cssText = 'font-size: 12px; color:#333; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;';
            row.appendChild(text);

            const relBtn = document.createElement('button');
            relBtn.textContent = 'Reload';
            relBtn.style.cssText = 'font-size: 11px; padding:4px 6px; border:1px solid #dcdfe4; background:#f8f9fb; color:#333; border-radius:3px; cursor:pointer;';
            relBtn.addEventListener('click', () => this.reloadFromStorageName(name));
            row.appendChild(relBtn);

            this.loadedList.appendChild(row);
        }
    }

    private async reloadFromStorageName(name: string): Promise<void> {
        if (!this.actionDispatcher) return;
        const items = this.getStoredMetamodels();
        const match = items.find(e => e.name === name);
        if (!match) return;
        const action = {
            kind: 'loadMetamodel',
            content: match.content,
            filename: match.name,
            isJSON: true
        } as any;
        try {
            await this.actionDispatcher.dispatch(action);
            // bump to most recent
            this.addLoadedMetamodel({ name: match.name, content: match.content });
        } catch (e) {
            console.error('Error reloading metamodel:', e);
            alert('Error reloading metamodel: ' + e);
        }
    }
}



import { GLSPActionDispatcher } from '@eclipse-glsp/client';

export class LeftSidebar {
    private sidebar: HTMLDivElement;
    private actionDispatcher: GLSPActionDispatcher | null = null;

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
        loadBtn.textContent = 'Load JSON';
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
    }

    public attach(): void {
        document.body.appendChild(this.sidebar);
        // Provide left margin for main toolbar if needed
        document.body.style.setProperty('--left-sidebar-width', '220px');
        // Shift main content to the right so nothing sits under the sidebar
        document.body.style.paddingLeft = '220px';
    }

    public setActionDispatcher(dispatcher: GLSPActionDispatcher): void {
        this.actionDispatcher = dispatcher;
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
            } catch (e) {
                console.error('Error loading metamodel:', e);
                alert('Error loading metamodel: ' + e);
            }
        });

        document.body.appendChild(fileInput);
        fileInput.click();
        document.body.removeChild(fileInput);
    }
}



/**
 * @author Abigail Sotomayor <s205720@dtu.dk>
 */
import { GLSPActionDispatcher } from '@eclipse-glsp/client';

export class EcoreEdgeContextMenu {
    private menu: HTMLDivElement;
    private actionDispatcher: GLSPActionDispatcher | null = null;
    private currentEdgeId: string | null = null;

    constructor() {
        this.menu = this.createMenuElement();
        document.body.appendChild(this.menu);
        this.attachEventListeners();
    }

    private createMenuElement(): HTMLDivElement {
        const menu = document.createElement('div');
        menu.style.cssText = `
            position: fixed;
            background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
            border: 1px solid #dee2e6;
            border-radius: 8px;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12), 0 2px 4px rgba(0, 0, 0, 0.08);
            z-index: 1000;
            min-width: 180px;
            display: none;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            padding: 4px;
            overflow: hidden;
        `;
        return menu;
    }

    private attachEventListeners(): void {
        document.addEventListener('click', (event) => {
            if (!this.menu.contains(event.target as Node)) {
                this.hide();
            }
        });
    }

    public setActionDispatcher(dispatcher: GLSPActionDispatcher): void {
        this.actionDispatcher = dispatcher;
    }

    public show(event: MouseEvent, edgeId: string): void {
        this.currentEdgeId = edgeId;
        this.renderMenu();
        this.positionMenu(event);

        event.preventDefault();
        event.stopPropagation();
    }

    private positionMenu(event: MouseEvent): void {
        this.menu.style.display = 'block';
        this.menu.style.left = `${event.clientX}px`;
        this.menu.style.top = `${event.clientY}px`;
    }

    public hide(): void {
        this.menu.style.display = 'none';
        this.currentEdgeId = null;
    }

    private renderMenu(): void {
        if (this.currentEdgeId === null) return;

        this.menu.innerHTML = '';
        this.menu.appendChild(
            this.createMenuItem('Delete Edge', () => this.deleteEdge(), '#dc3545')
        );
    }

    private createMenuItem(text: string, onClick: () => void, accentColor?: string): HTMLDivElement {
        const item = document.createElement('div');
        item.textContent = text;
        item.style.cssText = `
            padding: 10px 14px;
            cursor: pointer;
            border-radius: 6px;
            font-size: 13px;
            font-weight: 500;
            color: ${accentColor || '#212529'};
            background-color: ${accentColor ? `${accentColor}10` : 'transparent'};
            transition: all 0.15s ease-in-out;
            user-select: none;
        `;

        item.addEventListener('mouseenter', () => {
            item.style.backgroundColor = accentColor ? `${accentColor}20` : '#e9ecef';
            item.style.transform = 'translateX(2px)';
        });

        item.addEventListener('mouseleave', () => {
            item.style.backgroundColor = accentColor ? `${accentColor}10` : 'transparent';
            item.style.transform = 'translateX(0)';
        });

        item.addEventListener('click', () => {
            onClick();
            this.hide();
        });

        return item;
    }

    private deleteEdge(): void {
        if (this.currentEdgeId === null || !this.actionDispatcher) return;

        this.actionDispatcher.dispatch({ kind: 'deleteEdge', edgeId: this.currentEdgeId } as any);
    }

    public destroy(): void {
        this.menu.remove();
    }
}

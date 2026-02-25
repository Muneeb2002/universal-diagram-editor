/**
 * @author Abigail Sotomayor <s205720@dtu.dk>
 */
import { GLSPActionDispatcher } from '@eclipse-glsp/client';
import { createSwitchModeAction, createCreateInstanceAction, createCreateInstanceReferenceAction, createRequestInstancesOverviewAction } from './ecore-client-actions';
import { getContainmentRequirements, getCreatableChildren, getContainmentReferenceName, isSubtypeOf } from './containment-utils';
import { ClassInfo, InstancesOverviewResponse } from './ecore-client-actions';
import type { ShapeMapping } from './ui/dialogs/shape-mapping-dialog';

export class EcoreToolbar {
    private toolbar: HTMLDivElement;
    private containerInfo: HTMLDivElement | null = null;
    private clearContainerButton: HTMLButtonElement | null = null;
    private currentMode: 'metamodel' | 'instance' = 'metamodel';
    private actionDispatcher: GLSPActionDispatcher | null = null;
    private allClasses: ClassInfo[] = [];
    private allEnumNames: string[] = [];
    private allEnums: Array<{ enumName: string; literals: Array<{ name: string; value?: number }> }> = [];
    private selectedContainerInstanceId: string | null = null;
    private selectedContainerClassName: string | null = null;
    private createdInstances: Set<string> = new Set(); // Track created instances
    private instanceOverviewRequestCounter = 0;
    private instanceOverviewRequests: Map<string, {
        resolve: (instances: Array<{ id: string; className: string }>) => void;
        reject: (error: any) => void;
        timeoutHandle: number;
    }> = new Map();
    private paletteOriginalContent: string | null = null;
    private instancePaletteContainer: HTMLDivElement | null = null;
    private modeListeners: Array<(mode: 'metamodel' | 'instance') => void> = [];

    constructor() {
        this.toolbar = document.createElement('div');
        this.toolbar.style.cssText = `
            position: fixed;
            bottom: calc(var(--bottom-panel-height, 0px) + 10px);
            right: 10px;
            z-index: 1000;
            background-color: #f0f0f0;
            border: 1px solid #ccc;
            border-radius: 4px;
            padding: 10px;
            display: flex;
            flex-direction: column;
            gap: 10px;
            font-family: Arial, sans-serif;
            font-size: 14px;
        `;

    }

    public setActionDispatcher(dispatcher: GLSPActionDispatcher): void {
        this.actionDispatcher = dispatcher;
    }

    public updateAvailableClasses(classes: string[]): void {
        this.renderInstancePalette(
            this.currentMode === 'instance' ? classes.slice().sort((a, b) => a.localeCompare(b)) : [],
            this.currentMode === 'instance'
        );

        if (!classes || classes.length === 0) {
            return;
        }

        const existingNames = new Set(this.allClasses.map(cls => cls.className));
        let updated = false;

        for (const className of classes) {
            if (!existingNames.has(className)) {
                this.allClasses.push({
                    className,
                    isAbstract: false,
                    isInterface: false,
                    attributes: [],
                    references: []
                });
                updated = true;
            }
        }

        if (updated) {
            this.updateAvailableClassesForMode();
        }
    }

    public updateClassInfo(allClasses: ClassInfo[]): void {
        this.allClasses = allClasses;
        this.updateAvailableClassesForMode();
    }

    public updateEnumNames(enumNames: string[]): void {
        this.allEnumNames = enumNames || [];
    }

    public getEnumNames(): string[] {
        return this.allEnumNames || [];
    }

    public updateEnums(enums: Array<{ enumName: string; literals: Array<{ name: string; value?: number }> }>): void {
        this.allEnums = enums || [];
    }

    public getEnums(): Array<{ enumName: string; literals: Array<{ name: string; value?: number }> }> {
        return this.allEnums || [];
    }

    public getEnumLiterals(enumName: string): string[] {
        const enumData = this.allEnums.find(e => e.enumName === enumName);
        if (enumData && enumData.literals) {
            return enumData.literals.map(lit => lit.name).filter(Boolean);
        }
        return [];
    }

    public getConcreteClasses(): string[] {
        return this.allClasses
            .filter(cls => !cls.isAbstract && !cls.isInterface)
            .map(cls => cls.className);
    }

    public getAllClassNames(): string[] {
        return this.allClasses.map(cls => cls.className);
    }

    private updateAvailableClassesForMode(): void {
        if (this.currentMode === 'instance') {
            const paletteClasses: string[] = [];

            if (this.selectedContainerInstanceId && this.selectedContainerClassName) {
                const children = getCreatableChildren(this.selectedContainerClassName, this.allClasses);

                const creatableChildren = children
                    .filter(c => !c.isAbstract && !c.isInterface)
                    .map(c => c.className);

                paletteClasses.push(...creatableChildren);
            } else {
                const rootContainers = this.allClasses.filter(cls =>
                    getContainmentRequirements(cls.className, this.allClasses).length === 0
                );

                const creatableFromRoot = new Map<string, ClassInfo>();

                for (const rootClass of rootContainers) {
                    const children = getCreatableChildren(rootClass.className, this.allClasses);
                    children
                        .filter(child => !child.isAbstract && !child.isInterface)
                        .forEach(child => creatableFromRoot.set(child.className, child));
                }

                rootContainers
                    .filter(cls => !cls.isAbstract && !cls.isInterface && !this.isContainerClass(cls))
                    .forEach(cls => creatableFromRoot.set(cls.className, cls));

                creatableFromRoot.forEach((cls) => {
                    paletteClasses.push(cls.className);
                });
            }

            this.renderInstancePalette(paletteClasses.sort((a, b) => a.localeCompare(b)), true);
        } else {
            this.renderInstancePalette([], false);
        }
    }

    private async switchMode(mode: 'metamodel' | 'instance'): Promise<void> {
        if (!this.actionDispatcher) {
            return;
        }

        if (this.currentMode === mode) {
            return;
        }

        this.currentMode = mode;
        this.notifyModeChange();
        this.updateAvailableClassesForMode();

        try {
            const action = createSwitchModeAction(mode);
            await this.actionDispatcher.dispatch(action);

        } catch (error) {
            alert('Error switching mode: ' + error);
        }
    }

    private async createInstance(selectedClass: string): Promise<void> {
        if (!this.actionDispatcher) {
            return;
        }

        let containerInstanceId: string | undefined;
        let containmentReferenceName: string | undefined;

        if (this.selectedContainerInstanceId && this.selectedContainerClassName) {
            const containmentRefName = getContainmentReferenceName(this.selectedContainerClassName, selectedClass, this.allClasses);
            if (!containmentRefName) {
                alert(`Cannot create '${selectedClass}' as a child of '${this.selectedContainerClassName}'. No containment reference found.`);
                return;
            }
            containerInstanceId = this.selectedContainerInstanceId;
            containmentReferenceName = containmentRefName;
        } else {
            const requirements = getContainmentRequirements(selectedClass, this.allClasses);
            const isRootClass = requirements.length === 0;

            if (isRootClass) {
            }
        }

        try {
            let x: number;
            let y: number;

            if (this.selectedContainerInstanceId && this.selectedContainerClassName) {
                const baseX = 200;
                const baseY = 150;

                const childOffsetX = 250;
                const childOffsetY = 50;

                x = baseX + childOffsetX;
                y = baseY + childOffsetY;
            } else {
                const gridSpacing = 250;
                const instancesPerRow = 3;

                const instanceCount = this.countRootInstances();
                const row = Math.floor(instanceCount / instancesPerRow);
                const col = instanceCount % instancesPerRow;

                x = 50 + (col * gridSpacing);
                y = 50 + (row * gridSpacing);
            }

            const action = createCreateInstanceAction(
                selectedClass,
                { x, y },
                containerInstanceId,
                containmentReferenceName
            );
            await this.actionDispatcher.dispatch(action);
            this.createdInstances.add(selectedClass);
            this.refreshAvailableClasses();

            setTimeout(() => {
                this.refreshAvailableClasses();
            }, 1000);

            setTimeout(() => {
                this.refreshAvailableClasses();
            }, 2000);
        } catch (error) {
            alert('Error creating instance: ' + error);
        }
    }

    public setContainer(instanceId: string, className: string): void {
        this.selectedContainerInstanceId = instanceId;
        this.selectedContainerClassName = className;
        this.updateAvailableClassesForMode();
    }

    private isContainerClass(cls: ClassInfo): boolean {
        if (!cls.references || cls.references.length === 0) {
            return false;
        }

        return cls.references.some(ref => ref.containment === true);
    }

  
    public clearContainer(): void {
        this.selectedContainerInstanceId = null;
        this.selectedContainerClassName = null;
        if (this.containerInfo) {
            this.containerInfo.style.display = 'none';
        }
        if (this.clearContainerButton) {
            this.clearContainerButton.style.display = 'none';
        }
        this.updateAvailableClassesForMode();
    }

    public hasClassInfo(): boolean {
        return this.allClasses.length > 0;
    }

    public refreshAvailableClasses(): void {

        if (this.currentMode === 'instance') {

            this.updateAvailableClassesForMode();
        }
    }


    public getElement(): HTMLDivElement {
        return this.toolbar;
    }

    public switchToMode(mode: 'metamodel' | 'instance'): Promise<void> {
        return this.switchMode(mode);
    }

    public onModeChange(listener: (mode: 'metamodel' | 'instance') => void): void {
        this.modeListeners.push(listener);
        listener(this.currentMode);
    }

    private notifyModeChange(): void {
        for (const listener of this.modeListeners) {
            try {
                listener(this.currentMode);
            } catch (error) {
                console.error('Error in mode change listener:', error);
            }
        }
    }

    private renderInstancePalette(classNames: string[], isInstanceMode: boolean): void {
        const paletteBody = document.querySelector('.tool-palette .palette-body') as HTMLElement | null;

        if (!paletteBody) {
            if (isInstanceMode) {
                setTimeout(() => this.renderInstancePalette(classNames, isInstanceMode), 100);
            }
            return;
        }

        if (!isInstanceMode) {
            if (this.paletteOriginalContent !== null) {
                paletteBody.innerHTML = this.paletteOriginalContent;
                this.paletteOriginalContent = null;
            }
            this.instancePaletteContainer = null;
            return;
        }

        if (this.paletteOriginalContent === null) {
            this.paletteOriginalContent = paletteBody.innerHTML;
        }

        paletteBody.innerHTML = '';

        if (!this.instancePaletteContainer) {
            this.instancePaletteContainer = document.createElement('div');
            this.instancePaletteContainer.classList.add('instance-palette-container');
        }

        const container = this.instancePaletteContainer;
        container.innerHTML = '';

        const header = document.createElement('div');
        header.textContent = 'Create Instance';
        header.style.cssText = 'font-weight: bold; padding: 6px 8px;';
        container.appendChild(header);

        if (this.selectedContainerInstanceId && this.selectedContainerClassName) {
            if (!this.containerInfo) {
                this.containerInfo = document.createElement('div');
                this.containerInfo.style.cssText = `
                    padding: 8px;
                    margin: 8px 0;
                    background-color: #e3f2fd;
                    border: 1px solid #90caf9;
                    border-radius: 4px;
                    font-size: 12px;
                    color: #1976d2;
                `;
            }
            this.containerInfo.style.display = '';
            this.containerInfo.textContent = `Container: ${this.selectedContainerClassName}`;
            container.appendChild(this.containerInfo);

            if (!this.clearContainerButton) {
                this.clearContainerButton = document.createElement('button');
                this.clearContainerButton.textContent = 'Clear Container';
                this.clearContainerButton.style.cssText = `
                    padding: 6px 12px;
                    margin: 4px 0;
                    background-color: #007acc;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                    width: 100%;
                `;
                this.clearContainerButton.addEventListener('click', () => {
                    this.clearContainer();
                });
            }
            this.clearContainerButton.style.display = '';
            container.appendChild(this.clearContainerButton);
        } else {
            if (this.containerInfo && this.containerInfo.parentNode) {
                this.containerInfo.parentNode.removeChild(this.containerInfo);
            }
            if (this.clearContainerButton && this.clearContainerButton.parentNode) {
                this.clearContainerButton.parentNode.removeChild(this.clearContainerButton);
            }
        }

        if (classNames.length === 0) {
            const empty = document.createElement('div');
            empty.classList.add('tool-button');
            empty.style.opacity = '0.6';
            empty.textContent = 'No creatable classes available';
            container.appendChild(empty);
        } else {
            const list = document.createElement('div');
            list.style.display = 'flex';
            list.style.flexDirection = 'column';
            list.style.gap = '4px';

            classNames.forEach(className => {
                const item = document.createElement('div');
                item.classList.add('tool-button', 'instance-palette-item');
                item.textContent = className;
                item.addEventListener('click', () => this.handleInstancePaletteClick(className));
                list.appendChild(item);
            });

            container.appendChild(list);
        }

        paletteBody.appendChild(container);
    }

    private async handleInstancePaletteClick(className: string): Promise<void> {
        const mapping = this.getSourceTargetMapping(className);
        if (mapping?.sourceReferenceName && mapping?.targetReferenceName) {
            await this.handleSourceTargetClassClick(className, mapping);
            return;
        }
        await this.createInstance(className);
    }

    private requestInstancesOverview(): Promise<Array<{ id: string; className: string }>> {
        if (!this.actionDispatcher) {
            return Promise.reject(new Error('No action dispatcher'));
        }
        const requestId = `toolbar-instances-${++this.instanceOverviewRequestCounter}`;
        return new Promise((resolve, reject) => {
            const timeoutHandle = window.setTimeout(() => {
                this.instanceOverviewRequests.delete(requestId);
                reject(new Error('Timed out waiting for instances overview'));
            }, 5000);
            this.instanceOverviewRequests.set(requestId, { resolve, reject, timeoutHandle });
            this.actionDispatcher!.dispatch(createRequestInstancesOverviewAction(requestId));
        });
    }

    private getSourceTargetMapping(className: string): ShapeMapping | undefined {
        const dialog = (window as any).globalShapeMappingDialog;
        if (!dialog?.getMappings) {
            return undefined;
        }
        const mappings = dialog.getMappings();
        return mappings.get(className);
    }

    private getValidSourceAndTargetInstances(
        instances: Array<{ id: string; className: string }>,
        mapping: ShapeMapping
    ): { sources: Array<{ id: string; className: string }>; targets: Array<{ id: string; className: string }> } {
        const pairs = mapping.sourceTargetPairs ?? [];
        const hasPairs = pairs.length > 0;

        const sources = hasPairs
            ? instances.filter(inst => pairs.some(p => p.sourceClass === inst.className))
            : mapping.sourceClass
                ? instances.filter(inst => isSubtypeOf(inst.className, mapping.sourceClass!, this.allClasses))
                : instances;
        const targets = hasPairs
            ? instances.filter(inst => pairs.some(p => p.targetClass === inst.className))
            : mapping.targetClass
                ? instances.filter(inst => isSubtypeOf(inst.className, mapping.targetClass!, this.allClasses))
                : instances;

        if (!mapping.sourceClass && !mapping.targetClass && !hasPairs) {
            return { sources: instances, targets: instances };
        }
        return { sources, targets };
    }

    private async handleSourceTargetClassClick(className: string, mapping: ShapeMapping): Promise<void> {
        if (!this.actionDispatcher) {
            return;
        }
        try {
            const instances = await this.requestInstancesOverview();
            const { sources, targets } = this.getValidSourceAndTargetInstances(instances, mapping);

            const refFrom = mapping.sourceReferenceName ?? 'source';
            const refTo = mapping.targetReferenceName ?? 'target';

            if (sources.length === 0 || targets.length === 0) {
                const needSource = sources.length === 0;
                const needTarget = targets.length === 0;
                const msg = needSource && needTarget
                    ? `Create at least one ${refFrom} and one ${refTo} node (e.g. ${mapping.sourceClass ?? refFrom}, ${mapping.targetClass ?? refTo}) first, then create ${className}.`
                    : needSource
                        ? `Create at least one ${refFrom} node (e.g. ${mapping.sourceClass ?? refFrom}) first, then create ${className}.`
                        : `Create at least one ${refTo} node (e.g. ${mapping.targetClass ?? refTo}) first, then create ${className}.`;
                alert(msg);
                return;
            }

            const selected = await this.showSourceTargetPicker(className, mapping, instances, sources, targets);
            if (!selected) {
                return;
            }

            const instancesBefore = await this.requestInstancesOverview();
            await this.createInstance(className);
            await new Promise(r => setTimeout(r, 300));
            const instancesAfter = await this.requestInstancesOverview();
            const newInstance = instancesAfter.find(
                i => i.className === className && !instancesBefore.some(b => b.id === i.id)
            );

            if (!newInstance) {
                alert(`Created ${className} but could not set ${refFrom}/${refTo}. You may set them manually.`);
                return;
            }

            await this.actionDispatcher.dispatch(
                createCreateInstanceReferenceAction(newInstance.id, selected.sourceId, mapping.sourceReferenceName!)
            );
            await this.actionDispatcher.dispatch(
                createCreateInstanceReferenceAction(newInstance.id, selected.targetId, mapping.targetReferenceName!)
            );

            this.refreshAvailableClasses();
        } catch (error) {
            alert(`Error creating ${className}: ` + (error instanceof Error ? error.message : String(error)));
        }
    }

    private isPairAllowed(sourceClassName: string, targetClassName: string, mapping: ShapeMapping): boolean {
        const pairs = mapping.sourceTargetPairs ?? [];
        if (pairs.length === 0) {
            return true;
        }
        return pairs.some(p => p.sourceClass === sourceClassName && p.targetClass === targetClassName);
    }

    private showSourceTargetPicker(
        className: string,
        mapping: ShapeMapping,
        allInstances: Array<{ id: string; className: string }>,
        sources: Array<{ id: string; className: string }>,
        targets: Array<{ id: string; className: string }>
    ): Promise<{ sourceId: string; targetId: string } | null> {
        const pairs = mapping.sourceTargetPairs ?? [];
        const restrictByPairs = pairs.length > 0;
        const idToInstance = new Map(allInstances.map(i => [i.id, i]));
        const refFrom = mapping.sourceReferenceName ?? 'source';
        const refTo = mapping.targetReferenceName ?? 'target';

        return new Promise(resolve => {
            const backdrop = document.createElement('div');
            backdrop.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:2000;display:flex;align-items:center;justify-content:center;';
            const box = document.createElement('div');
            box.style.cssText = 'background:white;padding:20px;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,0.2);min-width:320px;';
            const label = (text: string) => {
                const el = document.createElement('div');
                el.style.marginBottom = '4px';
                el.style.fontSize = '12px';
                el.style.color = '#555';
                el.textContent = text;
                return el;
            };
            box.appendChild(label(`Select ${refFrom} and ${refTo} for ${className}`));

            box.appendChild(document.createElement('br'));

            box.appendChild(label(refFrom));
            const sourceSelect = document.createElement('select');
            sourceSelect.style.cssText = 'width:100%;padding:8px;margin-bottom:12px;border:1px solid #ddd;border-radius:4px;';
            sources.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s.id;
                opt.textContent = `${s.className} (${s.id})`;
                sourceSelect.appendChild(opt);
            });
            box.appendChild(sourceSelect);

            box.appendChild(label(refTo));
            const targetSelect = document.createElement('select');
            targetSelect.style.cssText = 'width:100%;padding:8px;margin-bottom:16px;border:1px solid #ddd;border-radius:4px;';

            function updateTargetOptions(): void {
                targetSelect.innerHTML = '';
                const sourceId = sourceSelect.value;
                const sourceInst = idToInstance.get(sourceId);
                let allowedTargets = targets;
                if (restrictByPairs && sourceInst) {
                    const allowedClasses = new Set(
                        pairs.filter(p => p.sourceClass === sourceInst.className).map(p => p.targetClass)
                    );
                    allowedTargets = targets.filter(t => allowedClasses.has(t.className));
                }
                allowedTargets.forEach(t => {
                    const opt = document.createElement('option');
                    opt.value = t.id;
                    opt.textContent = `${t.className} (${t.id})`;
                    targetSelect.appendChild(opt);
                });
            }

            sourceSelect.addEventListener('change', updateTargetOptions);
            updateTargetOptions();

            box.appendChild(targetSelect);

            const buttons = document.createElement('div');
            buttons.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;';
            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = 'Cancel';
            cancelBtn.style.cssText = 'padding:8px 16px;border:1px solid #ccc;border-radius:4px;cursor:pointer;background:#f5f5f5;';
            cancelBtn.addEventListener('click', () => {
                document.body.removeChild(backdrop);
                resolve(null);
            });
            const createBtn = document.createElement('button');
            createBtn.textContent = 'Create';
            createBtn.style.cssText = 'padding:8px 16px;border:none;border-radius:4px;cursor:pointer;background:#007acc;color:white;';
            createBtn.addEventListener('click', () => {
                const sourceInst = idToInstance.get(sourceSelect.value);
                const targetInst = idToInstance.get(targetSelect.value);
                if (restrictByPairs && sourceInst && targetInst && !this.isPairAllowed(sourceInst.className, targetInst.className, mapping)) {
                    alert(`The pair ${sourceInst.className} → ${targetInst.className} is not allowed. Choose a ${refFrom} and ${refTo} from the allowed pairs in your shape mapping.`);
                    return;
                }
                document.body.removeChild(backdrop);
                resolve({
                    sourceId: sourceSelect.value,
                    targetId: targetSelect.value
                });
            });
            buttons.appendChild(cancelBtn);
            buttons.appendChild(createBtn);
            box.appendChild(buttons);

            backdrop.appendChild(box);
            backdrop.addEventListener('click', (e) => { if (e.target === backdrop) { document.body.removeChild(backdrop); resolve(null); } });
            document.body.appendChild(backdrop);
        });
    }

    private normalizeClassName(name?: string): string {
        if (!name) {
            return '';
        }
        const parts = name.split(/[:.#]/).filter(part => part && part !== ':');
        return parts.length > 0 ? parts[parts.length - 1] : name;
    }

    public handleInstancesOverviewResponse(response: InstancesOverviewResponse): void {
        const pending = this.instanceOverviewRequests.get(response.requestId);
        if (!pending) {
            return;
        }

        window.clearTimeout(pending.timeoutHandle);
        this.instanceOverviewRequests.delete(response.requestId);

        if (!response.success) {
            pending.reject(new Error(response.message ?? 'Failed to retrieve instances overview'));
            return;
        }

        const instances = (response.instances ?? [])
            .filter(instance => !instance.hidden)
            .map(instance => ({
                id: instance.id,
                className: this.normalizeClassName(instance.className) || instance.className
            }));

        pending.resolve(instances);
    }

   
    private countRootInstances(): number {
        const diagramContainer = document.getElementById('sprotty');
        if (!diagramContainer) {
            return 0;
        }

        const instanceNodes = diagramContainer.querySelectorAll('[data-svg-metadata-type="ecore:instance"]');
        let rootInstanceCount = 0;

        instanceNodes.forEach(node => {
            let parent = node.parentElement;
            let isNested = false;

            while (parent && parent !== diagramContainer) {
                if (parent.hasAttribute('data-svg-metadata-type') &&
                    parent.getAttribute('data-svg-metadata-type') === 'ecore:instance') {
                    isNested = true;
                    break;
                }
                parent = parent.parentElement;
            }

            if (!isNested) {
                rootInstanceCount++;
            }
        });

        return rootInstanceCount;
    }
}

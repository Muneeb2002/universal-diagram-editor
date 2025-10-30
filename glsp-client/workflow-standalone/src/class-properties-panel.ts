import { GLSPActionDispatcher } from '@eclipse-glsp/client';
import { ClassPropertiesResponse, createChangeClassTypeAction, createDeleteClassAction } from './ecore-client-actions';

export class ClassPropertiesPanel {
	private root: HTMLElement | null = null;
	private dispatcher: GLSPActionDispatcher;
	private data: ClassPropertiesResponse['classes'] = [];

	constructor(dispatcher: GLSPActionDispatcher) {
		this.dispatcher = dispatcher;
	}

	public show(data: ClassPropertiesResponse['classes']): void {
		this.data = data;
		// Ensure only a single panel exists at any time
		const existing = document.getElementById('class-properties-panel');
		if (existing && existing.parentElement) {
			existing.parentElement.removeChild(existing);
		}
		this.create();
		if (this.root) document.body.appendChild(this.root);
		// Reserve space for docked panel globally
		document.body.style.setProperty('--bottom-panel-height', '300px');
		document.body.style.paddingBottom = '300px';
	}

	private create(): void {

		this.root = document.createElement('div');
		this.root.id = 'class-properties-panel';
		this.root.style.cssText = `position:fixed; left: calc(var(--left-sidebar-width, 0px) + 24px); right: 0; bottom: 0; height:300px; background:#fff; border: 1px solid #e0e0e0; border-left:none; border-bottom:none; border-top-left-radius:0; border-top-right-radius:10px; display:flex; z-index:1001; font-family:Arial, sans-serif;`;

		const left = document.createElement('div');
		left.style.cssText = `flex:1;overflow:auto;padding: 12px 18px 18px 18px;`;
		left.innerHTML = `<div style="padding:12px 4px;font-weight:bold;border-bottom:1px solid #eee;">Class Properties</div>`;
		const table = document.createElement('table');
		table.style.cssText = 'width:100%;border-collapse:collapse;font-size:13px;';
		const thead = document.createElement('thead');
		thead.innerHTML = `
			<tr>
				<th style="position:sticky;top:0;background:#fafafa;border-bottom:1px solid #eaeaea;box-shadow:0 1px 0 rgba(0,0,0,.04);text-align:left;padding:12px 14px;z-index:1;">Class</th>
				<th style="position:sticky;top:0;background:#fafafa;border-bottom:1px solid #eaeaea;box-shadow:0 1px 0 rgba(0,0,0,.04);text-align:center;padding:12px 14px;width:120px;z-index:1;">Abstract</th>
				<th style="position:sticky;top:0;background:#fafafa;border-bottom:1px solid #eaeaea;box-shadow:0 1px 0 rgba(0,0,0,.04);text-align:center;padding:12px 14px;width:120px;z-index:1;">Interface</th>
				<th style="position:sticky;top:0;background:#fafafa;border-bottom:1px solid #eaeaea;box-shadow:0 1px 0 rgba(0,0,0,.04);text-align:center;padding:12px 14px;width:90px;z-index:1;">Delete</th>
			</tr>`;
		table.appendChild(thead);
		const tbody = document.createElement('tbody');
		this.data.forEach(c => {
			const tr = document.createElement('tr');
			tr.style.cssText = 'border-bottom:1px solid #f2f2f2;';
			const tdClass = document.createElement('td');
			tdClass.style.cssText = 'padding:12px 14px;font-weight:600;cursor:pointer;';
			tdClass.textContent = c.className;
			// Clicking class name no longer shows a right pane; no-op
			const tdAbs = document.createElement('td');
			tdAbs.style.cssText = 'text-align:center;padding:12px 14px;';
			const absCb = document.createElement('input');
			absCb.type = 'checkbox';
			absCb.checked = !!c.isAbstract;
			const tdInt = document.createElement('td');
			tdInt.style.cssText = 'text-align:center;padding:12px 14px;';
			const intCb = document.createElement('input');
			intCb.type = 'checkbox';
			intCb.checked = !!c.isInterface;

            const onAnyChange = async () => {
				let type: 'abstract'|'concrete'|'interface'|'abstract-interface';
				if (absCb.checked && intCb.checked) type = 'abstract-interface';
				else if (absCb.checked) type = 'abstract';
				else if (intCb.checked) type = 'interface';
				else type = 'concrete';
				await this.dispatcher.dispatch(createChangeClassTypeAction(c.className, type));
			};

			absCb.addEventListener('change', onAnyChange);
			intCb.addEventListener('change', onAnyChange);

            tdAbs.appendChild(absCb);
			tdInt.appendChild(intCb);
			const tdDel = document.createElement('td');
			tdDel.style.cssText = 'text-align:center;padding:12px 14px;';
            const delBtn = document.createElement('button');
            delBtn.textContent = '🗑️';
            delBtn.title = 'Delete class';
            delBtn.style.cssText = 'border:none;background:transparent;cursor:pointer;font-size:16px;line-height:1;';
            delBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const ok = confirm(`Delete class '${c.className}'? This will remove references.`);
                if (ok) {
                    await this.dispatcher.dispatch(createDeleteClassAction(c.className, true));
                    tr.remove();
                }
            });
            tdDel.appendChild(delBtn);
			tr.appendChild(tdClass);
			tr.appendChild(tdAbs);
			tr.appendChild(tdInt);
            tr.appendChild(tdDel);
			tbody.appendChild(tr);
		});
		table.appendChild(tbody);
		left.appendChild(table);

        this.root.appendChild(left);
    }
}



/**
 * @author Abigail Sotomayor <s205720@dtu.dk>
 */
import { injectable } from 'inversify';
import { ActionHandler } from '@eclipse-glsp/server';
import { Action, MessageAction } from '@eclipse-glsp/protocol';
import { SaveGraphicalModelAction } from '../ecore-actions';
import * as fs from 'fs';
import * as path from 'path';

@injectable()
export class SaveGraphicalModelActionHandler implements ActionHandler {
    actionKinds = [SaveGraphicalModelAction.KIND];

    async execute(action: Action): Promise<Action[]> {
        if (!SaveGraphicalModelAction.is(action)) {
            return [];
        }

        try {
            const filename = this.ensureJsonExtension(action.filename?.trim() ?? 'graphical-model.json');
            const targetPath = this.resolveTargetPath(filename);
            fs.mkdirSync(path.dirname(targetPath), { recursive: true });
            fs.writeFileSync(targetPath, action.content, { encoding: 'utf8' });

            console.log(`Saved graphical model to ${targetPath}`);

            return [
                MessageAction.create(`Graphical model saved to ${targetPath}`, { severity: 'INFO' })
            ];
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error('Error saving graphical model:', error);
            return [
                MessageAction.create(`Failed to save graphical model: ${message}`, { severity: 'ERROR' })
            ];
        }
    }

    private resolveTargetPath(filename: string): string {
        if (path.isAbsolute(filename)) {
            return filename;
        }
        const baseDir = path.resolve(process.cwd(), 'samples', 'visual-configurations');
        return path.resolve(baseDir, filename);
    }

    private ensureJsonExtension(filename: string): string {
        if (!filename.toLowerCase().endsWith('.json')) {
            return `${filename}.json`;
        }
        return filename;
    }
}


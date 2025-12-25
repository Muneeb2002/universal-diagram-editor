/********************************************************************************
 * Copyright (c) 2024 Eclipse GLSP and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * SPDX-License-Identifier: EPL-2.0
 ********************************************************************************/

import { CompoundOperation } from '@eclipse-glsp/protocol';
import { inject, injectable } from 'inversify';
import { Command, CompoundCommand, OperationHandlerRegistry } from '@eclipse-glsp/server';
import { OperationHandler } from '@eclipse-glsp/server';

/**
 * Custom compound operation handler that allows processing compound operations
 * even when the model root is not fully initialized.
 */
@injectable()
export class EcoreCompoundOperationHandler extends OperationHandler {
    @inject(OperationHandlerRegistry)
    protected operationHandlerRegistry: OperationHandlerRegistry;

    operationType = CompoundOperation.KIND;

    override handles(operation: any): boolean {
        return operation.kind === this.operationType;
    }

    async createCommand(operation: CompoundOperation): Promise<Command | undefined> {
        const maybeCommands = operation.operationList.map(op => 
            this.operationHandlerRegistry.getOperationHandler(op)?.execute(op)
        );
        
        const commands: Command[] = [];
        for await (const command of maybeCommands) {
            if (command) {
                commands.push(command);
            }
        }
        
        return commands.length > 0 ? new CompoundCommand(commands) : undefined;
    }
}

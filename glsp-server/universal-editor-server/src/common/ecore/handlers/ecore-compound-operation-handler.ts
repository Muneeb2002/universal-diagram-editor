/**
 * @author Abigail Sotomayor <s205720@dtu.dk>
 */
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

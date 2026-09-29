/**
 * @author Abigail Sotomayor <s205720@dtu.dk>
 */
export interface EcoreInstance {
    id: string;
    
    eClassName: string;
    
    metamodelKey: string;
    
    attributes: Map<string, any>;
    
    references: Map<string, string | string[]>;
    
    position?: { x: number; y: number };
    
    size?: { width: number; height: number };

    componentBounds?: Record<string, { x: number; y: number; width: number; height: number }>;

    hidden?: boolean;

    isRoot?: boolean;
}

export interface InstanceModel {
    metamodelKey: string;
    
    instances: Map<string, EcoreInstance>;
    
    rootInstances: Set<string>;
}

export class InstanceFactory {
    private instanceCounter = 0;

    createInstance(
        eClassName: string,
        metamodelKey: string,
        position?: { x: number; y: number },
        options?: { hidden?: boolean; isRoot?: boolean }
    ): EcoreInstance {
        const id = this.generateInstanceId(eClassName);
        
        return {
            id,
            eClassName,
            metamodelKey,
            attributes: new Map(),
            references: new Map(),
            position,
            hidden: options?.hidden ?? false,
            isRoot: options?.isRoot ?? false
        };
    }

    private generateInstanceId(eClassName: string): string {
        this.instanceCounter++;
        return `${eClassName}_${this.instanceCounter}`;
    }

    resetCounter(): void {
        this.instanceCounter = 0;
    }
}

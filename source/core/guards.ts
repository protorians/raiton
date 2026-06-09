import {GuardDeclaration} from "../types";
import {Logger} from "@protorians/logger";

export class RaitonGuards {
    protected static _map: Map<string, GuardDeclaration> = new Map();

    static set(name: string, guard: GuardDeclaration): typeof this {
        this._map.set(name, guard);
        return this;
    }

    static get(name: string): GuardDeclaration | undefined {
        return this._map.get(name);
    }

    static remove(name: string): typeof this {
        this._map.delete(name);
        return this;
    }

    static removeAll(): typeof this {
        Logger.error('Removing all guards');
        this._map.clear();
        return this;
    }

    static enabled(name: string): boolean {
        const guard = this.get(name);
        return (!guard) ? false : guard.enabled;
    }

    static enable(name: string): typeof this {
        const guard = this.get(name);
        if(guard) guard.enabled = true;
        return this;
    }

    static disable(name: string){
        const guard = this.get(name);
        if(guard) guard.enabled = false;
        return this;
    }
}
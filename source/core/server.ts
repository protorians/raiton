import type {ServerInterface, ServerOptions} from "../types";


export class Server implements ServerInterface {

    protected static _instance?: Server;

    static get instance(): Server | undefined {
        return this._instance
    }

    static set instance(value: Server) {
        this._instance = this._instance || value;
    }

    constructor(
        public readonly options: ServerOptions
    ) {
        Server.instance = this;
    }

    option<K extends keyof ServerOptions>(key: K): ServerOptions[K] {
        return this.options[key];
    }

}
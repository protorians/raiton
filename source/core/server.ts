import type {ServerInterface, ServerOptionsInterface} from "../types";


export class Server implements ServerInterface {

    protected static _instance?: Server;

    static get instance(): Server | undefined {
        return this._instance
    }

    static set instance(value: Server) {
        this._instance = this._instance || value;
    }

    constructor(
        public readonly options: ServerOptionsInterface
    ) {
        Server.instance = this;
    }

    option<K extends keyof ServerOptionsInterface>(key: K): ServerOptionsInterface[K] {
        return this.options[key];
    }

}
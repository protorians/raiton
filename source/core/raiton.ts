import {ServerInterface, ThreadInterface} from "../types";


export class Raiton {
    protected static _server: ServerInterface | undefined;
    protected static _thread: ThreadInterface | undefined;

    static title: string = 'Protorians Raiton';
    static identifier: string = 'raiton';

    static get server(): ServerInterface {
        if (!this._server)
            throw new Error(`${Raiton.title} Server instance not initialized`);
        return this._server;
    }

    static set server(server: ServerInterface | undefined) {
        this._server = this._server || server;
    }

    static get thread(): ThreadInterface {
        if (!this._thread)
            throw new Error(`${Raiton.title} Thread instance not initialized`);
        return this._thread;
    }

    static set thread(thread: ThreadInterface | undefined) {
        this._thread = this._thread || thread;
    }

}
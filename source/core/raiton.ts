import {RaitonSignalMapInterface, ThreadInterface} from "../types";
import {ISignalStack, Signal} from "@protorians/core";


export class Raiton {
    protected static _thread: ThreadInterface | undefined;

    static readonly signals: ISignalStack<RaitonSignalMapInterface> = new Signal.Stack<RaitonSignalMapInterface>()
    static title: string = 'Protorians Raiton';
    static identifier: string = 'raiton';

    static get thread(): ThreadInterface| undefined {
        // if (!this._thread) throw new Error(`${Raiton.title} Thread instance not initialized`);
        return this._thread;
    }

    static set thread(thread: ThreadInterface | undefined) {
        this._thread = this._thread || thread;
    }
}
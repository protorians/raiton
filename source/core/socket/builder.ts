import {registerSocket} from "./metadata";

export function compileSocket(SocketClass: any) {
    return registerSocket(SocketClass);
}

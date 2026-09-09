import {registerSocket, unregisterSocket, getSocketMetadata} from "./metadata.ts";
import {Injection} from "../injection/index.ts";

export function compileSocket(SocketClass: any) {
    const metadata = getSocketMetadata(SocketClass.prototype || SocketClass)
    const namespace = metadata.namespace || '/'
    unregisterSocket(namespace)
    Injection.invalidateCascade(SocketClass.name)
    return registerSocket(SocketClass);
}

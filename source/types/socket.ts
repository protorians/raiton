
export interface SocketMetaInterface {
    namespace: string;
    events: SocketEventMetaInterface[];
}

export interface SocketEventMetaInterface {
    name: string;
    propertyKey: string;
    type: SocketEventType;
}

export type SocketEventType = 'message' | 'connect' | 'disconnect' | 'event';

export type SocketDecoratorCallable = (metadata: SocketMetaInterface) => void;

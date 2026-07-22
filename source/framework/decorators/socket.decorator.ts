import {getSocketMetadata} from "../../core/socket";
import {Injectable} from "..";
import {LifetimeEnum} from "@protorians/core";
import {SocketEventType} from "../../types";

export function Socket(namespace = '/') {
    return (target: any) => {
        const name = target.name;
        Injectable(LifetimeEnum.TRANSIENT, name)(target)

        const meta = getSocketMetadata(target.prototype || target)
        meta.namespace = namespace;
    }
}

function createSocketEventDecorator(type: SocketEventType, name?: string) {
    return (target: any, propertyKey: string) => {
        const meta = getSocketMetadata(target)
        meta.events.push({
            type,
            name: name || propertyKey,
            propertyKey
        })
    }
}

export function OnSocketConnect() {
    return createSocketEventDecorator('connect')
}

export function OnSocketDisconnect() {
    return createSocketEventDecorator('disconnect')
}

export function OnSocketMessage(name?: string) {
    return createSocketEventDecorator('message', name)
}

export function OnSocketEvent(name: string) {
    return createSocketEventDecorator('event', name)
}

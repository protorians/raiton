import {getControllerMetadata} from "../../core/controller/index.ts";
import {Injectable} from "../index.ts";
import {LifetimeEnum} from "@protorians/core";
import {ControllerDecoratorCallable} from "../../types/index.ts";

export function Controllable(prefix = '') {
    return (target: any) => {
        const name = target.name;
        Injectable(LifetimeEnum.TRANSIENT, name,)(target)

        const meta = getControllerMetadata(target.prototype || target)
        meta.prefix = prefix;
    }
}

export function createControllerDecorator(callable: ControllerDecoratorCallable) {
    return (target: any) => {
        callable(getControllerMetadata(target.prototype || target))
    }
}
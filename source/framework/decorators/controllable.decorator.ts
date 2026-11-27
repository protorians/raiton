import {getControllerMetadata} from "../../core/controller/metadata.ts";
import {Injectable} from "./injection.decorator.ts";
import {LifetimeEnum} from "@protorians/core";
import type {ControllerDecoratorCallable} from "../../types/controller.ts";

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
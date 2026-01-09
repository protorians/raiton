import {getControllerMetadata} from "@/core/controller";
import {Injectable} from "@/sdk";
import {LifetimeEnum} from "@protorians/core";

export function Controllable(prefix = '') {
  return (target: any) => {
    const name = target.name;
    Injectable(LifetimeEnum.TRANSIENT, name, )(target)

    const meta = getControllerMetadata(target.prototype || target)
    meta.prefix = prefix;
  }
}
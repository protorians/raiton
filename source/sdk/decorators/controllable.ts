import {getControllerMetadata} from "@/core/controller";

export function Controllable(prefix = '') {
  return (target: any) => {
    const meta = getControllerMetadata(target.prototype || target)
    meta.prefix = prefix
  }
}
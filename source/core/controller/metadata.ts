import {ControllerMeta} from "@/types";

const META = Symbol('controller:meta')

export function getControllerMetadata(target: any): ControllerMeta {
  if (!target[META]) {
    target[META] = { routes: [] }
  }
  return target[META]
}
